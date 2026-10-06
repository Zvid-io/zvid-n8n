# Build verified league or club recaps with a final-score fact sheet

[Import the workflow](zvid-sports-recap-video.json).

Read recent events from TheSportsDB. Keep verified final matches in the requested league and completed date window, reject conflicting scores, and optionally focus on one club. Rank scorelines, calculate returned-match totals and club form, and create a deterministic recap with a fact sheet.

## Install and connect
1. Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before configuring credentials. A workspace owner/admin may need to install it.
2. Create a **Zvid API** credential with a key from https://app.zvid.io/api-keys and Base URL `https://api.zvid.io`. Select it on every Zvid node.
3. Connect Google Sheets credentials to the log nodes. Select the same document and **Sports Recaps** tab on all log reads/writes. Source rows, where used, belong to their separate existing source tab.
4. Create exact log headers: `RenderKey,Status,JobId,CreditsQuoted,PlanJson,VideoUrl,CompletedAt`.
5. Edit **Set the league club and completed recap period**, configure the source below, and test manually before enabling a schedule. This template has no publishing step.

## Verified source selection
Set sportsDbKey and leagueId. Optional focusTeam must match a source team name, case-insensitively. By default the recap covers the seven completed days ending yesterday in timezone. Optional periodStart and periodEnd must be real YYYY-MM-DD dates in the past.

TheSportsDB's recent-league endpoint is a bounded feed, not an exhaustive season query. Your key and subscription affect available coverage. The workflow describes the returned verified matches and never claims that the feed contains every league result. Source: [TheSportsDB documentation](https://www.thesportsdb.com/docs_api_guide).

Only matching league events with FT, AET or Match Finished status and non-negative integer scores are eligible. Live, postponed and unverified statuses are skipped. Duplicate event IDs are collapsed only when their details agree; conflicting scores stop for review. No old demo matchday is rendered when the feed is unavailable or empty.

Rank matches by goal margin, then total goals, date and stable event ID. The first maxMatches (1–5) appear in the video; every eligible match appears in the fact CSV. Totals cover all eligible returned matches. Club mode adds wins/draws/losses and goals for/against. Copy is deterministic and cannot invent players, incidents, goal times or league standings. Shootout-specific results are excluded unless represented with a supported final status and unambiguous final scores.

When no final fits the default week, allowLatestAvailableResults=true may use a seven-day window ending at the latest returned final, only within maxFallbackAgeDays (default 30, allowed 1–90). The video says Latest available results and shows that actual period. This mode never overrides explicit periodStart/periodEnd, includes future matches, or fabricates scores. The returned report retains requestedPeriod and latestAvailableDate. The free recent-league feed is limited to one event, so use a suitable subscription for wider coverage.

Set recapRevision to a new value only for an intentional replacement. Use an authenticated source subscription suitable for your coverage requirements.

## Migration
Keep league ID and branding, add a Sports Recaps log tab, and choose the completed date window. The OpenRouter copy-writing node has been removed; its credential is no longer required.

## Costs, previews and recovery
**dryRun=false is the default and spends Zvid credits.** Free Zvid validation quotes the actual design before the log claim or render request. maxCreditsPerVideo is 35 by default. Quotes are not actual charged credits. There is one new render per execution; set a suitable schedule and credit ceiling.

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
