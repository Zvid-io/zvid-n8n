# Workout of the day from your training sheet

[`zvid-workout-of-the-day.json`](zvid-workout-of-the-day.json)

Every morning at 06:00: read today's row from the gym's training sheet and turn it
into a 1080×1920 workout-of-the-day video — hero-footage hook, the full board
(up to five exercises with reps), the coach's note — ready for Stories, Reels,
Shorts or the members' group chat.

```
Schedule (06:00) ─▶ Config ─▶ Read workout sheet ─▶ Pick today's row
   ─▶ Build project ─▶ Validate (free) ─▶ Check validation ─▶ Dry run?
        ├─ false (default) ─▶ Submit render ─▶ poll ─▶ Run summary ─▶ ▶ Watch video
        └─ true ────────────▶ Save draft ─▶ Dry run summary (editorLink, free)
```

## What changed

Two changes since the first release of this template:

1. **It renders on the first run.** `dryRun` now defaults to **`false`** in
   `Config`, so importing the workflow and hitting *Test manually* produces a
   real video — and that **first run spends credits** (about **13**, see
   [Cost per video](#cost-per-video)). The dry-run branch is untouched and
   still there as an opt-in escape hatch: set `dryRun: true` in `Config` for a
   free pass that validates, quotes the cost and saves a draft.
2. **New `▶ Watch video` node at the end.** It downloads the finished MP4 and
   n8n plays it inline in the node's output panel. Click the node after a run
   and the workout video is right there — no hunting for a URL in the summary
   JSON.

## What it makes

A ~13 second vertical video in three beats, adapted from the `fitness-wod`
template in Zvid's library:

1. **Hook** — your hero footage under a dark gradient, brand chip top-left, then
   "WORKOUT OF THE DAY", the workout name, focus and date slide in.
2. **The board** — the whole workout on one card: numbered exercises, reps in the
   accent colour, staggered row-by-row entrance. This is the frame people
   screenshot, so everything from the sheet is on screen at once.
3. **Coach's note** — the day's cue as a big quote, your handle on an accent pill.

Type sizes adapt to the content: a 42-character workout name, a five-word rep
scheme like `4x8 each side`, or a two-sentence coach's note all scale down to fit
instead of clipping. One video element total, so free plans are nowhere near the
5-video limit.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Google account | The training sheet lives in Google Sheets; n8n's built-in Google Sheets credential (OAuth2 or service account) reads it. |

No other services, no LLM, no stock-media accounts. The default hero clip and
music bed are public URLs you can keep or swap in `Config`.

## The training sheet

One row per day, header row required:

| Date | WorkoutName | Focus | Ex1 | Ex2 | … | Ex5 | CoachNote |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-27 | PUSH DAY 01 | Chest / Shoulders / Triceps | Bench press x 5x5 | Incline DB press x 3x10 | … | Rope triceps pushdown x 3x12 | Rest 90s between sets. |

- **Date** — `YYYY-MM-DD`, ideally with the column formatted as plain text.
  Date-formatted cells and serial numbers are handled too; ambiguous formats like
  `07/03/2026` are not worth the risk.
- **Ex1…Ex5** — `Exercise x Reps`. The split happens on the **last** ` x `, so
  `Weighted chin-up cluster sets x 5x(2+2+2)` parses correctly. A cell without
  ` x ` (say `400m run`) renders without a reps line. Blank cells are skipped;
  Ex1 is required.
- **Focus** and **CoachNote** are optional. An empty note falls back to
  "Log your lifts. Tag the gym."
- Header matching ignores case, spaces and underscores — `Workout Name` works.

**No row for today?** The run fails with a message telling you exactly which date
to add — that is the safe default for a daily social post. If you would rather
repost the most recent past workout, set `fallbackToLatest: true`; the video
always shows that row's own date, never today's.

## Setup

1. **Import** `zvid-workout-of-the-day.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Validate project (free)*, *Save draft to
   editor*, *Submit render* and *Get render status*.
3. **Google Sheets credential** — attach it to *Read workout sheet* and pick your
   spreadsheet + sheet in the two dropdowns.
4. **Open `Config`** and set `gymName`, `handle`, `accent`.
5. **Run `Test manually`.** The workflow renders for real out of the box, so
   this **first run spends credits** — about **13** for the default board (see
   [Cost per video](#cost-per-video)). When it finishes, click the
   **`▶ Watch video`** node at the end of the canvas to play the result inside
   n8n; *Run summary* right before it holds `videoUrl`, `creditsCharged` and
   the ready-to-post `caption`.
6. **Prefer a free preview first?** Set `dryRun: true` in `Config` before that
   run. Nothing is charged: you get the exact cost, the caption, and an
   **`editorLink`** that opens the draft in the Zvid editor. Set it back to
   `false` when you want the render.
7. **Activate** the workflow for the daily 06:00 schedule.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `gymName` | `IRONHAUS ATHLETIC` | Brand chip on the hook, board header, footers. |
| `handle` | `@ironhaus.athletic` | Hook date line, board footer, the accent pill at the end. |
| `accent` / `background` | `#C6FF3D` / `#07080A` | The whole design keys off these two. |
| `font` | `Archivo` | Any font in Zvid's font library. |
| `heroVideo` | a gym clip from Zvid's stock library | Swap for your own footage — any public MP4 URL; portrait crops best. |
| `musicUrl` / `musicVolume` | an energetic bed / `0.18` | Set `musicUrl` to `""` for a silent video. |
| `timezone` | `""` (n8n instance timezone) | IANA name, e.g. `America/New_York`. Decides what "today" means. |
| `dateLocale` | `en-US` | Formats the on-screen date label ("MON, JUL 27"). |
| `fallbackToLatest` | `false` | Reuse the newest past row when today has no row. |
| `resolution` / `frameRate` | `instagram-reel` (1080×1920) / `30` | |
| `dryRun` | `false` | Renders for real by default. Set it to `true` for a free pass that validates the project, quotes the credits and saves a draft you can watch in the editor — without spending anything. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost per video

The default board renders for **13 Zvid credits** (~12.6 s at 1080×1920). The
free *Validate project (free)* step still runs before every render and returns
the exact quote for your row — it is just no longer a stopping point: the render
now proceeds automatically. Set `dryRun: true` in `Config` if you want the quote
without the render. Reading the sheet is free; there are no other paid services
in the workflow.

## How it works

| Node | What it does |
| --- | --- |
| **Config** | Every knob in one place — no values buried in expressions. |
| **Read workout sheet** | Plain Google Sheets read of all rows (dropdown-picked document + sheet). |
| **Pick today's row** | Computes "today" in your timezone, matches the Date column (ISO strings, parseable dates and sheet serials), splits `Ex1..Ex5` on the last ` x `, builds the on-screen date label from the row's own date, and fails with actionable messages (missing row, empty WorkoutName, no exercises). |
| **Build project JSON** | Assembles the three scenes. Fixed layout + tiered type sizes: the longest exercise name picks one shared row size (46/40/34 px) so the board never mixes sizes; workout name and coach note scale the same way. Every user string is HTML-escaped. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, credit quote — without spending credits. Failures surface as a field list. |
| **Dry run?** | The branch switch. With the default `dryRun: false` it goes straight to the render; with `dryRun: true` it takes the free branch instead and nothing is submitted. |
| **Save draft to editor / Dry run summary** | Dry-run branch only — these two never execute while `dryRun` is `false`. Saves the project as a draft (free) and reports `creditsRequired`, the caption, any warnings and an `editorLink` for [editor.zvid.io](https://editor.zvid.io). Best-effort: a hiccup on the draft save never hides the dry-run report. |
| **Submit render / Wait / Get render status** | The paid render plus the `pollSeconds` poll loop. |
| **Still rendering?** | Fails fast on a failed render and stops the poll loop at `timeoutMinutes`. |
| **Run summary** | `videoUrl`, `jobId`, `creditsCharged`, the workout name, date, exercise count and video length, plus a ready-to-paste `caption` (workout, focus, all exercises with reps, coach's note, hashtags). |
| **▶ Watch video** | Downloads the finished MP4 into a binary field. n8n branches its output panel on the binary's mime type and renders `video/*` inline with a player and a download button, and Zvid's CDN serves these as `Content-Type: video/mp4` — so clicking the node just plays today's workout. Retries 3× (the CDN can 404 for a moment right after a render completes) and is set to continue on error, so watching a video can never fail a run that already succeeded. Attach any platform node after it: the MP4 is already on the item as binary `data`, and the text is `{{ $('Run summary').first().json.caption }}`. |

On self-hosted n8n you can replace the render HTTP nodes with the native
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid)
nodes — the sticky note in the workflow has the mapping. The shipped workflow is
deliberately core-only so it imports untouched on n8n Cloud.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `The sheet returned no rows` | Document/sheet not picked in *Read workout sheet*, or the sheet has no header row. |
| `No row has a readable Date` | The Date column isn't `YYYY-MM-DD` (or anything parseable). Format the column as plain text. |
| `No workout row for today (…)` | There is no row whose Date is today in your timezone. Add the row, fix `timezone` in Config, or set `fallbackToLatest: true`. |
| `The row for … has no exercises` | All Ex1..Ex5 cells are blank. Fill at least Ex1 as `Exercise x Reps`. |
| Reps ended up inside the exercise name | The cell has no ` x ` separator (spaces matter): `Bench press x 5x5`, not `Bench press x5x5`. |
| Wrong date on the video | The video shows the **row's** date by design. If the row is right but "today" is wrong, set `timezone`. |
| `Zvid rejected the project` | The error lists the offending fields — most often a malformed `heroVideo`/`musicUrl` after editing Config. |
| Render failed / timed out | `Still rendering?` reports the job id and state; check the render in the dashboard at [app.zvid.io](https://app.zvid.io). |
| Video has no music | `musicUrl` is empty, or the URL is not a downloadable audio file. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a day never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Verified

n8n import structure checked mechanically (JSON parses, all connections resolve,
every code node compiles, unique names, Header Auth on all four Zvid calls), and
the embedded builder/row-picker code is extracted verbatim from the same files
that pass the unit fixtures.

**Rendered locally on the production Zvid engine** (`@zvid-io/zvid` CLI) for two
fixture rows — the default PUSH DAY 01 board and a stress row (42-character
workout name, 49-character exercise names, `5x(2+2+2)`-style reps, two-sentence
coach note) — and every extracted frame reviewed by eye: no clipped or
overflowing text, rows stay inside the card, transitions never show an empty
board, the long note wraps to three centred lines.

**Remote validation against the live API** (`POST /api/render/validate/api-key`
via MCP, `remote: true`): `valid: true`, **0 errors, 0 warnings**,
`creditsRequired: 13`, schema `1.0.0`. Media URLs HEAD-checked (hero 200
`video/mp4` 11.1 MB, music 200 `audio/mpeg` 3.7 MB).

**Not executed:** nothing in the publish/delivery tail — no social platform,
no email provider. Those nodes are documented, not exercised.

### Live n8n execution (2026-07-28)

Imported into **n8n 2.29.10** (self-hosted, Docker) with a Header Auth
credential holding a real Zvid API key, `dryRun: false`, and executed for
real. Every video below was downloaded from the CDN and reviewed frame by
frame at 2 fps.

- **Run**: green end to end. Rendered `12.57 s`, 1080x1920 @30 fps, AAC audio,
  **13 credits**.
- **Date matching proved itself live**: the tab held both a 2026-07-27 and a
  2026-07-28 row; the run picked today's and the board reads `TUE, JUL 28` —
  the row's own date, as designed.
- **The returned `videoUrl` is a valid URL.** Project names are slugged, so the
  CDN filename carries no spaces and the link can be pasted straight into a
  publish node or `curl` (verified: HTTP 200 on the raw URL).

**Scope of that evidence after the two changes above.** That run was executed
with `dryRun: false` — exactly the path the workflow now takes by default — so
everything in this section still describes the default behaviour, unchanged.
The `▶ Watch video` node was added *after* that run, so the node itself is
**not** covered by this live evidence: its contract (binary `file` response,
retries, `onError: continue`) and n8n's inline `video/*` rendering were
verified separately, but it was not present in the end-to-end execution
recorded here.
