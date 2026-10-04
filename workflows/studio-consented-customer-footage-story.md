# Day 37: Pair consented customer clips with approved product-story copy

Select a coherent customer routine and application sequence only when recorded usage permissions cover the full campaign.

Clip edit manifest, usage-permission references and expiry review date plus one customer-story video.

## Business decisions

1. Check the full campaign rights window.
2. Pair matching customer footage and caption.
3. Build the rights and edit handoff.

The domain calculations run on the approved request and joined records. Invalid, incomplete, stale or ineligible requests produce a review or skip reason before paid work. The attached decision report records selection, exclusions and calculations; the video is one part of the handoff. The template does not publish content, message customers, book inventory, change advertising budgets or commit a price or reservation.

## Calculated sample handoff

The included synthetic input produces the following decision. This is calculated by the same three functions embedded in the workflow.

```json
{
  "eligible": [
    {
      "kind": "clip",
      "record_id": "routineA",
      "clip_id": "routineA",
      "contributor_id": "DEMO-A",
      "sku": "CARE1",
      "role": "routine",
      "url": "https://videos.pexels.com/video-files/7314356/7314356-hd_1366_720_25fps.mp4",
      "duration_seconds": 10,
      "orientation": "portrait",
      "quality_score": 80,
      "release_id": "REL-A",
      "received_at": "2026-10-01T08:00:00Z",
      "release": {
        "kind": "release",
        "record_id": "REL-A",
        "release_id": "REL-A",
        "contributor_id": "DEMO-A",
        "sku": "CARE1",
        "territories": [
          "US"
        ],
        "channels": [
          "organic_social"
        ],
        "valid_from": "2026-09-01T00:00:00Z",
        "valid_until": "2027-01-01T00:00:00Z",
        "revoked": false,
        "evidence_url": "https://example.com/demo-release"
      }
    },
    {
      "kind": "clip",
      "record_id": "applicationA",
      "clip_id": "applicationA",
      "contributor_id": "DEMO-A",
      "sku": "CARE1",
      "role": "application",
      "url": "https://videos.pexels.com/video-files/7390091/7390091-hd_1920_1080_25fps.mp4",
      "duration_seconds": 10,
      "orientation": "landscape",
      "quality_score": 85,
      "release_id": "REL-A",
      "received_at": "2026-10-01T09:00:00Z",
      "release": {
        "kind": "release",
        "record_id": "REL-A",
        "release_id": "REL-A",
        "contributor_id": "DEMO-A",
        "sku": "CARE1",
        "territories": [
          "US"
        ],
        "channels": [
          "organic_social"
        ],
        "valid_from": "2026-09-01T00:00:00Z",
        "valid_until": "2027-01-01T00:00:00Z",
        "revoked": false,
        "evidence_url": "https://example.com/demo-release"
      }
    }
  ],
  "rejected": [],
  "selected": {
    "routine": {
      "kind": "clip",
      "record_id": "routineA",
      "clip_id": "routineA",
      "contributor_id": "DEMO-A",
      "sku": "CARE1",
      "role": "routine",
      "url": "https://videos.pexels.com/video-files/7314356/7314356-hd_1366_720_25fps.mp4",
      "duration_seconds": 10,
      "orientation": "portrait",
      "quality_score": 80,
      "release_id": "REL-A",
      "received_at": "2026-10-01T08:00:00Z",
      "release": {
        "kind": "release",
        "record_id": "REL-A",
        "release_id": "REL-A",
        "contributor_id": "DEMO-A",
        "sku": "CARE1",
        "territories": [
          "US"
        ],
        "channels": [
          "organic_social"
        ],
        "valid_from": "2026-09-01T00:00:00Z",
        "valid_until": "2027-01-01T00:00:00Z",
        "revoked": false,
        "evidence_url": "https://example.com/demo-release"
      }
    },
    "application": {
      "kind": "clip",
      "record_id": "applicationA",
      "clip_id": "applicationA",
      "contributor_id": "DEMO-A",
      "sku": "CARE1",
      "role": "application",
      "url": "https://videos.pexels.com/video-files/7390091/7390091-hd_1920_1080_25fps.mp4",
      "duration_seconds": 10,
      "orientation": "landscape",
      "quality_score": 85,
      "release_id": "REL-A",
      "received_at": "2026-10-01T09:00:00Z",
      "release": {
        "kind": "release",
        "record_id": "REL-A",
        "release_id": "REL-A",
        "contributor_id": "DEMO-A",
        "sku": "CARE1",
        "territories": [
          "US"
        ],
        "channels": [
          "organic_social"
        ],
        "valid_from": "2026-09-01T00:00:00Z",
        "valid_until": "2027-01-01T00:00:00Z",
        "revoked": false,
        "evidence_url": "https://example.com/demo-release"
      }
    },
    "caption": {
      "kind": "caption",
      "record_id": "quoteA",
      "contributor_id": "DEMO-A",
      "sku": "CARE1",
      "caption": "A simple step in my routine.",
      "approval": "approved",
      "claim_evidence": "https://example.com/demo-quote"
    },
    "minimumQuality": 80,
    "totalQuality": 165
  },
  "selectedClipIds": [
    "routineA",
    "applicationA"
  ],
  "contributorId": "DEMO-A",
  "reviewAfter": "2026-10-31T00:00:00Z",
  "permissionScope": "Source-record consistency check; no legal certification"
}
```

## Setup

1. Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before configuring Zvid credentials. A workspace owner/admin may need to install it.
2. Create a **Zvid API** credential with a key from https://app.zvid.io/api-keys and Base URL `https://api.zvid.io`. Assign it to **Validate project (free)**, **Submit render once** and **Wait for completed render**.
3. Connect Google Sheets and Google Drive OAuth2 with access to your source workbook and private delivery folder. Import `zvid-studio-consented-customer-footage-story.json`, then fill the workbook, tab and folder IDs in **Config**.
4. Create `D37Requests` and `D37Records`. Use `studio-series/samples/day-37.json` for the synthetic sample and exact record shapes.
5. Run manually, inspect the decision report and **Watch video → Binary → data → View**, then enable the schedule when ready. The exported workflow is inactive.

## Input contract

Requests has one row per business brief: `source_id,revision,approval,brief_json`. Add these output columns: `automation_status,request_key,input_hash,job_id,video_url,drive_file_id,drive_url,completed_at,outcome_summary,automation_error`.

`source_id` is unique within the sheet. Use immutable letters, digits, dashes or underscores for IDs and revisions. Set `approval` to `approved` only after checking the brief. `brief_json` contains the request object below, encoded as JSON in one cell. Any IDs, revisions or approval inside that object must agree with the sheet envelope.

Records has `parent_id,revision,kind,record_id,data_json`. Parent ID and revision join the corresponding request; record IDs must be unique within it. `data_json` holds the domain fields of each record. All source values must be typed correctly in JSON: use booleans and numbers rather than strings where shown. Dates and currency belong to the source, and must be current for the intended campaign.

Request fields:

```json
[
  "request_id",
  "revision",
  "approval",
  "brand",
  "as_of",
  "story_id",
  "sku",
  "territory",
  "channel",
  "campaign_start",
  "campaign_end",
  "product_name",
  "product_image",
  "product_url",
  "hook",
  "cta",
  "demo"
]
```

Record fields:

```json
{
  "clip": [
    "clip_id",
    "contributor_id",
    "sku",
    "role",
    "url",
    "duration_seconds",
    "orientation",
    "quality_score",
    "release_id",
    "received_at"
  ],
  "release": [
    "release_id",
    "contributor_id",
    "sku",
    "territories",
    "channels",
    "valid_from",
    "valid_until",
    "revoked",
    "evidence_url"
  ],
  "caption": [
    "contributor_id",
    "sku",
    "caption",
    "approval",
    "claim_evidence"
  ]
}
```

## Design and audio

The full approved design is embedded in **Join approved request data**, so importing this workflow does not require access to someone else's saved Zvid template. Domain values are mapped into the design; music, typography and layout are preserved. Use owned or appropriately licensed media. The supplied sample links illustrate the intended design and should be replaced with your approved assets for production.

Music is included with the approved subject-specific design. Review music rights and campaign suitability before using a different track.

## Cost and recovery

```json
{
  "spreadsheetId": "",
  "sourceSheet": "D37Requests",
  "detailsSheet": "D37Records",
  "driveFolderId": "",
  "dryRun": false,
  "maxRenderCredits": 100,
  "pollSeconds": 10,
  "maxWaitSeconds": 900,
  "maxSourceRows": 100,
  "designRevision": "40b92e47a1d8b68bb57722b9374e16b4bc63293ffb356697f71706b12088621a"
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
