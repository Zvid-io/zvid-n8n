# Daily quiz Shorts: question, countdown, answer

[`zvid-quiz-shorts.json`](zvid-quiz-shorts.json)

Every day: read the next unused quiz question from a Google Sheet and render a
1080×1920 quiz Short with Zvid — the question with three options, an animated
3‑2‑1 countdown, then the correct answer highlighted with a fun fact. The video
URL is written back to the sheet so a row is never used twice.

```
Schedule ─▶ Config ─▶ Sheet row (first unused) ─▶ Music check ─▶ Build project
        ─▶ Validate (free) ─▶ dry-run gate ─▶ Render ─▶ Poll ─▶ Sheet write-back
        ─▶ ▶ Watch video
```

## What changed

- **It renders on the first run.** `dryRun` now defaults to `false`, so importing
  and running the workflow produces a real video and **spends credits** (~15 per
  video). The dry run is still there as an opt-in escape hatch — set
  `dryRun: true` in `Config` for a free validate + credit quote + editor draft.
- **New `▶ Watch video` node at the end.** It downloads the finished MP4 and n8n
  plays it inline, with a download button. Click the node to watch the video you
  just made — no copying URLs out of the run summary.

## The three beats

1. **Question** — brand pill, the question, A/B/C option rows, a "lock it in"
   hint and your handle as a watermark.
2. **Countdown** — a full-screen 3 · 2 · 1 on concentric rings, each digit in a
   rotating accent colour. Digits crossfade into each other, so there is no
   frame where the ring sits empty — pause anywhere and it still looks designed.
3. **Reveal** — the same three options return, the correct row lights up in the
   accent colour with a check mark while the wrong answers dim to 35%, and a
   "DID YOU KNOW?" card delivers the fun fact. CTA pill and brand line close it.

The design is adapted from Zvid's `edu-multiple-choice-quiz` and `pro-edu-quiz`
library templates (dark-indigo quiz look, letter-chip option rows, dedicated
countdown scene).

Two details that keep it looking hand-made at any content length:

- **Type scales with content.** A 40-character question renders at 64 px; a
  130-character one drops to 46 px *and* gets 1.2 s more reading time. Option
  rows and the fact card measure their own text and re-stack so nothing ever
  overlaps or clips — the row positions are computed, not hard-coded.
- **The music bed can never fail the run.** The track URL is `HEAD`-checked
  before use; if it is unreachable or over the plan's audio size cap the video
  simply renders without music.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Google Sheets OAuth2 | Standard n8n Google credential — used to read the next question and write back Status/VideoUrl. |

That is the whole list. The music comes from a public CDN URL in `Config`, and
the design is generated — no stock accounts, no LLM, no TTS.

## The sheet

Header row (exact spelling, row 1):

`Question | OptionA | OptionB | OptionC | CorrectLetter | FunFact | Status | VideoUrl`

| Column | Rules |
| --- | --- |
| `Question` | Up to 130 characters. |
| `OptionA/B/C` | Up to 40 characters each. |
| `CorrectLetter` | `A`, `B` or `C` (case-insensitive). |
| `FunFact` | One sentence shown after the reveal, up to 200 characters. |
| `Status` | Leave empty. The workflow picks the FIRST row with an empty Status and writes `done` after a real render. Type anything (e.g. `skip`) to park a row. |
| `VideoUrl` | Leave empty — filled with the finished MP4 URL. |

Guard rails: an empty sheet, an exhausted sheet, a missing option or a bad
`CorrectLetter` each fail with a message that names the row and the fix, before
anything is spent. Dry runs never mark a row as used.

## Setup

**The first run renders for real and spends credits — roughly 15 per video.**
If you would rather look before you pay, open `Config` and set `dryRun: true`
first: that path validates the payload, quotes the exact credit cost and saves a
draft you can watch in the editor, without charging anything.

1. **Import** `zvid-quiz-shorts.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Validate project (free)*, *Save draft to
   editor*, *Submit render* and *Get render status*.
3. **Google Sheets credential** — attach it to *Get quiz rows* and *Mark row
   done*, and pick your spreadsheet + tab in BOTH nodes.
4. **Open `Config`** and set `brandName`, `channelHandle` and your colours.
5. **Run it** with **Test manually**. With the shipped default (`dryRun: false`)
   this renders the video for real, spends ~15 credits and writes `Status` +
   `VideoUrl` back to the sheet.
   *Free preview instead:* set `dryRun: true` in `Config` first — you get the
   exact credit cost for your row and an **`editorLink`** that opens the draft in
   the Zvid editor, and the sheet row stays unused.
6. **Click `▶ Watch video`** (the last node on the canvas) to play the finished
   MP4 inside n8n.

Both a **Test manually** trigger and a daily schedule are included, so you can
try it before activating it.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base URL — leave as is. |
| `brandName` / `channelHandle` | `BRAINWAVE` / `@brainwavequiz` | Watermark on the question scene, brand line on the reveal. |
| `kicker` | `🧠 DAILY QUIZ` | The pill at the top of the question scene. |
| `timerHint` | `You've got 3 seconds — lock it in!` | Line under the options. |
| `countdownLabel` | `TIME'S TICKING` | Label above the countdown digits. |
| `ctaText` | `Follow for a new quiz every day` | CTA pill on the reveal. |
| `accentColor` | `#7C6BFF` | Chips, correct answer, CTA — the brand colour. |
| `bgColor` / `bgDeepColor` | `#151533` / `#0E0E24` | Scene backgrounds; `bgDeepColor` is also the dark text used on accent surfaces. |
| `countdownColors` | `["#7C6BFF","#FFB01F","#FF5C5C"]` | Digit colours for 3, 2, 1. |
| `questionSeconds` | `6` | Reading time for the question scene (+1.2 s automatically for questions over 85 chars). |
| `countdownSeconds` | `3.6` | Total countdown length; the three digits split it evenly. |
| `revealSeconds` | `5.8` | Answer + fun fact scene. |
| `musicUrl` | a CDN track | Any public MP3. Blank it for a silent video. |
| `musicVolume` | `0.16` | |
| `maxMusicBytes` | `5242880` | Tracks over the plan's audio cap are skipped, not fatal. |
| `resolution` / `frameRate` | `youtube-short` / `30` | 1080×1920. |
| `dryRun` | `false` | Renders for real by default — the run spends credits. Set it to `true` for a free pass that validates the payload, quotes the credits and saves a draft you can watch in the editor without spending anything. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

Total video length with defaults is ~14.4 s (long questions ~15.6 s).

## Cost per video

The default question quotes **15 credits** (confirmed against the live
validation endpoint). The free `Validate project (free)` step still runs before
every render and still returns the quote for your exact row — but with the
shipped default the render then proceeds automatically. Set `dryRun: true` if
you want the run to stop at the quote. Free accounts include enough credits to
test.

## How it works

| Node | What it does |
| --- | --- |
| **Config** | Every knob in one Set node — no values buried in expressions. |
| **Get quiz rows** | Standard Google Sheets *Get Row(s)*. Pick your sheet + tab here. |
| **Pick next question** | Takes the first row with an empty `Status`, validates all fields, and fails with the row number and the fix when something is off. |
| **Check music** | `HEAD`s `musicUrl` (reachability + `content-length` vs `maxMusicBytes`). Best-effort: failure just means no music bed. |
| **Build project JSON** | Assembles the three scenes: adaptive type sizes, computed row positions, the crossfaded countdown, the highlighted correct row and the fact card. Same logic as the QA'd standalone builder, embedded verbatim. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, credit quote — without spending credits. Failures surface as a field list. |
| **Dry run?** | The gate. With the shipped default (`dryRun: false`) it sends every run down the paid render branch; set `dryRun: true` and it takes the free draft branch instead. |
| **Save draft to editor** | *Dry-run branch only.* Saves the project as a draft (free) and returns `editorLink` for [editor.zvid.io](https://editor.zvid.io). Best-effort: a hiccup here never hides the dry-run report. |
| **Dry run summary** | *Dry-run branch only.* Credit quote, scene timings, warnings and the `editorLink` — and nothing was charged or written to the sheet. |
| **Submit render / Wait / Get render status** | Paid render plus the poll loop. |
| **Still rendering?** | Fails fast on a failed render and stops the loop at `timeoutMinutes`. |
| **Mark row done** | Writes `Status = done` and `VideoUrl` onto the exact row that was used (matched on `row_number`). Best-effort: if the write fails, the run summary still reports the video URL. |
| **Run summary** | Question, answer, video URL, credits charged, whether the sheet was updated. |
| **▶ Watch video** | Downloads the finished MP4 as binary (`responseFormat: file`). n8n's output panel branches on the binary mime type and renders `video/*` inline, and the CDN serves these as `Content-Type: video/mp4` — so clicking the node gives you a player with a download button. Retries 3× (the CDN can 404 for a moment right after a render completes) and is set to continue on error, so watching a video can never fail a run that already succeeded. |

## Publishing

The workflow deliberately ends at the sheet write-back — the sticky note on the
canvas shows the two-node YouTube tail (HTTP download → YouTube upload, keep it
`private` until you have watched a few). A 9:16 video under 3 minutes is
automatically a Short. TikTok, Instagram or Drive slot in the same way.

On self-hosted n8n, [`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid)
replaces *Submit render* + *Wait* + *Get render status* with a native **Zvid**
node and a **Zvid Trigger** (render webhook) — no polling loop. The shipped
nodes are core-only so the workflow also runs on n8n Cloud with nothing
installed.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `The sheet returned no rows` | Spreadsheet/tab not selected in the Google Sheets nodes, or the header row is missing. |
| `All N quiz rows are used` | Every row has something in `Status`. Add questions or clear a Status cell. |
| `Row N: CorrectLetter must be A, B or C` | Typo in the sheet — the message names the row. |
| `Row N: OptionB is empty` / `Question is ... characters` | Content rules on the yellow sticky: question ≤130 chars, options ≤40. |
| `Zvid rejected the project` | The message lists the offending fields. Check anything you changed in `Config` (colours must be 6-digit hex). |
| Silent video | The `musicUrl` HEAD check failed (dead URL or over `maxMusicBytes`). The run summary's `hasMusic` says so; swap the URL for any public MP3. |
| Render finished but the sheet was not updated | See `sheetUpdated: false` in the run summary — usually the Google credential lost access. The video URL is still in the output. |
| `Render did not finish within N minutes` | Raise `timeoutMinutes`, or check the job in the dashboard at [app.zvid.io](https://app.zvid.io). |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a day never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Verified

n8n **2.29.10**, Zvid API schema **1.0.0**. Every node type and version
resolves in a stock n8n install (Google Sheets node introspected at
typeVersion 4.7; the workflow pins 4.5 for compatibility).

**Rendered on the production engine and reviewed frame by frame.** Both QA
fixtures — the default question and a stress row (130-character question, all
three options at the exact 40-character ceiling, 138-character fun fact) — were
built with the exact builder embedded in the workflow, rendered with the
production `@zvid-io/zvid` renderer at 1080×1920, and every extracted frame was
visually reviewed: no clipped or overflowing text at either length (a 40-character
option still fits on one line, even highlighted with the check mark), countdown
digits crossfade with no empty-ring frame, the first digit finishes entering
exactly as the scene crossfade ends so it never double-exposes over the option
rows, the correct-answer highlight and CSS-drawn check mark render crisply, and
every element ends above the caption strip the Shorts player draws along the
bottom of the frame — the handle watermark and brand line are the only elements
below the main content, by design.

**Validated against the live API.** The default payload passed
`POST /api/render/validate/api-key` (via the schema validator with
`remote: true`): `valid: true`, **0 errors, 0 warnings**, `creditsRequired: 15`,
schema 1.0.0. The embedded code-node logic was additionally unit-driven against
a simulated sheet: row selection skips used rows, lowercase `b` normalises to
`B`, the music-down path drops the bed instead of failing, and the bad-letter /
exhausted-sheet paths throw the documented errors. The music URL was
`HEAD`-verified (HTTP 200, 3.7 MB, `audio/mpeg`).

**Not executed:** nothing in the publish/delivery tail — no social platform,
no email provider. Those nodes are documented, not exercised.

### Live n8n execution (2026-07-28)

Imported into **n8n 2.29.10** (self-hosted, Docker) with a Header Auth
credential holding a real Zvid API key, `dryRun: false`, and executed for
real. Every video below was downloaded from the CDN and reviewed frame by
frame at 2 fps.

- **Run**: green end to end. Rendered 1080x1920 @30 fps, AAC audio, **15
  credits**.
- **All three beats verified on the live output**: question with three options,
  the countdown ring stepping 3 -> 2 -> 1 through its colour shift, then the
  reveal highlighting option B (Jupiter) with the check and the fact card —
  matching the row's `CorrectLetter = B`.
- **Sheet round-trip**: the used row came back `Status = done` with its
  `VideoUrl`; the second question was left for the next run.
- **The returned `videoUrl` is a valid URL.** Project names are slugged, so the
  CDN filename carries no spaces and the link can be pasted straight into a
  publish node or `curl` (verified: HTTP 200 on the raw URL).

That live run used `dryRun: false` — which is exactly the path the workflow now
takes by default, so the evidence above covers the shipped configuration. One
honest caveat: the `▶ Watch video` node was added *after* that run, so the node
itself is not covered by this live evidence. Its contract was verified
separately (n8n renders `video/*` binary inline; the CDN serves these MP4s as
`Content-Type: video/mp4`).
