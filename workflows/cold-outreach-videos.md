# Personalised cold outreach videos for a whole lead list

[`zvid-cold-outreach-videos.json`](zvid-cold-outreach-videos.json)

Point this workflow at a Google Sheet of leads and every row without a video yet
becomes its own ~11.8-second 1920×1080 outreach video — *their* first name, *their*
company, *their* logo, *their* role — and the whole list goes up as **one Zvid bulk
render**. When the batch finishes, each video's URL is written back to that lead's
row. Personalised video lifts reply rates; the reason nobody does it at 200
leads a week is that recording 200 clips is impossible. This makes it one API call.

```
Schedule (weekly) / Manual ─▶ Config ─▶ Read leads sheet ─▶ Pick batch (empty Status)
        ─▶ HEAD each logo ─▶ Build ONE templated payload + per-lead variables
        ─▶ Validate (free) ─▶ dry run? (opt-in) ─▶ quote + editor draft
                                    OR          ─▶ Bulk render ─▶ Poll batch
        ─▶ Write VideoUrl back to each row ─▶ Run summary  +  ▶ Watch video
```

## Why this one is different

**One API call for the whole list.** Most "personalised video" automations loop a
render per lead and babysit N jobs. Zvid's bulk endpoint takes one shared payload
plus a tiny `variables` set per row, resolves and validates every item server-side
and queues them together — this workflow submits ten leads as one request and polls
one batch id. You also get **one credit quote for the whole batch before anything is
submitted**, so the spend is never a surprise.

**No screenshot service, no scraping, no rendering farm of one-offs.** What is
personalised is name, company, logo/monogram and role — data you already have in a
CRM export. There is no website-screenshot API to pay for, no per-lead media to
fetch, and no stock footage at all: just type, the two logos and a soft music bed.
That is also why it does not read as an ad.

**Leads without a logo still get a designed video.** *Check lead logos* HEADs every
`LogoUrl` before the batch goes up. A dead link, a non-image content type or an
oversized file quietly downgrades that lead to a **monogram chip** — the first letter
of their company on a tint derived from the company name, so the same company always
gets the same colour. A CDN that refuses HEAD (405/501) is trusted rather than
punished. The template carries both variants behind `condition` blocks, so one batch
can mix logo leads and monogram leads freely.

**The design survives ugly CRM data.** Real lead lists contain
`Anne-Charlotte Wyndhamme` and `Sable & Wren <Holdings> International Ltd`. The
greeting steps 128 → 50 px so a 24-character first name still sets on one line; the
scene-2 headline steps 76 → 44 px; both growing blocks are **bottom-anchored**, so an
extra line grows *upward* into empty space instead of colliding with the line below;
and every sheet value is HTML-escaped before it touches the markup. A two-line CTA
lifts the whole end-card stack rather than crowding the sign-off. All of it was
rendered on the production engine and reviewed frame by frame.

**Bad rows never sink the batch.** A row missing `FirstName` or `Company` is skipped
with a named reason. An item the API rejects at submit time is reported per row while
the rest render. A lead whose render fails keeps an empty `Status`, so the next
scheduled run picks up exactly that lead — the sheet converges on "done". Failed
renders are refunded automatically.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test a small batch. |
| Google Sheets credential | The standard n8n Google Sheets OAuth credential — used to read the lead list and write the URLs back. |

No LLM, no voice service, no screenshot API, no stock-media account. The music bed is
a plain audio URL you can swap or clear in `Config`.

## The sheet

Header row (exact names, one lead per row):

```
FirstName | Company | Website | LogoUrl | Role | Status | VideoUrl
```

- **`Status` empty** → the lead is waiting for a video. After a successful render the
  row gets `done` plus the video URL. Clear `Status` to re-record a lead.
- **Required per row:** `FirstName` and `Company`. Rows missing either are skipped
  with a named reason in the run output.
- **`LogoUrl` optional.** Leave it empty (or point it at something that is not an
  image) and the lead gets a monogram chip instead. When you do have one, use a plain
  `https://…` URL — a transparent PNG or an SVG on a light background looks best,
  since it sits on a white card. Anything that is not a plain `https://` URL is
  skipped with that reason rather than injected into the markup.
- **Put only the mark that company actually uses in `LogoUrl`** — and only your own in
  `senderLogoUrl`. Whatever is in that cell is presented on screen as that company's
  identity, right next to a first-person pitch signed by you, so a stock photo, a
  screenshot, a picture of a person or some other company's mark dropped in as a
  placeholder makes the video assert something untrue about both of you (and puts
  someone else's trademark in your outreach). **An empty cell is always the safe
  answer** — the monogram chip is designed to cover exactly this case.
- **`Website` optional** — shows as a small domain caption under the lead's logo
  (host only, so `https://acme.example/about` renders as `acme.example`).
- **`Role` optional** — becomes the *"Written with a VP of Marketing in mind."* line,
  with correct `a`/`an` for initialisms ("an SDR", "a VP"). Empty falls back to
  *"Written for the team at {Company}."*
- More pending leads than `maxPerRun`? The overflow is reported as `leftForNextRun`
  and handled on the next run.

## Setup

1. **Import** `zvid-cold-outreach-videos.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Validate project (free)*, *Save draft to
   editor*, *Submit bulk render* and *Get batch status*.
3. **Google Sheets credential** — attach it to *Read leads sheet* AND *Write URLs
   back*, and pick your spreadsheet + tab in **both** nodes.
4. **Create the sheet** with the header row above and add a few leads with `Status`
   and `VideoUrl` empty.
5. **Open `Config`** and make it yours: `senderName`, `senderTitle`, `senderCompany`,
   `senderLogoUrl`, `brandColor`/`accentColor`, the three `pitchPoints`, `ctaText`
   and `meetingUrl`.

   **Use only marks you are entitled to use.** `senderLogoUrl` is *your* logo;
   `LogoUrl` in the sheet is *that lead's* logo. Do not paste a stock photo, a
   screenshot, a picture of a person or another company's mark in as a stand-in
   while you are testing — the video presents whatever is there as that company's
   identity beside a first-person claim you signed. Leave `senderLogoUrl` at its
   shipped `""` (your initials are drawn instead) and leave `LogoUrl` empty (the lead
   gets a monogram) until you have the real files.
6. **Run it.** The workflow renders for real out of the box, so **the first run spends
   credits — 12 per lead**, i.e. ~120 for a full default batch of 10. For your first
   test, set `maxPerRun` to `1` or `2` so the batch is cheap. When it finishes, click
   **`▶ Watch video`** to play the videos inside n8n, one item per lead.

   Prefer a free look first? Set `dryRun: true` in `Config` before that first run: you
   get the exact per-video price, the whole-batch total, a per-lead list of who gets a
   logo and who gets a monogram, and an **`editorLink`** that opens the first lead's
   video as a draft in the Zvid editor — nothing charged, nothing written to the sheet.
   Set it back to `false` to render.
7. **Free plans cap a bulk request at 5 items.** Set `maxPerRun` to `5` there, or
   raise it on a paid plan.
8. **Activate.** It works the list every Tuesday at 9am.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base. Leave it. |
| `maxPerRun` | `10` | Leads per run. **Free plans allow 5 items per bulk request** — lower it there. Overflow is reported as `leftForNextRun`. Use `1`–`2` for your first paid test. |
| `senderName` | `Rita Mendes` | Sign-off name on scenes 1 and 3. |
| `senderTitle` | `Partnerships lead` | Second sign-off line, before the company. |
| `senderCompany` | `Northbeam` | Wordmark top-left, the left logo tile's caption, and the scene-2 footer. |
| `senderLogoUrl` | `""` | Your logo, as a plain `https://…` URL. **Empty (the shipped default) draws your own initials in a brand-tinted circle instead**, so the template looks finished before you have uploaded anything. A malformed URL falls back to the same monogram rather than a broken image in every video of the batch. |
| `brandColor` | `#1B3B5A` | The end card's field, the wordmark, the pill text. |
| `accentColor` | `#A85F22` | The corner tick, the row numbers, the small connector dot. |
| `paperColor` | `#F2EFE9` | Scene 1 + 2 background, and the light type on the end card. |
| `inkColor` | `#131A22` | Body/headline ink on the paper scenes. |
| `displayFont` | `Fraunces` | Serif that carries the greeting, headline and CTA. Google-font name. |
| `uiFont` | `Archivo` | Sans that carries everything else. One font per text element. |
| `introLine` | `I put this together just for` | Scene 1 subline; the lead's company and a full stop are appended. |
| `pitchKicker` | `Why I'm reaching out` | Small caps line at the top of scene 2 (upper-cased for you). |
| `pitchHeadline` | `Here's why I thought of` | Scene 2 headline prefix; the lead's company is appended. |
| `pitchPoints` | three lines | **2–3 short lines**, one per row of scene 2. Anything past the third is ignored; each is capped at 112 characters. With two points the row block re-centres so scene 2 does not open a hole above the footer rule. An empty array fails the run loudly rather than shipping an empty scene. |
| `ctaText` | `Worth fifteen minutes?` | End-card headline. Auto-sizes 78 → 48 px; a two-line CTA lifts the whole stack so the meeting pill never crowds the sign-off. |
| `meetingUrl` | `https://cal.com/rita-mendes/15min` | Shown as a tidy label (`cal.com/rita-mendes/15min`) in the end-card pill and in the scene-2 footer. Not a clickable link — video. **Keep it under 42 characters after the `https://`**: a longer booking path would have to be cut mid-slug, so the pill falls back to the bare host (`cal.com`) rather than showing a link nobody can retype. |
| `musicUrl` | a hosted CDN track | Swap for your own hosted audio URL, or set it to `""` for silent videos (the run summary then says *no musicUrl in Config*, not an error). |
| `musicVolume` | `0.12` | The bed sits low by design — this should feel like a note, not an ad. |
| `maxMusicBytes` | `5242880` | *Check music track* HEADs `musicUrl` first and the bed is kept **only** on a `200` (or a `405`/`501`, i.e. a host that serves GET but refuses HEAD). Anything else — a 4xx/5xx, a redirect that does not resolve, a DNS/TLS failure, a 15-second timeout, or a file larger than this — renders the batch **without music** instead of failing every video in it. 5 MB is the free plan's audio cap. |
| `maxLogoBytes` | `2097152` | Same idea for lead logos: over this size and the lead gets a monogram. |
| `frameRate` | `30` | Output frame rate. The canvas is a fixed 1920×1080. |
| `bulkName` | `Cold outreach videos` | The batch's name in your dashboard at [app.zvid.io](https://app.zvid.io). |
| `statusDoneValue` | `done` | What gets written to `Status` after a successful render. |
| `dryRun` | `false` | Renders for real by default — a run costs credits. Set it to `true` for a free pass that validates the batch, quotes the credits (per video **and** for the whole list) and saves the first lead's video as a draft you can watch in the editor, without spending anything and without touching the sheet. |
| `pollSeconds` | `10` | Batch poll interval. |
| `timeoutMinutes` | `30` | Poll ceiling. Ten videos share the render queue, hence 30 rather than 20 — raise it for longer lists. A timeout does **not** cancel anything. |

*Optional:* add an `editorUrl` key if your dry-run links should point somewhere other
than [editor.zvid.io](https://editor.zvid.io).

## Cost per video

The production validator quotes **12 credits** for this ~11.8-second 1920×1080
design, so a default batch of 10 leads is **120 credits** and a 2-lead test is **24**.
Every run starts with the free `POST /api/render/validate/api-key` step, which returns
the exact per-video price for *your* Config and multiplies it by the lead count into
`totalCredits` — the whole-batch number is known *before* the batch is submitted. With
the default `dryRun: false` the render then proceeds automatically; set `dryRun: true`
if you want the quote without the spend. Failed renders are refunded automatically, and
the whole batch is rejected up-front (nothing charged) if your balance cannot cover it.

## How it works

| Node | What it does |
| --- | --- |
| **Test manually / Every Tuesday at 9am** | Both feed `Config`. The manual trigger is what `n8n execute --id` needs. |
| **Config** | Every knob in one raw-JSON `Set` node. |
| **Check music track** | HEADs `musicUrl` (never errors). The bed survives only on a positive answer; anything else — unreachable, non-200, oversized — drops the music instead of failing the batch. |
| **Read leads sheet** | Reads every row; the sheet node also emits each row's `row_number`. |
| **Pick batch** | Keeps rows with an empty `Status`, requires `FirstName` + `Company`, rejects a `LogoUrl` that is not a plain `https://` URL, caps the batch at `maxPerRun`, and reports skipped rows with reasons. A lead with no `LogoUrl` is already decided (monogram) before any probe runs; it is still given the API root as a placeholder probe URL purely so the HEAD node emits one item per lead and the two lists stay aligned. |
| **Leads found?** | No usable pending rows → *Nothing to send today* ends the run with a friendly summary instead of an error. |
| **Check lead logos** | One HEAD per lead (never errors). Feeds the logo-vs-monogram decision: only definitive evidence (4xx/5xx, non-image content type, over `maxLogoBytes`) downgrades a lead. |
| **Build project JSON** | The whole design lives here. Emits ONE templated project (every Config value baked in as a literal, every per-lead value as a `{{placeholder}}`) plus one `{ variables, name }` item per lead — per-lead type auto-sizing, the `a`/`an` role line, the monogram tint, and HTML-escaping of every sheet value. |
| **Validate project (free)** | `POST /api/render/validate/api-key` with the template **and the first lead's variables** — the same resolve+validate pipeline every bulk item runs. Returns the per-video credit price and the fully resolved first video. Failures surface as a field list. |
| **Check validation** | Fails loudly on a non-200, listing the offending fields; carries `payload`, `items`, `creditsPerVideo`, `totalCredits`, warnings and the resolved first video forward. |
| **Dry run?** | Routes on `Config.dryRun`. It is `false` by default, so the normal path goes straight to the bulk render. |
| **Save draft to editor / Dry run summary** | *Only when `dryRun: true`.* Saves the first lead's resolved video as a free draft and reports the per-video and whole-batch quote, the per-lead logo/monogram plan, skipped rows, `leftForNextRun` and the `editorLink`. Best-effort: a hiccup saving the draft never hides the credit quote. |
| **Submit bulk render** | `POST /api/render/bulk/api-key` with `{ name, payload, items }` — one call for the whole list. |
| **Check batch accepted** | Reads the 202: keeps `bulkId` and the `jobId → lead` map, and names any per-item rejections by sheet row. |
| **Wait / Get batch status / All finished?** | Polls `GET /api/render/bulk/{id}` every `pollSeconds` until `bulk.status` leaves `processing`. |
| **Still rendering?** | Fails fast when the whole batch failed; stops the loop at `timeoutMinutes` with a message naming how many finished. A timeout does not cancel renders — they finish server-side at [app.zvid.io](https://app.zvid.io). |
| **Collect finished videos** | Maps completed jobs back to leads **via the submit-time `jobId` map, never by name** (job names stay `NULL` until a job completes), and emits one item per video shaped for the Sheets update. Leads that failed are named and keep an empty `Status`. |
| **Write URLs back** | Google Sheets *update*, matched on `row_number`: `Status` = `done`, `VideoUrl` = the finished MP4. Runs with `alwaysOutputData` so a zero-match write cannot end the branch silently. |
| **Run summary** | **One item per video** — lead, company, role, logo mode, sheet row, `videoUrl`, credits used — plus a `batch` block with the totals, per-lead failures, rows skipped before submit and `leftForNextRun`. It also warns explicitly if videos rendered but the sheet write matched no rows. |
| **▶ Watch video** | Downloads each finished MP4 as binary (`responseFormat: file`) so n8n's output panel plays it **inline** with a download button — one item per lead. Never fails a run: `onError: continueRegularOutput` plus 3 retries, because the CDN can 404 for a moment right after a render completes. |

## The video itself

Three scenes, 3.8 s + 5.0 s + 4.0 s, with a 0.55 s fade into scene 2 and a 0.5 s fade
into scene 3 = **11.75 s**. No video elements at all, so the free plan's
5-video-element cap is never a concern.

1. **Hello** — sender wordmark and a hairline rule, then *"Hi {FirstName},"* set large
   in the display serif with *"{introLine} {Company}."* beneath it. On the right, two
   white cards side by side: your mark and theirs (logo or monogram), each captioned,
   with the lead's website domain under their name. Sign-off bottom-left.
2. **Why** — kicker, *"{pitchHeadline} {Company}"*, the role line, then the two or
   three pitch points as a numbered editorial list on hairline rows, staggered in from
   the left. The headline waits for the incoming fade to finish before it animates, so
   the two scenes never stack the lead's company name on top of itself. Footer: your
   company and the meeting domain.
3. **The ask** — brand field with a soft glow and a hairline frame, your mark on a
   white card, the CTA headline, a personal line that opens with the lead's first name,
   the meeting link in a paper pill, and the sign-off.

## Publishing (optional tail)

The required path ends with a video URL in every lead row — deliberately, so the
import runs with a Zvid key and a Google account and nothing else. To send, extend
after *Run summary* (one item per lead, each carrying `videoUrl`, `firstName`,
`company`, `role`, `sheetRow`):

- **Email** — a Gmail / Microsoft Outlook / Send Email node. Put the video **as a link
  in the body, never as an attachment**: a multi-megabyte MP4 attachment is a
  spam-filter magnet and wrecks deliverability on a cold list, while a link lets you
  see who actually watched. A thumbnail image linking to the URL is the usual pattern.
- **Sequencer** — pass `videoUrl` to Lemlist, Instantly, Smartlead or HeyReach over
  their HTTP API as a custom variable on the lead.
- **CRM** — write `videoUrl` back onto the HubSpot/Pipedrive contact so the rep can
  send it by hand.
- **Human in the loop** — a Slack node with the lead name and URL for whoever sends.

These stay out of the required path. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and swap
*Validate project (free)* → **Zvid → Render → Validate**, *Submit bulk render* →
**Zvid → Render → Create Bulk**, and *Get batch status* + *Wait* → **Zvid Trigger**
(render webhook), which removes the poll loop. The HTTP nodes are deliberately
core-only so the workflow also imports untouched on n8n Cloud.

## Feeding it from a CRM instead of a sheet

Replace *Read leads sheet* with a HubSpot, Apollo or Salesforce node and map their
fields onto the same names — everything downstream is unchanged, because *Pick batch*
only reads those keys plus `row_number`.

| Sheet column | HubSpot contact property | Apollo person field |
| --- | --- | --- |
| `FirstName` | `firstname` | `first_name` |
| `Company` | `company` (or the associated company's `name`) | `organization.name` |
| `Website` | `website` (or company `domain`) | `organization.website_url` |
| `LogoUrl` | no native property — use a custom property, or leave empty for the monogram | `organization.logo_url` |
| `Role` | `jobtitle` | `title` |
| `Status` / `VideoUrl` | two custom contact properties you create | write back via their API |

Two things to keep when you swap:

- **Keep a write-back step.** `Status` is what stops the same lead being recorded
  twice; with a CRM source, filter on your own custom property instead and write the
  video URL back to it.
- **Keep something stable to match on.** The Sheets path matches the update on
  `row_number`; a CRM path should carry the record id through *Pick batch* and use that.

This is documented, not built: the shipped workflow's demo path runs from a Google
Sheet with zero extra keys.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Run says `No lead rows with an empty Status column` | Every row is already recorded. Add leads, or clear `Status` on the ones you want re-recorded. |
| Rows silently missing from a batch | They were skipped before submit — check `rowsSkipped` / `rowsSkippedBeforeSubmit` in the run output; each entry names the row and the problem (`FirstName is empty`, `Company is empty`, `LogoUrl is not a plain https URL`). |
| `Config.pitchPoints is empty` | Add two or three short lines to `pitchPoints` in `Config`. |
| `Zvid rejected the project (HTTP 400)` | The message lists the offending fields. If you edited the builder: the API only allows letters, digits, spaces, `_` and `-` in `name`, and it rejects `audios[].track`. |
| `Bulk limit exceeded` | `maxPerRun` is above your plan's bulk item cap (5 on free plans). Lower it or upgrade. |
| `Insufficient credits` | The 402 names the exact total required. Nothing was queued or charged. |
| A lead got a monogram when they have a logo | *Check lead logos* saw definitive evidence against it: a 4xx/5xx, a non-image content type, or a file over `maxLogoBytes`. The reason is in `logoReason` per lead. A CDN that only refuses HEAD (405/501) is trusted, so that is not the cause. |
| Videos rendered but the sheet is empty | *Write URLs back* lost its matching column — n8n's Sheets node rebuilds its column list whenever the node is opened and marks `row_number` as *removed*, which can re-point "Column to match on". Open the node and set it back to **row_number**. `Run summary` says so explicitly and lists every URL, and the rows re-render on the next run. |
| Wrong row updated | Do not sort or delete rows while a run is in flight; the update matches on the `row_number` captured at read time. |
| Some leads have no URL after a run | See `failed` in the run summary — each entry carries the row, the lead and the reason. Those rows keep an empty `Status` and are retried next run; failed renders are refunded. |
| `did not finish within N minutes` | Big batch or busy queue. The renders continue server-side — check [app.zvid.io](https://app.zvid.io) before re-running (a re-run re-renders leads whose `Status` is still empty), or raise `timeoutMinutes`. |
| Videos have no music | The music guard dropped it — `music` in the run summary says exactly why: an HTTP status, *got no answer (unreachable, blocked or timed out)*, a size in KB, or *no musicUrl in Config* if you cleared it on purpose. The guard is deliberately strict: a bed it cannot confirm would fail **every** video in the batch at encode time, so it is dropped instead. Host the file somewhere that answers a plain `HEAD` with `200`. |
| A lead's video shows the wrong company's logo | Whatever is in that row's `LogoUrl` is drawn as that company's mark, next to a pitch signed by you — so a stock photo, a screenshot or another company's logo pasted in as a placeholder ends up asserting something untrue (and puts a third party's trademark in your outreach). Clear the cell: the monogram chip is the designed fallback. Same rule for `senderLogoUrl` — your own mark only. |
| `The 'Sheet' … could not be found` | Pick the spreadsheet + tab in *both* Google Sheets nodes after importing. |
| `429` / `hourly_limit_exceeded` on submit | The batch exceeds what is left of your plan's hourly render limit (every item in the batch counts). The message names the remaining allowance and the reset time; lower `maxPerRun` or wait it out. Nothing is charged for a rejected submit. |

## Verified

n8n node types and versions follow the same conventions as the rest of this series
(core nodes only; `httpRequest` 4.2, `code` 2, `set` 3.4, `if` 2.2, `wait` 1.1,
`googleSheets` 4.7, `scheduleTrigger` 1.2, `manualTrigger` 1, `stickyNote` 1).

**Rendered on the production engine, frame by frame.** Three fixtures were built with
the exact builder embedded in the workflow, resolved with orch's real template engine,
and **six** of their resolved lead videos were rendered through the production
`@zvid-io/zvid` renderer at 1920×1080 (ffprobe: 1920×1080, h264+aac, 30 fps,
11.766667 s each):

- *default* — a 3-lead batch: lead 1 with a logo, lead 3 with no `LogoUrl`
  (monogram path), sender logo present. Items 1 and 3 were rendered.
- *stress* — a 10-lead batch at the cap: a 24-character first name, a 40-character
  company, a 58-character role, a photo-as-logo whose URL contains an `&`, a logo URL
  that answers `404`, a logo URL that answers with JSON, an oversized logo, a CDN that
  refuses HEAD, 110-character pitch points, an empty `senderLogoUrl` (sender-monogram
  path), a CTA long enough to set on two lines and a booking link long enough to force
  the host-only pill. Items 1–3 were rendered.
- *twopoint* — the documented two-`pitchPoints` configuration, to prove the scene-2 row
  block re-centres instead of leaving a hole above the footer rule. Item 1 was rendered.

Between them the six renders exercise every layout branch the template has: lead logo
**and** lead monogram, sender logo **and** sender initials, **two and three** pitch-point
rows, one-line **and** two-line headline, one-line **and** two-line CTA, a full booking
label **and** the host-only fallback, a lead with no website and a lead with no role, and
HTML-hostile data (`Sable & Wren <Holdings>`, `Jean-Sébastien O"Brien`) rendering as
text rather than markup. The greeting is *not* claimed both ways: it is auto-sized onto a
single line at every step of its 128 → 50 px ladder, and all six renders show it that way.

**Every extracted frame was reviewed** — 2 fps plus exact-timestamp grabs at both true
transition midpoints (3.525 s and 8.00 s) and the final frame, **162 frames** in total
(6 × 27). Frames were read at 800 px wide, with full-resolution crops taken of the logo
cards, their captions and the scene-2 row gutters where 800 px was not enough to rule out
a defect. No clipping, no overflow, nothing touching a rule or an edge, contrast holding
on both the paper and the brand-field scenes, no unresolved `{{placeholder}}`, no
`undefined`/`NaN` (also grepped in all six resolved payloads: zero hits), and clean
animation beats at every half-second grab — including the scene-1 → scene-2 dissolve,
which no longer double-exposes the lead's company name.

**Every fixture asset is generic.** The lead and sender marks in the fixtures are
invented placeholder wordmarks and one abstract, person-free pattern — no real company
logo, no product shot, no identifiable person appears in any rendered frame.

**Validated against the live API.** Three payload shapes covering every distinct element
and geometry combination the template can emit were run through
`POST /api/render/validate/api-key` (via the Zvid MCP validator, `remote: true`):

1. *default* item 1 — three rows, one-line CTA, **both** marks drawn as `<img>`;
2. *stress* item 2 — three rows, two-line CTA geometry (392 / 606 / 724), **both** marks
   drawn as monogram chips, entity-escaped text, host-only pill;
3. *twopoint* item 1 — **two** rows, the re-centred row block and its two hairline rules.

Every one returned `valid: true`, **0 errors, 0 warnings** (including zero layout-lint
warnings — no overlap, no off-canvas box, no low-contrast text), `creditsRequired: 12`,
schema **1.0.0**, resolved `duration: 11.75`. The remaining three rendered payloads
(*default* item 3, *stress* items 1 and 3) differ from a validated one only in text
content and in which of the two mutually exclusive mark variants occupies the identical
240×140 box, both of which are covered above. The canvas is stated as explicit 1920×1080
pixels rather than a resolution preset precisely so the layout linter runs its bounds and
overlap checks at all.

**The embedded code node is byte-identical** to the frame-reviewed standalone builder
— asserted programmatically (32,836 bytes / 32,777 characters, SHA-256
`aec072e7…733a0a47` on both sides), not by eye — and a simulated execution of that JS
against mocked n8n globals produced the exact payloads that were rendered and validated.
The music guard was additionally exercised against eight mocked HEAD outcomes
(200, unreachable, timeout, 404, 301, 405, oversized, and `musicUrl` cleared): the bed
survives only the `200` and the `405`, and the summary text names the reason in every
other case.

**Structural checks** on the workflow JSON: parseable, 32 nodes with unique names and
ids, every connection resolves, every code node compiles, core-only node types, seven
sticky notes, no `credentials` blocks and no API-key literal anywhere in the file, all
four Zvid API calls on Header Auth, `Config` carrying every required knob with
`dryRun: false` and `apiUrl: https://api.zvid.io`, and the `▶ Watch video` node matching
the series contract exactly.

**Not executed:** the workflow has not been run inside n8n as part of this pass — the
evidence above is the production renderer plus the live validator, not an n8n
execution. Nothing in the publish/delivery tail has been exercised either: no email
provider, no sequencer, no CRM. Those nodes are documented, not built.
