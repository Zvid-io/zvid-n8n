'use strict';

// Embedded in n8n Code nodes. Keep these functions independent of Node modules.
function helpers() {
	const text = (v) => String(v ?? '').trim();
	const number = (v, label) => {
		if (
			v === null ||
			v === undefined ||
			v === '' ||
			typeof v === 'boolean' ||
			!Number.isFinite(Number(v))
		)
			throw Error(label + ' must be a finite number');
		return Number(v);
	};
	const iso = (v, label = 'Date') => {
		const s = text(v);
		if (
			!/^\d{4}-\d{2}-\d{2}$/.test(s) ||
			!Number.isFinite(Date.parse(s + 'T12:00:00Z')) ||
			new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) !== s
		)
			throw Error(label + ' must be a real YYYY-MM-DD date');
		return s;
	};
	const day = (now, timezone = 'UTC') =>
		new Intl.DateTimeFormat('en-CA', {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(now);
	const shift = (s, n) =>
		new Date(Date.parse(s + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
	const truth = (v) => v === true || /^(true|yes|1)$/i.test(text(v));
	const https = (v, label) => {
		const s = text(v);
		if (!/^https:\/\/[^\s/]+(?:\/\S*)?$/i.test(s)) throw Error(label + ' must be an HTTPS URL');
		return s;
	};
	const unique = (rows, key) => {
		const seen = new Set();
		for (const r of rows) {
			const s = text(r[key]);
			if (!s || seen.has(s)) throw Error('Every row needs a unique ' + key);
			seen.add(s);
		}
	};
	const noWork = (reason, extra = {}) => ({
		ready: false,
		status: 'nothing_to_render',
		creditsSpent: 0,
		reason,
		...extra,
	});
	return { text, number, iso, day, shift, truth, https, unique, noWork };
}

function recoverPlan(cfg, key, rows) {
	const matches = rows.filter((r) => String(r.RenderKey || '') === key);
	if (matches.length > 1) throw Error('Duplicate RenderKey in log: ' + key);
	const row = matches[0];
	if (!row) return null;
	// An explicit capacity rejection accepted no paid job. It can be retried on
	// a later run; uncertain submissions and failed accepted jobs remain locked.
	if (row.Status === 'rate_limited' && !row.JobId && !row.VideoUrl) return null;
	if (row.Status === 'completed' || row.VideoUrl)
		return {
			ready: false,
			status: 'already_completed',
			renderKey: key,
			videoUrl: row.VideoUrl || null,
			creditsSpent: 0,
		};
	if (row.Status === 'rendering' && row.JobId && cfg.dryRun !== true) {
		let plan;
		try {
			plan = JSON.parse(row.PlanJson);
		} catch {
			throw Error('Saved PlanJson is invalid for ' + key);
		}
		if (plan.renderKey !== key || plan.snapshotVersion !== 1)
			throw Error('Saved snapshot does not match ' + key);
		return { ...plan, ready: true, jobId: String(row.JobId), resumed: true };
	}
	return {
		ready: false,
		status: 'needs_review',
		renderKey: key,
		reason:
			cfg.dryRun === true
				? 'Preview skips existing jobs.'
				: 'Inspect the saved ' + row.Status + ' job before resetting this key.',
		jobId: row.JobId || null,
		creditsSpent: 0,
	};
}

function resumeOutstanding(cfg, logs, prefix) {
	if (cfg.dryRun === true) return null;
	const saved = logs
		.filter(
			(r) => String(r.RenderKey || '').startsWith(prefix) && r.Status === 'rendering' && r.JobId,
		)
		.sort((a, b) => String(a.RenderKey).localeCompare(String(b.RenderKey)));
	if (!saved.length) return null;
	// Recover paid work even when its source changed or a date rolled over.
	// Delivery approval is intentionally re-reviewed after such a recovery.
	const plan = recoverPlan(cfg, saved[0].RenderKey, logs);
	return { ...plan, emailApproved: false, deferredSavedJobs: saved.length - 1 };
}

function planQuiz(cfg, rows, logs, now) {
	const outstanding = resumeOutstanding(cfg, logs, 'quiz-');
	if (outstanding) return outstanding;
	const h = helpers(),
		today = h.day(now, cfg.timezone),
		key = 'quiz-' + today + '-' + h.text(cfg.episodeRevision || 1);
	const saved = recoverPlan(cfg, key, logs);
	if (saved) return saved;
	rows = rows
		.filter((r) => h.text(r.Question))
		.map((r) => {
			if (h.text(r.QuestionKey)) return r;
			// Content-derived keys survive sheet sorting; never use a row number as identity.
			let hash = 2166136261;
			for (const ch of h.text(r.Question).toLowerCase().replace(/\s+/g, ' '))
				hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
			return { ...r, QuestionKey: 'question-' + hash.toString(16).padStart(8, '0') };
		});
	h.unique(rows, 'QuestionKey');
	const prior = logs
		.filter((r) => r.Status === 'completed')
		.map((r) => {
			try {
				return JSON.parse(r.PlanJson);
			} catch {
				throw Error('Completed quiz log has invalid PlanJson');
			}
		});
	const used = new Set(prior.flatMap((p) => (p.questions || []).map((q) => q.key)));
	const usedText = new Set(
		prior.flatMap((p) => (p.questions || []).map((q) => h.text(q.question).toLowerCase())),
	);
	const topicCounts = {};
	for (const p of prior.slice(-Number(cfg.rotationEpisodes || 7)))
		for (const q of p.questions || []) topicCounts[q.topic] = (topicCounts[q.topic] || 0) + 1;
	const eligible = [],
		skipped = [],
		fingerprints = new Set();
	for (const r of rows) {
		const k = h.text(r.QuestionKey),
			question = h.text(r.Question),
			fingerprint = question.toLowerCase();
		if (fingerprints.has(fingerprint)) throw Error('Duplicate question text: ' + k);
		fingerprints.add(fingerprint);
		let reason = '';
		if (h.text(r.Status) || h.text(r.VideoUrl) || used.has(k) || usedText.has(fingerprint))
			reason = 'already_used';
		else if (h.text(r.Approval).toLowerCase() !== 'approved')
			reason = 'awaiting_editorial_approval';
		else if (cfg.topic && h.text(r.Topic).toLowerCase() !== h.text(cfg.topic).toLowerCase())
			reason = 'outside_requested_topic';
		if (reason) {
			skipped.push({ key: k, reason });
			continue;
		}
		const options = ['A', 'B', 'C'].map((x) => h.text(r['Option' + x])),
			answer = h.text(r.CorrectLetter).toUpperCase(),
			difficulty = h.text(r.Difficulty).toLowerCase();
		if (
			question.length > 130 ||
			options.some((s) => !s || s.length > 40) ||
			new Set(options.map((s) => s.toLowerCase())).size !== 3 ||
			!['A', 'B', 'C'].includes(answer)
		)
			throw Error('Invalid question/options/answer: ' + k);
		if (
			!['easy', 'medium', 'hard'].includes(difficulty) ||
			!h.text(r.Topic) ||
			!h.text(r.FunFact) ||
			h.text(r.FunFact).length > 200
		)
			throw Error('Topic, Difficulty and a reviewed FunFact (1–200 characters) are required: ' + k);
		const sourceUrl = h.https(r.SourceUrl, 'SourceUrl ' + k);
		// Rotate answer position reproducibly without changing which answer is correct.
		const offset = [...(today + k)].reduce((a, c) => a + c.charCodeAt(0), 0) % 3;
		const rotated = options.slice(offset).concat(options.slice(0, offset));
		eligible.push({
			key: k,
			question,
			topic: h.text(r.Topic),
			difficulty,
			optionA: rotated[0],
			optionB: rotated[1],
			optionC: rotated[2],
			correctLetter: 'ABC'[(options.indexOf(options['ABC'.indexOf(answer)]) - offset + 3) % 3],
			funFact: h.text(r.FunFact),
			sourceUrl,
		});
	}
	const questions = [];
	for (const difficulty of ['easy', 'medium', 'hard']) {
		const candidates = eligible.filter((q) => q.difficulty === difficulty);
		candidates.sort(
			(a, b) =>
				Number(questions.some((q) => q.topic === a.topic)) -
					Number(questions.some((q) => q.topic === b.topic)) ||
				(topicCounts[a.topic] || 0) - (topicCounts[b.topic] || 0) ||
				a.key.localeCompare(b.key),
		);
		if (!candidates.length)
			return h.noWork(
				'Add one approved, unused ' + difficulty + ' question before creating a balanced episode.',
				{ skipped },
			);
		questions.push(candidates[0]);
	}
	return {
		ready: true,
		renderKey: key,
		date: today,
		questions,
		skipped,
		caption: 'Three-question challenge: easy, medium, hard. Answers and sources follow the reveal.',
		handoff: questions.map((q, i) => ({
			Round: i + 1,
			Question: q.question,
			Topic: q.topic,
			Difficulty: q.difficulty,
			Answer: q.correctLetter + '. ' + q['option' + q.correctLetter],
			Explanation: q.funFact,
			Source: q.sourceUrl,
		})),
	};
}

function sampleKpiResponse(cfg, now) {
	if (cfg.metricsSource !== 'sample') throw Error('Sample metrics require metricsSource=sample.');
	const h = helpers(),
		end = h.shift(h.day(now, cfg.timezone), -1);
	return {
		statusCode: 200,
		body: {
			sampleData: true,
			company: 'SAMPLE DATA - Example team',
			generatedAt: now.toISOString(),
			periodStart: h.shift(end, -6),
			periodEnd: end,
			metrics: [
				{
					id: 'revenue',
					label: 'Example revenue',
					value: 120000,
					previous: 150000,
					unit: 'USD',
					lowerIsBetter: false,
					target: 160000,
					owner: 'Example sales team',
					action: 'Example: review the sales pipeline',
					history: [140000, 150000, 120000],
				},
				{
					id: 'conversion',
					label: 'Example conversion rate',
					value: 4.2,
					previous: 3.6,
					unit: '%',
					lowerIsBetter: false,
					target: 4,
					owner: 'Example growth team',
					action: 'Example: review campaign performance',
					history: [3.4, 3.6, 4.2],
				},
				{
					id: 'response',
					label: 'Example response time',
					value: 3.4,
					previous: 2.1,
					unit: 'hours',
					lowerIsBetter: true,
					target: 2.5,
					owner: 'Example support team',
					action: 'Example: review queue coverage',
					history: [2.5, 2.1, 3.4],
				},
			],
		},
	};
}

function planKpi(cfg, response, logs, now) {
	const sampleMode = cfg.metricsSource === 'sample';
	const scopedLogs = logs.filter(
		(r) => sampleMode === String(r.RenderKey || '').startsWith('kpi-sample-'),
	);
	const outstanding = resumeOutstanding(cfg, scopedLogs, 'kpi-');
	if (outstanding) return outstanding;
	const h = helpers();
	if (!['live', 'sample'].includes(cfg.metricsSource || 'live'))
		throw Error('metricsSource must be live or sample.');
	if (!sampleMode && !h.text(cfg.metricsUrl))
		throw Error(
			'KPI setup required: set metricsUrl for live data, or explicitly choose metricsSource=sample for a labeled test.',
		);
	if (Number(response.statusCode) !== 200)
		throw Error('Metrics source unavailable; no report or demo data will be rendered.');
	let b = response.body;
	if (typeof b === 'string') b = JSON.parse(b);
	if (sampleMode !== (b?.sampleData === true))
		throw Error('Metrics source mode does not match its sample-data marker.');
	if (!b || !Array.isArray(b.metrics) || !b.metrics.length)
		throw Error('Metrics source must contain metrics[]');
	const start = h.iso(b.periodStart, 'periodStart'),
		end = h.iso(b.periodEnd, 'periodEnd');
	if (start > end || end >= h.day(now, cfg.timezone))
		throw Error('Use a completed reporting period before today.');
	const age = (now.getTime() - Date.parse(b.generatedAt)) / 3600000;
	if (!Number.isFinite(age) || age < -0.1 || age > Number(cfg.maxDataAgeHours || 36))
		throw Error('Metrics snapshot is stale or generatedAt is invalid.');
	const key =
		(sampleMode ? 'kpi-sample-' : 'kpi-') +
		start +
		'-' +
		end +
		'-' +
		h.text(cfg.reportRevision || 1);
	const saved = recoverPlan(cfg, key, logs);
	if (saved) return saved;
	h.unique(b.metrics, 'id');
	const metrics = b.metrics
		.map((m) => {
			const value = h.number(m.value, m.id + ' value'),
				previous = h.number(m.previous, m.id + ' previous');
			if (typeof m.lowerIsBetter !== 'boolean')
				throw Error(m.id + ' lowerIsBetter must be true or false');
			const delta =
				previous === 0 ? null : Math.round(((value - previous) / Math.abs(previous)) * 10000) / 100;
			const target = m.target == null ? null : h.number(m.target, m.id + ' target');
			const targetMiss = target !== null && (m.lowerIsBetter ? value > target : value < target);
			const worsening = m.lowerIsBetter ? value > previous : value < previous;
			const threshold =
				m.alertPercent == null
					? Number(cfg.alertPercent || 10)
					: h.number(m.alertPercent, 'alertPercent');
			if (threshold <= 0) throw Error('alertPercent must be positive');
			const attention =
				targetMiss ||
				(worsening && (delta === null ? value !== previous : Math.abs(delta) >= threshold));
			const history = m.history == null ? null : m.history;
			if (
				history &&
				(!Array.isArray(history) ||
					history.length < 2 ||
					history.some((n) => typeof n !== 'number' || !Number.isFinite(n)) ||
					history.at(-1) !== value)
			)
				throw Error(m.id + ' history must end at the actual value');
			if (!h.text(m.label) || h.text(m.label).length > 50)
				throw Error('Metric label must contain 1–50 characters');
			const baseline =
				delta === null
					? 'No percentage comparison: previous value was zero.'
					: (delta > 0 ? '+' : '') + delta + '% versus previous period.';
			return {
				id: h.text(m.id),
				label: h.text(m.label),
				value,
				previous,
				unit: h.text(m.unit),
				delta,
				lowerIsBetter: m.lowerIsBetter,
				target,
				targetMiss,
				attention,
				history,
				owner: h.text(m.owner) || 'Unassigned',
				action: h.text(m.action) || 'Review the source dashboard; assign an owner.',
				baseline,
			};
		})
		.sort(
			(a, b) =>
				Number(b.attention) - Number(a.attention) ||
				Number(b.targetMiss) - Number(a.targetMiss) ||
				Math.abs(b.delta || 0) - Math.abs(a.delta || 0) ||
				a.id.localeCompare(b.id),
		);
	const exceptions = metrics.filter((m) => m.attention);
	if (cfg.onlyExceptions === true && !exceptions.length)
		return h.noWork('No target misses or material adverse changes.', { metrics });
	const selected = (cfg.onlyExceptions ? exceptions : metrics).slice(0, 5);
	const handoff = metrics.map((m) => ({
		DataMode: sampleMode ? 'SAMPLE DATA - TEST ONLY' : 'Live source',
		Metric: m.label,
		Current: m.value,
		Previous: m.previous,
		ChangePercent: m.delta === null ? 'N/A' : m.delta,
		Target: m.target ?? '',
		Status: m.attention ? 'review' : 'on_track',
		Owner: m.owner,
		Action: m.attention ? m.action : 'Monitor',
		Baseline: m.baseline,
	}));
	return {
		ready: true,
		renderKey: key,
		company: sampleMode ? 'SAMPLE DATA - Example team' : h.text(b.company) || cfg.brandName,
		period: start + ' to ' + end,
		metrics: selected,
		usingDemoData: sampleMode,
		attention: exceptions.length > 0,
		exceptionCount: exceptions.length,
		totalMetricCount: metrics.length,
		deferredFromVideo: metrics.length - selected.length,
		caption:
			(sampleMode ? 'SAMPLE DATA - TEST ONLY. ' : '') +
			exceptions.length +
			' metrics need review for ' +
			start +
			' to ' +
			end +
			'. Review the owner action register.',
		handoff,
	};
}

function selectPlace(cfg, response) {
	const h = helpers(),
		hits = (response.results || []).filter(
			(p) =>
				(!cfg.countryCode ||
					h.text(p.country_code).toUpperCase() === h.text(cfg.countryCode).toUpperCase()) &&
				(!cfg.admin1 || h.text(p.admin1).toLowerCase() === h.text(cfg.admin1).toLowerCase()),
		);
	if (hits.length !== 1)
		throw Error(
			'City selection is ' +
				(hits.length ? 'ambiguous' : 'empty') +
				'. Set countryCode and admin1; never silently choose the first city.',
		);
	const p = hits[0];
	h.number(p.latitude, 'latitude');
	h.number(p.longitude, 'longitude');
	return { place: { ...p, country: p.country || p.country_code, timezone: p.timezone || 'UTC' } };
}

function planWeather(cfg, forecast, place, logs, now) {
	const outstanding = resumeOutstanding(cfg, logs, 'weather-');
	if (outstanding) return outstanding;
	const h = helpers(),
		today = h.day(now, place.timezone),
		key =
			'weather-' +
			place.latitude +
			'-' +
			place.longitude +
			'-' +
			today +
			'-' +
			h.text(cfg.forecastRevision || 1);
	const saved = recoverPlan(cfg, key, logs);
	if (saved) return saved;
	if (!forecast.current || !forecast.daily || !forecast.hourly)
		throw Error('Forecast lacks current, daily or hourly data');
	const offset = h.number(forecast.utc_offset_seconds, 'utc_offset_seconds');
	const time = Date.parse(forecast.current.time + 'Z') - offset * 1000,
		age = (now.getTime() - time) / 3600000;
	if (!Number.isFinite(age) || age < -0.25 || age > 3 || forecast.daily.time?.[0] !== today)
		throw Error('Forecast is stale or belongs to a different local day');
	for (const k of [
		'temperature_2m',
		'apparent_temperature',
		'relative_humidity_2m',
		'wind_speed_10m',
		'weather_code',
	])
		h.number(forecast.current[k], 'current ' + k);
	for (const k of [
		'weather_code',
		'temperature_2m_max',
		'temperature_2m_min',
		'precipitation_probability_max',
	]) {
		if (forecast.daily[k]?.length < 4) throw Error('Four daily forecast values are required: ' + k);
		forecast.daily[k].slice(0, 4).forEach((v) => h.number(v, k));
	}
	const hourly = forecast.hourly,
		unit = forecast.hourly_units?.wind_speed_10m;
	const multiplier = { 'km/h': 1, 'm/s': 3.6, 'mp/h': 1.609344, mph: 1.609344, kn: 1.852 }[unit];
	if (!multiplier) throw Error('Unrecognized hourly wind unit');
	const hours = [];
	for (let i = 0; i < (hourly.time || []).length; i++) {
		const t = String(hourly.time[i]),
			hr = Number(t.slice(11, 13));
		if (
			!t.startsWith(today) ||
			hr < 6 ||
			hr > 20 ||
			Date.parse(t + 'Z') - offset * 1000 < now.getTime()
		)
			continue;
		const rain = h.number(hourly.precipitation_probability?.[i], 'hourly rain'),
			wind = h.number(hourly.wind_speed_10m?.[i], 'hourly wind') * multiplier,
			code = h.number(hourly.weather_code?.[i], 'hourly code');
		if (rain < 0 || rain > 100 || wind < 0) throw Error('Forecast values outside their ranges');
		hours.push({
			time: t,
			rain,
			wind,
			code,
			qualifies:
				rain <= Number(cfg.maxRainProbability ?? 30) &&
				wind <= Number(cfg.maxWindKmh ?? 25) &&
				![56, 57, 66, 67, 71, 73, 75, 77, 85, 86, 95, 96, 99].includes(code),
		});
	}
	if (!hours.length) return h.noWork('No future daytime hourly data remains for today.');
	const windows = [];
	for (let i = 0; i <= hours.length - 3; i++) {
		const run = hours.slice(i, i + 3);
		if (
			run.every((x) => x.qualifies) &&
			Date.parse(run[2].time + 'Z') - Date.parse(run[0].time + 'Z') === 7200000
		)
			windows.push({
				start: run[0].time.slice(11, 16),
				end: String(Number(run[2].time.slice(11, 13)) + 1).padStart(2, '0') + ':00',
				rain: Math.max(...run.map((x) => x.rain)),
				wind: Math.round(Math.max(...run.map((x) => x.wind))),
			});
	}
	windows.sort((a, b) => a.rain - b.rain || a.wind - b.wind || a.start.localeCompare(b.start));
	const window = windows[0] || null;
	return {
		ready: true,
		renderKey: key,
		forecast,
		place,
		date: today,
		window,
		attention: !window,
		caption: window
			? 'Lowest-rain qualifying three-hour window: ' +
				window.start +
				'–' +
				window.end +
				' ' +
				place.timezone +
				'.'
			: 'No three-hour window meets the configured rain/wind conditions today.',
		handoff: hours.map((x) => ({
			LocalTime: x.time,
			Timezone: place.timezone,
			RainProbability: x.rain,
			WindKmh: Math.round(x.wind),
			WeatherCode: x.code,
			MeetsPlanningThresholds: x.qualifies,
		})),
		source: 'Open-Meteo',
		note: 'Planning guidance from a forecast, not an official weather warning. Check local advisories.',
	};
}

function planSports(cfg, response, logs, now) {
	const outstanding = resumeOutstanding(cfg, logs, 'sports-');
	if (outstanding) return outstanding;
	const h = helpers();
	if (Number(response.statusCode) !== 200)
		throw Error('Sports source unavailable. No demo scores will be rendered.');
	let end = cfg.periodEnd ? h.iso(cfg.periodEnd) : h.shift(h.day(now, cfg.timezone), -1),
		start = cfg.periodStart ? h.iso(cfg.periodStart) : h.shift(end, -6);
	if (start > end || end >= h.day(now, cfg.timezone))
		throw Error('Sports recap must cover a completed period');
	const requestedPeriod = { start, end };
	const b = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
	if (!b || (!Array.isArray(b.events) && b.events !== null))
		throw Error('Sports response must contain events[]');
	const candidateDates = (b.events || [])
		.filter(
			(e) =>
				String(e.idLeague) === String(cfg.leagueId) &&
				['FT', 'AET', 'Match Finished'].includes(h.text(e.strStatus)) &&
				(!cfg.focusTeam ||
					[e.strHomeTeam, e.strAwayTeam].some(
						(t) => h.text(t).toLowerCase() === h.text(cfg.focusTeam).toLowerCase(),
					)),
		)
		.map((e) => h.iso(e.dateEvent, 'dateEvent'))
		.filter((d) => d <= requestedPeriod.end)
		.sort();
	const latestAvailableDate = candidateDates.at(-1) || null;
	let usedLatestAvailable = false;
	if (
		cfg.allowLatestAvailableResults === true &&
		!cfg.periodStart &&
		!cfg.periodEnd &&
		latestAvailableDate &&
		!candidateDates.some((d) => d >= start && d <= end)
	) {
		const ageDays =
			(Date.parse(h.day(now, cfg.timezone) + 'T12:00:00Z') -
				Date.parse(latestAvailableDate + 'T12:00:00Z')) /
			86400000;
		const maxAge = h.number(cfg.maxFallbackAgeDays ?? 30, 'maxFallbackAgeDays');
		if (maxAge < 1 || maxAge > 90) throw Error('maxFallbackAgeDays must be between 1 and 90.');
		if (ageDays <= maxAge) {
			end = latestAvailableDate;
			start = h.shift(end, -6);
			usedLatestAvailable = true;
		}
	}
	const key =
		'sports-' +
		cfg.leagueId +
		'-' +
		start +
		'-' +
		end +
		'-' +
		h
			.text(cfg.focusTeam || 'league')
			.replace(/[^a-z0-9]/gi, '')
			.toLowerCase() +
		'-' +
		h.text(cfg.recapRevision || 1);
	const saved = recoverPlan(cfg, key, logs);
	if (saved) return saved;
	const unique = new Map(),
		skipped = [];
	for (const e of b.events || []) {
		let reason = '';
		const date = h.iso(e.dateEvent, 'dateEvent');
		if (String(e.idLeague) !== String(cfg.leagueId)) reason = 'other_league';
		else if (date < start || date > end) reason = 'outside_period';
		else if (!['FT', 'AET', 'Match Finished'].includes(h.text(e.strStatus)))
			reason = 'not_verified_final';
		else if (
			cfg.focusTeam &&
			![e.strHomeTeam, e.strAwayTeam].some(
				(t) => h.text(t).toLowerCase() === h.text(cfg.focusTeam).toLowerCase(),
			)
		)
			reason = 'outside_club';
		if (reason) {
			skipped.push({ id: e.idEvent, reason });
			continue;
		}
		const homeScore = h.number(e.intHomeScore, 'home score'),
			awayScore = h.number(e.intAwayScore, 'away score');
		if (
			!Number.isInteger(homeScore) ||
			!Number.isInteger(awayScore) ||
			homeScore < 0 ||
			awayScore < 0 ||
			!h.text(e.idEvent) ||
			!h.text(e.strHomeTeam) ||
			!h.text(e.strAwayTeam)
		)
			throw Error('Invalid final event');
		const match = {
			id: h.text(e.idEvent),
			home: h.text(e.strHomeTeam),
			away: h.text(e.strAwayTeam),
			homeScore,
			awayScore,
			dateEvent: date,
			league: h.text(e.strLeague),
			season: h.text(e.strSeason),
		};
		if (unique.has(match.id) && JSON.stringify(unique.get(match.id)) !== JSON.stringify(match))
			throw Error('Conflicting final scores for ' + match.id);
		unique.set(match.id, match);
	}
	const all = [...unique.values()];
	if (!all.length)
		return h.noWork(
			'No verified finals in ' +
				start +
				' to ' +
				end +
				'. ' +
				(latestAvailableDate
					? 'Latest eligible feed date: ' +
						latestAvailableDate +
						'. Enable allowLatestAvailableResults for a dated, age-bounded recap, or choose an explicit past period.'
					: 'The feed returned no eligible completed match for this league/club.'),
			{ start, end, requestedPeriod, latestAvailableDate, skipped },
		);
	all.sort(
		(a, b) =>
			Math.abs(b.homeScore - b.awayScore) - Math.abs(a.homeScore - a.awayScore) ||
			b.homeScore + b.awayScore - (a.homeScore + a.awayScore) ||
			b.dateEvent.localeCompare(a.dateEvent) ||
			a.id.localeCompare(b.id),
	);
	const matches = all.slice(0, Math.max(1, Math.min(5, Number(cfg.maxMatches) || 5)));
	const totals = {
		matches: all.length,
		goals: all.reduce((s, m) => s + m.homeScore + m.awayScore, 0),
		draws: all.filter((m) => m.homeScore === m.awayScore).length,
	};
	let club = null;
	if (cfg.focusTeam) {
		club = { team: cfg.focusTeam, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
		for (const m of all) {
			const home = m.home.toLowerCase() === cfg.focusTeam.toLowerCase(),
				gf = home ? m.homeScore : m.awayScore,
				ga = home ? m.awayScore : m.homeScore;
			club.goalsFor += gf;
			club.goalsAgainst += ga;
			club[gf > ga ? 'wins' : gf === ga ? 'draws' : 'losses']++;
		}
	}
	return {
		ready: true,
		renderKey: key,
		league: all[0].league,
		season: all[0].season,
		roundLabel: usedLatestAvailable
			? 'Latest available results'
			: cfg.focusTeam
				? 'Club results'
				: 'Weekly final results',
		dateLine: start + ' to ' + end,
		requestedPeriod,
		latestAvailableDate,
		usedLatestAvailable,
		usingDemoData: false,
		matchCount: matches.length,
		matches,
		totals,
		club,
		skipped,
		caption:
			(usedLatestAvailable ? 'Latest available feed results; actual match period shown. ' : '') +
			all.length +
			' verified final matches returned by TheSportsDB for ' +
			start +
			' to ' +
			end +
			'. ' +
			totals.goals +
			' goals; ' +
			totals.draws +
			' draws. Feed coverage may be partial.',
		handoff: all.map((m) => ({
			EventId: m.id,
			Date: m.dateEvent,
			Home: m.home,
			HomeScore: m.homeScore,
			AwayScore: m.awayScore,
			Away: m.away,
			Source: 'TheSportsDB',
		})),
	};
}

function planCelebration(cfg, rows, logs, now, execution = {}) {
	// Explicit playback is read-only, independent of today's date, and never
	// falls through into new work when the saved key is missing or unfinished.
	if (String(cfg.replayRenderKey || '').trim()) {
		const key = String(cfg.replayRenderKey).trim();
		const matches = logs.filter(r => String(r.RenderKey || '') === key);
		if (cfg.dryRun === true) return helpers().noWork('Clear replayRenderKey to validate new content; dryRun never resumes saved jobs.');
		if (matches.length !== 1) return helpers().noWork('Replay needs exactly one saved row for ' + key + '. Check Celebration Runs.', { status: 'needs_review' });
		const row = matches[0];
		if (row.Status !== 'completed' || !row.JobId) return helpers().noWork('This saved key is not a completed render with a JobId. No new render was started.', { status: 'needs_review' });
		let plan;
		try { plan = JSON.parse(row.PlanJson); } catch { return helpers().noWork('The saved replay context is invalid. Check PlanJson; no render was started.', { status: 'needs_review' }); }
		if (plan.renderKey !== key || plan.snapshotVersion !== 1) return helpers().noWork('The saved replay context does not match this key.', { status: 'needs_review' });
		return { ...plan, ready: true, dryRun: false, renderKey: key, jobId: String(row.JobId), replayed: true, emailApproved: false, creditsSpent: 0 };
	}
	if (cfg.manualDemo === true) {
		if (!['test', 'manual', 'cli'].includes(execution.mode) || !String(execution.id || '')) return helpers().noWork('manualDemo runs only from the manual trigger. Disable it before scheduling real contacts.');
		const today = helpers().day(now, cfg.timezone);
		rows = [{ CelebrationKey: 'demo-manual-' + String(execution.id), Name: 'DEMO Ava', Type: 'birthday', Date: '2000-' + today.slice(5), Approval: 'approved', GreetingConsent: true, Email: '', EmailApproval: '', Message: 'Freshly rendered demo greeting. Wishing you a wonderful year ahead.' }];
		logs = logs.filter(r => String(r.RenderKey || '').startsWith('celebration-demo-manual-'));
	}
	const outstanding = resumeOutstanding(cfg, logs, 'celebration-');
	if (outstanding) return outstanding;
	const h = helpers(),
		today = h.day(now, cfg.timezone),
		year = Number(today.slice(0, 4)),
		mmdd = today.slice(5);
	rows = rows.filter((r) => h.text(r.Name));
	// Permanent source IDs survive row sorting and annual runs. Never derive an
	// ID from a mutable row number, or silently grant consent during migration.
	const seen = new Map();
	for (const [index, row] of rows.entries()) {
		const key = h.text(row.CelebrationKey), position = row.row_number || index + 2;
		if (!key) throw Error('Missing CelebrationKey at sheet row ' + position + '. Add a CelebrationKey column and a permanent unique ID for each occasion. Keep LastSentYear and Celebration Runs unchanged; fill Approval and GreetingConsent only after review.');
		if (seen.has(key)) throw Error('Duplicate CelebrationKey at sheet rows ' + seen.get(key) + ' and ' + position + '. Each occasion needs its own permanent ID; do not change IDs of previously rendered occasions.');
		seen.set(key, position);
	}
	const pending = [],
		skipped = [];
	for (const r of rows) {
		const k = h.text(r.CelebrationKey),
			type = h.text(r.Type).toLowerCase(),
			date = h.iso(r.Date, 'Date for ' + k);
		if (!['birthday', 'anniversary'].includes(type))
			throw Error('Type must be birthday or anniversary: ' + k);
		const leap = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;
		let due = date.slice(5);
		if (due === '02-29' && !leap) {
			if (cfg.leapDayPolicy === 'skip') continue;
			due = cfg.leapDayPolicy === 'march1' ? '03-01' : '02-28';
		}
		if (due !== mmdd) {
			skipped.push({ key: k, reason: 'not_due_today', dueDate: year + '-' + due });
			continue;
		}
		const key = 'celebration-' + k + '-' + type + '-' + year;
		const saved = recoverPlan(cfg, key, logs);
		if (saved?.ready) {
			pending.push(saved);
			continue;
		}
		if (saved) {
			skipped.push({ key: k, reason: saved.status });
			continue;
		}
		if (
			h.text(r.Approval).toLowerCase() !== 'approved' ||
			!h.truth(r.GreetingConsent) ||
			h.truth(r.DoNotContact)
		) {
			skipped.push({ key: k, reason: 'consent_or_approval_missing' });
			continue;
		}
		if (Number(r.LastSentYear) === year) {
			skipped.push({ key: k, reason: 'legacy_already_sent' });
			continue;
		}
		if (date > today) throw Error('Celebration date is in the future: ' + k);
		const years =
			type === 'anniversary'
				? year - Number(date.slice(0, 4))
				: h.truth(r.ShowAge)
					? year - Number(date.slice(0, 4))
					: null;
		if (type === 'anniversary' && years < 1) {
			skipped.push({ key: k, reason: 'anniversary_not_yet_one_year' });
			continue;
		}
		const name = h.text(r.Name),
			message = h.text(r.Message);
		if (name.length > 70 || message.length > 250)
			throw Error('Greeting name/message too long: ' + k);
		const email = h.text(r.Email);
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Invalid Email: ' + k);
		pending.push({
			ready: true,
			renderKey: key,
			name,
			type,
			years,
			message,
			email,
			emailApproved: h.text(r.EmailApproval).toLowerCase() === 'approved',
			caption:
				type === 'anniversary'
					? 'Celebrating ' + years + ' years with ' + name
					: 'Happy birthday, ' + name,
			privacyNote: 'Private greeting. Review recipient and consent before delivery.',
			handoff: [
				{
					CelebrationKey: k,
					Name: name,
					Occasion: type,
					Email: email,
					Delivery: 'manual_review',
					Date: today,
				},
			],
		});
	}
	pending.sort(
		(a, b) => Number(!!b.jobId) - Number(!!a.jobId) || a.renderKey.localeCompare(b.renderKey),
	);
	return pending.length
		? { ...pending[0], deferred: pending.length - 1, skipped }
		: h.noWork('No approved, consented, unfinished celebrations due today.', { skipped });
}

function classifySubmissionError(context, error, now, cfg) {
	const status = Number(
		error.httpCode ||
			error.statusCode ||
			error.status ||
			error.response?.status ||
			error.cause?.statusCode ||
			error.cause?.response?.status,
	);
	const rejected =
		status === 429 ||
		(!status &&
			error.name === 'NodeApiError' &&
			error.message === 'The service is receiving too many requests from you');
	let body =
		error.response?.data ||
		error.context?.data ||
		error.cause?.response?.data ||
		error.cause?.error ||
		{};
	if (typeof body === 'string') {
		try {
			body = JSON.parse(body);
		} catch {
			body = {};
		}
	}
	const headers = error.response?.headers || error.cause?.response?.headers || {};
	const raw = headers['retry-after'] ?? body.retryAfter;
	const retrySeconds = Math.max(30, Number(raw) || Math.ceil((Date.parse(raw) - now) / 1000) || 30);
	const deadline = context.submitStartedAt + Number(cfg.timeoutMinutes || 20) * 60000;
	const retry = rejected && context.submitAttempts < 3 && now + retrySeconds * 1000 < deadline;
	const reason = rejected
		? 'Zvid render capacity is full (HTTP 429); no job was accepted. ' +
			(retry
				? 'Retrying after ' + retrySeconds + ' seconds.'
				: 'Retry this workflow later; the rejected key is safe to reuse.')
		: 'Render submission outcome is uncertain. Inspect https://app.zvid.io before retrying: ' +
			String(error.description || error.message || error);
	return {
		...context,
		status: rejected ? 'rate_limited' : 'needs_review',
		reason,
		retry,
		retrySeconds,
		videoUrl: null,
		checkpoint: {
			...context.checkpoint,
			submission: {
				status: rejected ? 'rate_limited' : 'needs_review',
				reason,
				attemptedAt: new Date(now).toISOString(),
			},
		},
	};
}

function completedResult(result) {
	if (result.status !== 'completed' || !/^https:\/\/\S+$/i.test(String(result.videoUrl || '')))
		throw Error(
			'Video is not ready (' +
				result.status +
				'): ' +
				(result.reason || 'Inspect the saved job in Zvid.') +
				' Job: ' +
				(result.jobId || 'unknown') +
				'. The tracking row was saved; no replacement render was submitted.',
		);
	return { ...result, nextStep: 'Review the video and source handoff before sharing.' };
}

function csvFile(rows, fileName) {
	const columns = Object.keys(rows[0] || {}),
		cell = (v) => {
			let s = String(v ?? '');
			if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
			return '"' + s.replace(/"/g, '""') + '"';
		};
	const csv = [
		columns.map(cell).join(','),
		...rows.map((r) => columns.map((k) => cell(r[k])).join(',')),
	].join('\r\n');
	return { data: Buffer.from(csv, 'utf8').toString('base64'), mimeType: 'text/csv', fileName };
}

module.exports = {
	helpers,
	recoverPlan,
	resumeOutstanding,
	planQuiz,
	sampleKpiResponse,
	planKpi,
	selectPlace,
	planWeather,
	planSports,
	planCelebration,
	classifySubmissionError,
	completedResult,
	csvFile,
};
