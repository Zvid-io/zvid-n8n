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
as a monthly subscription. Here every photo gets a smooth cinematic push, and the
photo scenes step through a four-part motion cycle built from three push depths,
four wipe directions and two type sides — so on a five-photo listing (the cap) no
two photo scenes share a move, and no two cuts in a row use the same wipe. The
push is always a centred push *in*: the renderer's zoom takes a depth and nothing
else, so there is no pan and no zoom-out to alternate with. `kenBurnsDepth` is one
number in `Config`; the softer and stronger steps are derived from it.

**One fact per scene, and only facts you actually have.** Beds, baths and sq ft
rotate through the photo scenes as an oversized serif numeral, with the facts you
have *not* just been shown on a muted rail beneath — so the spotlighted number
never appears twice on one screen. Nothing is invented and nothing is rounded —
the numbers on screen are the numbers in the row. A row with no beds/baths/sqft
puts the price in that slot instead (and then all your facts ride the rail); a
row with neither is just the photography.

**Type scales with content, and it was checked at both extremes.** A short address
sets at 76 px; a 70-character one steps down to 46 px, re-flows onto two lines, and
the price banner above it moves with it. The spotlight numeral is bottom-aligned on
a fixed baseline, so a one-character `6` and an eleven-character `$12,450,000` sit
on the same line and the label below never shifts. The agent card's seam moves with
the contact block, so the card stays balanced whether the agent is "Dana Whitfield"
(62 px), "Alexandra Constantinescu" (52 px) or a 28-character double-barrelled name
(44 px). All three tiers, and the 2-photo minimum, were rendered and checked
frame-by-frame on the production renderer.

**The top rail never smears across a cut.** The address line lives at the same
height in every scene, so a crossfade between two *different* strings would
superimpose them for the whole 0.55 s overlap. Where the string changes — the
brokerage line into the address, the address into the closing rail — the outgoing
copy leaves before the overlap starts and the incoming one arrives after it ends.
Where it does not change (photo to photo) the rail simply stays put and the cut is
seamless.

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

   Spell the `Status` header exactly like that. *Mark listing done* writes back to
   a column of that name, so a sheet headed `status` or `STATUS` would look like
   "every row is still pending" and re-render the same listing every day. *Pick
   next listing* stops the run with a rename message if it finds a case variant.

   **Only use photography and a portrait you have the rights to.** The reel prints
   exactly what the row says: a stock person's face in `AgentPhotoUrl` ends up
   captioned with your agent's name, phone number and brokerage, and a brokerage
   name you do not represent in `brandName` ends up over a price you set. Both
   attach someone else's likeness or trademark to a claim they never made. If you
   have no portrait, leave `AgentPhotoUrl` empty and take the monogram.
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
| `brandName` | `Elderwyn & Vane` | Your brokerage — the default is a placeholder name, replace it. Sets the hero kicker and the last line of the agent card. |
| `listedLabel` | `JUST LISTED` | The hero chip. Upper-cased automatically. |
| `agentLabel` | `YOUR AGENT` | Small label above the agent's name. |
| `ctaText` | `Book a viewing` | Text inside the agent-card pill. |
| `contactUrl` | `https://elderwynvane.example/listings` | Shown as a bare domain under the CTA — no `https://` prefix on screen. |
| `currencySymbol` | `$` | Prefixed to a plain-number `Price`. |
| `serifFont` / `uiFont` | `Playfair Display` / `Manrope` | Serif carries the address, spotlight numerals and agent name; sans carries labels, chips, rails and the CTA. One font per text element. |
| `inkColor` / `creamColor` | `#14110E` / `#F6F1E8` | Near-black ground and warm off-white type. |
| `brandColor` / `accentColor` | `#1F3D34` / `#C6A15B` | Estate green for the price banner and CTA pill; gold for the accents, spotlight numerals and rings. |
| `kenBurnsDepth` | `1.14` | The cinematic push, clamped to `1`–`1.6`. `1` is a static frame; `1.14` is a slow 14% push over the scene. A softer step (half the travel) and a stronger one (1.4×, also capped at `1.6`) are derived from it and cycled across the scenes. |
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
two-photo listing runs 12.5 s (**13 credits**, quoted) and a five-photo one runs
22.4 s (**23 credits**, quoted). *Validate project
(free)* runs before every render and returns the exact quote for your listing —
reported as `creditsCharged` in the run summary — but the render then proceeds
automatically. Set `dryRun: true` if you want the number *without* the render.

## How it works

| Node | What it does |
| --- | --- |
| **Source?** | Routes on `Config.source` — Google Sheets (default) or Airtable. |
| **Read listings sheet** | Reads every row; the sheet node also emits each row's `row_number`. |
| **Pick next listing** | Keeps the first row whose `Status` is empty. No such row → the run ends with a friendly "nothing to render today" summary instead of an error. If the status header is spelled `status` or `STATUS` it stops the run and asks you to rename it, rather than treating every row as pending and re-rendering the same listing daily. |
| **Fetch Airtable listings / Pick Airtable listing** | The `source: "airtable"` branch. Rendered record ids are remembered in workflow static data so the same listing is not repeated. |
| **Normalize listing** | One shape for both sources. Data column names are matched case- and punctuation-insensitively, so `Sq Ft`, `SqFt` and `sqft` all work, and `Beds`/`Bedrooms` are interchangeable. (`Status` and `VideoUrl` are the exception — those are written back, so they must match exactly.) Missing `Address` or fewer than two photo URLs fails loudly, naming the row and what is missing. |
| **Check music / Music guard** | HEAD-checks the music bed and its `content-length`. Unreachable, an HTTP error, or over `maxMusicBytes` → the video renders **without** music rather than failing the run. |
| **Build project JSON** | The whole design lives here: scene timing and transition padding, the four-step motion cycle (depth / wipe / type side), the fact rotation and its rail, the staggered top rail, the adaptive type ramps, the content-driven agent-card seam, scrim calibration, HTML-escaping of every sheet value, and the API's `name` character rules. |
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
- **Rights and likeness.** Use your own listing photography, or images you are
  licensed to use commercially. `AgentPhotoUrl` should be *that agent's* portrait —
  a stock headshot rendered under a real name, phone number and brokerage is
  someone's likeness attached to a claim they never made. Same for `brandName`: put
  your brokerage there, not one you do not represent. The monogram fallback exists
  so an empty `AgentPhotoUrl` is always a safe answer.

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
| `Your sheet's status column is headed "…"` | The header must be exactly `Status` — that is the column *Mark listing done* writes back to. Rename it and re-run. |
| The same listing renders every day | The row is not being marked. Check that the sheet has a `Status` column spelled exactly like that and that the Google credential on *Mark listing done* can write. Until the write-back lands, the row stays pending and the next run picks it again. |
| A stock face or a brokerage you do not represent ends up on the card | The reel prints whatever the row and `Config` say. Put your own agent's portrait in `AgentPhotoUrl` (or leave it empty for the monogram) and your own brokerage in `brandName`. |
| A photo is missing from the reel | Only `Photo1`–`Photo5` are read, and only cells starting with `http://` or `https://`. A Google Drive *sharing* link is a web page, not an image — use a direct image URL. |
| Photos look cropped | Every photo is center-cropped to 9:16 with `cover`. Put the subject near the centre, or use portrait crops for the scenes you care most about. |
| `Zvid rejected the project` | The message lists the offending fields. If you edited the builder, note the API only allows letters, digits, spaces, `_` and `-` in `name`, and rejects `audios[].track`. |
| Video rendered without music | Intentional. The music URL was unreachable, returned an error, or was over `maxMusicBytes` — `Run summary.music` says which. A missing soundtrack beats a missing video. |
| Every scene looks the same | `kenBurnsDepth` is `1` (static), which collapses all three derived depths onto each other. Set it back to `1.14`, or higher for a stronger push (max `1.6`). The wipe direction and type side still alternate. |
| The photos zoom *in* every time | That is the renderer: `zoom` takes a depth and nothing else, so there is no pan and no zoom-out to alternate with. The variety comes from the three push depths, the four wipe directions and the two type sides. |
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
  farm runs) from the builder's real output, three times:
  - **default** — 4 photos, `$749,000`, full beds/baths/sqft rotation, monogram
    agent card, 62 px agent name — 19.1 s, 5 scenes, 38 frames.
  - **stress** — 5 photos (the cap), a 70-character address at 46 px on two lines,
    `$12,450,000`, `6 bd / 5.5 ba / 8,200 sqft`, the price-takes-the-spotlight
    scene, the ellipsised top rail, a 24-character agent name at 52 px and a phone
    number with an extension — 22.4 s, 6 scenes, 45 frames.
  - **minimal** — the 2-photo minimum, a row with **no** beds/baths/sqft **and no
    price** so the photo scene is just the photography, a 28-character agent name
    at the 44 px tier, and the `<img>` portrait branch — 12.5 s, 3 scenes,
    25 frames.

  **All 108 extracted frames were reviewed** (2 fps) plus **24 exact-timestamp
  grabs** — all 11 transition midpoints, all three final frames, and ten extra
  grabs either side of the rail-change cuts to confirm the staggered rail: no
  clipping, no overflow, no text touching a safe edge, no low-contrast type over
  either a bright white interior or a dusk exterior, no duplicated numerals, no
  superimposed rail strings at any cut, no broken animation states, every value
  substituted.
- **Remote validation against the live API** (`POST /api/render/validate/api-key`
  via MCP with `remote: true`) on all three payloads, each sent in full with the
  real SVG bodies: default `valid: true`, **0 errors, 0 warnings**,
  `creditsRequired: 20`, resolved duration 19.1 s; stress `valid: true`, 0/0,
  `creditsRequired: 23`, 22.4 s; minimal `valid: true`, 0/0, `creditsRequired: 13`,
  12.5 s. All three 1080×1920, schema **1.0.0**.
- **Every media URL HEAD-checked**: all five listing photos and the abstract
  portrait placeholder returned `200 image/jpeg`, and the music bed returned `200 audio/mpeg`
  at 1,556,480 bytes — comfortably under the 5 MB plan cap the guard enforces. The
  fixtures use invented brokerage names and a deliberately abstract stone texture in
  the portrait slot: no real brand and no identifiable person appears in any frame.
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
