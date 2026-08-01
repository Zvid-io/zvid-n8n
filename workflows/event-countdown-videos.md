# Event promo + countdown reminder videos from a Google Sheet

[`zvid-event-countdown-videos.json`](zvid-event-countdown-videos.json)

One row per event. Every morning this workflow works out how many days away each
event is and renders the video that is due today: an **announcement** when it
first sees the event, a **countdown** reminder a week out, and a **final call**
the day before. Every video is a 1080×1920 reel in one design family, and the
finished URL goes back into the event row so nothing is ever made twice. Paste
your season into a sheet once; the promotion sequence runs itself.

(The most urgent due video always wins, so an event added *on* one of its
milestone days gets that milestone's video instead of the announcement — add
events more than a week ahead to get all three.)

```
Schedule (daily 8am) ─▶ Config ─▶ Music guard ─▶ Read events sheet
        ─▶ Which renders today? (daysUntil per event) ─▶ Build project JSON
        ─▶ Validate (free) ─▶ Render (one job per due video) ─▶ Write URL back
        ─▶ ▶ Watch video
```

## Why this one is different

**The schedule *is* the countdown engine.** There is no stored counter and no
second workflow to schedule reminders. One daily run reads the dates, computes
`daysUntil`, and decides what to render — so the number on screen is recomputed
every morning and can never be stale. Idempotency lives in the sheet: the
`PromoUrl` / `Video7d` / `Video1d` cells are the record of what has already been
made, so re-running the workflow ten times in a morning still produces one video
per event at most. Clear a cell and that one video is re-made on the next run.

**Three videos, one campaign.** The announcement, the 7-day countdown and the
final call share the same detail scene and the same closing scene, so a follower
who sees all three sees one campaign rather than three unrelated posts. Only the
opening scene and the copy change: a hero card for the announcement, a numeric
dial for the countdown, an alert band with ticking beats for the day-before.
The final-call video also swaps the whole palette to `urgentColor`, so urgency
is felt before a word is read.

**Every card is measured, not guessed.** The three detail cards are sized from
the copy they hold — a two-line venue grows its card and pushes the ones below
it down; a missing city, venue or start time removes a line instead of leaving a
hole. Event names ramp across six size tiers from 112 px down to 50 px, and the
pill labels (kicker, CTA) step their type down until the label fits, with an
ellipsis at the floor size as the last resort. What that means concretely, and
what was actually put through the production renderer:

- The two-line venue card, the one-line card, and both "field missing" cards are
  all in the rendered fixtures — including the growth case, where the WHERE card
  gains 79 px and the whole stack below it moves down.
- Four of the six type tiers are rendered, **including both ends**: 112 px
  (11-character name), 96 px, 58 px (64 characters, three lines) and the 50 px
  floor (76 characters, three lines). The 82 px and 68 px tiers in between are
  the same code path with a different constant and were not rendered separately.
- The CTA pill's step-down is rendered (a 30-character label drops 44 px → 40 px
  and still clears its box). The floor-size ellipsis inside the pill fitter is a
  guard no fixture needed; the `…` you can see on the closing kicker and on long
  ticket links comes from a different, plainer truncation.

**Nothing is printed twice on one frame.** All three scenes carry the event
name, and the scenes are joined by half-second crossfades — so each scene waits
for the incoming cut to finish before fading its own copy of the name in. Without
that rule the same string lands at two baselines a few dozen pixels apart for
half a second and the reel reads as a printing misregistration rather than a cut.
Same idea in the closing scene: when a row has no `TicketUrl` the social handle
is promoted into the link slot, and the watermark underneath drops the handle so
it is not shown twice.

**No timezone conversion is ever applied to the printed date.**
`2026-08-22T18:30` prints as *Sat, Aug 22 · 6:30 PM* wherever the workflow runs:
the year, month, day, hour and minute are taken straight out of the `DateISO`
text, and the weekday name comes from a UTC-only calendar lookup that cannot
shift a day. The only timezone knob is `timezoneOffsetHours`, and it affects one
thing: which calendar day counts as "today" when computing `daysUntil`.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Google account | For the two Google Sheets nodes (read the events, write the URLs back). |
| Eventbrite token | **Optional.** Only if you set `source: "eventbrite"` instead of using a sheet. It goes in an n8n **Bearer Auth** credential attached to *Fetch Eventbrite events* — see Setup step 6. |
| Event photos | **Optional**, and yours to clear. Anything you put in `ImageUrl` is rendered full-bleed under your own event name, date and ticket link — see the note in Setup step 4. |

No LLM, no voice service, no stock-media account. The music bed and the fallback
background image are pinned, pre-verified URLs in `Config`.

## Setup

1. **Import** `zvid-event-countdown-videos.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Validate project (free)*, *Save draft to
   editor*, *Submit render* and *Get render status*.
3. **Google Sheets credential** — attach it to *Read events sheet* and *Update
   event row*, then pick your spreadsheet and tab in both nodes.
4. **Create the sheet** with this exact header row:

   | EventName | DateISO | Venue | City | TicketUrl | ImageUrl | Status | PromoUrl | Video7d | Video1d |
   | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

   - **EventName** and **DateISO** are required. `DateISO` is `2026-08-22` or
     `2026-08-22T18:30` (24-hour). Without a time, the videos say
     "Start time announced soon" instead of inventing one.
   - **Venue / City / TicketUrl / ImageUrl** are optional. No image falls back to
     `fallbackImageUrl`, and no fallback falls back to a designed gradient.
     `ImageUrl` must be a public direct link to a JPG or PNG.
   - **Status / PromoUrl / Video7d / Video1d** start EMPTY. The workflow fills
     them, and those cells are what stop a video being made twice.

   **About the photos.** Whatever `ImageUrl` (or `fallbackImageUrl`) points at
   is rendered full-bleed with *your* event name, date, price-free CTA and
   ticket link over it. Use photos you own or are licensed to use commercially,
   and prefer frames with **no third-party logo, wordmark or legible signage and
   no recognisable face** — a stranger's face or a brand's logo under your
   headline reads as their endorsement of your event, which is a claim you are
   not entitled to make. Wide venue, skyline, interior and texture shots are the
   safe picks. Leave `ImageUrl` empty if you are unsure; the designed gradient is
   always safe.
5. **Open `Config`** — set `brandName`, `handle`, `ctaText` and your brand
   colours. Set `timezoneOffsetHours` to your calendar's UTC offset (`0` = UTC).
6. **Run it.** The workflow renders for real out of the box, so **the first run
   spends credits — about 14 per video**, and a first run over a fresh sheet
   renders one announcement per event (up to `maxRendersPerRun`, default 3).
   When it finishes, click **`▶ Watch video`** to play the reels inside n8n.

   Prefer a free preview? Set `dryRun: true` in `Config` first: you get the exact
   credit quote plus an **`editorLink`** per video that opens the project in the
   Zvid editor, with nothing spent and **nothing written to the sheet** — so the
   same videos are still due on the next real run. Set it back to `false` to
   render.
7. **Activate.** From then on it checks every event every morning at 8am.

   To rehearse the 7-day and 1-day videos without waiting for the calendar, set
   `todayOverride` to a date (`2026-08-15`) — everything is computed against that
   day. Clear it when you are done.

8. **Only if you are using Eventbrite instead of a sheet** (`source:
   "eventbrite"`): add an n8n **Bearer Auth** credential holding your Eventbrite
   private token (*Account settings → Developer links → API keys*), attach it to
   *Fetch Eventbrite events*, and put your organisation id in
   `eventbriteOrgId`. Skip steps 3 and 4 — there is no sheet in that mode, so
   the workflow keeps its "already sent" ledger in the workflow's own static
   data instead.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base. Leave as is. |
| `editorUrl` | `https://editor.zvid.io` | Used to build the dry-run `editorLink`. |
| `source` | `sheet` | `sheet` (Google Sheets) or `eventbrite` (live API, no sheet). |
| `eventbriteOrgId` | `""` | Your Eventbrite organisation id — the number in the organiser URL. Only used when `source: "eventbrite"`. |
| `timezoneOffsetHours` | `0` | Your calendar's UTC offset, used only to decide which day is "today". An events team in UTC+10 sets `10`. |
| `todayOverride` | `""` | `YYYY-MM-DD` pins "today" so you can test the countdown videos. Empty = the real date. |
| `firstReminderDays` | `7` | How many days before the event the countdown video goes out. Minimum 2. |
| `maxRendersPerRun` | `3` | Cap on videos per morning; soonest events win. The rest wait for tomorrow. |
| `brandName` | `Northline Events` | Watermark on every scene. |
| `handle` | `@northline.events` | Appended to the watermark, and used as the CTA line when a row has no `TicketUrl`. |
| `ctaText` | `Get tickets` | Label inside the closing pill. Long labels step down and ellipsise rather than clip. |
| `kickerText` | `YOU'RE INVITED` | Pill on the announcement video, and its closing stamp. The countdown videos compute their own kicker. |
| `promoTease` | `Seats are limited — grab yours while they last.` | Supporting line on the announcement. `{days}`, `{event}` and `{brand}` are substituted. |
| `countdownTease` | `Only {days} days left to claim a spot.` | Supporting line on the countdown video. |
| `finalTease` | `Last call — doors open before you know it.` | Supporting line on the final-call video. |
| `fallbackImageUrl` | a pinned landscape event photo | Used when a row has no `ImageUrl`. Set it to `""` to always use the designed gradient — worth knowing that the gradient reels are noticeably more static than the photo ones (the photo carries a slow push; the gradient does not), so leave a fallback set unless you want a deliberately still, typographic look. |
| `baseColor` | `#0A0A18` | Page colour; every scrim and gradient is mixed from it. |
| `accentColor` | `#FFC64D` | Brand accent on the announcement and countdown videos. |
| `urgentColor` | `#FF5A5F` | Accent for the final-call video only — the alert band, rules and CTA. |
| `textPrimary` | `#FFFFFF` | Headline ink. |
| `textMuted` | `#9A93B0` | Secondary lines and the watermark. |
| `displayFont` | `Space Grotesk` | Event name, countdown number and closing headline. |
| `uiFont` | `Sora` | Labels, detail cards, pills, watermark. One font per text element. |
| `musicUrl` | a pinned instrumental bed | HEAD-checked before every run. Set `""` for silence. |
| `musicVolume` | `0.18` | `0`–`1`. The bed sits low by design. |
| `maxMusicBytes` | `5242880` | Plan cap for an audio asset. A larger file is dropped and the run continues without music. |
| `statusValue` | `promoted` | What gets written to `Status` after the first successful render for an event. |
| `dryRun` | `false` | `false` (default) renders for real. `true` validates, quotes credits and saves a draft per video — no credits, no sheet write. |
| `pollSeconds` | `10` | Render poll interval. |
| `timeoutMinutes` | `20` | Poll loop gives up after this. |

Colour keys accept a 6-digit hex only (`#RRGGBB`); anything else silently falls
back to the default, so a typo can never break a render.

## Cost per video

The live validator quoted **14 credits** for each of the three video kinds — the
announcement (13.6 s), the countdown (13.4 s) and the final call (13.6 s). The
cost does not change with copy length, because the runtime does not.

A run renders 0–`maxRendersPerRun` videos, so a morning costs **0, 14, 28 or 42
credits**. A single event promoted from more than a week out costs **42 credits
in total** across its three videos. *Validate project (free)* runs before every
submission and returns the exact quote per video, reported as `creditsCharged` in
the run summary. Set `dryRun: true` to get the number without the render.

## How it works

| Node | What it does |
| --- | --- |
| **Test manually / Every day at 8am** | Both feed `Config`. The manual trigger is what `n8n execute` uses; the schedule is the countdown engine. |
| **Config** | Every knob in one JSON blob. |
| **Check music** | `HEAD` on `musicUrl`, never errors — it only reports. |
| **Music guard** | Drops the bed when it is unreachable, 4xx/5xx or over `maxMusicBytes`, and says why in `musicNote`. The videos still render, just silent. |
| **Source?** | Routes to Eventbrite or to the sheet on `Config.source`. |
| **Fetch Eventbrite events** | `GET /v3/organizations/{orgId}/events/?status=live&expand=venue&order_by=start_asc&page_size=50`. Bearer Auth. Every field is read defensively — a missing venue or logo never kills the run. There is no pagination loop: it reads the **first 50 live events by start date** and nothing beyond. |
| **Read events sheet** | Reads every row; the Sheets node also emits each row's `row_number`. |
| **Which renders today?** | The brain. Normalises both sources onto one shape, computes `daysUntil` per event, and emits one item per video that is due: `1day` (tomorrow, `Video1d` empty), `7day` (`daysUntil == firstReminderDays`, `Video7d` empty) or `promo` (`Status` empty). The most urgent due kind wins, past events are skipped, rows with an unreadable `DateISO` are reported in `skipped`, and the list is capped at `maxRendersPerRun` soonest-first. |
| **Anything due?** | Nothing due is a normal outcome, not an error. |
| **Nothing due today** | Ends the run with a friendly summary: how many events were checked, and any skipped rows. |
| **Build project JSON** | The whole design: per-kind opening scene, measured detail cards, the closing calendar card, the type ramp, the pill fitter, HTML-escaping of every sheet value, and the API's `name` character rules. One payload per due video. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — schema, plan limits, cost — without spending credits. |
| **Check validation** | Turns a rejection into a readable field list naming the event and the video kind. |
| **Dry run?** | Routes on `Config.dryRun`. `false` by default, so the normal path goes straight to *Submit render*. |
| **Save draft to editor** | **Only when `dryRun: true`.** Saves a free draft per video and returns `editorLink`. Best-effort: a hiccup here never hides the dry-run report. |
| **Dry run summary** | **Only when `dryRun: true`.** Reports quoted credits, `editorLink` and warnings per video, and leaves the sheet untouched. |
| **Submit render** | One paid render per due video. |
| **Attach job to event** | Glues each returned `jobId` back onto its event and drops the payload, so the poll loop stays small. |
| **Wait / Get render status / Merge job status** | The poll loop, one status call per video per lap, re-paired with the event by index. |
| **Render finished?** | Splits finished videos forward; the rest go back round. |
| **Still rendering?** | Fails fast when a job reports `failed` (with its `failedReason`) and stops the loop at `timeoutMinutes`. Nothing has been written back yet, so a failed run simply retries the same event tomorrow. |
| **Prepare write-back** | Builds the exact row the sheet needs. The three URL columns are carried over from the row that was read and only *this* run's column is replaced, so a final-call video never wipes the announcement URL sitting next to it. |
| **Sheet mode?** | Skips the sheet write in Eventbrite mode, where there is no row. |
| **Update event row** | Updates exactly the matched row (on `row_number`): `Status`, plus `PromoUrl` / `Video7d` / `Video1d` by kind. |
| **Run summary** | One item per video: `kind`, `daysUntil`, `videoUrl`, `creditsCharged`, `sheetRow`, `musicNote`. |
| **▶ Watch video** | Downloads each finished MP4 as binary so n8n plays it inline — one player per video made this morning. Never fails the run: it retries a few times (the CDN can 404 for a moment right after a render) and then continues, since the sheet is already written. |

**Eventbrite mode has no sheet to write to**, so it remembers what it has already
sent in the workflow's own static data instead. That memory is written only after
a render succeeds, and deleting the workflow resets it.

## Publishing (optional tail)

The required path ends with the URLs in your sheet. To auto-publish, extend after
*Update event row*:

- **YouTube Shorts / Reels** — HTTP Request node (GET `videoUrl`, response format
  *File*) → native **YouTube** node (Video → Upload, binary `data`). Needs
  YouTube OAuth2.
- **Instagram / TikTok / multi-platform** — pass `videoUrl` to a scheduler such
  as Blotato, Buffer or Metricool over their HTTP API; they take a public video
  URL directly, no download step.
- **Email the ticket-holder list** — an Email node with `videoUrl` and the ticket
  link works well for the day-before video.

These stay out of the required path so the import runs with a Zvid key and a
Google account, nothing else. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and
replace the render HTTP nodes with the native **Zvid** node + **Zvid Trigger**
(render webhook), which removes the poll loop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Run says `No event needs a video today` | Correct behaviour, not an error: every event either has its videos already or is not at a milestone. Add an event, clear one of its URL cells, or set `todayOverride` to a milestone date to rehearse. |
| `DateISO "..." is not YYYY-MM-DD` in `skipped` | That row's date could not be read at all. Sheets sometimes reformats a typed date — set the column format to *Plain text* and retype it. (If the date parses but the *time* is impossible — `2026-08-22T99:99` — the run fails loudly on that event with `has an impossible start time` rather than printing "Doors 3:99 PM" on a paid render.) |
| An event never got its announcement | It was first seen *on* one of its milestone days, so the more urgent countdown or final-call video won and `Status` was filled by that render. Clear `Status` (and leave `PromoUrl` empty) to get the announcement on the next run. |
| The countdown says the wrong number of days | `timezoneOffsetHours` is the only knob that moves "today". n8n runs on UTC by default; an events team in UTC+10 sets `10`. The printed date and start time are never converted. |
| A 7-day video never appeared | The run has to happen *on* the day `daysUntil == firstReminderDays`. If the workflow was inactive that morning, that milestone is simply missed — the day-before video still goes out. Add events more than a week ahead to get all three. |
| Same video made twice | Its column was cleared, or the row was re-added with different text. `EventName` + `DateISO` identifies an event in Eventbrite mode; in sheet mode the URL cells are the record. |
| Wrong row updated | Do not sort or delete rows while a run is in flight; the update matches on the `row_number` captured at read time. |
| Only some events rendered | `maxRendersPerRun` capped the run — the summary reports `deferred`. The soonest events go first; the rest render tomorrow. |
| The video has no music | Deliberate. `musicNote` in the summary says whether the URL was unreachable, refused, or over `maxMusicBytes` (5 MB plan cap). |
| The photo is missing and the video shows a gradient | The row had no `ImageUrl` and `fallbackImageUrl` is empty, or the URL is not a public direct link to an image. Google Drive *share* links are not direct links. |
| `Zvid rejected the ... video` | The message lists the offending fields. If you edited the builder, note the API only allows letters, digits, spaces, `_` and `-` in `name`, rejects `audios[].track`, and rejects `fitToBox`. |
| Render failed and the sheet stayed empty | Intentional — the row is only written after a successful render, so tomorrow's run retries it. The error carries the job's `failedReason`. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a day never hits it; back-to-back manual test runs can, especially since a run can submit up to `maxRendersPerRun` renders at once. Nothing is charged for a rejected submit. |
| Eventbrite answered `HTTP 401` / `404` | The Bearer credential is missing or the token is wrong (401) — see Setup step 8 — or `eventbriteOrgId` is not one of your organisations (404). The id is the number in your organiser URL. |
| Eventbrite mode misses some events | The node fetches the first **50** live events ordered by start date, with no pagination loop. Anything past 50 is invisible to the run. If your catalogue is larger, use sheet mode or add your own pagination after *Fetch Eventbrite events*. |
| The photo behind an event shows a logo, a shopfront sign or someone's face | Change that row's `ImageUrl`. Your event name, CTA and ticket link are composited over that picture, so a recognisable brand or person underneath reads as an endorsement of your event that you have not been given. Wide venue, skyline, interior and texture shots are safe; empty `ImageUrl` falls back to the designed gradient, which is always safe. |
| A gradient (no-photo) reel feels like a slideshow | Expected. The photo backdrops carry a slow push and the designed gradient does not, so a no-photo reel is roughly two-thirds still frames. Set `fallbackImageUrl` (or fill `ImageUrl`) if you want the motion. |

## Verified

n8n **2.29.10** node types and versions (every node resolves in a stock install;
the two Google Sheets nodes use the same shapes as the other templates in this
series). Here is exactly what was verified, and what was not:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the
  render farm runs) six times, from the builder's real output, covering the six
  branches below:
  - **announcement**, photo backdrop, 23-character event name, full date + time,
    venue + city, ticket link — 13.60 s, 1080×1920 @ 30 fps.
  - **countdown**, photo backdrop, single-digit number (7 days) — 13.40 s.
  - **final call** stress case: 64-character event name (three lines at 58 px),
    28-character venue, 30-character city, 87-character ticket link, a
    19-character CTA label and a 30-character brand name — 13.60 s.
  - **countdown** stress case with **no photo** (designed gradient), a two-digit
    number, no city, no start time and no ticket link, so the cards that lose a
    line and the CTA's handle fallback are both exercised — 13.40 s.
  - **announcement** edge case with **no photo**, an 11-character name at the
    112 px top of the type ramp, a 43-character venue that wraps to **two lines**
    (the WHERE card grows 79 px and pushes the two cards below it down), a
    three-line supporting line, `daysUntil == 0` ("Starts today") and a
    30-character CTA label that forces the pill's type step-down — 13.60 s.
  - **final call** edge case with **no photo**, a 76-character name at the 50 px
    floor of the type ramp, **no venue** ("Venue announced soon") and no ticket
    link, so the closing scene shows the handle in the link slot and drops it
    from the watermark — 13.60 s.

  **Every extracted frame was reviewed** — 27 frames at 2 fps per video, plus
  exact-timestamp grabs at both transition midpoints and the final frame, plus
  two full-resolution crops per video across the scene 2 → 3 cut: 192 images in
  total. The 2 fps sweep was read at 360 px wide (a defect sweep: clipping,
  overflow, collisions, duplicated copy, half-finished animation); the
  transition grabs and closing frames were read at 560 px and the transition
  crops at native 1080 px width. No clipping, no overflow, no text touching an
  edge, no low-contrast text on either backdrop, no half-broken animation state
  left on screen, and every value substituted (no `{{`, `undefined` or `NaN`).
- **Two duplicated-headline defects were found by that frame review and fixed.**
  At the scene 2 → 3 crossfade, and again at the scene 1 → 2 crossfade of the
  countdown layout, the event name was landing at two baselines a few dozen
  pixels apart for the full half-second of the dissolve. Both scenes now wait
  for the cut to finish before fading their own copy of the name in, and the
  transition-midpoint crops of all six renders show a single copy of the name.
  The same pass also removed a duplicated social handle from the closing frame
  of the no-ticket-link branch, and replaced the final call's hard `wipeup` with
  a soft `smoothdown` (the hard wipe revealed the incoming detail scene at
  t = 0 of its own entrance stagger, showing three empty card shells).
- **Backdrop imagery was checked for brand and likeness exposure.** The two
  pinned photos are a heavily scrimmed low-light venue interior and a set of
  empty theatre seats; at full resolution neither carries a legible logo,
  wordmark, shopfront sign or resolvable face, and no price or first-person
  claim is placed over a person. Because the whole point of the template is that
  installers supply their own `ImageUrl`, the guidance for choosing safe photos
  is repeated in Setup step 4, in the sheet-schema sticky note and in
  Troubleshooting.
- **Contrast on the alert band was measured, not eyeballed.** The final-call
  band started as a translucent rectangle and measured ~2.4:1 against its own
  label over a bright photo — under the 3:1 floor for large type. It ships as an
  opaque bar with the label inverted to `baseColor`, which holds ~6:1 on any
  backdrop and also lets the API's contrast lint see a real text/background pair.
- **Remote validation against the live API** (`POST /api/render/validate/api-key`
  via MCP with `remote: true`). Every one of the six payloads has been through
  it; being exact about when, because the builder was revised during this pass:
  - `announcement / photo` was validated against the **shipped** builder:
    `valid: true`, **0 errors, 0 warnings**, `creditsRequired: 14`, resolved
    duration 13.6 s, schema **1.0.0**.
  - `announcement / gradient` (the two-line venue case) and
    `final call / gradient` returned exactly the same result one revision
    earlier — a revision whose only difference from the shipped one is the
    entrance window of a single TEXT element, which moves nothing on the canvas.
  - `countdown / photo`, `countdown / gradient` and `final call / photo`
    returned the same result during the independent structure review, before the
    duplicated-headline and duplicated-handle fixes; those fixes changed three
    elements' entrance times and one watermark string, and no geometry.

  Zero layout-lint warnings on any of them, which is why every TEXT element
  declares `style.color` — the lint reads `style`, not the CSS inside `html`.
  Three real API rules were caught and fixed this way while authoring (`name`
  character set, `audios[].track` rejected, `fitToBox` rejected). Local
  validation (the same rule set, run offline) passes on all six of the shipped
  payloads.
- **Every pinned URL probed at authoring time** — the fallback background image
  and the music bed (3.7 MB, comfortably under the 5 MB plan cap).
- **The embedded `Build project JSON` code is byte-identical** to the
  frame-reviewed standalone builder (asserted programmatically by comparing the
  strings, not by eye), as are the other ten code nodes. A simulated execution of
  the node's JS against mocked n8n globals produced the exact reviewed payloads.
- **Structural checks** on the workflow JSON: parseable, every connection
  resolves to a node that exists, no orphans (everything except the two triggers
  is a connection target), core-only node types, no credential blocks shipped,
  Zvid calls on Header Auth. The only nodes with no outgoing connection are the
  three intended terminals — `Nothing due today`, `Dry run summary` and
  `▶ Watch video`.

**Not executed:** nothing in the publish/delivery tail — no social platform, no
email provider. Those nodes are documented, not exercised. The Eventbrite branch
is written against the documented v3 response shape and read defensively, but it
was not called against a live Eventbrite account.
