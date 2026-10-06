'use strict';
const { test } = require('node:test'),
	assert = require('node:assert/strict');
const domain = require('../scripts/late-series-runtime'),
	{ specs, buildLateSeries } = require('../scripts/build-late-series');
const { organizeWorkflow } = require('../scripts/organize-workflow-series');
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
	'daily-weather-video': forecast(),
	'sports-recap-video': {
		statusCode: 200,
		body: { events: [event('1'), event('2', { intHomeScore: '1', intAwayScore: '1' })] },
	},
	'birthday-greetings': [celebration()],
};
const configs = {
	'kpi-report-video': { metricsUrl: 'https://example.com/metrics' },
	'daily-weather-video': { countryCode: 'PT', admin1: 'Lisbon District' },
};

function runGraph(kind, input = inputs[kind], logs = [], overrides = {}, response = {}) {
	const original = require('../workflows/zvid-' + kind + '.json'),
		w = structuredClone(original),
		history = new Map(),
		ledger = structuredClone(logs),
		submissions = [],
		updates = [];
	const cfg = w.nodes.find((n) => n.name === specs[kind].config);
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
				new Function('$json', '$input', '$', 'Date', 'Buffer', n.parameters.jsCode)(
					d,
					{ first: () => items[0], all: () => items },
					access,
					FixedDate,
					Buffer,
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
				const rows = n.id === 'late-ledger' ? ledger : input;
				outputs = [rows.length ? rows.map((json) => ({ json })) : [{ json: {} }]];
			} else {
				const fields = Object.fromEntries(
					Object.entries(n.parameters.columns.value).map(([k, v]) => [k, value(v, d)]),
				);
				let row = ledger.find((r) => r.RenderKey === fields.RenderKey);
				if (!row && n.parameters.operation === 'appendOrUpdate') {
					row = {};
					ledger.push(row);
				}
				assert.ok(row, 'Missing ledger row');
				Object.assign(row, fields);
				updates.push(fields);
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
	return { ledger, submissions, updates, history, error, submissionAttempts, elapsed };
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

test('Sports uses the bounded bundled clip and preserves custom cover choices', () => {
	const kind = 'sports-recap-video';
	const safe = 'https://videos.pexels.com/video-files/34930800/14796392_1080_1920_30fps.mp4';
	const old = 'https://videos.pexels.com/video-files/34930800/14796393_1440_2560_30fps.mp4';
	for (const coverVideoOverride of ['', old, 'https://example.test/custom.mp4']) {
		const result = runGraph(kind, inputs[kind], [], { coverVideoOverride });
		assert.equal(
			result.submissions[0].scenes[0].visuals[0].src,
			coverVideoOverride && coverVideoOverride !== old ? coverVideoOverride : safe,
		);
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
	const result = reply({ output: '<& '.repeat(3000) + url });
	assert.equal(result.videoUrl, url);
	assert.ok(result.replyText.length <= 4096);
	assert.match(result.replyText, /&lt;/);
	assert.equal(node('Zvid AI Agent').retryOnFail, undefined);
	assert.match(JSON.stringify(node('Zvid MCP tools').parameters), /maxRenderCredits/);
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
