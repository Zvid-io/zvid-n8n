# Historical Hashnode revision evidence

Archived 2026-10-14 after removal from the campaign. Task 359 was deleted. The former attachment reference below is historical; local and CDN diagram assets remain available.

## Hashnode — task 359

- Title: Handling Video Render Failures with n8n, Node.js, and Zvid.
- Opens with the uncertainty after a render timeout and the risk of duplicate submissions.
- Includes a reviewed diagram separating the Google Sheets/n8n and CSV/Node.js paths. Shared video-building logic is explicit; n8n does not invoke the CLI.
- Two JavaScript excerpts match `src/index.js` from shared-repository commit `cdde6a14b55ade3f3ca073e3f6a780f3b15df309`, allowing only indentation changes.
- Explains job persistence, bounded polling, completion before download, preview isolation, file-write limitations and the missing concurrency guarantees. Minor CSV and trusted-file details are in a note.
- Diagram sources: `assets/execution-paths.svg` and `assets/execution-paths.mmd`. Publication image: `assets/execution-paths.png` (1600 × 1020).
- PNG SHA-256: `4d05abed32c11207c6ac917da8c9464ff5161196bb474dc88c008cfc556d363f`.
- [Published diagram asset](https://cdn.zvid.io/assets/blogs/automate-daily-quote-videos-n8n-google-sheets/4d05abed32c11207-execution-paths.png) returned HTTP 200 and matched local bytes. It is also attached to task 359 as Flowlu file 32.

