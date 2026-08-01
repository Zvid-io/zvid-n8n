# Turn one long video into vertical Shorts

[`zvid-video-to-shorts.json`](zvid-video-to-shorts.json)

POST a direct video URL to this workflow and get finished vertical clips back.
It downloads the start of the file, transcribes it with ElevenLabs Scribe, asks
an LLM which moments are worth cutting, then renders each one as a polished
1080×1920 Short with word-timed karaoke captions, a title card and a progress
hairline — and answers the webhook with the clip URLs. One long recording in,
two ready-to-post Shorts out, with no editor open.

```
Webhook (or Test manually) ─▶ Video request ─▶ Config ─▶ Fetch video sample (Range)
        ─▶ Transcribe (Scribe) ─▶ Read transcript ─▶ Pick highlights (LLM)
        ─▶ Prepare clips ─▶ Build project JSON (one item per clip)
        ─▶ Validate (free) ─▶ Render each clip ─▶ Run summary
        ─▶ ▶ Watch video  +  Respond with clips
```

## Why this one is different

**The source video is never re-encoded or re-uploaded.** Each clip is a Zvid
project that points at your original URL with `videoBegin` / `videoEnd` — a trim
window in *source* time. The render farm seeks straight into the file. Nothing
is cut locally, nothing is copied to another bucket, and n8n never has to hold a
video in memory to produce one.

**The model picks words, not timestamps.** *Read transcript* numbers the Scribe
word stream and *Pick highlights* asks for `startWord`/`endWord` **index**
pairs. *Prepare clips* maps those indices back to real Scribe times, then grows
or trims each clip one word at a time until it lands between `minClipSeconds`
and `maxClipSeconds`, drops overlaps and adds a 0.3 s lead-in and 0.45 s tail.
So a hallucinated timestamp is not a failure mode that exists here, and the cut
always lands on a word boundary. If the model returns nothing usable the
transcript is split evenly instead and `pickedByModel: false` shows up in the
summary — a run never dies because a model had an off day.

**`fit` is the default, and that is a deliberate choice.** This workflow does not
track faces, so a blind centre crop would decapitate two-shots, panels, screen
shares and anything framed off-centre. In `fit` the whole frame is kept and
centred, with a blurred, darkened copy of the same footage filling the rest of
the canvas. `fill` (full-bleed centre crop) is one Config key away when you know
the subject is centred.

**The progress hairline has no animation in it.** The accent bar across the top
is a native wipe transition over the clip's real timeline plus a static rect
that owns the last quarter-second — not a captured CSS loop. That is why it can
never be caught half-drawn on the final frame, needs no segmenting on a long
clip, and costs the renderer nothing.

**Frame 0 is treated as the thumbnail.** The clip chip, the hook and the handle
carry no entrance animation — they are at full opacity on the very first frame,
because that frame is what a paused scroll, a preview grid and every cover-image
picker will show. Motion comes from the footage, the karaoke captions and the
progress hairline instead.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| ElevenLabs API key | For Scribe speech-to-text. Billed per minute of audio transcribed. |
| OpenRouter API key | For the highlight picker. Any JSON-capable model works. |
| A direct video URL | The file itself, not a watch page — see [What you can POST](#what-you-can-post). |

## Setup

1. **Import** `zvid-video-to-shorts.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Validate project (free)*, *Save draft to
   editor*, *Submit render* and *Get render status*.
3. **ElevenLabs credential** — add a **second Header Auth** credential, name
   `xi-api-key`, value = your ElevenLabs key. Attach it to *Transcribe (Scribe)*.
4. **OpenRouter credential** — add an **OpenRouter** credential and attach it to
   *Pick highlights*.
5. **Open `Config`** — set `handle` and `brandAccent`. Everything else works out
   of the box.
6. **Run it.** *Test manually* uses the sample video in the *Sample video* node,
   so you can watch the whole chain work before pointing anything at n8n. The
   workflow renders for real out of the box, so **the first run spends credits —
   about 28 per 27-second clip, so roughly 56 for a default two-clip run.** When
   it finishes, click **`▶ Watch video`** to play the clips inside n8n.

   Prefer to preview for free first? Set `dryRun: true` in `Config` before that
   first run: you get the exact credit quote *per clip* plus an **`editorLink`**
   that opens each draft in the Zvid editor, with nothing spent.
7. **Activate** to expose the webhook, then POST to it:

   ```
   POST http://<your-n8n>/webhook/video-to-shorts
   { "videoUrl": "https://.../talk.mp4", "title": "optional", "layout": "fit | fill" }
   ```

> **Post footage you have the right to post.** Every clip paints your `handle`,
> a model-written hook and the transcript over whoever is on screen. That is
> fine on your own recording and it is not fine on someone else's: a stranger's
> face under your handle, or under a hook they never said, is a false
> attribution, and a brand's product under an invented claim is worse. If you
> are demoing this template with stock or borrowed footage, use clips with no
> identifiable faces and no logos, wordmarks or legible signage in frame, and
> keep the hook out of the first person.

## What you can POST

`videoUrl` must return **the video file itself**.

| Source | What to send |
| --- | --- |
| Your own CDN / S3 / R2 | the object URL |
| Google Drive | the normal share link — *Video request* rewrites it to the `uc?export=download` form for you |
| Dropbox | the share link with `?dl=1` |
| YouTube / Vimeo / TikTok | **not supported.** Those URLs serve a watch *page*, not a file, so there is nothing to download. *Video request* rejects them with that message rather than failing later in a confusing way. Export the video (YouTube Studio → Download, or Google Takeout) and upload it somewhere that serves the MP4 directly. |

`title` is optional context for the highlight picker. `layout` is optional and
overrides the Config default for that one call — which is usually the right
place for it, since the correct answer depends on how the *source* was framed,
not on your account.

## Only the downloaded part gets clipped

*Fetch video sample* sends a `Range: bytes=0-…` header capped at
`maxTranscribeMB` (24 MB by default), so a two-hour recording never has to
travel through n8n. MP4 and MP3 tolerate that: the decoder reads what arrived
and stops.

The honest consequence: **clips can only come from the part that was
downloaded.** At 24 MB that is roughly the first 2–6 minutes of a typical 1080p
upload, and considerably more for a low-bitrate talking-head recording. Raise
`maxTranscribeMB` to reach further in — the cost is transfer time and ElevenLabs
minutes, not Zvid credits.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base URL. |
| `clipCount` | `2` | Clips per run, clamped to 1–3. **Each clip is its own render and its own credit charge.** |
| `clipSeconds` | `28` | Target clip length the picker aims for, clamped to 12–45. |
| `minClipSeconds` | `18` | A clip shorter than this is grown one word at a time. |
| `maxClipSeconds` | `40` | A clip longer than this is trimmed one word at a time. |
| `maxTranscribeMB` | `24` | Size cap on the `Range` download. Raising it reaches further into a long video; see above. |
| `scribeModel` | `scribe_v1` | ElevenLabs speech-to-text model id. |
| `llmModel` | `google/gemini-2.5-flash` | Any JSON-capable OpenRouter model. |
| `handle` | `@yourchannel` | Watermark pill near the bottom. Clamped to 32 characters. Empty string hides it. |
| `layout` | `fit` | `fit` keeps the whole frame over a blurred backdrop; `fill` is a full-bleed centre crop. The webhook body can override it per call. |
| `brandAccent` | `#FFD84D` | Active caption word, progress bar, clip chip. |
| `brandInk` | `#08090D` | Canvas and scrim colour. |
| `titleFont` | `Anton` | Display face for the hook. One font per text element. |
| `uiFont` | `Montserrat` | Captions, chip and handle. |
| `captionAnimation` | `karaoke` | Caption mode. `karaoke` recolours the spoken word and keeps the heavy outline; box modes (`highlight`) automatically clamp the outline to 2 and give the chip behind the spoken word padding and a corner radius — without the radius the renderer draws that chip with the same field the outline uses and the spoken word comes out doubled. |
| `captionSize` | `76` | Caption type size, clamped to 30–110. |
| `captionWordsPerCue` | `3` | Words per cue *and* per caption line, clamped to 1–6. |
| `captionStrokeWidth` | `6` | Black outline width — what keeps captions readable over both dark and bright footage. |
| `sourceVolume` | `1` | Volume of the clip's own audio, 0–1. |
| `backdropBlur` | `6` | Blur on the `fit` backdrop copy, clamped to 1–40. Ignored in `fill`. |
| `showProgressBar` | `true` | The accent hairline across the top. |
| `frameRate` | `30` | Output frame rate. |
| `dryRun` | `false` | `false` (default) renders for real. Set it to `true` for a free pass that validates every clip, quotes the credits per clip and saves a draft you can open in the editor — no credits spent. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. Long clips from a large source take longer; raise the timeout rather than the poll rate. |

## Cost per video

The validator quotes **28 credits** for a 27.3 s clip in `fit`, **22** for a
21.4 s clip in `fill`, **14** for a 13.2 s clip, and **13** for a 12.7 s clip
with the progress bar turned off — the charge tracks the clip's length, not its
layout. A default run is `clipCount: 2` at `clipSeconds: 28`, so budget roughly
**55–60 credits per run**.

*Validate project (free)* runs before every render and returns the exact quote
for your clip — reported as `creditsCharged` per clip in the run summary and
summed in the webhook response. Drop to `clipCount: 1`, `clipSeconds: 20` for a
cheap test, or set `dryRun: true` to get the numbers without the renders.

## How it works

| Node | What it does |
| --- | --- |
| **Test manually** / **Video webhook** | Two ways in. *Test manually* runs the chain against the *Sample video* node so you can prove the whole thing works before wiring anything up; *Video webhook* (POST `/webhook/video-to-shorts`) is the production entry point and the one that gets an answer back. Both feed *Video request*. |
| **Sample video** | The shipped demo source: a Creative Commons open-movie trailer on a stable host, small enough that the `Range` cap never truncates it. Only the manual trigger uses it. |
| **Video request** | Normalizes the input whether it arrived from the webhook (wrapped in `body`) or from *Sample video*. Rewrites Google Drive share links to the direct-download form, rejects watch-page hosts with an actionable message, and enforces https. |
| **Config** | Every knob in one place. |
| **Fetch video sample** | Binary GET with `Range: bytes=0-<maxTranscribeMB>` so a huge source is never fully transferred. |
| **Transcribe (Scribe)** | `POST https://api.elevenlabs.io/v1/speech-to-text`, multipart, `model_id` + `timestamps_granularity=word`. Returns the word-level timings everything downstream depends on. |
| **Read transcript** | Parses the word list defensively (a couple of field-name shapes, `spacing`/`audio_event` entries dropped, curly quotes and dashes normalized to ASCII), then builds the numbered transcript the picker reads. Fails loudly with the response head if fewer than 12 usable words came back. |
| **Pick highlights** | One OpenRouter call in JSON mode: `startWord`/`endWord` indices, a ≤ 6-word title and one line of reasoning per clip. |
| **Prepare clips** | Maps indices back to Scribe times, enforces the min/max clip length on word boundaries, drops overlaps, adds lead-in and tail, and slices the word timings each clip needs for its captions. Falls back to an even split if the model returned nothing usable. |
| **Build project JSON** | The whole design lives here: the `videoBegin`/`videoEnd` trim, the `fit`/`fill` layout branch, the top and bottom scrims, the title size ramp (78 → 49 px until the hook fits two lines), caption cue chunking, the progress hairline, and HTML-escaping of every piece of model or webhook text. Emits **one item per clip**. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — without spending credits. |
| **Check validation** | Turns a rejection into a readable field list naming which clip failed, and carries `creditsRequired` forward. |
| **Dry run?** | Routes on `Config.dryRun`. It is `false` by default, so the normal path goes straight to *Submit render*. |
| **Save draft to editor** / **Dry run summary** | **Only when `dryRun: true`.** Saves each clip as a free draft and reports the per-clip quote, warnings and an `editorLink` (`https://editor.zvid.io/?project=…`). Best-effort: a hiccup saving drafts never hides the report. |
| **Submit render → Attach job to clip → Wait → Get render status → Merge job status** | One render job per clip, all polled in the same loop. The render and status responses replace the item, so *Attach job to clip* and *Merge job status* zip each response back onto its clip by index — safe because *Wait* passes items through unchanged and the status node runs once per item in order. |
| **Render finished?** | Routes on `allCompleted`, the flag *Merge job status* stamps on every item once **every** clip reports `completed`. Clips do not finish on the same lap, so an all-or-nothing gate is what keeps the webhook answer from going out with a partial clip list; until then the whole batch goes to *Still rendering?* and back round to *Wait*. Re-polling a job that already finished costs nothing. |
| **Still rendering?** | Fails fast when a job reports `failed` (naming which clip died and why) and stops the loop at `timeoutMinutes`. |
| **Run summary** | One item per finished clip: `videoUrl`, `title`, `sourceStart`/`sourceEnd`, `clipSeconds`, `captionCues`, `creditsCharged`. |
| **Clips response → Respond with clips** | Collapses the per-clip items into one JSON body: the caller posted one video and gets one answer listing every clip. |
| **▶ Watch video** | Downloads each finished MP4 as binary so n8n plays it inline — one player per clip, no URLs to copy. Never fails the run: it retries a few times (the CDN can 404 for a moment right after a render completes) and then continues regardless. |

## Publishing (optional tail)

The required path ends with the clip URLs in the webhook response. To
auto-publish, extend after *Run summary*:

- **YouTube Shorts** — *▶ Watch video* already downloads the MP4 as binary
  `data`; add the native **YouTube** node (Video → Upload) after it. Needs a
  YouTube OAuth2 credential.
- **Instagram / TikTok / multi-platform** — pass each `videoUrl` to a scheduler
  such as Blotato, Buffer or Metricool over their HTTP API; they take a public
  video URL directly, with no download step.
- **Human in the loop** — a Slack or Email node sending the clip list to whoever
  approves.

These stay out of the required path so the import runs with three credentials
and nothing else. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and
replace the render HTTP nodes with the native **Zvid** node + **Zvid Trigger**
(render webhook), which removes the poll loop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `"youtube.com" serves a watch PAGE, not a video file` | Expected. A YouTube/Vimeo/TikTok URL is a page, not a file. Export the video and host it somewhere that serves the MP4 directly. |
| `The transcription came back with 0 usable words` | Three usual causes: the `xi-api-key` credential is not attached to *Transcribe (Scribe)*; the URL returned HTML rather than media (a Google Drive file large enough to hit the virus-scan interstitial does this — use a smaller file or a direct CDN URL); or the MP4 could not be parsed from a truncated download (next row). |
| Transcription fails on a file that plays fine locally | The MP4 was written with its index (`moov` atom) at the **end** — some phone exports and screen recorders do this — so a `Range`-truncated download has no header to parse. Re-export with "fast start" / "web optimised", or raise `maxTranscribeMB` above the file size so the whole file is fetched. |
| Clips all come from the first few minutes | By design — only the downloaded window can be clipped. Raise `maxTranscribeMB`. |
| `No usable highlight survived` | The transcribed window held less than four seconds of speech per candidate range. Raise `maxTranscribeMB`, or try a stronger `llmModel`. |
| Summary says `pickedByModel: false` | The picker returned prose, invalid JSON or ranges that do not exist, so the transcript was split evenly instead. The run still produced clips. Try a different `llmModel`. |
| Faces or slides cropped out of frame | You are in `layout: "fill"`, which is a blind centre crop. Switch to `fit` (Config or per call) to keep the whole frame. |
| Captions collide with the platform UI | The caption block is bottom-anchored with a 380 px bottom margin, so extra lines grow upward and never enter the gesture zone. If you raised `captionSize` a long way, lower it or drop `captionWordsPerCue` to 2. |
| `Zvid rejected clip N` | The message lists the offending fields. If you edited the builder, note the API only allows letters, digits, spaces, `_` and `-` in `name`, rejects `audios[].track`, and caps the free plan at 5 video elements per project (`fit` already uses 2). |
| Credits went further than expected | `clipCount` renders are charged, not one. Two 28 s clips cost roughly double one. |
| The clip shows someone who never said the hook | The template paints your `handle` and a model-written hook over whatever footage you posted. On borrowed or stock footage that is a false attribution. Post your own recording, or demo with clips that have no identifiable faces, logos, wordmarks or legible signage in frame. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. A couple of webhook calls an hour never hit it; back-to-back manual test runs with `clipCount: 3` can. Nothing is charged for a rejected submit. |
| Render timed out | Long clips from a large source take longer than the 20-minute default. Raise `timeoutMinutes`. |

## Verified

n8n **2.29.10** node types and versions (every node resolves in a stock
install — core nodes only, no community package needed). Here is exactly what
was verified:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the
  render farm runs) **eight times**, one render per clip, from the builder's
  real output as it stands in this file — across five fixtures: a typical
  two-clip run in `fit` (27.3 s and 27.8 s), a stress run (37.3 s with a
  62-character hook forced down to 55 px and 33 caption cues, plus an 18.9 s
  clip whose 72-character hook is clamped by dropping whole words), a `fill`
  run for the full-bleed centre-crop branch (21.4 s and 26.0 s), a
  `captionAnimation: "highlight"` run (13.2 s, empty `handle`, 1280×720 source
  upscaled to 1080×1920), and a `showProgressBar: false` run (12.7 s).
  **The renders provably come from the builder as it stands here**: re-running
  the harness rewrites all eight payloads byte-for-byte identically to the ones
  sitting next to the MP4s, every MP4's filename and duration match its payload
  to the frame, and re-rendering two of them (the `fit` default clip 1 and the
  `fill` clip 1) reproduced the shipped files **byte-identically**, same MD5.
- **Every extracted frame was reviewed** — 370 frames at 2 fps across the eight
  clips, on contact sheets that cover every frame, plus 88 exact-timestamp
  grabs through the first 1.3 s, at the midpoint and on the final frame: no
  clipping, no overflow, no text touching an edge, contrast holding over a
  near-white haze, a bright blue sky, pink ink in water and dark rain-on-glass
  alike, no unresolved variables, no half-drawn animation states.
- **Measured at native resolution, not eyeballed.** On every frame of every
  clip: the progress bar advances monotonically from 0.0% and reads **100.0% on
  the last three frames of all six clips that draw it** (the frame a paused
  player and every cover-image picker hold on) — every frame of every clip
  measured, 5,538 in all, zero backward steps; the chip, hook, captions and
  handle sit inside a **97 px
  minimum side margin** with nothing touching an edge, and there is zero white
  or accent ink in the top 10–180 px or in the bottom 220 px gesture zone on any
  frame. `freezedetect` (`n=0.0015:d=1.0`) finds nothing at all in five clips;
  the near-static rain-on-glass stress source and the first second of the `fill`
  fixture report runs of **1.0–1.5 s** in which only a caption word changes —
  source stillness, not a stalled render, and nothing close to a dead shot.
- **Every distinct payload shape validated** — `fit` with the bar, `fill` with
  the bar, `fill` with the bar and box captions, and `fit` with the bar switched
  off — through the same `zvid-schema` validator the API and the MCP tooling
  wrap. All **eight** payloads: `valid: true`, **0 errors, 0 layout warnings**,
  schema **1.0.0**, quoted at **28 / 22 / 14 / 13** credits for the
  27.29 s / 21.43 s / 13.23 s / 12.70 s clips, reproduced against the render
  API's own cost function. *Honest limit:* the live `POST
  /api/render/validate/api-key` round-trip was **not** repeated in this pass —
  the MCP validator was unreachable — so these are the offline validator's
  numbers, not a fresh answer from `api.zvid.io`.
- **Every source-URL branch of *Video request* exercised** by running the node's
  real source against nine inputs: manual (flat) and webhook (`body`-wrapped)
  entry, both Google Drive share shapes rewritten to
  `uc?export=download&id=…`, a Dropbox `?dl=1` link passed through, YouTube and
  Vimeo rejected with the documented watch-page message, `http://` rejected,
  and a missing `videoUrl` rejected with the expected-body message. Separately,
  the clip-level `layout` override beating the Config default is exercised in
  **both** directions by rendered fixtures (stress: Config `fill` → request
  `fit`; fill-demo: Config `fit` → request `fill`).
- **Every URL probed** — the four fixture sources and the shipped sample video
  (HTTP 200, `video/mp4`; the sample is 4.37 MB, so the default `Range` cap
  never truncates it).
- **The demo footage follows the rule this page gives you.** All four fixture
  sources are landscape, coastline, ink-in-water and rain-on-glass plates with
  **no identifiable face, no logo, no wordmark and no legible signage** in any
  of the 458 reviewed frames, and the handles on them are invented demo
  handles. Nothing rendered here attaches a hook, a handle or a transcript to a
  real person or a real brand.
- **The embedded code node is byte-identical** to the frame-reviewed standalone
  builder (asserted programmatically by re-reading the written workflow and
  string-comparing, not by eye), and all eleven code nodes were compiled and the
  render chain simulated against mocked n8n globals to produce the exact
  reviewed payloads — including a poll lap where one clip is still rendering,
  to prove the webhook cannot answer with a partial clip list.
- **Structural checks** on the workflow JSON: parseable, all connections
  resolve, unique names and ids, core-only node types, no credentials block,
  Zvid and ElevenLabs calls on Header Auth, OpenRouter on its own credential
  type, `▶ Watch video` rightmost and in file mode.

**Not executed:** the ElevenLabs Scribe call and the OpenRouter call were not
made live — the fixtures carry a synthetic Scribe-shaped word stream and a
synthetic picker response, so caption *sync against real Scribe output* is not
yet proven (the parse is written defensively around `words[]` for exactly that
reason). The shipped *Sample video* source has not itself been rendered end to
end; it was only probed. The title size ramp was rendered at 78, 62 and 55 px;
no fixture happens to land on the 70 px or 49 px step, so those two rungs are
reasoned from the code rather than seen. Nothing in the publish/delivery tail
was exercised either; those nodes are documented, not shipped.
