# Month-in-review stats video per customer (Wrapped-style)

[`zvid-month-in-review-stats.json`](zvid-month-in-review-stats.json)

On the 1st of each month: fetch one customer's usage stats, turn them into a
~16 second 1080×1920 recap video — intro, four big stat beats with ▲/▼ delta
pills and a progress bar that fills as the recap plays, and a personal outro —
and render it with Zvid. Optionally email the finished link to the customer.

```
Schedule (monthly) ─▶ Config ─▶ Fetch metrics (or bundled demo data)
   ─▶ Build project ─▶ Validate (free) ─▶ Render ─▶ poll ─▶ Email? ─▶ Summary
                                       │                             └▶ ▶ Watch video
                                       └▶ (dryRun: true) draft + editorLink
```

## What changed

Two changes since the first release of this template:

1. **It renders for real on the first run.** `dryRun` now defaults to `false`, so
   importing and running spends credits (about **17** for this video). The dry run
   is still there as an opt-in escape hatch — set `dryRun: true` in `Config` to
   validate, quote the cost and save a free draft instead.
2. **New `▶ Watch video` node at the end.** It downloads the finished MP4 and n8n
   plays it inline. Click the node after a run and the video is right there — no
   copying URLs out of the summary JSON.

## Why this one is different

**It demos with zero external anything.** Leave `metricsUrl` empty and the
workflow runs on a bundled sample dataset (Maya / July 2026) — your first video
needs nothing but a Zvid API key. Point `metricsUrl` at your own endpoint when
you are ready, and note the safety rail: a *configured* endpoint that returns
junk **fails the run** instead of silently sending a real customer the demo
numbers.

**The design adapts to the data.** Stat values are typeset like a Wrapped
poster — `48` renders at 230 px, `9,999,999` steps down to 148 px, and a
sentence-length value like a top-video title drops to headline size and wraps.
Long names, two-line labels and missing deltas all keep their margins; nothing
clips.

**A free preview is one flag away.** The workflow renders for real by default,
but setting `dryRun: true` in `Config` validates the payload, quotes the exact
credit cost, saves a free draft and returns an `editorLink`
(`https://editor.zvid.io/?project=prj_…`) so you can watch the recap in the
editor before a single credit is spent.

**You watch the result inside n8n.** The run ends on a `▶ Watch video` node that
downloads the finished MP4; n8n renders `video/*` binaries as an inline player
with a download button, so the recap plays in the output panel.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Metrics endpoint | Optional — any URL returning the JSON contract below. Empty = bundled demo data. |
| SMTP credential | Optional — only for the email delivery step (`sendEmail: true`). |

## Setup

> **The first run spends credits — about 17.** This workflow renders for real out
> of the box. If you would rather preview for free first, open `Config` and set
> `dryRun: true` before you run it: that validates the payload, quotes the credit
> cost and saves a draft you can watch in the Zvid editor without spending
> anything. Set it back to `false` when you want the actual video.

1. **Import** `zvid-month-in-review-stats.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Validate project (free)*, *Save draft to
   editor*, *Submit render* and *Get render status*.
3. **Open `Config`** and set `brandName`, `ctaText` and your brand colours.
   Everything else has a working default.
4. **Run "Test manually"**. With `metricsUrl` empty the bundled demo dataset
   drives the video, so this works with nothing but the Zvid key. The render runs
   for real (~17 credits) and finishes in a couple of minutes — click
   **▶ Watch video** at the end of the canvas to play it inside n8n.
5. Point `metricsUrl` at your endpoint and (optionally) flip `sendEmail: true`
   with an SMTP credential on *Email the video*.
6. Activate the workflow for the monthly schedule (1st of the month, 09:00).

## Metrics endpoint contract

`Fetch metrics` GETs `metricsUrl` and expects **one customer per run**:

```json
{
  "userName": "Maya",
  "monthLabel": "July 2026",
  "highlight": "Your best month yet — July doubled your June output.",
  "stats": [
    { "label": "Videos rendered", "value": "48", "delta": "+12" },
    { "label": "Watch time",      "value": "3.2h", "delta": "+0.8h" },
    { "label": "Top video",       "value": "Product teaser v2" },
    { "label": "Credits used",    "value": "1,240" }
  ]
}
```

- Up to `maxStats` (4) stats are featured, one scene each.
- `delta` is optional. A leading `+` renders a ▲ pill, a leading `-` renders ▼;
  anything else is shown as-is. No delta = no pill.
- Stats may also be plain strings — `"Videos rendered: 48 (+12)"` is parsed into
  label/value/delta, so sheet-shaped sources work without a mapping step.
- An array response is accepted; the first entry is used. To fan out over every
  customer, call this workflow per customer from a parent workflow
  (Split In Batches + Execute Sub-workflow).
- `monthLabel` defaults to the previous calendar month (a recap that runs on the
  1st covers the month that just ended).
- If your endpoint needs auth, attach any n8n credential to *Fetch metrics*.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `metricsUrl` | `""` | Empty = bundled demo dataset. |
| `brandName` | `Relay` | Intro pill, outro sign-off, email signature. |
| `ctaText` | `See you next month` | The white pill on the outro. |
| `accent` / `accent2` | `#0E9F8E` / `#F26A4B` | Progress bar + outro gradient / label + delta pills. |
| `background` / `ink` / `muted` | `#F3F0EA` / `#1E241F` / `#6B6459` | Canvas, headline and secondary text colours. |
| `displayFont` / `labelFont` | `Outfit` / `Space Grotesk` | Display numbers vs. kickers and pills. |
| `introImage` | a soft-bokeh stock photo | Shown at 35 % opacity behind the intro. Empty string disables it. |
| `includeMusic` / `musicUrl` / `musicVolume` | `true` / a 1.5 MB stock track / `0.15` | The bundled track is small enough for every plan's audio cap. |
| `maxStats` | `4` | One scene per stat, in order. |
| `introSeconds` / `statSeconds` / `outroSeconds` | `3.4` / `2.8` / `4` | Defaults total ~16.4 s after transition overlap. |
| `transitionSeconds` | `0.45` | Slide/rise transitions between scenes. |
| `resolution` / `frameRate` | `instagram-reel` / `30` | 1080×1920. |
| `dryRun` | `false` | Renders for real by default. Set it to `true` for a free pass that validates the payload, quotes the credits and saves a draft you can watch in the editor without spending anything. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |
| `sendEmail` / `emailTo` / `emailFrom` / `emailSubject` | `false` / `""` / placeholder / auto | Email delivery. Empty subject auto-fills "Your July 2026 in review is ready". |

## Cost

The live validator quotes this exact payload at **17 Zvid credits** for the
~16 second 1080×1920 recap. *Validate project (free)* still runs before every
render and still returns that quote for your account — it is just no longer a
stopping point, so the render proceeds automatically. Set `dryRun: true` if you
want the quote without the render. Free accounts include enough credits to test.

## How it works

| Node | What it does |
| --- | --- |
| **Has metrics endpoint?** | Routes to *Fetch metrics* only when `metricsUrl` is set; otherwise falls straight through to the demo dataset. |
| **Fetch metrics** | Plain GET with a 30 s timeout and 3 retries. |
| **Normalize metrics** | Coerces object- or string-shaped stats, caps at `maxStats`, fills `monthLabel` with the previous month, and hard-fails if a *configured* endpoint returns nothing usable — demo data is only ever used when `metricsUrl` is empty. |
| **Build project JSON** | The whole design lives in this one code node: adaptive type sizes for values from `48` to `9,999,999` to sentence-length titles, ▲/▼ delta pills only when a delta exists, a progress bar that fills a little more with each beat, an outro gradient derived from your single `accent` colour, and every user string HTML-escaped. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, credit quote — without spending credits. Failures surface as a field list. Runs before *every* render, dry run or not. |
| **Dry run?** | Routes to the draft branch only when `dryRun: true`. Default `false`, so the normal path is straight to *Submit render*. |
| **Save draft to editor** | Dry-run branch only — runs only when `dryRun: true`. Saves a free draft and returns `editorLink`. Best-effort: a hiccup here never hides the dry-run report. |
| **Dry run summary** | Dry-run branch only — runs only when `dryRun: true`. Reports the credit quote, scene math and `editorLink`; nothing was charged. |
| **Submit render / Wait / Get render status** | The paid render plus a poll loop. |
| **Still rendering?** | Fails fast on a failed render and stops the loop at `timeoutMinutes`. |
| **Email the video** | Optional, behind `sendEmail`. Best-effort (`onError: continue`) so a mail hiccup never loses the finished `videoUrl`. |
| **Run summary** | `videoUrl`, `jobId`, credits charged, `emailedTo`, and whether demo data was used. |
| **▶ Watch video** | Downloads the finished MP4 into a binary field. n8n branches on the binary mime type and renders `video/*` inline, and the CDN serves these as `Content-Type: video/mp4` — so clicking the node shows the finished recap in a player with a download button. Retries 3× (the CDN can 404 for a moment right after a render completes) and is `onError: continue`, so watching a video can never fail a run that already succeeded and already delivered its results. |

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `metricsUrl returned no usable JSON object` | The endpoint answered with HTML, an error page, or a non-object. The workflow refuses to substitute demo data when an endpoint is configured. |
| `The metrics payload has no usable stats` | Every entry needs at least `label` + `value` (or a parseable `"Label: value"` string). |
| `Zvid rejected the project` | The error lists the offending fields — most often a plan limit. |
| Delta pill missing | That stat has no `delta`, which is by design; add one to show the pill. |
| Wrong month in the video | Your endpoint omitted `monthLabel`, so the previous calendar month was used. Send it explicitly to override. |
| Email never arrives but the run is green | The email step is best-effort. Check `emailedTo` in *Run summary* — `null` means the SMTP send failed or `sendEmail` is off; the node's own error output has the SMTP reason. |
| Render never finishes | The loop stops by itself at `timeoutMinutes` and reports the job id and last state. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a day never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Swapping pieces

- **Delivery** — replace *Email the video* with Slack, a webhook back into your
  product, or a CRM note. Everything before it stays identical.
- **Skip the polling loop** — on self-hosted n8n, install
  [`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid)
  and replace *Submit render* + *Wait* + *Get render status* with a **Zvid**
  node and a **Zvid Trigger** (render webhook). The HTTP nodes are deliberately
  core-only so the workflow also runs on n8n Cloud with nothing installed.

## Verified

The exact payload this workflow's builder produces was rendered **locally on the
production render engine** (the same `@zvid-io/zvid` package the cloud runs) for
two fixture sets, and every extracted frame was reviewed:

- **Default fixture** (Maya / July 2026, the bundled demo data): 16.35 s,
  33 frames reviewed — intro, all four stat beats, delta pills, bar fills,
  counters and outro all correct, no clipped or low-contrast text.
- **Stress fixture** (Alexandra-Konstantina / 7-digit values / 45-character
  labels / a sentence-length top-video title / a ▼ delta): 16.35 s, 33 frames
  reviewed — long labels wrap inside their margins, `9,999,999` fits at reduced
  size, the ▼ pill renders, and the two-line name outro stays clear of the CTA.

The default payload was also validated **against the live Zvid API**
(`POST /api/render/validate/api-key` via the schema validator): `valid: true`,
0 errors, 0 warnings, `creditsRequired: 17`, schema `1.0.0`. Both media URLs
(intro image, music bed) were HEAD-checked: HTTP 200, music is 1.5 MB.

The builder is unit-driven by the same fixtures (11 checks per fixture: scene
count, duration window, single-font rule, escape behaviour, no expiring URLs),
and the code node embedded in the workflow is byte-identical to the tested
builder. Structural checks confirm the workflow JSON parses, all connections
resolve, every code node compiles, and all four Zvid HTTP nodes use the Header
Auth credential.

**Not executed:** nothing in the publish/delivery tail — no social platform,
no email provider. Those nodes are documented, not exercised.

### Live n8n execution (2026-07-28)

Imported into **n8n 2.29.10** (self-hosted, Docker) with a Header Auth
credential holding a real Zvid API key, `dryRun: false`, and executed for
real. Every video below was downloaded from the CDN and reviewed frame by
frame at 2 fps.

- **Run**: green end to end. Rendered `16.37 s`, 1080x1920 @30 fps, AAC audio,
  **17 credits**.
- **The zero-dependency path was the one exercised**: `metricsUrl` was left
  empty, so the bundled demo dataset drove the video — which is exactly how a
  new installer first runs it. Frames show the stat beats and the wrap card
  with the right name and month.
- **The returned `videoUrl` is a valid URL.** Project names are slugged, so the
  CDN filename carries no spaces and the link can be pasted straight into a
  publish node or `curl` (verified: HTTP 200 on the raw URL).

**Scope of that evidence after the two changes above.** The run was executed with
`dryRun: false` — which is exactly the path the workflow now takes by default — so
everything above still describes the default behaviour and stands unchanged. The
`▶ Watch video` node, however, was added *after* that run, so it is **not** covered
by this live evidence: its node contract (binary `file` response, retries,
`onError: continue`) and n8n's inline `video/*` rendering were verified separately,
but the node has not been exercised in a full end-to-end execution of this
workflow.
