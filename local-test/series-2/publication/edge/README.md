# Manual Docker edge fixtures

These local inactive fixtures are excluded from publication and launch registration. The builder never imports or executes them. Every render-submission path is blocked; recovery reuses only upgraded known jobs.

## Setup

1. Import and manually run `ZvidSeries2PubEdgeCopyWorkbook`. Read its `edgeSpreadsheetId`.
2. Save upgraded D31/D35 `Persist delivered outcome` rows as `{ "31": { ...row }, "35": { ...row } }`. These contain private test media references and stay local.
3. Rebuild: `node local-test/series-2/publication/edge/build-fixtures.js --spreadsheet=<copied-id> --seeds=<local-json-path>`.
4. Import rebuilt `fixtures.json` into the same Personal project and run SetupRows once. Do not point fixtures at the baseline workbook.

## Manual sequence

- [ZvidSeries2PubEdgeCopyWorkbook](http://localhost:5678/workflow/ZvidSeries2PubEdgeCopyWorkbook) — A distinct private native spreadsheet copy, or its existing receipt; baseline workbook unchanged. Run once, read edgeSpreadsheetId from Copied workbook receipt, then rebuild using --spreadsheet=<ID>.
- [ZvidSeries2PubEdgeSetupRows](http://localhost:5678/workflow/ZvidSeries2PubEdgeSetupRows) — Copied D31Source has three synthetic records, D31Details has nine joined rows; baseline untouched. Run once after workbook copy, before MultiRead/Unapproved/CapZero.
- [ZvidSeries2PubEdgeMultiRead](http://localhost:5678/workflow/ZvidSeries2PubEdgeMultiRead) — Three primary, nine detail and two saved rows pass qualification without duplicate fetches or any render. Run after SetupRows. The graph ends at Assert native multi-row intake.
- [ZvidSeries2PubEdgeUnapproved](http://localhost:5678/workflow/ZvidSeries2PubEdgeUnapproved) — No work report has one unapproved source and no paid/Drive/delivery nodes. Run after SetupRows.
- [ZvidSeries2PubEdgeCapZero](http://localhost:5678/workflow/ZvidSeries2PubEdgeCapZero) — Native free validation succeeds, then Check validation and credit cap rejects the positive quote at maxRenderCredits=0; no paid or Drive nodes. Run after SetupRows. A stopped execution is the expected result.
- [ZvidSeries2PubEdgeAcceptedDryRun](http://localhost:5678/workflow/ZvidSeries2PubEdgeAcceptedDryRun) — saved_request_inspection; no Drive, writeback or paid submission nodes execute. Run once after the upgraded job seed and copied workbook exist.
- [ZvidSeries2PubEdgeAmbiguousSubmission](http://localhost:5678/workflow/ZvidSeries2PubEdgeAmbiguousSubmission) — Decide recovery rejects ambiguous submission; no Zvid render or Drive nodes execute. Run once after the upgraded job seed and copied workbook exist.
- [ZvidSeries2PubEdgeSourceReadRace](http://localhost:5678/workflow/ZvidSeries2PubEdgeSourceReadRace) — Protect source writeback rejects changed primary content; copied source receipt is not overwritten. Run once after the upgraded job seed and copied workbook exist.
- [ZvidSeries2PubEdgeDetailsReadRace](http://localhost:5678/workflow/ZvidSeries2PubEdgeDetailsReadRace) — Protect source writeback rejects changed related content; copied source receipt is not overwritten. Run once after the upgraded job seed and copied workbook exist.
- [ZvidSeries2PubEdgeLostUploadResponse](http://localhost:5678/workflow/ZvidSeries2PubEdgeLostUploadResponse) — Native Upload succeeds, then the intentional Stop and Error prevents remembering its response; saved completed media remains. Run once; the intentional error is expected. Then run LostUploadReplay.
- [ZvidSeries2PubEdgeLostUploadReplay](http://localhost:5678/workflow/ZvidSeries2PubEdgeLostUploadReplay) — Find existing delivery reuses the EDGE MP4; Upload and paid submission do not execute; copied register receives verified receipt. Run immediately after LostUploadResponse; both use one edge ledger and one EDGE filename.
- [ZvidSeries2PubEdgeExpiredNoticeRecovery](http://localhost:5678/workflow/ZvidSeries2PubEdgeExpiredNoticeRecovery) — The notice is ineligible at the simulated clock, but the saved accepted job is polled and delivered without paid resubmission. Run once after the upgraded job seed and copied workbook exist.

## Evidence labels

Native-integration fixtures use the installed Google Sheets, Drive, Data Table and Zvid nodes. Clock/read-race fixtures explicitly simulate a future clock or edited read in a local Code node; they do not edit business source fields remotely. Lost-response fixtures upload one additional private EDGE MP4 from a known completed job and then prove native filename-based reuse. The canonical workbook receipts and source business values remain untouched.

Archive fixture workflows after root has inspected their expected results; retain ledger/file evidence until reporting is complete.

## All-template recovery checkpoints

These additional inactive helpers use native Data Tables only. Their exact synthetic requests are `qa-dXX-record-001`: D50 revision `r2`, all other days `r1`, the private QA output folder, and reporting period `2026-10-01` for daily templates. The old D50 r1 row and output remain unchanged. Do not run a helper while a canonical execution is active.

1. After all 30 current requests are delivered, manually run [CheckpointAccepted](http://localhost:5678/workflow/ZvidSeries2PubCheckpointAccepted) once. All 30 reads and identity checks precede the first update. The helper clears delivery URL/file references and sets status to `accepted`, retaining the accepted job, hash, credit quote and frozen input/project/context. The final output must be `all_thirty_synthetic_checkpoints_ready`, `targetStatus: accepted`, `count: 30`; every receipt must retain frozen content and have false URL/file-retained flags.
2. Manually run all 30 canonical workflows. Each must poll its saved accepted job, reconcile exactly one existing Drive MP4 and verify its Sheets receipt. Paid submission and upload must not execute.
3. Only after all 30 requests return to delivered, manually run [CheckpointUploaded](http://localhost:5678/workflow/ZvidSeries2PubCheckpointUploaded) once. It changes status only. Its final output must have `targetStatus: uploaded`, `count: 30`, and true frozen-content and URL/file-retained flags.
4. Manually run all 30 canonical workflows again. Each must recover its uploaded asset and verify its receipt; paid submission, job polling and upload must not execute.

The 30 updates are conditional individual writes, not one transaction. A partial helper failure requires reconciliation; repeating it blindly will fail its delivered-only preflight. `checkpoint-installed-audit.json` verifies installed helper/import definitions; `checkpoint-executions-evidence.json` independently compares native before/after retained hashes and timing. Neither report grants root confirmation. Original media capture IDs and file byte hashes remain separate from replay execution IDs.
