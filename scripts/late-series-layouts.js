'use strict';
const { specs } = require('./build-late-series');
function lateLayout(w, kind) {
	if (!w.meta?.lateSeriesReview || !specs[kind]) return null;
	const s = specs[kind],
		groups = [];
	let x = 0;
	const node = (id) => w.nodes.find((n) => n.id === id),
		name = (id) => node(id)?.name;
	const add = (key, title, body, locations, width, height = 1160) => {
		groups.push([
			key,
			groups.length + 1 + '. ' + title,
			body,
			[x, 0, width, height],
			locations.map(([n, dx, y]) => [n, x + 60 + dx, y]),
		]);
		x += width + 100;
	};
	const trigger = w.nodes.find((n) => n.type === 'n8n-nodes-base.scheduleTrigger'),
		manual = w.nodes.find((n) => n.type === 'n8n-nodes-base.manualTrigger');
	add(
		'configure',
		'Choose source rules and schedule',
		'Complete the overview setup and source contract. Run one execution at a time. Use the manual trigger before enabling the schedule.',
		[
			[trigger.name, 0, 260],
			[manual.name, 0, 660],
			[s.config, 280, 500],
		],
		660,
	);
	const sources =
		kind === 'daily-weather-video'
			? [
					['Find the configured city candidates', 0, 500],
					['Require one matching city and region', 280, 500],
					[s.source, 560, 500],
				]
			: kind === 'kpi-report-video'
				? [
						[name('late-metrics-mode'), 0, 500],
						[name('late-sample-metrics'), 280, 260],
						[name('late-require-metrics'), 280, 700],
						[s.source, 560, 700],
						[name('late-metrics-input'), 840, 500],
					]
				: [[s.source, 0, 500]];
	const start = kind === 'kpi-report-video' ? 1120 : sources.length * 280;
	add(
		'source',
		kind === 'kpi-report-video'
			? 'Choose live or labeled sample metrics'
			: 'Check the real source and plan the output',
		kind === 'quiz-shorts'
			? 'Require approved questions with sources. Balance difficulty, rotate topics, and exclude previously used keys or question text.'
			: kind === 'kpi-report-video'
				? 'Live mode requires metricsUrl and a fresh completed-period snapshot. Explicit sample mode bypasses HTTP, labels its video and CSV, and blocks Slack delivery. Derive changes from current and previous values; rank target misses and adverse movements.'
				: kind === 'daily-weather-video'
					? 'Require one city and fresh forecast data. Evaluate future daytime hours and rank contiguous three-hour windows by rain probability and wind.'
					: kind === 'sports-recap-video'
						? 'Filter league, club, dates and verified final statuses. Optional latest-available mode can use older returned finals within maxFallbackAgeDays; the video shows their actual period. Explicit date ranges stay strict.'
						: 'Require approval and greeting consent. Respect DoNotContact, an explicit leap-day rule, and birthday age opt-in. Process one due celebration per run.',
		[
			...sources,
			[name('late-ledger'), start, 500],
			[s.plan, start + 280, 500],
			[name('late-ready'), start + 560, 500],
			[name('late-no-work'), start + 560, 850],
		],
		start + 940,
	);
	add(
		'routing',
		'Recover accepted work before a new render',
		'Saved jobs follow the upper route using their original review context. New work continues through optional media and the domain design.',
		[
			[name('late-resume'), 0, 500],
			[name('late-resume-context'), 280, 220],
		],
		660,
	);
	add(
		'music',
		'Check optional background music',
		'A failed or oversized music file is skipped. Empty musicUrl continues without an external request. This check preserves the selected source plan.',
		[
			[name('late-music'), 0, 500],
			[name('late-music-probe'), 280, 500],
			[name('late-music-restore'), 560, 500],
			[name('late-design-context'), 840, 500],
		],
		1220,
	);
	if (kind === 'kpi-report-video')
		add(
			'narration',
			'Optionally narrate the checked KPI facts',
			'narrate is off by default. ElevenLabs voice generation can charge even in previews. Configure its Header Auth credential. Multipart upload uses HTTP because the published Zvid node lacks uploads.',
			[
				[name('late-narrate'), 0, 500],
				[name('late-narration'), 280, 500],
				['Generate voiceover', 560, 500],
				['Voice + timings', 840, 500],
				['Upload voiceover', 1120, 500],
				[name('late-narration-context'), 1400, 500],
			],
			1780,
		);
	let branches = [];
	if (kind === 'daily-weather-video')
		branches = [
			[name('late-window'), 0, 500],
			[name('late-window-found'), 280, 380],
			[name('late-window-none'), 280, 780],
			['Map forecast conditions into the video design', 560, 500],
		];
	if (kind === 'birthday-greetings')
		branches = [
			[name('late-occasion'), 0, 500],
			[name('late-anniversary'), 280, 380],
			[name('late-birthday'), 280, 780],
		];
	if (branches.length) {
		const buildX = kind === 'daily-weather-video' ? 840 : 560;
		add(
			'design',
			kind === 'daily-weather-video'
				? 'Compose the forecast and planning advice'
				: 'Compose the approved celebration',
			kind === 'daily-weather-video'
				? 'Choose a qualifying daytime planning window or explain why none meets the thresholds. Add the checked current conditions and forecast to the video.'
				: 'Branch between birthdays and anniversaries. Use only the approved occasion facts, respect age opt-in, and add the personal message to the greeting.',
			[...branches, [s.builder, buildX, 500]],
			buildX + 380,
		);
	}
	const offset = branches.length ? 0 : 280;
	add(
		'quote',
		'Build and validate the design and credit ceiling',
		'dryRun=true returns the source plan, design JSON and quote. It performs no log writes, editor draft creation, render, or delivery.' +
			(kind === 'kpi-report-video'
				? ' Optional voice synthesis may charge before validation.'
				: ''),
		[
			...(!branches.length ? [[s.builder, 0, 500]] : []),
			[name('late-validate'), offset, 500],
			[name('late-quote'), offset + 280, 500],
			[name('late-preview'), offset + 560, 500],
			[name('late-preview-report'), offset + 560, 850],
		],
		offset + 940,
	);
	add(
		'reserve',
		'Reserve the key and preserve the accepted job',
		'Save the key and accepted job ID. Retry explicit capacity rejections up to three attempts, respecting the server delay and a 30-second minimum. Uncertain submissions require inspection. Sheets is not an atomic lock.',
		[
			[name('late-claim'), 0, 500],
			[name('late-attempt'), 280, 500],
			[name('late-submit'), 560, 500],
			[name('late-accepted'), 840, 500],
			[name('late-save-job'), 1120, 500],
			[name('late-restore-new'), 1400, 500],
			[name('late-rejection'), 560, 850],
			[name('late-save-rejection'), 840, 850],
			[name('late-rejection-context'), 1120, 850],
			[name('late-retry-capacity'), 1400, 850],
			[name('late-capacity-wait'), 280, 1200],
			[name('late-submission-stop'), 1680, 850],
		],
		2060,
		1490,
	);
	add(
		'finish',
		'Wait for the accepted render and record its result',
		'Poll the saved job within the deadline. Keep failed, timed-out and uncertain job IDs for inspection. Completed keys are skipped on later runs.',
		[
			[name('late-track'), 0, 220],
			[name('late-status'), 280, 500],
			[name('late-classify'), 560, 500],
			[name('late-finish'), 840, 500],
		],
		1220,
	);
	add(
		'watch',
		'Review the video and source-specific handoff',
		'Completed renders reach Watch video → Binary → data → View. A failed render stops with its actual reason after saving the tracking row. Download the review CSV and check source facts before sharing.' +
			(['kpi-report-video', 'birthday-greetings'].includes(kind)
				? ' Optional delivery is off by default.'
				: ''),
		[
			[name('late-report'), 0, 500],
			[name('zvid-watch-ready'), 280, 500],
			['▶ Watch video', 560, 500],
			[name('late-handoff'), 280, 850],
		],
		940,
	);
	if (node('late-deliver'))
		add(
			'delivery',
			'Deliver only when explicitly enabled',
			'Optional delivery is off by default.' +
				(kind === 'birthday-greetings'
					? ' Greeting emails also require EmailApproval=approved.'
					: ' Enable sendSlack only after configuring its webhook.') +
				' Record sending before delivery and retain the acknowledgement. Inspect uncertain sends manually; completed runs never resend automatically.',
			[
				[name('late-deliver'), 0, 500],
				[name('late-delivery-pending'), 280, 500],
				[name('late-send'), 560, 500],
				[name('late-delivery-result'), 840, 500],
				[name('late-delivery-save'), 1120, 500],
			],
			1500,
		);
	const overview = `## ${s.title}\n\n### How it works\n${s.purpose} A separate recovery log skips completed keys and resumes accepted jobs. Review the video and CSV before sharing.${kind === 'kpi-report-video' ? ' Optional Slack delivery is off by default.' : kind === 'birthday-greetings' ? ' Optional approved email delivery is off by default.' : ''}\n\n### Setup\n1. Install **\`@zvid/n8n-nodes-zvid\`** from **Settings → Community nodes** before credentials. A workspace owner/admin may need to install it.\n2. Create a **Zvid API** credential with [your key](https://app.zvid.io/api-keys) and Base URL \`https://api.zvid.io\`; select it on all Zvid nodes.\n3. Connect Google Sheets and select the **${s.log}** log tab. Create RenderKey, Status, JobId, CreditsQuoted, PlanJson, VideoUrl and CompletedAt headers; optional delivery also needs DeliveryStatus.\n4. Configure ${s.inputs}. See the [source contract and migration guide](https://github.com/Zvid-io/zvid-n8n/blob/master/workflows/${kind}.md).\n5. **dryRun=false spends credits.** true returns JSON and a quote only.${kind === 'kpi-report-video' ? ' Optional narration can charge in previews; see section 5 for voice credentials and the HTTP upload exception.' : ''} Set maxCreditsPerVideo, then test manually before enabling the schedule.\n6. Avoid overlapping executions. Inspect submitting, failed or uncertain jobs before resetting any log row.\n\n### Customization\nAdjust branding and the domain rules in **${s.config}**. Watch downloads time out after 30 seconds; the saved URL remains available.`;
	return { overview, groups };
}
module.exports = { lateLayout };
