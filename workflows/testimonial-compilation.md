# Monthly customer-testimonial compilation video

[`zvid-testimonial-compilation.json`](zvid-testimonial-compilation.json)

On the 1st of every month: collect the testimonials you ticked **Featured** in a
Google Sheet, cut them into ONE polished 1080×1080 square video — an intro card,
a designed scene per quote (serif quote, star rating, author + role @ company, a
chapter rail across the top), a closing CTA card — then stamp every row it used
with `compiled` and the finished video URL. Square because that is the format
LinkedIn shows at full size in the feed.

```
Schedule (1st, 9am) ─▶ Config ─▶ Read testimonials sheet ─▶ Pick this month's
        ─▶ Build project (template + iterate) ─▶ Validate (free) ─▶ Render
        ─▶ Mark rows compiled ─▶ ▶ Watch video
```

## Why this one is different

**One payload, N scenes.** *Build project JSON* does not emit a finished
project. It emits a Zvid **template**: the quotes as `variables`, plus a single
testimonial scene carrying `iterate: "testimonials"`. Zvid expands that
server-side before it validates or renders, so three quotes become five scenes
and five quotes become seven — same payload, no loop nodes, no merge nodes, one
render job and one credit charge no matter how many testimonials you featured.
The scene count follows your data instead of your wiring.

**Type scales with the quote, on a fixed baseline grid.** The quote ramps
66 px → 34 px so a 23-character line and a 260-character paragraph both fill the
same window without clipping; anything past `maxQuoteChars` is trimmed on a word
boundary with an ellipsis rather than cut off on screen. Everything *below* the
quote — star row, divider, initials ring, author block — sits on a fixed grid, so
the cut from one testimonial to the next never makes the author line jump.

**Consecutive scenes never look alike.** Testimonials alternate between two
designed treatments — warm paper card with an accent tick on the left frame
edge, and deep ink card with an accent corner wedge — and the chapter rail
across the top fills as the film advances, so a five-quote compilation reads as
a piece rather than five slides.

**Missing data changes the layout instead of breaking it.** No `Rating` on a row
swaps the star row for a `Verified customer` chip. No `Role`/`Company` falls back
to `Customer`. No `logoUrl` swaps the outro logo for a brand monogram. No
`ctaUrl` drops the CTA pill entirely. Each of those branches is exercised by a
rendered fixture, not just by reading the code.

## Requirements

| | |
| --- | --- |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to test. |
| Google account | For the two Google Sheets nodes (read the queue, write back the result). |
| Airtable PAT | **Optional.** Only if you set `source: "airtable"` instead of using a sheet. |

No LLM and no voice service. The music bed is one pinned, pre-verified URL in
`Config`, and it is optional — see `maxMusicBytes` below.

## Setup

1. **Import** `zvid-testimonial-compilation.json`.
2. **Zvid credential** — add an n8n **Header Auth** credential, name `x-api-key`,
   value = your Zvid key. Attach it to *Validate project (free)*, *Save draft to
   editor*, *Submit render* and *Get render status*.
3. **Google Sheets credential** — attach it to *Read testimonials sheet* and
   *Mark rows compiled*, and pick your spreadsheet + tab in both nodes.
4. **Create the sheet** with this exact header row:

   | Quote | Author | Role | Company | Rating | Featured | Status | VideoUrl |
   | --- | --- | --- | --- | --- | --- | --- | --- |

   `Quote` and `Author` are the ones that matter. `Role` and `Company` become the
   small line under the name (either alone is fine). `Rating` is `1`–`5`; leave
   it empty and that scene shows a `Verified customer` chip instead of stars.
   Tick `Featured` on the rows you want in this month's cut — `TRUE`, `yes`,
   `y`, `1`, `x`, `✓` and `featured` all count. Leave `Status` and `VideoUrl`
   empty.
5. **Open `Config`** — set `brandName`, `introTitle`, `ctaText` and `ctaUrl`.
   Colours, fonts and every other knob have working defaults.
6. **Run it.** The workflow renders for real out of the box, so **the first run
   spends credits — about 27** for a three-quote compilation. When it finishes,
   click **`▶ Watch video`** to play the result inside n8n.

   Prefer to preview for free first? Set `dryRun: true` in `Config` before that
   first run: you get the exact credit cost and an **`editorLink`** that opens
   the draft in the Zvid editor, with nothing spent and nothing written to the
   sheet.
7. **Activate.** It runs on the 1st of each month at 9am.

**Using Airtable instead:** set `source: "airtable"`, fill `airtableBaseId`
(the `app…` segment of your Airtable URL) and `airtableTable`, create a personal
access token at [airtable.com/create/tokens](https://airtable.com/create/tokens)
with the `data.records:read` scope, and attach it to *Fetch Airtable records* as
an n8n **Bearer Auth** credential. Name the fields exactly as the sheet columns.
Airtable rows are **never written back** — there is no row number to match on, so
the record ids are reported in *Run summary* and left untouched.

## Configuration

Everything lives in the `Config` node.

| Key | Default | Notes |
| --- | --- | --- |
| `apiUrl` | `https://api.zvid.io` | Zvid API base for every render call. |
| `editorUrl` | `https://editor.zvid.io` | Used to build `editorLink` on a dry run. |
| `source` | `sheet` | `sheet` (Google Sheets, writes back) or `airtable` (read-only). |
| `airtableBaseId` | `""` | The `app…` id from your Airtable URL. Only used when `source: "airtable"`. |
| `airtableTable` | `Testimonials` | Airtable table name. |
| `airtableView` | `""` | Optional Airtable view name to pre-filter. Empty = whole table. |
| `maxQuotes` | `5` | How many testimonials make the cut, top to bottom. Clamped to 2–12. |
| `minQuotes` | `2` | Below this the run stops cleanly with "nothing to compile" — one quote is not a compilation. |
| `maxQuoteChars` | `260` | Longer quotes are trimmed on a word boundary with an ellipsis. Clamped to 80–400. |
| `brandName` | `Northwind Logistics` | Brand chip on the intro, and the source of the outro monogram. |
| `kickerText` | `Customer stories` | Small tracked caps top-left of every testimonial scene. |
| `introTitle` | `What our customers say` | The intro card headline. Auto-sizes 82→46 px. |
| `verifiedLabel` | `Verified customer` | The chip shown instead of stars when a row has no `Rating`. |
| `ctaText` | `Join them` | The outro headline. Auto-sizes 62→40 px. |
| `ctaUrl` | `northwind.example/stories` | Text inside the outro pill. Empty = no pill. |
| `logoUrl` | `""` | Public image URL for the outro. Empty = brand monogram instead. |
| `monthLabelMode` | `current` | `current` names the running month; `previous` names the one that just ended — usually what you want from a run on the 1st. |
| `monthLabelOverride` | `""` | Pins the month label to any text. Empty = computed from the run date. |
| `quoteFont` / `uiFont` | `Playfair Display` / `Outfit` | Serif carries quotes and titles; sans carries every label. One font per text element. |
| `paperColor` / `inkColor` | `#F4F1EA` / `#12161B` | The two alternating scene treatments. |
| `accentColor` / `accentOnDark` | `#2F6155` / `#84C6B2` | Accent on paper scenes and on ink scenes. |
| `starColor` / `starOnDark` | `#9A6B14` / `#E8B94B` | Star fill on paper and on ink. |
| `mutedOnPaper` / `mutedOnInk` | `#5C5548` / `#96A1AC` | Role/company and footer text on each treatment. |
| `musicUrl` | pinned mp3 | The bed under the compilation. Empty renders silent. |
| `musicVolume` | `0.12` | The bed sits low by design. |
| `maxMusicBytes` | `5242880` | *Check music* HEADs the URL first; unreachable, HTTP-error or oversized music renders the video **without** music instead of failing. |
| `statusDoneValue` | `compiled` | What gets written to `Status` after a successful render. |
| `dryRun` | `false` | `false` (default) renders for real. `true` validates, quotes the credits and saves a draft you can open in the editor — no credits, no sheet write. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Render poll loop. |

## Cost per video

Length scales with the number and length of the quotes, at roughly **1 credit
per second**. The live validator quoted **20 credits** for a two-quote
compilation (19.32 s), **27** for the default three-quote cut (26.80 s) and
**47** for five quotes including a 260-character one (46.54 s).
*Validate project (free)*
runs before every render and returns the exact figure for your data — it is
reported as `creditsCharged` in the run summary — but the render then proceeds
automatically. Set `dryRun: true` if you want the number *without* the render.

## How it works

| Node | What it does |
| --- | --- |
| **Source?** | Routes on `Config.source`: Google Sheets (default) or Airtable. |
| **Read testimonials sheet** | Reads every row; the sheet node also emits each row's `row_number`, which is what the write-back matches on. |
| **Pick this month's** | Keeps rows that are `Featured` **and** have an empty `Status`, in sheet order, up to `maxQuotes`. Rows with no `Quote` are skipped and counted. |
| **Fetch Airtable records / Pick Airtable records** | The same filter against Airtable's `{records:[{id,fields}]}`. HTTP errors surface with Airtable's own message instead of a generic failure. |
| **Enough testimonials?** | Fewer than `minQuotes` picked → *Nothing to compile*, a normal successful outcome that reports how many were found and how to fix it. Nothing is rendered and nothing is written. |
| **Prepare compilation** | Computes the month label (`monthLabelOverride`, else `monthLabelMode` against the run date) and hands the builder one tidy item. |
| **Check music / Music guard** | HEADs `musicUrl` and checks `content-length` against `maxMusicBytes`. Unreachable, HTTP ≥ 400 or oversized → render **without** music, never fail; the reason is carried into the summary. |
| **Build project JSON** | The whole design: the two alternating scene treatments as inline SVG, the 66→34 px quote ramp, the star geometry, the chapter rail, the author grid — emitted as a Zvid **template** (`variables` + one `iterate` scene). All sheet text is whitespace-collapsed, brace-defused and HTML-escaped before it lands in any markup. |
| **Validate project (free)** | Runs the exact pipeline a render submission runs — including resolving the variables and expanding `iterate` — without spending credits. |
| **Check validation** | Fails loudly with the field list when the API rejects the payload; otherwise carries `payload`, `creditsRequired` and `meta` forward. |
| **Dry run?** | Routes on `Config.dryRun`. `false` by default, so the normal path goes straight to *Submit render*. |
| **Save draft to editor / Dry run summary** | **Only when `dryRun: true`.** Saves a free draft and reports the quoted credits plus `editorLink` (`https://editor.zvid.io/?project=…`). Best-effort: a hiccup saving the draft never hides the dry-run report, and the sheet is left untouched. |
| **Submit render / Wait / Get render status** | Paid render plus a poll loop. |
| **Still rendering?** | Throws on `state: "failed"` with the job's `failedReason`, and stops the loop at `timeoutMinutes`. |
| **Rows to mark / Sheet mode? / Mark rows compiled** | One item per testimonial that made the film, each carrying its `row_number`. In sheet mode every used row is stamped `Status = compiled` + the same `VideoUrl`. In Airtable mode this is skipped. |
| **Run summary** | One item with `videoUrl`, `jobId`, `quotes`, `scenes`, `starred`, `trimmedQuotes`, `videoSeconds`, `creditsCharged`, `music`, `authors`, and `sheetRows` or `airtableRecords`. |
| **▶ Watch video** | Downloads the finished MP4 as binary so n8n plays it inline in the output panel. Never fails the run: it retries a few times (the CDN can 404 for a moment right after a render completes) and then continues regardless, since the rows are already written by this point. |

## Publishing (optional tail)

The required path ends with the video URL in your sheet. To auto-publish, extend
after *Mark rows compiled*:

- **LinkedIn** — the square 1080×1080 output is made for it. Pass `videoUrl` to
  a scheduler such as Blotato, Buffer or Metricool over their HTTP API; they take
  a public video URL directly, no download step.
- **YouTube** — an HTTP Request node (GET `videoUrl`, response format *File*)
  → the native **YouTube** node (Video → Upload, binary `data`). Needs YouTube
  OAuth2.
- **Human in the loop** — a Slack or Email node sending `videoUrl` to whoever
  posts.

These stay out of the required path so the import runs with a Zvid key and a
Google account, nothing else. On self-hosted n8n you can also install
[`@zvid/n8n-nodes-zvid`](https://www.npmjs.com/package/@zvid/n8n-nodes-zvid) and
replace the render HTTP nodes with the native **Zvid** node + **Zvid Trigger**
(render webhook), which removes the poll loop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Run says `nothing to compile` | Fewer than `minQuotes` rows are `Featured` with an empty `Status`. The summary reports how many it found and how many it skipped, and why. Tick more rows, clear their `Status`, or lower `minQuotes`. |
| Only some of my featured rows made it in | `maxQuotes` (5) caps the cut, taken top to bottom in sheet order. Raise it, or reorder the sheet. |
| A quote ends in `…` | It was longer than `maxQuoteChars` (260) and was trimmed on a word boundary. Raise `maxQuoteChars` or shorten the quote — the type ramp only goes down to 34 px. |
| A scene shows a `Verified customer` chip instead of stars | That row's `Rating` is empty or not a number `1`–`5`. Intentional — mixed sheets are fine. |
| Outro shows two letters instead of my logo | `logoUrl` is empty, so the brand monogram is used. Set `logoUrl` to a public image URL. |
| Nothing was written back to Airtable | Intentional. Airtable has no `row_number` to match on, so records are reported in *Run summary* (`airtableRecords`) and left untouched. Use the sheet path to close the loop automatically. |
| `Airtable answered HTTP 401 / 403` | The Bearer Auth credential is missing, or the token lacks `data.records:read` on that base. |
| Video rendered without music | *Music guard* found the URL unreachable, an HTTP error, or a file over `maxMusicBytes`. The summary's `music` field gives the exact reason. This is deliberate — a silent compilation still ships. |
| `Zvid rejected the project` | The message lists the offending fields. If you edited the builder, note the API only allows letters, digits, spaces, `_` and `-` in `name`, and rejects `audios[].track`. |
| Render failed and the rows stayed pending | Intentional — rows are only marked `compiled` after a successful render, so next month's run retries them. The error carries the job's `failedReason`. |
| Wrong rows updated | Do not sort or delete rows while a run is in flight; the update matches on the `row_number` captured at read time. |
| `429` / `hourly_limit_exceeded` on submit | Your plan's hourly render limit is spent — the message says how many minutes remain. One scheduled run a month never hits it; back-to-back manual test runs can. Nothing is charged for a rejected submit. |

## Verified

Every node type and `typeVersion` in this file is core `n8n-nodes-base` and uses
the same shapes as the other templates in this series, so it imports without any
community node. (That was checked against the shipped JSON, **not** against a
running n8n instance — no version number is claimed here.) Here is exactly what
was verified:

- **Rendered on the production engine** (the same `@zvid-io/zvid` package the
  render farm runs) three times from the builder's real output, after resolving
  the template with the same `templateEngine` the API uses. All three are
  `ffprobe`-confirmed 1080×1080 @30 fps:
  - **default** — 3 quotes of mixed length, all rated, music on, CTA pill,
    monogram outro → 26.80 s, AAC audio.
  - **logo** — the `minQuotes` floor (2 quotes), one rated and one not, an image
    in the outro logo box and an **empty `ctaUrl`** (no pill) → 19.32 s.
  - **stress** — 5 quotes (the `maxQuotes` cap) including a 361-character one
    that trims to 259, a 31-character author with a two-line role @ company, two
    rows with no rating, and music deliberately skipped → 46.54 s, **no audio
    stream** (`ffprobe` shows video only), confirming the music-guard fallback.

  **Every extracted frame was reviewed at 2 fps — 186 in total** (54 + 39 + 93):
  no clipping, no overflow, no text touching an edge, no low-contrast text on
  either treatment, no collisions, no unsubstituted `{{placeholders}}`, no
  `undefined`/`NaN`, and no half-rendered animation states at the scene cuts.
  Because that sweep was done on scaled-down contact sheets, the frames carrying
  the **smallest type** were then re-read at **native 1080 px** — the 23 px
  tracked kicker and chapter counter, the 25 px role @ company line on both
  treatments (including the two-line wrap and accented glyphs), the
  `Verified customer` chip, the 24 px outro footer and the CTA pill label. The
  verdict held at glyph level: no broken or clipped characters, correct `·`
  separators, correct diacritics.
- **Injection-safe, proved in pixels.** The stress fixture feeds a quote
  containing `<script>alert(1)</script>`, `&`, curly quotes and a literal
  `{{template}}`. Read at native resolution, the rendered frames show all of it
  as ordinary escaped text — the script tag paints as characters and the double
  braces collapse to `{template}`, so untrusted sheet text cannot reopen a
  placeholder or inject markup.
- **Remote validation against the live API** (`POST /api/render/validate/api-key`
  with `remote: true`) on **all three** payload shapes, sent in the same
  `template + variables` form the workflow POSTs. Each returned `valid: true`,
  *"Payload is valid and would be accepted for rendering"*, schema **1.0.0** and
  **zero warnings** — no errors, no layout lint. The server-side `iterate`
  expansion returned exactly the scene list and total duration the local render
  produced:

  | Fixture | Quotes | Scenes after `iterate` | Duration | `creditsRequired` |
  | --- | --- | --- | --- | --- |
  | logo | 2 | 4 | 19.32 s | **20** |
  | default | 3 | 5 | 26.80 s | **27** |
  | stress | 5 | 7 | 46.54 s | **47** |

  The canvas is declared as `resolution: "custom"` with explicit
  `width`/`height` of 1080 rather than the equivalent `instagram-post` preset.
  Same pixels, but the API's layout linter only knows the canvas size when the
  resolution is custom — behind a preset it cannot tell that the full-bleed
  background SVG on track 0 *is* a background, and reported it as overlapping
  every foreground element that declares both a width and a height. Declaring
  the canvas gives the linter strictly more to check (it can now also test every
  element against the frame edges) and the payloads come back clean.
- **Branches with no rendered fixture were executed anyway**, by running the
  shipped workflow's own code nodes against mocked n8n inputs, chained so each
  node received the real upstream shape:
  - *Pick this month's* → *Nothing to compile*: one featured row against
    `minQuotes: 2` produces the friendly stop with the real counts
    (`"Found 1 testimonial(s) … needs at least 2"`, `rowsChecked: 4`, the
    `notFeatured`/`alreadyCompiled`/`noQuote` breakdown) and `rendered: false`.
  - *Prepare compilation* month label: `current` → `July 2026`, `previous` →
    `June 2026`, and `monthLabelOverride` beating both.
  - *Pick Airtable records* against a mocked Airtable body: field mapping to
    `quote/author/role/company/rating/recordId`, `rowNumber: 0`, the truthy-token
    filter, and the error messages for HTTP 401, 403, 404 and no-answer-at-all.
- **Pinned URLs re-checked** (not carried over from authoring time): the default
  music bed answers HTTP 200, `audio/mpeg`, 3,695,616 bytes (3.5 MB) — under the
  5 MB `maxMusicBytes` guard and the plan's audio cap; the logo fixture's image
  answers HTTP 200, `image/jpeg`, 94,669 bytes.
- **The embedded code node is byte-identical** to the frame-reviewed standalone
  builder — asserted programmatically by SHA-256, not by eye — and the workflow
  JSON regenerates byte-for-byte from that builder.
- **Structural checks** on the workflow JSON: parseable, all 31 connections
  resolve, all 11 code nodes compile, unique names and ids, core-only node types,
  every Zvid call on Header Auth, and no `credentials` block anywhere in the
  shipped file.

**Not executed.** Nothing in the publish/delivery tail — no social platform, no
email provider. The Airtable path's HTTP behaviour was never exercised against a
live Airtable base; only its parsing, mapping and error handling were, against
mocked responses. The two Google Sheets nodes ship with empty
`documentId`/`sheetName` (correct — you pick your own), so the read and the
`row_number` write-back have never touched a real spreadsheet. And the outro
logo box was proved with a stock photograph standing in for a brand mark: it
demonstrates the box geometry and the `max-width`/`max-height` clamp, not how a
transparent-PNG lockup will look against the dark card. Those are documented,
not exercised.
