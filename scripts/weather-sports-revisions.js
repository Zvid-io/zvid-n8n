'use strict';
const domain = require('./weather-sports-revision-runtime'),
	common = require('./late-series-runtime');
const kinds = ['daily-weather-video', 'sports-recap-video'];
const descriptions = {
	'daily-weather-video': {
		title: 'Plan outdoor bookings around weather and generate a call-sheet video',
		tab: 'Outdoor Bookings',
		purpose:
			'For small production teams coordinating outdoor sessions. Read approved booking requests and confirmed reservations, then assign non-overlapping daytime slots around rain, wind and temperature limits. Higher priorities go first; each request keeps its preferred time, moves, or is deferred. Produce a call-sheet video, decision CSV and tentative calendar file. Proposals do not book a calendar or invite attendees.',
	},
	'sports-recap-video': {
		title: 'Review match results and manage corrected sports videos with TheSportsDB',
		tab: 'Match Editorial Queue',
		purpose:
			'For sports editors managing a result from first review through corrections. Fetch a queued event directly from TheSportsDB and require approval of its exact fact snapshot. Recheck facts on each run; changed facts invalidate old approval. Compare with the latest completed video, produce an approved original or correction edition, and retain the prior result and video in a correction pack. No LLM or automatic social posting is used.',
	},
};
function reviseWeatherSports(w, kind) {
	if (!kinds.includes(kind)) return w;
	const weather = kind === 'daily-weather-video',
		s = descriptions[kind];
	const node = (id) => w.nodes.find((n) => n.id === id),
		cfg = w.nodes.find((n) => n.type === 'n8n-nodes-base.set'),
		ledger = node('late-ledger'),
		plan = node('late-plan');
	const conf = JSON.parse(cfg.parameters.jsonOutput);
	if (weather) {
		Object.assign(conf, {
			timezone: conf.timezone || 'Europe/Lisbon',
			planningDate: conf.planningDate || '',
			calendarLabel: conf.calendarLabel || 'Outdoor call sheet',
			minTemperatureC: conf.minTemperatureC ?? 8,
			maxTemperatureC: conf.maxTemperatureC ?? 32,
			maxCreditsPerVideo: Math.max(conf.maxCreditsPerVideo || 25, 35),
		});
	} else
		for (const k of [
			'llmModel',
			'maxMatches',
			'periodStart',
			'periodEnd',
			'focusTeam',
			'allowLatestAvailableResults',
			'maxFallbackAgeDays',
			'recapRevision',
			'coverVideoOverride',
		])
			delete conf[k];
	const keep = new Set([
		'dryRun',
		'musicUrl',
		'maxMusicBytes',
		'pollSeconds',
		'timeoutMinutes',
		'maxCreditsPerVideo',
		...(weather
			? [
					'cityName',
					'countryCode',
					'admin1',
					'timezone',
					'planningDate',
					'calendarLabel',
					'forecastRevision',
					'maxRainProbability',
					'maxWindKmh',
					'minTemperatureC',
					'maxTemperatureC',
				]
			: ['sportsDbKey', 'leagueId']),
	]);
	for (const key of Object.keys(conf)) if (!keep.has(key)) delete conf[key];
	cfg.parameters.jsonOutput = JSON.stringify(conf, null, 2);
	const add = (id, name, type, parameters, extra = {}) => {
		const n = {
			id: 'revision-' + id,
			name,
			type: 'n8n-nodes-base.' + type,
			typeVersion: 2,
			position: [0, 0],
			parameters,
			...extra,
		};
		w.nodes.push(n);
		return n;
	};
	const code = (id, name, jsCode) => add(id, name, 'code', { jsCode });
	const iff = (id, name, expression) => {
		const n = structuredClone(node('late-ready'));
		n.id = 'revision-' + id;
		n.name = name;
		n.parameters.conditions.conditions[0].leftValue = '={{ ' + expression + ' }}';
		w.nodes.push(n);
		return n;
	};
	const link = (from, ...branches) =>
		(w.connections[from] = {
			main: branches.map((ns) => ns.map((n) => ({ node: n, type: 'main', index: 0 }))),
		});
	const embed = (...fns) => fns.map((f) => f.toString()).join('\n') + '\n';
	const config = `$('${cfg.name}').first().json`,
		log = `$('${ledger.name}').all().map(i=>i.json)`;
	const recovery = code(
		'recover',
		'Recover accepted work before reading new sources',
		embed(common.recoverPlan, common.resumeOutstanding) +
			`return [{json:resumeOutstanding(${config},$input.all().map(i=>i.json),'${weather ? 'weather-' : 'sports-'}') || {checkNewSource:true}}];`,
	);
	const recovered = iff(
		'recovered',
		'A saved render needs recovery?',
		'$json.checkNewSource !== true',
	);
	const queue = add(
		'queue',
		weather
			? 'Read requested sessions and confirmed bookings'
			: 'Read the match editorial approval queue',
		'googleSheets',
		{
			resource: 'sheet',
			operation: 'read',
			documentId: structuredClone(ledger.parameters.documentId),
			sheetName: { __rl: true, value: s.tab, mode: 'name' },
			options: {},
		},
		{ typeVersion: 4.7, alwaysOutputData: true },
	);
	const choose = code(
		'choose',
		weather
			? 'Validate the dated booking brief'
			: 'Select the least recently checked enabled event',
		embed(domain.revisionHelpers, weather ? domain.prepareBookings : domain.pickMatchRequest) +
			(weather
				? `return [{json:prepareBookings(${config},$input.all().map(i=>i.json),new Date())}];`
				: 'return [{json:pickMatchRequest($input.all().map(i=>i.json))}];'),
	);
	const hasInput = iff(
		'has-input',
		weather ? 'Approved booking requests exist?' : 'An editorial event is enabled?',
		'$json.ready === true',
	);
	link(cfg.name, [ledger.name]);
	link(ledger.name, [recovery.name]);
	link(recovery.name, [recovered.name]);
	link(recovered.name, [node('late-ready').name], [queue.name]);
	link(queue.name, [choose.name]);
	link(choose.name, [hasInput.name]);
	if (weather) {
		const geo = node('zvid-wx-0004'),
			source = node('zvid-wx-0006');
		geo.parameters.queryParameters.parameters = [
			{ name: 'name', value: `={{ ${config}.cityName }}` },
			{ name: 'count', value: '10' },
			{ name: 'language', value: 'en' },
			{ name: 'format', value: 'json' },
		];
		link(hasInput.name, [geo.name], [node('late-no-work').name]);
		source.parameters.queryParameters.parameters = [
			{ name: 'latitude', value: '={{ $json.place.latitude }}' },
			{ name: 'longitude', value: '={{ $json.place.longitude }}' },
			{ name: 'timezone', value: '={{ $json.place.timezone }}' },
			{
				name: 'hourly',
				value: 'temperature_2m,precipitation_probability,wind_speed_10m,weather_code,is_day',
			},
			{ name: 'timeformat', value: 'unixtime' },
			{ name: 'wind_speed_unit', value: 'kmh' },
			{ name: 'temperature_unit', value: 'celsius' },
			{ name: 'start_date', value: `={{ $('${choose.name}').first().json.date }}` },
			{ name: 'end_date', value: `={{ $('${choose.name}').first().json.date }}` },
		];
		plan.parameters.jsCode =
			embed(domain.revisionHelpers, common.recoverPlan, domain.scheduleBookings) +
			`return [{json:scheduleBookings(${config},$('${choose.name}').first().json,$json,$('Require one matching city and region').first().json.place,${log},new Date())}];`;
		link(source.name, [plan.name]);
		// Keep the legacy stable IDs so existing local credentials and generator entry points survive.
		node('late-window').parameters.conditions.conditions[0].leftValue =
			'={{ Boolean($json.window) }}';
		node('late-window-found').parameters.jsCode =
			"return [{json:{...$json,proposalStatus:'Tentative slots available; review the calendar proposal.'}}];";
		node('late-window-none').parameters.jsCode =
			"return [{json:{...$json,proposalStatus:'All bookings deferred; do not create calendar reservations.'}}];";
		node('zvid-wx-0007').parameters.jsCode =
			"// === late-series glue ===\nreturn [{json:{...$json,note:$json.note+' '+$json.proposalStatus}}];";
		const ics = code(
			'calendar',
			'Download tentative booking calendar proposals',
			embed(domain.calendarProposal) +
				'return [{json:{renderKey:$json.renderKey,proposalCount:($json.decisions||[]).filter(x=>x.Start).length},binary:{data:calendarProposal($json)}}];',
		);
		w.connections[node('late-report').name].main[0].push({
			node: ics.name,
			type: 'main',
			index: 0,
		});
		link(node('late-preview-report').name, [ics.name, node('late-handoff').name]);
	} else {
		const source = node('zvid-sr-0004');
		source.parameters.url = `={{ 'https://www.thesportsdb.com/api/v1/json/' + encodeURIComponent(String(${config}.sportsDbKey)) + '/lookupevent.php' }}`;
		source.parameters.sendQuery = true;
		source.parameters.queryParameters = {
			parameters: [{ name: 'id', value: '={{ $json.request.EventId }}' }],
		};
		link(hasInput.name, [source.name], [node('late-no-work').name]);
		link(source.name, [plan.name]);
		plan.parameters.jsCode =
			embed(domain.revisionHelpers, common.recoverPlan, domain.reviewMatch) +
			`return [{json:reviewMatch(${config},$('${choose.name}').first().json.request,$json,${log},new Date())}];`;
		const preview = iff(
			'review-preview',
			'Skip editorial writes for a dry run?',
			`${config}.dryRun === true`,
		);
		const fields = [
			'EventId',
			'CurrentSnapshot',
			'ReviewStatus',
			'LastCheckedAt',
			'PriorVideoUrl',
			'ChangeSummary',
		];
		const write = add(
			'review-save',
			'Save current facts without granting approval',
			'googleSheets',
			{
				resource: 'sheet',
				operation: 'update',
				documentId: structuredClone(queue.parameters.documentId),
				sheetName: structuredClone(queue.parameters.sheetName),
				columns: {
					mappingMode: 'defineBelow',
					value: Object.fromEntries(
						fields.map((k) => [k, `={{ $('${plan.name}').first().json.reviewUpdate.${k} }}`]),
					),
					matchingColumns: ['EventId'],
					schema: fields.map((k) => ({
						id: k,
						displayName: k,
						type: 'string',
						display: true,
						canBeUsedToMatch: true,
					})),
				},
				options: { cellFormat: 'RAW' },
			},
			{ typeVersion: 4.7 },
		);
		const restore = code(
			'review-context',
			'Restore the checked editorial decision',
			`return [{json:$('${plan.name}').first().json}];`,
		);
		link(plan.name, [preview.name]);
		link(preview.name, [restore.name], [write.name]);
		link(write.name, [restore.name]);
		link(restore.name, [node('late-ready').name]);
		link(node('late-no-work').name, [node('late-handoff').name]);
		link(node('late-preview-report').name, [node('late-handoff').name]);
	}
	const builder = node(weather ? 'zvid-wx-0008' : 'zvid-sr-0009');
	builder.parameters.jsCode =
		'// === late-series glue ===\n' +
		embed(domain.revisionProject) +
		`return [{json:revisionProject(${config},$json,'${weather ? 'weather' : 'sports'}')}];`;
	if (weather) {
		const renames = new Map(
			[
				['late-window', 'At least one booking has a proposed slot?'],
				['late-window-found', 'Label available slots as tentative proposals'],
				['late-window-none', 'Label the call sheet as fully deferred'],
				['zvid-wx-0007', 'Add the coordinator confirmation requirement'],
			].map(([id, name]) => [node(id).name, name]),
		);
		for (const n of w.nodes) {
			n.name = renames.get(n.name) || n.name;
			for (const [before, after] of renames)
				n.parameters = JSON.parse(
					JSON.stringify(n.parameters).replaceAll("$('" + before + "')", "$('" + after + "')"),
				);
		}
		w.connections = Object.fromEntries(
			Object.entries(w.connections).map(([from, types]) => [
				renames.get(from) || from,
				Object.fromEntries(
					Object.entries(types).map(([type, outputs]) => [
						type,
						outputs.map((edges) =>
							edges.map((e) => ({ ...e, node: renames.get(e.node) || e.node })),
						),
					]),
				),
			]),
		);
	}
	w.name = s.title;
	w.meta = { ...w.meta, domainRevision: 2 };
	return w;
}
function overview(kind) {
	const weather = kind === 'daily-weather-video',
		s = descriptions[kind];
	return `## ${s.title}\n\n### How it works\n${s.purpose} Accepted jobs resume before new source requests; completed keys are not rendered again.\n\n### Setup\n1. Install **\`@zvid/n8n-nodes-zvid\`** from **Settings → Community nodes** before credentials. A workspace owner/admin may need to install it.\n2. Configure **Zvid API** using [your key](https://app.zvid.io/api-keys) and Base URL \`https://api.zvid.io\`; select it on every Zvid node.\n3. Connect Google Sheets. Select **${s.tab}** for the input nodes and **${weather ? 'Weather Briefings' : 'Sports Recaps'}** for recovery. Log headers: RenderKey, Status, JobId, CreditsQuoted, PlanJson, VideoUrl, CompletedAt.\n4. ${weather ? 'Input headers: BookingId, Date, Title, Status, Approval, EarliestStart, LatestEnd, PreferredStart, DurationMinutes, Priority, Start, End. Approve requested rows; confirmed rows block Start–End. Set city, region, timezone and planningDate.' : 'Input headers: EventId, Enabled, Approval, ApprovedSnapshot, CurrentSnapshot, ReviewStatus, LastCheckedAt, PriorVideoUrl, ChangeSummary. Set Enabled=yes. Configure sportsDbKey and leagueId. Review CurrentSnapshot before copying it to ApprovedSnapshot and setting Approval=approved.'}\n5. **dryRun=false spends credits** after eligibility. true returns JSON, quote and review files without writes or rendering. Set maxCreditsPerVideo.\n6. Run one execution at a time. Review **Watch video → Binary → data → View** before sharing. Read the [companion guide](https://github.com/Zvid-io/zvid-n8n/blob/master/workflows/${kind}.md) for field rules and migration.\n\n### Customization\n${weather ? 'Adjust planning thresholds and priorities; increment forecastRevision for a deliberately revised call sheet.' : 'Enable additional events in the same queue. Corrections require new approval; never delete previous editions.'}`;
}
function guide(kind) {
	const weather = kind === 'daily-weather-video',
		s = descriptions[kind];
	return `# ${s.title}\n\n${s.purpose}\n\n## Prerequisites\nInstall **\`@zvid/n8n-nodes-zvid\`** from **Settings → Community nodes** before configuring credentials. A workspace owner/admin may need to install it. Select a Zvid API credential on every native Zvid node, using https://app.zvid.io/api-keys and Base URL https://api.zvid.io. Connect Google Sheets OAuth2 and select the input and log tabs in all Sheets nodes. No supported Zvid operation uses HTTP Request. Watch downloads completed media only.\n\n${weather ? `## Booking desk\nUse one location and timezone per workflow. Set cityName, countryCode, admin1, timezone and planningDate (blank means today in that timezone). The resolved city's timezone must match. Requests must be within the forecast horizon supported by Open-Meteo.\n\nCreate **Outdoor Bookings** with headers:\n\n\`BookingId,Date,Title,Status,Approval,EarliestStart,LatestEnd,PreferredStart,DurationMinutes,Priority,Start,End\`\n\n- BookingId must be unique and stable. Date is YYYY-MM-DD. Title is 1–80 characters.\n- Requested rows use Status=requested and Approval=approved. Approval is coordinator-authored, never generated automatically.\n- EarliestStart, LatestEnd and optional PreferredStart use ISO timestamps with UTC offsets, for example 2026-10-09T09:00:00+01:00. Both window endpoints must stay within Date in the configured timezone. DurationMinutes is 30–240 in half-hour increments. Priority is 1–10; higher goes first.\n- Confirmed reservations use Status=confirmed with Start and End timestamps. They block scheduling regardless of Approval. Include every conflicting reservation for the planning date. The workflow does not read an external calendar: this sheet is the booking desk.\n- Maximum five approved requests per date. Times use half-hour candidate starts. The planner chooses the qualifying slot nearest the preferred start, then lowest rain/wind and earliest time. Earlier high-priority proposals block later ones. This deterministic greedy strategy is not a global optimum.\n- Every occupied hour must have forecast coverage, daylight, acceptable temperature, rain and wind, and no excluded severe weather code. Missing numeric data fails; no matching slot returns defer with reasons. It is planning guidance, not an official warning.\n\n## Outputs and confirmation\nThe call-sheet video distinguishes keep, reschedule and defer for each booking. The CSV contains exact UTC start/end times, forecast values and blocking reasons. The ICS download contains only proposed slots with STATUS:TENTATIVE, transparent availability, no attendees and no invitation sends. Import only after coordinator review. Mark confirmed reservations in the booking desk yourself; a completed render is not a confirmed booking.\n\nRender keys use calendarLabel, planning date and forecastRevision. Changing requests or thresholds after a completed run requires deliberately increasing forecastRevision; keep the original log. Preview returns the calendar and CSV without rendering.\n\nSource: [Open-Meteo forecast documentation](https://open-meteo.com/en/docs). Unix timestamps avoid ambiguous repeated local hours during daylight-saving changes.` : `## Match editorial queue\nCreate **Match Editorial Queue** with headers:\n\n\`EventId,Enabled,Approval,ApprovedSnapshot,CurrentSnapshot,ReviewStatus,LastCheckedAt,PriorVideoUrl,ChangeSummary\`\n\n1. Enter a real numeric TheSportsDB EventId, set Enabled=yes, and leave approval fields blank. Set sportsDbKey and leagueId in configuration; leagueId may be blank to accept queued events from any league. This key is provider configuration, not a Zvid credential.\n2. Run once. The least recently checked enabled event is fetched directly with lookupevent.php. Require a final status, real date, both teams and integer scores. Missing/nonfinal/conflicting results fail before changing review cells. Disable invalid queue rows while correcting their IDs so they do not block later cases.\n3. Inspect ChangeSummary and CurrentSnapshot against the source. A human sets Approval=approved and copies the exact CurrentSnapshot string into ApprovedSnapshot. The workflow writes neither approval field.\n4. Run again. If facts still match the approved edition, render one original or correction report. Source changes invalidate the approval, including a rollback to previously used facts: the approval snapshot includes the edition number.\n5. Leave the event enabled to monitor corrections. LastCheckedAt rotates checks across enabled rows. New final facts are compared with the latest completed video; a correction includes the previous score and prior video URL in its CSV and clearly labels the video CORRECTED MATCH REPORT. Review and approve each new edition.\n\nCurrentSnapshot is an exact JSON string, not a cryptographic signature. Restrict edit access to trusted editors; anyone with write access to the approval columns can approve. Sheets is not an atomic lock: avoid overlapping executions. TheSportsDB coverage is not guaranteed; source errors do not substitute demo matches. Date and score corrections are versioned, but this workflow does not assert independent fact verification beyond provider status and editorial review. No OpenAI or other language model is used.\n\nThe CSV is available for pending review as well as completed runs. It contains current and previous results, edition, source URL, approval snapshot and a caption draft. The workflow neither publishes nor retracts social posts. Editors must replace or correct already shared content themselves.\n\nSource: [TheSportsDB API](https://www.thesportsdb.com/api.php).`}\n\n## Costs and recovery\n**dryRun=false is the default**; eligible new work spends Zvid credits after free validation and maxCreditsPerVideo enforcement. Weather caps at 35 credits; sports at 35. **dryRun=true** performs reads, planning and validation only; it writes no source or tracking cells, starts no render and resumes no paid job. Sports must have exact approval to reach validation even in preview mode. No editor project is created.\n\nUse the separate **${weather ? 'Weather Briefings' : 'Sports Recaps'}** tab with headers:\n\n\`RenderKey,Status,JobId,CreditsQuoted,PlanJson,VideoUrl,CompletedAt\`\n\nBefore a paid call, reserve submitting and a compact snapshot. Persist the accepted JobId; recovery polls it before source checks. Explicit 429 rejections are retried up to three attempts with a 30-second minimum and server Retry-After. Uncertain submissions are never retried automatically. Failed, timed-out and uncertain records need inspection; do not delete rows as a general retry strategy. Sports blocks replacement editions while the preceding edition needs inspection.\n\nOpen **Watch video → Binary → data → View** on completion. The download has a 30-second timeout and three attempts; its failure does not erase the saved video URL. CSV formula-like values are escaped. Optional music is checked before use and skipped if unavailable.\n\n## Migration from the previous day ${weather ? '27' : '28'} template\nRevise the existing creator entry, not a second submission. Retain the same local workflow, credentials and full recovery history. Add the new input tab; do not turn old results into approved source records. Keep schedules disabled until the new inputs are configured. Old accepted jobs still resume from their saved context. ${weather ? 'The old generic forecast and outlook have been replaced by the booking call sheet.' : 'Old periodic recaps remain in history; new editorial editions use a separate sports-editorial key prefix. If an older recap was published, document any needed correction manually because its batch snapshot is not an editorial event baseline.'}\n\n## What changed for review\n${weather ? 'This is a booking allocation workflow with conflicting reservations, priorities, preferred-slot movement, per-request deferrals and an importable tentative calendar. The forecast changes scheduling decisions and the actual deliverables.' : 'This is an editorial approval and correction lifecycle. One exact event is checked against versioned human approval and previous rendered facts; stale approvals cannot trigger replacement videos, and correction outputs preserve prior evidence.'} The source code and layout are generated by scripts/weather-sports-revisions.js and scripts/weather-sports-revision-runtime.js. Acceptance remains n8n’s decision.\n\nSupport: https://zvid.io/contact\n`;
}
module.exports = { reviseWeatherSports, descriptions, kinds, overview, guide };
