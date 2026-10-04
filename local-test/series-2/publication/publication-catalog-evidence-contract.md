# Publication catalog evidence

Run `node local-test/series-2/publication/build-publication-catalog.js` from the n8n directory. The builder writes only inside this publication directory. It does not replace the earlier catalog, change workflows, close Flowlu tasks, or submit templates.

## Inputs

- `verified-tests.log`: exact recorded automated test counts. These do not prove live delivery.
- `infra-import-audit.json`: a current native Docker audit. Each passing row must match the official `infra-functional-fingerprint.js` hash of the current canonical JSON and its installed workflow.
- `upgraded-executions.json`: native SQLite execution evidence emitted by `infra-read-executions.js`. Only manual executions after 737 with a matching current functional hash, a delivered business outcome, matching source/Drive receipt and successful native outcome/readback nodes count as an observed live delivery. Dry runs, no-work results, failed attempts and earlier render-only reports never count.
- `upgraded-media-results.json`: `{ "workflows": [...] }` or `{ "results": [...] }`, with per-day `day`, `functionalHash`, original reviewed `executionId`, `jobId`, `driveFileId`, `projectSha256`, `inputHash`, local video `file` and `sha256`. It requires `passed`, `technicalPassed` and `mediaPassed` all true, plus `visualReview: "passed"`. The saved video's actual bytes must match its hash. A later replay can reuse this review only when both current native delivered executions retain exactly the same source/revision/request/job, frozen project/input hashes, Drive file and video URLs. The catalog records the original media execution separately; it does not relabel it as the replay.
- `upgraded-canvas-audit.json`: `{ "workflows": [...] }`, with per-day `day`, `functionalHash`, `artifactSha256` (the SHA-256 of exact canonical JSON bytes), `passed: true`, `actualCanvasInspected: true`, `allTextFits: true`, `allFunctionalNodesCovered: true`, `fitVisuallyInspected: true`, `readableOverview: true`, `representativeSectionsReadable: true`, and `overlaps: []` after the current imported canvas is inspected.
- `upgraded-verification.json`: `{ "rootReportConfirmed": true, "workflows": [...] }`, with per-day `day`, `functionalHash`, `artifactSha256`, `sourceId`, `revision`, `requestKey`, `rootConfirmed: true`, and `checks` containing independently verified `eligibility`, `deduplication`, `resumeAccepted`, and `deliveryRecovery`, each either `true` or `{ "passed": true, ...evidence }`. `mainRenderExecutionId` (fallback `manual.executionId` or `executionId`) identifies the current native delivered render/resume proof. Optional `latestDeliveryExecutionId` identifies a later delivery replay. The main and latest native receipts must retain the same exact identity.

Missing evidence remains pending. The catalog will show a delivered native run separately from full local verification. Full verification requires all import, execution, media, canvas, domain and recovery checks plus root confirmation. Manual fixtures in actual Google services are identified as live QA fixtures.

All hashes use the official infrastructure fingerprint except `artifactSha256`, which hashes exact file bytes. The functional fingerprint normalizes only local Sheets/Drive IDs and ignores credentials and canvas geometry according to the infrastructure helper. Canvas proof must also match the full artifact hash so later note edits supersede its evidence.

## Public guide and submission

Companion guides are local files. No public GitHub or documentation URL is invented. A root-confirmed per-day record may add `publicGuide: { "verified": true, "url": "https://..." }` only after the published guide URL has actually been verified. Full local verification and this verified public guide are both necessary for the catalog's submission-readiness flag. That flag is a preparation check; n8n decides acceptance and no submission is performed.

The 30 plaintext packets copy each companion guide's `Publication submission draft` section, then include the actual adapter's source schema, policy, audience, handoff and grounded rationale. All production/private links stay in the local review catalog; the plain-text submission files contain no private execution video or Drive links.
