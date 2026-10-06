'use strict';
const fs = require('node:fs'),
	path = require('node:path');
const runtime = require('./late-series-runtime'),
	render = require('./review-template-runtime');
const ZVID = '@zvid/n8n-nodes-zvid.zvid',
	BASE = 'n8n-nodes-base.';
const specs = {
	'quiz-shorts': {
		day: 25,
		prefix: 'qz',
		config: 'Set quiz episode and rotation rules',
		source: 'Read the approved question bank',
		plan: 'Select an easy medium and hard question',
		builder: 'Build the three-round quiz episode',
		title: 'Create balanced quiz episodes with an answer and source pack',
		log: 'Quiz Episodes',
		defaults: {
			timezone: 'UTC',
			episodeRevision: 1,
			rotationEpisodes: 7,
			topic: '',
			maxCreditsPerVideo: 60,
			musicUrl: '',
		},
		inputs:
			'QuestionKey, Question, OptionA, OptionB, OptionC, CorrectLetter, FunFact, Topic, Difficulty, SourceUrl, Approval',
		purpose:
			'Select one approved easy, medium and hard question. Rotate topics using episode history, exclude used question keys and repeated text, and rotate answer positions without changing the correct answer. Produce one three-round video and a source-backed answer pack.',
	},
	'kpi-report-video': {
		day: 26,
		prefix: 'kr',
		config: 'Set reporting period and exception thresholds',
		source: 'Fetch the reporting source snapshot',
		plan: 'Calculate KPI changes target misses and owners',
		builder: 'Build the exception-focused KPI briefing',
		title: 'Turn verified KPI snapshots into an exception briefing and action register',
		log: 'KPI Reports',
		defaults: {
			timezone: 'UTC',
			reportRevision: 1,
			maxDataAgeHours: 36,
			metricsSource: 'live',
			alertPercent: 10,
			onlyExceptions: false,
			narrate: false,
			sendSlack: false,
			maxCreditsPerVideo: 65,
			musicUrl: '',
		},
		inputs:
			'metricsUrl returning generatedAt, periodStart, periodEnd, company and metrics[] with id, label, value, previous and lowerIsBetter; optional target, owner and action',
		purpose:
			'Check the reporting snapshot is fresh and its period is complete. Calculate changes from actual current and previous values, identify target misses and adverse movements, prioritize the five most important metrics in the video, and return a full owner action register.',
	},
	'daily-weather-video': {
		day: 27,
		prefix: 'wx',
		config: 'Set the city and outdoor planning thresholds',
		source: 'Fetch local current daily and hourly weather',
		plan: 'Rank remaining three-hour weather windows',
		builder: 'Build the forecast and planning-window video',
		title: 'Create a local forecast with a ranked daytime planning window',
		log: 'Weather Briefings',
		defaults: {
			countryCode: 'PT',
			admin1: 'Lisbon District',
			forecastRevision: 1,
			maxRainProbability: 30,
			maxWindKmh: 25,
			maxCreditsPerVideo: 25,
			musicUrl: '',
		},
		inputs:
			'cityName, countryCode and admin1 for an unambiguous location; rain and wind thresholds',
		purpose:
			'Resolve one city, validate fresh current and hourly data, and rank remaining three-hour daytime windows by rain probability and wind. Branch to a qualifying window or a no-window notice, then add that planning card to the local forecast and three-day outlook.',
	},
	'sports-recap-video': {
		day: 28,
		prefix: 'sr',
		config: 'Set the league club and completed recap period',
		source: 'Fetch recent league events from TheSportsDB',
		plan: 'Verify final scores and prioritize recap matches',
		builder: 'Build the verified results and scoreline recap',
		title: 'Build verified league or club recaps with a final-score fact sheet',
		log: 'Sports Recaps',
		defaults: {
			timezone: 'UTC',
			periodStart: '',
			periodEnd: '',
			focusTeam: '',
			recapRevision: 1,
			allowLatestAvailableResults: false,
			maxFallbackAgeDays: 30,
			maxCreditsPerVideo: 35,
			musicUrl: '',
		},
		inputs: 'sportsDbKey, leagueId, optional focusTeam and completed periodStart/periodEnd',
		purpose:
			'Read recent events from TheSportsDB. Keep verified final matches in the requested league and completed date window, reject conflicting scores, and optionally focus on one club. Rank scorelines, calculate returned-match totals and club form, and create a deterministic recap with a fact sheet.',
	},
	'birthday-greetings': {
		day: 29,
		prefix: 'bg',
		config: 'Set celebration consent and delivery rules',
		source: 'Read consented celebration dates',
		plan: 'Select a due approved celebration and annual key',
		builder: 'Build the selected private celebration video',
		title: 'Create consent-aware birthday and anniversary greetings with annual tracking',
		log: 'Celebration Runs',
		defaults: {
			timezone: 'UTC',
			leapDayPolicy: 'feb28',
			sendEmail: false,
			maxCreditsPerVideo: 15,
			musicUrl: '',
		},
		inputs:
			'CelebrationKey, Name, Type, Date, Approval, GreetingConsent; optional DoNotContact, Email, EmailApproval, ShowAge and Message',
		purpose:
			'Select a due, approved celebration with greeting consent. Treat birthdays and anniversaries separately, apply an explicit leap-day policy, and reveal birthday age only when ShowAge is true. One video runs at a time; annual keys prevent duplicates and the result includes a private delivery handoff.',
	},
};
function buildLateSeries(original, kind) {
	const s = specs[kind];
	if (!s) return structuredClone(original);
	const w = structuredClone(original),
		old = (id) => original.nodes.find((n) => n.id === id),
		byName = (n) => original.nodes.find((x) => x.name === n);
	const get = (id, name) => structuredClone(old(id) || byName(name));
	const cfg = get('zvid-' + s.prefix + '-0003', s.config),
		manual = structuredClone(original.nodes.find((n) => n.type === BASE + 'manualTrigger')),
		schedule = structuredClone(original.nodes.find((n) => n.type === BASE + 'scheduleTrigger'));
	const initial = JSON.parse(cfg.parameters.jsonOutput);
	if (
		kind === 'daily-weather-video' &&
		initial.cityName === 'Lisbon' &&
		initial.countryCode === 'PT' &&
		initial.admin1 === 'Lisbon'
	)
		initial.admin1 = 'Lisbon District';
	cfg.name = s.config;
	cfg.parameters.jsonOutput = JSON.stringify(
		{
			...initial,
			...s.defaults,
			...(original.meta?.lateSeriesReview ? initial : {}),
			dryRun: initial.dryRun ?? false,
		},
		null,
		2,
	);
	const watch = structuredClone(
		original.nodes.find((n) => /Watch video/.test(n.name) && n.type === BASE + 'httpRequest'),
	);
	watch.name = '▶ Watch video';
	watch.typeVersion = 2;
	watch.parameters = {
		url: '={{ $json.videoUrl }}',
		responseFormat: 'file',
		dataPropertyName: 'data',
		options: { timeout: 30000 },
	};
	Object.assign(watch, {
		onError: 'continueRegularOutput',
		retryOnFail: true,
		maxTries: 3,
		waitBetweenTries: 5000,
		alwaysOutputData: true,
	});
	manual.name = 'Test the ' + kind.replaceAll('-', ' ') + ' workflow';
	schedule.name =
		kind === 'birthday-greetings'
			? 'Check due celebrations each hour'
			: 'Start the scheduled ' + kind.replaceAll('-', ' ');
	if (kind === 'birthday-greetings')
		schedule.parameters = {
			rule: { interval: [{ field: 'cronExpression', expression: '0 8-18 * * *' }] },
		};
	w.nodes = [cfg, manual, schedule, watch];
	w.connections = {};
	const add = (id, name, type, parameters, extra = {}) => {
		const n = {
			id: 'late-' + id,
			name,
			type: BASE + type,
			typeVersion: 2,
			position: [0, 0],
			parameters,
			...extra,
		};
		w.nodes.push(n);
		return n;
	};
	const code = (id, name, jsCode) => add(id, name, 'code', { jsCode });
	const iff = (id, name, expression) =>
		add(
			id,
			name,
			'if',
			{
				conditions: {
					options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
					conditions: [
						{
							id: id + '-condition',
							leftValue: '={{ ' + expression + ' }}',
							rightValue: '',
							operator: { type: 'boolean', operation: 'true', singleValue: true },
						},
					],
					combinator: 'and',
				},
				options: {},
			},
			{ typeVersion: 2.2 },
		);
	const link = (from, ...branches) =>
		(w.connections[from] = {
			main: branches.map((ns) => ns.map((n) => ({ node: n, type: 'main', index: 0 }))),
		});
	const copySource = (id, oldName) => {
		const n = get(id, oldName);
		n.name = s.source;
		n.alwaysOutputData = true;
		if (n.type === BASE + 'httpRequest') {
			n.parameters.options = { ...(n.parameters.options || {}), timeout: 20000 };
			n.retryOnFail = true;
			n.maxTries = 3;
			n.waitBetweenTries = 2000;
		}
		w.nodes.push(n);
		return n;
	};
	let source;
	if (kind === 'quiz-shorts' || kind === 'birthday-greetings')
		source = copySource('zvid-' + s.prefix + '-0004', s.source);
	else if (kind === 'kpi-report-video') {
		source = copySource('zvid-kr-0005', s.source);
		source.parameters.url = '={{ $json.metricsUrl }}';
		source.onError = 'continueRegularOutput';
		iff(
			'metrics-mode',
			'Use explicitly selected sample metrics?',
			"$json.metricsSource === 'sample'",
		);
		code(
			'sample-metrics',
			'Create labeled sample metrics for testing',
			runtime.helpers.toString() +
				'\n' +
				runtime.sampleKpiResponse.toString() +
				'\nreturn [{json:sampleKpiResponse($json,new Date())}];',
		);
		code(
			'require-metrics',
			'Require a live reporting URL before fetching',
			runtime.helpers.toString() +
				"\nif(($json.metricsSource||'live')!=='live')throw Error('metricsSource must be live or sample.');if(!$json.metricsUrl)throw Error('KPI setup required: set metricsUrl or explicitly choose metricsSource=sample for a labeled test.');helpers().https($json.metricsUrl,'metricsUrl');return $input.all();",
		);
		code('metrics-input', 'Choose the configured metrics input', 'return $input.all();');
	} else if (kind === 'sports-recap-video') source = copySource('zvid-sr-0004', s.source);
	else {
		const geo = get('zvid-wx-0004', 'Find the configured city candidates');
		geo.name = 'Find the configured city candidates';
		geo.parameters.queryParameters.parameters.find((p) => p.name === 'count').value = '10';
		geo.parameters.options = { timeout: 20000 };
		w.nodes.push(geo);
		code(
			'place',
			'Require one matching city and region',
			runtime.helpers.toString() +
				'\n' +
				runtime.selectPlace.toString() +
				`\nreturn [{json:selectPlace($('${s.config}').first().json,$json)}];`,
		);
		source = copySource('zvid-wx-0006', s.source);
		const q = source.parameters.queryParameters.parameters;
		q.splice(0, q.length, ...q.filter((x) => x.name !== 'hourly'), {
			name: 'hourly',
			value: 'precipitation_probability,wind_speed_10m,weather_code',
		});
		link(cfg.name, [geo.name]);
		link(geo.name, ['Require one matching city and region']);
		link('Require one matching city and region', [source.name]);
	}
	// Rewrite all old Config references on retained source nodes.
	for (const n of w.nodes)
		n.parameters = JSON.parse(
			JSON.stringify(n.parameters).replaceAll("$('Config')", `$('${s.config}')`),
		);
	const document =
		source.type === BASE + 'googleSheets'
			? structuredClone(source.parameters.documentId)
			: { __rl: true, value: '', mode: 'id' };
	const ledger = add(
		'ledger',
		'Read ' + s.log + ' recovery log',
		'googleSheets',
		{
			resource: 'sheet',
			operation: 'read',
			documentId: document,
			sheetName: { __rl: true, value: s.log, mode: 'name' },
			options: {},
		},
		{ typeVersion: 4.7, alwaysOutputData: true },
	);
	const oldLedger = old('late-ledger');
	if (oldLedger) {
		ledger.parameters.documentId = structuredClone(oldLedger.parameters.documentId);
		ledger.parameters.sheetName = structuredClone(oldLedger.parameters.sheetName);
	}
	const planner = {
		'quiz-shorts': 'planQuiz',
		'kpi-report-video': 'planKpi',
		'daily-weather-video': 'planWeather',
		'sports-recap-video': 'planSports',
		'birthday-greetings': 'planCelebration',
	}[kind];
	const input =
		kind === 'kpi-report-video'
			? "$('Choose the configured metrics input').first().json"
			: source.type === BASE + 'googleSheets'
				? `$('${source.name}').all().map(i=>i.json).filter(r=>Object.keys(r).length)`
				: `$('${source.name}').first().json`;
	const args =
		kind === 'daily-weather-video'
			? `${input},$('Require one matching city and region').first().json.place,`
			: `${input},`;
	code(
		'plan',
		s.plan,
		[runtime.helpers, runtime.recoverPlan, runtime.resumeOutstanding, runtime[planner]]
			.map((f) => f.toString())
			.join('\n') +
			`\nreturn [{json:${planner}($('${cfg.name}').first().json,${args}$input.all().map(i=>i.json),new Date())}];`,
	);
	iff('ready', 'Eligible source content or saved render exists?', '$json.ready === true');
	code('no-work', 'Explain skipped content or recovery needs', 'return $input.all();');
	iff('resume', 'Resume the accepted render job?', 'Boolean($json.jobId)');
	code('resume-context', 'Restore the saved result and handoff context', 'return $input.all();');
	const builderId = {
		'quiz-shorts': 'zvid-qz-0007',
		'kpi-report-video': 'zvid-kr-0015',
		'daily-weather-video': 'zvid-wx-0008',
		'sports-recap-video': 'zvid-sr-0009',
		'birthday-greetings': 'zvid-bg-0006',
	}[kind];
	const builder = get(builderId, s.builder);
	builder.name = s.builder;
	let base = builder.parameters.jsCode;
	const markers = ['// === late-series glue ===', '// ---- n8n glue', '// === n8n glue ==='];
	let cut = Math.min(
		...markers.map((m) => {
			const i = base.indexOf(m);
			return i < 0 ? Infinity : i;
		}),
	);
	if (!Number.isFinite(cut))
		cut =
			kind === 'daily-weather-video'
				? base.lastIndexOf('\nconst cfg = ')
				: base.lastIndexOf('\nreturn $input.all().map(');
	base = base.slice(0, cut).trimEnd().replaceAll("$('Config')", `$('${cfg.name}')`);
	if (kind === 'sports-recap-video') {
		const oversized = 'https://videos.pexels.com/video-files/34930800/14796393_1440_2560_30fps.mp4';
		const bounded = 'https://videos.pexels.com/video-files/34930800/14796392_1080_1920_30fps.mp4';
		base = base.replace(`const COVER = '${oversized}'`, `const COVER = '${bounded}'`);
		// Migrate only the known bundled clip; preserve arbitrary custom media.
		if (!base.includes('clean(cfg.coverVideoOverride) ==='))
			base = base.replace(
				'clean(cfg.coverVideoOverride) || COVER',
				`clean(cfg.coverVideoOverride) === '${oversized}' ? COVER : (clean(cfg.coverVideoOverride) || COVER)`,
			);
	}
	let glue = `\n// === late-series glue ===\nconst plan=$json;\n`;
	if (kind === 'quiz-shorts')
		glue += `const config=$('${cfg.name}').first().json;\nconst parts=plan.questions.map(q=>buildProject({...config,musicUrl:''},{...q,music:{ok:false}}));\nconst scenes=parts.flatMap((p,i)=>p.payload.scenes.map(s=>({...s,id:'round-'+(i+1)+'-'+s.id,...(s.transitionId?{transitionId:'round-'+(i+1)+'-'+s.transitionId}:{})})));\nconst payload={...parts[0].payload,name:'quiz-'+plan.date,scenes,audios:[]};\nreturn [{json:{...plan,payload,meta:{rounds:parts.map(p=>p.meta)}}}];`;
	if (kind === 'kpi-report-video')
		glue += `const config={...$('${cfg.name}').first().json,narrate:false,summaryLine:plan.caption,titleVideoUrl:''};\nconst built=buildProject(config,{...plan,music:null},null);\nreturn [{json:{...plan,...built}}];`;
	if (kind === 'sports-recap-video')
		glue += `const cfg=$('${cfg.name}').first().json;\nconst recap={title:plan.club?plan.club.team+' results':'The verified final scores',matchLines:plan.matches.map(m=>({home:m.home,away:m.away,line:m.homeScore===m.awayScore?'The match finished level.':(m.homeScore>m.awayScore?m.home:m.away)+' won '+Math.max(m.homeScore,m.awayScore)+' to '+Math.min(m.homeScore,m.awayScore)+'.'})),closing:plan.club?plan.club.wins+' wins, '+plan.club.draws+' draws, '+plan.club.losses+' losses.':plan.totals.goals+' goals across '+plan.totals.matches+' returned final matches.'};\nrecap.lines=recap.matchLines.map(m=>m.line);\nconst built=buildProject({...cfg,musicUrl:''},plan,recap,{statusCode:0});\nreturn [{json:{...plan,...built}}];`;
	if (kind === 'birthday-greetings')
		glue += `const built=buildProject({...cfg,musicUrl:''},plan);\nreturn [{json:{...plan,...built}}];`;
	if (kind === 'daily-weather-video') {
		const look = get('zvid-wx-0007', 'Map forecast conditions into the video design');
		let codeText = look.parameters.jsCode;
		codeText = codeText.slice(
			0,
			codeText.indexOf('// === late-series glue ===') >= 0
				? codeText.indexOf('// === late-series glue ===')
				: codeText.lastIndexOf('\nconst cfg = '),
		);
		look.name = 'Map forecast conditions into the video design';
		look.parameters.jsCode =
			codeText.trimEnd() +
			`\n// === late-series glue ===\nconst plan=$json;return [{json:{...plan,weather:buildWeather($('${cfg.name}').first().json,plan.place,plan.forecast)}}];`;
		w.nodes.push(look);
		glue += `const cfg=$('${cfg.name}').first().json;const built=buildProject({...cfg,musicUrl:''},plan.weather);\nconst text=plan.caption+' '+plan.note;built.payload.scenes.push({id:'planning',duration:7,backgroundColor:'#102032',visuals:[{type:'TEXT',text:plan.window?'TODAY’S PLANNING WINDOW':'NO QUALIFYING WINDOW',x:80,y:330,width:920,anchor:'top-left',style:{fontFamily:'Arial',fontSize:'52px',fontWeight:'700',color:'#FFFFFF'}},{type:'TEXT',text,x:80,y:600,width:920,anchor:'top-left',style:{fontFamily:'Arial',fontSize:'44px',color:'#DDEEFF'}},{type:'TEXT',text:'Forecast: Open-Meteo · '+plan.place.timezone,x:80,y:1500,width:920,anchor:'top-left',style:{fontFamily:'Arial',fontSize:'28px',color:'#AABBCC'}}]});\nreturn [{json:{...plan,...built}}];`;
	}
	// Preserve optional music while skipping unreachable or oversized tracks.
	if (kind === 'quiz-shorts')
		glue = glue
			.replace(
				"musicUrl:''},{...q,music:{ok:false}}",
				"musicUrl:plan.musicOk?config.musicUrl:''},{...q,music:{ok:plan.musicOk===true}}",
			)
			.replace('scenes,audios:[]', 'scenes,audios:parts[0].payload.audios||[]');
	if (kind === 'kpi-report-video')
		glue = glue
			.replace('narrate:false,summaryLine', 'summaryLine')
			.replace(
				"titleVideoUrl:''",
				"titleVideoUrl:'',...(plan.usingDemoData?{reportKicker:'SAMPLE DATA - TEST ONLY',reportTitle:'Example KPI briefing'}:{})",
			)
			.replace(
				'{...plan,music:null},null',
				'{...plan,music:plan.musicOk?{src:config.musicUrl}:null},plan.narrationData||null',
			);
	if (kind === 'daily-weather-video' || kind === 'birthday-greetings')
		glue = glue.replace("musicUrl:''", "musicUrl:plan.musicOk?cfg.musicUrl:''");
	if (kind === 'sports-recap-video')
		glue = glue.replace(
			"{...cfg,musicUrl:''},plan,recap,{statusCode:0}",
			"{...cfg,musicUrl:plan.musicOk?cfg.musicUrl:''},plan,recap,plan.musicProbe||{statusCode:0}",
		);
	builder.parameters.jsCode = base + glue;
	w.nodes.push(builder);
	let designStart = builder.name;
	if (kind === 'daily-weather-video') {
		iff('window', 'A three-hour window meets the planning thresholds?', 'Boolean($json.window)');
		code('window-found', 'Prepare the qualifying outdoor window', 'return $input.all();');
		code('window-none', 'Prepare the no-window planning notice', 'return $input.all();');
		link(
			'A three-hour window meets the planning thresholds?',
			['Prepare the qualifying outdoor window'],
			['Prepare the no-window planning notice'],
		);
		link('Prepare the qualifying outdoor window', [
			'Map forecast conditions into the video design',
		]);
		link('Prepare the no-window planning notice', [
			'Map forecast conditions into the video design',
		]);
		link('Map forecast conditions into the video design', [builder.name]);
		designStart = 'A three-hour window meets the planning thresholds?';
	}
	if (kind === 'birthday-greetings') {
		iff('occasion', 'Is the due celebration an anniversary?', "$json.type === 'anniversary'");
		code('anniversary', 'Prepare the verified anniversary milestone', 'return $input.all();');
		code('birthday', 'Prepare the birthday with optional age', 'return $input.all();');
		link(
			'Is the due celebration an anniversary?',
			['Prepare the verified anniversary milestone'],
			['Prepare the birthday with optional age'],
		);
		link('Prepare the verified anniversary milestone', [builder.name]);
		link('Prepare the birthday with optional age', [builder.name]);
		designStart = 'Is the due celebration an anniversary?';
	}
	if (kind === 'kpi-report-video') {
		iff(
			'narrate',
			'Create optional narration from checked metrics?',
			`$('${cfg.name}').first().json.narrate === true`,
		);
		code(
			'narration',
			'Write factual KPI narration from the checked values',
			`const d=$json;const opening=d.company+' report for '+d.period+'.';const perMetric=d.metrics.map(m=>m.label+' is '+m.value+' '+m.unit+'. '+m.baseline+(m.targetMiss?' Target not met.':'')+(m.attention?' Review required.':''));const closing=d.caption;const narration=[opening,...perMetric,closing].join(' ');return [{json:{opening,perMetric,closing,narration,wordCount:narration.split(/\\s+/).length}}];`,
		);
		const voiceNodes = structuredClone(require('./late-series-narration-nodes.json'));
		for (const n of voiceNodes) {
			n.parameters = JSON.parse(
				JSON.stringify(n.parameters)
					.replaceAll("$('Config')", `$('${cfg.name}')`)
					.replaceAll(
						"$('Parse narration')",
						"$('Write factual KPI narration from the checked values')",
					),
			);
			delete n.credentials;
			w.nodes.push(n);
		}
		code(
			'narration-context',
			'Restore the checked KPI plan with its narration',
			"const plan=$('Prepare the selected source for design').first().json;const upload=$('Upload voiceover').first().json.upload;if(!upload?.url)throw Error('Voiceover upload returned no URL');return [{json:{...plan,narrationData:{parsed:$('Write factual KPI narration from the checked values').first().json,timings:$('Voice + timings').first().json,voUrl:upload.url}}}];",
		);
		link(
			'Create optional narration from checked metrics?',
			['Write factual KPI narration from the checked values'],
			[builder.name],
		);
		link('Write factual KPI narration from the checked values', ['Generate voiceover']);
		link('Generate voiceover', ['Voice + timings']);
		link('Voice + timings', ['Upload voiceover']);
		link('Upload voiceover', ['Restore the checked KPI plan with its narration']);
		link('Restore the checked KPI plan with its narration', [builder.name]);
		designStart = 'Create optional narration from checked metrics?';
	}
	iff(
		'music',
		'A background music URL is configured?',
		`Boolean($('${cfg.name}').first().json.musicUrl)`,
	);
	add(
		'music-probe',
		'Check the optional music file size and availability',
		'httpRequest',
		{
			method: 'HEAD',
			url: `={{ $('${cfg.name}').first().json.musicUrl }}`,
			options: { timeout: 8000, response: { response: { fullResponse: true, neverError: true } } },
		},
		{ typeVersion: 4.2, onError: 'continueRegularOutput', alwaysOutputData: true },
	);
	code(
		'music-restore',
		'Keep the source plan and usable music only',
		`const plan=$('${s.plan}').first().json,cfg=$('${cfg.name}').first().json,probe=$json;const bytes=Number(probe.headers?.['content-length']||0);const musicOk=Number(probe.statusCode)===200&&Number.isFinite(bytes)&&bytes>=0&&bytes<=Number(cfg.maxMusicBytes||5242880);return [{json:{...plan,musicOk,musicProbe:probe}}];`,
	);
	code('design-context', 'Prepare the selected source for design', 'return $input.all();');
	link(
		'A background music URL is configured?',
		['Check the optional music file size and availability'],
		['Prepare the selected source for design'],
	);
	link('Check the optional music file size and availability', [
		'Keep the source plan and usable music only',
	]);
	link('Keep the source plan and usable music only', ['Prepare the selected source for design']);
	link('Prepare the selected source for design', [designStart]);
	designStart = 'A background music URL is configured?';
	add(
		'validate',
		'Validate the video and request its credit quote',
		'zvid',
		{
			resource: 'render',
			operation: 'validate',
			source: 'json',
			projectJson: '={{ JSON.stringify($json.payload) }}',
		},
		{ type: ZVID, typeVersion: 1 },
	);
	code(
		'quote',
		'Enforce the per-video credit ceiling',
		render.checkQuote.toString() +
			`\nconst d=checkQuote($('${cfg.name}').first().json,$('${builder.name}').first().json,$json);const {payload,forecast,weather,narrationData,musicProbe,...snapshot}=d;d.checkpoint={...snapshot,snapshotVersion:1};if(JSON.stringify(d.checkpoint).length>45000)throw Error('Recovery snapshot exceeds the sheet cell limit. No render submitted.');return [{json:d}];`,
	);
	iff(
		'preview',
		'Return a validation-only preview?',
		`$('${cfg.name}').first().json.dryRun === true`,
	);
	code(
		'preview-report',
		'Return the source plan design quote and handoff',
		"return [{json:{...$json,status:'preview',dryRun:true,videoUrl:null,note:'No log writes, editor draft, render or delivery.'}}];",
	);
	const write = (id, name, ref, phase) => {
		const d = `$('${ref}').first().json`,
			value = { RenderKey: `={{ ${d}.renderKey }}` };
		if (phase === 'claim')
			Object.assign(value, {
				Status: 'submitting',
				JobId: '',
				VideoUrl: '',
				CreditsQuoted: `={{ ${d}.creditsRequired }}`,
				PlanJson: `={{ JSON.stringify(${d}.checkpoint) }}`,
				CompletedAt: '',
			});
		if (phase === 'accepted')
			Object.assign(value, { Status: 'rendering', JobId: `={{ ${d}.jobId }}` });
		if (phase === 'finish')
			Object.assign(value, {
				Status: `={{ ${d}.status }}`,
				JobId: `={{ ${d}.jobId }}`,
				VideoUrl: `={{ ${d}.videoUrl || '' }}`,
				CompletedAt: `={{ ${d}.renderedAt || '' }}`,
				PlanJson: `={{ JSON.stringify(${d}.outcomeCheckpoint) }}`,
			});
		if (phase === 'rejected')
			Object.assign(value, {
				Status: `={{ ${d}.status }}`,
				JobId: '',
				VideoUrl: '',
				PlanJson: `={{ JSON.stringify(${d}.checkpoint) }}`,
			});
		return add(
			id,
			name,
			'googleSheets',
			{
				resource: 'sheet',
				operation: phase === 'claim' ? 'appendOrUpdate' : 'update',
				documentId: structuredClone(ledger.parameters.documentId),
				sheetName: structuredClone(ledger.parameters.sheetName),
				columns: {
					mappingMode: 'defineBelow',
					value,
					matchingColumns: ['RenderKey'],
					schema: Object.keys(value).map((k) => ({
						id: k,
						displayName: k,
						required: false,
						defaultMatch: false,
						display: true,
						type: 'string',
						canBeUsedToMatch: true,
						removed: false,
					})),
				},
				options: { cellFormat: 'RAW' },
			},
			{ typeVersion: 4.7 },
		);
	};
	write(
		'claim',
		'Reserve this render key before spending credits',
		'Enforce the per-video credit ceiling',
		'claim',
	);
	code(
		'attempt',
		'Prepare a bounded render submission attempt',
		"const prior=$json;const checkpoint=$('Enforce the per-video credit ceiling').first().json.checkpoint;return [{json:{...checkpoint,checkpoint,submitStartedAt:prior.submitStartedAt||Date.now(),submitAttempts:Number(prior.submitAttempts||0)+1}}];",
	);
	add(
		'submit',
		'Submit this approved video to Zvid',
		'zvid',
		{
			resource: 'render',
			operation: 'create',
			source: 'json',
			projectJson:
				"={{ JSON.stringify($('Enforce the per-video credit ceiling').first().json.payload) }}",
			renderType: 'video',
			waitForCompletion: false,
		},
		{ type: ZVID, typeVersion: 1, retryOnFail: false, onError: 'continueErrorOutput' },
	);
	code(
		'rejection',
		'Distinguish a capacity rejection from an uncertain submission',
		runtime.classifySubmissionError.toString() +
			`\nconst item=$input.first();return [{json:classifySubmissionError($('Prepare a bounded render submission attempt').first().json,item.error||item.json.error||{},Date.now(),$('${cfg.name}').first().json)}];`,
	);
	write(
		'save-rejection',
		'Record the rejected or uncertain submission',
		'Distinguish a capacity rejection from an uncertain submission',
		'rejected',
	);
	code(
		'rejection-context',
		'Restore the submission rejection and retry timing',
		"return [{json:$('Distinguish a capacity rejection from an uncertain submission').first().json}];",
	);
	iff('retry-capacity', 'Retry this explicit capacity rejection?', '$json.retry === true');
	add(
		'capacity-wait',
		'Wait before retrying available render capacity',
		'wait',
		{ resume: 'timeInterval', amount: '={{ $json.retrySeconds }}', unit: 'seconds' },
		{ typeVersion: 1.1 },
	);
	code('submission-stop', 'Report why the render submission stopped', 'throw Error($json.reason);');
	code(
		'accepted',
		'Capture the accepted render job ID',
		render.trackJob.toString() +
			"\nreturn [{json:trackJob($('Enforce the per-video credit ceiling').first().json.checkpoint,$json,Date.now())}];",
	);
	write(
		'save-job',
		'Persist the accepted job for recovery',
		'Capture the accepted render job ID',
		'accepted',
	);
	code(
		'restore-new',
		'Restore the accepted render context',
		"return [{json:$('Capture the accepted render job ID').first().json}];",
	);
	code(
		'track',
		'Track the saved job and its source context',
		render.trackJob.toString() + '\nreturn [{json:trackJob($json,{},Date.now())}];',
	);
	add(
		'status',
		'Wait for this accepted Zvid render',
		'zvid',
		{
			resource: 'render',
			operation: 'get',
			jobId: '={{ $json.jobId }}',
			waitForCompletion: true,
			waitOptions: {
				pollInterval: `={{ Number($('${cfg.name}').first().json.pollSeconds) || 10 }}`,
				maxWaitTime: `={{ (Number($('${cfg.name}').first().json.timeoutMinutes) || 20)*60 }}`,
			},
		},
		{ type: ZVID, typeVersion: 1, retryOnFail: false, onError: 'continueRegularOutput' },
	);
	code(
		'classify',
		'Classify completion failure or uncertain status',
		render.classifyJob.toString() +
			`\nconst context=$('Track the saved job and its source context').first().json;let response=$json;if(response.error){const error=typeof response.error==='string'?response.error:JSON.stringify(response.error);response={state:/did not finish within|timed? ?out/i.test(error)?'timed_out':/failed/i.test(error)?'failed':'needs_review',failedReason:error};}const result=classifyJob(context,response,Date.now(),$('${cfg.name}').first().json.timeoutMinutes);if(response.state==='timed_out')result.status='timed_out';const {payload,outcomeCheckpoint,...snapshot}=result;result.outcomeCheckpoint={...snapshot,renderOutcome:{status:result.status,reason:result.reason||null}};return [{json:result}];`,
	);
	write(
		'finish',
		'Record the render outcome and completed URL',
		'Classify completion failure or uncertain status',
		'finish',
	);
	code(
		'report',
		'Prepare the completed result and review pack',
		runtime.completedResult.toString() +
			"\nreturn [{json:completedResult($('Classify completion failure or uncertain status').first().json)}];",
	);
	code(
		'handoff',
		'Download the source-specific review pack',
		runtime.csvFile.toString() +
			`\nconst d=$json;return [{json:{renderKey:d.renderKey,status:d.status,videoUrl:d.videoUrl||null,rowCount:(d.handoff||[]).length},binary:{data:csvFile(d.handoff||[],'${kind}-review.csv')}}];`,
	);
	const gate = iff(
		'watch-ready',
		'Completed video is ready to watch?',
		"$json.status === 'completed' && !$json.dryRun && /^https:\\/\\//i.test(String($json.videoUrl || ''))",
	);
	gate.id = 'zvid-watch-ready';
	link(manual.name, [cfg.name]);
	link(schedule.name, [cfg.name]);
	if (kind === 'kpi-report-video') {
		link(cfg.name, ['Use explicitly selected sample metrics?']);
		link(
			'Use explicitly selected sample metrics?',
			['Create labeled sample metrics for testing'],
			['Require a live reporting URL before fetching'],
		);
		link('Require a live reporting URL before fetching', [source.name]);
		link(source.name, ['Choose the configured metrics input']);
		link('Create labeled sample metrics for testing', ['Choose the configured metrics input']);
		link('Choose the configured metrics input', [ledger.name]);
	} else {
		if (kind !== 'daily-weather-video') link(cfg.name, [source.name]);
		link(source.name, [ledger.name]);
	}
	link(ledger.name, [s.plan]);
	link(s.plan, ['Eligible source content or saved render exists?']);
	link(
		'Eligible source content or saved render exists?',
		['Resume the accepted render job?'],
		['Explain skipped content or recovery needs'],
	);
	link(
		'Resume the accepted render job?',
		['Restore the saved result and handoff context'],
		[designStart],
	);
	link('Restore the saved result and handoff context', [
		'Track the saved job and its source context',
	]);
	link(builder.name, ['Validate the video and request its credit quote']);
	link('Validate the video and request its credit quote', ['Enforce the per-video credit ceiling']);
	link('Enforce the per-video credit ceiling', ['Return a validation-only preview?']);
	link(
		'Return a validation-only preview?',
		['Return the source plan design quote and handoff'],
		['Reserve this render key before spending credits'],
	);
	link('Reserve this render key before spending credits', [
		'Prepare a bounded render submission attempt',
	]);
	link('Prepare a bounded render submission attempt', ['Submit this approved video to Zvid']);
	link(
		'Submit this approved video to Zvid',
		['Capture the accepted render job ID'],
		['Distinguish a capacity rejection from an uncertain submission'],
	);
	link('Distinguish a capacity rejection from an uncertain submission', [
		'Record the rejected or uncertain submission',
	]);
	link('Record the rejected or uncertain submission', [
		'Restore the submission rejection and retry timing',
	]);
	link('Restore the submission rejection and retry timing', [
		'Retry this explicit capacity rejection?',
	]);
	link(
		'Retry this explicit capacity rejection?',
		['Wait before retrying available render capacity'],
		['Report why the render submission stopped'],
	);
	link('Wait before retrying available render capacity', [
		'Prepare a bounded render submission attempt',
	]);
	link('Capture the accepted render job ID', ['Persist the accepted job for recovery']);
	link('Persist the accepted job for recovery', ['Restore the accepted render context']);
	link('Restore the accepted render context', ['Track the saved job and its source context']);
	link('Track the saved job and its source context', ['Wait for this accepted Zvid render']);
	link('Wait for this accepted Zvid render', ['Classify completion failure or uncertain status']);
	link('Classify completion failure or uncertain status', [
		'Record the render outcome and completed URL',
	]);
	link('Record the render outcome and completed URL', [
		'Prepare the completed result and review pack',
	]);
	link('Prepare the completed result and review pack', [
		gate.name,
		'Download the source-specific review pack',
	]);
	link(gate.name, [watch.name], []);
	// Optional delivery is separate from completed rendering, with no automatic send retries.
	if (kind === 'kpi-report-video' || kind === 'birthday-greetings') {
		const email = kind === 'birthday-greetings';
		const condition = email
			? `$json.status === 'completed' && $('${cfg.name}').first().json.sendEmail === true && $json.emailApproved === true && Boolean($json.email)`
			: `$json.status === 'completed' && $json.usingDemoData !== true && $('${cfg.name}').first().json.sendSlack === true && Boolean($('${cfg.name}').first().json.slackWebhookUrl)`;
		iff('deliver', 'Optional delivery is enabled and approved?', condition);
		const pending = write(
			'delivery-pending',
			'Record delivery as pending before sending',
			'Prepare the completed result and review pack',
			'delivery',
		);
		pending.parameters.columns.value.DeliveryStatus = 'sending';
		pending.parameters.columns.schema.push({
			id: 'DeliveryStatus',
			displayName: 'DeliveryStatus',
			type: 'string',
			display: true,
			canBeUsedToMatch: true,
		});
		const ref = "$('\u0050repare the completed result and review pack').first().json";
		const send = email
			? add(
					'send',
					'Send the approved private greeting email',
					'emailSend',
					{
						fromEmail: `={{ $('${cfg.name}').first().json.emailFrom }}`,
						toEmail: `={{ ${ref}.email }}`,
						subject: `={{ ${ref}.caption }}`,
						emailFormat: 'text',
						text: `={{ ${ref}.caption + '\\n\\nWe made you a video: ' + ${ref}.videoUrl }}`,
						options: {},
					},
					{ typeVersion: 2.1, onError: 'continueRegularOutput', retryOnFail: false },
				)
			: add(
					'send',
					'Post the checked KPI briefing to Slack',
					'httpRequest',
					{
						method: 'POST',
						url: `={{ $('${cfg.name}').first().json.slackWebhookUrl }}`,
						sendBody: true,
						specifyBody: 'json',
						jsonBody: `={{ JSON.stringify({text:${ref}.caption + '\\n' + ${ref}.videoUrl}) }}`,
						options: {
							timeout: 20000,
							response: {
								response: { fullResponse: true, neverError: true, responseFormat: 'text' },
							},
						},
					},
					{ typeVersion: 4.2, onError: 'continueRegularOutput', retryOnFail: false },
				);
		code(
			'delivery-result',
			'Keep the delivery acknowledgement or error',
			`const result=${ref};const response=$json;const acknowledged=${email ? 'Array.isArray(response.accepted) && response.accepted.length > 0' : 'Number(response.statusCode) === 200 && String(response.body).trim() === "ok"'};return [{json:{...result,deliveryStatus:acknowledged?'accepted':'needs_review',deliveryError:acknowledged?'':String(response.error?.message || response.error || 'No delivery acknowledgement; inspect before retrying.')}}];`,
		);
		const record = write(
			'delivery-save',
			'Record the delivery acknowledgement',
			'Keep the delivery acknowledgement or error',
			'delivery',
		);
		record.parameters.columns.value.DeliveryStatus =
			"={{ $('Keep the delivery acknowledgement or error').first().json.deliveryStatus }}";
		record.parameters.columns.schema.push({
			id: 'DeliveryStatus',
			displayName: 'DeliveryStatus',
			type: 'string',
			display: true,
			canBeUsedToMatch: true,
		});
		w.connections['Prepare the completed result and review pack'].main[0].push({
			node: 'Optional delivery is enabled and approved?',
			type: 'main',
			index: 0,
		});
		link('Optional delivery is enabled and approved?', [pending.name], []);
		link(pending.name, [send.name]);
		link(send.name, ['Keep the delivery acknowledgement or error']);
		link('Keep the delivery acknowledgement or error', [record.name]);
	}
	w.name = s.title;
	w.meta = { ...(w.meta || {}), lateSeriesReview: 1 };
	// Keep the recognized overview marker through organization.
	const marker = original.nodes.find((n) => n.id === 'publication-overview-' + kind);
	if (marker) w.nodes.push(structuredClone(marker));
	return w;
}
module.exports = { specs, buildLateSeries };
if (require.main === module) {
	for (const kind of Object.keys(specs)) {
		const file = path.join(__dirname, '../workflows/zvid-' + kind + '.json');
		const original = JSON.parse(fs.readFileSync(file, 'utf8'));
		const updated = require('./organize-workflow-series').organizeWorkflow(
			buildLateSeries(original, kind),
		).workflow;
		fs.writeFileSync(file, JSON.stringify(updated, null, 2) + '\n');
		console.log(kind + ': ' + updated.nodes.length + ' nodes');
	}
}
