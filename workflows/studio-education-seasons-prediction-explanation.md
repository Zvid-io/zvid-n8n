# Day 59: Respond to learner predictions with an Earth seasons lesson

Science teachers need to address real learner predictions and demonstrate sunlight angle and day length without reinforcing a distance misconception.

Private seasons explanation and a prediction-analysis report based on aggregated learner responses.

## Business decisions

1. Check scientific sources and prediction counts.
2. Choose the teaching focus from learner evidence.
3. Protect the corrected seasons narration.

The domain calculations run on the approved request and joined records. Invalid, incomplete, stale or ineligible requests produce a review or skip reason before paid work. The attached decision report records selection, exclusions and calculations; the video is one part of the handoff. The template does not publish content, message customers, book inventory, change advertising budgets or commit a price or reservation.

## Calculated sample handoff

The included synthetic input produces the following decision. This is calculated by the same three functions embedded in the workflow.

```json
{
  "sourceCount": 1,
  "sourceUrls": [
    "https://spaceplace.nasa.gov/seasons/en/"
  ],
  "mediaCredits": [],
  "editorialRevision": "r1",
  "family": 59,
  "totalResponses": 30,
  "distanceMisconceptionRate": 0.6,
  "teachingFocus": "Correct the distance misconception",
  "mechanism": [
    "sunlight angle",
    "day length"
  ],
  "diagramNotToScale": true,
  "contentFingerprint": "74531ec4c97aadb2880b4b9175530a751985c6e10851fa2af7ecd6508f61be55",
  "narrationBound": true,
  "narrationSeconds": 34
}
```

## Supported content scope

This visual family explains Earth’s seasons from a Northern Hemisphere view. It requires the reviewed tilt/opposite-hemisphere facts and matching narration.

## Setup

1. Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before configuring Zvid credentials. A workspace owner/admin may need to install it.
2. Create a **Zvid API** credential with a key from https://app.zvid.io/api-keys and Base URL `https://api.zvid.io`. Assign it to **Validate project (free)**, **Submit render once** and **Wait for completed render**.
3. Connect Google Sheets and Google Drive OAuth2 with access to your source workbook and private delivery folder. Import `zvid-studio-education-seasons-prediction-explanation.json`, then fill the workbook, tab and folder IDs in **Config**.
4. Create `D59Requests` and `D59Records`. Use `studio-series/samples/day-59.json` for the synthetic sample and exact record shapes.
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
  "concept",
  "diagram_hemisphere",
  "minimum_responses",
  "question",
  "credit"
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
  "cause",
  "count",
  "fact",
  "value"
]
```

## Design and audio

The full approved design is embedded in **Join approved request data**, so importing this workflow does not require access to someone else's saved Zvid template. Domain values are mapped into the design; music, typography and layout are preserved. Use owned or appropriately licensed media. The supplied sample links illustrate the intended design and should be replaced with your approved assets for production.

Narration is bound to the exact calculated content, script and scene timing. Changed facts or geometry require a newly approved matching recording and content fingerprint. A mismatch returns a script review artifact rather than reusing speech that says something different. Some educational designs intentionally support a specific diagram family; unsupported concepts require a new design. The cues_verified flag records a human review of spoken timing against the visuals; it does not perform speech recognition or automatic audio alignment. Review both listening plays and the delayed answer reveal when approving a replacement recording. Speech generation is not included.

## Cost and recovery

```json
{
  "spreadsheetId": "",
  "sourceSheet": "D59Requests",
  "detailsSheet": "D59Records",
  "driveFolderId": "",
  "dryRun": false,
  "maxRenderCredits": 100,
  "pollSeconds": 10,
  "maxWaitSeconds": 900,
  "maxSourceRows": 100,
  "designRevision": "db4ddde723f5511480518fcaf4a2eb9914229cb07b67ffbf55c872613544f626"
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
