# Day 57: Fundraiser contributions to a progress video

Hand off a new fundraising milestone asset with a complete eligible contribution snapshot.

## Business outcome

A private Drive MP4, with full source records retained in Sheets and the n8n ledger, plus asset links, revision, job ID and handoff summary written back to D57Source for campaign managers. This template delivers a private asset for the use-case team and verifies its source-register receipt. The business owner reviews the asset before customer messaging or public publication.

## Why these steps are needed

Only active campaigns crossing a new configured milestone qualify; refunded or unsettled contributions do not count.

Source acquisition and joins prevent hand-copying a prepared video payload. Eligibility prevents misleading or stale notices. Fingerprints suppress completed content. Durable checkpoints retain accepted jobs through retries. Drive reconciliation recovers uploads whose response was lost. Source and detail rechecks protect writeback. Each step supports the business handoff.

## Setup

1. Install **`@zvid/n8n-nodes-zvid`** in **Settings → Community nodes**; a workspace owner/admin may need to install it before configuring Zvid credentials.
2. Create **Zvid API** credentials using https://app.zvid.io/api-keys and Base URL `https://api.zvid.io`. Connect Google Sheets and Google Drive OAuth2 credentials.
3. Create a private output folder and a workbook with `D57Source` and `D57Details`. The primary row describes one source revision; details join by the exact `parent_id` and `revision`. All headers are case-sensitive.
4. Configure IDs and tab names in **Config**. Keep `source_id` immutable and unique. The workflow handles one eligible request per execution, ordered by source ID, and reports remaining queue size.
5. Test manually, inspect the Drive asset and register receipt, then activate the staggered hourly schedule. Avoid overlapping manual runs. The 25-minute execution timeout is below the hourly interval; stagger templates within the Zvid account render quota.

The workflow reads the two Google Sheets registers shown below. If your system of record is elsewhere, populate these scalar columns from that system before running this template. Keep a real, authorized `source_url` for provenance; the illustrative example URL is not a production source.

### Source headers

```text
source_id, revision, approval, status, source_url, updated_at, campaign, goal, currency, minimumMilestonePercent, lastBriefedMilestone, automation_status, request_key, input_hash, job_id, video_url, drive_file_id, drive_url, completed_at, outcome_summary, automation_error
```

### Related-record headers

```text
parent_id, revision, kind, position, contribution_id, amount, currency, paymentStatus
```

### Required delivery headers on the source tab

```text
automation_status, request_key, input_hash, job_id, video_url, drive_file_id, drive_url, completed_at, outcome_summary, automation_error
```

Use explicit scalar columns, approved source data and stable source/revision IDs. Related records must match the selected revision. Business `status` and `approval` remain separate from the automation delivery columns.

### Illustrative source record

These are synthetic examples evaluated at `2026-10-01T12:00:00.000Z`, not a public factual claim. Replace identities, dates, values and the source URL with authorized data, and set dates for the intended execution window. Each key below is a separate Sheets column; do not paste the JSON into one cell. Delivery columns start blank.

```json
{
  "source_id": "qa-d57-record-001",
  "revision": "r1",
  "approval": "approved",
  "status": "active",
  "source_url": "https://example.com/qa/day-57/record-001",
  "updated_at": "2026-10-01T10:00:00.000Z",
  "campaign": "Demo community garden",
  "goal": 1000,
  "currency": "USD",
  "minimumMilestonePercent": 10,
  "lastBriefedMilestone": 0,
  "automation_status": "",
  "request_key": "",
  "input_hash": "",
  "job_id": "",
  "video_url": "",
  "drive_file_id": "",
  "drive_url": "",
  "completed_at": "",
  "outcome_summary": "",
  "automation_error": ""
}
```

### Illustrative related records

The example shows all 3 related rows for this synthetic record. Each object is one row. Blank fields belong to other supported detail kinds in this tab.

```json
[
  {
    "parent_id": "qa-d57-record-001",
    "revision": "r1",
    "kind": "contribution",
    "position": 1,
    "contribution_id": "QA-CONTRIB-1",
    "amount": 250,
    "currency": "USD",
    "paymentStatus": "settled"
  },
  {
    "parent_id": "qa-d57-record-001",
    "revision": "r1",
    "kind": "contribution",
    "position": 2,
    "contribution_id": "QA-CONTRIB-2",
    "amount": 175,
    "currency": "USD",
    "paymentStatus": "settled"
  },
  {
    "parent_id": "qa-d57-record-001",
    "revision": "r1",
    "kind": "contribution",
    "position": 3,
    "contribution_id": "QA-CONTRIB-3",
    "amount": 125,
    "currency": "USD",
    "paymentStatus": "settled"
  }
]
```

## Configuration and preview

```json
{
  "spreadsheetId": "",
  "sourceSheet": "D57Source",
  "detailsSheet": "D57Details",
  "driveFolderId": "",
  "brandName": "Zvid",
  "accentColor": "#A7DDD8",
  "dryRun": false,
  "maxRenderCredits": 30,
  "sceneSeconds": 6,
  "pollSeconds": 5,
  "maxWaitSeconds": 600,
  "maxSourceRows": 500
}
```

`dryRun: false` renders and spends credits. Free validation checks the schema and quote before submission and rejects quotes above `maxRenderCredits`. For a fresh request, `dryRun: true` attempts an editable project and returns a free render quote; a full editor-project quota returns `draft_unavailable` while retaining the quote. For saved accepted, completed or uploaded requests, true returns **Saved request inspection** with their retained state and brief. It does not poll, submit paid work, upload a file or mark delivery. Initial ledger setup and reads still occur.

## Revision and reporting policy

This is an event workflow: one request is created per approved source revision and destination folder. An unchanged delivered revision is suppressed. Increment the primary revision and every related row revision when business content or rendering configuration changes; changing an approval cell alone is not a new content version.

For fundraising milestones, the policy uses the larger of the source `lastBriefedMilestone` and delivered milestones retained for the same immutable campaign source ID and destination folder. Keep this Data Table history when a campaign revision changes. The authoritative context keeps the actual source cell in `record.lastBriefedMilestone` and records the history-derived threshold separately as `effectiveLastBriefedMilestone`. Only a newly crossed settled-contribution milestone qualifies.

## Persistent recovery

The Data Table freezes input, project, brief and full authoritative context, keyed by workflow, immutable source ID, revision, reporting period when applicable, and destination folder. States progress through `submitting`, `accepted`, `completed`, `uploaded`, and `delivered`. Intent is saved before the nonretrying paid request, and the accepted job ID is saved before waiting. Accepted requests resume their frozen input even if the original notice window later expires, provided the raw source and detail fingerprint is unchanged.

A lost paid response can leave `submitting` without a job ID. The workflow stops for reconciliation in https://app.zvid.io. Confirm which job was accepted and matches the frozen project, then retain that job ID and set the existing ledger row to `accepted` before retrying. Do not submit a replacement while acceptance is unknown. Deleted or revised sources with pending requests appear in the review report so their retained jobs can be reconciled.

Retries of `accepted` poll the same job; retries of `completed` deliver its saved HTTPS video URL. A missing completed media URL stops for investigation with the accepted job retained. Delivery searches the configured private folder using a deterministic filename. It reuses only one MP4 whose Drive `appProperties.zvid_request_hash` matches the saved SHA-256 input hash. Multiple matches, a wrong media type, or missing or different metadata stop automatic delivery. Verify the file against the retained job and frozen request before correcting its metadata or reconciling a conflicting file; filename alone is insufficient evidence.

Uploads have no blind retries because file creation can succeed while its response is lost. On replay, search and metadata verification recover that file. A failed source writeback reuses the retained upload. Both the primary and related records are reread and fingerprinted before writeback and after the receipt. A deleted, duplicated, revised or edited source stops completion and retains the uploaded asset for reconciliation.

Data Table lookup and upsert do not form an atomic uniqueness lock. Concurrent manual executions can both reach submission before a claim becomes visible; this workflow does not guarantee exactly-once execution under concurrency. Run one execution at a time or serialize it in your n8n deployment. Hourly staggering reduces schedule overlap but does not prevent a manually overlapping run.

## Output and review

The source register receives delivery status, request fingerprint, accepted job ID, video URL, private Drive file ID and link, completion time and the domain outcome. The final **Business outcome** contains the calculated brief and authoritative context; the video summarizes those records and does not replace full procedures or source records. Full context remains in Sheets and the n8n ledger.

**Watch video → Binary → data → View** plays completed MP4s. Its ordinary media GET has a 30-second timeout and at most three attempts five seconds apart; failed preview leaves the verified delivery intact. Mandatory media delivery uses a bounded download and stops on failure. All supported Zvid API operations use the published native Zvid node. The workflow adds no public-sharing permissions.

## Publication submission draft

**Who needs it:** Hand off a new fundraising milestone asset with a complete eligible contribution snapshot.

**What it automates:** A private Drive MP4, with full source records retained in Sheets and the n8n ledger, plus asset links, revision, job ID and handoff summary written back to D57Source for campaign managers.

**Required services:** n8n with Data Tables, `@zvid/n8n-nodes-zvid`, Zvid credits, Google Sheets and Google Drive.

Workflow walkthrough: {{YOUTUBE_VIDEO_URL}}

Describe the domain policy, source joins, persistent recovery, private handoff and verified source writeback when submitting. Include screenshots and manual execution evidence. n8n decides acceptance. Publish this companion guide and replace the overview reference with its verified public link before submission.

Support: https://zvid.io/contact

