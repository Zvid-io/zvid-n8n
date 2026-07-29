# Weekly KPI report video to Slack

[`zvid-kpi-report-video.json`](zvid-kpi-report-video.json)

Every Monday at 9am: take one week of KPIs (up to five metrics), turn them into
a narrated 1920×1080 stats video — branded title card, one scene per metric with
a green/red delta pill and a trend panel, then a summary grid — and drop the
finished video link into Slack. Dashboards go unopened; a forty-second video
gets watched. It runs with **zero external data**: leave `metricsUrl` empty and
a bundled demo dataset (an invented but realistic SaaS week) drives the video.

```
Schedule (Mon 9am) ─▶ Config ─▶ Fetch metrics (or bundled demo data) ─▶ Music guard
   ─▶ Narrate? ──true──▶ LLM script ─▶ ElevenLabs voice + timings ─▶ Upload ─▶ Build project
              └─false─────────────────────────────────────────────────────▶ Build project
   ─▶ Validate (free) ─▶ Render ─▶ poll ─▶ Slack? ─▶ Run summary ─▶ ▶ Watch video
                      └▶ (dryRun: true) draft + editorLink
```

## Why this one is different

**The data decides what green means.** Every metric carries a `lowerIsBetter`
flag, and the design respects it: churn going *down* renders a green ▼ pill;
infrastructure spend going *up* renders red ▲ — with a small "Lower is better
for this one." caption so nobody misreads the direction. Most stats-video
automations color by sign; this one colors by meaning.

**It never draws a chart it does not have data for.** The trend panel beside
each number has exactly two states. Give a metric a `series` array (past values,
oldest first) and it draws a **real sparkline of those numbers**, labelled
`TREND · LAST N PERIODS`. Leave `series` out and it draws a **single straight
arrow** — no gridlines, no area fill, no end-point dot — labelled
`DIRECTION ONLY`, because the only thing known is the sign of `delta`. Omit
`delta` as well and the panel disappears entirely and the number centres on the
card. Plenty of "KPI video" generators fill that space with a good-looking
squiggle; this one would rather show less than imply history that was never
supplied.

**It demos with zero external anything.** `metricsUrl` empty → a bundled demo
dataset (MRR, signups, active users, churn, NPS) renders, so your first video
needs nothing but the credentials. An *unreachable* endpoint also falls back to
demo data — a Monday report never silently skips — but an endpoint that answers
200 with JSON that does not match the contract **fails the run loudly** with the
expected shape echoed back, so real numbers can never be silently replaced by
demo numbers.

**The narration is optional, and word-accurate when on.** With `narrate: true`
an LLM writes a calm analyst voice-over (digits spelled out as words), ElevenLabs
speaks it **with timestamps**, and every scene cut lands exactly where its
sentence ends — karaoke captions ride the real word timings. The model's
closing sentence is also the line printed on the final summary card, so the
last frame says what the voice-over just said instead of a fixed slogan. With
`narrate: false` the whole voice branch is skipped (no OpenRouter, no
ElevenLabs, no captions): fixed scene lengths, a music bed, `summaryLine` from
`Config` on the closing card, and the on-screen numbers carry the video. Same
design either way — both paths were rendered and frame-reviewed on the
production engine.

**Numbers typeset like a designed report, not a caption.** Values auto-scale
(a 7-digit `$4,821,004` steps down from 184 px to 134 px), the panel and the
label column swap to a centred single column when a metric has no panel to
show, and the summary grid re-flows for 1–5 metrics (3+2 for five, 2×2 for
four, a single centred row for three or fewer). Every one of those five grid
branches was rendered on the production engine and checked; nothing clips,
including 22-character labels next to 7-digit values.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| OpenRouter key | Only while `narrate: true` — writes the voice-over script. Any OpenAI-compatible chat API works. |
| ElevenLabs key | Only while `narrate: true` — text-to-speech permission is enough. |
| Metrics endpoint | Optional — any URL returning the JSON contract below. Empty = bundled demo data. |
| Slack webhook | Optional — an Incoming Webhook URL for the delivery step. Empty = skipped. |

Set `narrate: false` and the workflow runs on a Zvid key alone.

## Setup

> **The first run spends credits — about 40** for the default narrated report
> (about 28 with `narrate: false`). If you would rather preview for free first,
> set `dryRun: true` in `Config` before running: that validates the payload,
> quotes the exact credit cost and saves a draft you can watch in the Zvid
> editor without spending anything. Set it back to `false` to render.

1. **Import** `zvid-kpi-report-video.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Upload voiceover*, *Validate project
   (free)*, *Save draft to editor*, *Submit render* and *Get render status*.
3. **OpenRouter credential** — attach it to *Write narration*. (Skip when
   `narrate: false`.)
4. **ElevenLabs credential** — add a SECOND **Header Auth** credential, name
   `xi-api-key`, value = your ElevenLabs key. Attach it to *Generate voiceover*.
   (Skip when `narrate: false`.) On a FREE ElevenLabs plan only default voices
   work — Brian (the default), George, Roger, Sarah and Bill are confirmed
   working; Voice Library voices return 402.
5. **Run "Test manually".** With `metricsUrl` empty the bundled demo dataset
   drives the video, so this works before any wiring. When it finishes, click
   **`▶ Watch video`** to play the report inside n8n.
6. **Point it at your numbers** — set `metricsUrl` to any endpoint returning the
   contract below, and paste a Slack **Incoming Webhook** URL into
   `slackWebhookUrl` to deliver into a channel.
7. **Activate.** It reports every Monday at 9am.

## Metrics JSON contract

`Fetch metrics` GETs `metricsUrl` and expects exactly this shape:

```json
{
  "period": "Jul 21–27",
  "company": "Acme",
  "metrics": [
    { "label": "MRR", "value": 48210, "unit": "$", "delta": 4.1, "lowerIsBetter": false,
      "series": [45990, 46311, 48210] }
  ]
}
```

- Up to **5 metrics**, one scene each (extras are ignored).
- `value` — number, or a preformatted string (`"3.2h"` renders as-is).
- `unit` — `"$"` (prefix), `"%"` (suffix), `""`, or a word (suffix with a space).
- `delta` — percent change vs the previous period. Omit it for no pill.
- `lowerIsBetter: true` flips the colors: a falling value renders green, a
  rising one red. Arrows always follow the sign; only the color changes.
- `series` — **optional** past values, oldest first, ending at `value` (two or
  more numbers, last 24 kept). Supply it and the metric scene draws a real
  sparkline of those numbers, labelled `TREND · LAST N PERIODS`. Omit it and
  the scene draws a single straight arrow labelled `DIRECTION ONLY` — its slope
  is nothing more than the sign of `delta`. Omit `delta` too and the panel
  disappears entirely. **The workflow never invents history**: there is no
  state where a squiggle on screen stands for numbers you did not send.
  A malformed `series` (non-numbers, a single point) fails the run loudly
  rather than being quietly dropped.
- If your endpoint needs auth, attach any n8n credential to *Fetch metrics*.

### Wiring real sources (documented, not built in)

- **GA4** — a `runReport` call through a service account (or the n8n Google
  Analytics node), reduced to this JSON in a small proxy or a Code node.
- **Stripe** — MRR/revenue from their reporting API, same reduction.
- Anything that serves JSON over HTTPS (Metabase, Retool, a serverless
  function over your warehouse) works as-is.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base. Leave it alone. |
| `editorUrl` | `https://editor.zvid.io` | Used to build the dry-run `editorLink`. |
| `metricsUrl` | `""` | Empty = bundled demo dataset. |
| `narrate` | `true` | `false` skips LLM + ElevenLabs entirely: music-only video, no captions. |
| `slackWebhookUrl` | `""` | Empty = Slack step skipped. |
| `brandName` | `Acme` | Fallback company name when the metrics JSON has none. |
| `reportKicker` / `reportTitle` | `WEEKLY KPI REPORT` / `The week in numbers.` | Title-card copy. |
| `summaryLine` | `Full breakdown in the dashboard.` | Closing line under the summary grid **on `narrate: false` runs only** — when narration is on, the LLM's own closing sentence is printed there instead. |
| `brandAccent` / `brandBackground` | `#38E1FF` / `#0B1220` | Accent + canvas. |
| `textColor` / `mutedColor` | `#FFFFFF` / `#9DB0CC` | Ink + secondary text. |
| `goodColor` / `badColor` | `#34D399` / `#FF6B78` | Improvement / setback pills and trend panels. |
| `font` | `Space Grotesk` | Any Google Font name. |
| `titleVideoUrl` | a pinned, verified stock clip | Background footage on the title card. `""` = clean gradient card, no video dependency. |
| `llmModel` | `openai/gpt-4.1-mini` | Any OpenRouter chat model. |
| `voiceId` / `voiceLabel` | `nPczCjzI2devNBz1zQrb` (Brian) | ElevenLabs voice. |
| `elevenModel` | `eleven_multilingual_v2` | |
| `voiceStability` / `voiceSimilarity` | `0.4` / `0.75` | |
| `captionAnimation` | `karaoke` | Accent-colored active word. |
| `captionWordsPerCue` / `captionSize` / `captionStrokeWidth` | `4` / `40` / `6` | Bottom captions, narrated runs only. |
| `sceneTransition` / `transitionSeconds` | `smoothleft` / `0.45` | The cut into the summary is always `smoothup`. `""` disables transitions. |
| `tailSeconds` | `0.6` | Breathing room after the last spoken word. |
| `musicUrl` | a pinned, verified bed | HEAD-checked before every render (reachability + size). |
| `musicVolume` / `musicVolumeSolo` | `0.12` / `0.26` | Bed volume with / without narration. |
| `maxMusicBytes` | `5242880` | Plan cap guard — an oversized bed is skipped, never fatal. |
| `resolution` / `frameRate` | `full-hd` / `30` | 1920×1080, Slack/email-native. |
| `dryRun` | `false` | `true` = free pass: validate, quote credits, save a draft + `editorLink`. No render, no Slack. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost per video

The live validator quoted **40 credits** for the default narrated report
(39.4 s), **28 credits** for the music-only 5-metric fixture (27.6 s) and
**21 credits** for a 3-metric report (20.4 s) — the cost tracks video length,
so fewer metrics and a shorter script cost less. *Validate project (free)* runs
before every render and
reports the exact figure as `creditsCharged` in the run summary. The narration
itself is cheap: the script costs well under a cent on a small model, and a
~110-word voice-over uses about 600 ElevenLabs characters.

## How it works

| Node | What it does |
| --- | --- |
| **Metrics source?** | Routes on `metricsUrl`: empty goes straight to *Prepare metrics* (demo data), set fetches your endpoint. |
| **Fetch metrics** | GET with `neverError` — HTTP failures are data, not crashes. |
| **Prepare metrics** | Normalises the response to the contract. Unreachable / HTTP error → bundled demo dataset with `usingDemoData: true`. A 200 that violates the contract → loud failure with the expected shape echoed back. |
| **Check music / Music guard** | HEAD-checks `musicUrl` (status + `content-length` vs `maxMusicBytes`). A bad bed means *no music*, never a failed render. Also builds the narration prompt — with the direction AND goodness of every delta resolved (`lowerIsBetter` is decided here, not by the LLM). |
| **Narrate?** | Routes on `narrate`. The false branch goes straight to the builder. |
| **Write narration** | OpenRouter, JSON mode: `{opening, perMetric[], closing}` — one sentence per metric, digits spelled out as words so captions align. |
| **Parse narration** | Normalises to ASCII, enforces exactly one sentence per metric, fails with a friendly message when the model under-delivers. |
| **Generate voiceover** | ElevenLabs `/with-timestamps` — the timings ARE the audio; nothing can drift. |
| **Voice + timings** | Groups character alignment into words, emits the mp3 binary. |
| **Upload voiceover** | Multipart upload to Zvid; returns the audio URL the render uses. |
| **Build project JSON** | The whole design lives here: adaptive value type (184→88 px), delta pills colored by `lowerIsBetter`, the three trend-panel states (real sparkline from `series` / direction-only arrow / no panel), the 1–5-metric summary grid, the closing line (LLM `closing` when narrating, else `summaryLine`), word-timed scene spans (or fixed lengths without narration), transition padding so cuts land on sentence ends. |
| **Validate project (free)** | The exact pipeline a render submission runs — schema, plan limits, cost — without spending credits. |
| **Dry run?** | `false` by default. `true` saves a free draft and reports `editorLink` instead of rendering. |
| **Submit render / Wait / Get render status / Still rendering?** | Paid render plus the poll loop; fails fast on `failed` and stops at `timeoutMinutes`. |
| **Slack configured?** / **Post to Slack** | Only when `slackWebhookUrl` is set. The message carries company, period, a `[demo data]` tag when applicable, and the video URL. `onError: continue` — a Slack hiccup never kills a finished render. |
| **Run summary** | One item: `videoUrl`, `jobId`, `creditsCharged`, `usingDemoData`, `narrated`, `musicNote`, Slack status. |
| **▶ Watch video** | Downloads the MP4 as binary so n8n plays it inline — click the node to watch the report. |

## Delivery (optional tail)

`slackWebhookUrl` is the built-in delivery: create an **Incoming Webhook** in
your Slack app (api.slack.com/messaging/webhooks) and paste the URL into
`Config`. Beyond that, extend after *Run summary*:

- **Email** — an SMTP/Gmail node sending `videoUrl` to the team list.
- **YouTube (unlisted)** — HTTP Request (GET `videoUrl`, response format
  *File*) → native **YouTube** node, for a permanent internal archive.
- **Notion / Confluence** — append the link to the weekly review page.

These stay out of the required path so the import runs with a Zvid key and
nothing else. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and
replace the render HTTP nodes with the native **Zvid** node + **Zvid Trigger**
(render webhook), which removes the poll loop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Run summary says `usingDemoData: true` | `metricsUrl` is empty, or the endpoint was unreachable / answered an HTTP error. The demo dataset keeps the Monday report alive; the reason is in *Prepare metrics* output as `demoReason`. |
| `The metrics JSON does not match the contract` | Your endpoint answered 200 with a different shape. The error echoes the exact expected JSON — adjust your mapping. This is deliberate: real-but-broken data must never be silently replaced with demo numbers. |
| `narrate is true but the voiceover chain produced no usable audio` | The OpenRouter or ElevenLabs credential is missing/invalid on *Write narration* / *Generate voiceover*. Fix the credentials, or set `narrate: false` for a music-only video. |
| ElevenLabs returns 402 | Free ElevenLabs plans can only use default voices — Voice Library voices are blocked. Keep Brian or another default voice. |
| `The model wrote N metric sentences for 5 metrics` | The LLM under-delivered. Run again, or set a stronger `llmModel`. |
| Video rendered without music | The HEAD guard skipped the bed (unreachable or over `maxMusicBytes`). The run summary's `musicNote` says exactly why. |
| Render fails on the title card | `titleVideoUrl` points at a dead clip. Restore the default pinned URL or set it to `""` for the gradient-only title card. |
| Nothing posted to Slack | `slackWebhookUrl` empty (step skipped), or the webhook was revoked — Slack answers 404 and the step continues; the summary still carries `videoUrl` with `slackConfigured` / `slackAttempted` flags. |
| `Zvid rejected the project` | The message lists the offending fields. If you edited the builder, note the API only allows letters, digits, spaces, `_` and `-` in `name`, and rejects `audios[].track`. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a week never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Verified

n8n **2.29.10** node types and versions (every node resolves in a stock
install; core nodes only). What was actually verified at authoring time:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the
  render farm runs) four times from the builder's real output:
  - the default fixture (39.4 s, narrated — demo dataset, 5 metrics with
    `series`, word-timed cuts from synthetic timings at a realistic
    2.8 words/sec, 28 karaoke caption cues, closing card carrying the script's
    own closing sentence);
  - a `narrate: false` stress fixture (27.6 s — five 7-digit values,
    22-character labels, a −12.4% red pill, green ▼ pills on `lowerIsBetter`
    metrics, a flat-delta neutral pill, a 26-character company name, and no
    `series` anywhere, so every panel is the `DIRECTION ONLY` arrow);
  - a 3-metric fixture (20.4 s) that exercises all three panel states in one
    video — real sparkline, direction arrow, and a metric with neither `delta`
    nor `series` (no pill, no panel, number centred);
  - a summary-grid coverage render (16.2 s) stitched from the builder's own
    output at 1, 2 and 4 metrics, so all five grid branches are on film.
  **Every extracted frame was looked at** — 229 frames (2 fps sweeps plus exact
  grabs at every transition midpoint and every final frame): all four complete
  frame sets on contact sheets, plus 22 frames at full review resolution
  covering every scene, every panel state, every grid branch and the
  transitions. No clipping, no overflow, no low-contrast text, correct
  green/red/flat semantics on every pill and panel.
- **Remote validation against the live API** (`POST /api/render/validate/api-key`
  via MCP with `remote: true`) on all three payload shapes: `valid: true`,
  **0 errors, 0 warnings**, schema **1.0.0**, `creditsRequired: 40` (narrated,
  39.39 s), **28** (music-only, 27.6 s) and **21** (3-metric, 20.4 s). The
  validated JSON was diffed against the rendered `config.json` to confirm it
  was the same payload. One lint round was caught and fixed this way (the
  layout checker reads `style.color`, not inline HTML colors).
- **Every pinned URL probed at authoring time** — the title-card clip
  (1920×1080, 13.2 s, 3.1 MB), the music bed (115.5 s, 3.7 MB — under the plan
  audio cap, and HEAD-guarded at runtime anyway).
- **The embedded code node is byte-identical** to the frame-reviewed standalone
  builder (asserted programmatically after generation), and every code node in
  the workflow compiles; all connections resolve; no credentials blocks ship in
  the file.

**Not executed at authoring time:** the OpenRouter and ElevenLabs calls (the
narration fixture used a hand-written script and synthetic word timings that
match it exactly — the timing machinery is the same shape proven live in the
faceless-shorts template), the Slack webhook post, and the n8n runtime itself.
