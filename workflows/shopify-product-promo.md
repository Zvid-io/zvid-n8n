# Turn every new Shopify product into a promo video

[`zvid-shopify-product-promo.json`](zvid-shopify-product-promo.json)

Stores add products constantly and nobody has time to cut a video for each one.
This workflow takes one product — from a Google Sheet out of the box, or from
your real Shopify catalogue in production — and renders it as a designed
1080×1920 promo (~14 s): a hook scene with the product on a lit backdrop, an
offer scene with the tagline, price and a computed **SAVE x%** badge, then a
shop-now end card. In sheet mode the finished video URL is written back to the
row and the row is marked `done`.

```
Manual / every 30 min ─▶ Config ─▶ Source? ─┬─ sheet ─▶ Read sheet ─▶ Pick next product ─┐
                                            └─ shopify ─▶ Poll new products ─────────────┤
   ┌────────────────────────────────────────────────────────────────────────────────────┘
   └▶ New product? ─▶ Check music ─▶ Build project ─▶ Validate (free) ─▶ Render
                  ─▶ Mark row done + VideoUrl ─▶ Run summary ─▶ ▶ Watch video
```

## Why this one is different

**No store needed to try it.** `source` is `sheet` out of the box, so the
template does something useful the minute it is imported — a Zvid key and a
Google account is the whole shopping list. The Shopify path is wired in and
documented; flipping `source` to `shopify` and attaching one more Header Auth
credential is the entire switch. Nothing else in the workflow changes, because
both sources are normalised to the same product shape before the design step.

**Product photography is never cropped — and it still moves.** Store photos
arrive in every aspect ratio there is — square, 4:5, 2:3, wide lifestyle shots
— and cropping one is how an automation ruins a product page. Every photo is
placed *contained* inside a designed plate: the whole shot fits, centred, never
cropped and never stretched. The plate carries the composition, and a hairline
is drawn on the photo's real edge so a white studio cut-out still reads as a
mounted print on the cream plate instead of dissolving into it. On top of that
each photo drifts slowly inside its plate for the whole scene — the hook rises
and pushes in, the offer slides across and pulls back — with every keyframe at
or under 1:1 inside the box, so the movement can never crop the product. With a
second photo the offer scene shows a different angle; with one photo the
opposite drift in a differently-shaped plate is what re-frames the shot, so the
common one-photo product does not read as the same still shown twice.

**The layout re-flows instead of breaking.** A 33-character product name sets
at 92 px; a 70-character one steps down to 58 px across three lines and the
block underneath moves out of the way. Past the smallest step the name itself
is trimmed on a word boundary and marked with an ellipsis, so even a
255-character title (the Shopify Admin API maximum) cannot push the footer off
the canvas. The end card measures its own stack — monogram ring, brand, name,
price, button, domain — and centres it, so a short name and a long one are both
composed rather than one of them leaving a third of the frame empty.
`CompareAtPrice` filled in gets a struck-through price and a **SAVE x%** badge
computed from the two numbers; left empty, both disappear and the scene
re-balances. All of those branches were rendered and reviewed frame by frame.

**It cannot be misconfigured into an illegible video.** Chip, badge and button
labels pick whichever of your ink / paper / black / white contrasts best
against `brandAccent`, and the accent used as *text* on the dark ground is
nudged towards the light until it clears 3.5:1. A pale yellow brand accent gets
dark labels automatically; a deep navy one gets light labels. You set two
colours and the system stays readable.

**Turning it on never floods your feed.** The first Shopify run only remembers
which product is newest and renders nothing, so activating the workflow does
not announce your entire back catalogue. The marker moves *after* a successful
render, so a failed render retries the same product on the next poll instead of
silently skipping it.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Google account | For the two Google Sheets nodes (read the queue, write back the result). Sheet mode only. |
| Shopify custom-app token | **Optional** — only for the production path. Admin API access token with `read_products`. |

No LLM, no voice service, no stock-media account. Product photos come from your
sheet or your store; the music bed is a pinned instrumental whose URL sits in
`Config`.

**Use photographs of your own products.** The promo prints your store name,
your price and your discount over whatever photo the row points at, so a stock
shot of somebody else's branded product ends up advertising their trademark
under your claims. Point `ImageUrl1` / `ImageUrl2` at your own product
photography (or your Shopify CDN), never at a stock image of a branded item.

## Setup

**Sheet mode — no store needed, about three minutes.**

1. **Import** `zvid-shopify-product-promo.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name
   `x-api-key`, value = your Zvid key. Attach it to *Validate project (free)*,
   *Save draft to editor*, *Submit render* and *Get render status*.
3. **Google Sheets credential** — attach it to *Read products sheet* and *Mark
   row done*, and pick your spreadsheet + tab in both nodes.
4. **Create the sheet** with this exact header row:

   | Title | Price | CompareAtPrice | ImageUrl1 | ImageUrl2 | Tagline | Status | VideoUrl |
   | --- | --- | --- | --- | --- | --- | --- | --- |

   `Title` and `ImageUrl1` are required; everything else is optional. Leave
   `Status` and `VideoUrl` empty on rows waiting to be rendered. Image URLs
   must be **public `http(s)` URLs** — Shopify CDN links (`cdn.shopify.com/…`)
   are, and so is anything on your own CDN. A Google Drive share link is not.
   Use your own product photography (see the note above Setup).
5. **Open `Config`** — set `brandName`, `brandColor`, `brandAccent`, `storeUrl`
   and `shopNowText`. Everything else works out of the box.
6. **Run it.** The workflow renders for real out of the box, so **the first run
   spends credits — about 15** for a default-length promo. When it finishes,
   click **`▶ Watch video`** to play it inside n8n.

   Prefer to preview for free first? Set `dryRun: true` in `Config` before that
   first run: you get the exact credit cost and an **`editorLink`** that opens
   the draft in the Zvid editor, with nothing spent and nothing written to the
   sheet. Set it back to `false` to render.

**Shopify mode — the production path.**

7. In your Shopify admin: **Settings → Apps and sales channels → Develop apps**
   → *Create an app* → **Configure Admin API scopes** → tick **`read_products`**
   → *Install app* → reveal the **Admin API access token**. It starts with
   `shpat_` and is shown **once** — copy it immediately.
8. Add a second n8n **Header Auth** credential: name `X-Shopify-Access-Token`,
   value = that token. Attach it to *Poll new products* only. (The shipped file
   carries no credentials of any kind — you attach your own.)
9. In `Config` set `source: "shopify"` and `shopDomain` to just the subdomain
   (`my-shop`, **not** `my-shop.myshopify.com`).
10. **Activate.** *Poll new products* asks for the five newest products every 30
    minutes and compares the newest id against the last one announced, kept in
    the workflow's static data. **The first run only seeds that marker and
    renders nothing** — the next product you publish gets the first video.

This is the *webhookless* install on purpose: no app review, no public URL, no
Shopify Trigger node, and it works identically on n8n Cloud and self-hosted.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base. |
| `editorUrl` | `https://editor.zvid.io` | Used to build the dry-run `editorLink`. |
| `source` | `sheet` | `sheet` (demo path, no store needed) or `shopify` (polls your catalogue). |
| `shopDomain` | `""` | Shopify mode only. Just the subdomain: `my-shop`. |
| `apiVersion` | `2024-07` | Shopify Admin API version used in the poll URL. |
| `brandName` | `NORTHBOUND` | The chip at the top of the hook scene, the footer of the offer scene, the eyebrow on the end card, and the source of the end-card monogram (its first letter). |
| `brandHandle` | `@northbound.supply` | Optional watermark fallback — used in the hook footer and the end-card footer only when `storeUrl` is empty. Rendered and frame-reviewed in the stress fixture. |
| `storeUrl` | `https://northbound-supply.myshopify.com` | Full URL or bare domain. Only the **host** is ever drawn — no protocol, no tracking query string. |
| `brandColor` | `#141A20` | The dark ink the whole system is built on. |
| `brandAccent` | `#E1623C` | Kicker chip, SAVE badge, monogram, shop-now button, hairlines. Label colours are derived from it for contrast. |
| `titleFont` | `Fraunces` | Serif: product name and tagline. Any Google Fonts family. |
| `uiFont` | `Archivo` | Sans: chips, price, footer, button. One font per text element. |
| `newArrivalKicker` | `NEW ARRIVAL` | The chip above the product name. Upper-cased for you. |
| `shopNowText` | `Shop the drop` | The label inside the end-card button. |
| `currencySymbol` | `$` | Prepended only when the value you supplied carries no symbol of its own — `"189.00"` becomes `$189.00`, `"£189"` is left alone. |
| `fallbackTagline` | `Just landed — available now.` | Used when the row (or the Shopify description) has no usable text. |
| `maxTaglineChars` | `90` | Longer taglines are trimmed on a word boundary and marked with an ellipsis. Very long product *names* are trimmed the same way, but only after the type ladder has stepped all the way down to 44 px. |
| `statusDoneValue` | `done` | What gets written to `Status` after a successful render. Sheet mode only. |
| `musicUrl` | a pinned instrumental bed | Swap in your own URL, or set it to `""` to render silent. |
| `musicVolume` | `0.16` | The bed sits low by design. |
| `maxMusicBytes` | `5242880` | Plan cap for an audio asset (5 MB). Over it, the promo renders **without** music rather than failing. |
| `dryRun` | `false` | `false` (default) renders for real. `true` gives a free pass that validates the payload, quotes the credits and saves a draft you can watch in the editor — no credits, no sheet write, no Shopify marker moved. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost per video

The live validator quoted **15 credits** for the reviewed default promo
(14.30 s) and the same **15** for the no-discount variant. Every promo is the
same 14.30 s regardless of how much text it carries, so 15 is the figure for
this template. *Validate project (free)* runs before every render and returns the exact
figure for your product as `creditsCharged` in the run summary, but the render
then proceeds on its own. Set `dryRun: true` if you want the number *without*
the render.

## How it works

| Node | What it does |
| --- | --- |
| **Source?** | Routes on `Config.source`. `sheet` (default) → the Google Sheets path; anything else → the Shopify poll. Both branches converge on the same normaliser. |
| **Read products sheet** | Reads every row; the sheet node also emits each row's `row_number`. |
| **Pick next product** | Keeps the first row whose `Status` is empty. A row missing `Title` or `ImageUrl1` fails loudly *with its row number* rather than rendering something broken. |
| **Poll new products** | `GET /admin/api/{apiVersion}/products.json?limit=5&order=created_at+desc` on `{shopDomain}.myshopify.com`, authenticated with the `X-Shopify-Access-Token` header credential. Retries three times on a network error. |
| **New product?** | The one place both sources become the same object — `{ title, price, compareAtPrice, imageUrls[], tagline, rowNumber?, productId?, source }`. In Shopify mode it also de-duplicates against the last announced product id, strips the HTML out of `body_html` (Shopify sends real markup) and decodes its entities before any of it reaches the design. HTTP 401/403/404/429 each get their own actionable message, and a call that came back with **no HTTP status at all** (a mistyped or empty `shopDomain`, a shop that is unreachable) is raised as an error rather than reported as an empty catalogue. |
| **Product found?** | No product waiting → the run ends with a friendly *Nothing to render* summary instead of an error, so a scheduled run stays green. |
| **Check music** | A `HEAD` on `musicUrl`. Never fails the run: an unreachable URL, an HTTP error or a file over `maxMusicBytes` renders the promo **without** music, and the summary says why. |
| **Build project JSON** | The whole design lives here: the contained-photo plates and their two opposite drifts, the type ramp and its trim-to-fit backstop, the SAVE-percent maths, the contrast-derived label colours, the self-measuring end-card stack, HTML-escaping of all product text, and the API's `name` character rules. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — without spending credits. Failures surface as a field list. |
| **Dry run?** | Routes on `Config.dryRun`. It is `false` by default, so the normal path is straight to *Submit render*. |
| **Save draft to editor** | **Only when `dryRun: true`.** Saves a free draft and returns `editorLink` (`https://editor.zvid.io/?project=…`). Best-effort: a hiccup here never hides the dry-run report. |
| **Dry run summary** | **Only when `dryRun: true`.** Reports the quoted credits, `editorLink` and warnings, and leaves the sheet and the Shopify marker untouched so the next real run picks the same product. |
| **Submit render / Wait / Get render status** | Paid render plus a poll loop. |
| **Still rendering?** | Fails fast when the job reports `failed` and stops the loop at `timeoutMinutes`. |
| **Sheet mode?** | Sheet runs go through the write-back; Shopify runs go straight to the summary. |
| **Mark row done** | Updates exactly the picked row (matched on `row_number`): `Status` = `done`, `VideoUrl` = the finished MP4. A failed render never reaches this node, so the row stays pending and the next run retries it. |
| **Run summary** | One item carrying `videoUrl`, `jobId`, `creditsCharged`, `savePercent`, `photosUsed` and the rest. In Shopify mode this is also where the announced product id is remembered — only after a successful render. |
| **▶ Watch video** | Downloads the finished MP4 as binary so n8n plays it inline in the output panel. Never fails the run: it retries a few times (the CDN can 404 for a moment right after a render completes) and then continues regardless, since the write-back has already happened. |

## Publishing (optional tail)

The required path ends with the URL in `Run summary` (and in your sheet). To
auto-publish, extend after *Mark row done*:

- **Instagram / TikTok / multi-platform** — pass `videoUrl` to a scheduler such
  as Blotato, Buffer or Metricool over their HTTP API; they take a public video
  URL directly, no download step needed.
- **YouTube Shorts** — HTTP Request node (GET `videoUrl`, response format
  *File*) → native **YouTube** node (Video → Upload). Needs YouTube OAuth2.
- **Product page / paid social** — drop `videoUrl` into your theme or your ad
  platform through its own API.

These stay out of the required path so the import runs with a Zvid key and a
Google account, nothing else. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and
replace the render HTTP nodes with the native **Zvid** node + **Zvid Trigger**
(render webhook), which removes the poll loop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Row N has no Title` / `Row N has no ImageUrl1` | The first empty-`Status` row is incomplete. Fill it, or put anything in its `Status` to skip it. |
| `Row N: ImageUrl1 is not a public http(s) URL` | The cell holds a file path, a Drive share page or a `data:` URI. Product images must be public `http(s)` URLs the renderer can fetch — Shopify CDN links are. |
| Run says `Nothing to render` in sheet mode | Every row has a `Status`. Add fresh rows with `Status` empty. |
| First Shopify run rendered nothing | Intentional. The first run only records which product is newest so activating the workflow does not announce your back catalogue. Publish a product and the next poll picks it up. |
| `Shopify products poll failed (HTTP 401)` / `(HTTP 403)` | The custom-app token was rejected. Re-copy it (it starts with `shpat_`) and confirm the app has the `read_products` scope. |
| `Shopify products poll failed (HTTP 404)` | `shopDomain` should be just the subdomain (`my-shop`), or `apiVersion` names a version your shop no longer serves. |
| `Could not reach the Shopify Admin API … no HTTP response came back` | The request never got a status code — usually an empty or mistyped `shopDomain` (it must be just `my-shop`), or the shop is unreachable from your n8n. This is deliberately an error: a silent "your shop has no products" every 30 minutes would hide a broken install. |
| `Shopify products poll failed (HTTP 429)` | Shopify is rate-limiting the Admin API. The shipped 30-minute schedule never hits this on its own — if you lowered the interval, or another workflow shares the token, raise it again. Nothing is lost; the next poll picks the product up. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One product every 30 minutes never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |
| No **SAVE x%** badge | `CompareAtPrice` is empty, not greater than `Price`, or the discount rounds outside 1–95 %. The scene is designed for both cases; nothing is broken. |
| The promo rendered without music | `Check music` found the URL unreachable, erroring or over `maxMusicBytes` (5 MB). `Run summary.music` says which. A missing soundtrack is a much smaller problem than a missing video, so this never fails the run. |
| Both scenes show the same photo | The product has only one image, so the offer scene re-frames it — a differently-shaped plate and the opposite drift. Fill `ImageUrl2` (or add a second product photo in Shopify) and the offer scene switches to a genuine second angle. |
| Product name looks small | It is long. Type steps 92 → 80 → 68 → 58 → 50 → 44 px so a 70-character name still fits three lines without clipping. Shorten the name to get the big setting back. |
| Product name ends in `…` | It is longer than 44 px type can fit in three lines (roughly 115 characters). The name is trimmed on a word boundary so the footer and the rest of the layout stay put; shorten the name in the sheet or in Shopify to show it in full. |
| A rival brand's logo is in my video | The workflow draws whatever photo the row points at. Use your own product photography — a stock shot of a branded product puts that trademark under your store's name, price and discount. |
| `Zvid rejected the project` | The message lists the offending fields. If you edited the builder, note the API only allows letters, digits, spaces, `_` and `-` in `name`, and rejects `audios[].track`. |
| Render failed and the row stayed pending | Intentional — the row is only marked `done` after a successful render, so the next run retries it. In Shopify mode the last-seen marker is likewise only moved after success. The error message carries the job's `failedReason`. |
| Wrong row updated | Do not sort or delete rows while a run is in flight; the update matches on the `row_number` captured at read time. |

## Verified

Node types and versions match the templates already shipped in this series, and
the generator asserts the structure of the file it writes: core-only node types,
unique names and ids, every connection endpoint resolves, every code node
compiles, every Zvid and Shopify call on Header Auth, and **no `credentials`
block on any node**. Beyond that:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the
  render farm runs) four times from the builder's real output, each 14.30 s at
  1080×1920 / 30 fps: the default sheet product (**two** photos of the same item
  in different aspect ratios, `CompareAtPrice` set → second angle + `SAVE 25%`);
  a stress product (70-character name over three lines, `$1,299.99` /
  `$1,899.99` with thousands separators, **one** photo so the offer scene has to
  re-frame the hero shot, `storeUrl` left empty so the optional `brandHandle`
  watermark is the footer, and a pale yellow accent that forces every chip label
  to flip to dark ink); a product normalised from a field-accurate Shopify
  `products.json` response (no `compare_at_price` → no badge, tagline derived
  from `body_html` and trimmed with an ellipsis); and a 255-character product
  name — the Shopify Admin API maximum — to prove the type ladder trims the copy
  instead of pushing the footer off the canvas.
- **Frames reviewed** — 29 frames per fixture at 2 fps plus exact-timestamp
  grabs at both transition midpoints (4.80 s, 9.98 s) and the final frame
  (14.25 s): 116 frames and 12 grabs, 128 images. Every one of the 116 frames of
  the shipping renders was inspected through 4×8 contact sheets that tile all 29
  frames of a fixture, and 13 were opened at full 1080×1920 covering all three
  scenes of all four fixtures plus a scene cut; `ffmpeg freezedetect` confirms
  the frames from 11.03 s to the end are identical to one another, so the
  end-card run is one reviewed image rather than seven. Earlier iterations of
  the same design were reviewed the same way, frame by frame at full size. No
  clipping, no overflow, no text touching an edge, no low-contrast text on any
  of the three grounds, no broken half-states at the animation beats, and no
  string printed twice across a scene cut.
- **Motion measured, not assumed** — `ffmpeg freezedetect=n=0.0015:d=1.0`
  reports exactly one still interval per fixture: the end card from 11.03 s
  (11.40 s in the Shopify fixture) to the end. The hook and offer scenes carry
  continuous photo movement for their whole length.
- **Validation** — the local schema validator (the mirror of the backend rules,
  including the layout lint) returns `valid: true`, **0 errors, 0 warnings** on
  all four rendered payloads. The two structurally distinct shapes were then
  validated **against the live API** (`POST /api/render/validate/api-key`,
  `remote: true`): the one with the compare-at price and SAVE badge, and the one
  without. Both came back `valid: true`, **0 errors, 0 warnings**,
  `creditsRequired: 15`, resolved duration 14.3 s, schema **1.0.0**. The stress
  and 255-character payloads are those same two shapes with different copy, so
  they were checked locally only.
- **Every media URL HEAD-checked** at authoring time: the five product photos
  used by the fixtures (HTTP 200 each) and the music bed (HTTP 200,
  3,722,344 bytes = 3.72 MB — inside the 5 MB plan cap, which is what makes it a
  valid default). All fixture photography is unbranded studio product work: no
  third-party logo, trademark or person appears in any rendered frame.
- **The three embedded code nodes are byte-identical** to the standalone
  builders that produced the reviewed renders — asserted programmatically, not
  by eye — and replaying the *shipped* node sources against mocked n8n globals
  reproduces all of the rendered payloads byte for byte.
- **Behavioural edge cases exercised** against the shipped sources: a first
  Shopify run seeds the marker and renders nothing; an unchanged catalogue stops
  friendly instead of erroring; a fully-processed sheet stops friendly; a
  Shopify call that comes back with no HTTP status raises an actionable error
  instead of a friendly "no products"; a 255-character title is clamped and the
  lowest hook element still sits at y=1770 on a 1920 px canvas; `<script>` in a
  product title is HTML-escaped and the project slug stays inside the API's
  character set; an unreachable or oversized music file drops the bed instead of
  failing the run.

**Not executed:** this workflow was not run inside n8n, and **no Shopify store
was connected** — the Shopify branch is verified structurally and against a
field-accurate `2024-07` `products.json` fixture, not against a live shop.
Nothing in the publish tail was exercised either: no social platform, no ad
platform. Those nodes are documented, not run.
