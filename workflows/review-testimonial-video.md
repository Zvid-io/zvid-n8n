# Turn 5-star reviews into testimonial videos

[`zvid-review-testimonial-video.json`](zvid-review-testimonial-video.json)

Social proof piles up in a review inbox and nobody ever turns it into content.
This workflow takes **one** customer review — from a Google Sheet out of the box,
or from Judge.me in production — and renders it as a 1080×1920 testimonial reel
(~15 s): a star row drawn from the real rating, the quote set in serif italic on
a paper card with the reviewer's monogram and a verified tag, then a brand CTA
card. The finished video URL is written back to the sheet row and the row is
marked `done`.

```
Schedule ─▶ Config ─▶ Source? ─▶ sheet: read + pick first empty-Status row
                             └─▶ judgeme: fetch + pick first unseen review
         ─▶ Clean review text ─▶ music guard ─▶ Trim quote (or AI)
         ─▶ Build project ─▶ Validate (free) ─▶ Render ─▶ Mark row done + VideoUrl
         ─▶ ▶ Watch video
```

## Why this one is different

**The stars are data, not decoration.** The star row is drawn as five polygons
from the row's real `Rating`, rounded to the nearest whole star and clamped to
1–5: filled stars for the score, outlined stars for the rest. A 4-star review
renders four filled stars and one empty one, and the label under it reads
`4.0 out of 5`. There is no code path in the builder that can print five stars
for a four-star review.

**Long reviews are trimmed, never rewritten.** *Trim quote* keeps whole
sentences while they fit inside `maxQuoteChars` (220 by default); if not even
the first sentence fits, it cuts on a word boundary and marks the cut with an
ellipsis. The optional AI path (`useLlm: true`) only *selects* a span — the
answer is folded to letters and digits and checked against the original review,
and if it is not contained in it, or is over budget, or the call failed, the
rule-based trim is used instead and the run reports `trimmedBy: "rule"`. A
testimonial that puts words in a customer's mouth is worse than no testimonial.

**The layout re-balances when there is no product photo.** With an `ImageUrl`
the hook scene becomes a full-bleed photo under a heavy top-and-bottom scrim
with the type block in the lower third; without one, the same information
(kicker, stars, rating, hook line) is re-centred on a designed gradient. Both
were rendered on the production engine and reviewed frame by frame. The quote
scene picks its type size from the quote length (84 px down to 48 px) and
centres the quote + rule + reviewer as one block, so a 60-character review and a
220-character one both sit balanced.

**It runs with no store and no AI key.** `source` is `sheet` and `useLlm` is
`false` out of the box, so a Zvid key plus a Google account is the whole
shopping list. Judge.me is a two-field switch in `Config` when you are ready.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Google account | For the two Google Sheets nodes (read the queue, write back the result). |
| Judge.me API token | **Optional**, production path only. Free Judge.me plans include API access. |
| OpenRouter key | **Optional**, only while `useLlm` is `true`. |

## Setup

1. **Import** `zvid-review-testimonial-video.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Validate project (free)*, *Save draft to
   editor*, *Submit render* and *Get render status*.
3. **Google Sheets credential** — attach it to *Read reviews sheet* and *Mark row
   done*, and pick your spreadsheet + tab in both nodes.
4. **Create the sheet** with this exact header row:

   | Reviewer | Rating | ReviewText | Product | ImageUrl | Status | VideoUrl |
   | --- | --- | --- | --- | --- | --- | --- |

   `Reviewer`, `Rating` (1–5) and `ReviewText` are required. `Product` is
   optional — it becomes the line under the stars, the tag next to the reviewer
   and the headline on the CTA card. `ImageUrl` is optional and must be a public
   `http(s)` URL (Shopify and Judge.me CDN URLs are). Leave `Status` and
   `VideoUrl` empty.
5. **Open `Config`** — set `brandName`, `ctaText` and `storeUrl`. Everything else
   works out of the box.
6. **Run it.** The workflow renders for real out of the box, so **the first run
   spends credits — about 16** for a default-length review. When it finishes,
   click **`▶ Watch video`** to play the reel inside n8n.

   Prefer to preview for free first? Set `dryRun: true` in `Config` before that
   first run: you get the exact credit cost and an **`editorLink`** that opens
   the draft in the Zvid editor, with nothing spent and nothing written to the
   sheet.
7. **Activate.** It turns one review into a video every day at 9am.

### Switching to Judge.me (production path)

The sheet is the demo path so the template works the minute it is imported. To
pull real reviews instead:

1. Judge.me dashboard → **Settings → Integrations → Judge.me API**, copy your
   **private API token**.
2. In `Config` set `source: "judgeme"`, `judgemeToken` and `judgemeShop`
   (`your-store.myshopify.com`).
3. There is no credential to attach — Judge.me authenticates with the token as a
   query parameter, which is why it lives in `Config` (treat that workflow as
   secret-bearing, or move the token to an n8n environment variable and
   reference it with an expression).

In Judge.me mode nothing is written back to Judge.me. Review ids that have
already become a video are remembered in n8n's workflow static data
(`seenReviewIds`, most recent 200) and **only after a successful render**, so a
failed render retries the same review on the next run — the same contract the
sheet's `Status` column gives you.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base. |
| `editorUrl` | `https://editor.zvid.io` | Used to build `editorLink` on a dry run. |
| `source` | `sheet` | `sheet` (default) or `judgeme`. Routes the `Source?` and `Sheet mode?` branches. |
| `judgemeShop` | `""` | `your-store.myshopify.com`. Judge.me mode only. |
| `judgemeToken` | `""` | Judge.me private API token. Judge.me mode only. |
| `minRating` | `4` | Reviews below this are skipped in both modes. |
| `useLlm` | `false` | `true` routes the quote through *Trim quote with AI* (needs an OpenRouter credential). The answer is still checked against the original review. |
| `llmModel` | `openai/gpt-4.1-mini` | OpenRouter model id, only used when `useLlm` is `true`. |
| `maxQuoteChars` | `220` | Character budget for the on-screen quote (clamped 60–400). |
| `brandName` | `Northwind Goods` | Letterspaced brand line on all three scenes. |
| `brandKicker` | `CUSTOMER LOVE` | Kicker above the stars on the hook scene (upper-cased). |
| `verifiedLabel` | `Verified customer` | The tag under the reviewer's name. |
| `hookLine` | `Real words from real customers.` | Serif line on the hook scene when the review has no image, and the CTA headline when there is no `Product`. |
| `ctaText` | `Read the reviews` | Text inside the CTA pill. |
| `storeUrl` | `https://northwindgoods.example` | Only the host is shown (`northwindgoods.example`) on the quote footer and the CTA card. |
| `quoteFont` / `uiFont` | `Playfair Display` / `Outfit` | Serif carries the quote and the CTA headline; sans carries everything else. One font per text element. |
| `paperColor` / `inkColor` | `#F5EDE6` / `#1C1512` | Warm paper on deep espresso. |
| `accentColor` | `#C2553D` | CTA pill, accent rule, monogram, kicker and the soft background blooms. |
| `starColor` | `#E0A33C` | Filled stars. Empty stars are drawn as outlines in the opposite ink. |
| `mutedOnInk` / `mutedOnPaper` | `#C3AA9C` / `#7A6154` | Secondary type on the dark and light scenes. |
| `musicUrl` | pinned Zvid stock-library track | HEAD-checked before every render. |
| `musicVolume` | `0.14` | The bed sits low by design. |
| `maxMusicBytes` | `5242880` | Plan audio cap. Anything larger renders **without** music instead of failing. |
| `statusDoneValue` | `done` | What gets written to `Status` after a successful render. |
| `dryRun` | `false` | `false` (default) renders for real. `true` gives a free pass that validates the payload, quotes the credits and saves a draft you can watch in the editor — no credits, no sheet write. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost per video

The live validator quoted **16 credits** for the default 15.4 s reel (a
146-character review with a product photo) and **17** for a 220-character review
(16.6 s). Length is what moves the number: the quote scene runs 5.4–8.6 s
depending on how much there is to read, the other two scenes are fixed.

*Validate project (free)* runs before every render and reports the exact figure
as `creditsCharged` in the run summary — but the render then proceeds on its
own. Set `dryRun: true` if you want the number *without* the render.

## How it works

| Node | What it does |
| --- | --- |
| **Source?** | Routes on `Config.source`. `sheet` (default) → the Google Sheets path; anything else → the Judge.me path. |
| **Read reviews sheet** | Reads every row; the sheet node also emits each row's `row_number`. |
| **Pick next review** | Keeps the first row whose `Status` is empty **and** whose `Rating` clears `minRating`. Nothing matching → the run ends with a friendly "nothing to render" summary instead of an error. A matching row missing `Reviewer`/`ReviewText` fails loudly with the row number. |
| **Fetch Judge.me reviews** | `GET https://judge.me/api/v1/reviews` with `api_token`, `shop_domain` and `per_page=10`. Never throws — a bad status is handled in the next node. |
| **Pick Judge.me review** | Filters by `minRating`, skips ids already rendered (workflow static data) and normalises the review to the same shape the sheet path emits. HTTP 401/403 and unreachable hosts end the run with a fix-it message. |
| **Clean review text** | The one place untrusted review text is made safe: strips HTML a review platform let through, normalises curly quotes/dashes to ASCII so the trimmer and the wrap estimate count real characters, collapses whitespace, clamps the rating to 1–5 and drops any non-`http(s)` image. |
| **Check music** / **Music guard** | HEAD-checks `musicUrl` and its `content-length`. Unreachable, HTTP error or over `maxMusicBytes` → the video renders **without** music and the reason is reported; it never fails the run. |
| **Use AI?** | Routes on `Config.useLlm`. `false` by default, so the normal path is the rule-based *Trim quote*. |
| **Trim quote with AI** / **Use AI quote** | **Only when `useLlm: true`.** OpenRouter picks the most quotable span; *Use AI quote* accepts it only if it is contained in the original review (letters/digits fold) and inside the budget, otherwise it falls back to the rule trim and records `llmFallbackReason`. |
| **Trim quote** | The default path: whole sentences while they fit, otherwise a word-boundary cut plus an ellipsis. |
| **Build project JSON** | The whole design lives here: the polygon star row drawn from the real rating, the adaptive quote type ramp (84→48 px) with a block that stays vertically centred, the with-photo / without-photo hook layouts, HTML-escaping of every piece of user text, and the API's `name` character rules. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — without spending credits. Failures surface as a field list. |
| **Dry run?** | Routes on `Config.dryRun`. It is `false` by default, so the normal path is straight to *Submit render*. |
| **Save draft to editor** | **Only when `dryRun: true`.** Saves a free draft and returns `editorLink` (`https://editor.zvid.io/?project=…`). Best-effort: a hiccup here never hides the dry-run report. |
| **Dry run summary** | **Only when `dryRun: true`.** Reports the quoted credits, `editorLink` and warnings, and leaves the sheet untouched so the next real run picks the same review. |
| **Submit render / Wait / Get render status** | Paid render plus a poll loop. |
| **Still rendering?** | Fails fast when the job reports `failed` and stops the loop at `timeoutMinutes`. |
| **Sheet mode?** | Only the sheet path has a row to write back to; Judge.me mode goes straight to the summary. |
| **Mark row done** | Updates exactly the picked row (matched on `row_number`): `Status` = `done`, `VideoUrl` = the finished MP4. A failed render never reaches this node, so the row stays pending and the next run retries it. |
| **Run summary** | The report: `videoUrl`, `stars`, `trimmedBy`, `creditsCharged`, whether music survived the guard. In Judge.me mode it also records the review id — only here, after a successful render. |
| **▶ Watch video** | Downloads the finished MP4 as binary so n8n plays it inline in the output panel. Never fails the run: it retries a few times (the CDN can 404 for a moment right after a render completes) and then continues regardless, since the row is already written by this point. |

## Publishing (optional tail)

The required path ends with the URL in your sheet. To auto-publish, extend after
*Mark row done*:

- **Instagram / TikTok / multi-platform** — pass `videoUrl` to a scheduler such
  as Blotato, Buffer or Metricool over their HTTP API; they take a public video
  URL directly.
- **YouTube Shorts** — HTTP Request node (GET `videoUrl`, response format *File*)
  → native **YouTube** node (Video → Upload). Needs YouTube OAuth2.
- **Product page** — drop `videoUrl` into your CMS or theme through its own API.

These stay out of the required path so the import runs with a Zvid key and a
Google account, nothing else. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and
replace the render HTTP nodes with the native **Zvid** node + **Zvid Trigger**
(render webhook), which removes the poll loop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Row N is missing Reviewer or ReviewText` | The first eligible row is incomplete. Fill it, or put anything in its `Status` to skip it. |
| Run says `nothing to render` and names `minRating` | Every pending row is rated below `minRating`. Lower it in `Config` or add a higher-rated review. |
| Run says `nothing to render` with no rating mention | Every row has a `Status`. Add fresh rows with `Status` empty. |
| Only four stars are filled | Correct — the row's `Rating` is 4. Stars are drawn from the data and rounded to the nearest whole star; nothing can inflate them. |
| `trimmedBy` says `rule` even though `useLlm` is `true` | The model's answer was rejected. `llmFallbackReason` in the run says why: reworded, over budget, or the call failed. The video still shipped, with the customer's own words. |
| Quote ends in `…` | The review was longer than `maxQuoteChars`. Raise it (up to 400) if you want more on screen — the type ramp goes down to 48 px. |
| Judge.me: `rejected the token` | The token is wrong or was rotated. Re-copy it from Judge.me → Settings → Integrations. |
| Judge.me: same review twice | Static data was cleared (a workflow re-import or an instance reset clears `seenReviewIds`). Nothing breaks; one review is rendered again. |
| Video rendered without music | The HEAD guard dropped it — the run summary's `music` field says why (unreachable, HTTP error, or over `maxMusicBytes`). Free plans cap audio assets at 5 MB. |
| `Zvid rejected the project` | The message lists the offending fields. If you edited the builder, note the API only allows letters, digits, spaces, `_` and `-` in `name`, and rejects `audios[].track`. |
| Product photo looks cropped | The hook scene deliberately uses the photo full-bleed with `resize: "cover"`. `resize` is resolved against the canvas, not an element box, so an inset photo would be stretched — full-bleed is the only distortion-free option. Use a portrait-friendly image, or leave `ImageUrl` empty for the type-only hook. |
| Render failed and the row stayed pending | Intentional — the row is only marked `done` after a successful render, so the next run retries it. The error message carries the job's `failedReason`. |
| Wrong row updated | Do not sort or delete rows while a run is in flight; the update matches on the `row_number` captured at read time. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a day never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Verified

n8n **2.29.10** node types and versions (every node resolves in a stock install;
the two Google Sheets nodes use the same shapes as the other templates in this
series). Here is exactly what was verified:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the
  render farm runs) from the builder's real output, twice: the default fixture
  (5★, 146-character review, product photo → 15.4 s) and a stress fixture (4★, a
  340-character review trimmed to 218, a 23-character accented reviewer name, a
  38-character product name and **no** product image → 16.6 s). **Every extracted
  frame was reviewed** — 2 fps across both videos plus exact-timestamp grabs at
  each of the four transition midpoints and both final frames, 70 frames in
  total: no clipping, no overflow, no low-contrast text, no broken animation
  states, and the star counts match the fixtures (5 filled / 4 filled + 1
  outlined).
- **Remote validation against the live API** (`POST /api/render/validate/api-key`
  via MCP with `remote: true`): the default payload came back `valid: true`,
  **0 errors, 0 warnings**, `creditsRequired: 16`, schema **1.0.0**. The
  no-image hook scene — the one structurally different part of the stress
  payload — was validated the same way (`valid: true`, 0 errors, 0 warnings),
  as was the stress payload's full 16.6 s three-scene shape
  (`creditsRequired: 17`).
- **Every pinned URL HEAD-checked at authoring time**: the music bed
  (HTTP 200, `audio/mpeg`, 1,556,480 bytes — comfortably under the 5 MB plan
  cap) and the fixture product image (HTTP 200, `image/jpeg`).
- **The embedded code nodes are byte-identical** to the frame-reviewed
  standalone builders (`Build project JSON` and `Trim quote`, asserted
  programmatically after the workflow file is written, not by eye), and the
  shipped `Config` node is asserted equal to the config the fixtures used.
- **25 simulated-execution checks** run the shipped workflow's own code nodes
  against mocked n8n globals: the sheet happy path rebuilds the *exact* payload
  that was rendered and frame-reviewed (and so does the stress path); an
  all-`done` sheet and a below-`minRating` sheet both stop friendly; an
  incomplete row throws with its row number; Judge.me picks the 4★ review over
  the 2★ one, refuses an id it has already rendered, and turns 401 / unreachable
  into fix-it messages; a 9 MB or 404 music URL drops `audios[]` instead of
  failing; a genuine LLM span is accepted while an invented one, an over-budget
  one and a failed call all fall back to the rule trim; the poll loop throws on
  `failed` and at `timeoutMinutes`; and the Judge.me review id is recorded only
  after a successful render.
- **Structural checks** on the workflow JSON: parseable, all 29 connection
  sources resolve, all code nodes compile, unique names/ids, core-only node
  types (`manualTrigger`, `scheduleTrigger`, `set`, `if`, `code`, `httpRequest`,
  `googleSheets`, `wait`, `stickyNote`), no `credentials` blocks anywhere, and
  every Zvid call on Header Auth.

**Not executed:** the Judge.me path was never called against the live Judge.me
API — there is no Judge.me token in this environment. Its request shape follows
Judge.me's public reviews API and its response handling is covered by the
simulation above, but treat the field mapping as documented, not measured. The
`useLlm: true` path was likewise never called against a real OpenRouter
endpoint; only its parsing, honesty guard and fallbacks were exercised. Nothing
in the publish/delivery tail was executed either — no social platform, no email
provider. Those nodes are documented, not exercised.
