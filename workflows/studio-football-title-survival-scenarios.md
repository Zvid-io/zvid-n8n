# Day 55: Calculate title and survival scenarios for the final match

Football editors must distinguish guaranteed outcomes from those depending on other results or tie-breaks.

Private scenarios video with calculated points ceilings and a result-by-result decision table.

## Business decisions

1. Read approved standings and competition rules.
2. Calculate title and survival ceilings.
3. Match the scenario commentary.

The domain calculations run on the approved request and joined records. Invalid, incomplete, stale or ineligible requests produce a review or skip reason before paid work. The attached decision report records selection, exclusions and calculations; the video is one part of the handoff. The template does not publish content, message customers, book inventory, change advertising budgets or commit a price or reservation.

## Calculated sample handoff

The included synthetic input produces the following decision. This is calculated by the same three functions embedded in the workflow.

```json
{
  "sourceCount": 1,
  "sourceUrls": [
    "https://www.tottenhamhotspur.com/the-club/history/"
  ],
  "mediaCredits": [],
  "editorialRevision": "r1",
  "family": 55,
  "points": {
    "leader": 72,
    "chaser": 70,
    "safe": 33,
    "danger": 32
  },
  "titleVerdicts": [
    "GUARANTEED",
    "TIE-BREAK POSSIBLE",
    "OTHER RESULT NEEDED"
  ],
  "survivalVerdicts": [
    "GUARANTEED",
    "OTHER RESULT NEEDED",
    "OTHER RESULT NEEDED"
  ],
  "resultGrid": [
    {
      "leaderDelta": 3,
      "chaserDelta": 3,
      "leaderPoints": 75,
      "chaserPoints": 73,
      "result": "leader ahead"
    },
    {
      "leaderDelta": 3,
      "chaserDelta": 1,
      "leaderPoints": 75,
      "chaserPoints": 71,
      "result": "leader ahead"
    },
    {
      "leaderDelta": 3,
      "chaserDelta": 0,
      "leaderPoints": 75,
      "chaserPoints": 70,
      "result": "leader ahead"
    },
    {
      "leaderDelta": 1,
      "chaserDelta": 3,
      "leaderPoints": 73,
      "chaserPoints": 73,
      "result": "tie-break required"
    },
    {
      "leaderDelta": 1,
      "chaserDelta": 1,
      "leaderPoints": 73,
      "chaserPoints": 71,
      "result": "leader ahead"
    },
    {
      "leaderDelta": 1,
      "chaserDelta": 0,
      "leaderPoints": 73,
      "chaserPoints": 70,
      "result": "leader ahead"
    },
    {
      "leaderDelta": 0,
      "chaserDelta": 3,
      "leaderPoints": 72,
      "chaserPoints": 73,
      "result": "chaser ahead"
    },
    {
      "leaderDelta": 0,
      "chaserDelta": 1,
      "leaderPoints": 72,
      "chaserPoints": 71,
      "result": "leader ahead"
    },
    {
      "leaderDelta": 0,
      "chaserDelta": 0,
      "leaderPoints": 72,
      "chaserPoints": 70,
      "result": "leader ahead"
    }
  ],
  "scope": "Two specified title contenders and one specified survival boundary pair.",
  "pointsSystem": {
    "win": 3,
    "draw": 1,
    "loss": 0
  },
  "tieBreaks": "Equal points never imply a guaranteed position.",
  "contentFingerprint": "66ce46c8aea036de8b4686b758c84bbafdeece520739e6a6f9426cc0123e8539",
  "narrationBound": true,
  "narrationSeconds": 30.288
}
```

## Supported content scope

Two named title contenders and one survival-boundary pair, with one fixture remaining and 3/1/0 scoring. It does not analyze a full league table or all possible tie-break rules.

## Setup

1. Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before configuring Zvid credentials. A workspace owner/admin may need to install it.
2. Create a **Zvid API** credential with a key from https://app.zvid.io/api-keys and Base URL `https://api.zvid.io`. Assign it to **Validate project (free)**, **Submit render once** and **Wait for completed render**.
3. Connect Google Sheets and Google Drive OAuth2 with access to your source workbook and private delivery folder. Import `zvid-studio-football-title-survival-scenarios.json`, then fill the workbook, tab and folder IDs in **Config**.
4. Create `D55Requests` and `D55Records`. Use `studio-series/samples/day-55.json` for the synthetic sample and exact record shapes.
5. Run manually, inspect the decision report and **Watch video → Binary → data → View**, then enable the schedule when ready. The exported workflow is inactive.

## Input contract

Requests has one row per business brief: `source_id,revision,approval,brief_json`. Add these output columns: `automation_status,request_key,input_hash,job_id,video_url,drive_file_id,drive_url,completed_at,outcome_summary,automation_error`.

`source_id` is unique within the sheet. Use immutable letters, digits, dashes or underscores for IDs and revisions. Set `approval` to `approved` only after checking the brief. `brief_json` contains the request object below, encoded as JSON in one cell. Any IDs, revisions or approval inside that object must agree with the sheet envelope.

Records has `parent_id,revision,kind,record_id,data_json`. Parent ID and revision join the corresponding request; record IDs must be unique within it. `data_json` holds the domain fields of each record. All source values must be typed correctly in JSON: use booleans and numbers rather than strings where shown. Dates and currency belong to the source, and must be current for the intended campaign.

Request fields:

```json
[
  "source_id",
  "revision",
  "approval",
  "status",
  "updated_at",
  "source_url",
  "publish_at",
  "expires_at",
  "approved_script",
  "league",
  "rules"
]
```

Record fields:

```json
[
  "parent_id",
  "revision",
  "record_id",
  "kind",
  "position",
  "approval",
  "claim",
  "url",
  "rights",
  "variable",
  "content_fingerprint",
  "script",
  "seconds",
  "cues_verified",
  "role",
  "club",
  "points",
  "remaining"
]
```

## Design and audio

The full approved design is embedded in **Join approved request data**, so importing this workflow does not require access to someone else's saved Zvid template. Domain values are mapped into the design; music, typography and layout are preserved. Use owned or appropriately licensed media. The supplied sample links illustrate the intended design and should be replaced with your approved assets for production.

Narration is bound to the exact calculated content, script and scene timing. Changed facts or geometry require a newly approved matching recording and content fingerprint. A mismatch returns a script review artifact rather than reusing speech that says something different. Some educational designs intentionally support a specific diagram family; unsupported concepts require a new design. The cues_verified flag records a human review of spoken timing against the visuals; it does not perform speech recognition or automatic audio alignment. Review both listening plays and the delayed answer reveal when approving a replacement recording. Speech generation is not included.

## Cost and recovery

```json
{
  "spreadsheetId": "",
  "sourceSheet": "D55Requests",
  "detailsSheet": "D55Records",
  "driveFolderId": "",
  "dryRun": false,
  "maxRenderCredits": 100,
  "pollSeconds": 10,
  "maxWaitSeconds": 900,
  "maxSourceRows": 100,
  "designRevision": "4fa30dc1eea128d540b61e7b3b052b60b4769ba5abe83243e01db1db425b9e00"
}
```

**dryRun: false** renders and spends Zvid credits. Free validation checks the project and returns a quote; an absent, invalid or over-cap quote stops before submission. The quote is not proof of actual billed credits. **dryRun: true** returns resolved project JSON and a quote, or inspects an existing saved request. It does not render, resume paid jobs, upload media or write source tracking cells; the local ledger table may be initialized. It does not create an editor draft.

One approved request is processed per run. The source is bounded to 100 request rows, 5,000 related rows and 2,000 ledger rows. Archive completed source/ledger data deliberately as it grows. Run each workflow serially: the Data Table and Sheets are recovery records, not an atomic distributed lock. Do not overlap manual and scheduled executions of the same workflow.

Before paid submission, the workflow saves the frozen source, decision, full resolved design and `submitting` status. It saves the accepted job ID immediately afterward. Reruns poll that same job or resume delivery. An uncertain submission is never automatically resubmitted; reconcile it in https://app.zvid.io and retain its accepted ID. A failed or timed-out accepted job remains available for inspection. An explicit structured HTTP 429 rejection is saved as rejected with its attempt count and retryAfter. It may be retried only manually after at least 30 seconds, respecting a longer Retry-After when supplied. At most two manual reattempts are allowed after the first rejection. Scheduled runs and unknown or text-only errors cannot unlock another paid submission. The failure report preserves the required recovery action.

Changed content under the same revision is rejected. An unfinished earlier revision must be reconciled before a new revision can run. A completed matching revision is skipped. Before source writeback, approval, revision and content are checked again; an uploaded asset is retained if the source changed.

## Outputs and boundaries

The completed MP4 is uploaded to the configured private Drive folder without sharing it. Deterministic filenames and a content hash check prevent blind duplicate upload after a partial failure. The source receipt is read back before delivery is marked complete. The final output contains `jobId,videoUrl,driveFileId,driveUrl,quotedCredits,decisionReport`. **Decision report file** makes the JSON report downloadable; **No work report** provides review artifacts when no render is due.

**Watch video** is a gated media GET using HTTP Request v2 with a 30-second timeout and at most three attempts five seconds apart. A preview failure preserves the completed URL. Every supported Zvid operation uses the native community node; HTTP nodes only download completed media.

This is a reviewable template draft. Local tests use synthetic business data; passing them does not certify production records, external media longevity or n8n publishing acceptance. Support: https://zvid.io/contact
