# Bulk product videos for a whole catalog

[`zvid-bulk-catalog-videos.json`](zvid-bulk-catalog-videos.json)

Point this workflow at a Google Sheet of products and it turns every row that
doesn't have a video yet into a branded ~11-second vertical promo — hero shot,
numbered feature list, price with strikethrough compare-at, CTA end card —
submits the whole batch as **one Zvid bulk render**, then writes each finished
video's URL back into its own row. The sheet is both the queue and the archive.

```
Schedule (weekly) / Manual ─▶ Config ─▶ Read sheet ─▶ Filter rows needing videos
        ─▶ Build ONE templated payload + per-row variables ─▶ Validate (free)
        ─▶ dry run? (opt-in) ─▶ quote + editor draft
                      OR      ─▶ Bulk render ─▶ Poll batch
        ─▶ Write VideoUrl back to each row ─▶ Summary  +  ▶ Watch video
```

## What changed

Two recent updates to this template:

1. **It renders for real on the first run.** `dryRun` now defaults to `false`
   in `Config`, so importing and executing produces actual videos and spends
   credits. The dry-run branch is untouched and still there — it is simply
   **opt-in** now: set `dryRun: true` in `Config` for the free validate +
   quote + editor-draft pass.
2. **New `▶ Watch video` node at the end.** It downloads each finished MP4 and
   n8n plays it inline, one item per delivered video — no copying URLs out of
   the summary JSON.

## Why this one is different

**One API call for the whole catalog.** Most row-by-row automations loop a
render call per product and babysit N jobs. Zvid's bulk endpoint takes one
shared payload plus a tiny `variables` set per row, validates every item
server-side, and queues them together — this workflow submits 20 products as
one request and polls one batch id.

**The design survives ugly data.** Product names in real catalogs run from
"Aurora Ceramic Pour-Over Set" to "The Everyday Anywhere Ultralight Packable
Travel Jacket — Limited Edition Colorway". The builder auto-sizes the display
font per row (96 px down to 44 px), sizes the feature list to its longest
entry, shows the strikethrough + "You save $16" treatment only when
CompareAtPrice is genuinely higher than Price, and HTML-escapes every cell so
"Fog & Field <Kit>" can't break the markup. Both extremes were rendered on the
production engine and frame-reviewed.

**Bad rows never sink the batch.** A row missing an image or a feature is
skipped with a named reason; an item the API rejects at submit time is
reported per row while the rest render. Failed renders are refunded
automatically and keep an empty `VideoUrl`, so the next scheduled run retries
exactly the rows that still need a video — the sheet converges on "done".

**Results are mapped by job id, not name.** Job names stay `NULL` until a job
completes, so matching outputs by name mid-flight silently drops rows. The
workflow keeps the `jobId → row` map from the submit response and uses that to
write URLs back.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test a small batch. |
| Google Sheets credential | The standard n8n Google Sheets OAuth credential — used to read the catalog and write the URLs back. |

That's it — the product images come from your own sheet, and the background
music is a plain audio URL you can swap in `Config`.

## The sheet

Header row (exact names, one product per row):

```
Product | Price | CompareAtPrice | Feature1 | Feature2 | Feature3 | ImageUrl1 | ImageUrl2 | CtaText | VideoUrl
```

- **`VideoUrl` empty** → the row needs a video. **Filled** → skipped forever
  (clear the cell to re-render).
- **Required per row:** `Product`, `Price`, `ImageUrl1`, all three features.
  Rows missing any of these are skipped with a reason in the run output.
- **`Product` must be unique.** It is the key the finished URL is written back
  with, so a name appearing on two rows is skipped with that reason rather
  than risking the URL landing on the wrong row.
- **Optional:** `CompareAtPrice` (adds strikethrough + savings when higher
  than `Price`), `ImageUrl2` (falls back to `ImageUrl1`), `CtaText` (falls
  back to `ctaFallback`).
- Prices can be `68`, `$68` or `129.50` — bare numbers get `currencySymbol`
  prefixed, formatted ones are kept as typed.
- Image URLs should be direct `https://…` image links (portrait or square
  crops look best; the hero is full-bleed 1080×1920, the detail image sits in
  a 660×680 arch).

## Setup

1. **Import** `zvid-bulk-catalog-videos.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name
   `x-api-key`, value = your Zvid key. Attach it to *Validate project (free)*,
   *Save draft to editor*, *Submit bulk render* and *Get batch status*.
3. **Google Sheets credential** — attach it to *Get catalog rows* AND
   *Write links to sheet*, and pick your spreadsheet + tab in **both** nodes.
4. **Open `Config`** and set `brandName`, `website`, the four colours,
   `tagline` and `ctaFallback`.
5. **Run it.** The workflow renders for real out of the box, so **the first
   run spends credits** — about **12 per product**, i.e. up to ~60 for a full
   default batch of 5 rows (see [Cost](#cost)). Each finished video's URL is
   written back to its row; click **▶ Watch video** to play them inside n8n.
   *Prefer a free look first?* Set `dryRun: true` in `Config` and run once —
   you get the exact per-video price, the whole-catalog total and an
   **`editorLink`** that opens the first product's video as a draft in the
   Zvid editor, with nothing charged. Set it back to `false` to render.
6. Activate the workflow for the weekly schedule.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `brandName` / `website` | `ATELIER AURA` / `atelieraura.example` | Shown in every scene. |
| `accentColor` / `accentSoft` / `creamColor` / `inkColor` | terracotta palette | The whole design recolours from these four. |
| `kicker` | `JUST DROPPED` | Small line above the product name. |
| `featureHeading` | `WHY YOU'LL LOVE IT` | Heading of the numbered list. |
| `dealKicker` | `FOR A LIMITED TIME` | Line above the price on the end card. |
| `tagline` | `Made to be used every day.` | Serif italic line on the end card. |
| `ctaFallback` | `Shop now` | Used when a row has no `CtaText`. |
| `font` / `serifFont` | `Archivo` / `Fraunces` | Google-font names. |
| `currencySymbol` | `$` | Prefixed onto bare-number prices. |
| `musicUrl` / `musicVolume` | a hosted CDN track / `0.16` | Swap for your own hosted audio URL, or set `musicUrl` to `""` for silent videos. Keep tracks under your plan's audio size cap (5 MB on free). |
| `heroSeconds` / `featureSeconds` / `ctaSeconds` | `3.6` / `4.6` / `4.2` | Scene lengths; ~11.4 s effective total after transition overlap. |
| `transitionSeconds` | `0.55` | Hero → features transition length. |
| `resolution` / `frameRate` | `instagram-reel` (1080×1920) / `30` | |
| `maxProducts` | `5` | Batch cap per run. **Free plans allow 5 items per bulk request** — raise this on a paid plan. Overflow rows are reported and picked up next run. |
| `bulkName` | `Catalog videos` | The batch's name in your dashboard. |
| `dryRun` | `false` | Renders for real by default — a run costs credits. Set it to `true` for a free pass that validates the batch, quotes the credits (per video and for the whole catalog) and saves the first product as a draft you can watch in the editor, without spending anything. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Batch poll loop. Raise `timeoutMinutes` for catalogs much larger than the default 5. |

## Cost

The production validator quotes **12 credits per video** at the default
~11-second 1080×1920 design, so a full default batch of 5 products is
**60 credits**. Every run still starts with the free
`POST /api/render/validate/api-key` step, which returns the exact per-video
price for *your* rows (the workflow multiplies it by the row count into
`totalCredits`) — but with the default `dryRun: false` the render then
proceeds automatically instead of stopping there. Set `dryRun: true` if you
want the quote without the spend. Failed renders are refunded automatically.

## How it works

| Node | What it does |
| --- | --- |
| **Get catalog rows** | Reads every row (plus its `row_number`) from your sheet. |
| **Rows needing videos** | Keeps rows with an empty `VideoUrl`, validates required columns, reports skipped rows with reasons, and caps the batch at `maxProducts`. |
| **Build project JSON** | Builds ONE templated Zvid project (brand baked in, row data as `{{placeholders}}`) and one `{ variables, name }` item per row — with per-row font auto-sizing, price/savings math, compare-at logic and HTML escaping. |
| **Validate project (free)** | Runs the first row through `POST /api/render/validate/api-key` — the same resolve+validate pipeline every bulk item runs — and returns the per-video credit price. Failures surface as a field list. |
| **Dry run?** | Branches on `Config.dryRun`. It is `false` by default, so runs normally go straight to the bulk render; the two nodes below only run when you set it to `true`. |
| **Save draft to editor / Dry run summary** | *Only when `dryRun: true`.* Saves the first product's resolved video as a free draft and reports the quote, the per-row plan, skipped rows and the `editorLink` ([editor.zvid.io](https://editor.zvid.io)). Nothing is charged. |
| **Submit bulk render** | `POST /api/render/bulk/api-key` with `{ name, payload, items }` — one call for the whole batch. |
| **Check batch accepted** | Reads the 202: keeps `bulkId` and the `jobId → row` map, and names any per-item rejections by sheet row. |
| **Wait / Get batch status / Batch finished?** | Polls `GET /api/render/bulk/{id}` every `pollSeconds` until `bulk.status` leaves `processing`. |
| **Still rendering?** | Fails fast when the whole batch failed; stops the loop at `timeoutMinutes` with a message that names how many finished (a timeout does not cancel renders — they finish server-side at [app.zvid.io](https://app.zvid.io)). |
| **Collect video links** | Maps completed jobs back to sheet rows via the submit-time map and emits `{ Product, VideoUrl }` items. |
| **Write links to sheet** | Google Sheets *update* matching on `Product` — only the `VideoUrl` cell changes. (Not `row_number`: the Sheets node re-fetches its column list whenever the node is opened and always returns `row_number` as *removed*, so configuring the node in the UI silently re-points "column to match on" at another column, the update matches nothing, and the branch ends with no error. `Product` is a real header column and survives that refresh.) |
| **Run summary** | Videos delivered/failed (with per-row reasons), credits actually consumed, how many sheet rows were actually written, rows skipped before submit, and what's left for the next run. It **fails loudly** if videos rendered but the sheet write matched nothing. |
| **▶ Watch video** | Downloads each finished MP4 as binary (`responseFormat: file`) so n8n's output panel plays it **inline**, with a download button — one item per delivered video, no URL to copy. It branches off *Collect video links*, so it sees one item per catalog row rather than the single aggregate summary. It never fails a run: `onError: continueRegularOutput` plus 3 retries, because the CDN can 404 for a moment right after a render completes. |

## The video itself

Three scenes, image-only (no stock-video elements, so the free plan's 5-video
element cap is never a concern):

1. **Hero** — `ImageUrl1` full-bleed with a slow push-in, dark gradient,
   brand pill, kicker, auto-sized product name, accent underline.
2. **Features** — `ImageUrl2` in an arched frame with a tilted price badge,
   then the three features as a numbered editorial list. Font size adapts to
   the longest feature.
3. **End card** — accent field, serif tagline, big price (with strikethrough
   compare-at and a "You save …" pill when there's a real markdown), product
   name, CTA pill, website.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Nothing to do — every row already has a VideoUrl` | The catalog is fully rendered. Clear a `VideoUrl` cell to redo a row. |
| `No renderable rows: …` | Every pending row is missing required data; the message names the first problem. Check the run output's `rowsSkipped` for the rest. |
| `Zvid rejected the project (HTTP 400)` | The message lists the offending fields — usually a malformed image URL in the first pending row. |
| `Bulk limit exceeded` | `maxProducts` is above your plan's bulk item cap (5 on free plans). Lower it or upgrade. |
| `Insufficient credits` | The 402 names the exact total required. Nothing was queued or charged. |
| Some rows have no URL after a run | See `failed` in the run summary — each entry carries the row, product and reason. Those rows keep an empty `VideoUrl` and are retried next run; failed renders are refunded. |
| `did not finish within N minutes` | Big batch or busy queue. The renders continue server-side — check [app.zvid.io](https://app.zvid.io) before re-running (a re-run re-renders rows whose `VideoUrl` is still empty), or raise `timeoutMinutes`. |
| `The 'Sheet' … could not be found` | Pick the spreadsheet + tab in *both* Google Sheets nodes after importing. |
| `the sheet write matched no rows, so no VideoUrl was saved` | The *Write links to sheet* node lost its matching column — n8n re-points "Column to match on" whenever the node is reconfigured. Open it and set it back to **Product**. The videos are fine; their URLs are listed in `sheetUpdated` in the same error's run output, and the rows re-render on the next run anyway. |
| Wrong row got the URL | Two rows share the same `Product` name. The workflow normally skips those before rendering — check `rowsSkippedBeforeSubmit`. |
| `429` / `hourly_limit_exceeded` on submit | The batch exceeds what is left of your plan's hourly render limit (every item counts). The message names the remaining allowance and the reset time; lower the per-run cap or wait it out. Nothing is charged for a rejected submit. |

## Swapping pieces

- **Any data source** — Airtable, a database, a CSV: replace the two Google
  Sheets nodes and feed *Rows needing videos* objects with the same column
  names (plus some row key for your write-back).
- **Delivery tail** — after *Run summary*, add an email/Slack node with the
  delivered links. If you want the MP4 files themselves rather than URLs,
  *▶ Watch video* already downloads each one as binary — chain your upload or
  attachment node onto it.
- **Skip the polling loop** — on self-hosted n8n, install
  [`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid)
  and swap: *Validate project (free)* → **Zvid → Render → Validate**,
  *Submit bulk render* → **Zvid → Render → Create Bulk**, *Get batch status* +
  *Wait* → **Zvid Trigger** (render webhook). The HTTP nodes are deliberately
  core-only so the workflow also imports untouched on n8n Cloud.

## Verified

n8n node types and versions follow the same conventions as the rest of this
series (core nodes only; `httpRequest` 4.2, `code` 2, `set` 3.4, `if` 2.2,
`wait` 1.1, `googleSheets` 4.7).

**Rendered on the production engine, frame by frame.** Both fixture products —
the happy path ("Aurora Ceramic Pour-Over Set", $68 vs $84, three short
features) and the stress row (an 82-character product name, $129.50 with no
compare-at, one 112-character feature) — were built with the exact builder
embedded in the workflow, resolved with orch's real template engine, rendered
through the production `@zvid-io/zvid` renderer at 1080×1920, and every
extracted frame reviewed. That loop caught and fixed two real bugs before
ship: a boxed arch image with `resize:"cover"` covering the whole canvas, and
white hero text at marginal contrast over a white product photo.

**Validated against the live API.** The default fixture's resolved payload
passed `POST /api/render/validate/api-key` (via the Zvid MCP validator,
`remote: true`): `valid: true`, `creditsRequired: 12`, zero errors, **zero
layout warnings**, schema 1.0.0. The same pass caught that the production API
rejects `audios[0].track`, which the builder therefore does not send. The bulk
request body shape (`{ name, payload, items: [{ variables, name }] }`), the
202 response fields, the per-item error semantics, plan bulk-item caps and the
batch status endpoint were verified against the orch source
(`services/renderSubmission.js`, `controllers/bulkRender.controller.js`,
`routes/render.routes.js`).

**Not executed:** nothing in the publish/delivery tail — no social platform,
no email provider. Those nodes are documented, not exercised.

### Live n8n execution (2026-07-28)

Imported into **n8n 2.29.10** (self-hosted, Docker) with a Header Auth
credential holding a real Zvid API key, `dryRun: false`, and executed for
real. Every video below was downloaded from the CDN and reviewed frame by
frame at 2 fps.

- **Run**: green end to end. Two products submitted as **one** bulk render
  (`videosDelivered: 2`, `creditsPerVideo: 12`, `totalCredits: 24`), both
  `11.37 s`, 1080x1920 @30 fps, AAC audio.
- **Per-row branching proved itself live**: the product with a `CompareAtPrice`
  rendered the strikethrough plus "You save $16"; the product without one
  rendered the bare price with no savings pill — from the same template in the
  same batch.
- **Sheet round-trip**: each row received its own `VideoUrl`, matched back by
  `row_number` — the matching column *as the template shipped at the time*.
  See the note below: that match no longer survives configuring the node, and
  the write now matches on `Product`.
- **The returned `videoUrl` is a valid URL.** Project names are slugged, so the
  CDN filename carries no spaces and the link can be pasted straight into a
  publish node or `curl` (verified: HTTP 200 on the raw URL).

**Scope of that evidence after the recent changes.** The live run above was
executed with `dryRun: false` — exactly the path the workflow now takes by
default — so it stands unchanged, and flipping the default did not alter any
node it exercised. The **`▶ Watch video` node was added after that run**, so it
is *not* covered by the live evidence above: what is verified for it is that
n8n's output panel branches on binary mime type and plays `video/*` inline, and
that the Zvid CDN serves these files as `Content-Type: video/mp4`. The node has
not itself been executed in a live run.

**Sheet write-back reworked (2026-07-28).** The original template matched the
update on `row_number`, and that only ever worked because the live test
imported a pre-configured workflow. The Google Sheets node rebuilds its column
list from the sheet every time the node is opened, and that list always marks
`row_number` as *removed* — so the moment a user follows the setup steps and
picks their own spreadsheet in *Write links to sheet*, n8n drops the
`row_number` match and re-points it at another column. The update then matches
nothing, outputs zero items, and the branch simply stops: no URLs in the sheet,
no error, no summary. Reproduced in a live docker n8n (a run wrote both rows,
the node was opened, the next run wrote none). Three changes:

- the update matches on **`Product`**, a real header column that survives the
  refresh, and *Rows needing videos* now skips rows whose product name is not
  unique in the sheet, with that reason;
- *Write links to sheet* runs with `alwaysOutputData`, so a zero-match write no
  longer kills the branch silently;
- *Run summary* reports `sheetRowsWritten` and **throws** when videos rendered
  but nothing was written, listing the URLs so nothing is lost.

Verified live: the reworked write node, fed the exact items *Collect video
links* emits, matched and updated both catalog rows by product name and left
every other column untouched.
