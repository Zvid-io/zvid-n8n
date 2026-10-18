# Google Sheets to Daily Quote Videos with n8n and Zvid

Turn a queue of approved quotations into branded vertical videos. This workflow reads the next pending quote from Google Sheets, builds a two-scene video with Zvid, and writes the completed MP4 link back to the same row.

[Use the official n8n template](https://n8n.io/workflows/19632-create-daily-quote-videos-from-google-sheets-with-zvid/)

[Watch the tutorial](https://youtu.be/Ra6mPdmDDYs)

## What you get

- A 1080 × 1920 vertical MP4 with a quote scene, author card, music, and call to action.
- Five included background-and-music pairings, selected by date.
- Quote typography that adjusts by text length, with visual review still needed for unusually long text.
- An optional preview path and credit estimate before rendering.
- A daily 8 a.m. trigger; check your n8n timezone before activating it.
- A completed video link in the source Sheet and a gated Watch video step.

## Prerequisites

Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before configuring Zvid credentials. A workspace owner/admin may need to install it.

Create a key at [https://app.zvid.io/api-keys](https://app.zvid.io/api-keys), then add a **Zvid API** credential in n8n. Select it for validation, editor draft saving, render submission, and render status. These operations use the published Zvid node.

Connect a Google Sheets credential with read/write access and select the same spreadsheet and tab in the read and update steps.

## Set up the queue

Use these exact headers:

```text
Quote | Author | AuthorNote | Status | VideoUrl
```

Quote and author are required. Leave Status empty to make a row pending. Any nonempty status skips it. The workflow selects the first pending row and marks it done only on the successful completion path.

## Test and render

Customize the channel name and call to action in Config. Set `dryRun` to `true` for validation and an attempted editor draft save without a paid render or Sheet update.

When ready, set `dryRun` to `false`. This is the shipped default and rendering spends credits. A verified short sample produced a 10.8-second video with an 11-credit quote; use the current validation result for your own project.

Review the completed video before publishing. The workflow does not post to social accounts. Do not sort or delete Sheet rows during execution, avoid overlapping runs, and inspect an existing job before retrying a timeout.

## Run the design in Node.js

The [Node.js example](https://github.com/Zvid-io/workflow-examples/tree/main/workflows/daily-quote-reels) uses the same project builder with a local CSV queue. It does not connect to Google Sheets or provide its own scheduler.

[Read the Zvid documentation](https://docs.zvid.io). Support: [https://zvid.io/contact](https://zvid.io/contact).
