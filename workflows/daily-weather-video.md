# Daily local weather video — zero API keys

[`zvid-daily-weather-video.json`](zvid-daily-weather-video.json)

Every morning at 06:30: fetch your city's forecast from a keyless public API,
design a 1080×1920 weather bulletin around it — the colour palette follows the
sky — and render it with Zvid. **One credential total: your Zvid API key.**

```
Schedule 06:30 ─▶ Config ─▶ Find city ─▶ Get forecast ─▶ Weather look (palette)
   ─▶ Build project ─▶ Validate (free) ─▶ Check validation ─▶ Dry run?
        ├─ false (default) ─▶ Submit render ─▶ Poll ─▶ Run summary ─▶ ▶ Watch video
        └─ true ────────────▶ Save draft ─▶ Dry run summary (editorLink, no render)
```

## What changed

Two things, if you used an earlier copy of this template:

1. **It renders on the first run.** `dryRun` now defaults to `false`, so
   importing it and hitting *Test manually* produces a real video and spends
   credits (~12 — see [Cost](#cost)). The dry-run branch is untouched and still
   there as an opt-in: set `dryRun: true` in `Config` for a free pass.
2. **New `▶ Watch video` node at the end.** It downloads the finished MP4 and
   n8n plays it inline in the node's output panel, with a download button. No
   copying URLs out of a JSON blob to see what you made.

## Why this one is different

**Zero API keys for the data.** Both weather calls are keyless public
endpoints — the geocoder turns `cityName` into coordinates, the forecast call
returns current conditions plus a 4-day outlook in one request. Nothing to sign
up for, no quota to babysit. (Open-Meteo is free for non-commercial use and
appreciates attribution; one call a day is well inside that.)

**The look follows the sky.** A code node maps the WMO weather code to a
condition label, a line-drawn icon and a palette — warm amber for clear skies,
slate for clouds and fog, deep blue for rain, ice blue for snow, electric
violet for thunderstorms. The entire video recolors from that palette:
background gradient, glow, stat chips, card strokes. A stormy Tuesday genuinely
looks different from a sunny Monday, and each outlook card keeps its own day's
accent colour.

**It speaks your language.** `locale` drives the date line and weekday names
(any language, via `Intl`), and picks the UI strings and condition labels —
English and Spanish ship in the box; adding a language is one table edit in the
*Weather look* node. `es-MX` gives you "Lunes, 27 de julio", "Tormenta
eléctrica", "MÁX 19° / MÍN 12°", "PRÓXIMOS 3 DÍAS".

**Watch it without leaving n8n.** The run ends on a `▶ Watch video` node that
pulls the finished MP4 back and plays it inline in n8n's output panel — click
the node, watch the bulletin. *Run summary* right before it still hands
`videoUrl` and `caption` to whatever you chain on.

**A free pass when you want one.** Set `dryRun: true` in `Config` and the
workflow stops after validation: exact credit price, the palette it chose, the
caption, and an `editorLink` that opens the draft in the Zvid editor — all
without spending a credit.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Weather data | Nothing — Open-Meteo's geocoding and forecast endpoints are keyless. |

## Setup

**Heads up: the first run renders for real and spends credits** — about **12**
for the default configuration ([Cost](#cost)). If you would rather preview for
free first, set `dryRun: true` in `Config` before step 4; it validates, quotes
the credits and saves a draft you can watch in the editor without spending
anything.

1. **Import** `zvid-daily-weather-video.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name
   `x-api-key`, value = your Zvid key. Attach it to *Validate project (free)*,
   *Save draft to editor*, *Submit render* and *Get render status*.
3. **Open `Config`** and set `cityName`, `brandName`, `handle`, `locale`.
4. **Run "Test manually"**. It geocodes, fetches the forecast, validates, then
   renders. When it finishes, click **▶ Watch video** to play the result inside
   n8n; *Run summary* holds `videoUrl`, the credit count, the palette it chose
   and a ready-made social caption.
5. **Activate the workflow.** The schedule fires at 06:30 in your n8n
   instance's timezone.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `cityName` | `Lisbon` | Any city. The geocoder matches local spellings too ("Lisboa", "München", "Ciudad de México"). |
| `locale` | `en-US` | Date + weekday language (any locale), and picks `en`/`es` UI strings and condition labels. |
| `units` / `windUnit` | `celsius` / `kmh` | Set `fahrenheit` / `mph` for US-style output — the on-screen unit labels follow the API response automatically. |
| `brandName` / `handle` | `SUNRISE WEATHER` / `@sunriseweather` | Header kicker and footer watermark. |
| `heroSeconds` / `outlookSeconds` | `6.4` / `5.8` | Scene lengths; ~11.7 s total with the transition. |
| `transitionSeconds` | `0.5` | The smooth slide between the two scenes. |
| `musicUrl` / `musicVolume` | a light stock bed / `0.14` | Set `musicUrl` to `""` for a silent video, or point it at any reachable MP3. |
| `resolution` / `frameRate` | `instagram-reel` / `30` | 1080×1920. |
| `dryRun` | `false` | Renders for real by default. Set it to `true` for a free pass: the workflow validates the payload, quotes the credits it *would* cost, and saves a draft you can watch in the Zvid editor — without spending anything. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost

The production validator quotes **12 credits** for the default ~11.7 s
1080×1920 video. That free *Validate project (free)* call still runs before
every render and still returns the exact number for your configuration — it is
reported as `creditsCharged` in *Run summary* — but the render now proceeds
automatically from there. Set `dryRun: true` if you want the quote *instead of*
the render. The weather data costs nothing.

## How it works

| Node | What it does |
| --- | --- |
| **Find city** | Keyless geocoding call; `language` follows `locale`, best match wins. |
| **Check city** | Fails fast with a human message when the geocoder misses, instead of a downstream expression error. Extracts name/country/lat/lon. |
| **Get forecast** | One keyless call: current temperature, feels-like, humidity, wind, weather code, plus 4 daily entries (today + 3) of hi/lo, precipitation probability and weather code, in your configured units. |
| **Weather look** | WMO code → condition label + icon + palette (5 looks). Localized strings, weekday names via `Intl`, per-day accents for the outlook cards. This node is the one to edit for extra languages. |
| **Build project JSON** | Assembles the two scenes: hero (brand, city, date, giant current temp, condition, feels-like, hi/lo + rain + wind chips) and 3-day outlook (cards with icon, weekday, precip %, hi/lo). All scenery is inline SVG driven by the palette; staggered text entrances; music bed if configured. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, credit quote — without spending credits. Failures surface as a field list. |
| **Dry run?** | Reads `dryRun` from `Config`. `false` (the default) → render. `true` → the two nodes below instead, and no render. |
| **Save draft to editor** | Only runs when `dryRun: true`. Saves the project as a draft (free) and returns `editorLink` at [editor.zvid.io](https://editor.zvid.io). Best-effort: a hiccup here never hides the dry-run report. |
| **Dry run summary** | Only runs when `dryRun: true`. The free report: `creditsRequired`, `editorLink`, palette, caption, warnings — and no video. |
| **Still rendering?** | Fails fast on a failed render and stops the poll loop at `timeoutMinutes`. |
| **Run summary** | `videoUrl`, `caption` (ready for socials, in your configured language), `city`, `condition`, `look`, `videoSeconds`, `creditsCharged`. |
| **▶ Watch video** | Downloads the finished MP4 into a binary field. n8n branches its output panel on the binary's mime type and renders `video/*` inline with a player and a download button, and Zvid's CDN serves these as `Content-Type: video/mp4` — so clicking the node just plays the video. Retries 3× (the CDN can 404 for a moment right after a render completes) and is set to continue on error, so watching a video can never fail a run that already succeeded. |

## Posting it somewhere

*Run summary* deliberately ends the workflow's real work at a rendered,
captioned video (`▶ Watch video` after it is just the inline player). Chain
your own tail off *Run summary*: a YouTube upload node, Instagram/TikTok
through your scheduler of choice, a Slack or Discord message, or an Email Send
with the link. `caption` is pre-written from the day's data
(`Lisbon today: Clear sky · 25°C · H 31° / L 19° · RAIN 5% #Lisbon #weather`).

On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid)
and replace *Submit render* + *Wait* + *Get render status* with a **Zvid** node
and a **Zvid Trigger** (render webhook) — that removes the polling loop. The
HTTP nodes are deliberately core-only so the workflow also runs on n8n Cloud
with nothing installed.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Open-Meteo could not find "…"` | Geocoder miss. Try the local spelling or more of the name. |
| It found a namesake city instead of yours | `Find city` takes the most relevant match. Raise `count` there and pick your match by `country`/`admin1` in *Check city*. |
| `Zvid rejected the project (HTTP 401/403)` | The Header Auth credential is missing on one of the four Zvid nodes, or its name is not exactly `x-api-key`. |
| `Zvid rejected the project` with a field list | Payload bug — the listed fields say what to fix. |
| `Render failed: …` | The message carries the engine's reason. If it names the audio asset, your custom `musicUrl` is unreachable or too large — set it back to the default or to `""`. |
| `Render did not finish within 20 minutes` | The poll loop gave up. Check the job in the dashboard at [app.zvid.io](https://app.zvid.io) and your credit balance. |
| Dates or weekdays in the wrong language | Set `locale` (e.g. `es-MX`, `de-DE`). Weekdays follow it in any language; UI strings and condition labels currently ship in `en`/`es` — other locales fall back to English strings until you add a table entry. |
| Wrong temperatures | You are probably looking at °F output with `units: "celsius"` expectations, or vice versa. The chips label themselves from the API's own unit strings. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a day never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |
| **▶ Watch video** shows an error instead of a player | It retries 3× and then continues rather than failing the run, so the render itself is fine and already paid for — open `videoUrl` from *Run summary* in a browser. |

## Verified

What was actually executed for this template, and what was not:

- **Local renders on the production engine** (the same `@zvid-io/zvid` package
  the render farm runs), for two captured fixtures: sunny Lisbon (`en-US`) and
  thunderstorm Ciudad de México (`es-MX`, long weekday labels as a layout
  stress). Every extracted frame of both videos was reviewed: no clipped or
  overflowing text at any entrance, transition or hold; both palettes verified
  end-to-end (amber vs violet); Spanish strings and weekday names correct;
  per-day card accents correct.
- **Fixtures use the real API shape.** Both Open-Meteo endpoints were fetched
  live on 2026-07-27 and the captured response shapes were kept intact; only
  the weather values were set to the two scripted conditions.
- **Remote validation against production**: the default payload was submitted
  to the live `/api/render/validate/api-key` validator — result
  `valid: true`, `creditsRequired: 12`, `warnings: []`, schema `1.0.0`.
- **Embedded code equivalence**: the two big code nodes are generated from the
  same source that produced the reviewed renders, and a simulator runs the
  actual node bodies (fake `$`/`$input`) for both fixtures and asserts the
  output payload is byte-identical to the reviewed one.
- **Structural checks**: JSON parses, all connections resolve, all code nodes
  compile, node names unique, all four Zvid HTTP nodes use the Header Auth
  credential. Node types and versions are copied unchanged from the Day 1
  workflow, which imports cleanly on n8n Cloud.

**Not executed:** nothing in the publish/delivery tail — no social platform,
no email provider. Those nodes are documented, not exercised.

### Live n8n execution (2026-07-28)

Imported into **n8n 2.29.10** (self-hosted, Docker) with a Header Auth
credential holding a real Zvid API key, `dryRun: false`, and executed for
real. Every video below was downloaded from the CDN and reviewed frame by
frame at 2 fps.

- **Run**: green end to end on **live Open-Meteo data, no API key of any kind**.
  Rendered `11.70 s`, 1080x1920 @30 fps, AAC audio, **12 credits**, in 22
  seconds wall-clock from trigger to finished MP4.
- **The video matches the API response it was built from**, field for field:
  Lisbon, "Tuesday, July 28", 21 degrees, "Clear sky", feels-like 22, H 33 /
  L 20, rain 0 %, wind 4 km/h, and a three-day outlook of 30/19, 29/19, 29/19.
  The sunny palette was the one selected for a clear-sky code.
- **The returned `videoUrl` is a valid URL.** Project names are slugged, so the
  CDN filename carries no spaces and the link can be pasted straight into a
  publish node or `curl` (verified: HTTP 200 on the raw URL).

**Scope of that evidence after the two changes above.** That run was executed
with `dryRun: false` — exactly the path the workflow now takes by default — so
everything above still describes the default behaviour, unchanged. The
`▶ Watch video` node was added *after* that run, so the node itself is not
covered by this live evidence: its contract (binary `video/*` → n8n's inline
player, `Content-Type: video/mp4` from the CDN) was verified directly, but it
was not present in the end-to-end execution recorded here.
