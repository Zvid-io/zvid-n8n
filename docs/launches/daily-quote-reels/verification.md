# Verification — 2026-10-14

## Sources and scope

- Official template 19632 is public and its provider API reports published status.
- Normalized functional nodes and connections match the local canonical workflow. Sticky-note text and node positions were excluded from that functional comparison.
- Canonical SHA-256: `a2e72e40e5f1b8faaf514568ac2beb99bc0c533d646f1ef9ed49d9527387abea`.
- The public n8n canvas was inspected and captured. The local example's `workflow.png` is a capture of that current canvas, not a synthetic diagram.
- YouTube watch page was opened and verified: “Automate Daily Quote Videos with n8n, Google Sheets & Zvid”, video ID `Ra6mPdmDDYs`, duration 4:15. No transcript-based claims are made.
- The existing Zvid workflow page is reachable but contains old setup instructions. A replacement draft is included.
- The shared GitHub repository `Zvid-io/workflow-examples` is now public. The tested daily quote implementation, required folder structure and actual output are published there. The former standalone repository remains intact.

## Implementation work

- Synchronized the example's bundled workflow with the canonical native-node version: 29 total nodes, including 22 functional nodes and 7 notes. Four supported Zvid operations use `@zvid/n8n-nodes-zvid.zvid`.
- Corrected README setup from generic Header Auth to the installed Zvid node's credential.
- Fixed the local checker to use the package's actual documentation metadata path and to assert the native Zvid operations.
- Added validation of date, polling, timeout and optional maximum-credit arguments.
- Added an optional maximum validation-quote guard before render submission.
- Persisted accepted job IDs before polling, and completed URLs/queue state before downloading.
- Made download failures retain the completed render result and added a bounded download request timeout.
- Kept input CSV files unchanged; documented using the output queue for later runs.

## Automated checks

`npm run check`: passed, with 29 workflow nodes and 3 sample rows.

`npm test`: 14 passed, 0 failed. Coverage includes preview mode, draft-save failure, successful rendering, output-queue persistence, source preservation, successful/failed download, validation failure, credit limits, failed render, timeout, missing video URL, exhausted queue, missing author, invalid options, and deterministic/escaped project generation. Mocked tests make no paid API calls.

## Live verification

One dry run validated the sample and saved an editor draft without a render submission. Its private editor URL is intentionally excluded from public copy and Flowlu descriptions.

One paid render was submitted for the 2026-10-14 Emerson sample, with `--max-credits 11 --timeout 3`. The API reported completion. The validation quote was 11 credits; this report does not claim an independently audited final billing ledger.

The output was downloaded and inspected with ffprobe: H.264 video, AAC audio, 1080 × 1920, 30 fps, 10.8 seconds. Representative frames at 2 seconds and 9 seconds show the quote and author card. The original input CSV stayed unchanged; the output copy marks only its first row done with the completed URL.

Local evidence: `.local/reports/2026-10-14-daily-quote-campaign/live-render/`. The sample media URL and private draft identifiers are not included in the campaign content or Flowlu updates.

## Limits of the evidence

This is one real Node.js render using the shared project builder, not a fresh live execution of the entire Google Sheets n8n workflow. Public-template status and functional parity were checked separately. The live check does not prove typography for arbitrary quote lengths, exact-once queue processing, or future render performance/cost.

The CLI has no automatic schedule, Google Sheets adapter, atomic queue claim, or job-resume command. CSV and result writes are separate filesystem operations. A timeout or restart requires checking the existing job before retrying. n8n users must avoid sorting/deleting active rows and overlapping runs.

## Flowlu save verification

After the owner's explicit approval on 2026-10-14, 11 updates were saved: the Story and 10 child Tasks. A readback verified exact HTML descriptions and stage values for all 11 records. The parent has 12 children: 4 Done, 7 Review, 1 Backlog, 0 Blocked. Six publication drafts remain unpublished in Review.

Attachments uploaded: `daily-quote-videos-reviewed.zip` to issue 354 (file ID 30, 3,398,336 bytes), and `daily-quote-workflow.png` to issue 352 (file ID 31, 164,163 bytes). The ZIP was integrity-checked and built from an explicit allowlist excluding private environment files, dependencies, and live-test output. The screenshot is the actual published n8n canvas capture.

## Shared repository follow-up

Created https://github.com/Zvid-io/workflow-examples with first example `workflows/daily-quote-reels/`. Published commit: `28184f7fd4850b2e53b4e690ba7ae84b0725700c`. All 31 committed files were verified through the GitHub API. The working tree is clean.

The reorganized example passed the local structure check, workflow check and all 14 tests. [GitHub CI](https://github.com/Zvid-io/workflow-examples/actions/runs/38546290056) also completed successfully. Relative README links and the blank `.env.example` were checked. No private environment file, live API key, dependencies, or private test-result URL was published.

The actual 2026-10-14 sample MP4 and source project were copied byte-for-byte from the previously verified render; no new paid render was submitted. Its poster, output metadata and SHA-256 hashes are included under `assets/`. Each future workflow uses the same documented layout. The original attached ZIP is retained only as historical evidence of the earlier standalone layout.

Six Flowlu descriptions were refreshed and read back exactly: Story 346 and Tasks 1272, 359, 360, 354 and 352. Task 354 is now Done. Story ZWL-64 remains In Progress with 5 Done, 6 Review, 1 Backlog, 0 Blocked (7 remaining). The six distribution drafts remain unpublished.
