# Weekly sports recap videos from TheSportsDB

[`zvid-sports-recap-video.json`](zvid-sports-recap-video.json)

Every Monday morning: pull your league's latest final scores from TheSportsDB,
let an LLM write the on-screen copy (headline, one punchy line per match,
sign-off), and render a 1080×1920 scoreboard recap with Zvid — hype title card
over floodlit-stadium footage, one scoreboard scene per match with the winner
picked out in your accent colour, closing card with your handle. No voiceover:
the scores carry it, a driving music bed pushes it along. Built for club fan
pages, five-a-side leagues, fantasy communities and anyone who wants a weekly
"here's what happened" reel without opening an editor.

```
Schedule (Mon 8am) ─▶ Config ─▶ Fetch results (TheSportsDB) ─▶ Prepare results
        ─▶ Write recap (LLM) ─▶ Parse recap ─▶ Check music bed
        ─▶ Build project ─▶ Validate (free) ─▶ Render ─▶ Run summary ─▶ ▶ Watch video
```

## Why this one is different

**The scores are ground truth.** The LLM writes copy only — the headline, one
caption per match, the sign-off. The numbers on screen come straight from
TheSportsDB; the prompt tells the model it can never contradict them and forbids
invented scorers, minutes or incidents (it only ever gets scorelines, so it has
nothing to hallucinate from). If a caption comes back broken or missing, a
deterministic scoreline line ("Arsenal take it 2-1") slots in instead of failing
the run.

**It renders something meaningful with zero accounts configured.** No
TheSportsDB key, API down, off-season? *Prepare results* falls back to a bundled
demo matchday — the real 2023-24 Premier League final day — and flags the run
with `usingDemoData: true` in the summary. You can import the workflow and see
the full design before wiring anything up.

**The scoreboard layout survives real fixtures.** Team names auto-shrink and
wrap — `Wolverhampton Wanderers` sets cleanly at 38 px while `Chelsea` gets
50 px — and the size is also capped by the longest single word, because CSS only
wraps at spaces and `BOURNEMOUTH` at full size would overflow its column (a bug
this template's frame review actually caught and fixed). Scores scale for double
and triple digits, so an 11-1 rout or a 112-98 NBA game both fit. The winner's
side gets the accent colour plus an underline bar; draws stay neutral. All of it
verified frame-by-frame on the production renderer.

**A music bed that can never kill the render.** The configured track is
HEAD-checked for reachability and size before use; unreachable or over the
plan's 5 MB audio cap → the video renders without music instead of failing.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| OpenRouter account | For *Write recap*. Any funded key; the default model (`openai/gpt-4.1-mini`) costs well under a cent per run. |
| TheSportsDB key | Optional at first — the public test key `123` ships in `Config`. A personal key is cheap and polite for production (see below). |

The cover footage and music bed are pinned, pre-verified URLs inside the build
step — no stock-media accounts needed.

## Setup

1. **Import** `zvid-sports-recap-video.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name
   `x-api-key`, value = your Zvid key. Attach it to *Validate project (free)*,
   *Save draft to editor*, *Submit render* and *Get render status*.
3. **OpenRouter credential** — attach it to *Write recap*.
4. **Open `Config`** — set `brandName`, `handle` and `ctaText`. `leagueId`
   `4328` is the English Premier League; see the table below for others.
5. **Run it.** The workflow renders for real out of the box, so **the first run
   spends credits — about 24** for a five-match recap (about 10 for the
   single-match recap the test key produces). When it finishes, click
   **`▶ Watch video`** to play it inside n8n.

   Prefer to preview for free first? Set `dryRun: true` in `Config`: you get the
   exact credit cost and an **`editorLink`** that opens the draft in the Zvid
   editor, with nothing spent.
6. **Activate.** It posts a fresh recap every Monday at 8am.

### League ids

| League | `leagueId` |
| --- | --- |
| English Premier League | `4328` |
| NBA | `4387` |
| NFL | `4391` |

Any other league: open it on thesportsdb.com — the id is in the page URL.

### About the TheSportsDB key

The public test key `123` works without signing up, but when this template was
authored it returned only the **single most recent finished fixture** — enough
to see the whole pipeline run, but a one-match recap. A personal key from
[thesportsdb.com](https://www.thesportsdb.com) returns the last 15 finished
fixtures, which fills the full five-match recap (and is the polite way to use
their API on a schedule).

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `sportsDbKey` | `123` | TheSportsDB API key. The bundled test key returns one fixture; a personal key returns 15. Empty string → demo matchday. |
| `leagueId` | `4328` | English Premier League. See the league table above. |
| `maxMatches` | `5` | Cap on scoreboard scenes (1–5; also the free-plan scene budget). |
| `brandName` | `FULL TIME` | Title-card wordmark + per-scene watermark. |
| `handle` | `@fulltime.weekly` | Top of the title card and the closing card. |
| `ctaText` | `Follow for every matchday` | Text inside the closing-card pill. |
| `brandAccent` | `#C6FF3A` | Winner scores, chips, slashes, CTA pill. Pick something bright — it sits on near-black. |
| `brandBackground` | `#08110B` | Scene background; the arena gradient is derived from it automatically. |
| `font` | `Archivo` | Any Google Font. One font family across the whole video. |
| `llmModel` | `openai/gpt-4.1-mini` | Any OpenRouter model id with JSON-mode support. |
| `sceneSeconds` | `3.4` | Per-match scene length (clamped 2.5–6). |
| `transitionSeconds` | `0.45` | Slide-up transition between scenes; every non-last scene is padded by it so nothing gets cut short. |
| `coverVideoOverride` | `""` | Your own portrait clip for the title card (≥ 4 s). Empty = pinned floodlit-stadium clip. |
| `musicUrl` | pinned track | Driving music bed. HEAD-checked every run; unreachable/oversized → renders without music. |
| `musicVolume` | `0.16` | The bed sits under the visuals by design. |
| `maxMusicBytes` | `5242880` | Free-plan audio asset cap (5 MB). |
| `dryRun` | `false` | `false` renders for real. `true` = free pass: validate, quote credits, save an editor draft, spend nothing. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost per video

The live validator quoted **24 credits** for the five-match demo matchday
(23.8 s) — the stress payload (double-digit scores, 24-character team names)
quotes the same, because the video length is identical. A one-match recap
(what the test key produces) is ~10.2 s ≈ **10 credits**. *Validate project
(free)* runs before every render and reports the exact figure as
`creditsCharged` in the run summary; `dryRun: true` gives you the number
without the render.

## How it works

| Node | What it does |
| --- | --- |
| **Fetch results** | `GET thesportsdb.com/api/v1/json/<key>/eventspastleague.php?id=<league>` — keyless-style URL param auth, `neverError` so a dead API can't kill the run. |
| **Prepare results** | Filters to finished events (both scores non-null), sorts newest first, takes `maxMatches`, derives the matchday label and date line, and builds the LLM prompt. API failed / key empty / nothing finished → bundled demo matchday + `usingDemoData: true`. |
| **Write recap** | OpenRouter chat completion, JSON mode, 3 retries. System prompt pins the scores as ground truth. |
| **Parse recap** | Parses and hardens the model's JSON: ASCII-normalised, title ≤ 8 words, lines ≤ 10, closing ≤ 12, one line per match in match order, deterministic scoreline fallback for any broken line. |
| **Check music bed** | HEAD request on `musicUrl` (never errors). *Build project JSON* drops the music unless it came back `200` and within `maxMusicBytes`. |
| **Build project JSON** | The whole design lives here: title card over the stadium clip with the double accent slash, per-match scoreboard scenes (adaptive name/score sizing, winner accent + underline, draw neutrality, staggered slide-ins), trophy closing card, transition padding, HTML-escaping of all copy, and the API's `name` character rules. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — without spending credits. Failures surface as a field list. |
| **Dry run?** | Routes on `Config.dryRun` (`false` by default → straight to *Submit render*). |
| **Save draft to editor / Dry run summary** | **Only when `dryRun: true`.** Free draft + `editorLink` (`https://editor.zvid.io/?project=…`), quoted credits, no render. |
| **Submit render / Wait / Get render status** | Paid render plus a poll loop. |
| **Still rendering?** | Fails fast when the job reports `failed`; stops the loop at `timeoutMinutes`. |
| **Run summary** | `videoUrl`, `jobId`, `creditsCharged`, match count, `usingDemoData`, `musicIncluded`. |
| **▶ Watch video** | Downloads the finished MP4 as binary so n8n plays it inline — click the node to watch. Retries a few times and never fails the run. |

## Publishing (optional tail)

The required path ends with the video URL in *Run summary*. To auto-publish,
extend after it:

- **YouTube Shorts** — HTTP Request node (GET `videoUrl`, response format
  *File*) → native **YouTube** node (Video → Upload). Needs YouTube OAuth2.
- **Instagram / TikTok / multi-platform** — pass `videoUrl` to a scheduler such
  as Blotato, Buffer or Metricool over their HTTP API; they take a public video
  URL directly.
- **Human in the loop** — Slack/Email node sending `videoUrl` to whoever posts.

These stay out of the required path so the import runs with a Zvid key and an
OpenRouter key, nothing else. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and
replace the render HTTP nodes with the native **Zvid** node + **Zvid Trigger**
(render webhook), which removes the poll loop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Recap shows the 2023-24 EPL final day instead of my league | You're on the demo fallback — TheSportsDB was unreachable, returned no finished fixtures, or `sportsDbKey` is empty. The run summary says `usingDemoData: true` when this happens. |
| Only one match in the video | The public test key `123` returns a single fixture. Use a personal TheSportsDB key for the last 15. |
| Wrong league id | Cross-check the table above; the id is also in the league's URL on thesportsdb.com. During off-season, the "most recent" fixtures can be months old — that's the API's answer, not a bug. |
| `The model returned no content` / `did not return JSON` | The OpenRouter model misbehaved (already retried 3×). Try a stronger `llmModel`; the design keeps working either way because broken captions fall back to plain scorelines. |
| Video rendered without music | The HEAD check on `musicUrl` failed or the file exceeds `maxMusicBytes` — intentional, the render is never sacrificed for the bed. The run summary shows `musicIncluded: false`. |
| `Zvid rejected the project` | The message lists the offending fields. If you edited the builder, note the API only allows letters, digits, spaces, `_` and `-` in `name`, and rejects `audios[].track`. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a week never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Verified

n8n **2.29.10** node types and versions (every node resolves in a stock
install; the render chain uses the same shapes as the other templates in this
series). What was verified for this template:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the
  render farm runs) from the builder's real output, twice: the default fixture
  (five-match demo matchday, 23.8 s) and a stress fixture (24-character team
  names, an 11-1 and a 2-10 scoreline, a 0-0 draw, ten-word captions ×5,
  twelve-word closing). **Every extracted frame was reviewed** (2 fps plus
  exact-timestamp grabs at all six transition midpoints and the final frame):
  no clipping, no overflow, no low-contrast text, winner accents on the correct
  side, draws neutral. The review caught and fixed a real overflow
  (`BOURNEMOUTH` at the tier size crossed its column) — the longest-word cap
  exists because of it.
- **Remote validation against the live API** (`POST /api/render/validate/api-key`
  via MCP with `remote: true`) on the default payload: `valid: true`
  ("Payload is valid and would be accepted for rendering"), **0 errors,
  0 warnings**, `creditsRequired: 24`, schema `1.0.0`. The stress payload is
  structurally identical (same scenes, elements and geometry — only copy and
  font sizes differ), so it shares the verdict.
- **The live TheSportsDB endpoint was hit during authoring** with the shipped
  defaults (key `123`, league `4328`): HTTP 200, one finished fixture, and the
  exact response shape is quoted in *Prepare results*' comments. The
  one-fixture behaviour of the test key is documented above, not hidden.
- **Every pinned URL probed at authoring time** — the cover clip (1440×2560,
  13.8 s, 19.5 MB) and the music bed (116 s, 3.7 MB, under the 5 MB cap).
- **The embedded code nodes are byte-identical** to the frame-reviewed
  standalone builder sources (*Build project JSON*, *Prepare results*, *Parse
  recap* — asserted programmatically after generation), and simulated
  executions of *Prepare results* / *Parse recap* against mocked n8n globals
  covered: the live response, empty key, failed fetch, null-score events, and a
  sloppy LLM reply (markdown fences, curly quotes, missing lines, overlong
  copy).
- **Structural checks** on the workflow JSON: parseable, all connections
  resolve, all code nodes compile, unique names/ids, core-only node types, Zvid
  calls on Header Auth, no credentials blocks.

**Not executed:** nothing in the publish/delivery tail — no social platform, no
email provider. Those nodes are documented, not exercised.

### Live n8n execution (2026-07-29)

Imported into **n8n 2.29.10** (self-hosted, Docker) with a Header Auth
credential holding a real Zvid API key and an OpenRouter credential on *Write
recap*, `dryRun: false`, `maxMatches: 2`, and executed for real from the CLI.
All 18 executed nodes green, ending on **`▶ Watch video`**.

- **Real data, not the fallback.** *Fetch results* hit the live TheSportsDB
  endpoint with the shipped defaults and the run reported `usingDemoData:
  false` — the bundled demo matchday never ran.
- **Real LLM.** *Write recap* called OpenRouter and returned the title
  "Premier League Matchday 38 Exciting Final Results", the per-match line
  "West Ham dominates with a clear 3-0 win over Leeds" and the closing line —
  all three appear on screen in the finished video.
- **Real render**: `10.20 s`, 1080×1920 @30 fps, AAC stereo, 1.3 MB,
  **11 credits** (the free validate quoted 11 and 11 were charged). The poll
  loop ran two iterations.
- **The music guard passed live**: the bed was fetched, measured at 3.72 MB
  (under the 5 MB cap) and included — `musicIncluded: true`.
- **Frame-reviewed from the CDN**: the finished MP4 was downloaded (HTTP 200 on
  the raw URL — project names are slugged, so no spaces reach the CDN filename)
  and every frame at 2 fps was reviewed. The scoreboard reads
  `WEST HAM UNITED 3 · LEEDS UNITED 0` with the winner in the accent colour and
  the loser muted, matching the API's scoreline exactly; the title card carries
  the real league, matchday and date; the outro shows the LLM's closing line,
  the configured CTA pill and the handle.
- **`▶ Watch video` returned `mimeType: video/mp4`** (1.3 MB binary), so the
  clip plays inline in n8n.

Only one fixture came back from the test key on the day of the run, so the
video contains a single scoreboard scene — the multi-match layout is covered by
the frame-reviewed five-match local render above.
