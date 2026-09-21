# Reddit story videos on autopilot

## Required Zvid node

Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before configuring Zvid credentials. A workspace owner/admin may need to install it. Create a **Zvid API** credential with your key from https://app.zvid.io/api-keys and Base URL `https://api.zvid.io`, then select it on every Zvid node.

File upload exception: the published Zvid node does not expose multipart uploads. The upload step uses HTTP Request → `POST /api/uploads`, authenticated with the same **Zvid API** credential. All supported Zvid operations use the Zvid node.

[`zvid-reddit-story-video.json`](zvid-reddit-story-video.json)

Supply your own story text, or connect approved Reddit OAuth access to pull the day's top story from a subreddit like r/tifu. Rewrite it
into a clean first-person narration, voice it, match stock footage to every
beat, and render a captioned 1080×1920 story video with Zvid — cover card,
word-timed karaoke captions, music bed and end card included. Story channels
are a proven faceless format; the production hours are the bottleneck this
removes.

```
Schedule/manual ─▶ Config ─▶ Manual story? ─▶ Pick story ─▶ Write script
                              └─ Reddit OAuth fetch ─┘
        ─▶ Stock b-roll (per beat) ─▶ Music ─▶ Voiceover + word timings ─▶ Upload
        ─▶ Build project ─▶ Validate (free) ─▶ Render ─▶ ▶ Watch video
```

## Why this one is different

**The cover card holds exactly as long as the spoken hook.** The first scene is
a neutral "story card" — rounded panel, avatar dot, `r/tifu · today's top
story` tag, bold headline, a *tap for the full story* hint — and it stays on
screen for precisely the words the narrator uses to tease the story, because
the cut is driven by the voice's own word timings, not a hardcoded duration.
(It is deliberately a neutral card, not a mock of any site's UI.)

**Cuts land on sentence boundaries.** The voice comes from ElevenLabs'
`/with-timestamps` endpoint, which returns the audio *and* a character-level
alignment in one call. Each story beat ends when its own sentences end, the
karaoke captions track the real voice word by word, and every scene is padded
by the crossfade overlap so transitions never drag the cuts off their
narration timestamps.

**No shot outstays its welcome.** A story beat can easily be forty-five words
long, and one locked-off stock clip held for sixteen seconds is how a video
gets scrolled past. Any beat whose narration would run past `maxShotSeconds`
(12 s) is cut into two shots at a sentence boundary, each with its own
footage. The narration is untouched — only the number of pieces of b-roll the
story asks for changes.

**A render can always finish.** Free plans allow five video elements, so the
first shot of each beat gets moving footage while that budget lasts, and
continuation shots plus any sixth beat become still photos with a slightly
deeper Ken Burns push. A shot with no stock match at all falls back to a
branded panel — the brand gradient, an accent streak and a concentric ring
emblem arriving in two staggered fades — rather than a black frame. It is a
graceful degradation, not a designed beat: once the emblem has settled (~1.4 s)
the panel is static under the captions for the rest of the shot, so if a story
keeps hitting it, widen the writer's `visualQuery` hints rather than living
with it. Music candidates are
HEAD-checked for reachability and byte size before use — a dead URL or an
oversized track downgrades the video to "no music", it never fails the job.

**Two explicit story sources.** The default `sourceMode: "manual"` requires
`manualStoryTitle` and `manualStoryText` in Config. The template does not invent
or silently substitute a story when Reddit is unavailable. Optional
`manualStoryUrl` records the original source link; review rights and attribution
before publishing.

For automatic Reddit selection, set `sourceMode: "reddit"`, connect an approved
**Reddit OAuth2 API** credential to **Fetch top stories**, and replace the
username in `redditUserAgent`. The request uses `oauth.reddit.com` and a
descriptive User-Agent. The picker excludes NSFW, pinned, removed, moderator,
non-text and already-rendered posts, then applies the character limits.
Production runs record the post ID only after a successful render.

HTTP 429 stops before AI and rendering and reports Reddit's Retry-After delay
when supplied. There is no rapid retry loop. HTTP 401/403 explains the OAuth
setup. A browser-style User-Agent cannot replace approved access; the earlier
keyless RSS instructions were unreliable. See [Reddit's access guidance](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki).

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| ElevenLabs API key | Voice **and** word timings in one call. The key only needs **text-to-speech** permission. A ~45 s story uses ~700 characters. |
| OpenRouter API key | Rewrites the post into a narration. Any OpenAI-compatible chat endpoint works — swap the URL and credential type. |

Automatic mode requires approved Reddit API access. Without it, leave the default manual mode and supply your own story.

There are no stock-media accounts to set up either — footage, photos and music
come from Zvid's stock library via `/api/stock/search`, which runs on
server-side keys.

## Setup

1. **Import** `zvid-reddit-story-video.json`.
2. **Zvid credential** — create a **Zvid API** credential and select it on every Zvid node. Use it on the HTTP upload step too (Predefined Credential Type → Zvid API).
3. **ElevenLabs credential** — add a **Header Auth** credential, name
   `xi-api-key`, value = your ElevenLabs key. Attach it to *Generate
   voiceover*. On a free ElevenLabs plan only default voices work — Brian (the
   default), George, Roger, Sarah and Bill are confirmed working; Voice
   Library voices return `402` on free plans.
4. **OpenRouter credential** — attach it to *Write script*.
5. **Open `Config`** — fill `manualStoryTitle` and `manualStoryText` (400–2200 characters by default), plus `channelHandle` and `ctaText`. For automatic mode, select `sourceMode: "reddit"`, set `subreddit` without `r/`, update `redditUserAgent`, and connect approved Reddit OAuth2 credentials to *Fetch top stories*.
6. **Run it.** The workflow renders for real out of the box, so **the first
   run spends credits — about 42** for a ~42 s story. When it finishes, click
   **`▶ Watch video`** to play it inside n8n.

   Prefer an editor preview first? Set `dryRun: true` in `Config`: you get the
   exact credit cost and an **`editorLink`** that opens the draft in the Zvid
   editor without render credits. OpenRouter and ElevenLabs can still charge.
7. **Activate only after configuring the source.** Automatic Reddit mode runs
   daily at 9am and remembers the last 200 successfully rendered post IDs in
   production. Manual mode reuses the text in Config until you replace it.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `sourceMode` | `manual` | `manual` uses your story; `reddit` requires approved Reddit OAuth2 access. |
| `manualStoryTitle` / `manualStoryText` | empty | Required in manual mode; no automatic sample substitution. |
| `manualStoryUrl` | empty | Optional source URL for manual input. |
| `redditUserAgent` | descriptive placeholder | Replace `YOUR_REDDIT_USERNAME` before automatic fetching. |
| `subreddit` | `tifu` | Story source, without the `r/` prefix. Story-shaped subs (r/tifu and similar) work best. |
| `minChars` / `maxChars` | `400` / `2200` | Selftext length window — long enough for a real arc, short enough for a ~45 s retelling. |
| `targetSeconds` | `45` | Target narration length (~2.7 words/second). |
| `llmModel` | `openai/gpt-4.1-mini` | OpenRouter model id. |
| `voiceId` / `voiceLabel` | `nPczCjzI2devNBz1zQrb` / `Brian (deep narrator)` | ElevenLabs voice id; the label is a human comment, only the id is sent. |
| `elevenModel` | `eleven_multilingual_v2` | Any ElevenLabs model that supports timestamps. |
| `voiceStability` / `voiceSimilarity` | `0.4` / `0.75` | Lower stability = more expressive. |
| `channelHandle` | `@untoldstories.daily` | Watermark on every scene + the end card. |
| `ctaText` | `Follow for tomorrow's story` | End-card pill. |
| `brandBackground` / `brandAccent` | `#10141C` / `#FFC24B` | Deep slate + warm amber. The accent colours the spoken word, the cover tag and the CTA pill. |
| `cardFont` / `captionFont` | `Inter` / `Montserrat` | Card/end-card type vs caption type. One font per text element. |
| `captionAnimation` | `karaoke` | Also `fill`, `pop`, `bounce`, `typewriter`, `one-word`, `highlight` (box modes auto-thin the stroke and add padding). |
| `captionWordsPerCue` | `3` | Words on screen at once. |
| `captionSize` / `captionStrokeWidth` | `60` / `6` | The heavy black outline keeps captions readable over any footage. |
| `captionActiveColor` | `#10141C` | Only used by box modes — text colour inside the accent chip. |
| `sceneTransition` / `transitionSeconds` | `fade` / `0.35` | Set `sceneTransition` to `null` for hard cuts. |
| `kenBurnsDepth` | `1.12` | Slow push on every clip (stills get a slightly deeper push). |
| `maxShotSeconds` | `12` | Ceiling on how long one piece of footage may hold. A story beat whose narration runs longer is split into two or more shots at sentence boundaries, each with its own footage. A *single* sentence longer than this cannot be split without cutting mid-sentence, so it stays whole — the cap is a ceiling on planned shots, not a promise. |
| `outroSeconds` | `3` | End card length; `0` drops it. |
| `includeAttribution` | `true` | Keeps `r/<subreddit>` on the cover tag and a `story: r/<subreddit>` line on the end card. Leave it on — these are real people's stories. |
| `musicVolume` | `0.1` | The bed sits low under the narration. |
| `maxMusicSeconds` / `maxMusicBytes` | `240` / `5242880` | Guards against a music track that would blow the plan's audio size cap and fail the render. |
| `resolution` / `frameRate` | `tiktok` / `30` | 1080×1920. |
| `tailSeconds` | `0.4` | Breathing room after the last word before the end card. |
| `dryRun` | `false` | `false` renders for real. `true` validates, quotes and saves a draft without render credits; upstream services may charge. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |
| `apiUrl` | `https://api.zvid.io` | |

## Cost per video

The live validator quoted **42 credits** for the default fixture (41.73 s:
cover card + five footage beats + end card). The cost tracks the finished
video's length almost exactly — the 71.39 s stress cut quoted **72** and a
28.97 s cut quoted **29** — so budget roughly one credit per second and set
`targetSeconds` accordingly. *Validate project (free)* runs before every render
and reports the exact figure as `creditsCharged` in the run summary;
`dryRun: true` gives you the number without spending anything. The script costs
well under a cent; the voice uses roughly 700 ElevenLabs characters per story.

## How it works

| Node | What it does |
| --- | --- |
| **Every day at 9am / Test manually** | Schedule trigger plus a manual trigger, both feeding *Config*. The manual one is what `n8n execute --id` needs. |
| **Fetch top stories** | Authenticated GET `https://oauth.reddit.com/r/<subreddit>/top?t=day&limit=25&raw_json=1` with Reddit OAuth2 and a descriptive User-Agent. Returns status and headers to the picker; no automatic retry loop. |
| **Pick story** | Validates the manual title and story, or filters the authenticated Reddit JSON listing. Rejects access errors before paid calls and excludes non-text, NSFW, pinned, removed, AutoModerator and previously rendered Reddit posts. Applies `minChars`/`maxChars` and chooses the first eligible post. Successful production renders record the last 200 IDs. |
| **Write script** | One JSON-mode call: rewrite the post as a first-person narration — a sub-twelve-word hook plus four to six beats of one to three sentences, each with a concrete stock-footage hint that must name an object, a place or a pair of hands, never a person. No usernames, no profanity, digits spelled out, ASCII only. |
| **Parse script** | Validates the JSON, normalises curly quotes to ASCII, rebuilds beats from the narration if the model forgot them, merges beat seven-plus into beat six, plans the shot list (splitting any beat that would run past `maxShotSeconds` at a sentence boundary), and joins hook + beats into the exact string the voice will speak. Hard-fails below 55% of the word target. |
| **Expand scenes / Search stock clips** | One stock search per **shot**. The first shot of each beat asks for footage while the five-video budget lasts; continuation shots and anything past the budget ask for photos. |
| **Pick scene clip** | Scores portrait media highest (the canvas is 1080×1920), prefers clips long enough to cover their shot, never reuses a clip across a split beat, and pushes clips whose description names people down the list. A shot with no match renders as a branded gradient panel; only *all* shots failing kills the run. |
| **Music queries / Find background music / Shortlist music / Check music asset / Pick music** | Three tags known to return results, candidates ranked shortest-first, then HEAD-checked for reachability and size. No survivor = no music bed, never a failed render. |
| **Generate voiceover** | ElevenLabs `/with-timestamps` → base64 mp3 **plus** character-level alignment in one call. |
| **Voice + timings** | Decodes the audio into a named binary and groups the character alignment into word timings. |
| **Upload voiceover** | Uploads the mp3 to Zvid, returns the CDN URL used as the project's voice track. |
| **Build project JSON** | The whole design: hook-timed cover card (adaptive headline size, 62→45 px), shot scenes cut on real word timings, caption scrim, transition padding, sentence-aware karaoke cues, watermark, music bed, CTA end card with attribution. |
| **Validate project (free) / Check validation** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — without spending credits. *Check validation* fails the run loudly with the field list when it is rejected, and otherwise carries the payload, `creditsRequired` and the builder's `meta` forward. |
| **Dry run?** | Routes on `Config.dryRun` (`false` by default, so the normal path goes straight to *Submit render*). |
| **Save draft to editor / Dry run summary** | Dry-run branch only: free draft + `editorLink` (`https://editor.zvid.io/?project=…`) + the exact credit quote. |
| **Submit render / Wait / Get render status / Render finished? / Still rendering?** | Paid render plus a poll loop; *Render finished?* routes on `state === 'completed'` and *Still rendering?* fails fast on a failed job and stops at `timeoutMinutes`. |
| **Run summary** | `videoUrl`, `jobId`, `creditsCharged`, the story's title/source and the stock credits list. |
| **▶ Watch video** | Downloads the finished MP4 as binary so n8n plays it inline — click the node to watch. Retries a few times and never fails the run. |

## Publishing (optional tail)

The required path ends with the finished MP4 in **▶ Watch video** (binary
`data`) and `videoUrl` in *Run summary*:

- **YouTube Shorts** — add the native **YouTube** node (Video → Upload, binary
  `data`) directly after *▶ Watch video*. Needs YouTube OAuth2.
- **TikTok / Instagram / multi-platform** — pass `videoUrl` to a scheduler
  such as Blotato, Buffer or Postiz over their HTTP API; they take a public
  video URL directly.
- **Human in the loop** — Slack/Email node sending `videoUrl` + `title` to
  whoever posts.

These stay out of the required path. Manual mode needs a story, a Zvid key,
an ElevenLabs key and an OpenRouter key. Automatic fetching additionally needs
approved Reddit OAuth access. Supported Zvid operations already use the native
**Zvid** node. A **Zvid Trigger** render webhook can replace the poll loop in a
customized workflow.

## A word on the source material

These are real people's stories, and the b-roll shows real people too. Read
this section before you point the template at a monetised channel.

**Reddit metadata filtering is limited.** Automatic mode excludes posts marked
NSFW, pinned, removed or authored by AutoModerator, plus non-text and previously
rendered posts. These checks do not establish permission to republish or guarantee
appropriate content. Manual text has no Reddit metadata to check. Review the
source and finished draft before publication.

**The writer prompt asks for a family-friendly retelling** without usernames,
real names or explicit content. A prompt does not guarantee removal of personal
details, so review the narration and captions.

**B-roll and real faces.** A stock clip of a recognisable stranger running
under a first-person confession reads as *this is the person it happened to*,
which is a real person's likeness attached to somebody else's story. So the
writer prompt is told to describe objects, places and hands rather than people,
and *Pick scene clip* pushes candidates whose description names people down the
ranking. Both are biases, not filters: catalogue entries are often untitled, so
a shot with faces in it can still win. Watch the video before you publish it.

**Attribution.** `includeAttribution: true` keeps `r/<subreddit>` on the cover
tag and a `story: r/<subreddit>` line on the end card. Leave it on, and check
the subreddit's stance on republication if you monetise the channel. You are
responsible for what your channel posts.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Reddit returned no feed for r/…` | The feed never arrived. Check `subreddit` has no `r/` prefix (use `tifu`), and that the sub is not private or banned. Otherwise it is the endpoint: see the two rows below. |
| `401` / `403` from Reddit | Connect an approved Reddit OAuth2 app and set `redditUserAgent`. Without approved access, use `sourceMode: "manual"` and fill the story fields. |
| `429` from Reddit | The picker stops before AI/render requests and reports Retry-After when supplied. Wait for access to reset; browser headers and repeated retries do not fix missing authorization. |
| `No eligible unused text story` | None of the fetched posts passes metadata, length and prior-render checks. Adjust `minChars`/`maxChars`, wait for new posts, or supply your own manual story. |
| `The model did not return JSON` | The model ignored JSON mode. Use one that supports `response_format: json_object`. |
| `The script is only N words` | The writer under-delivered badly (below 55% of target). Retry, or use a stronger model. |
| `ElevenLabs returned no audio` | Bad or missing `xi-api-key` credential, an unknown `voiceId`, or your monthly character quota is spent. |
| `402 paid_plan_required` | The `voiceId` is a Voice Library voice and your plan is free. Use a default voice id. |
| `ElevenLabs returned audio but no alignment` | The URL lost its `/with-timestamps` suffix — captions have nothing to ride on. |
| `No stock footage matched any scene` | Every beat's `visualQuery` came back empty — rare, and story-dependent; the next story fixes itself. Single missing beats already fall back to a branded gradient. |
| `Zvid rejected the project` | The message lists the offending fields. If you edited the builder: `name` only allows letters, digits, spaces, `_`, `-`; `audios[].track` is rejected; free plans cap video elements at 5. |
| Captions drift from the voice | Check `cutsAlignedToSpeech` in the output. `false` means the script and alignment disagreed on word count and the proportional fallback ran — almost always digits or abbreviations the prompt tells the model to spell out. |
| Same story twice in tests | Workflow static data only persists on **production** executions. Manual test runs always start with an empty used-list. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a day never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Live retest on 2026-09-20

The original Reddit RSS fetch returned HTTP 429 inside Docker n8n. Automatic OAuth fetching remains unverified because no approved Reddit app is connected. The manual source path and rate-limit guards are tested separately; see the runtime audit for the completed live runs.

## Historical verification

> Historical verification note: dated runs below describe the earlier HTTP-based version. The current template uses the Zvid node for every supported operation; migration checks cover request bodies, credit quotes, validation failures, and workflow connections.

n8n **2.29.10** node types and versions (every node resolves in a stock
install; the render chain uses the same shapes as the other templates in this
series). What was verified at authoring time:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the
  render farm runs) from the builder's real output, three times:
  - *default* — 41.73 s, 5 footage beats, 46-char headline, music bed,
    `includeAttribution: true`.
  - *stress* — 71.39 s, 7 shots (five clips plus the two automatic
    still-photo fallbacks), 61-char headline, 197-word narration with a
    30-word sentence, music bed.
  - *branches* — 28.97 s, the paths the first two never take:
    `includeAttribution: false` (cover tag reads `STORY TIME · today's story`
    and the end card drops its source line), one shot with **no** stock match
    at all (the branded gradient panel), and **no** music survivor (the video
    renders without a bed).
- **Every frame of all three renders was reviewed**: 284 frames at 2 fps (83 /
  143 / 58) plus 21 exact-timestamp grabs at every cut midpoint and every final
  frame — 305 images in total. No clipping, no overflow, no text touching a
  frame edge, no unsubstituted variables, no text double-exposed across a cut,
  captions legible over bright kitchen footage and near-black night footage
  alike, cover card holding through the spoken hook, watermark leaving before
  the end card, attribution line present or absent exactly as configured.
- **Remote validation against the live API** (`POST
  /api/render/validate/api-key`, run through MCP with `remote: true`) on all
  three payload shapes: `valid: true`, **0 errors, 0 warnings**, schema
  **1.0.0**, `creditsRequired` **42** (default) / **72** (stress) / **29**
  (branches) — one credit per second of finished video in every case.
- **Every media URL in the three payloads probed** (`HEAD`, HTTP 200 + expected
  content-type): 12 stock clips, 2 stock photos, 2 audio files. The music bed
  used by the default fixture is 3.5 MB, inside the 5 MB audio cap the workflow
  enforces.
- **The embedded code nodes are byte-identical** to the reviewed standalone
  sources (asserted programmatically for all 13 code nodes against the builder
  directory), every code node compiles, all connections resolve, and the
  shipped file carries no credential blocks.
- **Word-timing machinery is the proven Day-1 code** (character→word grouping,
  drift fallback, transition padding) lifted verbatim from the
  faceless-shorts template that ran live end-to-end; fixture timings here are
  synthetic (2.9 words/s over the exact fixture text), so caption cues and
  scene cuts in the reviewed renders are real cue data driving real timings —
  but the alignment itself did not come from ElevenLabs.

**Not executed at authoring time:** the workflow has not been run inside n8n,
so nothing below the trigger has been exercised end-to-end. Specifically: the
Reddit `.rss` fetch was not called from the workflow (the parser was developed
against a saved Atom sample of five r/tifu entries, and the fixture stories
stand in for the feed downstream), the OpenRouter and ElevenLabs calls were not
made (their node shapes are lifted verbatim from the Day-1 template that did run
live end-to-end), and no publish tail was built or run.
