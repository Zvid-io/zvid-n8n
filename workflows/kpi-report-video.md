# Turn verified KPI snapshots into an exception briefing and action register

[Import the workflow](zvid-kpi-report-video.json).

Check the reporting snapshot is fresh and its period is complete. Calculate changes from actual current and previous values, identify target misses and adverse movements, prioritize the five most important metrics in the video, and return a full owner action register.

## Install and connect
1. Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before configuring credentials. A workspace owner/admin may need to install it.
2. Create a **Zvid API** credential with a key from https://app.zvid.io/api-keys and Base URL `https://api.zvid.io`. Select it on every Zvid node.
3. Connect Google Sheets credentials to the log nodes. Select the same document and **KPI Reports** tab on all log reads/writes. Source rows, where used, belong to their separate existing source tab.
4. Create exact log headers: `RenderKey,Status,JobId,CreditsQuoted,PlanJson,VideoUrl,CompletedAt,DeliveryStatus`.
5. Edit **Set reporting period and exception thresholds**, configure the source below, and test manually before enabling a schedule. This template has no publishing step.

## Reporting source contract
metricsSource defaults to live. Set metricsUrl to an HTTPS endpoint from your reporting system. Missing setup produces an explicit setup error before any network call. Add authentication directly to the HTTP Request node when required; do not embed secrets in the URL. The endpoint must return HTTP 200 with this shape:

```json
{"company":"Example","periodStart":"2026-09-21","periodEnd":"2026-09-27","generatedAt":"2026-10-04T08:00:00Z","metrics":[{"id":"revenue","label":"Revenue","value":80,"previous":100,"unit":"$","lowerIsBetter":false,"target":110,"owner":"Finance","action":"Review the revenue report","history":[110,100,80]}]}
```

Use real current dates when testing. generatedAt is when your source generated the snapshot; the reporting period must end before today in timezone. maxDataAgeHours defaults to 36. Values must be numeric, lowerIsBetter must be a boolean, and IDs must be unique. Optional history must contain at least two numeric points and end at value.

Changes are calculated as (value - previous) / abs(previous), expressed as a percentage. A zero previous value produces N/A, never infinity or a fabricated percentage. A metric needs review when it misses its supplied target or worsens by at least alertPercent (default 10). Per-metric alertPercent can override this. Missing owners are explicitly Unassigned; action copy comes from the source rather than being invented.

The five most important metrics appear in the video, ordered by review status, target miss and change magnitude. Every metric appears in the action CSV. onlyExceptions=true produces no video when nothing requires attention. This version uses deterministic numbers and copy, replacing the optional AI writer with narration derived from the checked values. Optional narrate=true retains ElevenLabs voiceover and aligned captions; connect Header Auth with name xi-api-key on Generate voiceover, and the Zvid API credential on Upload voiceover. Multipart upload uses HTTP because the published Zvid node does not expose uploads. Voice synthesis may charge before the Zvid credit quote, including during dry runs. No demo data is substituted on source failure.

Optional Slack delivery requires sendSlack=true and slackWebhookUrl. It is off by default and only runs after completion. Inspect DeliveryStatus when a delivery is uncertain; completed reports do not resend automatically.

## Explicit sample mode
Set metricsSource=sample to run built-in example metrics without a reporting endpoint. This is an explicit choice, never a fallback after live-source failure. Sample company, title, caption and CSV say SAMPLE DATA; recovery keys use a separate kpi-sample prefix, and Slack delivery is blocked. The sample dates cover the seven completed days ending yesterday. dryRun=false still renders and spends credits; narration can also charge when enabled. Switch back to live and configure metricsUrl for real reports.

## Migration
Replace the old delta-only endpoint contract with previous, generatedAt and explicit period dates. Add a KPI Reports log tab. The optional voice chain remains available; OpenRouter is no longer required.

## Costs, previews and recovery
**dryRun=false is the default and spends Zvid credits.** Free Zvid validation quotes the actual design before the log claim or render request. Optional voice synthesis can charge before validation. maxCreditsPerVideo is 65 by default. Quotes are not actual charged credits. There is one new render per execution; set a suitable schedule and credit ceiling.

**dryRun=true** returns the source plan, design JSON, review rows and quote. It writes no log rows, creates no editor draft, sends no messages, and skips existing paid jobs. Optional voice synthesis still runs when narrate=true and can charge. The published Zvid package checked for this revision is 0.1.8; only its supported render validate/create/get operations are used.

Before submission, save submitting and a compact original review snapshot. Save the accepted job ID immediately afterward, then poll that job through the native Zvid node. Completed keys are skipped. Saved rendering jobs resume without a second paid request, preserving the original review context. The snapshot excludes the render payload and large raw forecasts because Sheets cells have a size limit; recovery polls the existing job and does not rebuild or resubmit it.

Explicit HTTP 429 capacity rejections are recorded as rate_limited and retried up to three submission attempts, with at least 30 seconds between attempts and respect for a longer server Retry-After delay. An exhausted rejected key can be retried on a later run because no job was accepted. Voice generation and design are not repeated within this retry loop.

Keep submitting, failed, timed_out and needs_review records for inspection at https://app.zvid.io. An uncertain paid request is never automatically retried. A failure after acceptance but before saving its ID needs manual reconciliation. Do not clear log rows as a general retry strategy. Only reset a specific inspected record for an intentional new render. A failed accepted render now stops with its actual error after saving the outcome; it does not misleadingly finish successfully at the Watch gate.

Run one execution at a time. A Sheets log is not an atomic lock; concurrent runs can both observe an unused key. Preserve log history during upgrades. Source and HTTP errors stop or report no work; no invented content is used to keep a schedule running.

Optional musicUrl is checked before use; an unavailable or oversized track is omitted.

Open **Watch video → Binary → data → View** for a completed MP4. Downloads use a 30-second timeout and at most three attempts, five seconds apart. A failed download leaves the saved URL available. **Download the source-specific review pack → Binary → data** contains a CSV with formula-like cells escaped. Check its facts before sharing.

## Verification
The automated checks exercise the actual exported graph with external service boundaries replaced by fixtures: normal rendering, preview, duplicate runs, accepted-job recovery, credit limits and failed/timed-out jobs. Local n8n execution and free validation evidence are recorded separately in the revision report; fixture success does not prove live credentials or source permissions.

Support: https://zvid.io/contact
