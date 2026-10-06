# Create balanced quiz episodes with an answer and source pack

[Import the workflow](zvid-quiz-shorts.json).

Select one approved easy, medium and hard question. Rotate topics using episode history, exclude used question keys and repeated text, and rotate answer positions without changing the correct answer. Produce one three-round video and a source-backed answer pack.

## Install and connect
1. Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before configuring credentials. A workspace owner/admin may need to install it.
2. Create a **Zvid API** credential with a key from https://app.zvid.io/api-keys and Base URL `https://api.zvid.io`. Select it on every Zvid node.
3. Connect Google Sheets credentials to the log nodes. Select the same document and **Quiz Episodes** tab on all log reads/writes. Source rows, where used, belong to their separate existing source tab.
4. Create exact log headers: `RenderKey,Status,JobId,CreditsQuoted,PlanJson,VideoUrl,CompletedAt`.
5. Edit **Set quiz episode and rotation rules**, configure the source below, and test manually before enabling a schedule. This template has no publishing step.

## Question bank
Connect **Read the approved question bank** to your existing question sheet. Use these headers; QuestionKey is recommended, while the remaining fields are required for unused questions:

`QuestionKey,Question,OptionA,OptionB,OptionC,CorrectLetter,FunFact,Topic,Difficulty,SourceUrl,Approval`

Use a unique permanent QuestionKey when available. Blank keys receive a stable identity derived from the question text, so old sheets no longer fail merely because that column is missing. Approval and the source metadata remain required for unused questions. Use Difficulty equal to easy/medium/hard, and Approval=approved after checking the answer and source. SourceUrl must be HTTPS. Questions are at most 130 characters, each distinct option at most 40, and FunFact 1–200 characters. CorrectLetter is A/B/C. Legacy Status or VideoUrl values continue to exclude used questions.

An episode contains exactly three questions, one at each difficulty. If a difficulty is missing, no partial episode renders. Within each difficulty, unused topics are preferred, then less-used topics from the last rotationEpisodes completed episodes. Optional topic restricts the pool. Answer positions rotate reproducibly; CorrectLetter is remapped to preserve the actual answer. Duplicate question text is rejected, and history prevents using the same question under another key.

The video retains the question, countdown and answer-reveal design for each round. The review CSV includes the question, difficulty, answer, explanation and source. Set episodeRevision to a new value only for an intentional second episode on the same local date. Completed episodes retain their question history.

## Migration
Keep your original rows and completion markers. Add stable QuestionKey, Topic, Difficulty, SourceUrl and Approval columns; do not automatically mark unreviewed questions approved. Add a separate Quiz Episodes tab. The new workflow records one episode there and leaves the source question bank unchanged.

## Costs, previews and recovery
**dryRun=false is the default and spends Zvid credits.** Free Zvid validation quotes the actual design before the log claim or render request. maxCreditsPerVideo is 60 by default. Quotes are not actual charged credits. There is one new render per execution; set a suitable schedule and credit ceiling.

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
