'use strict';
const { recoverPlan } = require('./late-series-runtime');

// Embedded verbatim in Code nodes. Inputs are source records, never instructions.
function revisionHelpers() {
	const text = (v) => String(v ?? '').trim();
	const number = (v, label) => {
		if (v === '' || v == null || typeof v === 'boolean' || !Number.isFinite(Number(v)))
			throw Error(label + ' must be a number');
		return Number(v);
	};
	const instant = (v, label) => {
		if (
			!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(text(v)) ||
			!Number.isFinite(Date.parse(v))
		)
			throw Error(label + ' needs an ISO timestamp with UTC offset');
		return Date.parse(v);
	};
	const rows = (input, key) => {
		const out = input.filter((r) => Object.keys(r).some((k) => k !== 'row_number' && text(r[k]))),
			seen = new Set();
		for (const r of out) {
			if (!text(r[key]) || seen.has(text(r[key]))) throw Error('Every row needs a unique ' + key);
			seen.add(text(r[key]));
		}
		return out;
	};
	return { text, number, instant, rows };
}

function prepareBookings(cfg, rows, now) {
	const h = revisionHelpers(),
		all = h.rows(rows, 'BookingId');
	const date =
		cfg.planningDate ||
		new Intl.DateTimeFormat('en-CA', {
			timeZone: cfg.timezone || 'Europe/Lisbon',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(now);
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
		new Date(date + 'T12:00Z').toISOString().slice(0, 10) !== date
	)
		throw Error('planningDate must be YYYY-MM-DD');
	const requests = [],
		busy = [];
	const today = new Intl.DateTimeFormat('en-CA', {
		timeZone: cfg.timezone || 'Europe/Lisbon',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(now);
	if (date < today)
		throw Error('planningDate is in the past; choose a current or future booking date');
	for (const r of all) {
		if (h.text(r.Status).toLowerCase() === 'confirmed') {
			const start = h.instant(r.Start, 'Confirmed Start'),
				end = h.instant(r.End, 'Confirmed End');
			if (end <= start) throw Error('Confirmed booking must end after it starts');
			busy.push({ start, end, id: h.text(r.BookingId) });
			continue;
		}
		if (h.text(r.Date) !== date) continue;
		if (
			h.text(r.Approval).toLowerCase() !== 'approved' ||
			!['requested', ''].includes(h.text(r.Status).toLowerCase())
		)
			continue;
		const start = h.instant(r.EarliestStart, 'EarliestStart'),
			end = h.instant(r.LatestEnd, 'LatestEnd');
		const duration = h.number(r.DurationMinutes, 'DurationMinutes'),
			priority = h.number(r.Priority || 1, 'Priority');
		if (
			end <= start ||
			duration < 30 ||
			duration > 240 ||
			duration % 30 ||
			priority < 1 ||
			priority > 10
		)
			throw Error('Use 30–240 minutes in half-hour increments and priority 1–10');
		if (!h.text(r.Title) || h.text(r.Title).length > 80)
			throw Error('Booking Title needs 1–80 characters');
		const preferred = r.PreferredStart ? h.instant(r.PreferredStart, 'PreferredStart') : start;
		if (preferred < start || preferred + duration * 60000 > end)
			throw Error('PreferredStart must fit inside its requested window');
		requests.push({
			id: h.text(r.BookingId),
			title: h.text(r.Title),
			start,
			end,
			preferred,
			duration,
			priority,
		});
	}
	if (requests.length > 5)
		throw Error('At most five approved requests per planning date; split the call sheet first');
	const local = (t) =>
		new Intl.DateTimeFormat('en-CA', {
			timeZone: cfg.timezone || 'Europe/Lisbon',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(new Date(t));
	if (requests.some((r) => local(r.start) !== date || local(r.end - 1) !== date))
		throw Error('Booking windows must stay on Date in the configured timezone');
	return {
		ready: requests.length > 0,
		date,
		requests: requests.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)),
		busy,
		reason: requests.length ? '' : 'No approved requested bookings for ' + date,
		status: requests.length ? 'planning' : 'nothing_to_render',
	};
}

function scheduleBookings(cfg, brief, response, place, logs, now) {
	const h = revisionHelpers(),
		f = response.body || response;
	if (cfg.timezone !== place.timezone)
		throw Error('Config timezone must match the resolved location timezone');
	if (
		!f.hourly ||
		f.hourly_units?.time !== 'unixtime' ||
		f.hourly_units?.wind_speed_10m !== 'km/h' ||
		f.hourly_units?.temperature_2m !== '°C'
	)
		throw Error('Forecast requires Unix hourly times, km/h and Celsius');
	const rainLimit = h.number(cfg.maxRainProbability, 'maxRainProbability'),
		windLimit = h.number(cfg.maxWindKmh, 'maxWindKmh');
	const minTemp = h.number(cfg.minTemperatureC, 'minTemperatureC'),
		maxTemp = h.number(cfg.maxTemperatureC, 'maxTemperatureC');
	if (rainLimit < 0 || rainLimit > 100 || windLimit < 0 || minTemp >= maxTemp)
		throw Error('Invalid planning thresholds');
	const times = f.hourly.time,
		hourly = f.hourly;
	if (!Array.isArray(times) || !times.length) throw Error('Hourly forecast is empty');
	const samples = times.map((t, i) => {
		const start = h.number(t, 'hourly time') * 1000,
			rain = h.number(hourly.precipitation_probability?.[i], 'rain'),
			wind = h.number(hourly.wind_speed_10m?.[i], 'wind'),
			temperature = h.number(hourly.temperature_2m?.[i], 'temperature'),
			daylight = h.number(hourly.is_day?.[i], 'daylight'),
			code = h.number(hourly.weather_code?.[i], 'weather code');
		if (
			(i && start !== Number(times[i - 1]) * 1000 + 3600000) ||
			rain < 0 ||
			rain > 100 ||
			wind < 0 ||
			![0, 1].includes(daylight)
		)
			throw Error('Invalid or non-contiguous hourly forecast');
		return { start, end: start + 3600000, rain, wind, temperature, daylight, code };
	});
	const occupied = brief.busy.map((x) => ({ ...x })),
		decisions = [];
	const overlaps = (a, b) => a.start < b.end && b.start < a.end;
	for (const r of brief.requests) {
		const candidates = [],
			reasons = { calendar: 0, weather: 0, coverage: 0, past: 0 };
		for (
			let start = Math.ceil(r.start / 1800000) * 1800000;
			start + r.duration * 60000 <= r.end;
			start += 1800000
		) {
			const slot = { start, end: start + r.duration * 60000 };
			if (start < now.getTime()) {
				reasons.past++;
				continue;
			}
			if (occupied.some((b) => overlaps(slot, b))) {
				reasons.calendar++;
				continue;
			}
			const used = samples.filter((x) => overlaps(slot, x));
			if (!used.length || used[0].start > start || used.at(-1).end < slot.end) {
				reasons.coverage++;
				continue;
			}
			if (
				used.some(
					(x) =>
						!x.daylight ||
						x.rain > rainLimit ||
						x.wind > windLimit ||
						x.temperature < minTemp ||
						x.temperature > maxTemp ||
						[56, 57, 66, 67, 71, 73, 75, 77, 85, 86, 95, 96, 99].includes(x.code),
				)
			) {
				reasons.weather++;
				continue;
			}
			candidates.push({
				...slot,
				rain: Math.max(...used.map((x) => x.rain)),
				wind: Math.max(...used.map((x) => x.wind)),
			});
		}
		candidates.sort(
			(a, b) =>
				Math.abs(a.start - r.preferred) - Math.abs(b.start - r.preferred) ||
				a.rain - b.rain ||
				a.wind - b.wind ||
				a.start - b.start,
		);
		const chosen = candidates[0];
		if (chosen) occupied.push(chosen);
		decisions.push({
			BookingId: r.id,
			Title: r.title,
			Priority: r.priority,
			Decision: chosen ? (chosen.start === r.preferred ? 'keep' : 'reschedule') : 'defer',
			PreferredStart: new Date(r.preferred).toISOString(),
			Start: chosen ? new Date(chosen.start).toISOString() : '',
			End: chosen ? new Date(chosen.end).toISOString() : '',
			RainProbability: chosen?.rain ?? '',
			WindKmh: chosen?.wind ?? '',
			Reason: chosen
				? 'Tentative proposal; coordinator must confirm.'
				: Object.entries(reasons)
						.filter(([, n]) => n)
						.map(([k, n]) => k + ': ' + n + ' blocked slots')
						.join('; '),
		});
	}
	const key =
		'weather-bookings-' +
		encodeURIComponent(cfg.calendarLabel || 'outdoor') +
		'-' +
		brief.date +
		'-' +
		String(cfg.forecastRevision || 1);
	const saved = recoverPlan(cfg, key, logs);
	if (saved) return saved;
	const proposed = decisions.filter((x) => x.Start);
	return {
		ready: true,
		renderKey: key,
		date: brief.date,
		timezone: place.timezone,
		place,
		decisions,
		handoff: decisions,
		window: proposed.length ? { start: proposed[0].Start } : null,
		attention: decisions.some((x) => x.Decision !== 'keep'),
		caption:
			proposed.length + ' of ' + decisions.length + ' outdoor bookings have a tentative slot.',
		note: 'Priority-first scheduling; not a global optimum. Forecast guidance is not an official weather warning. Confirm proposals before inviting attendees.',
		source: 'Open-Meteo',
		calendarLabel: cfg.calendarLabel || 'Outdoor sessions',
		generatedAt: now.toISOString(),
	};
}

function calendarProposal(plan) {
	const escape = (s) =>
		String(s)
			.replace(/\\/g, '\\\\')
			.replace(/\r?\n/g, '\\n')
			.replace(/;/g, '\\;')
			.replace(/,/g, '\\,');
	const stamp = (s) =>
		new Date(s)
			.toISOString()
			.replace(/[-:]/g, '')
			.replace(/\.\d{3}Z$/, 'Z');
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Zvid//Outdoor Booking Proposals//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
	];
	for (const d of plan.decisions || [])
		if (d.Start)
			lines.push(
				'BEGIN:VEVENT',
				'UID:' + encodeURIComponent(plan.renderKey + '-' + d.BookingId) + '@zvid.io',
				'DTSTAMP:' + stamp(plan.generatedAt),
				'DTSTART:' + stamp(d.Start),
				'DTEND:' + stamp(d.End),
				'SUMMARY:' + escape('PROPOSED: ' + d.Title),
				'DESCRIPTION:' + escape(d.Reason + ' ' + plan.note),
				'STATUS:TENTATIVE',
				'TRANSP:TRANSPARENT',
				'END:VEVENT',
			);
	lines.push('END:VCALENDAR');
	// Fold by UTF-8 bytes, not code units, so non-ASCII titles remain valid.
	const folded =
		lines
			.flatMap((line) => {
				const out = [];
				let part = '';
				for (const c of line) {
					if (Buffer.byteLength(part + c) > 73) {
						out.push(part);
						part = ' ' + c;
					} else part += c;
				}
				out.push(part);
				return out;
			})
			.join('\r\n') + '\r\n';
	return {
		data: Buffer.from(folded).toString('base64'),
		mimeType: 'text/calendar',
		fileName: 'tentative-outdoor-bookings.ics',
	};
}

function pickMatchRequest(rows) {
	const h = revisionHelpers(),
		all = h.rows(rows, 'EventId').filter((r) => h.text(r.Enabled).toLowerCase() === 'yes');
	for (const r of all)
		if (!/^\d+$/.test(h.text(r.EventId)))
			throw Error('EventId must be a numeric TheSportsDB event ID');
	all.sort(
		(a, b) =>
			h.text(a.LastCheckedAt).localeCompare(h.text(b.LastCheckedAt)) ||
			h.text(a.EventId).localeCompare(h.text(b.EventId)),
	);
	return all[0]
		? { ready: true, request: all[0] }
		: {
				ready: false,
				status: 'nothing_to_render',
				reason: 'No Enabled=yes event in the Match Editorial Queue',
			};
}

function reviewMatch(cfg, request, response, logs, now) {
	const h = revisionHelpers();
	if (Number(response.statusCode) !== 200)
		throw Error('TheSportsDB is unavailable; preserve the existing review and approval');
	const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
	if (!body || !Array.isArray(body.events) || !body.events.length)
		throw Error('TheSportsDB returned no matching event');
	const events = body.events.filter((e) => h.text(e.idEvent) === h.text(request.EventId));
	if (!events.length) throw Error('The source response does not match the requested EventId');
	const facts = events.map((e) => {
		if (!['FT', 'AET', 'Match Finished'].includes(h.text(e.strStatus)))
			throw Error('The requested match is not a verified final; approval remains unchanged');
		const homeScore = h.number(e.intHomeScore, 'home score'),
			awayScore = h.number(e.intAwayScore, 'away score');
		if (![homeScore, awayScore].every((n) => Number.isInteger(n) && n >= 0 && n <= 999))
			throw Error('Invalid final score');
		const date = h.text(e.dateEvent);
		if (
			!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
			new Date(date + 'T12:00Z').toISOString().slice(0, 10) !== date ||
			date > now.toISOString().slice(0, 10)
		)
			throw Error('Invalid or future final date');
		if (!h.text(e.strHomeTeam) || !h.text(e.strAwayTeam) || !h.text(e.idLeague))
			throw Error('Final event lacks teams or league');
		if (cfg.leagueId && h.text(cfg.leagueId) !== h.text(e.idLeague))
			throw Error('Event does not belong to the configured league');
		return {
			eventId: h.text(e.idEvent),
			date,
			leagueId: h.text(e.idLeague),
			league: h.text(e.strLeague),
			home: h.text(e.strHomeTeam),
			away: h.text(e.strAwayTeam),
			homeScore,
			awayScore,
			status: h.text(e.strStatus),
		};
	});
	const fact = facts[0],
		factJson = JSON.stringify(fact);
	if (facts.some((f) => JSON.stringify(f) !== factJson))
		throw Error('Conflicting source versions for the requested event');
	const history = logs
		.filter((r) => String(r.RenderKey || '').startsWith('sports-editorial-' + fact.eventId + '-'))
		.map((r) => {
			let p;
			try {
				p = JSON.parse(r.PlanJson);
			} catch {
				throw Error('Malformed sports editorial history; inspect the log');
			}
			if (p.eventId !== fact.eventId || !Number.isInteger(p.edition))
				throw Error('Sports editorial history does not match its event');
			return { row: r, plan: p };
		})
		.sort((a, b) => b.plan.edition - a.plan.edition);
	if (new Set(history.map((x) => x.plan.edition)).size !== history.length)
		throw Error('Duplicate editorial edition in recovery log');
	const latest = history[0],
		published = history.find((x) => x.row.Status === 'completed' && x.row.VideoUrl);
	const same = latest && JSON.stringify(latest.plan.fact) === factJson;
	const edition = same ? latest.plan.edition : (latest?.plan.edition || 0) + 1;
	const snapshot = JSON.stringify({ edition, fact });
	const key = 'sports-editorial-' + fact.eventId + '-' + edition;
	// An uncertain or failed edition cannot be bypassed by a source correction.
	const blocked = latest && !same && !['completed', 'rate_limited'].includes(latest.row.Status);
	const state = same ? recoverPlan(cfg, key, logs) : null;
	const correction = Boolean(published && JSON.stringify(published.plan.fact) !== factJson);
	const approved =
		h.text(request.Approval).toLowerCase() === 'approved' &&
		h.text(request.ApprovedSnapshot) === snapshot;
	const ready = !blocked && !state && approved;
	const status = blocked
		? 'needs_review'
		: state?.status ||
			(approved ? 'approved' : correction ? 'correction_review' : 'awaiting_approval');
	const prior = correction ? published.plan.fact : null;
	const line = fact.home + ' ' + fact.homeScore + '–' + fact.awayScore + ' ' + fact.away;
	const previousLine = prior
		? prior.home + ' ' + prior.homeScore + '–' + prior.awayScore + ' ' + prior.away
		: '';
	const caption =
		(correction ? 'CORRECTION: ' : 'FINAL: ') +
		line +
		' (' +
		fact.date +
		').' +
		(prior ? ' Previous rendered version: ' + previousLine + '.' : '');
	return {
		ready,
		status,
		renderKey: key,
		eventId: fact.eventId,
		edition,
		fact,
		reviewSnapshot: snapshot,
		correction,
		prior,
		previousVideoUrl: published?.row.VideoUrl || '',
		videoUrl: state?.videoUrl || null,
		caption,
		date: fact.date,
		reason: blocked
			? 'Inspect the previous uncertain or failed edition before approving a replacement.'
			: state?.reason ||
				(!approved
					? 'Review CurrentSnapshot, set Approval=approved and copy it exactly into ApprovedSnapshot. Changed facts require fresh approval.'
					: ''),
		reviewUpdate: {
			EventId: fact.eventId,
			CurrentSnapshot: snapshot,
			ReviewStatus: status,
			LastCheckedAt: now.toISOString(),
			PriorVideoUrl: published?.row.VideoUrl || '',
			ChangeSummary: caption,
		},
		handoff: [
			{
				EventId: fact.eventId,
				Edition: edition,
				Mode: correction ? 'correction' : 'original',
				Date: fact.date,
				CurrentResult: line,
				PreviousResult: previousLine,
				PreviousVideoUrl: published?.row.VideoUrl || '',
				ApprovalSnapshot: snapshot,
				Source: 'https://www.thesportsdb.com/event/' + fact.eventId,
				Caption: caption,
			},
		],
	};
}

function revisionProject(cfg, plan, kind) {
	const text = (value, y, size = 46, color = '#FFFFFF') => ({
		type: 'TEXT',
		text: String(value),
		x: 80,
		y,
		width: 920,
		anchor: 'top-left',
		style: { fontFamily: 'Arial', fontSize: size + 'px', fontWeight: '600', color },
	});
	const scene = (id, title, body, footer, duration = 6) => ({
		id,
		duration,
		backgroundColor: kind === 'weather' ? '#102B36' : '#13213D',
		visuals: [text(title, 240, 58), text(body, 520), text(footer, 1530, 27, '#BCD6E4')],
	});
	let scenes;
	if (kind === 'weather')
		scenes = [
			scene(
				'call-sheet',
				plan.calendarLabel + ' · ' + plan.date,
				plan.caption + '\nAll slots are proposals; confirm before booking.',
				'Open-Meteo · ' + plan.timezone,
				5,
			),
			...plan.decisions.map((d, i) =>
				scene(
					'booking-' + i,
					d.Decision.toUpperCase() + ' · ' + d.Title,
					d.Start
						? new Intl.DateTimeFormat('en-GB', {
								timeZone: plan.timezone,
								hour: '2-digit',
								minute: '2-digit',
							}).format(new Date(d.Start)) +
								'–' +
								new Intl.DateTimeFormat('en-GB', {
									timeZone: plan.timezone,
									hour: '2-digit',
									minute: '2-digit',
								}).format(new Date(d.End)) +
								'\nRain ' +
								d.RainProbability +
								'% · Wind ' +
								Math.round(d.WindKmh) +
								' km/h'
						: d.Reason,
					'Booking ' + d.BookingId + ' · priority ' + d.Priority + ' · ' + plan.timezone,
					6,
				),
			),
		];
	else {
		const f = plan.fact;
		scenes = [
			scene(
				'edition',
				plan.correction ? 'CORRECTED MATCH REPORT' : 'APPROVED MATCH REPORT',
				f.home + '\n' + f.homeScore + ' – ' + f.awayScore + '\n' + f.away,
				f.date + ' · TheSportsDB · edition ' + plan.edition,
				7,
			),
		];
		if (plan.correction)
			scenes.push(
				scene(
					'correction',
					'WHAT CHANGED',
					plan.prior.home +
						' ' +
						plan.prior.homeScore +
						'–' +
						plan.prior.awayScore +
						' ' +
						plan.prior.away +
						'\nReplaced by\n' +
						f.home +
						' ' +
						f.homeScore +
						'–' +
						f.awayScore +
						' ' +
						f.away,
					'Prior video retained in the correction pack',
					7,
				),
			);
		scenes.push(
			scene(
				'handoff',
				'EDITORIAL HANDOFF',
				'Checked final status: ' +
					f.status +
					'\nMatch date: ' +
					f.date +
					'\nReview the source and caption before publication.',
				'Event ' + f.eventId + ' · No automatic social publication',
				5,
			),
		);
	}
	return {
		...plan,
		payload: {
			name: kind + '-brief-' + plan.date + '-' + (plan.edition || 1),
			width: 1080,
			height: 1920,
			fps: 30,
			scenes,
			audios: plan.musicOk && cfg.musicUrl ? [{ src: cfg.musicUrl, volume: 0.12 }] : [],
		},
	};
}

module.exports = {
	revisionHelpers,
	prepareBookings,
	scheduleBookings,
	calendarProposal,
	pickMatchRequest,
	reviewMatch,
	revisionProject,
};
