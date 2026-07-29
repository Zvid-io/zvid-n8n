# Turn every new blog post into a 60-second video

[`zvid-blog-to-video.json`](zvid-blog-to-video.json)

Every day this workflow checks your blog's RSS feed. When a new post appears it
fetches the actual article page, has an LLM write an honest summary script (a
hook, three to five points, a call to action), voices it with word-level
timings, finds b-roll for each point in Zvid's stock library, and renders a
branded 1080×1920 summary video: an intro card carrying the real post title, one
accent-bar "point card" per idea with karaoke captions riding the narration, and
an outro card carrying your blog's domain. You write the post once; the video
edition writes itself.

```
Schedule ─▶ Config ─▶ Read blog feed ─▶ Pick newest post ─▶ New post?
        ─▶ Fetch post page ─▶ Prepare prompt ─▶ Write script ─▶ Parse script
        ─▶ Stock b-roll per point ─▶ Music guard ─▶ Generate voiceover
        ─▶ Voice + timings ─▶ Upload voiceover ─▶ Build project
        ─▶ Validate (free) ─▶ Render ─▶ Run summary ─▶ ▶ Watch video
```

## Why this one is different

**It reads the post, not the snippet.** Most blog-to-video automations feed the
model whatever the RSS `description` holds — very often a single sentence — and
the model pads the rest out of thin air. *Fetch post page* GETs the article
itself (keyless, best-effort) and *Prepare prompt* strips it to plain text,
preferring it over the feed excerpt only when it is meaningfully richer. The
prompt then forbids inventing anything that is not in that text, so a thin
source produces a general video rather than a fabricated one, and the run
summary reports which source was used (`articleSource: page | feed`). A failed
or blocked page fetch never kills the run — the feed text is the fallback.

**The cuts land on sentence boundaries because the voice says so.** ElevenLabs'
`/with-timestamps` endpoint returns the audio *and* a character-level alignment
in one call, so the timings are the audio — there is no second transcription
step that can disagree. The build step walks that timed word stream by
per-sentence word count: the intro ends exactly when the hook ends, each point
scene ends when its sentence ends, and the karaoke highlight tracks the real
voice. If tokenisation ever drifts (digits, abbreviations — the prompt bans
both), it falls back to a proportional split rather than failing, and reports it
as `cutsAlignedToSpeech: false`.

**On-screen copy is not the spoken copy.** The writer returns two fields per
point: `text` (one spoken sentence of fifteen to twenty-five words) and `label`
(an on-screen headline of eight words or fewer). Subtitling the spoken sentence
*and* printing it as a headline is what makes automated summary videos look
generated; a short headline plus word-timed captions reads like an edit.

**A missing clip degrades into a different layout, not an empty one.** Any point
with no usable stock result gets its own designed slide instead of the b-roll
scene: the point label carried at headline size against the brand geometry, a
progress rail showing which point of how many this is, and a slow light sweep
so the frame keeps moving for the seven or eight seconds it is on screen. It
reads as a deliberate type slide between two footage scenes rather than as
footage that failed to load. Music is `HEAD`-probed for reachability and byte
size before use, because an oversized audio asset fails the *whole* render — a
nice-to-have bed must never be able to do that. No usable track simply means no
music.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| ElevenLabs API key | Generates the voiceover with word timings. One narration runs 600–800 characters, and the free tier is 10,000 characters a month — roughly 12 videos, fewer if your scripts run longer. |
| OpenRouter API key | Writes the summary script. Any OpenAI-compatible chat endpoint works — swap the URL and credential type. |
| An RSS or Atom feed | Your blog's feed URL. Most platforms expose one at `/rss`, `/feed` or `/atom.xml`. |

No stock-media accounts to set up. Footage and music come from Zvid's stock
library via `/api/stock/search`, which runs on server-side keys and needs no
authentication of its own.

## Setup

1. **Import** `zvid-blog-to-video.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Upload voiceover*, *Validate project
   (free)*, *Save draft to editor*, *Submit render* and *Get render status*.
3. **ElevenLabs credential** — add a **second Header Auth** credential, name
   `xi-api-key`, value = your ElevenLabs key. Attach it to *Generate voiceover*.
   (n8n has no built-in ElevenLabs credential; Header Auth is the supported way
   and works on n8n Cloud.) The key only needs text-to-speech permission.
4. **OpenRouter credential** — attach it to *Write script*.
5. **Open `Config`** — set `feedUrl` to your blog's feed, then `brandName`,
   `brandColor` / `brandAccent` and `ctaText`. Everything else has a working
   default.
6. **Run it.** The workflow renders for real out of the box, so **the first run
   spends credits — about 38** for a ~38 second video. When it finishes, click
   **`▶ Watch video`** to play the result inside n8n.

   Prefer a free preview first? Set `dryRun: true` in `Config` before that first
   run: you get the exact credit quote plus an **`editorLink`** that opens the
   draft at [editor.zvid.io](https://editor.zvid.io), with nothing spent — and
   the post is *not* marked as rendered, so the next real run still picks it up.
7. **Activate.** Every new post becomes a video, at most one per day.

The workflow ships both a **Test manually** trigger and a daily schedule, so you
can try it before activating it.

### On the free ElevenLabs tier, use a default voice

The voice is addressed by **id**, not by name — listing voices needs an extra
permission that text-to-speech does not, so addressing the id keeps the key
minimal. On a free ElevenLabs plan only default voices work; a Voice Library
voice answers `402 paid_plan_required`. These default ids are confirmed working
on a free account:

| Voice | `voiceId` |
| --- | --- |
| Brian (deep narrator, the default) | `nPczCjzI2devNBz1zQrb` |
| George (warm narrator) | `JBFqnCBsd6RMkjVDRZzb` |
| Roger | `CwhRBWXzGAHq8TQ4Fs17` |
| Sarah | `EXAVITQu4vr4xnSDxMaL` |
| Bill | `pqHfZKP75CvOlQylNhV4` |

## Configuration

Everything lives in the `Config` node — no expressions to hunt through.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base. Leave it alone. |
| `editorUrl` | `https://editor.zvid.io` | Used to build the dry-run `editorLink`. |
| `feedUrl` | `https://blog.google/rss/` | **Set this to your blog.** Any RSS or Atom feed. |
| `brandName` | `Fieldnotes` | Watermark pill, intro chip and outro sub-line. |
| `ctaText` | `Read the full post` | The outro headline. |
| `language` | `English` | Passed to the writer; the voice model is multilingual. |
| `targetSeconds` | `60` | Target narration length. Treat it as a guide — small models write short (see below). |
| `llmModel` | `openai/gpt-4.1-mini` | OpenRouter model id. |
| `voiceId` / `voiceLabel` | `nPczCjzI2devNBz1zQrb` / `Brian (deep narrator)` | ElevenLabs voice id. `voiceLabel` is a comment for humans — only the id is sent. |
| `elevenModel` | `eleven_multilingual_v2` | Any ElevenLabs model that supports timestamps. |
| `voiceStability` / `voiceSimilarity` | `0.4` / `0.75` | ElevenLabs voice settings. Lower stability = more expressive. |
| `brandColor` | `#0F1626` | Base colour: canvas, card fills and every scrim derive from it. |
| `brandAccent` | `#FFB454` | Accent bar, kicker, point number, domain pill and the spoken caption word. |
| `textColor` / `mutedTextColor` | `#FFFFFF` / `#9AA7BD` | Headline and secondary type. |
| `headlineFont` / `uiFont` | `Archivo` / `Space Grotesk` | Google Fonts names. Headline carries the title and point labels; UI carries the kicker, chip, captions and outro pill. One font per text element. |
| `captionAnimation` | `karaoke` | Also `fill`, `pop`, `bounce`, `typewriter`, `one-word`, `highlight`, … (see the caption note below). |
| `captionWordsPerCue` | `3` | Words on screen at once. |
| `captionSize` | `54` | Caption type size. |
| `captionStrokeWidth` | `6` | Black outline. This is what keeps captions readable over any footage. |
| `captionActiveColor` | `#0F1626` | Only used by box modes (`highlight`) — the text colour inside the accent chip. |
| `kenBurnsDepth` | `1.12` | Slow push on every b-roll clip. |
| `sceneTransition` / `transitionSeconds` | `fade` / `0.4` | Set `sceneTransition` to `null` for hard cuts. |
| `maxPromptChars` | `4000` | How much article text reaches the writer. Raise it for long-form posts and a bigger model. |
| `musicVolume` | `0.1` | The bed sits under the narration. |
| `maxMusicSeconds` / `maxMusicBytes` | `200` / `5242880` | Guards against a music track that would blow the plan's audio size cap and fail the render. |
| `resolution` | `instagram-reel` | 1080×1920. |
| `frameRate` | `30` | |
| `tailSeconds` | `0.4` | Silence held on the outro after the last spoken word. |
| `dryRun` | `false` | `false` (default) renders for real. Set it to `true` for a free pass that validates the payload, quotes the credits and saves a draft you can watch in the editor — no credits, and the post stays unconsumed. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

### A note on caption modes

The default is **`karaoke`**: white words with a heavy black outline, and the
word being spoken turns your accent colour. It stays legible over dark *and*
bright footage, which matters when the b-roll is picked automatically and you
cannot predict what it looks like.

Box modes (`highlight`) draw a coloured chip behind the spoken word. The
subtitle engine strokes the glyphs **on top of** that chip, so a heavy outline
with no box padding turns the chip into a black blob. The build step handles
this for you: pick `highlight` and it thins the stroke to 2 px and adds box
padding automatically. Do not hand-edit the stroke width up in a box mode.

### Two things to know about the writer

**Small models write short.** The prompt asks for a total word budget and a
per-point sentence length, which gets `gpt-4.1-mini` to roughly 100–140 words
against a 150-word target for `targetSeconds: 60` — a 40–50 second video rather
than 60. A stronger model tracks the target more closely. Nothing breaks either
way: the video simply matches however long the narration turned out, because
every scene length comes from the voice timings. *Parse script* hard-fails below
50% of target so a one-line script can never reach a paid render.

**It summarises; it does not fact-check.** The prompt forbids using anything
that is not in the article text, which is the right guard for a summary of your
*own* post. It is not a guard against your post being wrong.

## Cost per video

The live validator quoted **38 credits** for the 37.6 second default fixture —
roughly **one credit per second** of finished 1080×1920 video, so a full
60-second summary lands near 60. *Validate project (free)* runs before every
render and returns the exact quote for your payload; it is reported as
`creditsCharged` in the run summary. Set `dryRun: true` if you want the number
*without* the render.

The script costs well under a cent. `eleven_multilingual_v2` bills one
ElevenLabs character per character of narration, and one narration here is
600–800 characters (the two verified fixtures came to 608 and 800), so the free
plan's 10,000 characters a month cover roughly **12 videos**. Raise
`targetSeconds` and that number drops — divide 10,000 by your own narration
length.

## How it works

| Node | What it does |
| --- | --- |
| **Read blog feed** | Core `RSS Read` node on `Config.feedUrl`; one item per feed entry. Works untouched on n8n Cloud. |
| **Pick newest post** | Sorts newest-first by `isoDate`/`pubDate` (feeds without dates keep feed order, which is newest-first in practice), then compares the newest guid against workflow static data. Already rendered → a friendly "nothing new" summary instead of an error. Also strips the feed body to plain text. |
| **New post? / Nothing new today** | The skip branch. Static data only persists on *production* executions, so manual test runs always see the newest post as new. |
| **Fetch post page** | GETs the article URL as text, keyless. `onError: continueRegularOutput` — a 403, a timeout or a paywall never kills the run. |
| **Prepare prompt** | Extracts `<article>`/`<main>`/`<body>`, strips scripts, styles and tags to plain text, and uses it only when it is meaningfully richer than the feed excerpt. Caps at `maxPromptChars` and builds the writer prompt. |
| **Write script** | One JSON-mode OpenRouter call returning `title`, `hook`, `points[{text, label, visualQuery}]`, `cta` and a music tag. The prompt bans digits, abbreviations, markdown and non-ASCII punctuation — all four break caption alignment or make the voice stumble. |
| **Parse script** | Validates the JSON, normalises smart quotes and dashes to ASCII, trims labels to eight words, clamps to five points (free plans allow five video elements) and joins the sentences into the exact string the voice will speak. |
| **Expand points / Search stock clips** | One item per point, then one stock search per point against Zvid's stock library. |
| **Pick scene clip** | Scores portrait footage highest (the canvas is 1080×1920 — landscape still works through `resize: "cover"`, it is just cropped harder) and prefers clips long enough to cover the scene. A clip shorter than its scene is slowed rather than frozen. No result → that point renders as a brand type slide instead (see *Build project JSON*). |
| **Music queries / Find background music** | Asks for the writer's music tag plus two broad fallbacks, because the catalogue intermittently returns nothing for a tag that worked a minute earlier. |
| **Shortlist music / Check music asset / Pick music** | Ranks candidates shortest-first, then `HEAD`s each and keeps the first that is reachable and within `maxMusicBytes`. Nothing usable → no music, never a failure. |
| **Generate voiceover** | ElevenLabs `/with-timestamps` → base64 mp3 **plus** character-level alignment. |
| **Voice + timings** | Decodes the audio into a named binary and groups the character alignment into word timings. |
| **Upload voiceover** | Uploads the mp3 to Zvid and gets back a CDN URL for the project's audio track. |
| **Build project JSON** | The whole design lives here: intro card with adaptive title type (62→41 px) and a chip that re-positions under however many lines the title takes, one point scene per idea — footage + scrim + accent-bar card, or, with no footage, a brand type slide (headline-size label at 68→44 px, point-progress rail, animated light sweep) — outro CTA card, word-timed captions, watermark, music bed, transition padding and the API's `name` character rules. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — without spending credits. Failures surface as a field list, not a generic HTTP error. |
| **Dry run?** | Routes on `Config.dryRun`. It is `false` by default, so the normal path goes straight to *Submit render*. |
| **Save draft to editor / Dry run summary** | **Only when `dryRun: true`.** Saves a free draft, returns `editorLink` (`https://editor.zvid.io/?project=…`) and reports the quote. Best-effort: a hiccup saving the draft never hides the rest of the dry-run report. |
| **Submit render / Wait / Get render status** | Paid render plus a poll loop. |
| **Still rendering?** | Fails fast when the job reports `failed` and stops the loop at `timeoutMinutes`. |
| **Run summary** | Reports the video URL, credits charged, post link, point count and `articleSource` — and remembers the post's guid **only here**, after a successful render, so a failed render is retried on the next run. |
| **▶ Watch video** | Downloads the finished MP4 as binary so n8n plays it inline in the output panel — click the node to watch it, or use its download button. Never fails the run: it retries a few times (the CDN can 404 for a moment right after a render completes) and then continues regardless. |

## Publishing (optional tail)

The required path ends with the video URL in *Run summary* — a clean handoff you
can extend:

- **YouTube Shorts** — the *▶ Watch video* node already holds the MP4 as binary
  `data`; add the native **YouTube** node (Video → Upload) after it. Needs a
  YouTube OAuth2 credential.
- **Instagram / TikTok / multi-platform** — pass `videoUrl` to a scheduler such
  as Blotato, Buffer or Metricool over their HTTP API; they take a public video
  URL directly.
- **Human in the loop** — a Slack or Email node sending `videoUrl` plus
  `postLink` to whoever posts manually.

These stay out of the required path so the import runs with a Zvid key, an
ElevenLabs key and an OpenRouter key, nothing else. On self-hosted n8n you can
also install [`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid)
and replace the render HTTP nodes with the native **Zvid** node + **Zvid
Trigger** (render webhook), which removes the poll loop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `The feed returned no readable posts` | `feedUrl` is not an RSS/Atom feed (a site homepage is the usual mistake), or the feed is empty. Open the URL in a browser: you should see XML. |
| Run says `Newest post already rendered` | Normal. The newest guid matches the last one rendered, so there is nothing to do until you publish again. |
| The same post renders twice | Workflow static data only persists on **production** executions. Manual test runs never remember the last post — activate the workflow and let the schedule run it. |
| The wrong post is picked | The feed has no `pubDate`/`isoDate` on its items, so feed order decides. Fix the feed, or point `feedUrl` at a feed that carries dates. |
| Video summarises one sentence, not the post | `articleSource: feed` in the summary means the page fetch failed or the page was thin, so only the feed excerpt was available. Check whether the post URL is reachable without a login. |
| `The model returned only N usable points` | The writer returned fewer than three points — usually a very short post or a weak model. Use a stronger `llmModel`, or write more before publishing. |
| `The script is only N words for a 60s video` | Same cause. The guard exists so a one-line script can never reach a paid render. |
| `ElevenLabs returned no audio` / `402` | Check the `xi-api-key` credential and your character quota. On a free ElevenLabs plan, a Voice Library `voiceId` is rejected — use one of the default ids above. |
| `ElevenLabs returned audio but no alignment` | The URL must end in `/with-timestamps`. Plain text-to-speech returns no timings and the captions cannot be built. |
| Captions drift out of sync | `cutsAlignedToSpeech: false` in the summary means word tokenisation drifted and the proportional fallback ran. Almost always digits or abbreviations the model slipped in against the prompt. |
| A point renders as a type slide instead of footage | No usable stock clip came back for that point's `visualQuery`. By design: that scene switches to the brand slide layout (big label, progress rail, light sweep) rather than showing a static panel. If it happens on every point, the query terms are the problem — the writer's `visualQuery` is too abstract for a stock catalogue ("digital transformation" finds nothing; "developer typing on a laptop" does). |
| No music on the finished video | Every candidate was unreachable or over `maxMusicBytes`. Also by design: music never fails a render. |
| `Zvid rejected the project` | The message lists the offending fields. If you edited the builder, note the API only allows letters, digits, spaces, `_` and `-` in `name`, and rejects `audios[].track`. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a day never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Verified

Node types and versions resolve in a stock n8n install: core nodes only —
`RSS Read`, HTTP Request, Code, Set, If, Wait, Schedule Trigger, Manual Trigger
and Sticky Note — so it imports on n8n Cloud with nothing installed. Here is
exactly what was verified:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the
  render farm runs) four times from the builder's real output: the default
  fixture (a 48-character post title, 4 points, music bed — 37.6 s, 6 scenes, 36
  caption cues); a stress fixture (a 78-character title wrapping to three lines,
  5 points with 12-word labels and 24-word spoken sentences, **no** music —
  47.0 s, 7 scenes, 48 caption cues); and both again with stock results removed,
  so the no-footage path renders for real — one mixed (points 1 and 3 on the
  brand slide, 2 and 4 on footage) and one with all five points on slides.
  **Every extracted frame was reviewed** (2 fps — 364 frames — plus
  exact-timestamp grabs at every transition midpoint and the final frame): no
  clipping, no overflow, no text touching a canvas edge, no low-contrast text on
  any background — including a bright office clip and a fully saturated one — and
  no broken animation states.
- **The no-footage slide was measured, not assumed.** Mean absolute luminance
  change over the top 1400 px across a 4.5-second span: **11.9 and 14.1** on the
  two slide scenes, against **13.1** for a b-roll scene in the stress fixture and
  **39.3** for a fast one in the default fixture. The slide moves in the same
  band as real footage instead of sitting frozen.
- **The b-roll in both footage fixtures is what the workflow itself resolves.**
  Every clip was obtained by running each fixture point's `visualQuery` through
  `GET /api/stock/search` and the shipped *Pick scene clip* scoring, then
  `HEAD`-checked (all `200`, `video/mp4`). One default point deliberately lands
  on a 5-second clip in a 7.9-second scene, which exercises the slow-down path.
- **Remote validation against the live API** (`POST /api/render/validate/api-key`
  with `remote: true`) on both distinct payload shapes — all footage, and the
  mixed footage/slide payload: `valid: true`, **0 errors, 0 warnings**,
  `creditsRequired: 38`, schema **1.0.0**.
- **The embedded code node is byte-identical** to the frame-reviewed standalone
  builder (asserted programmatically, not by eye), and a simulated execution of
  that node's JS against mocked n8n globals produced the exact reviewed payload.
- **Structural checks** on the workflow JSON: parseable, every connection
  resolves, every code node compiles, unique node names and ids, core-only node
  types, no credentials embedded, and every Zvid call on Header Auth.
- **Free-plan guardrails asserted** on every payload: at most five video
  elements, no `audios[].track`, and no unsubstituted `{{`, `undefined` or `NaN`
  anywhere in the payload.

**Not executed:** the workflow has not been run inside n8n, so the OpenRouter and
ElevenLabs calls were exercised by contract only — the fixtures carry a real
reachable MP3 as the voiceover stand-in plus synthetic word timings that match
the fixture script token-for-token, not output from a live text-to-speech call.
Nothing in the publish/delivery tail was executed either; those nodes are
documented, not exercised.
