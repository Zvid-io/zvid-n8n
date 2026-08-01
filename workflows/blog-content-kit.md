# One blog post into a LinkedIn video, an X teaser and an OG image

[`zvid-blog-content-kit.json`](zvid-blog-content-kit.json)

Every morning: read your blog's RSS feed, and when there is a new post, make **one**
LLM call to write the social copy and render **three assets that share one brand
system** — a 1080×1080 LinkedIn video, a 1280×720 X teaser, and a 1200×630 Open Graph
share image. Publishing a post normally means briefing a designer for four formats;
this turns it into one scheduled run that ends with three files you can post.

```
Schedule ─▶ Config ─▶ Read blog feed ─▶ Pick newest post ─▶ Write kit copy (1 LLM call)
        ─▶ Build project JSON (3 payloads) ─▶ Validate (free) ─▶ Render ×3 (one poll loop)
        ─▶ Run summary (one item per piece) ─▶ ▶ Watch video
```

## Why this one is different

**Three formats, one brand system, one run.** Most repurposing automations produce a
single asset and leave you to redraw it for the next platform. This one emits three
payloads from a single build step that share the same palette, type scale, chip
geometry, gradient plate and brand+domain footer — so the LinkedIn video, the X teaser
and the OG image read as one campaign rather than three near-misses. Mixed output
types too: two MP4s and a PNG come out of the same validate-and-render chain.

**The model cannot break the layout.** The prompt asks for six strings with word
budgets that match the boxes they land in, but models overshoot budgets. *Build
project JSON* clamps every string **again** — by words first, then by characters —
and appends a real ellipsis when it has to cut, so a clamped line reads as a
deliberate edit instead of a sentence that lost its ending. Labels (kicker, CTA,
eyebrow) clamp silently because a trailing ellipsis on chrome looks like a bug. Every
string is HTML-escaped before it reaches a layout, so a headline containing `&`, `<`
or a quote renders as text. Type also scales with content: the LinkedIn headline steps
104 → 64 px as it grows, the OG title 82 → 52 px, and the brand+domain footer shrinks
until its estimated width fits its column.

**Copy comes from the article, never from raw RSS HTML.** *Fetch post page* pulls the
real article body when the feed only carries a one-line snippet (most feeds do), and
falls back to the feed text when the page blocks it. Tags, scripts and entities are
stripped before the text ever reaches the prompt, and the prompt forbids inventing
numbers, names or claims that are not in the article.

**The feed position only advances when the whole kit lands.** The three renders finish
at different times — the image is nearly instant, the teaser is quick, the LinkedIn
video takes longest. *Run summary* counts finished pieces and writes the post's `guid`
into workflow static data only once **all** of them have come through, so a run that
half-fails is retried in full rather than silently skipped.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| OpenRouter API key | One JSON-capable model call per run. `openai/gpt-4.1-mini` is the default because it is cheap and obeys word budgets. |
| A blog with an RSS or Atom feed | Any feed URL. The default is Google's blog feed so the template runs before you change anything. |

No stock-media account, no voice service, no Google account. Music is one optional
pinned URL you can clear.

## Setup

1. **Import** `zvid-blog-content-kit.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Validate project (free)*, *Save draft to
   editor*, *Submit render* and *Get render status*.
3. **OpenRouter credential** — add an **OpenRouter** credential and attach it to
   *Write kit copy*.
4. **Open `Config`** — set `feedUrl` to your blog's feed, then `brandName`,
   `domainOverride` (the label printed on every piece) and the two brand colours
   `brandInk` / `brandAccent`.
5. **Run it.** The workflow renders for real out of the box, so **the first run spends
   credits — 29 at the defaults** (20 for the LinkedIn video + 8 for the teaser + 1
   for the image). When it finishes, click **`▶ Watch video`**: n8n plays both MP4s
   inline and shows the PNG as a picture, one output item per piece.

   Prefer a free preview first? Set `dryRun: true` in `Config` before that first run:
   you get the exact credit quote per piece plus `kitCreditsTotal`, and an
   **`editorLink`** for each that opens the draft in the Zvid editor — nothing spent,
   nothing published.
6. **Activate.** It builds one kit per published post, checking once a day at 9am.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base. Leave it. |
| `editorUrl` | `https://editor.zvid.io` | Used to build the dry-run `editorLink`. |
| `feedUrl` | `https://blog.google/rss/` | Your blog's RSS or Atom feed. Swap this first. |
| `brandName` | `Fieldnotes` | Footer on every piece, the outro wordmark, and the small caps watermark on the teaser. Clamped to 6 words / 40 chars. |
| `domainOverride` | `""` | The domain label printed on all three pieces. Empty = derived from the post link's hostname (`www.` stripped). |
| `kickerText` | `NEW POST` | Chip above the headline on the LinkedIn cover and the teaser. Upper-cased, clamped to 4 words / 22 chars. |
| `pointsLabel` | `What is inside` | Eyebrow over the three point cards. Upper-cased. |
| `subheadText` | `{n} takeaways inside` | Line under the LinkedIn headline. `{n}` is replaced with the real point count (2 or 3). |
| `ctaText` | `Read the full post` | Text inside the outro pill. Clamped to 6 words / 34 chars. |
| `brandInk` | `#0B0F1A` | Base colour of every background plate and the text colour inside accent pills. |
| `brandAccent` | `#FFB454` | Chips, rules, card bars, numbers, CTA pill fill, background glow. |
| `textColor` | `#F2F5FB` | Headlines, point copy, footer brand name. |
| `mutedColor` | `#8D99B4` | Sub-lines, domain, teaser watermark. |
| `headlineFont` | `Instrument Serif` | Serif for the LinkedIn headline, teaser hook, OG title and outro wordmark. |
| `uiFont` | `Space Grotesk` | Sans for chips, point copy, footers and CTAs. One font per text element. |
| `llmModel` | `openai/gpt-4.1-mini` | Any OpenRouter model that honours `response_format: json_object`. |
| `maxPromptChars` | `4000` | How much article text is sent to the model. Raise for long-form posts, lower to cut token cost. |
| `makeLinkedInVideo` | `true` | Set `false` to skip that piece (and its credits). |
| `makeXTeaser` | `true` | Same, for the teaser. |
| `makeOgImage` | `true` | Same, for the share image. At least one must stay `true`. |
| `linkedInSeconds` | `20` | Target length, clamped 12–45 s. Split 26% cover / 52% points / 22% outro. |
| `teaserSeconds` | `8` | Target length, clamped 5–20 s. Split 55% hook / 45% line. |
| `ogImageFormat` | `png` | `png`, `jpg`, `jpeg` or `webp`. |
| `ogImageQuality` | `92` | 1–100, applied only to the lossy formats — `png` is lossless and rejects it. |
| `sceneTransition` | `fade` | Any Zvid scene transition, or `""` for hard cuts. Each non-last scene is padded by `transitionSeconds` so the run still lands on the target length. |
| `transitionSeconds` | `0.5` | Transition length, clamped 0.1–1.2 s. |
| `frameRate` | `30` | 1–60. Both videos. |
| `musicUrl` | a pinned instrumental bed | Music under the two videos. Clear it (`""`) to render them silent; the image never has audio. |
| `musicVolume` | `0.16` | The bed sits low by design. 0–1. |
| `maxMusicBytes` | `5242880` | *Check music* HEADs `musicUrl` first; anything unreachable or larger than this is dropped and the videos render without music rather than failing. |
| `dryRun` | `false` | `false` (default) renders all three pieces for real. `true` gives a free pass: validate, quote credits per piece plus `kitCreditsTotal`, and save each as a draft with an `editorLink`. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. All three jobs are polled together. |

## Cost per video

Three outputs mean **three separate quotes**, and *Run summary* reports both the
per-piece `creditsCharged` and the whole run's `kitCreditsTotal`.

| Piece | Size | Quoted |
| --- | --- | --- |
| LinkedIn square video | 1080×1080, 20.0 s | **20 credits** |
| X teaser video | 1280×720, 8.0 s | **8 credits** |
| Open Graph image | 1200×630 png | **1 credit** |
| | | **29 credits per post** |

Those are the numbers the live validator returned for the default configuration.
*Validate project (free)* still runs before every render and returns the exact quote
for *your* copy, so shorter or longer targets are priced accurately at run time.
Turning a piece off with `makeLinkedInVideo` / `makeXTeaser` / `makeOgImage` removes
its cost. Set `dryRun: true` to see the quote *without* the render.

## How it works

| Node | What it does |
| --- | --- |
| **Read blog feed** | The stock **RSS Feed Read** node — works untouched on n8n Cloud, no community node required. One item per feed entry. |
| **Pick newest post** | Sorts by `isoDate`/`pubDate` when the feed provides dates (feed order otherwise) and takes the newest. If its `guid` matches the last fully rendered kit, it returns `found: false`. Strips tags and entities from the feed body. |
| **New post?** | Routes on `found`. False → *Nothing new today*, a successful "nothing to do" summary rather than an error. |
| **Fetch post page** | Best-effort GET of the post URL to recover the real article body — most feeds carry only a snippet, and copy written from a snippet forces the model to invent. Never fails the run. |
| **Prepare kit prompt** | Extracts `<article>`/`<main>`/`<body>` text, strips scripts, styles and SVG, and uses it only if it is meaningfully longer than the feed excerpt (`articleSource` records which won). Truncates to `maxPromptChars` and builds the prompt, including the no-invention rule and the six word budgets. |
| **Write kit copy** | One OpenRouter call with `response_format: json_object` for `liHeadline`, three `liPoints`, `teaserHook`, `teaserLine`, `ogTitle` and `ogKicker`. |
| **Parse kit copy** | Parses the JSON (recovering it from prose if the model wrapped it), normalises curly quotes, dashes and ellipses to ASCII, strips list numbering and trailing periods, and fails loudly with a fix-it message if a required string is empty or fewer than two points came back. |
| **Check music** | HEAD request on `musicUrl` with `neverError`, so a dead link cannot stop the run. |
| **Music guard** | Drops the bed when the HEAD was not `200` or `content-length` exceeds `maxMusicBytes`, and records a human-readable `musicNote` either way. |
| **Build project JSON** | The whole design system lives here and emits **three items**, one per piece: the square LinkedIn video (cover → point cards → outro), the landscape teaser (hook → line) and the OG image (`type: "image"`, no scenes, no audio). Also: the word/character clamps, the type ramps, HTML-escaping, scene padding for the transition overlap, and the API's `name` character rules. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — once per piece, without spending credits. |
| **Check validation** | Fails with the offending piece's name and a field list when a payload is rejected, and carries `creditsRequired` forward per piece. |
| **Dry run?** | Routes on `Config.dryRun`. It is `false` by default, so the normal path goes straight to *Submit render*. |
| **Save draft to editor** | **Only when `dryRun: true`.** Saves each piece as a free draft and returns its `editorLink`. Best-effort — a hiccup here never hides the dry-run report. |
| **Dry run summary** | **Only when `dryRun: true`.** One item per piece with its quote, dimensions, `editorLink` and `kitCreditsTotal`. Nothing is spent and the feed position is not advanced. |
| **Submit render** | Three paid render submissions, one per piece. |
| **Attach job to piece** | The render response replaces the item, so this glues each `jobId` back onto the piece it belongs to. |
| **Wait / Get render status / Merge job status** | One poll loop for all three jobs. *Merge job status* re-pairs each status response with the piece that entered the lap. |
| **Render finished?** | Finished pieces leave the loop immediately and flow to *Run summary* — which therefore **runs more than once in a single execution**, once per batch of pieces that completed together. Each batch still reports the whole kit's `kitCreditsTotal`. |
| **Still rendering?** | Throws with the piece's name and `failedReason` on a failed render, and stops the loop at `timeoutMinutes` (counted with `$runIndex`). |
| **Run summary** | One item per finished piece: `kind`, `label`, `dimensions`, `format`, `seconds`, `videoUrl`, `creditsCharged`, `kitCreditsTotal`, `piece` ("2 of 3"), the post title and link. Advances the feed marker only after the last piece. |
| **▶ Watch video** | Downloads each finished asset as binary so n8n renders it inline by mime type — the two MP4s become players, the PNG shows as a picture, each with a download button. Retries a few times (the CDN can 404 for a moment right after a render completes) and then continues regardless. |

## Publishing (optional tail)

The run ends with three URLs in *Run summary*. Filter on `kind`
(`linkedin-video`, `x-teaser-video`, `og-image`) to route each piece to its own
destination:

- **LinkedIn** — the 1080×1080 video is already the native LinkedIn format. Post it
  with a scheduler that accepts a public video URL (Blotato, Buffer, Metricool), or
  hand it to a human with a Slack/Email node.
- **X** — the teaser is standard 1280×720 h.264 landscape, the safest shape for the
  timeline; the same schedulers take the URL directly.
- **The OG image** — upload it to your CMS, or point the post's meta tags at the URL:

  ```html
  <meta property="og:image" content="https://…/blog-kit-og-….png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  ```

  1200×630 is the size LinkedIn, X, Slack and Facebook all crop from cleanly.

These stay out of the required path so the import runs with a Zvid key and an
OpenRouter key, nothing else. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and
replace the render HTTP nodes with the native **Zvid** node + **Zvid Trigger**
(render webhook), which removes the poll loop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. **This template submits three renders per run**, so it reaches the limit three times faster than the single-video templates in this series; back-to-back manual test runs are the usual cause. Nothing is charged for a rejected submit. |
| `The feed returned no readable posts` | `feedUrl` is not an RSS/Atom feed (a site homepage is the common mistake). Look for the `/rss`, `/feed` or `/atom.xml` path on your blog. |
| Run says "nothing new" but you just published | The feed has not refreshed yet, or the new entry's `guid` matches the last one rendered. Feeds behind a CDN can lag several minutes. |
| Manual test runs keep re-rendering the same post | Expected. n8n only persists workflow static data on **production** executions, so while the workflow is inactive the `guid` marker never advances. Activate it and the marker starts working. |
| `The model returned only 1 usable liPoints` | The model ignored the shape. Re-run, or set a stronger `llmModel`. Two points are enough — the card block re-centres for two. |
| `The model returned no liHeadline` / `teaserHook` / `ogTitle` | Same cause. The node names exactly which string is missing. |
| Copy ends in `…` | The builder's clamp cut it: the model exceeded its word or character budget. Harmless by design. If it happens on every run, the model is ignoring the prompt — switch `llmModel`. |
| Headline reads as generic filler | `Fetch post page` was blocked or the page is JavaScript-rendered, so the model only had the feed snippet. Check `articleSource` on *Prepare kit prompt*: `feed` means the fallback ran. Publishing full content in your feed fixes it permanently. |
| Videos rendered without music | *Music guard* dropped the bed — read `musicNote` in the summary. Either the URL did not return `200`, or it is larger than `maxMusicBytes` (5 MB is the plan cap for an audio asset). |
| `Zvid rejected the Open Graph share image` | The message lists the offending fields. If you edited the builder: `quality` is illegal with `png` output, image payloads must not carry scenes, audio or enter/exit timings, the `name` field allows only letters, digits, spaces, `_` and `-`, and `audios[].track` is rejected. |
| `Every output is switched off in Config` | All three of `makeLinkedInVideo`, `makeXTeaser` and `makeOgImage` are `false`. Turn at least one back on. |
| One piece rendered, the run then failed | Deliberate. The `guid` marker is only advanced once every piece has landed, so the next run rebuilds the whole kit instead of leaving you with a partial set. Nothing else is written anywhere. |
| *Run summary* appeared twice in one execution | Also deliberate — the three renders finish at different times and each completed batch flows through. Both batches carry the same `kitCreditsTotal`. |

## Verified

n8n **2.29.10** node types and versions (every node resolves in a stock install; the
RSS Feed Read node is core, so the import needs no community packages). Here is
exactly what was verified before release:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the render
  farm runs) from the builder's real output — **three fixtures × three pieces, nine
  renders, seven distinct designs**:
  - **default** — a typical post: LinkedIn 20.0 s, teaser 8.0 s, OG png, music bed
    attached.
  - **stress** — a 78-character original post title, a 10-word / 90-character
    headline, three 8-word points that wrap to two lines inside their cards, a teaser
    line that **overruns** its 16-word budget so the clamp and its ellipsis render, a
    29-character brand name, a 23-character domain (the footer shrinks to stay inside
    the OG column), an ampersand to prove HTML escaping, and **no** music so the
    silent path renders.
  - **two-points** — the model returned only two takeaways: the card block re-centres
    and the `{n}` subhead reads "2 takeaways inside". Its teaser and OG payloads come
    out byte-identical to the default fixture's, which is itself the proof that the
    point count only reaches the LinkedIn piece.
- **All 175 distinct frames were reviewed**: 2 fps sweeps (40 frames per LinkedIn
  video, 16 per teaser) plus exact-timestamp grabs at every transition midpoint, every
  transition end and every final frame, plus both PNGs at full size. No clipping, no
  overflow, no text touching a plate edge or crossing the OG column rule, contrast
  holding on every gradient and glow position, every string substituted, and no broken
  animation half-states.
- **Remote validation against the live API** (`POST /api/render/validate/api-key` via
  MCP with `remote: true`) on **all three distinct payload shapes**, each `valid: true`
  with **0 errors and 0 warnings**, schema **1.0.0**: the LinkedIn video
  (`creditsRequired: 20`, resolved 20 s at 1080×1080), the teaser
  (`creditsRequired: 8`, resolved 8 s at 1280×720) and the OG image
  (`creditsRequired: 1`, 1200×630 png) — **29 credits for the kit**.
- **Both default URLs HEAD-checked** at authoring time: the feed returned `200
  application/xml`, and the music bed returned `200 audio/mpeg` at 1,556,480 bytes,
  comfortably under the 5 MB cap the guard enforces.
- **Hostile and runaway copy proven harmless** by the local harness: `<script>`,
  `<img src=x onerror=…>`, `&` and `'` all arrive in the payload as HTML entities, and
  a 22-word runaway string in every field is clamped back inside every budget with an
  ellipsis marker.
- **The embedded code node is byte-identical** to the frame-reviewed standalone builder
  (asserted programmatically, not by eye), and simulated executions of the shipped
  nodes' JS against mocked n8n globals reproduced the reviewed payloads — including a
  multi-lap poll loop where the three pieces finish on different laps, confirming the
  index pairing holds and the `guid` marker advances only after the last piece.
- **The reviewed assets provably came from the shipped builder.** The build step is
  pure — no clock, no randomness — so re-running it reproduces every payload byte for
  byte, and re-rendering the stress share image from that payload returned a PNG with
  the identical checksum to the reviewed one.
- **Structural checks** on the workflow JSON: parseable, all connections resolve, all
  code nodes compile, unique names/ids, core-only node types, no credentials blocks,
  Zvid calls on Header Auth, and no secrets in the file.

## Live n8n execution (2026-07-31)

Executed headlessly in a real n8n instance (`n8n execute`), on a real feed, with real
credentials. Config overrides for the run: `linkedInSeconds: 16`, `teaserSeconds: 8`.

**What actually ran, end to end:** the schedule trigger's manual twin → `Read blog feed`
returned 20 live items → `Pick newest post` selected *"Experience the magic of Kosovo from
anywhere with Street View"* → `Fetch post page` pulled the real article → `Write kit copy`
called OpenRouter live → `Check music` HEAD-checked the bed (1,556,480 bytes, under the
5 MB cap) → `Build project JSON` produced all three payloads → `Validate project (free)`
returned **zero warnings** and quoted **16 + 8 + 1 = 25 credits** → all three jobs were
submitted, polled to `completed`, and written back through `Run summary`.

**All three pieces were produced and downloaded:**

| Piece | Output | Probed |
| --- | --- | --- |
| LinkedIn square video | `.mp4` | 1080×1080, 16.000 s, h264 + aac, 768 KB |
| X teaser video | `.mp4` | 1280×720, 8.000 s, h264 + aac, 320 KB |
| Open Graph image | `.png` | 1200×630, 102 KB |

Every dimension and duration matches the quote exactly. `▶ Watch video` returned one
binary per piece with the right content types — `video/mp4`, `video/mp4`, `image/png`.
All 32 LinkedIn frames and all 16 teaser frames were extracted at 2 fps and reviewed, plus
the share image at full size: no clipping, no overflow, no unsubstituted variables, and the
LLM copy is faithful to the source post.

**A real bug this run caught, now fixed.** The first live run rendered the placeholder host
`yourblog.com` instead of the post's real domain. Cause: `Pick newest post` derived the
domain with `new URL(link).hostname`, and **n8n's Code-node sandbox has no `URL` global** —
`typeof URL` is `"undefined"` and the constructor throws `ReferenceError`. The surrounding
`try/catch` turned that crash into an empty string, so the failure was silent. No local test
could catch it: the builder harness runs under plain node, where `URL` *is* a global.
`Pick newest post` now parses the host with a regex, and the re-run rendered
`Fieldnotes · blog.google` on every piece — verified in the payloads (placeholder count
4/3/2 → 0/0/0) and on screen in the frames above. The same defect was found and fixed in
Day 4's `blog-to-video`, the only other template that used `new URL` in a code node.

**Still not exercised:** the publish tail (LinkedIn/X posting, OG upload) — those are
documented suggestions, not shipped nodes — and the `New post?` "already seen this guid"
short-circuit, which needs a second run against an unchanged feed.
