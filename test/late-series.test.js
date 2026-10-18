'use strict';
const { test } = require('node:test'),
	assert = require('node:assert/strict');
const domain = require('../scripts/late-series-runtime'),
	{ specs, buildLateSeries } = require('../scripts/build-late-series');
const { organizeWorkflow } = require('../scripts/organize-workflow-series');
const revision = require('../scripts/weather-sports-revision-runtime');
const now = new Date('2026-10-04T08:00:00Z');
const question = (difficulty, extra = {}) => ({
	QuestionKey: difficulty,
	Question: 'Which answer is correct for ' + difficulty + '?',
	OptionA: 'One',
	OptionB: 'Two',
	OptionC: 'Three',
	CorrectLetter: 'B',
	Topic: difficulty,
	Difficulty: difficulty,
	SourceUrl: 'https://example.com/reference',
	FunFact: 'Two is the reviewed answer.',
	Approval: 'approved',
	...extra,
});
const questions = () => ['easy', 'medium', 'hard'].map((d) => question(d));
const metricResponse = () => ({
	statusCode: 200,
	body: {
		company: 'Example',
		periodStart: '2026-09-21',
		periodEnd: '2026-09-27',
		generatedAt: now.toISOString(),
		metrics: [
			{
				id: 'revenue',
				label: 'Revenue',
				value: 80,
				previous: 100,
				unit: '$',
				lowerIsBetter: false,
				target: 110,
				owner: 'Finance',
				action: 'Review the revenue report',
			},
			{
				id: 'churn',
				label: 'Churn',
				value: 2,
				previous: 3,
				unit: '%',
				lowerIsBetter: true,
				target: 2.5,
				history: [4, 3, 2],
			},
		],
	},
});
const place = {
	name: 'Lisbon',
	admin1: 'Lisbon District',
	country: 'Portugal',
	country_code: 'PT',
	latitude: 38.72,
	longitude: -9.14,
	timezone: 'UTC',
};
const forecast = () => ({
	utc_offset_seconds: 0,
	current: {
		time: '2026-10-04T08:00',
		temperature_2m: 20,
		apparent_temperature: 19,
		relative_humidity_2m: 60,
		wind_speed_10m: 10,
		weather_code: 0,
	},
	current_units: { temperature_2m: '°C', wind_speed_10m: 'km/h' },
	daily: {
		time: ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'],
		weather_code: [0, 1, 2, 3],
		temperature_2m_max: [24, 25, 23, 22],
		temperature_2m_min: [16, 17, 16, 15],
		precipitation_probability_max: [10, 20, 30, 40],
	},
	hourly_units: { wind_speed_10m: 'km/h' },
	hourly: {
		time: Array.from(
			{ length: 15 },
			(_, i) => '2026-10-04T' + String(i + 6).padStart(2, '0') + ':00',
		),
		precipitation_probability: Array(15).fill(10),
		wind_speed_10m: Array(15).fill(12),
		weather_code: Array(15).fill(0),
	},
});
const event = (id, extra = {}) => ({
	idEvent: id,
	idLeague: '4328',
	strLeague: 'Example League',
	strSeason: '2026',
	strHomeTeam: 'Home ' + id,
	strAwayTeam: 'Away ' + id,
	intHomeScore: '2',
	intAwayScore: '0',
	dateEvent: '2026-10-03',
	strStatus: 'FT',
	...extra,
});
const celebration = (extra = {}) => ({
	CelebrationKey: 'person-birthday',
	Name: 'Alex',
	Type: 'birthday',
	Date: '1990-10-04',
	Approval: 'approved',
	GreetingConsent: true,
	Email: 'alex@example.com',
	...extra,
});
const inputs = {
	'quiz-shorts': questions(),
	'kpi-report-video': metricResponse(),
	'daily-weather-video': {
		...forecast(),
		hourly_units: { time: 'unixtime', wind_speed_10m: 'km/h', temperature_2m: '°C' },
		hourly: {
			...forecast().hourly,
			time: forecast().hourly.time.map((t) => Date.parse(t + 'Z') / 1000),
			temperature_2m: Array(15).fill(20),
			is_day: Array(15).fill(1),
		},
	},
	'sports-recap-video': {
		statusCode: 200,
		body: { events: [event('1'), event('2', { intHomeScore: '1', intAwayScore: '1' })] },
	},
	'birthday-greetings': [celebration()],
};
const configs = {
	'kpi-report-video': { metricsUrl: 'https://example.com/metrics' },
	'daily-weather-video': {
		countryCode: 'PT',
		admin1: 'Lisbon District',
		timezone: 'UTC',
		planningDate: '2026-10-04',
	},
};
const booking = (extra = {}) => ({
	BookingId: 'shoot-1',
	Date: '2026-10-04',
	Title: 'Product shoot',
	Status: 'requested',
	Approval: 'approved',
	EarliestStart: '2026-10-04T08:00Z',
	LatestEnd: '2026-10-04T18:00Z',
	PreferredStart: '2026-10-04T09:00Z',
	DurationMinutes: 60,
	Priority: 5,
	...extra,
});
const approvedEvent = () => {
	const r = { EventId: '1', Enabled: 'yes' };
	const p = revision.reviewMatch({ leagueId: '4328' }, r, inputs['sports-recap-video'], [], now);
	return { ...r, Approval: 'approved', ApprovedSnapshot: p.reviewSnapshot };
};

function runGraph(kind, input = inputs[kind], logs = [], overrides = {}, response = {}) {
	const original = require('../workflows/zvid-' + kind + '.json'),
		w = structuredClone(original),
		history = new Map(),
		ledger = structuredClone(logs),
		submissions = [],
		updates = [];
	const cfg = w.nodes.find((n) => n.name === specs[kind].config);
	const queueRows = structuredClone(
			response.queue ||
				(kind === 'daily-weather-video'
					? [booking()]
					: kind === 'sports-recap-video'
						? [approvedEvent()]
						: []),
		),
		reviewUpdates = [];
	cfg.parameters.jsonOutput = JSON.stringify({
		...JSON.parse(cfg.parameters.jsonOutput),
		...configs[kind],
		...overrides,
	});
	const access = (name) => ({
		isExecuted: history.has(name),
		first: () => {
			const a = history.get(name);
			assert.ok(a?.[0], 'No output from ' + name);
			return a[0];
		},
		all: () => history.get(name) || [],
	});
	const value = (v, d) =>
		typeof v === 'string' && v.startsWith('={{')
			? new Function('$json', '$', 'return (' + v.slice(3, -2) + ')')(d, access)
			: v;
	let elapsed = 0,
		submissionAttempts = 0;
	class FixedDate extends Date {
		constructor(...args) {
			super(...(args.length ? args : [now]));
		}
		static now() {
			return now.getTime() + elapsed;
		}
	}
	let steps = 0;
	function visit(name, items) {
		if (++steps > 100) throw Error('Graph did not stop');
		const n = w.nodes.find((n) => n.name === name),
			d = items[0]?.json || {};
		assert.ok(n, name);
		let outputs = [items];
		if (n.type === 'n8n-nodes-base.set')
			outputs = [[{ json: JSON.parse(n.parameters.jsonOutput) }]];
		else if (n.type === 'n8n-nodes-base.code')
			outputs = [
				new Function('$json', '$input', '$', 'Date', 'Buffer', '$execution', n.parameters.jsCode)(
					d,
					{ first: () => items[0], all: () => items },
					access,
					FixedDate,
					Buffer,
					{ id: response.executionId || 'test-execution', mode: 'manual' },
				),
			];
		else if (n.type === 'n8n-nodes-base.if')
			outputs = value(n.parameters.conditions.conditions[0].leftValue, d)
				? [items, []]
				: [[], items];
		else if (n.type === 'n8n-nodes-base.wait')
			elapsed += Number(value(n.parameters.amount, d)) * 1000;
		else if (n.type === 'n8n-nodes-base.googleSheets') {
			if (!n.parameters.operation || n.parameters.operation === 'read') {
				const rows =
					n.id === 'late-ledger' ? ledger : n.id === 'revision-queue' ? queueRows : input;
				outputs = [rows.length ? rows.map((json) => ({ json })) : [{ json: {} }]];
				if (response.repeatReadPerItem && !n.executeOnce) outputs = [items.flatMap(() => outputs[0])];
			} else {
				const fields = Object.fromEntries(
					Object.entries(n.parameters.columns.value).map(([k, v]) => [k, value(v, d)]),
				);
				let row =
					n.id === 'revision-review-save'
						? queueRows.find((r) => r.EventId === fields.EventId)
						: ledger.find((r) => r.RenderKey === fields.RenderKey);
				if (!row && n.parameters.operation === 'appendOrUpdate') {
					row = {};
					ledger.push(row);
				}
				assert.ok(row, 'Missing ledger row');
				Object.assign(row, fields);
				(n.id === 'revision-review-save' ? reviewUpdates : updates).push(fields);
				outputs = [[{ json: fields }]];
			}
		} else if (n.type === '@zvid/n8n-nodes-zvid.zvid') {
			if (n.parameters.operation === 'validate')
				outputs = [[{ json: { valid: true, creditsRequired: response.quote ?? 12 } }]];
			else if (n.parameters.operation === 'create') {
				submissionAttempts++;
				if (response.uncertain) throw Error('Simulated uncertain submission');
				const rejection = response.rejections?.[submissionAttempts - 1];
				if (rejection) outputs = [[], [{ json: { error: rejection } }]];
				else {
					submissions.push(JSON.parse(value(n.parameters.projectJson, d)));
					outputs = [[{ json: { jobId: 'accepted-1' } }]];
				}
			} else
				outputs = [
					[
						{
							json: response.error
								? { error: response.error }
								: {
										id: value(n.parameters.jobId, d),
										state: 'completed',
										result: 'https://cdn.zvid.io/videos/test/result.mp4',
									},
						},
					],
				];
		} else if (n.type === 'n8n-nodes-base.httpRequest') {
			if (n.name === 'Find the configured city candidates')
				outputs = [[{ json: { results: [place] } }]];
			else if (n.name === specs[kind].source) outputs = [[{ json: input }]];
			else if (n.id === 'late-music-probe')
				outputs = [
					[
						{
							json: {
								statusCode: response.musicStatus ?? 200,
								headers: { 'content-length': response.musicBytes ?? 1000 },
							},
						},
					],
				];
			else if (n.name === 'Generate voiceover') {
				const text = access('Write factual KPI narration from the checked values').first().json
					.narration;
				outputs = [
					[
						{
							json: {
								audio_base64: 'AA==',
								alignment: {
									characters: [...text],
									character_start_times_seconds: [...text].map((_, i) => i * 0.05),
									character_end_times_seconds: [...text].map((_, i) => (i + 1) * 0.05),
								},
							},
						},
					],
				];
			} else if (n.name === 'Upload voiceover')
				outputs = [[{ json: { upload: { url: 'https://cdn.example/voice.mp3' } } }]];
		}
		for (const o of outputs) assert.ok(Array.isArray(o), 'Code output must be an array: ' + name);
		history.set(name, outputs[0]);
		for (let i = 0; i < outputs.length; i++)
			if (outputs[i].length)
				for (const edge of w.connections[name]?.main?.[i] || []) visit(edge.node, outputs[i]);
	}
	let error;
	try {
		visit(w.nodes.find((n) => n.type === 'n8n-nodes-base.manualTrigger').name, [{ json: {} }]);
	} catch (e) {
		if (!response.captureFailure) throw e;
		error = e;
	}
	return {
		ledger,
		submissions,
		updates,
		history,
		error,
		submissionAttempts,
		elapsed,
		queueRows,
		reviewUpdates,
	};
}

test('Quiz balances difficulty, remaps correct answers and refuses reused or invalid content', () => {
	const p = domain.planQuiz({}, questions(), [], now);
	assert.deepEqual(
		p.questions.map((q) => q.difficulty),
		['easy', 'medium', 'hard'],
	);
	for (const q of p.questions) assert.equal(q['option' + q.correctLetter], 'Two');
	assert.equal(domain.planQuiz({}, questions().slice(0, 2), [], now).ready, false);
	assert.throws(
		() =>
			domain.planQuiz(
				{},
				[...questions(), question('easy', { QuestionKey: 'duplicate' })],
				[],
				now,
			),
		/Duplicate question text/,
	);
	assert.throws(
		() =>
			domain.planQuiz(
				{},
				questions().map((q) => ({ ...q, SourceUrl: '' })),
				[],
				now,
			),
		/HTTPS/,
	);
	const prior = [{ Status: 'completed', PlanJson: JSON.stringify(p) }];
	assert.equal(domain.planQuiz({ episodeRevision: 2 }, questions(), prior, now).ready, false);
});
test('KPI detects adverse changes, target misses, zero baselines and stale or missing data', () => {
	const cfg = configs['kpi-report-video'],
		p = domain.planKpi(cfg, metricResponse(), [], now);
	assert.equal(p.metrics[0].delta, -20);
	assert.equal(p.exceptionCount, 1);
	assert.equal(p.metrics[1].attention, false);
	const r = metricResponse();
	r.body.metrics[0].previous = 0;
	assert.equal(domain.planKpi(cfg, r, [], now).metrics.find((m) => m.id === 'revenue').delta, null);
	assert.throws(() => domain.planKpi(cfg, { statusCode: 500 }, [], now), /unavailable/);
	assert.throws(() => domain.planKpi({}, metricResponse(), [], now), /KPI setup required/);
	r.body.generatedAt = '2026-09-01T00:00:00Z';
	assert.throws(() => domain.planKpi(cfg, r, [], now), /stale/);
	const ok = metricResponse();
	ok.body.metrics = ok.body.metrics.slice(1);
	assert.equal(domain.planKpi({ ...cfg, onlyExceptions: true }, ok, [], now).ready, false);
});
test('Quiz migration derives stable keys, preserves completed rows and still requires approval', () => {
	const rows = questions().map((q) => ({ ...q, QuestionKey: '' }));
	const first = domain.planQuiz({}, rows, [], now),
		reordered = domain.planQuiz({}, [...rows].reverse(), [], now);
	assert.deepEqual(
		first.questions.map((q) => q.key),
		reordered.questions.map((q) => q.key),
	);
	assert.equal(
		domain.planQuiz({}, [{ Question: 'Previously used', Status: 'done' }, ...rows], [], now)
			.questions.length,
		3,
	);
	assert.equal(
		domain.planQuiz(
			{},
			rows.map((q) => ({ ...q, Approval: '' })),
			[],
			now,
		).ready,
		false,
	);
});
test('KPI sample mode is explicit, labeled, isolated from live recovery and blocked from Slack', () => {
	const cfg = { metricsSource: 'sample' },
		response = domain.sampleKpiResponse(cfg, now);
	const plan = domain.planKpi(cfg, response, [], now);
	assert.equal(plan.usingDemoData, true);
	assert.match(plan.renderKey, /^kpi-sample-/);
	assert.match(plan.caption, /SAMPLE DATA/);
	assert.ok(plan.handoff.every((row) => row.DataMode === 'SAMPLE DATA - TEST ONLY'));
	assert.throws(() => domain.sampleKpiResponse({}, now), /require/);
	assert.throws(
		() => domain.planKpi(configs['kpi-report-video'], response, [], now),
		/mode does not match/,
	);
	const live = domain.planKpi(configs['kpi-report-video'], metricResponse(), [], now);
	const pending = [
		{
			RenderKey: live.renderKey,
			Status: 'rendering',
			JobId: 'live-only',
			PlanJson: JSON.stringify({ ...live, snapshotVersion: 1 }),
		},
	];
	assert.equal(domain.planKpi(cfg, response, pending, now).jobId, undefined);
	const result = runGraph('kpi-report-video', null, [], {
		metricsSource: 'sample',
		metricsUrl: '',
		sendSlack: true,
		slackWebhookUrl: 'https://example.test/hook',
	});
	assert.equal(result.history.has(specs['kpi-report-video'].source), false);
	assert.equal(result.history.has('Post the checked KPI briefing to Slack'), false);
	assert.ok(
		result.submissions[0].scenes.every((scene) => /SAMPLE DATA/.test(JSON.stringify(scene))),
	);
	assert.throws(
		() => runGraph('kpi-report-video', null, [], { metricsSource: 'live', metricsUrl: '' }),
		/KPI setup required/,
	);
});
test('Sports latest-available mode shows real dates and respects explicit periods, age and deduplication', () => {
	const cfg = { leagueId: '4328', allowLatestAvailableResults: true, maxFallbackAgeDays: 30 };
	const response = {
		statusCode: 200,
		body: { events: [event('past', { dateEvent: '2026-09-20' })] },
	};
	const p = domain.planSports(cfg, response, [], now);
	assert.equal(p.ready, true);
	assert.equal(p.usedLatestAvailable, true);
	assert.equal(p.dateLine, '2026-09-14 to 2026-09-20');
	assert.match(p.roundLabel, /Latest available/);
	assert.match(p.caption, /actual match period/);
	assert.equal(
		domain.planSports(
			{ ...cfg, periodStart: '2026-09-27', periodEnd: '2026-10-03' },
			response,
			[],
			now,
		).ready,
		false,
	);
	assert.equal(
		domain.planSports({ ...cfg, maxFallbackAgeDays: 7 }, response, [], now).ready,
		false,
	);
	assert.equal(
		domain.planSports(
			cfg,
			{ statusCode: 200, body: { events: [event('future', { dateEvent: '2026-10-10' })] } },
			[],
			now,
		).ready,
		false,
	);
	assert.equal(
		domain.planSports(
			cfg,
			response,
			[{ RenderKey: p.renderKey, Status: 'completed', VideoUrl: 'https://example.test/done.mp4' }],
			now,
		).status,
		'already_completed',
	);
});
test('Weather rejects ambiguous places, stale/null readings and branches when no window qualifies', () => {
	const exported = require('../workflows/zvid-daily-weather-video.json');
	const defaultConfig = JSON.parse(
		exported.nodes.find((n) => n.type === 'n8n-nodes-base.set').parameters.jsonOutput,
	);
	assert.equal(defaultConfig.admin1, 'Lisbon District');
	assert.throws(
		() => domain.selectPlace({}, { results: [place, { ...place, latitude: 40 }] }),
		/ambiguous/,
	);
	const p = domain.planWeather({}, forecast(), place, [], now);
	assert.equal(p.window.start, '08:00');
	assert.equal(p.window.end, '11:00');
	const rainy = forecast();
	rainy.hourly.precipitation_probability.fill(100);
	assert.equal(domain.planWeather({}, rainy, place, [], now).attention, true);
	const broken = forecast();
	broken.current.temperature_2m = null;
	assert.throws(() => domain.planWeather({}, broken, place, [], now), /finite/);
	const stale = forecast();
	stale.current.time = '2026-10-03T08:00';
	assert.throws(() => domain.planWeather({}, stale, place, [], now), /stale/);
});
test('Sports accepts final scores only, deduplicates IDs and derives club form from verified matches', () => {
	const cfg = { leagueId: '4328' },
		r = {
			statusCode: 200,
			body: {
				events: [
					event('1'),
					event('1'),
					event('live', { strStatus: '1H' }),
					event('old', { dateEvent: '2024-01-01' }),
					event('wrong', { idLeague: '7' }),
				],
			},
		};
	const p = domain.planSports(cfg, r, [], now);
	assert.equal(p.matches.length, 1);
	assert.equal(p.skipped.length, 3);
	assert.equal(domain.planSports({ ...cfg, focusTeam: 'Home 1' }, r, [], now).club.wins, 1);
	assert.throws(
		() =>
			domain.planSports(
				cfg,
				{ statusCode: 200, body: { events: [event('1'), event('1', { intHomeScore: '4' })] } },
				[],
				now,
			),
		/Conflicting/,
	);
	assert.equal(
		domain.planSports(cfg, { statusCode: 200, body: { events: null } }, [], now).ready,
		false,
	);
});
test('Celebrations honor consent, separate occasions, age opt-in and leap-day policy', () => {
	assert.equal(domain.planCelebration({}, [celebration()], [], now).years, null);
	assert.equal(domain.planCelebration({}, [celebration({ ShowAge: true })], [], now).years, 36);
	assert.equal(
		domain.planCelebration({}, [celebration({ DoNotContact: true })], [], now).ready,
		false,
	);
	assert.equal(
		domain.planCelebration({}, [celebration({ GreetingConsent: false })], [], now).ready,
		false,
	);
	assert.equal(
		domain.planCelebration({}, [celebration({ Type: 'anniversary', Date: '2020-10-04' })], [], now)
			.years,
		6,
	);
	const leap = celebration({ Date: '2000-02-29' }),
		feb = new Date('2025-02-28T10:00Z');
	assert.equal(domain.planCelebration({ leapDayPolicy: 'feb28' }, [leap], [], feb).ready, true);
	assert.equal(domain.planCelebration({ leapDayPolicy: 'march1' }, [leap], [], feb).ready, false);
});
for (const kind of Object.keys(specs))
	test(
		kind + ' actual exported graph: result, CSV, dedupe, resume, preview, caps and failure',
		() => {
			const r = runGraph(kind);
			assert.equal(r.submissions.length, 1);
			assert.match(
				r.submissions[0].name,
				/^[a-zA-Z0-9_\- ]+$/,
				'Project name matches the published render schema',
			);
			assert.equal(r.updates.length, 3);
			assert.equal(r.ledger[0].Status, 'completed');
			assert.ok(r.history.get('Download the source-specific review pack')[0].binary.data.data);
			assert.equal(runGraph(kind, inputs[kind], r.ledger).submissions.length, 0);
			const saved = { ...r.ledger[0], Status: 'rendering', VideoUrl: '', JobId: 'saved-42' };
			const resume = runGraph(kind, inputs[kind], [saved]);
			assert.equal(resume.submissions.length, 0);
			assert.equal(resume.ledger[0].JobId, 'saved-42');
			const preview = runGraph(kind, inputs[kind], [], { dryRun: true });
			assert.equal(preview.updates.length, 0);
			assert.equal(preview.submissions.length, 0);
			assert.throws(() => runGraph(kind, inputs[kind], [], {}, { quote: 999 }), /No paid render/);
			const failed = runGraph(
				kind,
				inputs[kind],
				[],
				{},
				{ error: 'Render failed: unavailable asset', captureFailure: true },
			);
			assert.equal(failed.ledger[0].Status, 'failed');
			assert.match(failed.error.message, /Video is not ready.*unavailable asset/);
			assert.equal(failed.history.has('▶ Watch video'), false);
			assert.match(JSON.parse(failed.ledger[0].PlanJson).renderOutcome.reason, /unavailable asset/);
			assert.equal(runGraph(kind, inputs[kind], failed.ledger).submissions.length, 0);
			const timeout = runGraph(
				kind,
				inputs[kind],
				[],
				{},
				{ error: 'Render did not finish within 1200 seconds', captureFailure: true },
			);
			assert.equal(timeout.ledger[0].Status, 'timed_out');
			assert.equal(
				runGraph(kind, inputs[kind], [{ ...saved, Status: 'submitting', JobId: '' }]).submissions
					.length,
				0,
			);
			const w = require('../workflows/zvid-' + kind + '.json');
			assert.deepEqual(
				organizeWorkflow(buildLateSeries(w, kind)).workflow,
				w,
				'Generator repeatability',
			);
		},
	);
test('Capacity rejections wait and retry without duplicating accepted jobs or locking the render key', () => {
	const kind = 'kpi-report-video';
	const serialized429 = {
		name: 'NodeApiError',
		message: 'The service is receiving too many requests from you',
		context: { data: { retryAfter: 45 } },
	};
	const result = runGraph(
		kind,
		inputs[kind],
		[],
		{},
		{ rejections: [serialized429, { httpCode: '429' }] },
	);
	assert.equal(result.submissionAttempts, 3);
	assert.equal(result.submissions.length, 1);
	assert.equal(result.elapsed, 75000);
	assert.equal(result.ledger[0].Status, 'completed');
	assert.equal(result.history.has('▶ Watch video'), true);
	assert.equal(result.updates.filter((r) => r.Status === 'rate_limited').length, 2);
	const exhausted = runGraph(
		kind,
		inputs[kind],
		[],
		{},
		{ rejections: [serialized429, serialized429, serialized429], captureFailure: true },
	);
	assert.equal(exhausted.submissionAttempts, 3);
	assert.equal(exhausted.submissions.length, 0);
	assert.equal(exhausted.ledger[0].Status, 'rate_limited');
	assert.match(exhausted.error.message, /Retry this workflow later/);
	assert.equal(runGraph(kind, inputs[kind], exhausted.ledger).submissions.length, 1);
	const uncertain = runGraph(
		kind,
		inputs[kind],
		[],
		{},
		{ rejections: [{ httpCode: '504', message: 'Gateway timeout' }], captureFailure: true },
	);
	assert.equal(uncertain.submissionAttempts, 1);
	assert.equal(uncertain.ledger[0].Status, 'needs_review');
	assert.match(uncertain.error.message, /uncertain/);
	assert.equal(runGraph(kind, inputs[kind], uncertain.ledger).submissions.length, 0);
	const c = { submitStartedAt: now.getTime(), submitAttempts: 1, checkpoint: {} };
	assert.equal(
		domain.classifySubmissionError(c, { message: serialized429.message }, now.getTime(), {}).retry,
		false,
		'A loose error string is not sufficient proof of rejection',
	);
	assert.equal(
		domain.classifySubmissionError(
			c,
			{ httpCode: 429, response: { headers: { 'retry-after': '1200' } } },
			now.getTime(),
			{ timeoutMinutes: 20 },
		).retry,
		false,
	);
});

test('Sports editorial design contains approved facts and no unrelated stock or LLM', () => {
	const result = runGraph('sports-recap-video');
	assert.ok(result.submissions[0].scenes.every((s) => s.visuals.every((v) => v.type === 'TEXT')));
	assert.match(JSON.stringify(result.submissions[0]), /APPROVED MATCH REPORT/);
	assert.match(JSON.stringify(result.submissions[0]), /Home 1/);
});

test('Outdoor scheduling honors confirmed reservations, priority and preferred times', () => {
	const rows = [
		booking(),
		booking({ BookingId: 'priority', Priority: 10 }),
		booking({
			BookingId: 'locked',
			Status: 'confirmed',
			Start: '2026-10-04T09:00Z',
			End: '2026-10-04T10:00Z',
		}),
	];
	const r = runGraph('daily-weather-video', undefined, [], {}, { queue: rows });
	const p = r.history.get(specs['daily-weather-video'].plan)[0].json;
	assert.equal(p.decisions[0].BookingId, 'priority');
	assert.equal(p.decisions[0].Decision, 'reschedule');
	assert.equal(p.decisions[0].Start, '2026-10-04T08:00:00.000Z');
	assert.equal(p.decisions[1].Start, '2026-10-04T10:00:00.000Z');
	assert.equal(r.reviewUpdates.length, 0, 'Booking requests must not be mutated');
	const ics = Buffer.from(
		r.history.get('Download tentative booking calendar proposals')[0].binary.data.data,
		'base64',
	).toString();
	assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
	assert.match(ics, /STATUS:TENTATIVE/);
	assert.match(ics, /TRANSP:TRANSPARENT/);
	assert.doesNotMatch(ics, /ATTENDEE|ORGANIZER|METHOD:REQUEST/);
});
test('Outdoor scheduling defers blocked weather and rejects gaps, nulls and timezone ambiguity', () => {
	const blocked = structuredClone(inputs['daily-weather-video']);
	blocked.hourly.precipitation_probability.fill(90);
	const r = runGraph('daily-weather-video', blocked);
	assert.equal(
		r.history.get(specs['daily-weather-video'].plan)[0].json.decisions[0].Decision,
		'defer',
	);
	assert.match(JSON.stringify(r.submissions[0]), /DEFER/);
	const broken = structuredClone(inputs['daily-weather-video']);
	broken.hourly.time[2] += 3600;
	assert.throws(() => runGraph('daily-weather-video', broken), /non-contiguous/);
	broken.hourly.time[2] -= 3600;
	broken.hourly.temperature_2m[0] = null;
	assert.throws(() => runGraph('daily-weather-video', broken), /temperature must/);
	assert.throws(
		() =>
			revision.prepareBookings(
				{ timezone: 'UTC' },
				[booking({ EarliestStart: '2026-10-04T08:00' })],
				now,
			),
		/UTC offset/,
	);
	assert.throws(
		() => runGraph('daily-weather-video', undefined, [], { timezone: 'Europe/Lisbon' }),
		/timezone must match/,
	);
	assert.equal(
		runGraph('daily-weather-video', undefined, [], {}, { queue: [booking({ Approval: 'draft' })] })
			.submissions.length,
		0,
	);
});
test('Calendar proposals escape user text and preserve UTC offsets and Unicode line folding', () => {
	const p = {
		renderKey: 'x',
		generatedAt: now.toISOString(),
		note: 'Test',
		decisions: [
			{
				BookingId: 'a',
				Title: 'é'.repeat(80) + '\nATTENDEE:evil@example.com',
				Start: '2026-10-04T09:00:00+02:00',
				End: '2026-10-04T10:00:00+02:00',
				Reason: 'review',
			},
		],
	};
	const ics = Buffer.from(revision.calendarProposal(p).data, 'base64').toString();
	assert.match(ics, /DTSTART:20261004T070000Z/);
	assert.doesNotMatch(ics, /\r\nATTENDEE:/);
	assert.ok(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75));
});
test('Sports unapproved facts stop before quotes, preserve approval columns and expose a review pack', () => {
	const q = [{ EventId: '1', Enabled: 'yes', Approval: 'rejected', ApprovedSnapshot: 'old' }];
	const r = runGraph('sports-recap-video', undefined, [], {}, { queue: q });
	assert.equal(r.submissions.length, 0);
	assert.equal(r.history.has('Validate the video and request its credit quote'), false);
	assert.equal(r.queueRows[0].Approval, 'rejected');
	assert.equal(r.queueRows[0].ApprovedSnapshot, 'old');
	assert.equal(r.queueRows[0].ReviewStatus, 'awaiting_approval');
	assert.ok(r.history.get('Download the source-specific review pack')[0].binary.data.data);
	const preview = runGraph('sports-recap-video', undefined, [], { dryRun: true }, { queue: q });
	assert.equal(preview.reviewUpdates.length, 0);
});
test('Sports corrections require exact new-edition approval and preserve previous result evidence', () => {
	const first = runGraph('sports-recap-video');
	const changed = structuredClone(inputs['sports-recap-video']);
	changed.body.events[0].intHomeScore = '3';
	const pending = runGraph('sports-recap-video', changed, first.ledger);
	assert.equal(pending.submissions.length, 0);
	assert.equal(pending.queueRows[0].ReviewStatus, 'correction_review');
	const q = { ...approvedEvent(), ApprovedSnapshot: pending.queueRows[0].CurrentSnapshot };
	const rendered = runGraph('sports-recap-video', changed, first.ledger, {}, { queue: [q] });
	assert.equal(rendered.submissions.length, 1);
	assert.equal(rendered.ledger.length, 2);
	assert.match(JSON.stringify(rendered.submissions[0]), /CORRECTED MATCH REPORT/);
	const p = rendered.history.get(specs['sports-recap-video'].plan)[0].json;
	assert.equal(p.edition, 2);
	assert.equal(p.prior.homeScore, 2);
	assert.equal(p.fact.homeScore, 3);
	assert.ok(p.previousVideoUrl);
	const rollback = runGraph('sports-recap-video', undefined, rendered.ledger);
	assert.equal(rollback.submissions.length, 0);
	assert.equal(rollback.queueRows[0].ReviewStatus, 'correction_review');
	assert.equal(JSON.parse(rollback.queueRows[0].CurrentSnapshot).edition, 3);
});
test('Sports cannot bypass uncertain history with a changed score and recovers before source access', () => {
	const first = runGraph('sports-recap-video'),
		saved = { ...first.ledger[0], Status: 'submitting', VideoUrl: '', JobId: '' };
	const changed = structuredClone(inputs['sports-recap-video']);
	changed.body.events[0].intHomeScore = '4';
	const blocked = runGraph('sports-recap-video', changed, [saved]);
	assert.equal(blocked.submissions.length, 0);
	assert.equal(blocked.queueRows[0].ReviewStatus, 'needs_review');
	for (const kind of ['daily-weather-video', 'sports-recap-video']) {
		const done = runGraph(kind),
			log = { ...done.ledger[0], Status: 'rendering', JobId: 'accepted', VideoUrl: '' };
		const resumed = runGraph(kind, { error: 'source is down' }, [log], {}, { queue: [] });
		assert.equal(resumed.submissions.length, 0);
		assert.equal(resumed.history.has(specs[kind].source), false);
		assert.ok(resumed.history.has('▶ Watch video'));
	}
});

test('CSV exports escape formula cells', () => {
	assert.match(
		Buffer.from(domain.csvFile([{ Text: '=SUM(A1)' }], 'x.csv').data, 'base64').toString(),
		/"'=SUM/,
	);
});
test('Optional music is retained when usable and omitted after failed or oversized probes', () => {
	for (const kind of Object.keys(specs)) {
		const cfg = { musicUrl: 'https://example.com/music.mp3' },
			ok = runGraph(kind, inputs[kind], [], cfg),
			failed = runGraph(kind, inputs[kind], [], cfg, { musicStatus: 404 }),
			large = runGraph(kind, inputs[kind], [], cfg, { musicBytes: 6000000 });
		assert.ok(ok.submissions[0].audios?.length, kind + ' music missing');
		assert.equal(failed.submissions[0].audios?.length || 0, 0);
		assert.equal(large.submissions[0].audios?.length || 0, 0);
	}
});
test('Optional KPI narration uses checked numbers and retains voice/caption alignment', () => {
	const r = runGraph('kpi-report-video', inputs['kpi-report-video'], [], { narrate: true });
	assert.equal(r.submissions.length, 1);
	assert.ok(r.submissions[0].audios?.some((a) => a.src === 'https://cdn.example/voice.mp3'));
	const script = r.history.get('Write factual KPI narration from the checked values')[0].json;
	assert.match(script.narration, /80/);
	assert.match(script.narration, /-20%/);
	assert.equal(script.perMetric.length, 2);
	assert.equal(r.history.has('Write narration'), false, 'No LLM writer is called');
});
test('Optional delivery remains disabled by default and requires greeting email approval', () => {
	for (const kind of ['kpi-report-video', 'birthday-greetings']) {
		const w = require('../workflows/zvid-' + kind + '.json'),
			cfg = JSON.parse(w.nodes.find((n) => n.name === specs[kind].config).parameters.jsonOutput),
			gate = w.nodes.find((n) => n.id === 'late-deliver');
		const run = (d, changes) =>
			new Function(
				'$json',
				'$',
				'return (' + gate.parameters.conditions.conditions[0].leftValue.slice(3, -2) + ')',
			)(d, () => ({ first: () => ({ json: { ...cfg, ...changes } }) }));
		const d = { status: 'completed', emailApproved: true, email: 'alex@example.com' };
		assert.equal(run(d, {}), false);
		if (kind === 'birthday-greetings') {
			assert.equal(run(d, { sendEmail: true }), true);
			assert.equal(run({ ...d, emailApproved: false }, { sendEmail: true }), false);
		} else
			assert.equal(run(d, { sendSlack: true, slackWebhookUrl: 'https://example.com/hook' }), true);
		assert.equal(
			run(
				{ ...d, status: 'failed' },
				{ sendEmail: true, sendSlack: true, slackWebhookUrl: 'https://example.com/hook' },
			),
			false,
		);
		const classify = w.nodes.find((n) => n.id === 'late-delivery-result');
		const out = new Function('$json', '$', classify.parameters.jsCode)(
			{ error: 'timeout' },
			() => ({ first: () => ({ json: d }) }),
		)[0].json;
		assert.equal(out.deliveryStatus, 'needs_review');
		assert.equal(w.nodes.find((n) => n.id === 'late-send').retryOnFail, false);
	}
});
test('Day 30 is a distinct conversational flow with allow-list, isolated memory, errors and guarded media', () => {
	const w = require('../workflows/zvid-chat-video-agent.json'),
		cfg = JSON.parse(w.nodes.find((n) => n.name === 'Config').parameters.jsonOutput),
		node = (name) => w.nodes.find((n) => n.name === name);
	const prepare = (input) =>
		new Function('$input', node('Prepare chat input').parameters.jsCode)({
			first: () => ({ json: input }),
		})[0].json;
	const screen = (chat, changes = {}) =>
		new Function('$', node('Screen request').parameters.jsCode)((name) => ({
			first: () => ({ json: name === 'Config' ? { ...cfg, ...changes } : chat }),
		}))[0].json;
	const blocked = screen(prepare({ message: { chat: { id: 7 }, text: 'Render now' } }));
	assert.equal(blocked.ok, false);
	const a = screen(prepare({ message: { chat: { id: 7 }, text: 'Make a teaser' } }), {
		allowedChatIds: [7],
	});
	const b = screen(prepare({ message: { chat: { id: 8 }, text: 'Another video' } }), {
		allowedChatIds: [8],
	});
	assert.equal(a.ok, true);
	assert.notEqual(a.sessionId, b.sessionId);
	assert.equal(a.sameMessageApproval, false);
	assert.equal(screen(prepare({ text: 'Local test' })).ok, true);
	assert.equal(
		screen(prepare({ message: { chat: { id: 7 }, sticker: {} } }), { allowedChatIds: [7] }).ok,
		false,
	);
	const reply = (input) =>
		new Function('$input', '$', node('Chat reply').parameters.jsCode)(
			{ first: () => ({ json: input }) },
			(name) => ({ first: () => ({ json: name === 'Config' ? cfg : a }) }),
		)[0].json;
	assert.equal(reply({ error: 'provider failure' }).status, 'error');
	for (const url of [
		'https://evil.example/video.mp4',
		'https://cdn.zvid.io.evil.example/videos/x/y.mp4',
		'https://cdn.zvid.io/library/examples/previews/demo.mp4',
	])
		assert.equal(reply({ output: url }).hasVideo, false);
	const url = 'https://cdn.zvid.io/videos/test/result.mp4';
	assert.equal(reply({ output: url }).hasVideo, false, 'Assistant text alone is not completion evidence');
	const step = (state, value = url) => ({ action: { tool: 'get_media' }, observation: JSON.stringify({ kind: 'render', render: { id: 'job-1', state, result: { url: value } } }) });
	const result = reply({ output: '<& '.repeat(3000), intermediateSteps: [step('completed')] });
	assert.equal(result.videoUrl, url);
	assert.equal(result.mediaStatus, 'completed');
	assert.match(result.watchReason, /ready to watch/);
	assert.equal(reply({ output: 'Done', intermediateSteps: [step('completed'), step('active')] }).hasVideo, false);
	assert.equal(reply({ output: 'Still running', intermediateSteps: [step('active')] }).mediaStatus, 'active');
	assert.equal(reply({ output: 'Failed', intermediateSteps: [step('failed')] }).hasVideo, false);
	assert.equal(reply({ output: 'Preview', intermediateSteps: [{ action: { tool: 'start_from_example' }, observation: step('completed').observation }] }).hasVideo, false);
	for (const bad of ['https://evil.example/out.mp4', 'https://cdn.zvid.io/library/examples/previews/demo.mp4'])
		assert.equal(reply({ output: 'Done', intermediateSteps: [step('completed', bad)] }).hasVideo, false);
	const wrapped = { action: { tool: 'get_media' }, observation: [{ type: 'text', text: step('completed').observation }] };
	assert.equal(reply({ output: 'Ready', intermediateSteps: [wrapped] }).videoUrl, url);
	const native = { action: { tool: 'Zvid_MCP_tools_get_media' }, observation: JSON.stringify([{ response: [{ type: 'text', text: JSON.stringify({ kind: 'render', render: { id: 'job-1', state: 'completed', result: url } }) }] }]) };
	assert.equal(reply({ output: 'Ready', intermediateSteps: [native] }).videoUrl, url, 'Native n8n MCP namespaced tool and nested response envelope');
	assert.equal(reply({ output: 'Template limit reached', intermediateSteps: [{ action: { tool: 'Zvid_MCP_tools_create_media_from_example' }, observation: JSON.stringify([{ error: 'Template limit reached' }]) }] }).mediaStatus, 'tool_error');
	const limited = reply({ output: 'Would you prefer another example?', intermediateSteps: [{ action: { tool: 'Zvid_MCP_tools_create_media_from_example' }, observation: JSON.stringify([{ error: JSON.stringify({status:403,error:'Template limit reached'}) }]) }] });
	assert.equal(limited.status, 'blocked');
	assert.match(limited.replyPlain, /preferDirectDraft=true/);
	assert.equal(limited.hasVideo, false);
	const incomplete = reply({ output: 'Quote, please approve', intermediateSteps: [{ action: { tool: 'create_media_from_example' }, observation: { kind: 'draft', draftId: 'prj_example' } }] });
	assert.equal(incomplete.mediaStatus, 'incomplete_draft');
	assert.match(incomplete.replyPlain, /No render approval/);
	assert.match(reply({ output: 'Found a template. Shall I adapt it?' }).watchReason, /No completed render/);
	assert.ok(result.replyText.length <= 4096);
	assert.match(result.replyText, /&lt;/);
	assert.equal(node('Zvid AI Agent').retryOnFail, undefined);
	assert.match(JSON.stringify(node('Zvid MCP tools').parameters), /maxRenderCredits/);
	assert.equal(node('Zvid AI Agent').parameters.options.returnIntermediateSteps, true);
	assert.equal(node('▶ Watch video').typeVersion, 2);
});
test('Celebration migration identifies missing and duplicated keys and preserves annual protections', () => {
	assert.throws(() => domain.planCelebration({}, [celebration({ CelebrationKey: '', row_number: 7 })], [], now), /Missing CelebrationKey at sheet row 7/);
	assert.throws(() => domain.planCelebration({}, [celebration({ row_number: 2 }), celebration({ row_number: 6 })], [], now), /sheet rows 2 and 6/);
	const old = celebration({ LastSentYear: 2026 });
	assert.equal(domain.planCelebration({}, [old], [], now).skipped[0].reason, 'legacy_already_sent');
	assert.equal(domain.planCelebration({}, [celebration({ Approval: '', GreetingConsent: '' })], [], now).ready, false);
	const future = domain.planCelebration({}, [celebration({ Date: '1990-11-01' })], [], now);
	assert.equal(future.skipped[0].reason, 'not_due_today');
	assert.equal(future.skipped[0].dueDate, '2026-11-01');
});

test('Celebration history is read once for multiple source rows and playback never rewrites it', () => {
	const rows = Array.from({ length: 4 }, (_, i) => celebration({ CelebrationKey: 'person-' + i, LastSentYear: i ? 2026 : '' }));
	const first = runGraph('birthday-greetings', rows);
	const log = first.ledger, key = log[0].RenderKey;
	const repeated = runGraph('birthday-greetings', rows, log, {}, { repeatReadPerItem: true });
	assert.equal(repeated.submissions.length, 0);
	assert.equal(repeated.updates.length, 0);
	assert.throws(() => runGraph('birthday-greetings', rows, [...log, ...log]), /Duplicate RenderKey/, 'Real duplicate rows still stop the queue');
	const replay = runGraph('birthday-greetings', rows, log, { replayRenderKey: key, sendEmail: true }, { repeatReadPerItem: true });
	assert.equal(replay.submissionAttempts, 0);
	assert.equal(replay.updates.length, 0);
	assert.deepEqual(replay.ledger, log);
	assert.ok(replay.history.has('▶ Watch video'));
	assert.equal(replay.history.has('Send the approved private greeting email'), false);
	assert.equal(replay.history.get('Prepare the completed result and review pack')[0].json.replayed, true);
	assert.equal(domain.planCelebration({ replayRenderKey: key }, [], log, new Date('2027-01-01')).ready, true);
	for (const changes of [{ replayRenderKey: 'missing' }, { replayRenderKey: key, dryRun: true }]) {
		const r = runGraph('birthday-greetings', rows, log, changes);
		assert.equal(r.submissionAttempts, 0); assert.equal(r.updates.length, 0);
		assert.equal(r.history.has('▶ Watch video'), false);
	}
});

test('Chat saved playback uses native completed state, protects Telegram and bypasses the agent', () => {
	const w = require('../workflows/zvid-chat-video-agent.json'), node = name => w.nodes.find(n => n.name === name);
	const cfg = { ...JSON.parse(node('Config').parameters.jsonOutput), manualPreviewJobId: 'saved-job' };
	const gate = new Function('$json', '$', 'return (' + node('Preview a saved render?').parameters.conditions.conditions[0].leftValue.slice(3, -2) + ')');
	assert.equal(gate({ isTelegram: false }, () => ({ first: () => ({ json: cfg }) })), true);
	assert.equal(gate({ isTelegram: true }, () => ({ first: () => ({ json: cfg }) })), false);
	assert.equal(gate({ isTelegram: false }, () => ({ first: () => ({ json: { ...cfg, manualPreviewJobId: '' } }) })), false);
	const req = { ok: true, isTelegram: false, input: 'Replay only' }, url = 'https://cdn.zvid.io/videos/test/result.mp4';
	const reply = raw => {
		const input = new Function('$json', node('Explain the saved render preview').parameters.jsCode)(raw)[0];
		return new Function('$input', '$', node('Chat reply').parameters.jsCode)({ first: () => input }, name => ({ first: () => ({ json: name === 'Config' ? cfg : req }) }))[0].json;
	};
	assert.equal(reply({ id: 'saved-job', state: 'completed', result: url }).videoUrl, url);
	for (const raw of [{ state: 'active', result: url }, { error: 'Not found' }, { state: 'completed', result: 'https://evil.example/test.mp4' }]) assert.equal(reply(raw).hasVideo, false);
	const route = w.connections['Preview a saved render?'].main[0][0].node;
	assert.equal(route, 'Read saved render for preview');
	assert.equal(node(route).type, '@zvid/n8n-nodes-zvid.zvid');
	assert.equal(node(route).parameters.operation, 'get');
});

test('Manual greeting demo creates fresh paid work and never uses real contact consent or email', () => {
	const existing = runGraph('birthday-greetings');
	const a = runGraph('birthday-greetings', inputs['birthday-greetings'], existing.ledger, { manualDemo: true, sendEmail: true }, { executionId: 'demo-one' });
	const b = runGraph('birthday-greetings', inputs['birthday-greetings'], a.ledger, { manualDemo: true, sendEmail: true }, { executionId: 'demo-two' });
	assert.equal(a.submissions.length, 1); assert.equal(b.submissions.length, 1);
	assert.equal(a.history.has('Send the approved private greeting email'), false);
	assert.equal(b.history.has('Send the approved private greeting email'), false);
	assert.equal(a.history.get(specs['birthday-greetings'].plan)[0].json.name, 'DEMO Ava');
	assert.notEqual(a.ledger.at(-1).RenderKey, b.ledger.at(-1).RenderKey);
	assert.deepEqual(b.ledger[0], existing.ledger[0]);
	assert.equal(domain.planCelebration({ manualDemo: true }, [], [], now, { id: 'automatic', mode: 'trigger' }).ready, false);
});

test('Chat waits on its accepted job and recognizes a direct draft after an example quota error', () => {
	const w = require('../workflows/zvid-chat-video-agent.json'), node = name => w.nodes.find(n => n.name === name);
	const cfg = JSON.parse(node('Config').parameters.jsonOutput), req = { ok: true, isTelegram: false };
	const accepted = { output: 'Submitted', intermediateSteps: [{ action: { tool: 'Zvid_MCP_tools_render_media' }, observation: JSON.stringify({ kind: 'render', jobId: 'actual-new-job', render: { jobId: 'actual-new-job' } }) }] };
	const handoff = new Function('$input', '$', node('Read the agent render handoff').parameters.jsCode)({ first: () => ({ json: accepted }) }, () => ({ first: () => ({ json: cfg }) }))[0].json;
	assert.equal(handoff.agentRender.jobId, 'actual-new-job');
	const gate = new Function('$json', 'return (' + node('Wait for an accepted video render?').parameters.conditions.conditions[0].leftValue.slice(3, -2) + ')');
	assert.equal(gate(handoff), true); assert.equal(gate({ agentRender: { mediaStatus: 'awaiting_approval' } }), false);
	assert.equal(node('Wait for the newly accepted chat video').parameters.operation, 'get');
	const raw = { id: 'actual-new-job', state: 'completed', result: 'https://cdn.zvid.io/videos/test/focusflow.mp4' };
	const attached = new Function('$json', '$', node('Attach the actual chat video result').parameters.jsCode)(raw, () => ({ first: () => ({ json: handoff }) }))[0];
	const reply = input => new Function('$input', '$', node('Chat reply').parameters.jsCode)({ first: () => input }, name => ({ first: () => ({ json: name === 'Config' ? cfg : req }) }))[0].json;
	assert.equal(reply(attached).videoUrl, raw.result);
	const direct = reply({ json: { output: 'New draft ready', intermediateSteps: [ { action: { tool: 'create_media_from_example' }, observation: { error: 'Template limit reached' } }, { action: { tool: 'create_media' }, observation: { kind: 'draft', draftId: 'prj_direct', editorUrl: 'https://editor.zvid.io/?project=prj_direct', estimatedCredits: 12, quoteToken: 'test-only-signed-quote' } } ] } });
	assert.equal(direct.mediaStatus, 'awaiting_approval'); assert.equal(direct.status, 'answered');
	assert.match(direct.replyPlain, /12 Zvid credits/);
	assert.equal(direct.draftId, 'prj_direct');
	assert.equal(JSON.stringify(direct).includes('test-only-signed-quote'), false);
});

module.exports = {
	inputs,
	configs,
	now,
	place,
	forecast,
	questions,
	metricResponse,
	event,
	celebration,
	runGraph,
};
