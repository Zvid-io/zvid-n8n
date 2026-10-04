# Expanded workflow evidence readiness

Run the offline inspector:

    node zvid-integrations/n8n/local-test/series-2/flowlu-upgrade-readiness.mjs

The existing flowlu-readiness.mjs entry point also delegates here during the
upgrade. Neither inspector changes Flowlu, n8n, Sheets, Drive or any remote
service. Readiness is evidence for the root task to review; closing a Task still
requires its completion report and the native Flowlu preview/confirm writes.

All 30 Builds and screenshot Assets stay In Progress while the new evidence is
pending. The prior 272 automated checks and 30 successful video renders describe
the generation-only revision. They cannot establish the new source, policy,
recovery or delivery behavior.

## Current connection checkpoint

The initial native setup fixture failed in execution 734 for Google Sheets, and
735 for Google Drive, because both OAuth credentials needed reconnection. The
later native setup succeeded in Drive execution 736 and Sheets execution 737.
See flowlu-integration-history.json for the retained failures and
publication/infra-scaffold-evidence.json for the current checkpoint. Successful
setup establishes connectivity; it does not establish a full business-workflow
pass or close any Build.

The inspector reads that checkpoint on each run. A later successful native setup
or root-confirmed real manual source/upload proof supersedes an older failure.
A newer failure is not hidden by an older pass.

## Completion report

The root task supplies flowlu-upgrade-completion.json after observing the new
completion evidence. Its initial report is deliberately empty and unconfirmed.
Use schemaVersion 1 and rootReportConfirmed true only for an actual root
completion report. Each workflow entry also needs rootConfirmed true.

All artifact references have this shape:

    {"path":"publication/evidence-file.json","sha256":"64-character SHA-256"}

Paths are relative to this series-2 directory. The inspector verifies file bytes
against the hash and rejects paths outside this directory or environment files.
Use sanitized proofs. Do not put credentials, customer data or private media URLs
in the completion report or Flowlu descriptions. Artifact paths and receipt/job
identifiers suffice.

The report has:

- automated: positive passed count, failed 0, artifact reference to the final
  test output, and functionalHashes mapping day numbers to the tested current
  functional fingerprints. TAP pass/fail totals are checked when present.
- workflows: one entry for each reported day; duplicate day entries are rejected.

A workflow entry has:

    {
      "day":31,
      "rootConfirmed":true,
      "workflowId":"ZvidSeries2Day31",
      "functionalSha256":"current functional fingerprint",
      "sourceId":"stable business record ID",
      "revision":"immutable revision",
      "requestKey":"workflow/source/revision request key",
      "manual":{"executionId":1000,"artifact":{"path":"...","sha256":"..."}},
      "checks":{
        "sourceRead":{"executionId":1000,"artifact":{"path":"...","sha256":"..."}},
        "domainPolicy":{"executionId":1000,"artifact":{"path":"...","sha256":"..."}},
        "eligibility":{"executionId":1000,"artifact":{"path":"...","sha256":"..."}},
        "ledgerAcceptance":{"executionId":1000,"artifact":{"path":"...","sha256":"..."}},
        "driveFile":{"executionId":1000,"artifact":{"path":"...","sha256":"..."}},
        "writeback":{"executionId":1000,"artifact":{"path":"...","sha256":"..."}},
        "deduplication":{"executionId":1001,"artifact":{"path":"...","sha256":"..."}},
        "resumeAccepted":{"executionId":1002,"artifact":{"path":"...","sha256":"..."}},
        "deliveryRecovery":{"executionId":1003,"artifact":{"path":"...","sha256":"..."}}
      },
      "mediaQa":{"path":"...","sha256":"..."},
      "canvas":{"path":"...","sha256":"..."}
    }

The numeric IDs above are examples, not observed executions. IDs in actual
reports must refer to new manual executions after the recorded baseline for that
workflow.

## Native execution proof

Each manual/check artifact contains the matching execution, either as a single
object or within an array, results, executions, items or data. Required fields:

    {
      "executionId":1000,
      "workflowId":"ZvidSeries2Day31",
      "mode":"manual",
      "status":"success",
      "mocked":false,
      "functionalSha256":"tested canonical functional fingerprint",
      "nodes":{"actual node name":"success"},
      "roles":{}
    }

Produce these normalized observations from actual n8n execution data and remote
receipts. The proof identifies executed nodes, rather than merely asserting that
the video looks correct. A single main-execution artifact can cover the first six
checks. Each role requires real true, passed true, and node naming a successful
actual node in the nodes map.

Role-specific fields:

| Role | Required observations |
| --- | --- |
| sourceRead | rowsRead > 0 and referenceRowsRead > 0 from real Sheets reads |
| domainPolicy | sourceId/revision match the entry; requiredFieldsValidated and referenceJoinVerified are true |
| eligibility | sourceId matches; eligible and businessRuleChecked are true |
| ledgerAcceptance | matching requestKey, persisted jobId, acceptedBeforeDownstream true |
| driveFile | actual fileId, private true, mimeType video/mp4, bytes > 0 |
| writeback | matching sourceId/jobId/driveFileId and confirmed status delivered |
| deduplication | matching requestKey/jobId/file ID; zero renderCreateCalls and driveUploadCalls; noDuplicateLedgerRows, noDuplicateSourceRows, noDuplicateFiles true |
| resumeAccepted | matching requestKey/jobId; zero renderCreateCalls; acceptedJobResumed true |
| deliveryRecovery | matching requestKey/jobId/file ID; zero renderCreateCalls and driveUploadCalls; writebackSucceeded true |

The main proof also has roles.render with real true, node identifying a
successful actual Zvid node, jobId matching the ledger, and projectSha256.
For mode created, renderCreateCalls must be 1. For mode reusedAccepted, it must
be 0 and frozenProjectSha256 must equal projectSha256. Thus an existing accepted
video can verify recovery/delivery only when the frozen and current projects
match. Changed video content requires a new render and matching media review.

## Media and actual canvas

The media proof contains mediaPassed true, visualReview passed, matching jobId
and projectSha256, plus video as an artifact reference. The actual MP4 bytes and
hash are checked. Review every scene before recording the visual pass.

The canvas proof contains workflowId, the exact current canonicalSha256,
inspected true, allFunctionalNodesCovered true, allTextFits true,
readableOverview true, overlap as an empty array, and fitPng/overviewPng artifact
references. Both image files must have genuine PNG structure and matching bytes.
Use actual inspected n8n captures, and keep the readable overview separate from
the full fit view when needed.

The functional fingerprint includes functional node names, types, versions,
parameters and execution options, connections and settings. Sticky-note content,
positions and credential bindings are excluded. Compute it with the exported
functionalFingerprint function. A notes-only update can retain valid functional
testing but needs fresh exact canvas evidence. Test configuration/credential
bindings may differ from the portable template; the root report must establish
that the tested functional logic is the matching canonical revision.

The inspector writes flowlu-upgrade-readiness.json with separate buildReadyDays
and assetReadyDays, pending reasons, and the real integration checkpoint/status.
It reports no upgraded workflow ready while the completion report is missing.
