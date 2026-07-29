# Personalized welcome video for every trial signup

[`zvid-welcome-video-on-signup.json`](zvid-welcome-video-on-signup.json)

A new user starts a trial → your product POSTs their name, plan and company to
an n8n webhook → Zvid renders a 15-second branded welcome video (1920×1080,
made for the welcome email) → the webhook response returns `{ videoUrl,
editorLink }`. Optionally the workflow emails the video for you.

```
Webhook (or manual test) ─▶ Config ─▶ Build project ─▶ Validate (free) ─▶ Save draft
   ─▶ dry run? ── yes (opt-in) ─▶ Respond
               └── no (default) ─▶ Render ─▶ Poll ─▶ Render response ─┬─▶ Respond ─▶ (optional) Email
                                                                      └─▶ ▶ Watch video
```

## What changed

Two things, if you used an earlier copy of this workflow:

1. **It renders for real on the first run.** `dryRun` in `Config` now defaults
   to `false`, so the workflow goes all the way to a finished MP4 — and spends
   credits (about 15 per video, see [Cost](#cost)). The dry run is still there
   as an opt-in escape hatch: set `dryRun: true` in `Config` for a free pass
   that validates, quotes the credits and saves a draft.
2. **A new `▶ Watch video` node at the end plays the finished MP4 inside
   n8n.** Click it and the output panel shows a video player with a download
   button, instead of a JSON blob you have to copy a URL out of. It hangs off
   *Render response* on its own branch, so the webhook response is unchanged.

## What the video looks like

Three scenes, ~15 seconds, in your brand colours:

1. **Welcome** — your logo (or an auto-generated monogram tile), a plan chip
   (`Pro trial` → `PRO TRIAL` badge), and a personalised headline: *"Welcome,
   Maya."* with *"Your Flowdesk workspace for Northwind Labs is ready."*
2. **What to do first** — three onboarding cards with numbered accents,
   staggered in one by one.
3. **You're all set** — checkmark, *"You're all set, Maya."*, a CTA button and
   your support note.

Long values are handled: the headline auto-shrinks in steps (verified down to a
hyphenated 21-character first name and a 46-character company name), the plan
chip takes whatever your product sends, and every user string is HTML-escaped —
`Beaumont & Fitzgerald` renders as written, not as markup.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| SMTP (or Gmail) credential | **Optional** — only for the email step, which is off by default. |

Nothing else. The workflow is core-nodes-only (webhook, code, HTTP request, if,
wait, set, respond-to-webhook, send-email), so it imports and runs on n8n Cloud
with no community nodes installed.

## Setup

1. **Import** `zvid-welcome-video-on-signup.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name
   `x-api-key`, value = your Zvid key. Attach it to *Validate project (free)*,
   *Save draft to editor*, *Submit render* and *Get render status*.
3. **Open `Config`** and set your brand: `brandName`, `brandAccent`,
   `brandLogoUrl`, `ctaText`, `ctaUrl` and the three onboarding cards.
4. **Click Execute workflow.** The *Test manually* trigger feeds the *Sample
   signup* (Maya / Pro trial / Northwind Labs) through the exact same path the
   webhook uses.

   **This first run renders for real and spends credits — about 15 for the
   sample signup** (see [Cost](#cost)). That is the point: you get a finished
   MP4, and clicking the **`▶ Watch video`** node at the end plays it right
   there in n8n.

   Would rather preview for free? Set **`dryRun: true`** in `Config` before you
   run. The workflow then validates, prints the exact credit quote and saves a
   draft, and the output carries an **`editorLink`** that opens that draft in
   the Zvid editor — no credits charged. Set it back to `false` when you want
   the real thing.
5. **Hook up your product.** POST signups to the production webhook URL. No
   further switch to flip — with the default `dryRun: false`, every signup gets
   a rendered video.

## The webhook contract

```
POST https://<your-n8n>/webhook/welcome-video-on-signup
Content-Type: application/json

{
  "firstName": "Maya",           ← required
  "plan": "Pro trial",           ← optional (chip shows WELCOME ABOARD if empty)
  "company": "Northwind Labs",   ← optional
  "email": "maya@example.com"    ← optional, used only by the email step
}
```

Response (sent when the run finishes):

```
{ "videoUrl": "https://…/render.mp4", "editorLink": "https://editor.zvid.io/?project=prj_…",
  "dryRun": false, "creditsCharged": 15, "jobId": "…", … }
```

On an opt-in dry run (`dryRun: true`) `videoUrl` is `null` and
`creditsRequired` carries the quote.

**Timing:** the default path is a real render, which keeps the HTTP request
open for one to three minutes while the video renders — raise your caller's
timeout, or turn on `sendEmail` and treat the webhook as fire-and-forget. Dry
runs answer in a few seconds. Input is sanitised: names are whitespace-collapsed and
length-capped (40/48/90 chars) before they touch the layout, and a missing
`firstName` fails fast with a message showing the expected body.

## Configuration

Everything lives in the `Config` node. Copy knobs may embed `{firstName}`,
`{plan}`, `{company}` and `{brand}` — replaced with the signup's real values,
then HTML-escaped.

| Key | Default | Notes |
| --- | --- | --- |
| `brandName` | `Flowdesk` | Top-left lockup + copy. |
| `brandLogoUrl` | *(empty)* | URL of a square logo image. Empty = clean monogram tile generated from `brandName`. |
| `brandBackground` / `brandGlow` | `#0B1020` / `#1B2450` | Scene gradient (dark base + centre glow). |
| `brandAccent` | `#6C8CFF` | Chips, card borders, checkmark, CTA button. |
| `font` | `Outfit` | One family across the video. |
| `welcomeSub` | `Here's how to make week one count.` | Appended to the auto-composed "Your {brand} workspace for {company} is ready." line. |
| `cards` | 3 starter cards | The "what to do first" steps. Keep titles ≤ ~30 chars and details ≤ ~110 so nothing crowds the card. |
| `stepsFootnote` | `It all takes about two minutes, {firstName}.` | Personalised line under the cards. |
| `ctaHeadline` | `You're all set, {firstName}.` | |
| `ctaText` / `ctaUrl` | `Open your workspace` / `app.flowdesk.example` | Button + the small caption; replace with your real app URL. |
| `supportNote` | `Questions? Reply to any of our emails — a real human answers.` | |
| `musicUrl` / `musicVolume` | royalty-free bed / `0.15` | Set `musicUrl` to `""` for a silent video. |
| `sendEmail` | `false` | Email the result to the payload's `email` (skipped when absent). |
| `emailFrom` / `emailSubject` | `welcome@flowdesk.example` / `Welcome to {brand}, {firstName}!` | Email step only. |
| `dryRun` | `false` | Renders for real by default — every run produces a finished MP4 and spends credits. Set it to `true` for a free pass that validates the project, quotes the credits in `creditsRequired` and saves a draft you can watch in the editor via `editorLink`, without spending anything. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |
| `frameRate` | `30` | |

## Cost

A 15-second 1920×1080 welcome video is **15 Zvid credits** at the defaults
(that is the live validator's quote for the sample signup). The free
`validate/api-key` step still runs before every single render and still returns
the exact quote for your own copy in `creditsRequired` — the render now simply
proceeds automatically afterwards instead of stopping there. To see the quote
*without* rendering, set `dryRun: true`. Saving the draft and validating are
always free.

## How it works

| Node | What it does |
| --- | --- |
| **On new signup** | Webhook (POST, `responseMode: responseNode`) — the caller gets the final `{ videoUrl, editorLink }`. |
| **Test manually / Sample signup** | Manual trigger feeding a realistic fixture through the identical path, so you can test without curl. |
| **Signup data** | Accepts webhook (`body`) or manual (flat) input, trims, collapses whitespace, length-caps, and fails fast without `firstName`. |
| **Build project JSON** | Assembles the three-scene project: brand lockup (logo or monogram), plan chip, adaptive headline sizes for long names, three HTML cards (chrome and text in the same element, so nothing can drift apart), CTA scene, music bed. All user strings HTML-escaped. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, layout lint — without spending credits. Failures surface as a field list. |
| **Check validation** | Turns a non-200 into a readable error; carries `creditsRequired` and warnings forward. |
| **Save draft to editor** | Always runs (free), so even paid renders return an `editorLink` for hand-tweaking later. Best-effort: a hiccup here never blocks the response. |
| **Dry run?** | Reads `Config.dryRun`, which is **`false` by default** → submits the paid render. Only when you set it to `true` does the run take the free branch instead. |
| **Dry-run response** | The free branch's summary: quote + `editorLink`, `videoUrl: null`, nothing spent. **Runs only when `dryRun` is `true`** — the node stays in the workflow as the opt-in escape hatch. |
| **Submit render / Wait / Get render status** | Poll loop on `/api/jobs/{id}`. |
| **Still rendering?** | Fails fast on `state: failed` and stops the loop at `timeoutMinutes`. |
| **Render response** | The paid branch's summary: `videoUrl`, `editorLink`, `draftId`, `jobId`, `creditsCharged`. Fails loudly if a completed job somehow carries no output URL. |
| **Respond to signup** | Returns the final JSON to the webhook caller. Set to continue-on-error so manual test runs (no waiting HTTP caller) still finish green. |
| **Send email? / Send welcome email (SMTP)** | Off by default (`sendEmail: false`); skipped when the payload has no email. Core SMTP node — **on n8n Cloud swap it for the Gmail node**, everything upstream stays identical. |
| **▶ Watch video** | Click it to play the finished MP4 inside n8n. It downloads the CDN file as binary (`responseFormat: file`); n8n branches on the binary's mime type and renders `video/*` inline as a player with a download button, and the CDN serves these as `Content-Type: video/mp4`. It sits on its own branch off *Render response* — *Respond to signup* answers the caller first and its body is untouched — so a dry run never reaches it. `alwaysOutputData`, `onError: continueRegularOutput` and 3 retries 5 s apart mean watching a video can never fail a run that already succeeded (the CDN can 404 for a moment right after a render completes). |

## Swapping pieces

- **Email → Gmail/Outlook** — replace the *Send welcome email (SMTP)* node;
  the sticky note next to it walks through it. Or drop the email tail and pipe
  `videoUrl` into your existing email platform (Customer.io, Loops, HubSpot…)
  from the webhook response.
- **Native Zvid nodes** — on self-hosted n8n, install
  [`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid)
  and swap *Validate project (free)* → **Zvid → Render → Validate**,
  *Submit render* → **Zvid → Render → Create**, and *Get render status* +
  *Wait* → **Zvid Trigger** (render webhook). The HTTP nodes are deliberately
  core-only so the workflow also runs on n8n Cloud with nothing installed.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `The signup needs at least a firstName` | The POST body is missing/empty, or your product posts a different shape. The error message shows the expected body. |
| `Zvid rejected the project` | The message lists the offending fields — usually a plan limit or an edited Config value (e.g. a malformed colour). |
| Webhook caller times out | Real renders take 1–3 minutes and the response is only sent at the end. Raise the caller timeout, or use `sendEmail` / your own email platform and ignore the response. |
| `Render did not finish within N minutes` | Raise `timeoutMinutes`, or check the job in your dashboard at [app.zvid.io](https://app.zvid.io). |
| Headline looks small | A very long `firstName` triggered the auto-shrink (by design — nothing ever clips). Caps: first name 40 chars, plan 48, company 90. |
| Card text overflows its card | Custom card copy exceeded the guidance (titles ≤ ~30 chars, details ≤ ~110). Shorten it — card heights are fixed so the three stay aligned. |
| Email step red | The SMTP credential is missing/invalid, or you are on n8n Cloud — swap the node for Gmail as the sticky note describes. |
| No `editorLink` in the response | The draft save hiccuped (it is best-effort and retried 3×). The render itself is unaffected; re-run to get a link. |
| `▶ Watch video` shows an error instead of a player | The CDN can 404 for a moment right after a render completes; the node retries 3× at 5 s and is set to continue on error, so the run still finishes green either way. `videoUrl` on *Render response* is the source of truth — open it directly. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a day never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Verified

n8n schema check on **2026-07-27**, Zvid API schema **1.0.0**.

- **Rendered on the production engine** (`@zvid-io/zvid` CLI — the same
  renderer the cloud runs) for **both** fixtures: the default signup
  (Maya / Pro trial / Northwind Labs) and a stress signup
  (Alexandra-Konstantina / Enterprise pilot (annual) / Beaumont & Fitzgerald
  Industrial Holdings GmbH). Every extracted frame of both videos was reviewed:
  no clipped or overflowing text, the ampersand renders escaped-correctly, the
  long name auto-shrinks and stays on one line, cards align, transitions look
  intentional mid-frame.
- **Remote validation against the live API** (`POST
  /api/render/validate/api-key` via MCP, `remote: true`): `valid: true`,
  **0 errors, 0 layout warnings**, quote **15 credits**, schema `1.0.0`.
- **Structural checks** (re-run 2026-07-28 after the two changes below): workflow
  JSON parses; all 29 node names unique; every connection targets an existing
  node; all 7 code nodes compile; the embedded builder is behaviourally
  identical to the unit-tested builder module on both fixtures (byte-identical
  payloads); all four Zvid HTTP nodes use the Header Auth credential; no
  credentials embedded in the JSON; core-only node types.
- **On-canvas copy matches the shipped default.** The sticky notes you read
  after importing were re-checked against `Config`: none of them still presents
  `dryRun: true` as the default or tells you to flip a value that is already
  set. The setup sticky states up front that the first run renders for real and
  spends about 15 credits, and offers `dryRun: true` as the opt-in free preview
  — the same story this page tells.

**Scope of the evidence above, after the 2026-07-28 changes.** The live runs
below were executed with `dryRun: false` — exactly the path that is now the
default — so every claim here still holds unchanged for the default
configuration. The `▶ Watch video` node was added *after* those runs, so it is
**not** covered by that live evidence: it is structurally verified (contract,
wiring, reachability) and rests on separately verified facts (n8n renders
`video/*` binary inline; the CDN serves `Content-Type: video/mp4`), but it has
not itself been exercised in a live execution of this workflow.

**Not executed:** nothing in the publish/delivery tail — no social platform,
no email provider. Those nodes are documented, not exercised.

### Live n8n execution (2026-07-28)

Imported into **n8n 2.29.10** (self-hosted, Docker) with a Header Auth
credential holding a real Zvid API key, `dryRun: false`, and executed for
real. Every video below was downloaded from the CDN and reviewed frame by
frame at 2 fps.

- **Both triggers executed.** The manual path rendered `14.57 s`, 1920x1080
  @30 fps, AAC audio, **15 credits**.
- **The webhook was tested over real HTTP**: with the workflow active, a
  `POST /webhook/welcome-video-on-signup` with
  `{"firstName":"Priya","plan":"Team trial","company":"Halcyon Data"}` answered
  **HTTP 200** with the finished job in the body — `videoUrl`, `editorLink`,
  `draftId`, `jobId`, `creditsCharged: 15`, `videoSeconds: 14.55`. Frames
  confirmed the personalisation ("It all takes about two minutes, Priya.").
- **The returned `videoUrl` is a valid URL.** Project names are slugged, so the
  CDN filename carries no spaces and the link can be pasted straight into a
  publish node or `curl` (verified: HTTP 200 on the raw URL).
