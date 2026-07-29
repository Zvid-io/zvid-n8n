# Restaurant weekly specials from a Google Sheet

[`zvid-restaurant-weekly-specials.json`](zvid-restaurant-weekly-specials.json)

Every Monday morning: read your menu sheet, take the dishes you marked for this
week, and render a 1080×1920 specials reel with Zvid — a sizzle hook, one photo
card per dish with a price chip, and a booking CTA, all in your brand colours.
Ready to post to Instagram Reels and Facebook.

```
Schedule (Mon 9am) ─▶ Config ─▶ Read menu sheet ─▶ Pick weekly dishes
   ─▶ Build project ─▶ Validate (free) ─▶ Render ─▶ Run summary (videoUrl + caption)
                                       │                    └▶ ▶ Watch video (inline player)
                                       └▶ dryRun: true ─▶ draft + editorLink   (opt-in, free)
```

The design is adapted from Zvid's `local-menu-promo` / `local-top-5-dishes`
library templates: full-bleed food photography with a slow Ken Burns push, a
warm ember palette, Bebas Neue headlines with DM Sans body text, and a counter
chip ("SPECIAL 2 OF 4") so viewers know how much is left. Dish name sizes adapt
to their length, descriptions are trimmed past ~220 characters, and the text
block is bottom-anchored — a three-line description grows upward instead of
colliding with anything, so a wordy menu cannot break the layout.

## What changed

- **It renders on the first run.** `dryRun` now defaults to **`false`** in
  `Config`, so an imported workflow goes all the way to a finished MP4 — and
  that **first run spends credits** (about **16** for the 4-dish default). The
  free dry run did not go away: set `dryRun: true` in `Config` whenever you
  want a validate-quote-and-draft pass instead of a render.
- **New `▶ Watch video` node at the end.** It downloads the finished MP4 and
  n8n plays it inline in the node's output panel, so you can watch the reel
  without copying `videoUrl` anywhere.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Google account | The built-in Google Sheets node reads the menu sheet. |

No stock-media accounts: the sizzle clip, fallback dish photos and music bed
are stable public URLs shipped in `Config`, and dish photos come from your
sheet.

## The menu sheet

One row per dish. Row 1 is headers; order, casing and spacing do not matter
(`Photo URL` resolves the same as `PhotoUrl`).

| Column | Example | Notes |
| --- | --- | --- |
| `Dish` | Wild Mushroom Pappardelle | Required. |
| `Description` | Hand-cut pasta, porcini cream, shaved pecorino. | Optional. Trimmed past ~220 chars. |
| `Price` | $19 | Optional free text — bring your own currency symbol. Empty hides the chip. |
| `PhotoUrl` | https://…/pasta.jpg | Direct https image link; portrait crops best. Empty rows get a polished fallback photo from `Config`. |
| `ThisWeek` | TRUE | `TRUE` / `yes` / `1` / `x` all count. |

The video features the first **5** marked rows (3–5 reads best; ~12.9–17.6s).
Extras are skipped and reported in the run output. No marked rows fails the run
with a clear message instead of rendering an empty video.

## Setup

1. **Import** `zvid-restaurant-weekly-specials.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name
   `x-api-key`, value = your Zvid key. Attach it to *Validate project (free)*,
   *Save draft to editor*, *Submit render* and *Get render status*.
3. **Google Sheets credential** — attach it to *Read menu sheet*, then pick
   your spreadsheet and sheet in that node.
4. **Open `Config`** — restaurant name, tagline, handle, address, brand
   colours, fonts, timings. Everything lives in this one node.
5. **Run `Test manually`.** The workflow renders for real out of the box, so
   this **first run spends credits** — about **16** for the 4-dish default
   (see [Cost per video](#cost-per-video)). When it finishes, click the
   **`▶ Watch video`** node to play the reel inside n8n.
6. **Prefer a free preview first?** Set `dryRun: true` in `Config` before that
   run. It validates the project, quotes the exact credit cost and saves a
   draft, then reports an **`editorLink`** that opens it at
   [editor.zvid.io](https://editor.zvid.io) — nothing is charged. Set it back
   to `false` when you want the render.
7. **Activate** the workflow to pick up the Monday 9am schedule.

## Configuration

| Key | Default | Notes |
| --- | --- | --- |
| `restaurantName` | `Bella Cucina` | Top of the hook scene. Long names automatically shrink and wrap — tested to 50 characters. |
| `tagline` | `Handmade pasta · wood-fired everything` | Under the hook headline. |
| `weekLabel` | `""` | Empty = automatic `WEEK OF JUL 27` (the Monday of the current week). Set it to override. |
| `hookTitle` | `This week's specials` | The big hook headline. |
| `ctaHeadline` / `ctaText` | `Hungry yet?` / `Book a table` | Endcard headline + button chip. |
| `handle` / `address` | `@bellacucina` / `214 Juniper Ave, Portland` | Endcard contact block. |
| `deliveryNote` | `DINE IN · TAKEAWAY · DELIVERY` | Small letterspaced line at the bottom of the endcard; empty hides it. |
| `brandBg` / `brandAccent` / `brandCream` / `brandMuted` | `#180F0A` / `#E86A33` / `#FFF4E8` / `#E4CBB0` | The whole palette. Accent drives chips, borders and the bag icon. |
| `headlineFont` / `bodyFont` | `Bebas Neue` / `DM Sans` | Any Google Font name works. |
| `sizzleVideo` | kitchen-grill clip | Hook-scene b-roll (muted). Swap in your own vertical clip URL for extra brand feel. |
| `fallbackDishPhotos` | 5 food photos | Used in order for rows with an empty `PhotoUrl`. |
| `musicUrl` / `musicVolume` | upbeat bed / `0.18` | Set `musicUrl` to `""` for a silent video. |
| `hookSeconds` / `dishSeconds` / `ctaSeconds` | `3` / `2.8` / `3.4` | Scene lengths. Defaults give ~15.3s at 4 dishes. |
| `maxDishes` | `5` | Hard cap on featured dishes (also the free-plan sweet spot). |
| `resolution` / `frameRate` | `instagram-reel` / `30` | 1080×1920. |
| `dryRun` | `false` | Renders for real by default. Set it to `true` for a free pass that validates the project, quotes the credits and saves a draft you can watch in the editor — without spending anything. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost per video

The 4-dish default validates at **16 Zvid credits** (~15.3s); expect roughly
**13–18** for 3–5 dishes. *Validate project (free)* still runs before every
render and still returns the exact quote for your own menu — but with the
default `dryRun: false` the render now proceeds automatically once validation
passes. Set `dryRun: true` if you want that quote on its own, without the
render.

## How it works

| Node | What it does |
| --- | --- |
| **Config** | Every knob in one Set node — brand, copy, media, timings, flags. |
| **Read menu sheet** | Standard Google Sheets read; you pick the document and sheet. |
| **Pick weekly dishes** | Filters `ThisWeek` truthy rows with case/space-insensitive header matching, caps at `maxDishes`, reports skips, and fails loudly when nothing is marked or a `Dish` cell is empty. |
| **Build project JSON** | Assembles the Zvid project: sizzle hook with gradient wash + corner brackets, one card per dish (photo with Ken Burns, counter chip, rotated price chip, bottom-anchored name + description), and the CTA endcard with a hand-drawn takeout-bag icon. Adaptive font sizes keep long names/descriptions inside the safe margins. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, credit quote — without spending credits. Always in the path, so a bad payload can never reach a paid render. |
| **Check validation** | Turns a validation failure into a readable field list; passes the credit quote through. |
| **Dry run?** | Branches on `Config.dryRun`. It ships as `false`, so the normal route is the render below; flip it to `true` and the run stops at the free draft branch instead. |
| **Save draft to editor** | **Only runs when `dryRun: true`.** Saves the project as a free draft and returns `editorLink` (`https://editor.zvid.io/?project=…`). Best-effort: a hiccup here never hides the dry-run report. |
| **Dry run summary** | **Only runs when `dryRun: true`.** The free report — credit quote, scene breakdown, dish list and `editorLink`, with no render submitted. |
| **Submit render / Wait / Get render status** | The paid render plus a `pollSeconds` loop. This is the default path. |
| **Still rendering?** | Fails fast when the job reports `failed` and stops the loop at `timeoutMinutes`. |
| **Run summary** | `videoUrl`, `jobId`, credits charged, dish list, and a `suggestedCaption` ready to paste into Instagram or Facebook. |
| **▶ Watch video** | Downloads the finished MP4 from `videoUrl` as binary, which n8n previews inline: a `video/*` binary becomes a `<video controls>` player in the node's output panel, so clicking the node plays the reel — no URL to copy (mechanism traced in [Verified](#verified)). Retries a few times (the CDN can 404 for a moment right after a render completes) and is set to continue on error, so watching a video can never fail a run that already succeeded and already reported its results. |

The sticky note *Publish to Instagram & Facebook* describes the exact Graph API
calls (`/media` → `/media_publish` for Reels, `/videos` for a Page) if you want
to bolt automatic posting onto the end — the run output was shaped so those
nodes only need `videoUrl` and `suggestedCaption`.

On self-hosted n8n you can swap the HTTP nodes for
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid)
native nodes; the **Zvid Trigger** (render webhook) removes the polling loop.
The shipped workflow is deliberately core-only so it imports untouched on n8n
Cloud.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `No rows have ThisWeek = TRUE` | Nothing is marked in the sheet, or the column is named something the matcher cannot resolve to `ThisWeek`. |
| `Marked row N has an empty Dish cell` | A row is marked but has no dish name. |
| Wrong/odd photo on a card | That row's `PhotoUrl` is empty or not an `https` link, so a fallback photo stepped in. Fix the URL in the sheet. |
| `Zvid rejected the project` | The message lists the offending fields. Most often a malformed colour in `Config` or a photo URL the platform cannot fetch. |
| `Render did not finish within N minutes` | Raise `timeoutMinutes`, or check the job in the dashboard at [app.zvid.io](https://app.zvid.io). |
| `Render failed: …` | The reason string comes straight from the render pipeline — usually an unreachable media URL. |
| 401 from Zvid nodes | The Header Auth credential is missing, misnamed (it must be `x-api-key`), or not attached to all four Zvid nodes. |
| Price chip missing on one card | That row's `Price` cell is empty — by design. |
| Video shorter/longer than expected | Duration is `hookSeconds + dishes × dishSeconds + ctaSeconds` minus transition overlaps: ~12.9s at 3 dishes, ~17.6s at 5. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a day never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |
| `▶ Watch video` shows no player | The download did not land (it retries 3×, then gives up quietly by design so the run still counts as successful). The video itself is fine — take `videoUrl` from *Run summary* and open it directly. |
| A run ended at *Dry run summary*, no video | `dryRun` is set to `true` in `Config`. Set it back to `false` to render. |

## Verified

Verified on **2026-07-27** and **2026-07-28** against Zvid API schema **1.0.0**:

- **Local renders on the production engine** (`@zvid-io/zvid` CLI, the same
  renderer the cloud runs): the default fixture (Bella Cucina, 4 dishes,
  15.25s) and a stress fixture (50-character restaurant name, 5 dishes, one
  3-line description, `$24.50` price, auto week label, 17.6s). Every frame of
  both renders was reviewed at 2fps plus exact grabs on the transition beats:
  no clipped or overflowing text, price/counter chips legible on every photo
  including the brightest plate, bottom-anchored text growing upward as
  designed, all variables substituted.
- **Remote validation against the live API** (`POST /api/render/validate/api-key`
  via `validate_project_json remote:true`) on the default payload:
  `valid: true`, **0 errors, 0 warnings**, `creditsRequired: 16`,
  `schemaVersion: 1.0.0`. Two real API quirks were found and fixed this way:
  project names must be ASCII (`[a-zA-Z0-9_- ]`), and `audios[].track` is
  rejected by the public API.
- **Structural check** of the workflow JSON, re-run on **2026-07-28** after the
  `▶ Watch video` node was added: parses, all 16 connections and every
  `$('Node')` reference resolve, all 6 code-node bodies compile, node names/ids
  unique, the dry-run branch is still present and reachable, `▶ Watch video` is
  reachable and matches its contract, and all four Zvid HTTP nodes use the
  Header Auth credential type. No credentials are embedded in the file. The
  on-canvas sticky notes were re-read against the shipped `Config` in the same
  pass, so the setup steps a fresh import shows now match `dryRun: false`.
- **The `▶ Watch video` mechanism was traced end to end on 2026-07-28**, in
  three checks: `HEAD` on a real `cdn.zvid.io` MP4 returns HTTP 200 with
  `Content-Type: video/mp4` (finished renders are served from that same CDN
  origin); n8n's mime mapping turns any `video/*` binary into a `video` file
  type; and the n8n **2.29.10** output panel — the exact build used for the
  live run below — renders that as a `<video controls autoplay>` element. What
  is *not* covered is an execution of the node itself; see the scope note below.

**Not executed:** nothing in the publish/delivery tail — no social platform,
no email provider. Those nodes are documented, not exercised.

### Live n8n execution (2026-07-28)

Imported into **n8n 2.29.10** (self-hosted, Docker) with a Header Auth
credential holding a real Zvid API key, `dryRun: false`, and executed for
real. Every video below was downloaded from the CDN and reviewed frame by
frame at 2 fps.

- **Run**: green end to end. Rendered `15.27 s`, 1080x1920 @30 fps, AAC audio,
  **16 credits**.
- **The `ThisWeek` filter proved itself live**: the tab held five dishes with
  one deliberately unmarked. The video contains four, and the counters read
  "SPECIAL n OF 4" — the unmarked row was excluded and the count adapted.
- **The returned `videoUrl` is a valid URL.** Project names are slugged, so the
  CDN filename carries no spaces and the link can be pasted straight into a
  publish node or `curl` (verified: HTTP 200 on the raw URL).

**Scope of that evidence after the 2026-07-28 changes.** The run above was
executed with `dryRun: false` — which is exactly what `Config` now ships with,
so this live evidence covers the route a fresh import takes by default, and it
stands unchanged. The `▶ Watch video` node was added *after* that run, so the
node itself has **not** been executed in n8n: it is a plain binary download of
the same `videoUrl` this run already proved returns HTTP 200, and each link in
the chain that turns that download into an inline player was checked separately
(bullet above), but the node has not yet been clicked in a real run.
