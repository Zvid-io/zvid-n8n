# Handling Video Render Failures with n8n, Node.js, and Zvid

A video render is submitted, but the script times out before it receives the result. Did the render fail, or is it still running? Starting over could create a second job for a video that already exists.

That is the engineering challenge behind our daily quote-video example at Zvid. The workflow generates branded vertical videos with background footage, music, and quote attribution. Preview mode lets you review the project and check estimated rendering credits before generating the final video.

The interesting decisions are around that render: how to share the video design, preserve the job's identity, and recover a finished result without repeating the work.

## Two execution paths, one project builder

![Two alternative paths: Google Sheets through scheduled n8n to Zvid and back to the Sheet; local CSV through Node.js to Zvid and local output files](https://cdn.zvid.io/assets/blogs/automate-daily-quote-videos-n8n-google-sheets/4d05abed32c11207-execution-paths.png)

**The n8n path** runs on a daily schedule. It reads the next pending quote from Google Sheets, builds a video project, calls Zvid, and writes the completed URL back to the Sheet.

**The Node.js path** runs when invoked. It reads a local CSV, uses the same project builder, and saves the result and an updated queue locally. It does not connect to Google Sheets or run through n8n.

Sharing the builder keeps layout changes in one place. The CLI loads it from the bundled n8n workflow, so both implementations use the same scene definitions. The trade-off is coupling: changes to the workflow's builder also need to be checked against the CLI.

## Decision 1: persist the accepted job before polling

The CLI writes the returned job ID to disk immediately. This excerpt is from the actual [Node.js implementation](https://github.com/Zvid-io/workflow-examples/blob/cdde6a14b55ade3f3ca073e3f6a780f3b15df309/workflows/daily-quote-reels/src/index.js):

```javascript
const submitted = await client.renders.create({ payload: built.payload });
const jobId = submitted.jobId;
if (!jobId) throw new Error('The render API did not return a jobId');
console.log(`  Render queued: ${color.cyan(jobId)}`);

// Save the accepted job before polling. A timeout is not permission to resubmit.
writeJson(path.join(options.out, 'result.json'), {
  rendered: false, state: 'submitted', jobId, sheetRow: pending.sheetRow,
  creditsQuoted: validation.creditsRequired,
});
```

The file gives an operator something concrete to investigate after a timeout. A local file is easy to inspect, but it is not a durable job service: another run can overwrite it. If submission succeeds but its response is lost, the CLI may never receive an ID to save. This approach does not guarantee exactly-once rendering.

## Decision 2: distinguish failure from an unfinished job

The polling loop has a deadline and records an explicit failed state. It does not submit another render when the deadline expires. This is the next block from the same implementation; the CLI supplies `client`, `options`, and the other surrounding values.

```javascript
const deadline = Date.now() + timeoutMinutes * 60_000;
let job;

for (;;) {
  job = await client.jobs.get(jobId);
  if (job.state === 'completed') break;
  if (job.state === 'failed') {
    writeJson(path.join(options.out, 'result.json'), {
      rendered: false, state: 'failed', jobId, failedReason: job.failedReason || null,
      sheetRow: pending.sheetRow, creditsQuoted: validation.creditsRequired,
    });
    throw new Error(`Render failed: ${job.failedReason || 'no reason given'}`);
  }
  if (Date.now() >= deadline) {
    throw new Error(`Render ${jobId} did not finish within ${timeoutMinutes} minutes`);
  }
  console.log(color.dim(`  ${job.state || 'rendering'}…`));
  await sleep(pollSeconds * 1000);
}
```

On timeout, inspect the saved job ID and check its status before rerunning. The example deliberately leaves that recovery step manual; it has no automatic resume mechanism.

## Decision 3: save completion before downloading

An accepted job, a completed video, and a downloaded file are three different states.

After receiving a completed video URL, the CLI writes the updated queue and result file before attempting the MP4 download. If downloading fails, those files still point to the completed video. Recovering the file does not require another render.

The trade-off is that the two file writes are not a transaction. A crash between them can leave inconsistent local state. A service running concurrent jobs would need a durable job record, a stable quote ID, and a way to reconcile unfinished work after restarting.

## Decision 4: keep preview and rendering separate

Dry run validates the project, attempts to save an editor draft, and leaves the quote pending. Failure to save that draft never falls through to rendering. Rendering is enabled by default, so preview must be selected explicitly.

The CLI's optional credit limit checks the estimate for one run. It does not reserve credits or enforce an account-wide budget.

> **Implementation notes:** the CSV uses `Quote`, `Author`, `AuthorNote`, `Status`, and `VideoUrl`. A blank status is pending; later CLI runs must read the updated output CSV. Keep Sheet row order unchanged during execution and run serially to avoid selecting the same quote twice. The shared builder executes code from the workflow file, so load only trusted exports.

## The engineering lesson

Persist the identity and outcome of external work before moving to the next step. That makes timeouts and download failures easier to diagnose, even in a small automation. Preventing duplicates under concurrency would require additional queue claiming and recovery logic.

The repository's 14 tests cover preview behavior, validation, credit limits, failed jobs, timeouts, missing URLs, downloads, and queue updates. We also inspected a real rendered sample; review your own content before publishing.

- [GitHub example, tests, and sample output](https://github.com/Zvid-io/workflow-examples/tree/main/workflows/daily-quote-reels)
- [Official n8n template](https://n8n.io/workflows/19632-create-daily-quote-videos-from-google-sheets-with-zvid/)
- [YouTube walkthrough](https://youtu.be/Ra6mPdmDDYs)
- [Zvid documentation](https://docs.zvid.io)
