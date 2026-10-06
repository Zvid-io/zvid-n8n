# Create consent-aware birthday and anniversary greetings with annual tracking

[Import the workflow](zvid-birthday-greetings.json).

Select a due, approved celebration with greeting consent. Treat birthdays and anniversaries separately, apply an explicit leap-day policy, and reveal birthday age only when ShowAge is true. One video runs at a time; annual keys prevent duplicates and the result includes a private delivery handoff.

## Install and connect
1. Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before configuring credentials. A workspace owner/admin may need to install it.
2. Create a **Zvid API** credential with a key from https://app.zvid.io/api-keys and Base URL `https://api.zvid.io`. Select it on every Zvid node.
3. Connect Google Sheets credentials to the log nodes. Select the same document and **Celebration Runs** tab on all log reads/writes. Source rows, where used, belong to their separate existing source tab.
4. Create exact log headers: `RenderKey,Status,JobId,CreditsQuoted,PlanJson,VideoUrl,CompletedAt,DeliveryStatus`.
5. Edit **Set celebration consent and delivery rules**, configure the source below, and test manually before enabling a schedule. This template has no publishing step.

## Celebration source and consent
Connect **Read consented celebration dates** to your existing Google Sheet. This template reads a curated CRM export; it does not directly connect to a CRM service.

Required headers: `CelebrationKey,Name,Type,Date,Approval,GreetingConsent`.
Optional: `DoNotContact,Email,EmailApproval,ShowAge,Message,LastSentYear`.

Each occasion needs its own permanent unique CelebrationKey. Type is birthday or anniversary. Date is a real YYYY-MM-DD date. Approval must equal approved, GreetingConsent must be true/yes/1, and DoNotContact must not be true. Birthday age is omitted unless ShowAge is explicitly true. Anniversaries count completed years from Date and skip year zero. Message is optional reviewed copy, at most 250 characters; Name is at most 70.

leapDayPolicy is feb28 (default), march1 or skip for a February 29 date in a non-leap year. Selection uses timezone. Independent annual keys include occasion and year, so one contact's birthday cannot consume their anniversary. Legacy LastSentYear still protects previously completed rows.

One greeting is rendered per execution, with the deferred count in the report. The default schedule checks hourly from 08:00 through 18:00; align the n8n workflow timezone with timezone. Size the schedule for your volume and inspect deferred work. Original source rows are read-only; completion belongs to Celebration Runs. Resume saved jobs before selecting new paid work, even after a date rolls over.

Optional email requires sendEmail=true, a valid SMTP credential, emailFrom, Email and EmailApproval=approved. The node sends only the completed private greeting URL. Rendering is recorded separately from delivery. Sending and acknowledgement are logged; ambiguous sends require manual inspection and are not retried. Resumed jobs require manual email review because their source consent may have changed. No test run sends real email.

## Migration
Keep existing names, dates and LastSentYear. Add unique occasion keys and consent/approval columns after review. Do not infer consent or populate it automatically. Add a separate Celebration Runs log tab. The new workflow no longer marks a greeting as sent merely because rendering completed.

## Costs, previews and recovery
**dryRun=false is the default and spends Zvid credits.** Free Zvid validation quotes the actual design before the log claim or render request. maxCreditsPerVideo is 15 by default. Quotes are not actual charged credits. There is one new render per execution; set a suitable schedule and credit ceiling.

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
