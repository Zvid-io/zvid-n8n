# We're hiring — a video for every job opening

[`zvid-were-hiring-video.json`](zvid-were-hiring-video.json)

Add a row to a Google Sheet, get back a polished 1080×1920 hiring video: hero
footage under a "WE'RE HIRING" kicker and the role title, a dark offer scene with
up to three perk cards and the salary, and an apply CTA. Vertical, so the same
file works on LinkedIn, Instagram, TikTok and Shorts. The finished URL is written
back into the sheet, so an opening is only ever rendered once.

```
Schedule/Manual ─▶ Config ─▶ Music guard ─▶ Read sheet (VideoUrl empty)
        ─▶ per row: Build project ─▶ Validate (free) ─▶ dry run? draft + editor link
                                                      └▶ Render ─▶ poll ─▶ write VideoUrl back
                                                                           └▶ ▶ Watch video
        ─▶ Run summary
```

## What changed

Two changes since the first release:

1. **It renders for real on the first run.** `dryRun` now defaults to `false`, so
   importing and running actually produces videos and spends credits. The dry run
   is still there as an opt-in: set `dryRun: true` in `Company Config` for a free
   validate + quote + draft pass. The on-canvas sticky notes (*Note overview*,
   *Note dry run*) were rewritten to match — the setup steps you read after import
   now say the first run spends credits and present the dry run as the opt-in.
2. **New `▶ Watch video` node at the end.** It downloads the finished MP4 as
   binary, and n8n plays it inline in the node's output panel — click the node,
   watch the video, no URL copying. It runs once per rendered opening.

## Why this one is different

**It looks designed, not templated.** The layout is adapted from Zvid's
`hr-were-hiring` / `hr-job-opening` library examples — hero video under a
gradient scrim and hairline frame, accent kicker pill, numbered perk cards, a
salary pill, a glow CTA with a circled check — not text slapped on a background.

**Type sizes adapt to the text.** Role titles step down through five font sizes,
so "Staff Site Reliability Engineer, Infrastructure & Developer Experience" fits
as cleanly as "Product Designer". The salary pill, perk cards and apply URL do
the same. No overflow, no clipping, regardless of what HR types into the sheet.

**The sheet is the state machine.** Only rows with an empty `VideoUrl` are
picked up, and the URL is written back on completion — so the schedule can run
daily without ever double-rendering, and clearing a cell is how you re-render.
`maxPerRun` caps each run so a freshly pasted backlog cannot burn the whole
credit balance at once.

**A music bed can never fail the render.** The configured track is `HEAD`-checked
before every run; if it is unreachable or over the plan's audio size cap, the
video renders without music instead of failing.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Google account | Reads the openings sheet and writes `VideoUrl` back (standard n8n Google Sheets credential). |

No stock-media accounts and no LLM key — the hero clip and music are plain URLs
in the config, and all copy comes from your sheet.

## Setup

> **The first run spends credits.** The workflow renders for real out of the box
> (`dryRun: false`), at roughly **12 credits per opening** and up to `maxPerRun`
> openings per run — so a default first run costs up to ~36 credits. If you would
> rather preview for free first, open `Company Config` and set `dryRun: true`
> before you run: that validates, quotes the credits and saves a draft you can
> watch in the editor without spending anything.

1. **Import** `zvid-were-hiring-video.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Validate render (free)*, *Save draft to
   editor*, *Submit render* and *Get render status*.
3. **Google Sheets credential** — attach it to *Read job openings* **and**
   *Write VideoUrl to sheet*, then pick your spreadsheet + tab in **both** nodes
   (they ship unselected).
4. **Create the sheet** with this header row (exact names):

   `Role | Team | Location | SalaryRange | Perk1 | Perk2 | Perk3 | ApplyUrl | VideoUrl`

   One opening per row; leave `VideoUrl` empty. `Role` and `ApplyUrl` are
   required, `Perk2`/`Perk3` may be blank (the cards adapt). `ApplyUrl` is
   *displayed* on the video, so a short address reads best.
5. **Open `Company Config`** and set `companyName`, `accentColor` and (optionally)
   `companyLogoUrl`. Everything else has a working default.
6. **Run *Test manually* once.** With the shipped default (`dryRun: false`) this
   renders for real: each open row is validated, rendered, and its finished URL is
   written into the sheet's `VideoUrl` column. Click **`▶ Watch video`** to play
   the result inside n8n.
7. **Activate the schedule** when you are happy with the look.

   *Optional free preview first:* set `dryRun: true` in `Company Config` and run.
   Nothing is charged — every open row is validated and saved as a free draft, and
   the run report gives each row an **`editorLink`**
   (`https://editor.zvid.io/?project=prj_...`) plus the exact credit quote. Set it
   back to `false` to render.

The workflow has both a **Test manually** trigger and a daily schedule, so you
can try it before activating it.

## Configuration

Everything lives in the `Company Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `companyName` | `Northwind` | Wordmark on every scene (uppercased). |
| `companyLogoUrl` | *(empty)* | Optional. An http(s) image URL replaces the wordmark (fitted into 360×110). |
| `kicker` | `WE'RE HIRING` | The accent pill above the role title. |
| `ctaHeadline` / `ctaText` | `Your next role is right here.` / `Apply now` | Closing scene copy. |
| `accentColor` / `backgroundColor` | `#FF6B57` / `#0E0F14` | Six-digit hex. The accent drives pills, card strokes and the CTA check; invalid values fall back to the defaults. |
| `font` | `Poppins` | Any Zvid-hosted font family. |
| `heroVideoUrl` | stock office clip | Scene-1 background. Swap in your own portrait brand footage by URL; set it empty for a flat branded background. |
| `musicUrl` / `musicVolume` | stock track / `0.16` | Set `musicUrl` empty for silence. |
| `maxMusicBytes` | `5242880` | Free-plan audio cap. Bigger/unreachable tracks are dropped, never fatal. |
| `maxPerRun` | `3` | Max openings rendered per run. |
| `resolution` / `frameRate` | `instagram-reel` / `30` | 1080×1920. |
| `dryRun` | `false` | Renders for real by default — credits are spent. Set it to `true` for a free pass that validates the payload, quotes the credits and saves a draft you can watch in the editor without spending anything. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost

One video is ~12 seconds of 1080×1920 and quoted at **12 credits** by the
production validator. The free `Validate render (free)` step still runs before
every render and still returns that exact quote per row — it is just no longer a
stopping point: the render proceeds automatically. Flip `dryRun` to `true` if you
want the quote *without* the render. A free account can render its first videos on
included credits.

## How it works

| Node | What it does |
| --- | --- |
| **Company Config** | Every knob in one Set node — no magic values buried in expressions. |
| **Check music track** | `HEAD`s the configured music once per run. The build step drops the bed if the track is unreachable or over `maxMusicBytes`. |
| **Read job openings** | Standard Google Sheets read; you pick the document and tab in the node. |
| **Rows to render** | Keeps rows with `Role` + `ApplyUrl` filled and `VideoUrl` empty, capped at `maxPerRun`. Missing trailing cells (an all-empty `VideoUrl` column) are treated as empty, not as a schema error. |
| **One row at a time** | Loop node — each opening flows through build → validate → render individually, and the per-row reports accumulate for the summary. |
| **Build project JSON** | The whole design lives here: three scenes, adaptive type sizing, perk cards drawn to match the number of perks, HTML-escaped sheet text, hex-validated colours. |
| **Validate render (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, layout lint — without spending credits. Failures surface as a field list. |
| **Dry run?** | Reads `dryRun` from the config. `false` (the default) takes the render branch; `true` takes the free draft branch. |
| **Save draft to editor** | **Only runs when `dryRun: true`.** Saves the project as a draft (free) and returns the editor link so you can watch and hand-tweak before spending. |
| **Dry-run row report** | **Only runs when `dryRun: true`.** One report item per row: the credit quote, the editor link, `videoUrl: null`. |
| **Submit render / Wait / Get render status** | The paid render plus a poll loop. This is the default path. |
| **Still rendering?** | Fails fast when the job reports `state: failed` and stops the loop at `timeoutMinutes`. |
| **Write VideoUrl to sheet** | Updates the row (matched by `row_number`) with the finished MP4 URL — this is what makes reruns idempotent. |
| **Rendered row report** | One report item per finished opening: `role`, `sheetRow`, `jobId`, credits charged and the finished `videoUrl`. Feeds the loop back and the watch node. |
| **▶ Watch video** | Downloads the finished MP4 into the item's `data` binary property. n8n's output panel plays `video/*` binaries inline, so clicking the node shows the video with a player and a download button — one item per rendered opening. It retries 3× (the CDN can 404 for a moment right after a render completes) and is set to continue on error, so watching a video can never fail a run that already rendered and already wrote its results back. |
| **Run summary** | One item per run: drafts/rendered counts, credits quoted/charged, per-row links. |

## Publishing tail

The sheet ends up holding a ready-to-post MP4 URL per opening. Two easy tails to
bolt onto *Rendered row report* (see the sticky note on the canvas):

- **LinkedIn node**: HTTP Request (response format *File*) to download
  `videoUrl`, then LinkedIn → Create Post with the binary and a caption built
  from `role` + the apply link. The `▶ Watch video` node already *is* that
  download step — wire the LinkedIn node straight after it and use its `data`
  binary property.
- **Blotato** or any cross-poster with an HTTP API: POST the `videoUrl` straight
  to its post endpoint — no download step — and fan out to LinkedIn, X, TikTok
  and Instagram at once.

Keep the first runs manual: post one, check it in the feed, then automate.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `The sheet has no "Role" column` | The header row does not match. Use the exact column names above. |
| Nothing happens on a run | No row has an empty `VideoUrl` (or `Role`/`ApplyUrl` is blank on the open rows). That is the idempotency working. |
| `Zvid rejected the project` | The message lists the offending fields — most often a plan limit or a malformed media URL pasted into the config. |
| `Render failed: ...` | The reason from the render engine, e.g. an unreachable `heroVideoUrl`. Failed renders refund automatically. |
| Video renders but no music | The music guard dropped the track — unreachable URL or bigger than `maxMusicBytes`. Point `musicUrl` at a smaller file. |
| Role title looks small | Very long titles step the type down so they fit. Shorten the `Role` cell if you want it bigger. |
| `VideoUrl` not written back | The Google credential is missing on *Write VideoUrl to sheet*, or the document/tab was only selected on the read node — both Sheets nodes need it. |
| Two runs rendered the same row | Both started before the first finished writing `VideoUrl`. Keep the schedule interval longer than a run (a render is ~1–3 min) or lower `maxPerRun`. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a day never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Verified

Zvid API schema **1.0.0**. All node types and versions are stock n8n core nodes
(`httpRequest` 4.2, `code` 2, `set` 3.4, `if` 2.2, `wait` 1.1, `googleSheets`
4.7, `splitInBatches` 3, triggers, sticky notes) — nothing to install, importable
on n8n Cloud.

**Rendered on the production engine, frames reviewed.** The exact payload the
"Build project JSON" node produces was rendered twice with Zvid's real renderer
(`@zvid-io/zvid`) and reviewed frame by frame at 2 fps plus exact-timestamp
grabs at every scene beat:

- **Default fixture** — Senior Backend Engineer / Platform / Remote (EU) /
  €85k–€110k / three short perks / `zvid.io/careers`: 11.9 s MP4, all three
  scenes clean, chips, cards, salary pill and CTA all correctly placed.
- **Stress fixture** — a 71-character role title, a 41-character team, an
  85-character perk, "Competitive + meaningful equity" and a 70-character apply
  URL: everything steps down and wraps inside its container; nothing clips or
  overflows.

**Validated against the production API.** The default payload passed
`POST /api/render/validate/api-key` (via the Zvid MCP validator, `remote: true`):
`valid: true`, **0 errors, 0 warnings**, `creditsRequired: 12`, duration 11.9 s,
schema 1.0.0. Both media URLs were `HEAD`-checked (hero clip 5.1 MB, music
3.7 MB — under the free plan's 5 MB audio cap).

The builder has a 25-check unit suite (both fixtures plus no-music, no-perks and
empty-role edge cases), and the workflow file passes a structural check: every
connection resolves, every code node compiles, node names unique, all four Zvid
HTTP nodes on Header Auth, core-only node types. (`▶ Watch video` is a fifth HTTP
Request node and deliberately carries no credential — it fetches the public CDN
URL the render already returned.)

**Not executed:** nothing in the publish/delivery tail — no social platform,
no email provider. Those nodes are documented, not exercised.

### Live n8n execution (2026-07-28)

Imported into **n8n 2.29.10** (self-hosted, Docker) with a Header Auth
credential holding a real Zvid API key, `dryRun: false`, and executed for
real. Every video below was downloaded from the CDN and reviewed frame by
frame at 2 fps.

- **Run**: green end to end. Rendered `11.90 s`, 1080x1920 @30 fps, AAC audio,
  **12 credits**.
- Frames match the sheet row exactly: role, team, location, the salary pill and
  all three perk cards, then the apply CTA.
- **Sheet round-trip**: `VideoUrl` written back to the opening's row, so the
  next run skips it.
- **The returned `videoUrl` is a valid URL.** Project names are slugged, so the
  CDN filename carries no spaces and the link can be pasted straight into a
  publish node or `curl` (verified: HTTP 200 on the raw URL).

**Scope of that evidence, honestly.** The run above was executed with
`dryRun: false` — i.e. exactly the path the workflow now takes by default, so the
evidence still describes the shipped behaviour. The `▶ Watch video` node was added
*after* that run and is therefore **not** covered by it: it passes the structural
check above, and its inline-player behaviour rests on n8n branching its output
panel on the binary mime type while the CDN serves these files as
`Content-Type: video/mp4` (both confirmed directly), but it has not itself been
exercised in a live end-to-end execution.
