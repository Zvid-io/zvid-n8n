# Birthday & anniversary greeting videos from your CRM

[`zvid-birthday-greetings.json`](zvid-birthday-greetings.json)

Every morning at 08:00: read your contact sheet, find everyone whose birthday or
anniversary is **today**, render a personal 1080×1920 greeting video for each of
them with Zvid, optionally email it, and write the year back so nobody is ever
greeted twice.

```
Schedule (08:00) ─▶ Config ─▶ Read contacts ─▶ Find today's celebrations
        ─▶ Build project (per contact) ─▶ Validate (free) ─▶ Render ─▶ Email?
        ─▶ Mark as sent (LastSentYear) ─▶ ▶ Watch video
```

## What changed

Two updates since the first release:

1. **It renders for real on the first run.** `dryRun` now defaults to `false`,
   so importing and running the workflow produces finished videos. The dry run
   is still there as an opt-in escape hatch — set `dryRun: true` in `Config`
   for a free pass that validates, quotes the credits and saves an editor draft.
2. **New `▶ Watch video` node at the end.** It downloads each finished MP4 and
   n8n plays it inline — one player per greeting, no URLs to copy out of the
   run summary.

## Why this one is different

**It never greets twice, and never silently skips.** The sheet's `LastSentYear`
column is the idempotency guard: a contact is only matched when
`LastSentYear ≠ current year`, and the column is written **after** the video is
rendered and the email is sent. A failed render or failed email stops the run
*before* the write-back, so the next run retries that contact — after a partial
failure a greeting can be duplicated, but it can never be lost.

**The design is a real design, not text on a background.** It is adapted from
Zvid's celebration templates — serif name headline, occasion pill, gradient
heart with halo (anniversaries get a ring), soft drifting bokeh lights, a
message card and a brand sign-off, all re-tinted from five palette values in
`Config`.

**Long values cannot break the layout.** Names and messages pass through a
word-wrap estimator that steps the font size down and re-stacks the elements
below, so `Alexandra-Konstantina Papadopoulou` and a 260-character message
render as cleanly as `Maya Chen` (both were frame-reviewed on the production
renderer).

**Ages are opt-in.** Anniversaries auto-count years from the Date column
("Happy 10th Anniversary"), but birthdays never do — a birthday only becomes
"Happy 30th Birthday" when you explicitly fill the `Years` column.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Google account | The contact sheet is read and written with n8n's built-in Google Sheets node. |
| SMTP credential | Optional — only for the email step (`sendEmail: false` by default). Any SMTP provider works. |

## The contact sheet

One row per contact, with a header row (column names are case-insensitive):

| Name | Type | Date | Years | Email | LastSentYear | Message |
| --- | --- | --- | --- | --- | --- | --- |
| Maya Chen | birthday | 1994-07-27 | | maya@acme.com | | |
| Studio Nova | anniversary | 2016-03-02 | | hello@nova.io | 2025 | Ten amazing years! |

- **Type** — `birthday` or `anniversary`; anything else counts as birthday.
- **Date** — `YYYY-MM-DD` preferred; `M/D/YYYY`, long dates ("July 27, 1994")
  and raw Google Sheets serial numbers also parse. Only month + day decide the
  match. Feb 29 contacts are greeted on Feb 28 in non-leap years.
- **Years** *(optional)* — renders "Happy 10th …" and a "Celebrating 10
  wonderful years" chip. Auto-derived from the Date's year for anniversaries.
- **Email** *(optional)* — used only when `sendEmail` is on. Contacts without
  one still get their video rendered.
- **LastSentYear** — managed by the workflow; leave it empty. Clear a cell to
  re-send that contact this year.
- **Message** *(optional)* — overrides the config default for that contact.
- Rows with an unreadable date are logged and skipped; they never fail the run.

Matching uses the **workflow timezone** (n8n Settings → Timezone) — set it, or
"today" is whatever timezone your n8n server thinks it is.

## Setup

1. **Import** `zvid-birthday-greetings.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name
   `x-api-key`, value = your Zvid key. Attach it to *Validate project (free)*,
   *Submit render*, *Get render status* — and *Save draft to editor* if you
   plan to use the dry run. (*▶ Watch video* needs no credential; the finished
   MP4 is served from the public CDN.)
3. **Google Sheets credential** — attach it to *Read contacts* and
   *Mark as sent*, and pick your spreadsheet + sheet in **both** nodes.
4. **Open `Config`** — set `brandName`, colours and default messages.
5. **Run it.** The workflow renders for real on the first run, so **the first
   run spends credits — roughly 11 per greeting**, one greeting per contact
   celebrating today. *Validate project (free)* still runs first and quotes the
   exact cost, but the render now proceeds automatically. (Tip: put a single
   test row with today's date in the sheet first, so the first run is one
   video.) When it finishes, click **▶ Watch video** to play the results
   inside n8n.
   *Prefer a free preview?* Set `dryRun: true` in `Config` before running: it
   validates every greeting, prints the credit quote and saves a draft you can
   watch at [editor.zvid.io](https://editor.zvid.io) without spending anything.
   Set it back to `false` when you are happy.
6. Optionally set `sendEmail: true`, set `emailFrom`, and attach an SMTP
   credential to *Send greeting email*.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `brandName` | `Northwind` | Footer mark on both scenes, `{brand}` token, email sign-off. |
| `signoffText` | *(auto)* | Defaults to `— The {brandName} Team`. |
| `accent` / `accent2` | `#FF6F91` / `#FFB86B` | Rose + gold. Gradients, heart, pills, bokeh and the email all re-tint from these. |
| `backgroundColor` | `#1A0C11` | Deep plum base. |
| `textPrimary` / `textMuted` | `#FBEDE9` / `#C29A97` | Headline / body copy colours. |
| `headingFont` / `bodyFont` | `Playfair Display` / `Space Grotesk` | Any Google Font name. |
| `birthdayMessage` | `Wishing you a fantastic year ahead — from all of us at {brand}.` | `{name}`, `{years}`, `{brand}` are replaced per contact. |
| `anniversaryMessage` | `Thank you for {years} wonderful years together. …` | Same tokens. |
| `musicUrl` | a warm example track | Any hosted mp3 under ~5 MB. Empty string = silent video. |
| `musicVolume` | `0.18` | |
| `scene1Seconds` / `scene2Seconds` | `5.2` / `5.6` | Reveal / message scenes (~10.25 s total). |
| `transitionSeconds` | `0.55` | Cross-fade between the scenes. |
| `resolution` / `frameRate` | `instagram-reel` / `30` | 1080×1920. |
| `sendEmail` / `emailFrom` | `false` / placeholder | The delivery flag and the From address. |
| `dryRun` | `false` | Renders for real by default — every matching contact's greeting is submitted and charged. Set it to `true` for a free pass that validates the payload, quotes the credits and saves a draft you can watch in the editor without spending anything. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost per greeting

A ~10 second 1080×1920 greeting is **11 Zvid credits** (quoted by the live
validation endpoint for the default design). *Validate project (free)* still
runs before every render and returns that quote per contact — it is just no
longer a stopping point: the render proceeds automatically. Set `dryRun: true`
in `Config` if you want the quote without the charge. Renders only happen on
days someone actually has a birthday or anniversary.

## How it works

| Node | What it does |
| --- | --- |
| **Read contacts** | Plain Google Sheets read; every row arrives with its `row_number`. |
| **Find today's celebrations** | Case-insensitive column lookup, tolerant date parsing (ISO, US, long dates, Sheets serials), month-day match with the Feb 29 → Feb 28 rule, and the `LastSentYear` guard. One output item per matching contact; problem rows are logged, not fatal. |
| **Build project JSON** | Assembles the two-scene project per contact: auto-sized serif name (font steps down, elements re-stack), occasion pill, birthday heart / anniversary ring variant, years chip, message card with auto-sizing, sign-off and brand footer, bokeh light layer via `customCode`. Project names are sanitised to the API's strict ASCII pattern, so non-ASCII contact names render fine on screen while the draft gets a safe name. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, layout lint — without spending credits. Failures surface per contact as a field list. |
| **Dry run?** | Splits the two branches. With the default `dryRun: false` every contact goes straight down the render branch; the dry-run branch below only runs when you set `dryRun: true`. |
| **Save draft to editor** | Dry-run branch only — never runs with the default `dryRun: false`. Saves each greeting as a draft (free) and returns `editorLink` so you can watch it at [editor.zvid.io](https://editor.zvid.io) before spending credits. |
| **Dry run summary** | Dry-run branch only. Per-contact report with `creditsRequired`, `videoSeconds`, `editorLink` and the full payload. No render is submitted and nothing is charged. |
| **Attach job to contact / Merge job status** | HTTP responses replace n8n items, so these two zips carry the contact + jobId through the poll loop without relying on item-pairing magic. |
| **Still rendering?** | Fails fast on a failed render (naming the contact) and stops the loop at `timeoutMinutes`. Nothing is written back on failure, so the next run retries. |
| **Prepare delivery** | Builds the per-contact report and a palette-matched HTML email with a "Watch your video" button linking to the finished MP4. |
| **Send email? / Send greeting email** | Only when `sendEmail` is on **and** the row has an address. Email first… |
| **Mark as sent** | …then `LastSentYear` = current year is written by `row_number`. Duplicates are possible after a partial failure; lost greetings are not. |
| **Run summary** | One item per greeting: `contact`, `occasion`, `videoUrl`, `jobId`, `creditsCharged`, `emailSent`, `lastSentYearWritten`. This is what you pipe onward. |
| **▶ Watch video** | Downloads each finished MP4 from `videoUrl` into a binary property. n8n's output panel branches on the binary mime type and the CDN serves these as `Content-Type: video/mp4`, so clicking the node shows an inline player with a download button — one item, one player, per greeting. It retries three times (the CDN can 404 for a moment right after a render completes) and is set to continue on error, so watching a video can never fail a run that already rendered and already wrote `LastSentYear` back. |

## Swapping pieces

- **Other delivery channels** — everything the email step uses (`videoUrl`,
  `emailSubject`, `contact`) is on the item after *Prepare delivery*. Replace
  the email node with Slack, WhatsApp, Twilio, or a webhook back into your CRM;
  keep the *Mark as sent* connection.
- **Other CRMs** — replace the two Google Sheets nodes with HubSpot/Airtable/
  Notion equivalents; keep the same fields (`Name`, `Type`, `Date`, `Years`,
  `Email`, `LastSentYear`) and a way to write `LastSentYear` back.
- **Skip the polling loop** — on self-hosted n8n, install
  [`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid)
  and replace *Submit render* + *Wait* + *Get render status* with a **Zvid**
  node and a **Zvid Trigger** (render webhook). The HTTP nodes are deliberately
  core-only so the workflow also runs on n8n Cloud with nothing installed.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Run finishes but nothing happens | Nobody matches today — or every match already has `LastSentYear` = this year. Check the log of *Find today's celebrations* for skipped-row warnings. |
| Greeting fires on the wrong day | The workflow timezone. Set it in n8n workflow settings; dates themselves are parsed timezone-safely. |
| `Zvid rejected the greeting for …` | The message lists the offending fields. If you customised the payload, re-check fonts and colours; the stock design validates clean with zero warnings. |
| `Render failed for …` | The error names the contact and reason. `LastSentYear` was not written, so tomorrow's run retries automatically. |
| Email sent but sheet not updated | The run failed between the two steps (e.g. Sheets permissions on *Mark as sent*). That contact will be re-greeted on the next run — clear the duplicate manually and fix the Sheets credential. |
| "Happy Birthday" but no age | By design — fill the `Years` column to opt in to "Happy 30th Birthday". |
| Wrong anniversary count | The Date's year is used (2016 → 10th in 2026). Override with the `Years` column. |
| No music | `musicUrl` is empty, or the file is unreachable/oversized. Any hosted mp3 under ~5 MB works. |
| Draft name looks different from the contact's name | Project names are ASCII-sanitised for the API; the on-screen name in the video is untouched. |
| `429` / `hourly_limit_exceeded` on submit | The batch exceeds what is left of your plan's hourly render limit (every item counts). The message names the remaining allowance and the reset time; lower the per-run cap or wait it out. Nothing is charged for a rejected submit. |

## Verified

Core node types and versions (scheduleTrigger 1.2, code 2, set 3.4, if 2.2,
wait 1.1, httpRequest 4.2) are the same ones the
[faceless-shorts workflow](faceless-shorts-autopilot.md) runs live; the Google
Sheets (4.5) and Send Email (2.1) nodes use their long-standing stable versions.
The workflow JSON passes a structural check: valid JSON, every connection
resolves, every code node compiles, unique node names, header-auth on all Zvid
calls.

**Rendered locally on the production engine** (the same `@zvid-io/zvid` package
the render farm runs) for both test contacts — `Maya Chen` (birthday, default
message) and `Alexandra-Konstantina Papadopoulou` (10th anniversary, 260-char
message). Every extracted frame of both 10.25 s videos was individually
reviewed: entrances, steady states, the cross-fade and the final frame — no
clipped text, no overflow, no broken animation states, correct occasion lines,
chip and heart/ring variants.

**Validated against the live API** (`POST /api/render/validate/api-key` via
remote validation): `valid: true`, **0 errors, 0 warnings**, `creditsRequired:
11`, schema 1.0.0. Three production-truth fixes came out of that run and are in
the builder: strict ASCII project names, no `track` field on `audios[]`, and
explicit `style.color` on every TEXT element so the layout linter sees the real
contrast.

**The filter logic has unit tests** covering month-day matching, the
`LastSentYear` guard, ISO/US/long/serial date formats, the Feb 29 rule in leap
and non-leap years, timezone-safe parsing, years derivation and case-insensitive
headers. The exact code embedded in the workflow's two code nodes is checked
byte-identical to the tested builder and executed against it for equality.

**Not executed:** nothing in the publish/delivery tail — no social platform,
no email provider. Those nodes are documented, not exercised.

### Live n8n execution (2026-07-28)

Imported into **n8n 2.29.10** (self-hosted, Docker) with a Header Auth
credential holding a real Zvid API key, `dryRun: false`, and executed for
real. Every video below was downloaded from the CDN and reviewed frame by
frame at 2 fps.

- **Run**: green end to end, **two greetings from one run** (11 credits each),
  1080x1920 @30 fps, AAC audio.
- **Every guard proved itself live.** The tab held four contacts: two matching
  today, one already sent this year, one on another date. Exactly the two
  matching contacts rendered.
- **Both variants verified**: the birthday card (heart, "HAPPY BIRTHDAY", the
  default message) and the anniversary card (ring, "HAPPY 10TH ANNIVERSARY",
  the sheet's own message) — where "Celebrating 10 wonderful years" was
  computed from the 2016 date because the `Years` cell was empty.
- **Sheet round-trip**: `LastSentYear = 2026` written for both, so a second run
  the same day sends nothing.
- **The returned `videoUrl` is a valid URL.** Project names are slugged, so the
  CDN filename carries no spaces and the link can be pasted straight into a
  publish node or `curl` (verified: HTTP 200 on the raw URL).

**Scope of that evidence after the two changes above.** The run was executed
with `dryRun: false` — exactly the path that is now the default — so everything
in this section stays true of a default import. The `▶ Watch video` node was
added *after* that run, so the node itself is not covered by this live
evidence; its contract (binary response, `video/mp4` from the CDN, n8n's inline
player) was verified separately against this n8n build and the CDN.
