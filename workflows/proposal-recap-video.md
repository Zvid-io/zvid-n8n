# Deal stage → proposal recap video

[`zvid-proposal-recap-video.json`](zvid-proposal-recap-video.json)

Proposals die unread. This workflow turns one deal into a calm ~25-second
1920×1080 recap — "Your proposal, Sofia.", the scope as check-rowed cards, the
number with its timeline and expiry, then a "grab 15 minutes" card signed by you
— and writes the finished video URL back next to the deal. Send it as the
follow-up: it reads like the proposal, not like an ad. Deals arrive from a
Google Sheet out of the box, or from a HubSpot deal-stage webhook in production,
in which case the HTTP response carries the video URL so your CRM can store it.

```
Schedule / Deal webhook ─▶ Config ─▶ Check music ─▶ Source?
        ├─ sheet:   Read deals sheet ─▶ Pick next deal ─┐
        └─ webhook: Webhook payload ─────────────────────┤
        ─▶ Build project ─▶ Validate (free) ─▶ Render ─▶ Mark deal sent
        ─▶ Run summary ─▶ ▶ Watch video + Respond with video
```

## Why this one is different

**The money is formatted, never computed.** `Amount` is printed exactly as you
typed it, grouped into thousands, with the symbol picked from `Currency`.
There is no FX call, no rounding and no rate table anywhere in this workflow —
`148500.00` + `EUR` renders `€148,500.00`, and a currency with no symbol in the
table renders `SEK 89,000`. A proposal video that quietly changed the number
would be worse than no video.

**The layout has no empty states.** Three scope lines, two, one or none — the
cards resize (36 px down to 24 px) and re-centre between the title and the
footer rule, and a deal with no scope at all drops that scene entirely and ships
a three-scene video. On the numbers scene, two facts straddle the column and a
single fact spans the whole of it as a label-left / value-right bar — matching
the full-width rules above and below it instead of sitting in the left quarter —
and a deal with neither a timeline nor an expiry puts the *client* in that bar
rather than leaving a hole. The right-hand "prepared for" block only appears
when the amount is short enough that it cannot be crowded, and the footer drops
the company on any scene that already names the client, so the same words never
appear twice on one screen. Every one of those branches was rendered on the
production engine and reviewed frame by frame.

**Nothing is ever cut mid-word.** A proposal recap is a client-facing commercial
document, so a shortened legal entity is never printed as if it were the whole
name. A deal name over 120 characters or a company over 80 drops whole words and
ends in a visible `…` — `Verwaltungsgesellschaft für Industriebeteiligungen und
Handelslogistik…`, never `…Handelslogist`. The run summary's `truncated` list
names every field that was shortened, so an operator sending 200 personalised
proposals can audit the handful that were, instead of never finding out.

**Any brand colour is safe.** The CTA pill flips its label to ink on a light
accent, and the small accent type (kicker, rule) is darkened step by step until
it clears 4.5:1 against the paper. A pale amber brand renders as legibly as a
deep blue one — both were rendered and checked, not assumed. The paper itself is
guarded the other way: a `paperColor` too dark to carry the ink is lifted toward
white, and replaced by the default if its hue cannot get there.

**Two ways in, one pipeline.** The sheet path needs a Zvid key and a Google
account, nothing else. Flip one field in `Config` and the same build, validate,
render and summary chain runs from a webhook instead, and answers the caller
with `videoUrl`.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Google account | For the two Google Sheets nodes (read the queue, write back the result). Not needed on the webhook path. |
| A CRM that can POST | **Optional**, production path only. HubSpot workflows, Pipedrive automations, Zapier or your own app. No credential to attach. |

No LLM, no voice service, no stock-media account. The only external asset is the
music bed, and it is optional.

## Setup

1. **Import** `zvid-proposal-recap-video.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Validate project (free)*, *Save draft to
   editor*, *Submit render* and *Get render status*.
3. **Google Sheets credential** — attach it to *Read deals sheet* and *Mark deal
   sent*, and pick your spreadsheet + tab in both nodes.
4. **Create the sheet** with this exact header row:

   | DealName | Company | ContactFirstName | Amount | Currency | ScopeLine1 | ScopeLine2 | ScopeLine3 | TimelineWeeks | ValidUntil | Status | VideoUrl |
   | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

   `DealName`, `Company` and `Amount` are required; everything else is optional
   and the layout adapts. Leave `Status` and `VideoUrl` empty.
5. **Open `Config`** — set `senderName`, `senderTitle`, `senderCompany`,
   `meetingUrl` and `accentColor`. Everything else works out of the box.
6. **Run it.** The workflow renders for real out of the box, so **the first run
   spends credits — 25** for a full four-scene recap. When it finishes, click
   **`▶ Watch video`** to play it inside n8n.

   Prefer to preview for free first? Set `dryRun: true` in `Config` before that
   first run: you get the exact credit cost and an **`editorLink`** that opens
   the draft in the Zvid editor, with nothing spent and nothing written to the
   sheet.
7. **Activate.** The schedule polls the sheet every 15 minutes and consumes one
   deal per run.

### Switching to the HubSpot webhook (production path)

The sheet is the demo path so the template works the minute it is imported. To
fire a recap the moment a deal reaches *Proposal sent*:

1. In `Config` set `source: "webhook"`.
2. In HubSpot, build a **deal-based workflow**: enrolment trigger *Deal stage is
   Proposal sent* → action **Send a webhook** (POST) → this workflow's
   production URL (`https://<your-n8n>/webhook/proposal-recap`).
3. Map the properties HubSpot sends:

   | HubSpot property | Field here |
   | --- | --- |
   | `dealname` | `dealName` **(required)** |
   | associated company name | `company` **(required)** |
   | `amount` | `amount` **(required)** |
   | contact `firstname` | `contactFirstName` |
   | `deal_currency_code` | `currency` |
   | your scope properties | `scopeLine1` / `scopeLine2` / `scopeLine3` |
   | your timeline property | `timelineWeeks` |
   | your expiry property | `validUntil` |

A `properties: { … }` wrapper (HubSpot) or `current: { … }` (Pipedrive) is
unwrapped automatically, and `scope` is accepted as an array, as
`scopeLine1..3`, or as one newline/semicolon-separated string. Any other CRM,
Zapier or your own backend can post the same flat body.

**The response is the point.** *Respond with video* answers the caller with the
whole run summary — `videoUrl`, `jobId`, `creditsCharged`, the deal fields — so
the CRM can write the link straight onto the deal record. A real render keeps
that HTTP request open for one to three minutes; raise your caller's timeout, or
treat it as fire-and-forget and read the URL off the sheet instead.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base. |
| `editorUrl` | `https://editor.zvid.io` | Used to build `editorLink` on a dry run. |
| `source` | `sheet` | `sheet` (default) or `webhook`. Routes the `Source?` branch. |
| `senderName` | `Marcus Reyn` | Sign-off name on the closing card. |
| `senderTitle` | `Partner` | Line under it. Empty collapses the line to the company alone. |
| `senderCompany` | `Northbeam Studio` | The "FROM" half of the cover pair card, and the monogram letter. |
| `senderLogoUrl` | `""` | Optional **square** https logo (256×256 is plenty). Replaces the monogram chip on the cover and the sign-off. Empty = a clean lettermark in your accent colour. |
| `paperColor` | `#F4F1EA` | The paper every scene sits on. **Keep it light** — this is an ink-on-paper design with white cards, and the contrast guards only darken type. A paper too dark to carry the ink is lifted toward white; one whose hue cannot get there is replaced by this default, and the summary reports it as `paperAdjusted`. |
| `brandColor` | `#12161C` | Ink: headlines, values, card text. Must be dark: a `brandColor` too light for the paper hands the job back to `#12161C` (`inkAdjusted` in the summary). |
| `accentColor` | `#1B4DE4` | Rule, kicker, monogram and CTA pill. Auto-darkened for small type and auto-flipped for pill text — any colour is safe. |
| `mutedColor` | `#6E6A61` | Secondary type: labels, footer, domain line. Darkened until it clears 4.5:1 on whatever paper wins (`mutedAdjusted`). |
| `positiveColor` | `#1C7A52` | The scope checkmarks. |
| `font` / `displayFont` | `Manrope` / `Playfair Display` | Sans carries UI, labels and the amount; serif carries the three big headlines. One font per text element. |
| `greetingTemplate` | `Your proposal, {firstName}.` | Cover headline. Tokens: `{firstName}`, `{company}`, `{dealName}`, `{senderCompany}`. |
| `scopeTitle` | `Scope of work` | Scope-scene headline. The kicker above it switches to `SCOPE OF WORK` if you set this to "What's included", so the same words never appear twice. |
| `amountLabel` | `Total investment` | Kicker above the number (upper-cased). |
| `ctaHeadline` | `Questions? Grab 15 minutes.` | Closing headline. Same tokens as `greetingTemplate`. |
| `ctaText` | `Book a call` | Text inside the CTA pill; the pill sizes to it. |
| `meetingUrl` | `https://cal.com/your-team/15min` | Shown as its bare domain + path (`cal.com/your-team/15min`), never a raw `https://` blob. Empty hides the line. |
| `defaultCurrency` | `USD` | Used when a row's `Currency` cell is empty. |
| `sceneTransition` / `transitionSeconds` | `fade` / `0.55` | Scene transition and its length (clamped 0.2–1.2 s). Every non-last scene is padded by it so the cuts land on time. |
| `musicUrl` | pinned Zvid stock-library track | HEAD-checked before every render. |
| `musicVolume` | `0.14` | The bed sits low by design. |
| `maxMusicBytes` | `5242880` | Plan audio cap. Anything larger renders **without** music instead of failing. |
| `samplePayload` | a full sample deal | Used when the workflow is executed by hand on the webhook path, so *Execute workflow* always produces a real video. |
| `statusDoneValue` | `sent` | What gets written to `Status` after a successful render. |
| `dryRun` | `false` | `false` (default) renders for real. `true` gives a free pass that validates the payload, quotes the credits and saves a draft you can watch in the editor — no credits, no sheet write. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost per video

The live validator quoted **25 credits** for the default four-scene recap
(24.8 s: three scope lines, a timeline and an expiry) and **18 credits** for a
bare deal with no scope lines and no dates (17.2 s, three scenes). Length is the
only thing that moves the number: the scope scene runs 3.4 s + 1.4 s per line,
the other three are fixed.

*Validate project (free)* runs before every render and reports the exact figure
as `creditsCharged` in the run summary — but the render then proceeds on its
own. Set `dryRun: true` if you want the number *without* the render.

## How it works

| Node | What it does |
| --- | --- |
| **Config** | Every knob in one JSON blob. Nothing else in the workflow hard-codes a colour, a URL or a piece of copy. |
| **Check music** | `HEAD`s `musicUrl` with `neverError`, so an unreachable host is data, not a failed run. |
| **Source?** | Routes on `Config.source`. `sheet` (default) → the Google Sheets path; `webhook` → the normaliser. |
| **Read deals sheet** | Reads every row; the sheet node also emits each row's `row_number`. |
| **Pick next deal** | Keeps the first row whose `Status` is empty, compacts `ScopeLine1..3` (a gap in the middle does not leave a blank card) and falls back to `defaultCurrency`. No such row → the run ends with a friendly "nothing to send" summary that also answers the webhook caller. A picked row missing `DealName`/`Company`/`Amount` fails loudly with the row number. Its length caps are sanity bounds on a hostile cell, not display clamps — the one place a value is shortened for the screen is *Build project JSON*. |
| **Webhook payload** | Normalises one posted deal into the same flat shape. Unwraps HubSpot's `properties` and Pipedrive's `current`, accepts `scope` as an array, as `scopeLine1..3` or as one delimited string, and falls back to `Config.samplePayload` on a manual execution so the template is always testable. Same rule on lengths as *Pick next deal*. |
| **Deal found?** | The single join point: both paths meet here, so everything downstream is written once. |
| **Nothing to send** | The friendly empty-queue outcome. It feeds *Respond with video* like every other terminal path, so a caller that POSTed while `source` was still `sheet` gets `{ rendered: false, reason, hint }` instead of hanging until n8n's webhook timeout. On a schedule or manual run the respond node is a no-op. |
| **Build project JSON** | The whole design lives here: the type ramps (greeting 96→64 px, scope rows 36→24 px, amount 176→104 px), word-boundary elision with a visible `…` for anything past the layout's reach, the scope-count and stat-card branches (one fact spans the full column as a label-left/value-right bar, two straddle it), the currency formatter, the contrast-safe accent/muted/paper derivation, the crossfade hold that keeps scenes 2–4 from animating over the outgoing scene, the music guard, HTML-escaping of every piece of deal text, and the API's `name` character rules. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — without spending credits. Failures surface as a field list. |
| **Dry run?** | Routes on `Config.dryRun`. It is `false` by default, so the normal path is straight to *Submit render*. |
| **Save draft to editor** | **Only when `dryRun: true`.** Saves a free draft and returns `editorLink` (`https://editor.zvid.io/?project=…`). Best-effort: a hiccup there never hides the dry-run report. |
| **Dry run summary** | **Only when `dryRun: true`.** Reports the quoted credits, `editorLink` and warnings, and leaves the sheet untouched so the next real run picks the same deal. |
| **Submit render / Wait / Get render status** | Paid render plus a poll loop. |
| **Still rendering?** | Fails fast when the job reports `failed` and stops the loop at `timeoutMinutes`. |
| **Video URL** | Pulls the finished URL out of the job (both `result` shapes) and carries the deal facts forward so the write-back, the summary and the webhook response all read from one place. |
| **Sheet row?** | Only the sheet path has a row to write back to; a webhook run goes straight to the summary. |
| **Mark deal sent** | Updates exactly the picked row (matched on `row_number`): `Status` = `sent`, `VideoUrl` = the finished MP4. A failed render never reaches this node, so the row stays pending and the next run retries it. |
| **Run summary** | The report: `videoUrl`, `jobId`, the deal fields, `videoSeconds`, `creditsCharged`, whether music survived the guard, `sheetRow`, `sheetStatus` — plus the audit fields `truncated` (every value the layout had to shorten, with its original and kept lengths) and `paperAdjusted` / `inkAdjusted` / `mutedAdjusted`. Empty and null on a deal that fits with a palette that holds. *Dry run summary* carries the same fields. |
| **▶ Watch video** | Downloads the finished MP4 as binary so n8n plays it inline in the output panel. Never fails the run: it retries a few times (the CDN can 404 for a moment right after a render completes) and then continues regardless. |
| **Respond with video** | Answers the webhook caller with the same item. Set to continue on error, so a caller that has already hung up never fails the run. |

## Publishing (optional tail)

The required path ends with the URL in your sheet or in the webhook response.
To deliver it automatically, extend after *Mark deal sent*:

- **Email the prospect** — Gmail, Outlook or the core **Send Email** node with
  `videoUrl` in the body. **Send the link, not the file**: a video attachment
  lands in spam far more often, and a link tells you it was opened.
- **Write it back to the CRM** — HTTP Request node onto a HubSpot/Pipedrive
  custom property, or let *Respond with video* hand the URL back to the
  automation that called you.
- **Slack the owner** — Slack node with `videoUrl` so the rep can send it
  themselves with a personal line.

These stay out of the required path so the import runs with a Zvid key and a
Google account, nothing else. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and
replace the render HTTP nodes with the native **Zvid** node + **Zvid Trigger**
(render webhook), which removes the poll loop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Row N is missing DealName, Company or Amount` | The first empty-`Status` row is incomplete. Fill all three, or put anything in its `Status` to skip it. |
| Run says `nothing to send` | Every row has a `Status`. Add fresh deal rows with `Status` empty. If you got this back from a webhook POST, `Config.source` is still `sheet` — the `hint` field in the response says so. |
| A long name ends in `…` | Deliberate. The layout carries 120 characters of `DealName` and 80 of `Company`; anything longer loses whole words and gains an ellipsis rather than being cut mid-word. The run summary's `truncated` list names every field that was shortened and by how much. |
| The colours came out different from `Config` | A contrast guard fired. `paperColor` too dark, `brandColor` too light or `mutedColor` too pale for the paper are each corrected rather than rendered unreadable; the summary reports `paperAdjusted` / `inkAdjusted` / `mutedAdjusted` with the before → after value. Nothing throws — a bad colour can never fail a render. |
| `The deal has no readable Amount` | `Amount` had no digits in it (`"call us"`, `"TBD"`). Use plain digits — `12400` or `148500.00`. |
| Currency shows as `SEK 89,000` instead of a symbol | Correct — that currency has no symbol in the table, so the ISO code is printed instead. Nothing is converted either way. |
| The video is three scenes, not four | The deal had no scope lines. Fill `ScopeLine1..3` (or post a `scope` array) to get the scope scene. |
| The numbers scene shows "PREPARED FOR" instead of a date | The deal had neither `TimelineWeeks` nor `ValidUntil`, so the client fills that card rather than leaving the scene half empty. |
| `ValidUntil` prints exactly as typed | Only `YYYY-MM-DD` is reformatted (to `15 Aug 2026`). Anything else is treated as copy you wrote deliberately. |
| The webhook call times out | A real render holds the request open for one to three minutes. Raise the caller's timeout, or ignore the response and read `VideoUrl` from the sheet. |
| Webhook run rendered the sample deal | The POST body was empty or unparsable, so `Config.samplePayload` was used. Check the CRM's payload mapping. |
| Video rendered without music | The HEAD guard dropped it — the run summary's `music` field says why (unreachable, HTTP error, or over `maxMusicBytes`). Free plans cap audio assets at 5 MB. |
| `Zvid rejected the project` | The message lists the offending fields. If you edited the builder, note the API only allows letters, digits, spaces, `_` and `-` in `name`, and rejects `audios[].track`. |
| Render failed and the row stayed pending | Intentional — the row is only marked `sent` after a successful render, so the next run retries it. The error message carries the job's `failedReason`. |
| Wrong row updated | Do not sort or delete rows while a run is in flight; the update matches on the `row_number` captured at read time. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run every 15 minutes never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Verified

n8n **2.29.10** node types and versions (every node resolves in a stock install;
the two Google Sheets nodes use the same shapes as the other templates in this
series). Here is exactly what was verified:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the
  render farm runs) from the builder's real output, **six times**, one per layout
  branch: the **default** deal ($12,400 USD, three scope lines, timeline and
  expiry, a square sender logo → 24.8 s), a **stress** deal (€148,500.00, a
  58-character deal name, a 26-character contact name, three ~60-character scope
  lines, a pale amber accent and the monogram path → 24.8 s), an **edgewide**
  deal (a 65-character German legal entity and a 96-character deal name, both
  rendered in full, with the client in the right-hand aside → 24.8 s), an
  **overflow** deal (a 103-character entity and a 161-character deal name, both
  past the caps and so elided on a word boundary, plus a deliberately dark
  `paperColor` to exercise the paper guard → 23.4 s), a **lean** deal
  (SEK 89,000 — a currency with no symbol — two scope lines, a non-numeric
  timeline, no expiry, no `meetingUrl`, no `senderTitle` → 23.4 s) and a
  **bare** deal (£7,500, no scope lines and no dates → three scenes, 17.2 s).
  **Every extracted frame was reviewed** — all 278 frames sampled at 2 fps
  across the six videos, on 49 six-up contact sheets, plus 80 stills at full
  1920×1080 covering every scene settled, every transition midpoint and every
  final frame. No clipping, no overflow, no text touching an edge, no
  low-contrast type, no broken half-states, no string double-exposed across a
  cut, and every value substituted — no `{{`, `undefined` or `NaN` anywhere.
- **Remote validation against the live API** (`POST /api/render/validate/api-key`
  via MCP with `remote: true`) on **all six payloads, sent verbatim** — full
  backdrop SVGs, nothing shortened. Every one came back `valid: true`, **0
  errors and 0 warnings**, schema **1.0.0**: default `creditsRequired: 25` /
  24.8 s, stress 25 / 24.8 s, edgewide 25 / 24.8 s, lean 24 / 23.4 s, overflow
  24 / 23.4 s, bare 18 / 17.2 s. That is the same validator's schema **and
  layout lint** — including the overlap, off-canvas and contrast checks.
  (Getting there is why the payload spells out `width: 1920, height: 1080`
  instead of the `full-hd` preset: with a preset the linter cannot tell that the
  paper SVG is a full-bleed backdrop and reports every element on top of it as
  an overlap.) No credits were spent — validation is free.
- **Every pinned URL HEAD-checked**: the music bed (HTTP 200, `audio/mpeg`,
  3,695,616 bytes — comfortably under the 5 MB plan cap) and the fixture's
  square logo image (HTTP 200, `image/jpeg`).
- **The embedded code node is byte-identical** to the frame-reviewed standalone
  builder (asserted programmatically after the workflow file is written, not by
  eye — 39,417 characters), and the shipped `Config` node is asserted to carry
  exactly the key set the fixtures exercise.
- **25 simulated-execution checks** run the shipped workflow's own code nodes
  against mocked n8n globals: the sheet happy path picks the first empty-`Status`
  row and compacts a gap in `ScopeLine1..3`; an all-`sent` sheet stops friendly
  and an incomplete row throws with its row number; the webhook normaliser
  handles a flat body, a HubSpot `properties` wrapper, `scopeLine1..3`, a
  newline/semicolon-separated scope string, and falls back to `samplePayload` on
  a manual run while rejecting a body with no amount; *Build project JSON*
  rebuilds the **exact** payload that was rendered and frame-reviewed, elides an
  over-length entity on a word boundary and reports it in `meta.truncated` while
  keeping a 65-character one whole, lifts a dark `paperColor` back to the
  shipped paper, holds every scene-2/3/4 element until its incoming crossfade
  has finished, drops `audios[]` on a 404, on a 9 MB file and on an empty
  `musicUrl`, escapes a `<script>` tag and an ampersand out of the deal text,
  and refuses an unreadable amount; the poll loop throws on `failed` and at
  `timeoutMinutes`; *Video URL* accepts both `result` shapes and throws on
  neither; and the summaries report a sheet status only for a sheet row, with
  the dry run building its `editorLink` and surviving a failed draft save.
- **Structural checks** on the workflow JSON: parseable, 35 nodes, all
  connection sources and targets resolve, all code nodes compile, unique
  names/ids, core-only node types (`manualTrigger`, `scheduleTrigger`,
  `webhook`, `respondToWebhook`, `set`, `if`, `code`, `httpRequest`,
  `googleSheets`, `wait`, `stickyNote`), no `credentials` blocks anywhere, every
  Zvid call on Header Auth, `▶ Watch video` rightmost and downloading a file,
  and `Config` shipping `dryRun: false` against `https://api.zvid.io`.

## Live n8n execution (2026-07-31)

Executed headlessly in a real n8n instance (`n8n execute`) against the live Zvid API, in
**webhook mode** (`source: "webhook"`), driven by the bundled `samplePayload`.

**What ran end to end:** trigger → `Check music` HEAD guard → `Source?` → `Webhook payload` →
`Deal found?` → `Build project JSON` → `Validate project (free)` (**25 credits quoted, zero
warnings**) → `Submit render` → three `Wait`/`Get render status` laps → `Render finished?` →
`Video URL` → `Run summary` → `▶ Watch video`.

**Output:** 1920×1080, **24.80 s**, h264 + aac, 975 KB. `▶ Watch video` returned one binary
with `mimeType: video/mp4`. All 50 frames were extracted at 2 fps and reviewed.

**Checked field-for-field against the trigger data** — every value on screen traces back to the
payload: contact first name `Sofia`, company `Halcyon Interiors`, deal
`Website redesign & CMS migration`, all three scope lines, `12400` rendered as `$12,400`,
`timelineWeeks` as "6-week delivery", `validUntil` as "15 Aug 2026", and the sender block
`Marcus Reyn · Partner, Northbeam Studio`. No clipping, no overflow, no unsubstituted
variables, and contrast holds on the paper and dark grounds.

**Not exercised:** the Google Sheets source and the `Mark deal sent` write-back (the shared
test credential's OAuth token expired mid-session, so the run used webhook mode instead), the
HubSpot mapping, and the delivery tail — no CRM, no email provider, no Slack.

**One thing worth knowing if you run this headlessly:** `n8n execute` pre-flight-validates
*every* node in the workflow, not just the ones on the executed path. Because the shipped file
deliberately leaves the Sheets pickers empty for the installer, a headless webhook-mode run
aborts with `'Mark deal sent': Parameter "Document" is required` until you point those pickers
at any sheet. They are never called in webhook mode.
