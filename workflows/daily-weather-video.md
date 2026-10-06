# Create a local forecast with a ranked daytime planning window

[Import the workflow](zvid-daily-weather-video.json).

Resolve one city, validate fresh current and hourly data, and rank remaining three-hour daytime windows by rain probability and wind. Branch to a qualifying window or a no-window notice, then add that planning card to the local forecast and three-day outlook.

## Install and connect
1. Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before configuring credentials. A workspace owner/admin may need to install it.
2. Create a **Zvid API** credential with a key from https://app.zvid.io/api-keys and Base URL `https://api.zvid.io`. Select it on every Zvid node.
3. Connect Google Sheets credentials to the log nodes. Select the same document and **Weather Briefings** tab on all log reads/writes. Source rows, where used, belong to their separate existing source tab.
4. Create exact log headers: `RenderKey,Status,JobId,CreditsQuoted,PlanJson,VideoUrl,CompletedAt`.
5. Edit **Set the city and outdoor planning thresholds**, configure the source below, and test manually before enabling a schedule. This template has no publishing step.

## Location and planning rules
Set cityName, countryCode and admin1 so exactly one of the geocoder's returned candidates matches. The workflow refuses an ambiguous match. Default location is Lisbon, Portugal. All forecast and planning labels use the selected location's timezone.

The Open-Meteo request retrieves current conditions, four daily forecasts and hourly precipitation probability, wind speed and weather code. Current data must be within three hours and belong to the expected local day; missing numeric readings stop before rendering.

Only future daytime hours from 06:00 through 20:00 are considered. A candidate window contains three contiguous hourly entries. All three must meet maxRainProbability (default 30%) and maxWindKmh (default 25), with freezing precipitation, snow and thunderstorm codes excluded. Wind units are converted to km/h before comparison. Rank qualifying windows by maximum rain probability, then wind, then earliest start. If no window qualifies, show a clear no-window card instead of inventing a recommendation. If no daytime forecast remains, return a no-work report.

The video includes current conditions, the three-day outlook and a planning card. The CSV contains the evaluated hours and thresholds. These are configurable planning criteria, not official weather alerts or a guarantee of safe conditions. Check local advisories when planning activities.

Forecast source and attribution: [Open-Meteo](https://open-meteo.com/en/docs). Verify the provider's terms for your usage. Set forecastRevision deliberately when replacing the day's briefing.

## Migration
Keep location, branding and temperature/wind units. Add countryCode/admin1 and a Weather Briefings log tab. The new daily key prevents repeated completed videos.

## Costs, previews and recovery
**dryRun=false is the default and spends Zvid credits.** Free Zvid validation quotes the actual design before the log claim or render request. maxCreditsPerVideo is 25 by default. Quotes are not actual charged credits. There is one new render per execution; set a suitable schedule and credit ceiling.

**dryRun=true** returns the source plan, design JSON, review rows and quote. It writes no log rows, creates no editor draft, sends no messages, and skips existing paid jobs. The published Zvid package checked for this revision is 0.1.8; only its supported render validate/create/get operations are used.

Before submission, save submitting and a compact original review snapshot. Save the accepted job ID immediately afterward, then poll that job through the native Zvid node. Completed keys are skipped. Saved rendering jobs resume without a second paid request, preserving the original review context. The snapshot excludes the render payload and large raw forecasts because Sheets cells have a size limit; recovery polls the existing job and does not rebuild or resubmit it.

Explicit HTTP 429 capacity rejections are recorded as rate_limited and retried up to three submission attempts, with at least 30 seconds between attempts and respect for a longer server Retry-After delay. An exhausted rejected key can be retried on a later run because no job was accepted. Voice generation and design are not repeated within this retry loop.

Keep submitting, failed, timed_out and needs_review records for inspection at https://app.zvid.io. An uncertain paid request is never automatically retried. A failure after acceptance but before saving its ID needs manual reconciliation. Do not clear log rows as a general retry strategy. Only reset a specific inspected record for an intentional new render. A failed accepted render now stops with its actual error after saving the outcome; it does not misleadingly finish successfully at the Watch gate.

Run one execution at a time. A Sheets log is not an atomic lock; concurrent runs can both observe an unused key. Preserve log history during upgrades. Source and HTTP errors stop or report no work; no invented content is used to keep a schedule running.

Optional musicUrl is checked before use; an unavailable or oversized track is omitted.

Open **Watch video → Binary → data → View** for a completed MP4. Downloads use a 30-second timeout and at most three attempts, five seconds apart. A failed download leaves the saved URL available. **Download the source-specific review pack → Binary → data** contains a CSV with formula-like cells escaped. Check its facts before sharing.

## Verification
The automated checks exercise the actual exported graph with external service boundaries replaced by fixtures: normal rendering, preview, duplicate runs, accepted-job recovery, credit limits and failed/timed-out jobs. Local n8n execution and free validation evidence are recorded separately in the revision report; fixture success does not prove live credentials or source permissions.

Support: https://zvid.io/contact
