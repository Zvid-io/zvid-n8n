# Flash sale alert: a price drop becomes a sale video *and* an email banner

[`zvid-flash-sale-alert.json`](zvid-flash-sale-alert.json)

Drop a price, get both creatives. One run turns a single price change into a
1080×1920 flash-sale video for socials **and** a 1200×628 still banner for the
email blast — same Zvid key, same run, both written back to your sheet. Sales are
time-sensitive; the creative is what makes you late. Runs from a Google Sheet out
of the box (no store needed), and watches a real Shopify catalogue when you flip
one Config key.

```
Schedule ─▶ Config ─▶ Source? ─┬─ sheet:   Read sale sheet ─▶ Pick next sale
                               └─ shopify: Poll price drops ─▶ Find price drops
        ─▶ Music guard ─▶ Build project JSON  (2 items: video + banner)
        ─▶ Validate (free) ─▶ Submit render ─▶ poll both jobs ─▶ Collect outputs
        ─▶ Mark sale done (VideoUrl + BannerUrl) ─▶ Email the banner (optional)
        ─▶ Run summary ─▶ ▶ Watch video  +  ▶ View banner
```

## Why this one is different

**Two deliverables, one builder, one credit-quoted run.** *Build project JSON*
returns **two items**: a video payload and a banner payload carrying
`type: "image"`. A still image is the same API, the same endpoint and the same
key — only the payload differs (no scenes, no audio, no timings). Everything
downstream runs once per item, so both are validated before either is paid for,
and *Render finished?* only advances when **both** jobs report `completed`. The
banner can never race ahead of the video into your sheet.

**No store required to try it.** `source` is `sheet` by default, so a spreadsheet
with one row is a complete working demo. The Shopify path is wired in and
documented as the production swap — flip `source` to `shopify`, add a token, and
it watches your catalogue itself.

**It refuses to lie about a sale.** Both prices must be above zero and `NewPrice`
must actually be lower than `OldPrice`, or the run fails loudly rather than
announcing a price *rise* — or, from a typo'd `-5`, a 102% discount. The percent
off is **rounded down, never up**: a 49.86% drop goes on screen as `-49% OFF`, so
the creative can only ever understate the deal. Prices can be written any way your
sheet already writes them (`129`, `129.00`, `$1,299.99`): the builder reads the
number for the maths and keeps your formatting on screen, and a bare number gets
your `currencySymbol` back rather than appearing as a naked `129` next to a `$40`
savings chip.

**Every headline and pill is measured before it is drawn.** The 62-character
product title in the stress fixture below steps down from 56px to 48px on the hook
scene and from 50px to 44px on the price scene instead of spilling; single-line
runs that still will not fit their pill —
a brand name past ~33 characters in the price-scene kicker, past ~35 in the banner
chip, past ~48 in the hook chip, or a CTA past ~30 characters on the banner and
~48 on the video — are trimmed with an ellipsis rather than clipped. Six of the
eight measured runs are pushed past their limit and cut in the `truncate` fixture
below, and every one of those cuts is rendered and frame-reviewed.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Google account | For the two Google Sheets nodes (read the queue, write both URLs back). |
| Shopify admin *(optional)* | Only for `source: "shopify"`. A custom-app token with `read_products`. |
| SMTP account *(optional)* | Only if you want the banner mailed out automatically. |

No LLM and no voice service — this is pure data → design.

## Setup

1. **Import** `zvid-flash-sale-alert.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Validate project (free)*, *Save draft to
   editor*, *Submit render* and *Get render status*.
3. **Google Sheets credential** — attach it to *Read sale sheet* and *Mark sale
   done*, and pick your spreadsheet + tab in **both** nodes.
4. **Create the sheet** with this exact header row:

   | Product | OldPrice | NewPrice | ImageUrl | EndsAt | Status | VideoUrl | BannerUrl |
   | --- | --- | --- | --- | --- | --- | --- | --- |

   `Product`, `OldPrice`, `NewPrice` and `ImageUrl` are required. `ImageUrl` must
   be a **public** image URL (Shopify's product CDN URLs are). `EndsAt` is free
   text (`Sunday 11:59 PM`) — leave it empty and no deadline strip is drawn at
   all. Leave `Status`, `VideoUrl` and `BannerUrl` empty.

   **Point `ImageUrl` at your own product photography.** Whatever is in that cell
   is rendered under your brand chip, your price and your discount badge, so a
   stock or press shot of somebody else's product — or any photo with a
   recognisable face in it — turns this into a trademark / likeness problem
   rather than a design choice. The workflow cannot detect that for you; it
   renders exactly the URL you give it.
5. **Open `Config`** — set `brandName`, `storeUrl` and `ctaText`. Colours, fonts
   and banner size all live there too.
6. **Run it.** The workflow renders for real out of the box, so **the first run
   spends credits — about 15** (14 for the video, 1 for the banner). When it
   finishes, click **`▶ Watch video`** and **`▶ View banner`** to see both files
   inside n8n.

   Prefer to preview for free first? Set `dryRun: true` in `Config` before that
   first run: you get both credit quotes and an **`editorLink`** per deliverable
   that opens the draft in the Zvid editor, with nothing spent, nothing written
   to the sheet and no email sent.
7. **Optional — mail the banner.** Put an address in `emailTo`, set `emailFrom`,
   and attach an SMTP credential to *Email the banner*. Gmail needs an **App
   Password** (Google Account → Security → 2-Step Verification → App passwords),
   host `smtp.gmail.com`, port `465`, SSL on.
8. **Optional — watch a real store.** Set `source: "shopify"` and fill
   `shopDomain` (`your-store.myshopify.com`). In Shopify admin go to **Settings →
   Apps and sales channels → Develop apps**, **Create an app**, **Configure Admin
   API scopes** and tick **`read_products`** (the only scope needed), then
   **Install app** and reveal the **Admin API access token** (`shpat_…`). Add a
   SECOND n8n **Header Auth** credential named `X-Shopify-Access-Token` with that
   token and attach it to *Poll price drops* only. No public URL, no app review.
9. **Activate.** It polls every hour.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base. |
| `editorUrl` | `https://editor.zvid.io` | Used to build the dry-run `editorLink`. |
| `source` | `sheet` | `sheet` reads the spreadsheet; `shopify` polls your catalogue instead. |
| `shopDomain` | `""` | `your-store.myshopify.com`. Only used when `source: "shopify"`. |
| `apiVersion` | `2024-07` | Shopify Admin API version in the poll URL. |
| `minDropPercent` | `5` | Shopify mode only: ignore drops smaller than this. |
| `defaultEndsAt` | `in 24 hours` | Shopify mode only — there is no deadline field in a product, so this text is used for the "ENDS …" strip. |
| `brandName` | `Kicklab` | Chip on the hook scene, kicker on the price scene, chip on the banner. |
| `storeUrl` | `kicklab.example` | Shown (scheme stripped) on the CTA scene; also the email button's link target. |
| `ctaText` | `Shop the sale` | Text inside the CTA pill on both the video and the banner. |
| `promoCode` | `""` | Optional. When set, a dashed "USE CODE" box appears on the CTA scene and the card grows to fit it. |
| `currencySymbol` | `$` | Used only when the sheet writes bare numbers with no symbol. |
| `inkColor` | `#0D0D0D` | Near-black base for the price and CTA scenes. |
| `urgencyAccent` | `#E11D2E` | The alarm red: hook background, deadline strip, banner wedge. |
| `brandAccent` | `#FFD54A` | The highlight: `SALE`, the new price, the percent-off burst, the CTA pill. |
| `textColor` | `#FFFFFF` | Primary type colour. |
| `mutedColor` | `#9CA3AF` | The struck-through old price and the footer line. |
| `displayFont` | `Anton` | Condensed display face for `FLASH SALE` and the prices. |
| `uiFont` | `Space Grotesk` | Everything else. One font per text element. |
| `bannerWidth` / `bannerHeight` | `1200` / `628` | Banner size. The composition is designed at 1200×628 and scales as a unit, so other sizes keep the layout instead of stretching. |
| `musicUrl` | a pinned bed | Music for the video. Empty renders silent. |
| `musicVolume` | `0.2` | The bed sits under the cut, not over it. |
| `maxMusicBytes` | `5242880` | Plan cap for an audio asset. A bigger or unreachable file renders **without** music rather than failing. |
| `emailTo` | `""` | Empty (default) skips the email step entirely. |
| `emailFrom` | `sales@yourstore.example` | Sender for the optional email. |
| `emailSubject` | `Flash sale: {product} is {discount}% off` | Supports `{product}`, `{discount}`, `{oldPrice}`, `{newPrice}`, `{brand}`. |
| `statusDoneValue` | `done` | Written to `Status` after a successful pair of renders. |
| `dryRun` | `false` | `false` (default) renders for real. `true` gives a free pass: both payloads validated, both credit costs quoted, both saved as drafts with an `editorLink` — no credits, no sheet write, no email. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost per video

The live validator quoted **14 credits** for the 13.4 s video and **1 credit**
for the 1200×628 banner — **15 for the pair**. Two deliverables mean **two
separate quotes and two separate charges**; the run summary reports the combined
figure as `creditsCharged`. *Validate project (free)* runs before both renders
and always returns the exact quote for your sale. Set `dryRun: true` if you want
the numbers *without* the renders.

## How it works

| Node | What it does |
| --- | --- |
| **Source?** | Routes on `Config.source`. `sheet` (default) uses the spreadsheet; `shopify` polls the catalogue. |
| **Poll price drops** | `GET /admin/api/{apiVersion}/products.json?limit=50` with the `X-Shopify-Access-Token` header. Retries 3×, never throws on an HTTP error — the next node turns status codes into readable messages. |
| **Find price drops** | Diffs every variant price against a snapshot in workflow static data. **The first run records a baseline and announces nothing — that is correct, not a bug.** From then on the biggest drop of at least `minDropPercent` wins. 401/403 becomes a scope-and-header fix-it message. |
| **Read sale sheet** | Reads every row; the sheet node also emits each row's `row_number`. |
| **Pick next sale** | Keeps the first row whose `Status` is empty. No such row → a friendly "nothing to announce" summary, not an error. A picked row missing a required column fails loudly *with the row number*. |
| **Check music** / **Music guard** | HEADs `musicUrl` and checks `content-length` against `maxMusicBytes`. Unreachable, 4xx or oversized → the video renders **without** music instead of not rendering at all. |
| **Build project JSON** | The whole design, and **two items out**. Price parsing and formatting, the percent-off maths (floored, never rounded up) and its sanity guards (both prices above zero, a real drop, at least 1%), the measured type ramps and their ellipsis fallback, the promo-code branch that grows the CTA card, HTML-escaping of all sheet/Shopify text, and the API's `name` character rules. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — without spending credits. Runs **once per item**, so a broken banner is caught before the video is paid for. Failures surface as a field list naming the deliverable. |
| **Dry run?** | Routes on `Config.dryRun`. It is `false` by default, so the normal path is straight to *Submit render*. |
| **Save draft to editor** / **Dry run summary** | **Only when `dryRun: true`.** Saves a free draft per deliverable and reports both quotes plus an `editorLink` each. Best-effort: a hiccup saving a draft never hides the report. The sheet is left untouched, so the next real run picks the same sale. |
| **Submit render** → **Attach job to item** | Submits once per item, then glues each `jobId` back onto the deliverable it belongs to (the render response replaces the item). |
| **Wait / Get render status / Merge job status** | Polls each job and re-pairs each status with its deliverable every lap. |
| **Render finished?** | True only when **every** job in the batch reports `completed`, so both deliverables move on together. |
| **Still rendering?** | Fails fast when either job reports `failed` (naming which one) and stops the loop at `timeoutMinutes`. The sheet row stays pending, so the next run retries the whole announcement. |
| **Collect outputs** | Folds the two finished jobs into ONE item carrying `videoUrl`, `bannerUrl` and the combined credit total, and builds the email subject/body here (a code node, where escaping is easy to get right) rather than inside an expression. |
| **Sheet mode?** / **Mark sale done** | Updates exactly the picked row (matched on `row_number`): `Status` = `done`, `VideoUrl` **and** `BannerUrl` filled. Skipped automatically in Shopify mode, where there is no row. |
| **Email the banner?** / **Email the banner** | Runs only when `emailTo` contains an `@`. The body embeds the rendered banner as its hero image, the old/new price line, a CTA button to `storeUrl` and a link to the video. A mail hiccup **never kills a finished render** — it continues on error and the summary still carries both URLs. |
| **▶ Watch video** / **▶ View banner** | Download the MP4 and the PNG as binary so n8n previews each inline — click either node after a run. Never fails the run: they retry a few times (the CDN can 404 for a moment right after a render completes) and then continue regardless, since the sheet is already written by this point. |

## Publishing (optional tail)

The required path ends with both URLs in your sheet and, optionally, in an inbox.
To go further, extend after *Run summary*:

- **YouTube Shorts / Reels** — HTTP Request node (GET `videoUrl`, response format
  *File*) → native **YouTube** node (Video → Upload). Needs YouTube OAuth2.
- **Instagram / TikTok / multi-platform** — pass `videoUrl` to a scheduler such as
  Blotato, Buffer or Metricool over their HTTP API; they take a public video URL
  directly.
- **Klaviyo / Mailchimp** — drop `bannerUrl` straight into a campaign template
  instead of using the built-in SMTP step.

These stay out of the required path so the import runs with a Zvid key and a
Google account, nothing else. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and
replace the render HTTP nodes with the native **Zvid** node + **Zvid Trigger**
(render webhook), which removes the poll loop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Row N is missing …` | The first empty-Status row is incomplete. Fill the named columns, or put anything in its `Status` to skip it. |
| Run says `nothing to announce` | Every row has a `Status`. Add a fresh row with `Status` empty. |
| `"X" is not a price drop` | `NewPrice` is not lower than `OldPrice`. The workflow refuses to announce a price rise as a sale. |
| `Both prices for "X" must be above zero` | A price cell is `0` or negative (usually a typo like `-5`). Without this guard the creative would advertise a discount over 100% at a price the sheet never wrote. |
| `"X" is only a 0.4% drop` | The drop is under 1%, which would render as `-0% OFF`. Announce a real cut, or leave the row's `Status` filled to skip it. |
| `Could not read the prices for "X"` | A price cell is not a number. Use `129`, `129.00` or `$1,299.99` — with or without a symbol. |
| The video shows a product that is not yours | `ImageUrl` pointed at someone else's product photo. Everything in that cell is rendered under your brand name, price and discount — use your own product photography, and avoid shots with recognisable people in them. |
| The percent on screen is 1 lower than you expected | Intentional. A 49.86% cut is floored to `-49% OFF` rather than rounded to 50%, so the creative never overstates the offer. |
| The first Shopify run announced nothing | Correct. `Find price drops` had no snapshot to compare against, so it recorded the baseline. The next poll announces real drops. |
| `Shopify rejected the token (HTTP 401)` | The custom app is missing the `read_products` scope, or the Header Auth credential's name is not exactly `X-Shopify-Access-Token`. |
| Two credit quotes / two charges on one run | Expected. The video and the banner are separate render jobs, billed separately (~14 + ~1). The summary reports the combined `creditsCharged`. |
| The video rendered silently | The music bed was unreachable, 4xx or over `maxMusicBytes`. `musicNote` in the summary says which. This is deliberate — a dead music URL never costs you the render. |
| No deadline strip on the video | `EndsAt` was empty for that row. Fill it, or set `defaultEndsAt` if you are in Shopify mode. |
| The email never arrived | `emailTo` has no `@` (the step is skipped by design), or the SMTP credential is missing. Gmail needs an **App Password**, not your account password. The step continues on error, so check the *Email the banner* node's output. |
| Render failed and the row stayed pending | Intentional — the row is only marked `done` after **both** renders succeed, so the next run retries the whole announcement. The message carries the job's `failedReason`. |
| Wrong row updated | Do not sort or delete rows while a run is in flight; the update matches on the `row_number` captured at read time. |
| `Zvid rejected the … payload` | The message lists the offending fields and names which deliverable broke. If you edited the builder, note the API only allows letters, digits, spaces, `_` and `-` in `name`, and rejects `audios[].track`. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run an hour never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Verified

n8n **2.29.10** node types and versions (every node resolves in a stock install;
the two Google Sheets nodes use the same shapes as the other templates in this
series). Here is exactly what was verified:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the
  render farm runs) from the builder's real output — **eight renders, four video
  and four banner**: a default fixture (30% off, `$52`→`$36`, a 15-character
  deadline → 13.4 s video + 1200×628 banner); a stress fixture (a 62-character
  product name, `$1,099.00`→`$551.00` — a 49.86% cut floored to 49% — a
  24-character brand name, a 26-character CTA and a promo code, which grows the
  CTA card); a minimal fixture (bare numeric prices with no symbol, **no**
  `EndsAt`, **no** promo code, **no** music and a 1080×1080 banner, which
  exercises the banner's rescale path); and a truncate fixture (a 52-character
  brand name, a 53-character CTA and a 24-character deadline, which fire the
  ellipsis fallback in six of the eight measured runs: the hook chip, the
  price-scene kicker, the video CTA pill, the banner brand chip, the banner CTA
  pill and the banner deadline chip — the video's own deadline strip and savings
  chip still fit at full size).
- **Every extracted frame was reviewed** — 2 fps across all four videos (27
  frames each) plus exact-timestamp grabs at both transition midpoints, the first
  frame and the final frame (4 each), so **124 frames in total**, read as
  full-resolution 2×2 composites, alongside all four rendered PNGs. No clipping,
  no overflow, no text touching an edge, no low-contrast text, no broken
  animation states, and no unsubstituted variables. Defects found and fixed this
  way: the banner's CTA arrow could touch a short CTA label; the banner's frame
  and wedge letterboxed instead of filling a non-1200×628 canvas; a canvas taller
  than the 1200×628 design ratio left a dead band top and bottom (the urgency
  wedge now grows into it and a mirrored accent band fills the top); and a sale
  with no `EndsAt` left a dead band under the savings pill on the price scene
  (the pill now drops into the space the deadline strip would have used).
- **Remote validation against the live API** (`POST
  /api/render/validate/api-key` via MCP with `remote: true`) on **both distinct
  payload shapes plus the rescale variant**. The video payload: `valid: true`,
  **0 errors, 0 warnings**, `creditsRequired: 14`, resolved duration 13.4 s,
  schema **1.0.0**. The `type: "image"` banner at 1200×628: `valid: true`,
  **0 errors, 0 warnings**, `creditsRequired: 1`, schema **1.0.0**. The same
  banner at 1080×1080: `valid: true`, **0 errors, 0 warnings**,
  `creditsRequired: 1`. All eight built payloads (four video, four banner) were
  additionally run through the shared Zvid schema validator, which mirrors the
  backend rules and carries the layout lint: **8/8 valid, zero errors and zero
  warnings**.
- **Every pinned URL HEAD-checked**: the default music bed (HTTP 200,
  `audio/mpeg`, 3,695,616 bytes — under the 5 MB plan cap), the stress fixture's
  bed (HTTP 200, `audio/mpeg`, 3,722,344 bytes) and all four fixture product
  images (HTTP 200, `image/jpeg`). Every fixture product photo was also opened at
  full size and checked for logos, wordmarks, legible signage and faces before
  use, so no rendered frame puts a real brand or a real person under this
  template's fictional store, price and discount.
- **The embedded code node is byte-identical** to the frame-reviewed standalone
  builder (asserted programmatically after the workflow file is written, not by
  eye), and the shipped `Config` is asserted equal to the config the fixtures
  used on every key.
- **52 simulated-execution checks** run the shipped workflow's own code nodes
  against mocked n8n globals. The sheet happy path rebuilds the *exact* video and
  banner payloads that were rendered and frame-reviewed, byte for byte. Beyond
  that: an all-`done` sheet stops friendly and an incomplete row throws with its
  row number; the Shopify poll records a baseline on the first run, announces the
  next real drop, ignores a sub-`minDropPercent` change, never treats a price
  *rise* as a sale, and turns 401 / unreachable / image-less products into fix-it
  messages; a 9 MB, 404 or unreachable music URL drops `audios[]` instead of
  failing; a price rise, a negative price, a zero price, a sub-1% drop, an
  unreadable price and a missing product image are all refused by the builder,
  and a 49.86% cut comes back as 49; untrusted product text is HTML-escaped into both the
  payload and the email body, and accented/punctuated titles still slug to the
  API's `name` charset; the two-item loop zips jobIds onto the right deliverables,
  re-pairs statuses every lap, loops while one job is still active, throws on
  `failed` naming which deliverable broke, and gives up at `timeoutMinutes`; a
  completed job returning no URL fails rather than writing a blank row; and the
  summary emits exactly one item carrying both URLs.
- **Structural checks** on the workflow JSON: parseable, all 29 connection
  sources resolve, all code nodes compile, unique names/ids, core-only node types
  (`manualTrigger`, `scheduleTrigger`, `set`, `if`, `code`, `httpRequest`,
  `googleSheets`, `wait`, `emailSend`, `stickyNote`), no `credentials` blocks
  anywhere, and every Zvid call on Header Auth.

**Not executed:** the Shopify path was never called against a live store — there
is no Shopify credential in this environment. Its request shape follows Shopify's
public Admin API and its response handling is covered by the simulation above,
but treat the field mapping as documented, not measured. Nothing in the
publish/delivery tail was executed either: no social platform, and the SMTP
*Email the banner* step was never sent through a real mail server — its subject,
body and escaping are covered by the simulation, the delivery is not.
