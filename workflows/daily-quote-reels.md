# Daily motivational quote videos from a Google Sheet

[`zvid-daily-quote-reels.json`](zvid-daily-quote-reels.json)

Every morning: take the first quote in your sheet that has not been used yet,
render it as a polished 1080×1920 quote reel with Zvid, then write the finished
video URL back to that row and mark it `done`. Paste a month of quotes once; the
workflow consumes one row per day.

```
Schedule ─▶ Config ─▶ Read sheet ─▶ Pick first empty-Status row
        ─▶ Build project ─▶ Validate (free) ─▶ Render ─▶ Mark row done + VideoUrl
        ─▶ ▶ Watch video
```

## What changed

- **It renders for real on the first run.** `dryRun` now defaults to `false`, so
  importing and running spends credits (~11 for a default reel). The dry run is
  still there as an opt-in: set `dryRun: true` in `Config` for a free pass that
  validates, quotes the cost and saves a draft you can watch in the editor.
- **New `▶ Watch video` node at the end.** It downloads the finished MP4 as
  binary; n8n branches on the binary mime type and renders `video/*` inline, and
  the CDN serves these as `Content-Type: video/mp4` — so clicking the node plays
  the video inside n8n, with a download button. No copying URLs out of a JSON blob.

## Why this one is different

**It does not look automated.** Most quote-video automations put white text on a
random dark photo. This template adapts a designed layout from Zvid's library:
portrait b-roll behind a serif italic quote inside a hairline frame, an oversized
quotation glyph, then an author end-card with a divider, optional author note, CTA
pill and channel handle.

**A different look every day, deterministically.** The build step carries a pool of
five curated background clips, each paired with a music bed — misty forest, ember
ink, rain on a window, a sea of clouds, a calm shore. `dayOfYear % 5` picks the
entry, so consecutive days never repeat within a year, re-running the same day
reproduces the same video, and there is no random flakiness to debug. (The one
seam: a leap year ends on day 366, and `366 % 5 == 1 % 5`, so that New Year's Day
reuses New Year's Eve look. Set `poolIndexOverride` for that one day if it
matters.) Every URL in the pool was
verified reachable and probed for length/size when the template was authored, and
brighter clips carry a stronger darkening overlay so the text always has contrast.

**Type scales with content.** A 70-character quote sets at 62 px; a 220-character
quote steps down to 42 px and the layout re-centres, so nothing ever clips or
collides — verified frame-by-frame on the production renderer with both extremes.
Long author names shrink to fit the end card the same way.

**The sheet is the queue *and* the log.** `Status` empty = pending; after a real
render the row holds `done` plus the video URL. Dry runs never touch the sheet.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Google account | For the two Google Sheets nodes (read the queue, write back the result). |

No LLM, no voice service, no stock-media accounts — the backgrounds and music are
pinned, pre-verified URLs inside the build step.

## Setup

1. **Import** `zvid-daily-quote-reels.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Validate project (free)*, *Save draft to
   editor*, *Submit render* and *Get render status*.
3. **Google Sheets credential** — attach it to *Read quote sheet* and *Mark row
   done*, and pick your spreadsheet + tab in both nodes.
4. **Create the sheet** with this exact header row:

   | Quote | Author | AuthorNote | Status | VideoUrl |
   | --- | --- | --- | --- | --- |

   Fill `Quote` + `Author` (AuthorNote optional — it becomes the small line under
   the author's name on the end card). Leave `Status` and `VideoUrl` empty.
5. **Open `Config`** — set `channelName` and `ctaText`. Everything else works out
   of the box.
6. **Run it.** The workflow renders for real out of the box, so **the first run
   spends credits — about 11** for a default-length quote. When it finishes, click
   **`▶ Watch video`** to play the reel inside n8n.

   Prefer to preview for free first? Set `dryRun: true` in `Config` before that
   first run: you get the exact credit cost and an **`editorLink`** that opens the
   draft in the Zvid editor, with nothing spent and nothing written to the sheet.
7. **Activate.** It posts itself a fresh quote video to the sheet every day at 8am.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `channelName` | `@stillmind.daily` | Watermark on the quote scene + handle on the end card. |
| `ctaText` | `Follow for a daily reset` | Text inside the end-card pill. |
| `quoteFont` / `uiFont` | `Playfair Display` / `Inter` | Serif carries the quote and author name; sans carries the handle, note and CTA. One font per text element. |
| `paperColor` / `mutedColor` / `inkColor` | `#F0ECE3` / `#B9B4A6` / `#14181A` | Warm paper on near-black ink. |
| `musicVolume` | `0.15` | The bed sits low by design. |
| `poolIndexOverride` | `-1` | `-1` rotates daily; `0`–`4` pins one look (0 mist-forest, 1 ember-ink, 2 rain-window, 3 cloud-sea, 4 calm-shore). |
| `backgroundVideoOverride` | `""` | Your own portrait clip (~1080×1920, ≥ 10 s). Empty = use the pool. |
| `musicUrlOverride` | `""` | Your own music URL. Empty = use the pool pairing. |
| `statusDoneValue` | `done` | What gets written to `Status` after a successful render. |
| `dryRun` | `false` | `false` (default) renders for real. Set it to `true` for a free pass that validates the payload, quotes the credits and saves a draft you can watch in the editor without spending anything — no credits, no sheet write. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost per video

The live validator quoted **11 credits** for the default ~10.8 s reel and about
**14** for a 220-character quote (~13.6 s). *Validate project (free)* still runs
before every render and still returns the exact quote for your quote — it is
reported as `creditsCharged` in the run summary — but the render now proceeds
automatically. Set `dryRun: true` if you want the number *without* the render.

## How it works

| Node | What it does |
| --- | --- |
| **Read quote sheet** | Reads every row; the sheet node also emits each row's `row_number`. |
| **Pick next quote** | Keeps the first row whose `Status` is empty. No such row → the run ends with a friendly "nothing to render today" summary instead of an error. Missing `Quote`/`Author` on the picked row fails loudly with the row number. |
| **Build project JSON** | The whole design lives here: daily pool rotation, adaptive type ramp (62→42 px), author-card layout that re-flows when a note is present, HTML-escaping of user text, and the API's `name` character rules. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — without spending credits. Failures surface as a field list. |
| **Dry run?** | Routes on `Config.dryRun`. It is `false` by default, so the normal path is straight to *Submit render*. |
| **Save draft to editor** | **Only when `dryRun: true`.** Saves a free draft and returns `editorLink` (`https://editor.zvid.io/?project=…`). Best-effort: a hiccup here never hides the dry-run report. |
| **Dry run summary** | **Only when `dryRun: true`.** Reports the quoted credits, `editorLink` and warnings, and leaves the sheet untouched so the next real run picks the same quote. |
| **Submit render / Wait / Get render status** | Paid render plus a poll loop. |
| **Still rendering?** | Fails fast when the job reports `failed` and stops the loop at `timeoutMinutes`. |
| **Mark row done** | Updates exactly the picked row (matched on `row_number`): `Status` = `done`, `VideoUrl` = the finished MP4. A failed render never reaches this node, so the row stays pending and tomorrow's run retries it. |
| **▶ Watch video** | Downloads the finished MP4 as binary so n8n plays it inline in the output panel — click the node to watch the reel, or use its download button. Never fails the run: it retries a few times (the CDN can 404 for a moment right after a render completes) and then continues regardless, since the row is already written by this point. |

## Publishing (optional tail)

The required path ends with the URL in your sheet. To auto-publish, extend after
*Mark row done*:

- **YouTube Shorts** — HTTP Request node (GET `videoUrl`, response format *File*)
  → native **YouTube** node (Video → Upload). Needs YouTube OAuth2.
- **Instagram / TikTok / multi-platform** — pass `videoUrl` to a scheduler such as
  Blotato, Buffer or Metricool over their HTTP API; they take a public video URL
  directly.
- **Human in the loop** — Slack/Email node sending `videoUrl` to whoever posts.

These stay out of the required path so the import runs with a Zvid key and a
Google account, nothing else. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and
replace the render HTTP nodes with the native **Zvid** node + **Zvid Trigger**
(render webhook), which removes the poll loop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Row N is missing Quote or Author` | The first empty-Status row is incomplete. Fill it, or put anything in its `Status` to skip it. |
| Run says `nothing to render` | Every row has a `Status`. Add fresh rows with `Status` empty. |
| `Zvid rejected the project` | The message lists the offending fields. If you edited the builder, note the API only allows letters, digits, spaces, `_` and `-` in `name`, and rejects `audios[].track`. |
| Same background every day | You pinned `poolIndexOverride`. Set it back to `-1`. |
| Render failed and the row stayed pending | Intentional — the row is only marked `done` after a successful render, so the next run retries it. The error message carries the job's `failedReason`. |
| Wrong row updated | Do not sort or delete rows while a run is in flight; the update matches on the `row_number` captured at read time. |
| Override video freezes at the end | `backgroundVideoOverride` clips must be at least ~10 s; the quote scene is capped at 10 s when an override is set. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a day never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Verified

n8n **2.29.10** node types and versions (every node resolves in a stock install;
the two Google Sheets nodes use the same shapes as the other templates in this
series). It was also executed end-to-end inside n8n — see **Live n8n execution**
below. Before that run, here is exactly what was verified:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the
  render farm runs) three times from the builder's real output: the default
  fixture (10.8 s, mist-forest pool entry), a 218-character stress quote with a
  41-character author name plus author note (13.6 s, rain-window entry), and the
  brightest pool entry (calm-shore) to prove the overlay keeps text legible.
  **Every extracted frame was reviewed** (2 fps plus exact-timestamp grabs at the
  transition midpoint and end-card): no clipping, no overflow, no low-contrast
  text, no broken animation states.
- **Remote validation against the live API** (`POST /api/render/validate/api-key`
  via MCP with `remote: true`) on the default payload: `valid: true`, **0 errors,
  0 warnings**, `creditsRequired: 11`, schema **1.0.0**. Two real API rules were
  caught and fixed this way (`name` character set, `audios[].track` rejected).
- **Every pinned URL probed at authoring time** — the five background clips
  (dimensions, duration, size), both music beds (48.6 s / 1.5 MB and 115.5 s /
  3.7 MB, well under plan audio caps) and the end-card image.
- **The embedded code node is byte-identical** to the frame-reviewed standalone
  builder (asserted programmatically, not by eye), and a simulated execution of
  the node's JS against mocked n8n globals produced the exact reviewed payload.
- **Structural checks** on the workflow JSON: parseable, all connections resolve,
  all code nodes compile, unique names/ids, core-only node types, Zvid calls on
  Header Auth.

**Not executed:** nothing in the publish/delivery tail — no social platform,
no email provider. Those nodes are documented, not exercised.

### Live n8n execution (2026-07-28)

Imported into **n8n 2.29.10** (self-hosted, Docker) with a Header Auth
credential holding a real Zvid API key, `dryRun: false`, and executed for
real. Every video below was downloaded from the CDN and reviewed frame by
frame at 2 fps.

This run used `dryRun: false` — the path the workflow now takes by default — so
the evidence below still describes the shipped default. Two honest caveats: the
`▶ Watch video` node was added *after* this run, so it is not covered by this
live evidence (it is verified structurally only, and against the same node
contract already exercised in the Day 29 template); and the run predates the
`dryRun` default flip, which changed only which branch runs first, not the
render path itself.

- **Run**: green end to end. Rendered `10.80 s`, 1080x1920 @30 fps, AAC audio,
  3.0 MB, **11 credits**.
- **Rotation proved itself live**: the run landed on day-of-year 209, which
  selects pool entry 4 (the bright calm-shore clip) — the quote and
  attribution stayed legible under its overlay, matching the pre-release
  brightness test.
- **Sheet round-trip**: the first empty-`Status` row came back `Status = done`
  with its `VideoUrl` filled; the second row was left untouched, so exactly
  one quote is consumed per run.
- **The returned `videoUrl` is a valid URL.** Project names are slugged, so the
  CDN filename carries no spaces and the link can be pasted straight into a
  publish node or `curl` (verified: HTTP 200 on the raw URL).
