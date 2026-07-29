# Faceless YouTube Shorts on autopilot

[`zvid-faceless-shorts-autopilot.json`](zvid-faceless-shorts-autopilot.json)

Every morning: pick a topic the channel has not covered yet, write a short script,
voice it, find matching stock footage, render a captioned 1080×1920 video with
Zvid, and upload it to YouTube. No filming, no editing, no manual step.

```
Schedule ─▶ Config ─▶ Write script ─▶ Stock footage (per scene) ─▶ Music
        ─▶ Voiceover + word timings ─▶ Upload ─▶ Build project ─▶ Validate (free)
        ─▶ Render ─▶ Download ─▶ YouTube
```

## Why this one is different

Most "faceless video" automations glue a text-to-speech clip onto stock footage and
hope the timing lands. Four details here fix the things that make those outputs look
automated:

**The captions cannot drift.** Plain text-to-speech returns audio and nothing else —
no idea when each word is spoken — so most workflows estimate from an average
words-per-second and fall progressively further behind as the video plays. This uses
ElevenLabs' [`/with-timestamps`](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps)
endpoint, which returns the audio **and** a character-level alignment in one call.
The timings come from the synthesiser itself, so there is no second source of truth
that can disagree with the audio.

**Cuts land on sentence boundaries.** Those same word timings decide where each scene
ends: scene one runs until its own sentence finishes, not until an estimated average
elapses.

**Transitions do not desync the audio.** A cross-fade *overlaps* the two scenes it
joins, which drags every later cut earlier. Each scene is padded by the overlap
length, so the visible cut stays on its narration timestamp no matter how many
transitions there are.

**A music bed can never fail the render.** Renders reject any asset over the plan's
audio size cap, and the music catalogue happily returns 6 MB tracks and the occasional
`503`. Either one used to kill the whole job. Candidates are now ranked shortest-first
and `HEAD`-checked for reachability and size before use; if none survive, the video
renders without music.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| ElevenLabs API key | Voice **and** word timings, in one call. Free tier is ~10k characters/month ≈ 25 videos. The key only needs **text-to-speech** permission. |
| OpenRouter API key | Writes the script. Any OpenAI-compatible chat endpoint works — swap the URL and credential type. |
| YouTube OAuth2 | Optional — only for the publishing step. |

No stock-media accounts to set up. Footage, photos and music come from Zvid's stock
library via `/api/stock/search`, which runs on server-side keys and needs no
authentication of its own.

## Setup

1. **Import** `zvid-faceless-shorts-autopilot.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Upload voiceover*, *Save draft to editor*,
   *Validate project (free)*, *Submit render* and *Get render status*.
3. **ElevenLabs credential** — add a **second Header Auth** credential, name
   `xi-api-key`, value = your ElevenLabs key. Attach it to *Generate voiceover*.
   (n8n has no built-in ElevenLabs credential; Header Auth is the supported way and
   works on n8n Cloud.)
4. **OpenRouter credential** — attach it to *Write script*.
5. **Open `Channel Config`** and set `niche`, `audience`, `channelHandle`, `voiceId`
   and your brand colours. Everything else has a working default.
6. **Run once with `dryRun: true`** (the default). No credits are charged. You get the
   scene breakdown, the exact credit cost, and an **`editorLink`** that opens the draft
   in the Zvid editor so you can watch it back before spending anything.
7. Set `dryRun: false` to render for real, then `uploadToYouTube: true` once the output
   looks right.

The workflow has both a **Test manually** trigger and a daily schedule, so you can try
it before activating it.

## Configuration

Everything lives in the `Channel Config` node — no expressions to hunt through.

| Key | Default | Notes |
| --- | --- | --- |
| `niche` | `surprising space facts` | Drives topic selection. |
| `audience` | `curious people scrolling YouTube Shorts` | Steers tone. |
| `channelHandle` | `@dailyspacefacts` | Watermark + outro. |
| `sceneCount` | `5` | One b-roll clip per scene. **Free plans allow 5 video elements**; raise this on a paid plan. |
| `targetSeconds` | `30` | Target narration length. Treat it as an upper guide — small models write short (see below). |
| `llmModel` | `openai/gpt-4.1-mini` | OpenRouter model id. |
| `voiceId` / `voiceLabel` | `nPczCjzI2devNBz1zQrb` / `Brian (deep narrator)` | ElevenLabs voice id. `voiceLabel` is a comment for humans — only the id is sent. See the voice note below. |
| `elevenModel` | `eleven_multilingual_v2` | Any ElevenLabs model that supports timestamps. |
| `voiceStability` / `voiceSimilarity` | `0.4` / `0.75` | ElevenLabs voice settings. Lower stability = more expressive. |
| `brandBackground` / `brandAccent` | `#0b0d12` / `#7CFFB2` | The accent colours the word being spoken. |
| `captionAnimation` | `karaoke` | Also `fill`, `pop`, `bounce`, `typewriter`, `one-word`, `highlight`, … (see the caption note below). |
| `captionWordsPerCue` | `3` | Words on screen at once. |
| `captionStrokeWidth` | `6` | Black outline. This is what keeps captions readable over any footage. |
| `captionActiveColor` | `#0b0d12` | Only used by box modes (`highlight`) — the text colour inside the accent chip. |
| `captionSize` | `64` | |
| `sceneTransition` / `transitionSeconds` | `fade` / `0.35` | Set `sceneTransition` to `null` for hard cuts. |
| `kenBurnsDepth` | `1.12` | Slow push on every clip. |
| `outroSeconds` / `outroText` | `2.5` / `Follow for more` | Set `outroSeconds` to `0` to drop the outro. |
| `musicVolume` | `0.12` | Music sits under the narration. |
| `maxMusicSeconds` / `maxMusicBytes` | `200` / `5242880` | Guards against a music track that would blow the plan's audio size cap and fail the render. |
| `dryRun` | `true` | Validate, quote and save a draft without spending credits. |
| `uploadToYouTube` / `youTubePrivacy` | `false` / `private` | |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

### Choosing a voice

The voice is addressed by **id**, not by name. Listing voices needs the extra
`voices_read` permission on your API key, and text-to-speech does not — addressing the
id directly keeps the key's permissions minimal and removes a request.

**On the free tier you can only use default voices, not Voice Library voices** — the
API answers a library voice with `402 paid_plan_required`. These default ids are
confirmed working on a free account:

| Voice | `voiceId` |
| --- | --- |
| Brian (deep narrator, the default) | `nPczCjzI2devNBz1zQrb` |
| George (warm narrator) | `JBFqnCBsd6RMkjVDRZzb` |
| Roger | `CwhRBWXzGAHq8TQ4Fs17` |
| Sarah | `EXAVITQu4vr4xnSDxMaL` |
| Bill | `pqHfZKP75CvOlQylNhV4` |

Rachel and Aria are Voice Library voices and are **rejected on free plans**. For any
other voice, copy its id from the ElevenLabs dashboard.

### A note on caption modes

The default is **`karaoke`**: white words with a heavy black outline, and the word
being spoken turns your accent colour. It stays legible over dark *and* bright
footage, which matters when the b-roll is chosen automatically and you cannot predict
what it looks like.

Box modes (`highlight`) draw a coloured chip behind the spoken word. The subtitle
engine strokes the glyphs **on top of** that chip, so a heavy outline with no box
padding turns the chip into a black blob and the word becomes unreadable. The build
step handles this for you: pick `highlight` and it automatically thins the stroke to
2 px and adds box padding. Do not hand-edit `stroke.width` up in a box mode.

### Two things to know about the writer

**Small models write short.** The prompt asks for a total word count *and* a per-scene
budget, which gets `gpt-4.1-mini` to roughly 60–70 words against a 75-word target for
`targetSeconds: 30` — a 25–28 second video rather than 30. A stronger model tracks the
target more closely. Nothing breaks either way: the video simply matches however long
the narration turned out. `Parse script` hard-fails below 60% of target so a one-line
script can never reach a paid render.

**Fact-check a factual niche.** The prompt requires verifiable, well-established
claims, but a model can still be confidently wrong. If your channel makes factual
claims, either run a stronger model or add a verification step before *Generate
voiceover* — a second LLM call that checks each sentence, or a human approval node.

## Cost per video

A ~30 second 1080×1920 render is **about 28–32 Zvid credits** (the dry run prints the
exact number before you spend anything). The script costs well under a cent. The voice
uses ~400 ElevenLabs characters, so the free tier covers roughly 25 videos a month.

## How it works

| Node | What it does |
| --- | --- |
| **Recent topics** | Reads the last 40 topics from workflow static data and injects them into the writer prompt as a do-not-repeat list. Static data only persists on *production* executions, so manual test runs always start empty. |
| **Write script** | One JSON-mode call returning topic, title, description, tags, a music tag and one narration sentence + stock-search hint per scene. |
| **Parse script** | Validates the JSON, normalises smart quotes to ASCII, coerces the music tag onto a list known to return results, and joins the sentences into the exact string the voice will speak. |
| **Search stock clips** | Runs once per scene against Zvid's stock library. |
| **Pick scene clip** | Scores portrait footage highest (the canvas is 1080×1920 — landscape still works through `resize: "cover"`, it is just cropped harder), preferring clips long enough to cover the scene. |
| **Music queries** | Asks for the writer's music tag plus two broad fallbacks, because the catalogue intermittently returns nothing for a tag that worked a minute earlier. |
| **Shortlist music / Check music asset / Pick music** | Ranks candidates shortest-first, then `HEAD`s each and keeps the first that is reachable and within the size cap. |
| **Generate voiceover** | ElevenLabs `/with-timestamps` → base64 mp3 **plus** character-level alignment. |
| **Voice + timings** | Decodes the audio into a named binary and groups the character alignment into word timings. |
| **Upload voiceover** | Uploads the mp3 to Zvid and gets back a CDN URL for the project's audio track. |
| **Build project JSON** | Assembles scenes, Ken Burns zoom, transitions, word-timed captions, music bed, watermark and outro. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — template resolution, plan limits, full project schema — without spending credits. Failures surface as a field list, not a generic HTTP error. |
| **Save draft to editor** | Dry-run branch only. Saves the project as a draft (free) and returns `editorLink`, so you can watch the video back at [editor.zvid.io](https://editor.zvid.io) and hand-tweak it before spending credits. |
| **Still rendering?** | Fails fast on a failed render and stops the poll loop at `timeoutMinutes`. |

## Swapping pieces

- **Other platforms** — replace the YouTube node with TikTok, Instagram, Google Drive
  or an upload of your own. Everything before it is unchanged.
- **Other LLMs** — *Write script* is a plain OpenAI-compatible chat call. Point it at
  OpenAI, Groq, Together or anything else with a JSON-mode chat endpoint; change the
  URL, the credential type and the model id.
- **Other voices** — any TTS works, but if it does not return timings you must add a
  transcription step (e.g. `whisper-1` with `response_format=verbose_json` and
  `timestamp_granularities[]=word`) and feed its word list into *Build project JSON*.
  That is a strictly worse design: two calls instead of one, and a second source of
  truth that can disagree with the audio.
- **Skip the polling loop** — on self-hosted n8n, install
  [`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and
  replace *Submit render* + *Wait* + *Get render status* with a **Zvid** node and a
  **Zvid Trigger** (render webhook). The HTTP nodes are deliberately core-only so the
  workflow also runs on n8n Cloud with nothing installed.

| HTTP Request node | Native replacement |
| --- | --- |
| Validate project (free) | **Zvid** → Render → Validate |
| Submit render | **Zvid** → Render → Create |
| Get render status + Wait | **Zvid Trigger** (render webhook) |

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `The model did not return JSON` | The model ignored JSON mode. Use one that supports `response_format: json_object`. |
| `The script is only N words` | The writer returned less than 60% of the target. Retry, or use a stronger model. Raising `targetSeconds` does not help — the model was already under budget. |
| `ElevenLabs returned no audio` | Bad or missing `xi-api-key` credential, an unknown `voiceId`, or your monthly character quota is spent. |
| `402 paid_plan_required` | The `voiceId` is a Voice Library voice and your plan is free. Use one of the default ids listed above. |
| `401 missing the permission …` | Your ElevenLabs key is scoped. It needs text-to-speech; nothing else is required. |
| `ElevenLabs returned audio but no alignment` | The URL lost its `/with-timestamps` suffix. Plain `/text-to-speech/{id}` returns audio only, and the captions have nothing to ride on. |
| `No stock footage matched any scene` | The `visualQuery` hints are too abstract. The prompt asks for concrete filmable nouns; a narrower `niche` helps. |
| `Zvid rejected the project` | The message lists the offending fields. Most often a plan limit — free plans cap video elements at 5. |
| `Render failed: Asset too large` | A media asset exceeded a plan limit. Music is size-guarded already; if this names a video clip, lower `sceneCount` or upgrade the plan. |
| No music | The catalogue is tag-matched and intermittently empty. The workflow tries three tags and `HEAD`-checks each candidate; if nothing is reachable and within the size cap, the video renders without a bed. `Pick music` reports what it rejected and why. |
| Captions drift from the voice | Check `cutsAlignedToSpeech` in the output. `false` means the script and the alignment disagreed on word count and the proportional fallback ran — almost always digits or abbreviations the prompt asks the model to spell out. |
| Spoken word unreadable | You are in a box mode with a thick stroke. Use `karaoke` (the default). |

## Verified against

n8n **2.29.10**, Zvid API schema **1.0.0**. Every node type and version resolves in a
stock n8n install.

Run start-to-finish in n8n with **every endpoint live** — OpenRouter, ElevenLabs, Zvid
— producing a real 1080×1920 MP4. All 28 executed nodes green: script generation,
stock search per scene, the music fallback and size guard, ElevenLabs
`/with-timestamps`, the mp3 uploaded to the Zvid CDN, validation with 0 layout
warnings, a paid render, an eight-iteration poll loop, and the finished video
downloaded.

**Caption sync checked against the audio itself**, which is the test that matters:
the narration mp3 measures **20.7412 s** and the alignment's last word ends at
**20.712 s** — a 29 ms difference over the whole clip, so there is no scale error and
no accumulating drift. Sampled frames at 4 s, 10 s and 16 s each showed exactly the
cue the payload predicted, and captions stayed legible on bright ice, dark metal and
a lit face.

The character→word conversion has unit tests covering multi-space gaps, the
`normalized_alignment` fallback and both error paths.

**Never executed:** the YouTube upload step.
