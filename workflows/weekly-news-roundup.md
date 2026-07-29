# Weekly news roundup video from your RSS feeds

[`zvid-weekly-news-roundup.json`](zvid-weekly-news-roundup.json)

Every Friday afternoon: read your RSS feeds, pool the week's headlines, let an LLM
pick and script the five most consequential stories for your niche, voice the script
with word-level timings, pull matching b-roll from Zvid's stock library, and render a
1080×1920 countdown video — five to one — with karaoke captions, a branded cold open
and a CTA outro. A newsletter has a video edition by 4:05pm, and nobody edited anything.

```
Schedule (Fri 4pm) ─▶ Config ─▶ Plan feeds ─▶ Read feeds ─▶ Pool headlines
        ─▶ Curate top five (LLM) ─▶ Parse rundown ─▶ stock b-roll + music guard
        ─▶ Generate voiceover ─▶ Voice + timings ─▶ Upload voiceover
        ─▶ Build project ─▶ Validate (free) ─▶ Render ─▶ Run summary ─▶ ▶ Watch video
```

## Why this one is different

**The source tag cannot lie.** The model returns the `index` of the pooled headline each
story came from, and the on-screen source chip (`techcrunch.com`, `theverge.com`…) is
read from that pooled item's real link — never from the model's own output. A hallucinated
outlet name is structurally impossible: an invalid index just drops the chip for that story.

**Cuts land on sentences, not on averages.** The voice is generated through the
`/with-timestamps` endpoint, so the alignment *is* the audio. The builder walks that
alignment by per-segment word count, which puts every scene cut exactly where a blurb
ends — intro, five stories and outro each get their real spoken span. If the alignment
ever disagrees with the script, it falls back to a proportional split and still ships a
video.

**Type scales, and the layout is measured, not hoped for.** Headlines set at 62 px and
step down to 44 px as they get longer; the headline card grows upward from a fixed
baseline so it never runs off the bottom; a long brand name shrinks its chip and, if the
header row still cannot hold both, the dateline is dropped from story scenes (the intro
card already carries it). Both extremes were rendered on the production engine and
reviewed frame by frame.

**A dead feed, a missing clip and a missing track are all survivable.** One unreachable
feed contributes nothing instead of failing the run; a story with no stock match gets a
branded gradient panel with a giant ghost numeral instead of a black hole; music that
404s or exceeds the plan's audio cap is simply left out. The only hard stop is *every*
feed coming back empty.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| ElevenLabs API key | Text-to-speech permission is enough. Used for the narration and its word timings. |
| OpenRouter key (or any OpenAI-compatible chat API) | Picks and scripts the five stories. Default model `openai/gpt-4.1-mini`. |
| RSS feeds | Any public feeds. Three tech defaults ship in `Config`; no key, no account. |

Everything else — b-roll and music — comes from Zvid's stock library through your Zvid
key. No stock-media account of your own.

## Setup

1. **Import** `zvid-weekly-news-roundup.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`, value =
   your Zvid key. Attach it to *Upload voiceover*, *Validate project (free)*, *Save draft
   to editor*, *Submit render* and *Get render status*.
3. **ElevenLabs credential** — a *second* **Header Auth** credential, name `xi-api-key`,
   value = your ElevenLabs key. Attach it to *Generate voiceover*.
4. **OpenRouter credential** — attach it to *Curate top five*. To use a different provider,
   swap that node's URL and credential; it is a plain chat-completions call with
   `response_format: json_object`.
5. **Open `Config`** — set `niche`, `feedUrls`, `brandName`, `ctaText` and your colours.
   Everything else has a working default.
6. **Run it.** The workflow renders for real out of the box, so **the first run spends
   credits — about 43** for a ~42 s five-story roundup. When it finishes, click
   **`▶ Watch video`** to play it inside n8n.

   Prefer a free preview first? Set `dryRun: true` in `Config` before that first run: you
   get the exact credit quote plus an **`editorLink`** that opens the draft in the Zvid
   editor, with nothing spent.
7. **Activate.** A fresh roundup every Friday at 4pm.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base. |
| `editorUrl` | `https://editor.zvid.io` | Used to build the dry-run `editorLink`. |
| `niche` | `AI and tech` | Drives curation *and* the intro card ("THE WEEK IN …"). Keep it short — it is set as display type. |
| `feedUrls` | 3 tech feeds | Array of public RSS/Atom URLs. One item per URL; empty slots are skipped, one URL or ten both work. |
| `lookbackDays` | `7` | Items older than this are dropped from the pool. Undated items are kept. |
| `targetSeconds` | `60` | Told to the LLM as the target length, and used to size the per-scene stock search. |
| `brandName` | `The Weekly Signal` | Chip on every scene, headline on the outro card. |
| `ctaText` | `Follow for next week's five` | Text inside the outro pill. |
| `brandBackground` | `#0D1117` | Canvas colour, scrim colour and card fill. |
| `brandAccent` | `#FFC24B` | Countdown numerals, chips, rules, active caption word. |
| `headlineColor` | `#FFFFFF` | Headline and title type. |
| `mutedColor` | `#9AA3B2` | Kickers and sub-lines. |
| `font` | `Archivo` | One Google font for every text element and the captions. |
| `llmModel` | `openai/gpt-4.1-mini` | Any OpenRouter model id that honours JSON mode. |
| `voiceId` | `nPczCjzI2devNBz1zQrb` | ElevenLabs voice (Brian). Any voice id from your account works. |
| `voiceLabel` | `Brian (deep narrator)` | Documentation only — shown nowhere, kept so the id is identifiable. |
| `elevenModel` | `eleven_multilingual_v2` | ElevenLabs model id. |
| `voiceStability` / `voiceSimilarity` | `0.4` / `0.75` | ElevenLabs voice settings. Lower stability = more expressive. |
| `captionAnimation` | `karaoke` | `karaoke` colours the active word; `highlight` puts it in an accent box (the builder clamps the stroke and adds padding for box modes). |
| `captionWordsPerCue` | `3` | Words per caption cue and per line. |
| `captionSize` | `64` | Caption font size in px. |
| `captionStrokeWidth` | `6` | Black outline. Clamped to 2 automatically in box modes. |
| `captionActiveColor` | `#0D1117` | Text colour of the active word in box modes only. |
| `sceneTransition` | `smoothleft` | Any Zvid transition, or `null` for hard cuts. |
| `transitionSeconds` | `0.4` | Every non-last scene is padded by this so narration still lands on time. |
| `kenBurnsDepth` | `1.12` | Slow push on b-roll. `1` disables it. |
| `musicVolume` | `0.11` | The bed sits under the voice by design. |
| `maxMusicSeconds` | `200` | Shortlist filter — long tracks mean big files. |
| `maxMusicBytes` | `5242880` | Hard size cap probed with a HEAD request before use (plan audio limit). |
| `resolution` | `instagram-reel` | 1080×1920. |
| `frameRate` | `30` | Output fps. |
| `tailSeconds` | `0.4` | Silence held on the outro card after the last word. |
| `dryRun` | `false` | `false` (default) renders for real. `true` validates, quotes the credits and saves a draft you can watch in the editor — nothing spent. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost per video

The live validator quoted **43 credits** for the default five-story roundup (42.55 s,
1080×1920, 30 fps). Cost scales with duration, so a shorter niche script costs less and a
five-story rundown with long blurbs costs more. *Validate project (free)* runs before
every render and returns the exact number for *your* script — it is reported as
`creditsCharged` in the run summary. Set `dryRun: true` to get that number without the
render.

## How it works

| Node | What it does |
| --- | --- |
| **Plan feeds** | Emits one item per usable `feedUrls` entry, so a single RSS node runs once per feed. Fails loudly only if no URL is usable at all. |
| **Read feeds** | Core `RSS Feed Read`, keyless. `onError: continue`, so a dead or slow feed contributes nothing instead of ending the run. |
| **Pool headlines** | Merges every feed's items, drops anything older than `lookbackDays`, dedupes on a normalised title, caps the pool at 40, keeps title + snippet + source domain + link, and assembles the curation prompt. Empty pool = a friendly error naming the two knobs to change. |
| **Curate top five** | Chat completion in JSON mode. Returns countdown order (number one *last*), a rewritten headline of twelve words or fewer, one spoken blurb per story, a stock-footage hint, a music tag, plus intro and outro sentences. The prompt bans digits and abbreviations so the caption alignment stays clean. |
| **Parse rundown** | Parses the JSON (recovering it from prose if the model wrapped it), normalises curly quotes and dashes to ASCII, maps each story back to its pooled source for the on-screen tag, and joins intro + blurbs + outro into the exact narration string sent to TTS. |
| **Expand stories → Search stock clips → Pick story clips** | One stock search per story against `{apiUrl}/api/stock/search`; portrait clips score highest because the canvas is 9:16, and length is scored against the scene's expected duration. No match = a branded panel, never a failure. |
| **Music queries → Find background music → Shortlist music → Check music asset → Pick music** | Searches the curator's music tag plus two broad fallbacks, prefers the shortest track that is still long enough, then HEAD-probes candidates and keeps the first that is reachable *and* under `maxMusicBytes`. No usable track just means no music bed. |
| **Generate voiceover** | ElevenLabs `/with-timestamps` — audio and a character-level alignment in one call. |
| **Voice + timings** | Turns the response into an mp3 binary plus word timings (characters grouped into words). |
| **Upload voiceover** | Multipart upload to `{apiUrl}/api/uploads`; the render reads the voice track from the returned URL. |
| **Build project JSON** | The whole design: dateline, adaptive type ramps, headline cards that grow from a fixed baseline, countdown numerals, gradient fallback panels, scene spans walked from the real word timings, transition padding, karaoke caption cues, and the API's `name` character rules. All user and model text is HTML-escaped before it reaches any markup. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — without spending credits. Failures surface as a field list. |
| **Dry run?** | Routes on `Config.dryRun`. It is `false` by default, so the normal path goes straight to *Submit render*. |
| **Save draft to editor** | **Only when `dryRun: true`.** Saves a free draft and returns `editorLink` (`https://editor.zvid.io/?project=…`). Best-effort: a hiccup there never hides the dry-run report. |
| **Dry run summary** | **Only when `dryRun: true`.** Quoted credits, `editorLink`, the countdown list, warnings — and nothing spent. |
| **Submit render / Wait / Get render status** | Paid render plus a poll loop. |
| **Still rendering?** | Fails fast when the job reports `failed` (carrying `failedReason`) and stops the loop at `timeoutMinutes`. |
| **Run summary** | `videoUrl`, `jobId`, the ordered `countdown` list with each story's real source, duration, caption count, whether cuts were aligned to speech, the music track and `creditsCharged`. |
| **▶ Watch video** | Downloads the finished MP4 as binary so n8n plays it inline — click the node to watch this week's roundup, or use its download button. It retries a few times (the CDN can 404 for a moment right after a render completes) and then continues regardless, so it can never fail a finished run. |

## Publishing (optional tail)

The required path ends with the URL in *Run summary*. To auto-publish, extend after it:

- **YouTube Shorts** — HTTP Request node (GET `videoUrl`, response format *File*) → native
  **YouTube** node (Video → Upload, binary `data`). Needs YouTube OAuth2.
- **Instagram / TikTok / multi-platform** — pass `videoUrl` to a scheduler such as Blotato,
  Postiz, Buffer or Metricool over their HTTP API; they take a public video URL directly.
- **Newsletter / human in the loop** — an Email or Slack node carrying `videoUrl` plus the
  `countdown` list to whoever writes the send.

These stay out of the required path so the import runs with a Zvid key, an ElevenLabs key
and an LLM key, nothing else. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and replace
the render HTTP nodes with the native **Zvid** node + **Zvid Trigger** (render webhook),
which removes the poll loop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `No usable stories in the last N days from any configured feed` | Every feed was empty, unreachable or only had older items. Check `feedUrls` in a browser, or raise `lookbackDays`. |
| A feed is silently missing from the pool | Intentional. *Read feeds* uses `onError: continue`, so one dead feed never kills the run — the pool just has fewer candidates. Open that node's output to see which URL returned nothing. |
| Only three or four stories in the video | The pool had fewer than five distinct stories, and the model was told to return what exists. The countdown renders 3–5 stories and the intro card adapts ("THE FOUR STORIES THAT MATTERED"); `storyCount` in the run summary says how many. |
| `The model did not return JSON` | The model ignored JSON mode. Use a model that supports `response_format: json_object` — the default `openai/gpt-4.1-mini` does. |
| `The script is only N words - too short for a roundup` | The model returned stub copy. Retry, or use a stronger `llmModel`. |
| A story has no source chip | Its `index` did not match any pooled headline, so the tag is omitted rather than guessed. This is the honesty guard working. |
| A scene shows a gradient panel with a big faded number | No stock clip matched that story's `visualQuery`. The run continues; `missingClips` in the summary counts them. Nudge the prompt or the niche wording for more filmable hints. |
| No music in the finished video | Every candidate failed the HEAD probe or exceeded `maxMusicBytes` (the plan's audio cap). `rejected` in *Pick music* lists why. A missing bed never fails a render. |
| `ElevenLabs returned no audio` | Wrong or missing `xi-api-key` credential, a `voiceId` your account cannot use, or an exhausted character quota — the message carries the response. |
| `ElevenLabs returned audio but no alignment` | The URL was changed and no longer ends in `/with-timestamps`. Word timings come from that endpoint; without them there are no karaoke captions and no sentence-accurate cuts. |
| Captions drift from the voice | The model wrote digits or abbreviations that the voice expands ("2026" → "twenty twenty six"), so the alignment has more words than the script. The builder detects the drift and falls back to a proportional split. Keep the "spell numbers out" rule in the prompt. |
| `Zvid rejected the project` | The message lists the offending fields. If you edited the builder, note that the API only allows letters, digits, spaces, `_` and `-` in `name`, and rejects `audios[].track`. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a week never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Verified

n8n **2.29.10** node types and versions (every node resolves in a stock install; `RSS Feed
Read` is core n8n, so this template also runs untouched on n8n Cloud with nothing
installed). Here is exactly what was verified:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the render farm
  runs) from the builder's real output, twice: the default fixture — five stories, typical
  headlines, one real b-roll clip per story (five video elements, the free-plan maximum) —
  at **42.57 s**, and a
  stress fixture at **56.63 s** carrying a 46-character niche that wraps the intro title to
  three lines, twelve-word headlines, 28-word blurbs, a 61-character hyphenated source
  domain and one story with no stock match (the gradient-panel fallback).
  **Every extracted frame was reviewed** — 85 and 113 frames at 2 fps, plus exact-timestamp
  grabs at all six transition midpoints and the final frame of each render. One real defect
  was found this way and fixed: with a three-line niche title the intro dateline pill
  collided with the last line, because the line-count estimate ran under. The estimator is
  now biased to over-count (over-counting only pushes a block down empty canvas), the
  source-chip estimate now pays for its letter-spacing, and the stress fixture was
  re-rendered and re-reviewed frame by frame.
- **Remote validation against the live API** (`POST /api/render/validate/api-key` via MCP
  with `remote: true`) on the default payload: `valid: true`, **0 errors, 0 warnings**,
  `creditsRequired: 43`, schema **1.0.0**.
- **The embedded code node is byte-identical** to the frame-reviewed standalone builder —
  asserted programmatically by reading both and string-comparing (21 777 characters), not
  by eye — and a simulated execution of the node's JS against mocked n8n globals produced
  the exact reviewed payload.
- **Structural checks** on the workflow JSON: parseable, all 39 nodes carry unique names and
  ids, every connection resolves, all 14 code nodes compile, core-only node types, no
  credentials blocks anywhere (you attach your own), and `Config` carries every documented
  key.

**Not executed:** the workflow has not been run inside n8n for this template, so the
LLM, ElevenLabs, stock-search, upload and render HTTP calls are verified by contract and
by their shipped-template shapes, not by a live run. Nothing in the publish/delivery tail
was executed either — those nodes are documented, not exercised.
