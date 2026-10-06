'use strict';
const fs = require('node:fs'),
	path = require('node:path'),
	{ specs } = require('./build-late-series');
const detail = {
	'quiz-shorts': `## Question bank
Connect **Read the approved question bank** to your existing question sheet. Use these headers; QuestionKey is recommended, while the remaining fields are required for unused questions:

\`QuestionKey,Question,OptionA,OptionB,OptionC,CorrectLetter,FunFact,Topic,Difficulty,SourceUrl,Approval\`

Use a unique permanent QuestionKey when available. Blank keys receive a stable identity derived from the question text, so old sheets no longer fail merely because that column is missing. Approval and the source metadata remain required for unused questions. Use Difficulty equal to easy/medium/hard, and Approval=approved after checking the answer and source. SourceUrl must be HTTPS. Questions are at most 130 characters, each distinct option at most 40, and FunFact 1–200 characters. CorrectLetter is A/B/C. Legacy Status or VideoUrl values continue to exclude used questions.

An episode contains exactly three questions, one at each difficulty. If a difficulty is missing, no partial episode renders. Within each difficulty, unused topics are preferred, then less-used topics from the last rotationEpisodes completed episodes. Optional topic restricts the pool. Answer positions rotate reproducibly; CorrectLetter is remapped to preserve the actual answer. Duplicate question text is rejected, and history prevents using the same question under another key.

The video retains the question, countdown and answer-reveal design for each round. The review CSV includes the question, difficulty, answer, explanation and source. Set episodeRevision to a new value only for an intentional second episode on the same local date. Completed episodes retain their question history.

## Migration
Keep your original rows and completion markers. Add stable QuestionKey, Topic, Difficulty, SourceUrl and Approval columns; do not automatically mark unreviewed questions approved. Add a separate Quiz Episodes tab. The new workflow records one episode there and leaves the source question bank unchanged.`,
	'kpi-report-video': `## Reporting source contract
metricsSource defaults to live. Set metricsUrl to an HTTPS endpoint from your reporting system. Missing setup produces an explicit setup error before any network call. Add authentication directly to the HTTP Request node when required; do not embed secrets in the URL. The endpoint must return HTTP 200 with this shape:

\`\`\`json
{"company":"Example","periodStart":"2026-09-21","periodEnd":"2026-09-27","generatedAt":"2026-10-04T08:00:00Z","metrics":[{"id":"revenue","label":"Revenue","value":80,"previous":100,"unit":"$","lowerIsBetter":false,"target":110,"owner":"Finance","action":"Review the revenue report","history":[110,100,80]}]}
\`\`\`

Use real current dates when testing. generatedAt is when your source generated the snapshot; the reporting period must end before today in timezone. maxDataAgeHours defaults to 36. Values must be numeric, lowerIsBetter must be a boolean, and IDs must be unique. Optional history must contain at least two numeric points and end at value.

Changes are calculated as (value - previous) / abs(previous), expressed as a percentage. A zero previous value produces N/A, never infinity or a fabricated percentage. A metric needs review when it misses its supplied target or worsens by at least alertPercent (default 10). Per-metric alertPercent can override this. Missing owners are explicitly Unassigned; action copy comes from the source rather than being invented.

The five most important metrics appear in the video, ordered by review status, target miss and change magnitude. Every metric appears in the action CSV. onlyExceptions=true produces no video when nothing requires attention. This version uses deterministic numbers and copy, replacing the optional AI writer with narration derived from the checked values. Optional narrate=true retains ElevenLabs voiceover and aligned captions; connect Header Auth with name xi-api-key on Generate voiceover, and the Zvid API credential on Upload voiceover. Multipart upload uses HTTP because the published Zvid node does not expose uploads. Voice synthesis may charge before the Zvid credit quote, including during dry runs. No demo data is substituted on source failure.

Optional Slack delivery requires sendSlack=true and slackWebhookUrl. It is off by default and only runs after completion. Inspect DeliveryStatus when a delivery is uncertain; completed reports do not resend automatically.

## Explicit sample mode
Set metricsSource=sample to run built-in example metrics without a reporting endpoint. This is an explicit choice, never a fallback after live-source failure. Sample company, title, caption and CSV say SAMPLE DATA; recovery keys use a separate kpi-sample prefix, and Slack delivery is blocked. The sample dates cover the seven completed days ending yesterday. dryRun=false still renders and spends credits; narration can also charge when enabled. Switch back to live and configure metricsUrl for real reports.

## Migration
Replace the old delta-only endpoint contract with previous, generatedAt and explicit period dates. Add a KPI Reports log tab. The optional voice chain remains available; OpenRouter is no longer required.`,
	'daily-weather-video': `## Location and planning rules
Set cityName, countryCode and admin1 so exactly one of the geocoder's returned candidates matches. The workflow refuses an ambiguous match. Default location is Lisbon, Portugal. All forecast and planning labels use the selected location's timezone.

The Open-Meteo request retrieves current conditions, four daily forecasts and hourly precipitation probability, wind speed and weather code. Current data must be within three hours and belong to the expected local day; missing numeric readings stop before rendering.

Only future daytime hours from 06:00 through 20:00 are considered. A candidate window contains three contiguous hourly entries. All three must meet maxRainProbability (default 30%) and maxWindKmh (default 25), with freezing precipitation, snow and thunderstorm codes excluded. Wind units are converted to km/h before comparison. Rank qualifying windows by maximum rain probability, then wind, then earliest start. If no window qualifies, show a clear no-window card instead of inventing a recommendation. If no daytime forecast remains, return a no-work report.

The video includes current conditions, the three-day outlook and a planning card. The CSV contains the evaluated hours and thresholds. These are configurable planning criteria, not official weather alerts or a guarantee of safe conditions. Check local advisories when planning activities.

Forecast source and attribution: [Open-Meteo](https://open-meteo.com/en/docs). Verify the provider's terms for your usage. Set forecastRevision deliberately when replacing the day's briefing.

## Migration
Keep location, branding and temperature/wind units. Add countryCode/admin1 and a Weather Briefings log tab. The new daily key prevents repeated completed videos.`,
	'sports-recap-video': `## Verified source selection
Set sportsDbKey and leagueId. Optional focusTeam must match a source team name, case-insensitively. By default the recap covers the seven completed days ending yesterday in timezone. Optional periodStart and periodEnd must be real YYYY-MM-DD dates in the past.

TheSportsDB's recent-league endpoint is a bounded feed, not an exhaustive season query. Your key and subscription affect available coverage. The workflow describes the returned verified matches and never claims that the feed contains every league result. Source: [TheSportsDB documentation](https://www.thesportsdb.com/docs_api_guide).

Only matching league events with FT, AET or Match Finished status and non-negative integer scores are eligible. Live, postponed and unverified statuses are skipped. Duplicate event IDs are collapsed only when their details agree; conflicting scores stop for review. No old demo matchday is rendered when the feed is unavailable or empty.

Rank matches by goal margin, then total goals, date and stable event ID. The first maxMatches (1–5) appear in the video; every eligible match appears in the fact CSV. Totals cover all eligible returned matches. Club mode adds wins/draws/losses and goals for/against. Copy is deterministic and cannot invent players, incidents, goal times or league standings. Shootout-specific results are excluded unless represented with a supported final status and unambiguous final scores.

When no final fits the default week, allowLatestAvailableResults=true may use a seven-day window ending at the latest returned final, only within maxFallbackAgeDays (default 30, allowed 1–90). The video says Latest available results and shows that actual period. This mode never overrides explicit periodStart/periodEnd, includes future matches, or fabricates scores. The returned report retains requestedPeriod and latestAvailableDate. The free recent-league feed is limited to one event, so use a suitable subscription for wider coverage.

Set recapRevision to a new value only for an intentional replacement. Use an authenticated source subscription suitable for your coverage requirements.

## Migration
Keep league ID and branding, add a Sports Recaps log tab, and choose the completed date window. The OpenRouter copy-writing node has been removed; its credential is no longer required.`,
	'birthday-greetings': `## Celebration source and consent
Connect **Read consented celebration dates** to your existing Google Sheet. This template reads a curated CRM export; it does not directly connect to a CRM service.

Required headers: \`CelebrationKey,Name,Type,Date,Approval,GreetingConsent\`.
Optional: \`DoNotContact,Email,EmailApproval,ShowAge,Message,LastSentYear\`.

Each occasion needs its own permanent unique CelebrationKey. Type is birthday or anniversary. Date is a real YYYY-MM-DD date. Approval must equal approved, GreetingConsent must be true/yes/1, and DoNotContact must not be true. Birthday age is omitted unless ShowAge is explicitly true. Anniversaries count completed years from Date and skip year zero. Message is optional reviewed copy, at most 250 characters; Name is at most 70.

leapDayPolicy is feb28 (default), march1 or skip for a February 29 date in a non-leap year. Selection uses timezone. Independent annual keys include occasion and year, so one contact's birthday cannot consume their anniversary. Legacy LastSentYear still protects previously completed rows.

One greeting is rendered per execution, with the deferred count in the report. The default schedule checks hourly from 08:00 through 18:00; align the n8n workflow timezone with timezone. Size the schedule for your volume and inspect deferred work. Original source rows are read-only; completion belongs to Celebration Runs. Resume saved jobs before selecting new paid work, even after a date rolls over.

Optional email requires sendEmail=true, a valid SMTP credential, emailFrom, Email and EmailApproval=approved. The node sends only the completed private greeting URL. Rendering is recorded separately from delivery. Sending and acknowledgement are logged; ambiguous sends require manual inspection and are not retried. Resumed jobs require manual email review because their source consent may have changed. No test run sends real email.

## Migration
Keep existing names, dates and LastSentYear. Add unique occasion keys and consent/approval columns after review. Do not infer consent or populate it automatically. Add a separate Celebration Runs log tab. The new workflow no longer marks a greeting as sent merely because rendering completed.`,
};
function guide(kind) {
	const s = specs[kind];
	return `# ${s.title}

[Import the workflow](zvid-${kind}.json).

${s.purpose}

## Install and connect
1. Install **\`@zvid/n8n-nodes-zvid\`** from **Settings → Community nodes** before configuring credentials. A workspace owner/admin may need to install it.
2. Create a **Zvid API** credential with a key from https://app.zvid.io/api-keys and Base URL \`https://api.zvid.io\`. Select it on every Zvid node.
3. Connect Google Sheets credentials to the log nodes. Select the same document and **${s.log}** tab on all log reads/writes. Source rows, where used, belong to their separate existing source tab.
4. Create exact log headers: \`RenderKey,Status,JobId,CreditsQuoted,PlanJson,VideoUrl,CompletedAt${['kpi-report-video', 'birthday-greetings'].includes(kind) ? ',DeliveryStatus' : ''}\`.
5. Edit **${s.config}**, configure the source below, and test manually before enabling a schedule. This template has no publishing step.

${detail[kind]}

## Costs, previews and recovery
**dryRun=false is the default and spends Zvid credits.** Free Zvid validation quotes the actual design before the log claim or render request.${kind === 'kpi-report-video' ? ' Optional voice synthesis can charge before validation.' : ''} maxCreditsPerVideo is ${s.defaults.maxCreditsPerVideo} by default. Quotes are not actual charged credits. There is one new render per execution; set a suitable schedule and credit ceiling.

**dryRun=true** returns the source plan, design JSON, review rows and quote. It writes no log rows, creates no editor draft, sends no messages, and skips existing paid jobs.${kind === 'kpi-report-video' ? ' Optional voice synthesis still runs when narrate=true and can charge.' : ''} The published Zvid package checked for this revision is 0.1.8; only its supported render validate/create/get operations are used.

Before submission, save submitting and a compact original review snapshot. Save the accepted job ID immediately afterward, then poll that job through the native Zvid node. Completed keys are skipped. Saved rendering jobs resume without a second paid request, preserving the original review context. The snapshot excludes the render payload and large raw forecasts because Sheets cells have a size limit; recovery polls the existing job and does not rebuild or resubmit it.

Explicit HTTP 429 capacity rejections are recorded as rate_limited and retried up to three submission attempts, with at least 30 seconds between attempts and respect for a longer server Retry-After delay. An exhausted rejected key can be retried on a later run because no job was accepted. Voice generation and design are not repeated within this retry loop.

Keep submitting, failed, timed_out and needs_review records for inspection at https://app.zvid.io. An uncertain paid request is never automatically retried. A failure after acceptance but before saving its ID needs manual reconciliation. Do not clear log rows as a general retry strategy. Only reset a specific inspected record for an intentional new render. A failed accepted render now stops with its actual error after saving the outcome; it does not misleadingly finish successfully at the Watch gate.

Run one execution at a time. A Sheets log is not an atomic lock; concurrent runs can both observe an unused key. Preserve log history during upgrades. Source and HTTP errors stop or report no work; no invented content is used to keep a schedule running.

Optional musicUrl is checked before use; an unavailable or oversized track is omitted.

Open **Watch video → Binary → data → View** for a completed MP4. Downloads use a 30-second timeout and at most three attempts, five seconds apart. A failed download leaves the saved URL available. **Download the source-specific review pack → Binary → data** contains a CSV with formula-like cells escaped. Check its facts before sharing.

## Verification
The automated checks exercise the actual exported graph with external service boundaries replaced by fixtures: normal rendering, preview, duplicate runs, accepted-job recovery, credit limits and failed/timed-out jobs. Local n8n execution and free validation evidence are recorded separately in the revision report; fixture success does not prove live credentials or source permissions.

Support: https://zvid.io/contact
`;
}
if (require.main === module)
	for (const kind of Object.keys(specs))
		fs.writeFileSync(path.join(__dirname, '../workflows/' + kind + '.md'), guide(kind));
module.exports = { guide };
