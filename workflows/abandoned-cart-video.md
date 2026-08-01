# Abandoned cart into a personal recovery video

[`zvid-abandoned-cart-video.json`](zvid-abandoned-cart-video.json)

Cart-recovery email number three gets ignored. This workflow takes one abandoned
cart — from a Google Sheet, or from your Shopify store's checkouts endpoint — and
renders a 1080×1920 video of **their** items: a hook scene that says their first
name over their own product photo, a line-up of the one-to-three things still in
the cart with prices, then the cart total and a "complete your order" card. About
14–15 seconds. It can mail the video to the customer itself, or just hand you the
URL for Klaviyo to send.

```
Schedule (hourly) ─▶ Config ─▶ Source? ─▶ Read carts sheet │ Poll checkouts
        ─▶ Pick next cart / Pick abandoned checkout ─▶ Cart found?
        ─▶ Check music ─▶ Build project ─▶ Validate (free) ─▶ Render
        ─▶ Send recovery email ─▶ Mark cart recovered ─▶ ▶ Watch video
```

## Why this one is different

**The layout is designed for one, two and three items — not stretched to fit.**
A cart automation that only looks right at two items is a cart automation you
cannot switch on. *Build project JSON* measures the cart and re-composes: one
item gets a single tall card with a 836×780 product photo; two items get deep
rows with 380 px thumbnails; three get tighter rows with 250 px thumbnails and a
longer scene so the third card still lands before the cut. All three counts were
rendered on the production engine and reviewed frame by frame.

**Product names shrink, then ellipsise — they never spill.** A greedy wrap
estimate calibrated against the renderer steps a title down through its size ramp
until it fits its card in at most three lines, and only then cuts on a word
boundary with an ellipsis. A 147-character title was rendered in the tightest
three-item layout to prove it.

**Prices keep the store's own formatting.** `$1,049.00` stays `$1,049.00`; a bare
`249` becomes `$249`. Cents appear on the total only when the store itself quotes
cents. One unreadable price (`call us`, an empty cell) and the total scene is
*replaced* with a headline instead of shown wrong — the video never invents a
number.

**Nothing personal reaches the public CDN.** The finished MP4's filename comes
from the project name, which is built from the **first name only** plus a hash of
the cart contents — `cart-alex-vtnk1j9q`. The email address is used once, to
address the mail, and is never written into the video, the payload or the title.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Google account | For the two Google Sheets nodes, in the default `sheet` mode. |
| Shopify Admin API token | **Optional.** Only for `source: "shopify"` — a custom app with the `read_checkouts` scope. |
| SMTP credential | **Optional.** Only if you set `sendEmail: true` and want this workflow to send the mail. |

No LLM and no stock-media account: the backdrop of every video is the customer's
own product photo, and the music bed is a single pinned, pre-verified URL.

## Setup

1. **Import** `zvid-abandoned-cart-video.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Validate project (free)*, *Save draft to
   editor*, *Submit render* and *Get render status*.
3. **Google Sheets credential** — attach it to *Read carts sheet* and *Mark cart
   recovered*, and pick your spreadsheet + tab in both nodes.
4. **Create the sheet** with this exact header row:

   | Email | FirstName | Item1 | Item1Image | Item1Price | Item2 | Item2Image | Item2Price | Item3 | Item3Image | Item3Price | CheckoutUrl | Status | VideoUrl |
   | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

   `Item1` is the only required cell. `Item2`/`Item3` are optional — the layout
   is designed for all three counts. `Item*Image` must be public `http(s)` URLs
   (Shopify CDN links are); a missing or non-http image is replaced by a designed
   numbered tile, never a broken box. `FirstName` is optional — empty just drops
   the name line from the hook. Leave `Status` and `VideoUrl` empty; the workflow
   takes the first empty-`Status` row, skipping rows where every cell is blank.
   A sheet with only the header row is not an error — the run ends with a line
   telling you what to add.
5. **Open `Config`** — set `brandName`, `storeUrl` and the `hookLine` / `ctaText`
   copy. Colours and fonts live there too.
6. **Run it.** The workflow renders for real out of the box, so **the first run
   spends credits — about 15** for a typical two-item cart (14 for a single-item
   cart, 16 for a three-item one). When it finishes, click **`▶ Watch video`** to
   play the reel inside n8n.

   Prefer to preview for free first? Set `dryRun: true` in `Config` before that
   first run: you get the exact credit cost and an **`editorLink`** that opens the
   draft in the Zvid editor, with nothing spent, nothing written to the sheet and
   no email sent. Set it back to `false` to render.
7. **Optional email** — set `sendEmail: true`, set `emailFrom`, and attach an
   n8n **SMTP** credential to *Send recovery email*. Gmail needs an **App
   Password**, not your account password.
8. **Activate.** It takes one cart per run, hourly.

### Optional: real abandoned checkouts instead of a sheet

**Shopify has no abandoned-checkout webhook topic** — there is no event to
subscribe to — so this polls, which is also the install with no app review and no
public URL. To switch:

1. Shopify admin → **Settings → Apps and sales channels → Develop apps**.
2. **Create an app**, then **Configure Admin API scopes** and tick
   **`read_checkouts`** (add `read_products` only if you want product images).
3. **Install app**, then reveal the **Admin API access token** (`shpat_…`). It is
   shown once.
4. Add a **second** n8n **Header Auth** credential, name
   `X-Shopify-Access-Token`, value = that token. Attach it to *Poll checkouts*
   only.
5. In `Config` set `source: "shopify"` and `shopDomain` to the full host
   (`your-store.myshopify.com`).

In Shopify mode there is no sheet row, so the write-back is skipped and the
checkout id is remembered in the workflow's static data instead — that is what
stops the same cart being recovered twice. It is stored only *after* a successful
render, so a failed render retries the same cart.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base. Leave it alone. |
| `editorUrl` | `https://editor.zvid.io` | Used to build the dry-run `editorLink`. |
| `source` | `sheet` | `sheet` reads a Google Sheet; `shopify` polls `/checkouts.json`. |
| `shopDomain` | `""` | Shopify mode only: `your-store.myshopify.com`. |
| `apiVersion` | `2024-07` | Shopify Admin API version in the poll URL. |
| `abandonedAfterHours` | `6` | Shopify mode: ignore checkouts newer than this — give them a chance to come back on their own. |
| `maxAgeHours` | `48` | Shopify mode: ignore checkouts older than this; a two-week-old cart is not a recovery opportunity. |
| `brandName` | `Northlane` | The pill at the top of scenes 1 and 3. |
| `storeUrl` | `northlane.example` | The domain line on the end card. |
| `brandBackground` | `#12100E` | Near-black canvas behind every scene. |
| `brandAccent` | `#E2714B` | Prices, CTA pill, rules, corner marks. |
| `accentSoft` | `#F0B08C` | The italic first-name line and the "N items · saved for X" line. |
| `creamColor` | `#F6F1E9` | Headlines and product names. |
| `mutedColor` | `#9C948A` | Sub-lines and the store domain. |
| `headingFont` | `Sora` | Headlines, product names, totals, CTA. |
| `accentFont` | `Fraunces` | The italic first-name line only. |
| `uiFont` | `DM Sans` | Kickers, sub-lines, the brand pill. |
| `currencySymbol` | `$` | Prefixed to prices the store wrote without one. |
| `hookLine` | `you left something behind.` | Scene 1 headline, under the name. |
| `hookNote` | `Your cart is still saved — for now.` | Scene 1 sub-line. |
| `cartKicker` | `STILL IN YOUR CART` | Scene 2 kicker above the item count. |
| `cartNote` | `We saved your cart. Nothing stays reserved forever.` | Scene 2 footer line. |
| `totalLabel` | `YOUR CART TOTAL` | Scene 3 label above the number. |
| `ctaText` | `Complete your order` | Text inside the end-card pill (an arrow is appended). |
| `ctaSubline` | `Pick up exactly where you left off.` | Line under the pill. |
| `musicUrl` | a pinned Zvid stock-library bed | Swap for your own; it is HEAD-checked before use. |
| `musicVolume` | `0.16` | The bed sits low by design. |
| `maxMusicBytes` | `5242880` | *Check music* drops the bed rather than fail if it is bigger or unreachable. |
| `resolution` | `instagram-reel` | 1080×1920. |
| `frameRate` | `30` | |
| `sendEmail` | `false` | `true` sends the recovery mail through *Send recovery email*. |
| `emailFrom` | `hello@yourstore.com` | Envelope sender. Must match what your SMTP account may send as. |
| `emailSubject` | `{firstName}, your cart is still saved` | Supports `{firstName}`, `{brandName}`, `{total}`, `{itemCount}`. |
| `emailIntro` | `We kept your cart exactly where you left it…` | Same placeholders; substituted in *Prepare recovery email*. |
| `emailButtonText` | `Complete your order` | Label on the button in the mail. |
| `statusDoneValue` | `done` | What gets written to `Status` after a successful render. |
| `dryRun` | `false` | `false` (default) renders for real. `true` = a free pass that validates, quotes the credits and saves a draft you can watch in the editor — no credits, no sheet write, no email. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost per video

The live validator quoted **14 credits** for a single-item cart (13.8 s),
**15** for the default two-item cart (14.6 s) and **16** for a three-item cart
(15.2 s) — every count was quoted, not estimated. Those numbers come from the
validator applying one account's plan limits; yours is whatever
*Validate project (free)* returns, which runs before every render and reports the
exact quote for that cart as `creditsCharged` in the run summary. The render then
proceeds automatically — set `dryRun: true` if you want the number *without* the
render.

## How it works

| Node | What it does |
| --- | --- |
| **Test manually / Every hour** | Both feed `Config`. The schedule runs hourly; one cart per run. |
| **Config** | Every knob, in one raw-JSON Set node. |
| **Source?** | Routes on `Config.source`: `sheet` (default) or `shopify`. |
| **Read carts sheet** | Reads every row; the sheet node also emits each row's `row_number`. Runs with **Always Output Data**, so a sheet holding nothing but its header row still reaches the guard below instead of stopping the run dead. |
| **Pick next cart** | Keeps the first row whose `Status` is empty, normalises it to `{email, firstName, items[], checkoutUrl}` and drops item slots with no title. **Rows where every cell is blank are skipped**, not picked — otherwise one stray formatted row at the bottom of the sheet would be re-picked on every run and block every real cart behind it. |
| **Poll checkouts** | Shopify mode: `GET /admin/api/{apiVersion}/checkouts.json?limit=25`. That endpoint only ever returns checkouts that were never completed. It runs with full-response + continue-on-error so the *next* node can turn the HTTP status into a readable message rather than a red node. |
| **Pick abandoned checkout** | Reads the full response (`statusCode` + `body`) and **fails loudly on a bad poll**: 401/403 names the `read_checkouts` scope and the `X-Shopify-Access-Token` header, 404 names `shopDomain`/`apiVersion`, any other non-200 is quoted back, and an unreachable host says so. Only on a real `200` does it apply the window (`abandonedAfterHours` … `maxAgeHours`), require an email and at least one line item, skip anything already in the sent-list, and take the oldest qualifying cart. |
| **Cart found?** | Nothing to recover → *Nothing to recover* ends the run with a friendly summary instead of an error. It distinguishes an empty sheet, blank rows that were skipped, and every row already done. A failed poll never lands here — it throws. |
| **Check music** | HEAD-checks `musicUrl`. Continues on error. |
| **Music guard** | Drops the bed if it is unreachable or bigger than `maxMusicBytes`. The video still renders, silent. |
| **Build project JSON** | The whole design: the 1/2/3-item layout branch, the title shrink-then-ellipsise ramp, price parsing and the cart total, the numbered-tile fallback for missing images, HTML-escaping of all cart text, and the privacy-safe project name. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — without spending credits. |
| **Check validation** | Fails loudly with the field list if the API rejected the payload; otherwise carries `payload`, `creditsRequired` and `meta` forward. |
| **Dry run?** | Routes on `Config.dryRun`. It is `false` by default, so the normal path is straight to *Submit render*. |
| **Save draft to editor / Dry run summary** | **Only when `dryRun: true`.** Saves a free draft and reports the quoted credits plus an `editorLink` (`https://editor.zvid.io/?project=…`). Best-effort — a hiccup here never hides the dry-run report. |
| **Submit render / Wait / Get render status / Render finished?** | Paid render plus a poll loop; *Render finished?* branches on `state === 'completed'`. |
| **Still rendering?** | Fails fast when the job reports `failed` and stops the loop at `timeoutMinutes`. |
| **Prepare recovery email** | Substitutes `{firstName}` / `{brandName}` / `{total}` / `{itemCount}` into the Config templates and builds the HTML body — in a code node, where escaping is easy to get right. |
| **Email the customer? / Send recovery email** | Sends only when `sendEmail` is `true` *and* the cart carries an address. Continues on error: a bad SMTP password never costs you a finished render. |
| **Sheet mode?** | Routes the write-back. |
| **Mark cart recovered** | Sheet mode: updates exactly the picked row (matched on `row_number`) with `Status` and `VideoUrl`. A failed render never reaches this node, so the row stays pending and the next run retries it. |
| **Remember sent checkout** | Shopify mode: records the checkout id in the workflow's static data, only after a successful render. |
| **Run summary** | One item carrying `videoUrl`, `jobId`, `creditsCharged`, `cartTotal`, `emailSent`. |
| **▶ Watch video** | Downloads the finished MP4 as binary so n8n plays it inline in the output panel. Never fails the run: it retries a few times (the CDN can 404 for a moment right after a render completes) and then continues regardless, since the sheet is already written by this point. |

## Publishing (optional tail)

The required path ends with the URL in *Run summary* and in your sheet, plus the
built-in SMTP send. To go further, extend after *Run summary*:

- **Klaviyo / Mailchimp / Braze** — push `videoUrl` into a cart-recovery flow as a
  custom property and let your ESP own timing, throttling and deliverability.
  This is the production swap most stores want; the SMTP node is the zero-setup
  demo.
- **SMS / WhatsApp** — the URL is short and public; pass it to Twilio.
- **Retargeting ads** — drop `videoUrl` into your ad platform via its API.

These stay out of the required path so the import runs with a Zvid key and a
Google account, nothing else. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and
replace the render HTTP nodes with the native **Zvid** node + **Zvid Trigger**
(render webhook), which removes the poll loop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Run says `nothing to recover` | Sheet mode: every row has a `Status` — or the sheet has no data rows at all, which the summary says in as many words. Shopify mode: the poll answered `200` but no checkout is inside the `abandonedAfterHours`…`maxAgeHours` window yet, or they are all in the sent-list. A *failed* poll never reports this; it throws (see the rows below). |
| `The carts sheet has no data rows yet` | The sheet holds only its header row. Add a cart row with `Item1` filled in and `Status` left empty. |
| Summary mentions `blank row(s) were skipped` | A row exists but every cell is empty. Harmless — it is skipped, not picked. Delete it if you want a clean sheet. |
| `Row N has no Item1` | The first empty-`Status` row has no `Item1`. Fill it, or put anything in its `Status` cell to skip the row. |
| `Row N has an Email that is not an address` | The `Email` cell on the picked row is not a valid address. Fix it, or clear it — an empty `Email` is fine when `sendEmail` is `false`. |
| Product cards show numbered tiles instead of photos | The `Item*Image` cell was empty or not an `http(s)` URL. `/checkouts.json` does not reliably carry product images — that is the expected Shopify-mode look unless you enrich from `read_products`. |
| The total scene shows a headline instead of a number | At least one price could not be read (`call us`, empty, a stray word). The template will not show a wrong total, so it swaps the scene. Fix the price cell. |
| Video is silent | *Check music* could not reach `musicUrl`, or it exceeded `maxMusicBytes`. Intentional — the render never fails over music. |
| `Zvid rejected the project` | The message lists the offending fields. If you edited the builder, note the API only allows letters, digits, spaces, `_` and `-` in `name`, and rejects `audios[].track`. |
| The email never arrived | `sendEmail` is `false` by default. If it is `true`, check the *Send recovery email* node output — it continues on error, so a failed send shows up there and as `emailSent: false` in the run summary rather than as a red run. |
| `Shopify rejected the token (HTTP 401)` / `(HTTP 403)` | The Admin API token is wrong or expired, the custom app is missing the `read_checkouts` scope, or the Header Auth credential is not named `X-Shopify-Access-Token`. |
| `Shopify answered HTTP 404 for https://…/checkouts.json` | `shopDomain` must be the full admin host (`your-store.myshopify.com`, no `https://`, no storefront domain), and `apiVersion` must be a version your store still serves. |
| `Could not reach <shop>` | The poll never got an HTTP answer: the host does not resolve, or no credential is attached to *Poll checkouts*. |
| `Shopify answered HTTP 200 but the body…` | Something other than the Admin API answered — usually a storefront domain in `shopDomain` that redirects to an HTML page. |
| The same cart was recovered twice | Sheet mode: the row's `Status` was cleared. Shopify mode: the workflow's static data was reset (a re-import starts a fresh sent-list). |
| Wrong row updated | Do not sort or delete rows while a run is in flight; the update matches on the `row_number` captured at read time. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One cart an hour never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Verified

n8n **2.29.10** node types and versions (every node resolves in a stock install;
the two Google Sheets nodes use the same shapes as the other templates in this
series). Here is exactly what was verified:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the
  render farm runs) six times from the builder's real output: a two-item cart
  (14.6 s), a three-item cart with 55-57-character titles, `$1,049.00` prices and a
  21-character first name (15.2 s), a single-item cart (13.8 s), a Shopify-mode
  cart with **no product images and no music bed** and one unreadable price
  (14.6 s), an overflow cart with three 147-character titles and a 22-character
  first name (15.2 s), and a Shopify-mode cart driven by the polling code path
  where **only two of the three items have images**, so a photo card and a
  numbered-tile card sit in the same line-up (15.2 s). **All 176 extracted frames
  were reviewed** (2 fps) plus **18 exact-timestamp grabs** at both transition
  midpoints and the final frame of each render: no clipping, no overflow, no text
  touching a frame edge, no low-contrast text on any background, no unsubstituted
  variables, no broken animation states.
- **The smallest type was re-checked at native 1080×1920 resolution.** The frame
  sweep above was reviewed downscaled; on top of it, **39 1:1 crops** were cut
  from all six renders at the regions carrying the 25–36 px type — the brand pill,
  the `STILL IN YOUR CART` / `YOUR CART TOTAL` kickers, every product-card title
  and price, the card sub-lines and the `NORTHLANE.EXAMPLE` footer — and read at
  full resolution. Glyphs are clean at every size, the 147-character titles cut on
  a word boundary with a real ellipsis rather than a clipped edge, and prices,
  totals and hyphenated names render exactly as the payload spells them.
- **Remote validation against the live API** (`POST /api/render/validate/api-key`
  via MCP with `remote: true`) on **all five distinct payload shapes**, every one
  `valid: true`, **0 errors, 0 warnings**, schema **1.0.0**: the single-item cart
  (`creditsRequired: 14`), the two-item cart (`15`), the no-image / no-music
  Shopify-mode cart (`15`), the three-item cart (`16`) and the mixed
  photo/numbered-tile Shopify cart (`16`).
- **The Shopify code path was exercised offline, through the response shape the
  node really receives.** *Poll checkouts* runs with full-response on, so the
  harness feeds *Pick abandoned checkout* the `{statusCode, headers, body}`
  envelope rather than a bare body — feeding it a bare body is exactly how a
  reader that looked in the wrong place once passed a whole suite. *Pick
  abandoned checkout*, *Music guard* and *Remember sent checkout* were run as
  their shipped source against a synthetic `/checkouts.json` body covering every
  branch — **36 assertions, all passing**: a 2-hour-old checkout is held back, a
  72-hour-old one is dropped, completed checkouts, checkouts with no email and
  checkouts with no line items are skipped, a fourth line item is trimmed, the
  first name falls back to the billing address, the oldest qualifying cart wins,
  a `200` with an empty list returns `found: false` instead of throwing, a raw
  body and a JSON-string body both yield the identical pick, **HTTP 401, 403,
  404, 429, 500, an unreachable host, an HTML body and a `200` with no
  `checkouts` key each throw their own actionable message instead of reporting
  "nothing to recover"**, an empty `shopDomain` throws a legible error, the
  recovered id lands in the static-data sent-list (and is not duplicated on a
  repeat) so the next poll moves to the next cart, and the music guard accepts
  the real bed while vetoing an oversized one and a 404. The picked cart was then
  fed through the real builder and rendered — that is the sixth render above.
- **The sheet-mode picker and the no-op branch were exercised offline too** —
  *Pick next cart* and *Nothing to recover* as their shipped source, **12
  assertions, all passing**: the first empty-`Status` row is picked and folded
  into the builder shape; a sheet with only a header row (the single blank item
  *Read carts sheet* emits with Always Output Data on) ends in the friendly
  "no data rows yet" summary rather than a run that stops dead; a completely
  blank row is skipped so the real cart behind it is still reached, and the skip
  is counted in the summary; every-row-done still reports the original message;
  and a half-filled row (`Email` but no `Item1`) or a malformed address still
  throws its actionable error naming the row.
- **Every media URL re-checked**: all six product images and the music bed answer
  `HTTP 200`; the bed is 3,722,344 bytes, inside the 5 MB `maxMusicBytes` cap.
- **The embedded code node is byte-identical** to the frame-reviewed standalone
  builder — asserted programmatically for *Build project JSON* (28,622 bytes) and
  for all ten other code nodes, not by eye — and a simulated execution of that JS
  against mocked n8n globals reproduced each reviewed payload exactly.
- **Structural checks** on the workflow JSON: parseable, all connections resolve,
  all code nodes compile, unique names and ids, core-only node types, no
  `credentials` blocks anywhere, no `audios[].track` and no VIDEO elements in any
  payload, Zvid calls on Header Auth, and `▶ Watch video` the rightmost functional
  node with the file-response contract.

**Not executed:** this template has not yet been run inside n8n. The Google Sheets
read/write round-trip, the *Poll checkouts* HTTP request against a real store, the
SMTP send and the `▶ Watch video` binary download are verified structurally only —
not against live services. (The *logic* that consumes the poll response is covered
by the offline Shopify run above; the HTTP call itself is not.)
