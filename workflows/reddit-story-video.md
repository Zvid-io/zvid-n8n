# Reddit story videos on autopilot

[`zvid-reddit-story-video.json`](zvid-reddit-story-video.json)

Every morning: pull the day's top story from a subreddit like r/tifu, rewrite it
into a clean first-person narration, voice it, match stock footage to every
beat, and render a captioned 1080×1920 story video with Zvid — cover card,
word-timed karaoke captions, music bed and end card included. Story channels
are a proven faceless format; the production hours are the bottleneck this
removes.

```
Schedule ─▶ Config ─▶ Fetch top stories (keyless) ─▶ Pick story ─▶ Write script
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
branded gradient panel instead of a black frame. Music candidates are
HEAD-checked for reachability and byte size before use — a dead URL or an
oversized track downgrades the video to "no music", it never fails the job.

**It reads the public Atom feed — no Reddit account, app or OAuth.**
`https://www.reddit.com/r/<subreddit>/top/.rss?t=day` is keyless (the `.json`
listing answers `403` to server traffic, which is why the workflow does not
use it). The picker unescapes the post's rendered HTML, strips tags, links,
markdown and the "submitted by /u/…" tail, then keeps text posts only, skips
mod/meta posts and anything outside `minChars`…`maxChars`, skips the last 200
already-used ids (remembered on production runs) and takes the first survivor —
the feed already arrives sorted by top-of-day. If nothing qualifies, the run
fails with a count of *why* each post was skipped. **The Atom feed carries no
NSFW, score or pinned flag**, so those cannot be filtered on: pick a subreddit
you are happy to publish from.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| ElevenLabs API key | Voice **and** word timings in one call. The key only needs **text-to-speech** permission. A ~45 s story uses ~700 characters. |
| OpenRouter API key | Rewrites the post into a narration. Any OpenAI-compatible chat endpoint works — swap the URL and credential type. |

Reddit needs **no key** — the workflow reads the public `.rss` Atom feed. Two
things about that endpoint are load-bearing:

- **It answers only to a browser-like `User-Agent`.** *Fetch top stories*
  ships one in its header parameters. **Do not remove or "tidy" that header** —
  without it every run comes back `403`.
- **It is rate-limited per IP, and some datacenter IPs are blocked outright.**
  One scheduled run a day never troubles it; back-to-back manual test runs can
  earn a temporary `429` (hence the 3 retries a minute apart on that node). If
  it never answers at all, run n8n from a home/office IP, raise the schedule
  interval, or point the trigger at another story source.

There are no stock-media accounts to set up either — footage, photos and music
come from Zvid's stock library via `/api/stock/search`, which runs on
server-side keys.

## Setup

1. **Import** `zvid-reddit-story-video.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name
   `x-api-key`, value = your Zvid key. Attach it to *Upload voiceover*,
   *Validate project (free)*, *Save draft to editor*, *Submit render* and
   *Get render status*.
3. **ElevenLabs credential** — add a **second Header Auth** credential, name
   `xi-api-key`, value = your ElevenLabs key. Attach it to *Generate
   voiceover*. On a free ElevenLabs plan only default voices work — Brian (the
   default), George, Roger, Sarah and Bill are confirmed working; Voice
   Library voices return `402` on free plans.
4. **OpenRouter credential** — attach it to *Write script*.
5. **Open `Config`** — set `subreddit` (no `r/` prefix), `channelHandle` and
   `ctaText`. Everything else has a working default.
6. **Run it.** The workflow renders for real out of the box, so **the first
   run spends credits — about 42** for a ~42 s story. When it finishes, click
   **`▶ Watch video`** to play it inside n8n.

   Prefer a free preview first? Set `dryRun: true` in `Config`: you get the
   exact credit cost and an **`editorLink`** that opens the draft in the Zvid
   editor, with nothing spent.
7. **Activate.** A fresh story every day at 9am — the used-story list only
   persists on production executions, so manual test runs may repeat a story
   but the daily schedule never will.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
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
| `outroSeconds` | `3` | End card length; `0` drops it. |
| `includeAttribution` | `true` | Keeps `r/<subreddit>` on the cover tag and a `story: r/<subreddit>` line on the end card. Leave it on — these are real people's stories. |
| `musicVolume` | `0.1` | The bed sits low under the narration. |
| `maxMusicSeconds` / `maxMusicBytes` | `240` / `5242880` | Guards against a music track that would blow the plan's audio size cap and fail the render. |
| `resolution` / `frameRate` | `tiktok` / `30` | 1080×1920. |
| `tailSeconds` | `0.4` | Breathing room after the last word before the end card. |
| `dryRun` | `false` | `false` renders for real. `true` = free pass: validate, quote the credits, save an editor draft. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |
| `apiUrl` | `https://api.zvid.io` | |

## Cost per video

The live validator quoted **42 credits** for the default fixture (a ~42 s
story: cover card + five footage beats + end card). Longer stories cost
proportionally more — the ~71 s stress cut quoted **72**. *Validate project
(free)* runs before every render and reports the exact figure as
`creditsCharged` in the run summary; `dryRun: true` gives you the number
without spending anything. The script costs well under a cent; the voice uses
roughly 700 ElevenLabs characters per story.

## How it works

| Node | What it does |
| --- | --- |
| **Fetch top stories** | GET `https://www.reddit.com/r/<subreddit>/top.json?t=day&limit=25` — keyless listing endpoint, with a descriptive User-Agent. |
| **Pick story** | Filters to clean text stories (SFW, not pinned, length window, not already used), decodes Reddit's HTML entities, strips URLs/markdown, picks the highest score and builds the writer prompt. Remembers the last 200 used ids in workflow static data (production runs only). |
| **Write script** | One JSON-mode call: rewrite the post as a first-person narration — a sub-twelve-word hook plus four to six scenes of one to three sentences, each with a concrete stock-footage hint. No usernames, no profanity, digits spelled out, ASCII only. |
| **Parse script** | Validates the JSON, normalises curly quotes to ASCII, rebuilds scenes from the narration if the model forgot them, merges beat seven-plus into beat six, and joins hook + scenes into the exact string the voice will speak. Hard-fails below 55% of the word target. |
| **Expand scenes / Search stock clips** | One stock search per beat. Beats 1–5 search footage; a sixth beat searches photos (free plans allow five video elements). |
| **Pick scene clip** | Scores portrait media highest (the canvas is 1080×1920), preferring clips long enough to cover their beat. A beat with no match renders as a branded gradient; only *all* beats failing kills the run. |
| **Music queries / Find background music / Shortlist music / Check music asset / Pick music** | Three tags known to return results, candidates ranked shortest-first, then HEAD-checked for reachability and size. No survivor = no music bed, never a failed render. |
| **Generate voiceover** | ElevenLabs `/with-timestamps` → base64 mp3 **plus** character-level alignment in one call. |
| **Voice + timings** | Decodes the audio into a named binary and groups the character alignment into word timings. |
| **Upload voiceover** | Uploads the mp3 to Zvid, returns the CDN URL used as the project's voice track. |
| **Build project JSON** | The whole design: hook-timed cover card (adaptive headline size, 62→45 px), beat scenes cut on real word timings, caption scrim, transition padding, karaoke captions, watermark, music bed, CTA end card with attribution. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — without spending credits. Failures surface as a field list. |
| **Dry run?** | Routes on `Config.dryRun` (`false` by default, so the normal path goes straight to *Submit render*). |
| **Save draft to editor / Dry run summary** | Dry-run branch only: free draft + `editorLink` (`https://editor.zvid.io/?project=…`) + the exact credit quote. |
| **Submit render / Wait / Get render status / Still rendering?** | Paid render plus a poll loop; fails fast on a failed job and stops at `timeoutMinutes`. |
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

These stay out of the required path so the import runs with a Zvid key, an
ElevenLabs key and an OpenRouter key, nothing else. On self-hosted n8n you can
also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid)
and replace the render HTTP nodes with the native **Zvid** node + **Zvid
Trigger** (render webhook), which removes the poll loop.

## A word on the source material

These are real people's stories. The writer prompt strips usernames and real
names, keeps the retelling family friendly, and the picker never takes NSFW
posts. `includeAttribution: true` keeps a `story: r/<subreddit>` line on the
cover and end card — leave it on, and check the subreddit's stance on
republication if you monetise the channel. You are responsible for what your
channel posts.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Reddit returned no posts` | Wrong `subreddit` value (use `tifu`, not `r/tifu`), a banned/private subreddit, or the listing endpoint temporarily rate-limited you. |
| `429` from Reddit on manual runs | The keyless listing endpoint is rate-limited per IP. One scheduled run a day never hits it; hammering *Test manually* back-to-back can. Wait a few minutes. |
| `No story … passed the filters today` | The error lists why each post was skipped (NSFW, pinned, too short, too long, already used). Widen `minChars`/`maxChars`, try another subreddit, or wait a day. |
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

## Verified

n8n **2.29.10** node types and versions (every node resolves in a stock
install; the render chain uses the same shapes as the other templates in this
series). What was verified at authoring time:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the
  render farm runs) from the builder's real output, twice: a default fixture
  (~42 s, 5-beat pancake-disaster story, 47-char headline) and a stress
  fixture (~71 s, 6 beats — five clips + the automatic still-photo fallback —
  61-char headline, 197-word narration with a 30-word sentence). **Every
  extracted frame was reviewed** (2 fps plus exact-timestamp grabs at every
  cut and the final frame): no clipping, no overflow, captions legible over
  bright and dark footage, cover card holds through the spoken hook, cuts land
  on sentence ends, watermark/attribution present.
- **Remote validation against the live API** (`POST
  /api/render/validate/api-key` via MCP with `remote: true`): `valid: true`,
  **0 errors, 0 warnings**, `creditsRequired: 42` (default) / `72` (stress),
  schema **1.0.0**. An earlier pass surfaced 6 contrast-lint warnings (colours
  declared only in inline HTML, not `style`) — fixed, then re-validated clean.
- **Word-timing machinery is the proven Day-1 code** (character→word grouping,
  drift fallback, transition padding) lifted verbatim from the
  faceless-shorts template that ran live end-to-end; fixture timings here are
  synthetic (2.9 words/s over the exact fixture text), so caption cues and
  scene cuts in the reviewed renders are real cue data.
- **Every pinned fixture URL probed at authoring time** (HTTP 200 + correct
  content-type): 10 stock clips, 1 photo, 2 music beds.
- **The embedded code nodes are byte-identical** to the reviewed standalone
  sources (asserted programmatically for all 13 code nodes after writing the
  workflow JSON), every code node compiles, all connections resolve, and the
  shipped file carries no credential blocks.

**Not executed at authoring time:** the Reddit listing endpoint inside n8n
(the fixture stories stand in for it — the endpoint shape is documented from
its public JSON contract), OpenRouter/ElevenLabs live calls (the shapes are
verbatim from the live-verified Day-1 template), and any publish tail.
