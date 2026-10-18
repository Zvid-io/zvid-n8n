# Review match results and manage corrected sports videos with TheSportsDB

For sports editors managing a result from first review through corrections. Fetch a queued event directly from TheSportsDB and require approval of its exact fact snapshot. Recheck facts on each run; changed facts invalidate old approval. Compare with the latest completed video, produce an approved original or correction edition, and retain the prior result and video in a correction pack. No LLM or automatic social posting is used.

## Prerequisites
Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before configuring credentials. A workspace owner/admin may need to install it. Select a Zvid API credential on every native Zvid node, using https://app.zvid.io/api-keys and Base URL https://api.zvid.io. Connect Google Sheets OAuth2 and select the input and log tabs in all Sheets nodes. No supported Zvid operation uses HTTP Request. Watch downloads completed media only.

## Match editorial queue
Create **Match Editorial Queue** with headers:

`EventId,Enabled,Approval,ApprovedSnapshot,CurrentSnapshot,ReviewStatus,LastCheckedAt,PriorVideoUrl,ChangeSummary`

1. Enter a real numeric TheSportsDB EventId, set Enabled=yes, and leave approval fields blank. Set sportsDbKey and leagueId in configuration; leagueId may be blank to accept queued events from any league. This key is provider configuration, not a Zvid credential.
2. Run once. The least recently checked enabled event is fetched directly with lookupevent.php. Require a final status, real date, both teams and integer scores. Missing/nonfinal/conflicting results fail before changing review cells. Disable invalid queue rows while correcting their IDs so they do not block later cases.
3. Inspect ChangeSummary and CurrentSnapshot against the source. A human sets Approval=approved and copies the exact CurrentSnapshot string into ApprovedSnapshot. The workflow writes neither approval field.
4. Run again. If facts still match the approved edition, render one original or correction report. Source changes invalidate the approval, including a rollback to previously used facts: the approval snapshot includes the edition number.
5. Leave the event enabled to monitor corrections. LastCheckedAt rotates checks across enabled rows. New final facts are compared with the latest completed video; a correction includes the previous score and prior video URL in its CSV and clearly labels the video CORRECTED MATCH REPORT. Review and approve each new edition.

CurrentSnapshot is an exact JSON string, not a cryptographic signature. Restrict edit access to trusted editors; anyone with write access to the approval columns can approve. Sheets is not an atomic lock: avoid overlapping executions. TheSportsDB coverage is not guaranteed; source errors do not substitute demo matches. Date and score corrections are versioned, but this workflow does not assert independent fact verification beyond provider status and editorial review. No OpenAI or other language model is used.

The CSV is available for pending review as well as completed runs. It contains current and previous results, edition, source URL, approval snapshot and a caption draft. The workflow neither publishes nor retracts social posts. Editors must replace or correct already shared content themselves.

Source: [TheSportsDB API](https://www.thesportsdb.com/api.php).

## Costs and recovery
**dryRun=false is the default**; eligible new work spends Zvid credits after free validation and maxCreditsPerVideo enforcement. Weather caps at 35 credits; sports at 35. **dryRun=true** performs reads, planning and validation only; it writes no source or tracking cells, starts no render and resumes no paid job. Sports must have exact approval to reach validation even in preview mode. No editor project is created.

Use the separate **Sports Recaps** tab with headers:

`RenderKey,Status,JobId,CreditsQuoted,PlanJson,VideoUrl,CompletedAt`

Before a paid call, reserve submitting and a compact snapshot. Persist the accepted JobId; recovery polls it before source checks. Explicit 429 rejections are retried up to three attempts with a 30-second minimum and server Retry-After. Uncertain submissions are never retried automatically. Failed, timed-out and uncertain records need inspection; do not delete rows as a general retry strategy. Sports blocks replacement editions while the preceding edition needs inspection.

Open **Watch video → Binary → data → View** on completion. The download has a 30-second timeout and three attempts; its failure does not erase the saved video URL. CSV formula-like values are escaped. Optional music is checked before use and skipped if unavailable.

## Migration from the previous day 28 template
Revise the existing creator entry, not a second submission. Retain the same local workflow, credentials and full recovery history. Add the new input tab; do not turn old results into approved source records. Keep schedules disabled until the new inputs are configured. Old accepted jobs still resume from their saved context. Old periodic recaps remain in history; new editorial editions use a separate sports-editorial key prefix. If an older recap was published, document any needed correction manually because its batch snapshot is not an editorial event baseline.

## What changed for review
This is an editorial approval and correction lifecycle. One exact event is checked against versioned human approval and previous rendered facts; stale approvals cannot trigger replacement videos, and correction outputs preserve prior evidence. The source code and layout are generated by scripts/weather-sports-revisions.js and scripts/weather-sports-revision-runtime.js. Acceptance remains n8n’s decision.

Support: https://zvid.io/contact
