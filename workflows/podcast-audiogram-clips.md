# Podcast episode to captioned audiogram clips

[`zvid-podcast-audiogram-clips.json`](zvid-podcast-audiogram-clips.json)

Every morning: read your podcast feed, download the opening of the newest
episode, transcribe it word by word, ask a model which moments are worth
clipping, and render each one as a 1080×1920 audiogram with karaoke captions
that ride the real speech timings. One run produces **one video per clip** —
two by default — and each one lands in n8n as a playable file.

```
Schedule ─▶ Config ─▶ Read podcast feed ─▶ Pick latest episode
        ─▶ Fetch episode audio (Range) ─▶ Transcribe (Scribe) ─▶ Pick moments
        ─▶ Prepare clips ─▶ Build project ─▶ Validate (free) ─▶ Render ×N
        ─▶ ▶ Watch video
```

## Why this one is different

**The captions cannot drift from the sound.** Most clip tools transcribe one
copy of the audio and then cut a *different* copy — a second download, or a
byte-offset guess. Podcast hosts with dynamic ad insertion hand out different
bytes on every request, so those timings slide. This workflow downloads the
audio **once**: Scribe times those exact bytes, *Read transcript* re-attaches
the same binary, *Upload episode audio* puts those exact bytes on the Zvid CDN,
and every clip is an `audioBegin`/`audioEnd` window **inside that one asset**.
Two or three clips therefore cost exactly one download, one transcription and
one upload.

**The model suggests; the code decides.** *Pick moments* returns word indices
and nothing else. *Prepare clips* clamps every index into the transcribed
window, re-cuts each window to `clipSeconds`, snaps to sentence boundaries,
drops overlaps, and falls back to evenly spaced windows if the model returns
nothing usable — so a bad LLM response degrades the pick, never the run. The
node is also `alwaysOutputData` + `continueRegularOutput`, so an OpenRouter
hiccup still produces clips.

**The cover art is the whole art direction.** The episode's own artwork is used
twice — blurred and dimmed as the backdrop, and sharp inside a rounded card
with an accent ring — so every show carries its own colour without a stock-photo
lottery. Both copies go through the browser rather than an image element,
because podcast feeds routinely hand out artwork URLs with no file extension
and percent signs in the path (`…/format/jpg/?url=http%3A%2F%2F…`), which
ffmpeg's image demuxer reads as a numbered sequence and fails on. That exact
URL shape is one of the rendered test fixtures.

**Type and chips resize instead of clipping.** The hook steps 72 → 44 px until
it fits three lines in a fixed band; the show pill is sized against the exact
pixel budget the episode pill leaves it and truncates with an ellipsis only
when the smallest step still overflows; the footer splits onto two lines when
the handle and the listen line will not sit side by side. All three branches
were rendered and reviewed frame by frame.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| ElevenLabs API key | For Scribe speech-to-text (`POST /v1/speech-to-text`). Billed by ElevenLabs, not Zvid. |
| OpenRouter API key | For the one moment-picking call. Pennies per run on the default model. |
| A podcast RSS feed | Any public feed whose items carry an audio `<enclosure>`. |

No Google account, no stock-media account, no sheet.

## Setup

1. **Import** `zvid-podcast-audiogram-clips.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Upload episode audio*, *Validate project
   (free)*, *Save draft to editor*, *Submit render* and *Get render status*.
3. **ElevenLabs credential** — add a second **Header Auth** credential, name
   `xi-api-key`, value = your ElevenLabs key. Attach it to *Transcribe (Scribe)*.
4. **OpenRouter credential** — add an **OpenRouter** credential and attach it to
   *Pick moments*.
5. **Open `Config`** — set `feedUrl` to your show's RSS feed, `showNameOverride`
   to the name you want on screen, and `handle` to your social handle. The
   shipped default feed is NPR's *Planet Money*, so the template runs untouched.
6. **Run it.** The workflow renders for real out of the box, so **the first run
   spends credits — about 60** for the default two 30-second clips. When it
   finishes, click **`▶ Watch video`**: n8n shows one inline player per clip.

   Prefer to preview for free first? Set `dryRun: true` in `Config` before that
   first run: every clip is validated and saved as a draft, and the run reports
   `creditsRequiredThisRun` plus an **`editorLink`** per clip
   (`https://editor.zvid.io/?project=…`), with nothing spent.
7. **Activate.** It cuts clips from the newest episode every day at 7am.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base. |
| `editorUrl` | `https://editor.zvid.io` | Used to build the dry-run `editorLink`. |
| `feedUrl` | `https://feeds.npr.org/510289/podcast.xml` | Your show's RSS feed — the feed URL, not the show page. |
| `clipCount` | `2` | Clips per run, 1–3. Each clip is its own render. |
| `clipSeconds` | `30` | Target clip length. Credits scale with it. |
| `minClipSeconds` | `18` | A picked moment shorter than this is extended, not shipped short. |
| `skipIntroSeconds` | `0` | Ignore the first N seconds (cold open, sponsor read) when picking. |
| `clipWindowSeconds` | `300` | How far into the uploaded audio a clip may start. The API caps `audioBegin`/`audioEnd` at your plan's maximum video length — 300 s on the free plan — and rejects anything past it. |
| `maxTranscribeMB` | `12` | Size of the `Range` request against the episode file. |
| `sttModel` | `scribe_v1` | ElevenLabs speech-to-text model id. |
| `llmModel` | `openai/gpt-4.1-mini` | OpenRouter model for *Pick moments*. |
| `showNameOverride` | `""` | Overrides the show name from the feed. Empty = use the feed's. |
| `coverImageOverride` | `""` | Overrides the episode/show artwork. Empty = use the feed's. |
| `handle` | `@yourshow` | Watermark handle in the footer. |
| `listenLine` | `Full episode in the show notes` | Second footer line. Empty = handle only. |
| `hookFont` / `uiFont` / `captionFont` | `DM Serif Display` / `Space Grotesk` / `Inter` | Serif carries the hook; sans carries chips, clock and footer; the caption font is separate. |
| `inkColor` / `panelColor` | `#0B0A12` / `#17141F` | Near-black canvas and scene panel. |
| `textColor` / `mutedColor` | `#F2EFFA` / `#8E88A6` | Primary and secondary text. |
| `brandAccent` | `#2DD4BF` | Equalizer bars, rings, progress bar, active caption word. |
| `captionAnimation` | `karaoke` | `karaoke` recolours the spoken word; `highlight` puts it in an accent chip. |
| `captionSize` | `62` | Caption font size, clamped 24–96. |
| `captionWordsPerCue` | `4` | Words per cue, clamped 1–8. Also the max words per caption line. |
| `captionStrokeWidth` | `6` | Caption outline. Automatically clamped to 2 in `highlight` mode, where the chip does the work. |
| `frameRate` | `30` | Output frame rate. |
| `dryRun` | `false` | `false` (default) renders for real. `true` validates, quotes the credits and saves a draft per clip without spending anything. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost per video

The live validator quoted **30 credits** for the default 30-second clip, so a
default run (`clipCount: 2`) is about **60 credits**. Length is what costs, so
`clipSeconds` and `clipCount` are the two knobs that move the bill. Three
quotes measured against the live validator:

| Clip | Quoted |
| --- | --- |
| 20.16 s | **21 credits** |
| 30 s (default) | **30 credits** |
| 45 s | **45 credits** |

So the cheapest run this template allows (`clipCount: 1` at ~20 s) is about
**21**, the default is about **60**, and the most expensive (`clipCount: 3` at
`clipSeconds: 45`) is about **135**.

*Validate project (free)* runs before every render and returns the exact quote
per clip; the run summary reports it as `creditsCharged`, and the dry-run
summary adds `creditsRequiredThisRun` across all clips. ElevenLabs Scribe and
OpenRouter bill separately, per their own pricing.

## How it works

| Node | What it does |
| --- | --- |
| **Read podcast feed** | Reads `feedUrl` with the core RSS node — one item per episode. |
| **Pick latest episode** | Sorts by date (feed order is not guaranteed) and keeps the newest entry that actually carries a playable audio enclosure, probing `media:content` and `<link>` before giving up. Also resolves the artwork and the episode chip. |
| **Fetch episode audio** | Downloads only the first `maxTranscribeMB` with an HTTP **Range** request (`bytes=0-12582911` at the default). MP3/AAC decode fine from a truncated head — measured below — so the download, the transcription bill and the run time all stay small. |
| **Transcribe (Scribe)** | ElevenLabs `POST /v1/speech-to-text`, `model_id` from Config, `timestamps_granularity=word`, the audio posted as multipart binary. |
| **Read transcript** | Builds the word list every later node reads plus the numbered transcript the model picks from — and re-attaches the same binary so the next node uploads the exact transcribed bytes. Missing `words[]` fails loudly with the response body, because that is what a quota or key problem looks like. |
| **Upload episode audio** | Puts those bytes on the Zvid CDN once. Every clip seeks inside that one asset. |
| **Pick moments** | One OpenRouter call: given the numbered transcript, return `clipCount` self-contained moments as `{startWord, endWord, hook, whyItSlaps}`. Never fails the run — it retries, then continues with whatever it has. |
| **Prepare clips** | Clamps every index into the transcribed window, re-cuts each window to `clipSeconds`, snaps to sentence boundaries, drops overlaps, and falls back to evenly spaced windows. Emits **one item per clip**. |
| **Build project JSON** | The whole design lives here: blurred-artwork backdrop, cover card, chip row, 25-bar equalizer, hook type ramp, player clock, progress bar, footer, and the caption cues built from the real word timings. Also HTML-escapes every piece of feed or model text and enforces the API's `name` character rules. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — without spending credits, once per clip. |
| **Check validation** | Turns a rejection into a per-clip field list instead of a generic HTTP error, and carries `payload`, `creditsRequired` and `meta` forward. |
| **Dry run?** | Routes on `Config.dryRun`. It is `false` by default, so the normal path is straight to *Submit render*. |
| **Save draft to editor** / **Dry run summary** | **Only when `dryRun: true`.** Saves a free draft per clip and reports the quoted credits plus an `editorLink` for each. Best-effort: a hiccup saving the draft never hides the report. |
| **Submit render → Attach job to clip → Wait → Get render status → Merge job status → Render finished?** | The multi-job poll loop: one render per clip, jobs re-attached to their clip by index, finished clips move forward while the rest keep polling. |
| **Still rendering?** | Fails fast when a job reports `failed` (naming the clip and its hook) and stops the loop at `timeoutMinutes`. |
| **Run summary** | One item per finished clip: `videoUrl`, `hook`, `whyItSlaps`, `startsAt`, `clipSeconds`, `creditsCharged`. |
| **▶ Watch video** | Downloads each finished MP4 as binary so n8n plays it inline — one player per clip, each with a download button. Never fails the run: it retries a few times (the CDN can 404 for a moment right after a render completes) and then continues regardless. |

## Publishing (optional tail)

The run ends with one item per clip carrying `videoUrl`, `hook` and
`whyItSlaps` — a clean handoff you can extend after *Run summary*:

- **YouTube Shorts** — the native **YouTube** node (Video → Upload) takes the
  binary *▶ Watch video* already downloads. Needs YouTube OAuth2.
- **Instagram / TikTok / multi-platform** — pass `videoUrl` to a scheduler such
  as Blotato, Buffer or Metricool over their HTTP API; they take a public video
  URL directly.
- **Human in the loop** — a Slack or Email node sending `hook` + `videoUrl` to
  whoever posts, so a person still approves the pull quote.

These stay out of the required path so the import runs with three credentials
and nothing else. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and
replace the render HTTP nodes with the native **Zvid** node + **Zvid Trigger**
(render webhook), which removes the poll loop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Every clip comes from the first few minutes | By design. *Fetch episode audio* only downloads `maxTranscribeMB` (12 MiB — measured at 13 min 6 s of a real 128 kbps episode, ~26 min at 64 kbps), and the render API can only seek `clipWindowSeconds` into an audio asset — 300 s on the free plan. The effective window is the smaller of the two, so in practice the first 5 minutes. Raise both together if your plan allows, or set `skipIntroSeconds` to step past a cold open. |
| `audioBegin … must be less than or equal to 300` | You raised `clipWindowSeconds` past your plan's maximum video length. That number is the hard ceiling on how far into an audio asset a render may seek; the free plan's is 300 s. |
| `The feed … returned no items` | `feedUrl` points at the show page, not the RSS feed. Podcast directories usually link the feed under "RSS". |
| `No episode in the feed carries a downloadable audio enclosure` | The feed publishes players rather than files (some private/paid feeds do). Use the feed your host generates for podcast apps. |
| `ElevenLabs Scribe returned no word timings` | The `xi-api-key` credential is missing/wrong, or the speech-to-text quota is spent — the message includes the response body. Scribe also enforces its own upload size limit, so lower `maxTranscribeMB` if it rejects the file. |
| `No cover art` | The feed carried no episode or show image. Put an image URL in `coverImageOverride`. |
| Cover art is missing or the render fails on the image | Artwork URLs with no file extension are handled, but the URL still has to be publicly reachable — open it in a private tab. `coverImageOverride` wins over the feed. |
| Clips are shorter than `clipSeconds` | The transcribed window ran out. The last clip is clamped to what is actually there rather than padded with silence. |
| The model picked odd moments | It only suggests; *Prepare clips* fixes indices and boundaries. Nudge it with `llmModel`, `clipSeconds` and `skipIntroSeconds`. |
| One run cost more than expected | Each clip is its own render, and credits track clip length. `clipCount: 3` at `clipSeconds: 45` quotes about 135 against the default run's 60 — set `dryRun: true` once to see the exact quote before committing. |
| Render failed and nothing was written | Intentional — nothing is persisted anywhere, so the next run simply retries the same episode. The error carries the job's `failedReason` and the clip's hook. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. Note this template submits `clipCount` renders per run, so it reaches the limit faster than a one-video template. Nothing is charged for a rejected submit. |

## Verified

Node types and versions are the same core set the rest of this template series
already ships — `scheduleTrigger` 1.2, `manualTrigger` 1, `set` 3.4, `code` 2,
`httpRequest` 4.2, `if` 2.2, `wait` 1.1, `stickyNote` 1, plus core
`rssFeedRead` 1.1 — every one of them checked to also appear, at the same
typeVersion, in the already-shipped workflows in this folder. Here is exactly
what was verified:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the
  render farm runs) from the builder's real output, six clips across three
  fixtures: the default 2-clip run (2 × 30 s, karaoke captions, one-line
  footer), a stress run (3 clips — 45 s, 45 s, 23.5 s — with a 60-character
  show name that truncates both chips, a 46-character handle that splits the
  footer onto two lines, 130 caption words, and a podcast-CDN artwork URL with
  no file extension and percent-encoded query), and an edge run (a 20.16 s
  clip, an 8-word/76-character hook that steps the type ramp down to 64 px on
  three lines, `captionAnimation: highlight`, handle-only footer, an
  episode whose feed declared no duration, and the fallback moment picker
  standing in for an unusable model response). **All 387 extracted frames were
  reviewed** at 2 fps — 60 + 60 default, 90 + 90 + 47 stress, 40 edge — plus
  full-resolution grabs at the widest caption line, the clip midpoint and the
  final frame of each fixture: no clipping, no overflow, no text touching an
  edge, no unsubstituted variables, no `undefined`/`NaN`, no collisions, no
  half-rendered animation states.
- **Both caption modes were checked in the rendered pixels, not just the
  payload.** `karaoke` recolours exactly one word per frame and never
  double-exposes across a cue change; `highlight` paints its accent chip
  (corner radius 12, padding 8) tight around the active word with the outline
  clamped to 2, and the chip renders on every one of the 40 edge frames.
  Inspected at 3× on a native-resolution grab, the chip clears the preceding
  word by roughly 8–10 px: the padding doubles as the chip's horizontal bleed,
  so the value is deliberately small here rather than the wider padding that
  suits box captions with nothing beside them.
- **The equalizer loop is seamless by construction and by inspection.** Its
  five per-bar durations (0.6 / 0.8 / 1.2 / 2.4 s) all divide the declared
  `animationDuration` of 2.4 s, and no discontinuity appears at any loop
  boundary across the 387 frames. The progress hairline is an `enterAnimation:
  wiperight` spanning the full clip, so it reads 0 % at the first frame, ~50 %
  at the midpoint and 100 % at the last — confirmed at full resolution on the
  45 s fixture.
- **All six clips were re-rendered from the current builder output** on the
  production CLI as a final check, and each came out at exactly its declared
  length (30.000 / 30.000 / 45.000 / 45.000 / 23.500 / 20.167 s). Compared
  frame-for-frame against the earlier reviewed renders they score **PSNR 50.7 –
  54.3 dB average, 47.9 dB worst single frame** — visually identical, so the
  frame review above describes the pixels the current builder actually
  produces. The builder is deterministic: re-running it twice produced
  byte-identical payloads for all six clips.
- **The smallest type in the design was re-read at native 1080×1920
  resolution** (not downscaled): the 18 px show/episode chips in their
  truncated state, the 23 px player clock, and the 24/28 px two-line footer
  carrying a 46-character handle. At 1:1 and at 2× the ellipsis glyph, the
  1.5 px pill hairline and the letter-spacing are all clean, the two chips
  never collide, and nothing approaches a canvas edge.
- **Caption line width was measured, not eyeballed.** Scanning every frame of
  all six clips for caption ink, the widest line in the entire set spans
  x = 105 … 975 on the 1080 canvas — **105 px of clear margin against the 90 px
  the payload asks for**. Every other clip keeps at least 169 px. There is
  headroom, but it is the tightest case the default design allows: if you raise
  `captionSize` above 62, lower `captionWordsPerCue` to match.
- **Remote validation against the live API** (`POST
  /api/render/validate/api-key` via MCP with `remote: true`) on all three
  distinct payload shapes, every one `valid: true` with **0 errors and 0
  warnings**, schema **1.0.0**: the 30 s karaoke default clip —
  `creditsRequired: 30`; the 45 s karaoke stress clip with truncated chips and
  two-line footer — `creditsRequired: 45`; the 20.16 s `highlight` box-caption
  clip — `creditsRequired: 21`.
- **The `clipWindowSeconds` ceiling is measured, not assumed.** A probe payload
  seeking to `audioBegin: 310` was rejected by the live validator with
  `"audios[0].audioBegin" must be less than or equal to 300`; the same payload
  at `audioBegin: 300` raised no audio error. So the 300 s figure in `Config`
  is the real boundary, and it is inclusive.
- **The `Range` fetch and the truncated-head claim are measured against a real
  podcast host.** Requesting `bytes=0-12582911` on an episode from the shipped
  default feed followed four redirects and returned **HTTP 206 Partial
  Content**, `Content-Range: bytes 0-12582911/37368135` — exactly the 12 MiB
  the workflow asks for out of a 37 MB file. That truncated head probes as a
  valid 128 kbps 44.1 kHz stereo MP3 and **decodes end to end without error to
  786.4 s (13 min 6 s)**, which is where the 13-minute figure in the
  troubleshooting table comes from. (This was measured directly against the
  host, not through the n8n node.)
- **Every URL these files introduce was re-checked.** The default `feedUrl`
  returns **HTTP 200**, `content-type: application/xml`, 2,111,947 bytes of
  valid RSS (`<title>Planet Money</title>`) carrying channel- and item-level
  `itunes:image` and `<enclosure type="audio/mpeg">` — the three things this
  workflow needs from a feed. The artwork URL used in the stress fixture is the
  real item-level `itunes:image` this feed serves and returns **200,
  `image/jpg`, 336,600 bytes** despite having no file extension and a
  percent-encoded query. The fixture stand-in media return **200 `image/jpeg`
  106,710 bytes** and **200 `audio/mpeg` 3,722,344 bytes**. The feed URL is the
  only one of these the shipped workflow contains; the rest are scratch
  fixtures.
- **The embedded code node is byte-identical** to the frame-reviewed standalone
  builder (asserted programmatically, not by eye), and a simulated execution of
  the node's JS against mocked n8n globals produced the exact reviewed payloads.
- **Structural checks** on the shipped workflow JSON, re-run from scratch: 32
  nodes, parseable, every connection resolves to a real node, all **10** code
  nodes compile, unique names and ids, core-only node types, both triggers
  feeding `Config`, six sticky notes, no `credentials` blocks anywhere, every
  Zvid call on Header Auth, and `▶ Watch video` holding its exact contract
  (`responseFormat: file`, `outputPropertyName: data`, 3 retries at 5 s,
  `alwaysOutputData`, `onError: continueRegularOutput`) as the rightmost node.
- **Every key in the `Config` node appears in the Configuration table above and
  vice versa** — 31 keys, checked in both directions programmatically.

**Not executed.** Being precise about where verification stops:

- **The workflow has not been run inside n8n.** Node types and versions were
  checked against the already-shipped templates in this folder, which is not
  the same as an execution.
- **Three network legs are still stood in for by fixture data:** the
  ElevenLabs Scribe transcription, the OpenRouter *Pick moments* call, and the
  `POST /api/uploads` CDN upload. Their request shapes are copied from proven
  templates and the code around them is defensive (an unusable model response
  falls back to evenly spaced windows, a missing `words[]` fails loudly), but
  none of the three has been called. The upload response shape the builder
  reads — `201 { upload: { url, … } }` — was checked against the Zvid API's own
  route rather than guessed, but no file has actually been uploaded by this
  workflow. Scribe's response shape and its own upload size limit are taken
  from its documentation, not observed. Only the `Range` fetch has been
  exercised against a real host, and that was with `curl`, not through the n8n
  node.
- **Caption sync is proven for layout, not for alignment.** Every cue in every
  fixture rides *synthetic* word timings over an unrelated stand-in mp3, so the
  frames prove the cues are well-formed, land inside the clip and render
  correctly — they cannot prove the words match the speech. Only a run against
  real Scribe output can show that, which also means the "captions cannot
  drift" argument above is a claim about how the workflow is wired (one
  download, transcribed and uploaded as the same bytes — verified by
  inspection) rather than a measured result.
- **Two caption animations of the several the schema accepts were rendered** —
  `karaoke` (the default) and `highlight`. The `highlight` chip geometry was
  checked at one font and size (Inter, 62 px, 4 words per cue); an unusual
  `captionFont` or a much larger `captionSize` has not been rendered.
- **Nothing in the publish/delivery tail** — no social platform, no email
  provider. Those nodes are suggestions in prose, not part of the workflow.
