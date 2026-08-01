# Webinar / demo no-show → personal re-book video

[`zvid-no-show-reengagement.json`](zvid-no-show-reengagement.json)

Somebody booked a session and did not turn up. This workflow turns that into a
warm ~16-second vertical video (1080×1920, made for a phone) that opens with
"We missed you, {firstName}", recaps what the session actually covered with the
presenter's face on screen, and ends on a friendly "grab another slot" card —
then optionally emails it to them and marks the row done. Two ways in, one
pipeline: a Google Sheet you top up by hand, or a webhook your CRM posts to.

```
Schedule / Webhook ─▶ Config ─▶ Music guard ─▶ Source? ─▶ Pick next no-show
        ─▶ Build project ─▶ Validate (free) ─▶ Render ─▶ Email (optional)
        ─▶ Mark row sent ─▶ Run summary ─▶ ▶ Watch video
```

## Why this one is different

**It does not guilt-trip.** Most no-show follow-ups open with "you missed it".
This one opens with "We missed you", says "no stress", and closes on "there is
nothing to catch up on". The whole layout is built around that tone: warm paper
background, a serif headline, a soft brand chip — proposal-grade calm rather
than a flashing reminder. That is the part that actually gets the re-book.

**Frame 0 is already a finished title card.** The brand chip, kicker and
headline carry no enter animation on purpose, because an email client shows the
first frame as the poster before anyone presses play. A video that starts on an
empty page looks broken in an inbox; this one reads as a designed card at 0 s.

**Type scales with the content, in both directions.** A 2-character first name
sets the hook at 96 px; a 23-character hyphenated name steps down to 70 px and
re-wraps. A 63-character event title shrinks from 46 px to 35 px inside its
card, the highlight cards ramp 34 → 24 px as the lines get longer, and any
single word too wide for its box shrinks the whole line instead of running off
the edge. Verified frame-by-frame on the production renderer at both extremes.

**Nothing runs away with your credits, and nothing missing looks missing.** In
webhook mode the 15-minute schedule deliberately renders *nothing*: only a real
POST — or a hand-started *Execute workflow* — reaches the render chain, so an
activated workflow can never turn the bundled sample into an unattended render
loop. The same instinct runs through the design: no presenter photo → a
monogram circle built from the presenter's name; no music, or a music URL that
404s or exceeds the plan's audio cap → the video renders silent instead of
failing the run; no presenter role → the footnote moves up and the card
re-centres. Every one of those visual branches was rendered and reviewed, not
assumed.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Google account | For the two Google Sheets nodes (read the queue, write back the result) — sheet path only. |
| SMTP (optional) | Only if you turn `sendEmail` on. On n8n Cloud, swap the Send Email node for Gmail or Outlook. |

No LLM, no voice service, no stock-media account. The webhook path needs no
Google account at all.

## Setup

1. **Import** `zvid-no-show-reengagement.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Validate project (free)*, *Save draft to
   editor*, *Submit render* and *Get render status*.
3. **Google Sheets credential** — attach it to *Read no-shows sheet* and *Mark
   row sent*, and pick your spreadsheet + tab in both nodes.
4. **Create the sheet** with this exact header row:

   | FirstName | Email | EventName | OriginalTime | RebookUrl | Status | VideoUrl |
   | --- | --- | --- | --- | --- | --- | --- |

   `FirstName` and `EventName` are required; everything else is optional.
   `OriginalTime` accepts an ISO timestamp (`2026-08-13T18:00:00Z`), which is
   formatted using `timeZone` from Config: with the shipped default
   (`"UTC"`) that reads "Thu, Aug 13 · 6:00 PM UTC", and with
   `timeZone: "America/New_York"` the same input reads "Thu, Aug 13 · 2:00 PM
   EDT". Anything else, including a hand-typed "last Tuesday afternoon", is
   printed exactly as you wrote it. Leave `Status` and `VideoUrl` empty.
   Blank spacer rows are skipped, so a formatted sheet with trailing empty rows
   never blocks the queue.
5. **Open `Config`** — set `brandName`, `presenterName`, `presenterRole`,
   `rebookUrl` and the three `highlights` lines. Everything else has a sensible
   default.
6. **Run it.** The workflow renders for real out of the box, so **the first run
   spends credits — about 16** for a default-length video. When it finishes,
   click **`▶ Watch video`** to play the result inside n8n.

   Prefer to preview for free first? Set `dryRun: true` in `Config` before that
   first run: you get the exact credit cost and an **`editorLink`** that opens
   the draft in the Zvid editor, with nothing spent, nothing written to the
   sheet and no email sent.
7. **Activate.** With `source: "sheet"` (the default) the schedule polls the
   sheet every 15 minutes. With `source: "webhook"` the schedule stays idle by
   design — it ends on *Nothing to send* instead of rendering the sample on a
   timer — so point your no-show automation at the production webhook URL
   instead. Either way, an activated workflow only renders when there is a real
   person to render for.

### Webhook path (no sheet)

Set `source: "webhook"` in Config and POST JSON to the workflow's webhook URL
(path `no-show`):

```json
{
  "inviteeFirstName": "Sarah",
  "inviteeEmail": "sarah@acme.example",
  "eventName": "Scaling Content Ops",
  "originalTime": "2026-08-13T18:00:00Z",
  "rebookUrl": "https://calendly.com/you/30min"
}
```

Only `inviteeFirstName` is required. Calendly's own spellings (`name`, `email`,
`reschedule_url`, `scheduled_event.name`, `scheduled_event.start_time`) are
accepted too, so a forwarded Calendly invitee record needs no field mapping.
*Respond ok* answers the caller with `{ videoUrl, jobId, creditsCharged, … }`
when the run finishes — which means the HTTP request stays open for one to three
minutes while the video renders. Raise your caller's timeout, or turn on
`sendEmail` and treat the webhook as fire-and-forget.

Executing the workflow by hand always works: with no webhook body, Config's
`samplePayload` is used instead, so *Execute workflow* always produces a real
video.

**Which trigger fired decides what runs.** The sample fallback is reserved for
hand-started runs: a *scheduled* run in webhook mode has nothing posted to it,
so it ends on *Nothing to send* rather than rendering (and charging for) the
sample every 15 minutes. The mirror case is handled too — a POST that arrives
while `source` is still `sheet` is answered with a message telling you to flip
`source`, instead of returning an unrelated sheet row's video to the caller.
*Respond ok* answers the caller on that branch as well, so a POST is never left
hanging.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base URL. |
| `editorUrl` | `https://editor.zvid.io` | Used to build the dry-run `editorLink`. |
| `source` | `sheet` | `sheet` reads the Google Sheet on a schedule; `webhook` renders only what is POSTed (the schedule then intentionally does nothing). |
| `brandName` | `Flowdesk` | Brand chip on scene 1 and the `{brand}` token. |
| `presenterName` | `Dana Whitfield` | Name under the avatar, and the `{presenter}` token. |
| `presenterRole` | `Head of Growth, Flowdesk` | Small line under the name. Empty = the line is dropped and the layout re-centres. |
| `presenterImageUrl` | `""` | A **square** https photo (480×480 is ideal). Empty = a monogram circle built from `presenterName`. |
| `paperColor` / `inkColor` / `mutedColor` | `#FBF3EC` / `#241C15` / `#786557` | Warm paper, near-black ink, muted secondary text. |
| `brandAccent` | `#B0472A` | Chips, card borders, the CTA pill and the CTA scene glow. |
| `headingFont` / `bodyFont` | `Fraunces` / `Manrope` | Serif carries the three headlines; sans carries everything else. One font per text element. |
| `kickerText` | `A note from {presenter}` | Small caps line above the hook. |
| `hookLine` | `We missed you, {firstName}.` | Scene 1 headline. Steps down from 96 px as it grows. |
| `hookSub` | `{eventName} ran on {originalTime}. No stress — …` | Scene 1 sub-line. Cut on a whole word at 168 characters. |
| `sessionLabel` | `The session you booked` | Label inside the scene-1 event card. |
| `highlightsTitle` | `Here's what we covered` | Scene 2 headline. |
| `highlights` | 3 lines | The two or three things the session covered. Keep them under ~90 characters each; the cards resize and the scene lengthens to suit. |
| `highlightsFootnote` | `Same session, new time — there is nothing to catch up on.` | Closing line of scene 2. |
| `ctaHeadline` | `Ready when you are, {firstName}.` | Scene 3 headline. |
| `ctaSub` | `Pick a time that actually works for you — …` | Scene 3 sub-line. |
| `ctaText` | `Grab another slot` | Text inside the CTA pill. |
| `signOff` | `{presenter} · {brand}` | Sign-off under the divider. |
| `rebookUrl` | `https://calendly.com/your-team/30min` | Fallback booking link when the row/webhook has none. Shown as a bare domain (plus the path when short enough). |
| `timeZone` | `UTC` | IANA zone used to format an ISO `OriginalTime`. An unknown zone falls back to UTC rather than failing. |
| `musicUrl` | a pinned mp3 | Soft bed. Set to `""` for a silent video. |
| `musicVolume` | `0.14` | The bed sits low by design. |
| `maxMusicBytes` | `5242880` | HEAD guard: anything larger (or unreachable) renders without music instead of failing. |
| `frameRate` | `30` | Output frame rate. |
| `statusDoneValue` | `sent` | What gets written to `Status` after a successful render. |
| `sendEmail` | `false` | `true` mails the person their own video through *Send re-book email (SMTP)*. |
| `emailFrom` | `hello@yourcompany.example` | From address for that email. |
| `emailSubject` | `We missed you at {eventName}, {firstName}` | Subject template. |
| `emailBody` | HTML template | Body template. May use `{firstName}`, `{eventName}`, `{presenter}`, `{brand}`, `{videoUrl}`, `{rebookUrl}`. Values are HTML-escaped after substitution. |
| `samplePayload` | a sample no-show | Used **only** when the workflow is executed by hand and the webhook node has not run. A scheduled run never falls back to it. |
| `dryRun` | `false` | `false` (default) renders for real. `true` validates, quotes the credits and saves a draft you can watch in the editor — no credits, no sheet write, no email. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

Copy knobs (`kickerText`, `hookLine`, `hookSub`, `sessionLabel`,
`highlightsTitle`, `highlightsFootnote`, `ctaHeadline`, `ctaSub`, `ctaText`,
`signOff`, `emailSubject`, `emailBody`) may embed `{firstName}`, `{eventName}`,
`{originalTime}`, `{presenter}` and `{brand}`. Substitution happens first and
escaping second, so a name containing `&` can never break the render.

## Cost per video

The live validator quoted **16 credits** for the default ~15.7 s video, **16**
for the 15.9 s long-copy stress case, and **14** for a shorter 14.0 s two-
highlight version. *Validate project (free)* still runs before every render and
returns the exact quote for your content — reported as `creditsCharged` in the
run summary — but the render then proceeds automatically. Set `dryRun: true` if
you want the number *without* the render.

## How it works

| Node | What it does |
| --- | --- |
| **Test manually / Every 15 minutes / No-show webhook** | Three ways in, all feeding the same `Config`. |
| **Check music / Music guard** | HEADs the music URL. Unreachable, HTTP ≥ 400 or over `maxMusicBytes` → the video renders **without** music instead of failing the run. |
| **Source?** | Routes on `Config.source`: `webhook` reads the POST body, anything else reads the sheet. |
| **Webhook payload** | Normalises one posted no-show. Accepts both plain (`inviteeFirstName`, `eventName`, `originalTime`, `rebookUrl`) and Calendly spellings. **Checks which trigger fired:** a real POST is rendered, a hand-started run falls back to `Config.samplePayload` (so *Execute workflow* always produces a real video), and a *scheduled* run returns "nothing to send" instead of rendering the sample on a loop. Missing first name fails loudly with the expected shape. |
| **Read no-shows sheet / Pick next no-show** | Keeps the first row whose `Status` is empty; the sheet node also emits each row's `row_number`, which is what the write-back matches on. Blank spacer rows are skipped rather than picked forever, an empty sheet reports itself (the read node has always-output-data on, so the guard still runs), and a POST that arrives while `source` is `sheet` is reported instead of rendering an unrelated row. Missing `FirstName`/`EventName` on an otherwise filled row fails loudly with the row number. |
| **No-show found? / Nothing to send** | Nothing to render is a normal, successful outcome — the run ends with a friendly summary instead of an error, and passes the upstream reason through (every row already sent, empty sheet, scheduled run in webhook mode, or a POST while in sheet mode). It also feeds *Respond ok*, so a webhook caller always gets an answer. |
| **Build project JSON** | The whole design lives here: adaptive type ramp on all three headlines, event-card and highlight-card sizing, photo-vs-monogram avatar, timestamp formatting, HTML-escaping of every outside string, and the API's `name` character rules. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — without spending credits. *Check validation* guards on the HTTP status, so a `401`/`403` from a bad key or a `5xx` throws with the status and message rather than sliding through; a rejected payload surfaces as a field list. |
| **Dry run?** | Routes on `Config.dryRun`. It is `false` by default, so the normal path is straight to *Submit render*. |
| **Save draft to editor / Dry run summary** | **Only when `dryRun: true`.** Saves a free draft and reports the quoted credits plus an `editorLink` (`https://editor.zvid.io/?project=…`). Best-effort: a hiccup saving the draft never hides the report. |
| **Submit render / Wait / Get render status** | Paid render plus a poll loop. |
| **Still rendering?** | Fails fast when the job reports `failed`, and stops the loop at `timeoutMinutes`. |
| **Video URL** | Pulls the finished URL out of the job and builds the email subject/body from the Config templates in JS, where every invitee-supplied value is escaped before it lands in markup. |
| **Send email? / Send re-book email (SMTP)** | Runs only when `sendEmail` is `true` **and** the record has an address with an `@`. Set to continue on error, so a bounced SMTP connection never costs you the video — and *Run summary* then reports `emailSent: false` with the SMTP error in `emailError`, rather than claiming a delivery that did not happen. |
| **Sheet row? / Mark row sent** | Sheet path only. Updates exactly the picked row (matched on `row_number`): `Status` = `sent`, `VideoUrl` = the finished MP4. A failed render never reaches this node, so the row stays pending and the next run retries it. |
| **Run summary** | One item carrying `videoUrl`, `jobId`, `creditsCharged`, `videoSeconds`, `emailSent`, `emailError`, `sheetRow` and the music note. |
| **Respond ok** | Answers the webhook caller on every branch — rendered, dry run, and "nothing to send". Continues on error, so a caller that has already hung up (or a manual run with no caller at all) never fails the run. |
| **▶ Watch video** | Downloads the finished MP4 as binary so n8n plays it inline in the output panel. Never fails the run: it retries a few times (the CDN can 404 for a moment right after a render completes) and then continues regardless, since the sheet is already written by this point. |

## Publishing (optional tail)

The required path ends with the video URL in your sheet — or in the webhook
response. To deliver it automatically, extend after *Mark row sent*:

- **Email** — flip `sendEmail` to `true` and the built-in *Send re-book email
  (SMTP)* node does it. On n8n Cloud, swap that node for **Gmail** or
  **Outlook** in one click; everything upstream stays identical.
- **CRM / sequencer** — HTTP Request node writing `videoUrl` back to the deal or
  contact record, so your next sequence step can drop the link in.
- **Slack / human in the loop** — Slack node posting `videoUrl` to whoever owns
  the account.

These stay out of the required path so the import runs with a Zvid key and a
Google account, nothing else. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and
replace the render HTTP nodes with the native **Zvid** node + **Zvid Trigger**
(render webhook), which removes the poll loop.

### Calendly (production trigger)

Calendly publishes `invitee.created`, `invitee.canceled` and
`routing_form_submission.created` — there is **no documented no-show event**, so
most teams fire this workflow from whatever actually marks the no-show (a rep in
the CRM, a meeting-attendance report, Zapier/Make), or just use the sheet path.
If you do want a Calendly subscription for the events it *does* publish: create
a Personal Access Token, call `GET https://api.calendly.com/users/me` for your
`user` and `organization` URIs, then `POST
https://api.calendly.com/webhook_subscriptions` with `{ url, events,
organization, user, scope: "user" }` — or `scope: "organization"` without `user`
for the whole team. Point `url` at this workflow's production webhook URL.

**Privacy:** the invitee's address is used only to send that person their own
video. It is never written into the video, the project name or the render
payload.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Row N is missing FirstName or EventName` | The first empty-`Status` row is incomplete. Fill both columns, or put anything in `Status` to skip the row. |
| Run says `No row with an empty Status column` | Every row is already processed. Add fresh no-show rows with `Status` empty. |
| Run says `The sheet has no data rows yet` | The tab holds only the header row (or the Sheets pickers point at the wrong tab). Add a no-show under the header. |
| Activated in webhook mode, but the schedule renders nothing | By design. With `source: "webhook"` only a real POST — or a hand-started *Execute workflow* — reaches the render chain; the schedule ends on *Nothing to send* so an idle workflow can never charge you for the bundled sample. Set `source: "sheet"` if you want the timer to do the work. |
| A POST answers with `Config.source is still "sheet"` | The webhook is receiving no-shows but the workflow is still in sheet mode, so the posted body was ignored rather than rendering an unrelated row. Set `source: "webhook"` in `Config`. |
| Summary says `emailSent: false` with an `emailError` | The render and the sheet write-back succeeded; only the SMTP send failed (the message says why — wrong host, auth, or a rejected recipient). Fix the SMTP credential and re-send by hand; the video URL is in the summary and the sheet. |
| `The no-show payload needs at least a first name` | The POSTed body had no usable name field. The error message lists the exact body shape the webhook expects. |
| `Zvid rejected the project` | The message lists the offending fields. If you edited the builder, note the API only allows letters, digits, spaces, `_` and `-` in `name`, and rejects `audios[].track`. |
| Video came out silent | The music guard skipped the bed — the run summary's `music` field says why (unreachable, HTTP status, or over the `maxMusicBytes` cap). Fix `musicUrl` or raise the cap; the render itself is unaffected. |
| Presenter photo fills the whole frame, or does not appear | The photo must be a **square** image served over `https`. Non-https URLs fall back to the monogram circle by design. |
| The webhook caller times out | A real render keeps the HTTP request open for one to three minutes. Raise the caller's timeout, or set `sendEmail: true` and treat the webhook as fire-and-forget. |
| `OriginalTime` prints as raw text | Only ISO timestamps (`2026-08-13T18:00:00Z`) are formatted; anything else is passed through verbatim, on purpose. An unknown `timeZone` silently falls back to UTC. |
| Render failed and the row stayed pending | Intentional — the row is only marked `sent` after a successful render, so the next run retries it. The error message carries the job's `failedReason`. |
| Wrong row updated | Do not sort or delete rows while a run is in flight; the update matches on the `row_number` captured at read time. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. A 15-minute poll over a short queue never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Verified

Core-only node types throughout (`httpRequest` 4.2, `code` 2, `set` 3.4, `if`
2.2, `wait` 1.1, `googleSheets` 4.5/4.7, `emailSend` 2.1, `webhook` 2,
`respondToWebhook` 1.1, `scheduleTrigger` 1.2, `manualTrigger` 1, `stickyNote`
1) — the same set the rest of this series ships, so a stock install resolves
every node with nothing installed. Here is exactly what was verified:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the
  render farm runs) three times from the builder's real output: the default
  fixture (15.73 s, presenter photo, music bed), a long-copy stress fixture
  (15.90 s — a 23-character hyphenated first name, a 63-character event title
  (past the 56-character step, so the event card renders at its 35 px floor),
  three 12-word highlights, no presenter photo so the monogram path runs, and a
  deliberately dead music URL so the guard renders silent), and a short
  two-highlight fixture (13.95 s — two highlight cards at the top of the type
  ramp, an empty `presenterRole`, a hand-typed `OriginalTime` passed through
  unformatted, and a short booking link so the domain chip shows its path).
  **All 117 extracted frames were reviewed** (2 fps across all three videos plus
  exact-timestamp grabs at both transition midpoints, the frame-0 poster and the
  final frames): no clipping, no overflow, no text touching the frame border, no
  low-contrast text on either the paper or the ink scenes, no unsubstituted
  tokens, no half-rendered animation states at the cuts.
- **Remote validation against the live API** (`POST
  /api/render/validate/api-key` via MCP with `remote: true`) on all three
  payload shapes: every one came back `valid: true`, **0 errors, 0 warnings**,
  schema **1.0.0** — `creditsRequired: 16` (default), `16` (stress) and `14`
  (two-highlight).
- **Every pinned URL probed** at authoring time: the music bed (HTTP 200,
  `audio/mpeg`, 3,722,344 bytes — comfortably under the 5 MB plan audio cap) and
  the demo presenter photo used by the fixtures (HTTP 200, `image/jpeg`).
- **The embedded code node is byte-identical** to the frame-reviewed standalone
  builder (asserted programmatically, not by eye), and a simulated execution of
  that JS against mocked n8n globals produced the exact payloads that were
  rendered and validated.
- **42 simulated-execution checks** run every code node straight out of the
  shipped JSON against mocked n8n globals — no network, no credits. They cover
  the branches that are hard to reach by hand: each music-guard outcome, the
  trigger gate (real POST renders, hand-started run uses the sample, scheduled
  run in webhook mode renders **nothing**, POST while in sheet mode reports
  instead of rendering a stranger's row), an empty sheet and blank spacer rows,
  a `401` and a rejected payload on validate, the poll loop's failure and
  timeout exits, HTML-escaping of hostile invitee text, and a failed SMTP send
  reported as `emailSent: false`.
- **Structural checks** on the workflow JSON: parseable, 38 nodes, every
  connection resolves, unique node names and ids, no `credentials` blocks
  anywhere, all Zvid HTTP calls on `httpHeaderAuth`, only two terminal nodes
  (*Respond ok* and *▶ Watch video*, so no branch dead-ends), and `▶ Watch
  video` last in the chain with the standard binary-download contract
  (`responseFormat: file`, `outputPropertyName: data`, 3 retries,
  always-output-data, continue on error).

## Live n8n execution (2026-07-31)

Executed headlessly in a real n8n instance (`n8n execute`) against the live Zvid API, in
**webhook mode** (`source: "webhook"`, `sendEmail: false`), driven by the bundled
`samplePayload`.

**What ran end to end:** trigger → `Check music` HEAD guard → `Music guard` → `Source?` →
`Webhook payload` → `No-show found?` → `Build project JSON` → `Validate project (free)`
(**16 credits quoted, zero warnings**) → `Submit render` → two `Wait`/`Get render status` laps
→ `Render finished?` → `Video URL` → `Run summary` → `▶ Watch video`.

**Output:** 1080×1920, **15.73 s**, h264 + aac, 899 KB. `▶ Watch video` returned one binary
with `mimeType: video/mp4`. All 31 frames were extracted at 2 fps and reviewed.

**Checked field-for-field against the trigger data** — every value on screen traces back to the
payload: invitee first name `Sarah` (hook and CTA), event `Scaling Content Ops Without Hiring`,
`originalTime` `2026-08-13T18:00Z` formatted to "Thu, Aug 13 · 6:00 PM UTC", the rebook link,
the three "what we covered" highlights, and the presenter block `Dana Whitfield · Head of
Growth, Flowdesk`. No clipping, no overflow, no unsubstituted variables; contrast holds on both
the warm paper scenes and the dark CTA scene.

**Not exercised:** the Google Sheets source and the `Mark row sent` write-back (the shared test
credential's OAuth token expired mid-session, so the run used webhook mode instead), the SMTP
send (`sendEmail: false` for the run), and the live webhook POST path — the manual trigger fed
the same `samplePayload` the webhook branch consumes.

**Changed since that run:** the trigger gate described above (a scheduled run in
webhook mode now ends on *Nothing to send*), the "nothing to send" branch now
answering *Respond ok*, the blank-row/empty-sheet handling in *Pick next
no-show*, the HTTP-status guard in *Check validation*, and honest `emailSent` /
`emailError` reporting in *Run summary*. The manually triggered webhook-mode
path that this run exercised is unchanged — it is still the hand-started
`samplePayload` case — and `Build project JSON`, the node that produces the
video, was not touched, so the rendered output is bit-for-bit the same payload.
Those changes were re-checked on paper and by the offline simulation suite, not
by a second live run.

**One thing worth knowing if you run this headlessly:** `n8n execute` pre-flight-validates
*every* node in the workflow, not just the ones on the executed path. Because the shipped file
deliberately leaves the Sheets pickers empty for the installer, a headless webhook-mode run
aborts with `'Mark row sent': Parameter "Document" is required` until you point those pickers
at any sheet. They are never called in webhook mode.
