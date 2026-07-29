# New listing to a cinematic property reel

[`zvid-real-estate-listing-video.json`](zvid-real-estate-listing-video.json)

Every morning: take the first listing in your sheet that has no `Status` yet, turn
its photos into a 1080×1920 property reel with Zvid — a slow cinematic push across
the hero shot, one photo scene per remaining picture, and an agent card to close —
then write the finished video URL back to that row and mark it `done`. Paste a
week of listings once; the workflow consumes one row per day.

```
Schedule ─▶ Config ─▶ Read listings sheet ─▶ Pick first empty-Status row
        ─▶ Normalize + music guard ─▶ Build project ─▶ Validate (free)
        ─▶ Render ─▶ Mark listing done + VideoUrl ─▶ ▶ Watch video
```

## Why this one is different

**The zoom is the product.** Listing-video tools sell "Ken Burns on your photos"
as a monthly subscription. Here every photo gets a smooth cinematic push, and
consecutive scenes alternate between the full push and a gentler one, alternate
the wipe direction, and alternate the side the type sits on — so a five-photo
listing never shows you the same move twice. `kenBurnsDepth` is one number in
`Config`.

**One fact per scene, and only facts you actually have.** Beds, baths and sq ft
rotate through the photo scenes as an oversized serif numeral with the other two
on a muted rail beneath. Nothing is invented and nothing is rounded — the numbers
on screen are the numbers in the row. A row with no beds/baths/sqft puts the price
in that slot instead; a row with neither is just the photography.

**Type scales with content, and it was checked at both extremes.** A short address
sets at 76 px; a 70-character one steps down to 46 px, re-flows onto two lines, and
the price banner above it moves with it. The spotlight numeral is bottom-aligned on
a fixed baseline, so a one-character `6` and an eleven-character `$12,450,000` sit
on the same line and the label below never shifts. The agent card's seam moves with
the contact block, so the card stays balanced whether the agent is "Dana Whitfield"
or "Alexandra Constantinescu". All of it verified frame-by-frame on the production
renderer with a 4-photo and a 5-photo listing.

**The sheet is the queue *and* the log.** `Status` empty = pending; after a real
render the row holds `done` plus the video URL. Dry runs never touch the sheet, and
a failed render leaves the row pending so tomorrow retries it.

**Missing agent photo is a designed state, not a hole.** No `AgentPhotoUrl` gets a
monogram medallion built from the agent's initials, in the same gold ring as the
portrait — not a grey avatar placeholder.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Google account | For the two Google Sheets nodes (read the queue, write back the result). |
| Listing photos | Public `https` image URLs, at least two per listing. |

No LLM, no voice service, no stock-media account. The music bed is one pinned,
size-checked URL in `Config`, and the whole design lives in one code node.

## Setup

1. **Import** `zvid-real-estate-listing-video.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Validate project (free)*, *Save draft to
   editor*, *Submit render* and *Get render status*.
3. **Google Sheets credential** — attach it to *Read listings sheet* and *Mark
   listing done*, and pick your spreadsheet + tab in both nodes.
4. **Create the sheet** with this exact header row:

   | Address | City | Price | Beds | Baths | Sqft | Photo1 | Photo2 | Photo3 | Photo4 | Photo5 | AgentName | AgentPhone | AgentPhotoUrl | Status | VideoUrl |
   | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

   `Address` and at least two `Photo` cells are required; everything else is
   optional and the layout closes up when it is missing. Leave `Status` and
   `VideoUrl` empty. Type plain numbers in `Price` and `Sqft` (`749000`, `2840`) —
   the builder formats them as `$749,000` and `2,840`. Anything you type that
   already carries a symbol, a suffix or a range is printed exactly as typed.
5. **Open `Config`** — set `brandName` (your brokerage), `contactUrl`, and the two
   brand colours. Everything else works out of the box.
6. **Run it.** The workflow renders for real out of the box, so **the first run
   spends credits — about 20** for a four-photo listing. When it finishes, click
   **`▶ Watch video`** to play the reel inside n8n.

   Prefer to preview for free first? Set `dryRun: true` in `Config` before that
   first run: you get the exact credit cost and an **`editorLink`** that opens the
   draft in the Zvid editor, with nothing spent and nothing written to the sheet.
7. **Activate.** One listing goes out per day at 9am.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base. |
| `editorUrl` | `https://editor.zvid.io` | Used to build the dry-run `editorLink`. |
| `source` | `sheet` | `sheet` (Google Sheets) or `airtable` (see below). |
| `airtableBaseId` / `airtableTable` / `airtableView` | `""` | Only for `source: "airtable"`. Base id is the `app…` segment of your Airtable URL. |
| `brandName` | `Halstead & Vane` | Your brokerage. Sets the hero kicker and the last line of the agent card. |
| `listedLabel` | `JUST LISTED` | The hero chip. Upper-cased automatically. |
| `agentLabel` | `YOUR AGENT` | Small label above the agent's name. |
| `ctaText` | `Book a viewing` | Text inside the agent-card pill. |
| `contactUrl` | `https://halsteadvane.example/listings` | Shown as a bare domain under the CTA — no `https://` prefix on screen. |
| `currencySymbol` | `$` | Prefixed to a plain-number `Price`. |
| `serifFont` / `uiFont` | `Playfair Display` / `Manrope` | Serif carries the address, spotlight numerals and agent name; sans carries labels, chips, rails and the CTA. One font per text element. |
| `inkColor` / `creamColor` | `#14110E` / `#F6F1E8` | Near-black ground and warm off-white type. |
| `brandColor` / `accentColor` | `#1F3D34` / `#C6A15B` | Estate green for the price banner and CTA pill; gold for the accents, spotlight numerals and rings. |
| `kenBurnsDepth` | `1.14` | The cinematic push, clamped to `1`–`1.6`. `1` is a static frame; `1.14` is a slow 14% push over the scene. Alternate scenes use a gentler push derived from this. |
| `musicUrl` | a pinned calm piano bed | Empty renders without music. |
| `musicVolume` | `0.12` | The bed sits low by design. |
| `maxMusicBytes` | `5242880` | Music over this (or unreachable) is dropped, and the video renders anyway. |
| `statusDoneValue` | `done` | What gets written to `Status` after a successful render. |
| `dryRun` | `false` | `false` (default) renders for real. `true` gives a free pass that validates the payload, quotes the credits and saves a draft you can watch in the editor — no credits, no sheet write. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost per video

The live validator quoted **20 credits** for the default four-photo listing
(19.1 s). Length — and therefore cost — follows the photo count: the reel is
`4.4 s` of hero + `3.3 s` per remaining photo + `4.8 s` of agent card, so a
two-photo listing runs 12.5 s and a five-photo one runs 22.4 s. *Validate project
(free)* runs before every render and returns the exact quote for your listing —
reported as `creditsCharged` in the run summary — but the render then proceeds
automatically. Set `dryRun: true` if you want the number *without* the render.

## How it works

| Node | What it does |
| --- | --- |
| **Source?** | Routes on `Config.source` — Google Sheets (default) or Airtable. |
| **Read listings sheet** | Reads every row; the sheet node also emits each row's `row_number`. |
| **Pick next listing** | Keeps the first row whose `Status` is empty. No such row → the run ends with a friendly "nothing to render today" summary instead of an error. |
| **Fetch Airtable listings / Pick Airtable listing** | The `source: "airtable"` branch. Rendered record ids are remembered in workflow static data so the same listing is not repeated. |
| **Normalize listing** | One shape for both sources. Column names are matched case- and punctuation-insensitively, so `Sq Ft`, `SqFt` and `sqft` all work, and `Beds`/`Bedrooms` are interchangeable. Missing `Address` or fewer than two photo URLs fails loudly, naming the row and what is missing. |
| **Check music / Music guard** | HEAD-checks the music bed and its `content-length`. Unreachable, an HTTP error, or over `maxMusicBytes` → the video renders **without** music rather than failing the run. |
| **Build project JSON** | The whole design lives here: scene timing and transition padding, the alternating zoom/direction/side scheme, the fact rotation, the adaptive type ramps, the content-driven agent-card seam, scrim calibration, HTML-escaping of every sheet value, and the API's `name` character rules. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — without spending credits. Failures surface as a field list. |
| **Dry run?** | Routes on `Config.dryRun`. It is `false` by default, so the normal path is straight to *Submit render*. |
| **Save draft to editor** | **Only when `dryRun: true`.** Saves a free draft and returns `editorLink` (`https://editor.zvid.io/?project=…`). Best-effort: a hiccup here never hides the dry-run report. |
| **Dry run summary** | **Only when `dryRun: true`.** Reports the quoted credits, `editorLink` and warnings, and leaves the sheet untouched so the next real run picks the same listing. |
| **Submit render / Wait / Get render status** | Paid render plus a poll loop. |
| **Still rendering?** | Fails fast when the job reports `failed` and stops the loop at `timeoutMinutes`. |
| **Sheet mode? / Mark listing done** | Updates exactly the picked row (matched on `row_number`): `Status` = `done`, `VideoUrl` = the finished MP4. Airtable runs skip this node. A failed render never reaches it, so the row stays pending and tomorrow's run retries it. |
| **Run summary** | `videoUrl`, `jobId`, the listing's facts, which portrait was used, whether music made it in, and `creditsCharged`. |
| **▶ Watch video** | Downloads the finished MP4 as binary so n8n plays it inline in the output panel — click the node to watch the reel, or use its download button. Never fails the run: it retries a few times (the CDN can 404 for a moment right after a render completes) and then continues regardless, since the row is already written by this point. |

## Photos

- **Public `https` URLs.** The renderer fetches them directly — no auth, no signed
  URLs that expire between the sheet edit and the run.
- **`Photo1` is the hero** (and is reused, softly pushed, behind the agent card).
  `Photo2`–`Photo5` become one scene each. Extra photos are ignored; five is the
  cap, chosen for pacing rather than by a plan limit — these are images, not video
  elements, so the free plan's five-video cap does not apply here.
- **Any aspect ratio works.** Photos are center-cropped to 9:16 with `cover`, never
  stretched. Landscape MLS shots crop gracefully; ~1080 px on the short edge or
  better keeps the cinematic push sharp.
- **Fair-housing reminder.** The reel prints only the numbers in your row plus the
  labels in `Config`. Keep `listedLabel`, `ctaText` and the address fields factual —
  listing marketing is regulated, and this workflow will publish whatever you type.

## Sheet today, your CRM tomorrow

Set `source: "airtable"`, fill `airtableBaseId` / `airtableTable`, and attach a
**Bearer Auth** credential holding an Airtable personal access token to *Fetch
Airtable listings*. Field names match the sheet headers. Airtable mode is
read-only: rendered record ids are remembered in workflow static data, but nothing
is written back — add an HTTP Request `PATCH` node after *Run summary* if you want
the video URL stored.

For real MLS data, point *Fetch Airtable listings* at any JSON feed returning
records with these fields — a SimplyRETS sandbox, your IDX provider, or your own
API — and adjust *Pick Airtable listing* to match its response shape.

## Publishing (optional tail)

The required path ends with the URL in your sheet. To auto-publish, extend after
*Mark listing done*:

- **YouTube Shorts** — HTTP Request node (GET `videoUrl`, response format *File*)
  → native **YouTube** node (Video → Upload). Needs YouTube OAuth2.
- **Instagram / TikTok / multi-platform** — pass `videoUrl` to a scheduler such as
  Blotato, Buffer or Metricool over their HTTP API; they take a public video URL
  directly.
- **The agent** — Slack/Email node sending `videoUrl` to whoever posts it, or
  straight to the seller.

These stay out of the required path so the import runs with a Zvid key and a Google
account, nothing else. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and
replace the render HTTP nodes with the native **Zvid** node + **Zvid Trigger**
(render webhook), which removes the poll loop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Sheet row N is missing …` | The first empty-`Status` row has no `Address`, or fewer than two `https` photo URLs. Fill it in, or put anything in its `Status` to skip it. |
| Run says `nothing to render` | Every row has a `Status`. Add fresh listing rows with `Status` empty. |
| A photo is missing from the reel | Only `Photo1`–`Photo5` are read, and only cells starting with `http://` or `https://`. A Google Drive *sharing* link is a web page, not an image — use a direct image URL. |
| Photos look cropped | Every photo is center-cropped to 9:16 with `cover`. Put the subject near the centre, or use portrait crops for the scenes you care most about. |
| `Zvid rejected the project` | The message lists the offending fields. If you edited the builder, note the API only allows letters, digits, spaces, `_` and `-` in `name`, and rejects `audios[].track`. |
| Video rendered without music | Intentional. The music URL was unreachable, returned an error, or was over `maxMusicBytes` — `Run summary.music` says which. A missing soundtrack beats a missing video. |
| Every scene looks the same | `kenBurnsDepth` is `1` (static). Set it back to `1.14`, or higher for a stronger push (max `1.6`). |
| Price shows as typed, not formatted | The builder only formats values that are purely digits, dots, commas and spaces. `749000` becomes `$749,000`; `749k`, `$749,000` and `700-800k` are printed verbatim. |
| Agent card shows initials, not a photo | `AgentPhotoUrl` is empty or is not an `http(s)` URL. The monogram is the designed fallback. |
| Long address is cut with `…` on the top rail | The one-line rail truncates at a word boundary past ~44 characters. The full address still appears in full on the hero scene. |
| Render failed and the row stayed pending | Intentional — the row is only marked `done` after a successful render, so the next run retries it. The error message carries the job's `failedReason`. |
| Wrong row updated | Do not sort or delete rows while a run is in flight; the update matches on the `row_number` captured at read time. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a day never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Verified

n8n **2.29.10** node types and versions (every node resolves in a stock install;
the two Google Sheets nodes use the same shapes as the other templates in this
series). Here is exactly what was verified before release:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the render
  farm runs) from the builder's real output, twice: the default fixture (4 photos,
  `$749,000`, agent portrait — 19.1 s, 5 scenes) and a stress fixture (5 photos, a
  70-character address, `$12,450,000`, `6 bd / 5.5 ba / 8,200 sqft`, a 24-character
  agent name, a phone number with an extension, and **no** agent photo so the
  monogram branch runs — 22.4 s, 6 scenes). **All 83 extracted frames were
  reviewed** (2 fps) plus 11 exact-timestamp grabs at every transition midpoint and
  both final frames: no clipping, no overflow, no text touching a safe edge, no
  low-contrast type over either a bright white interior or a dusk exterior, no
  broken animation states, every value substituted.
- **Remote validation against the live API** (`POST /api/render/validate/api-key`
  via MCP with `remote: true`) on the default payload: `valid: true`, **0 errors,
  0 warnings**, `creditsRequired: 20`, resolved duration 19.1 s at 1080×1920,
  schema **1.0.0**.
- **Every media URL HEAD-checked** at authoring time: all six listing/portrait
  photos returned `200 image/jpeg`, and the music bed returned `200 audio/mpeg` at
  1,556,480 bytes — comfortably under the 5 MB plan cap the guard enforces.
- **The embedded code node is byte-identical** to the frame-reviewed standalone
  builder (asserted programmatically, not by eye), and a simulated execution of the
  node's JS against mocked n8n globals reproduced the exact reviewed payload.
- **Structural checks** on the workflow JSON: parseable, all connections resolve,
  no unreachable nodes, all code nodes compile, unique names/ids, core-only node
  types, no credentials blocks, Zvid calls on Header Auth.

**Not executed:** the workflow has not been run inside n8n yet, so the Google
Sheets read/write-back and the Airtable branch are verified by node-parameter shape
only. Nothing in the publish/delivery tail was exercised — those nodes are
documented, not shipped.
