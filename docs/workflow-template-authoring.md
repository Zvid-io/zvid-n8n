# Workflow template authoring standard

Use this standard for every new or materially updated publishable Zvid n8n
template, including future templates outside the 30-day series. It records the
format adopted on 2026-09-17 after n8n requested better sticky notes for the
Faceless Shorts and Daily Quote submissions. It is a generation requirement;
publication remains subject to n8n's review.

## Canvas structure

| Element | Required format |
| --- | --- |
| Overview | Exactly one yellow note at the top left, 100–300 words in total |
| Overview title | A concise `##` heading describing the workflow's outcome |
| Overview sections | Exact `### How it works` and `### Setup` headings; optional `### Customization` |
| Section notes | Neutral white, or grey in dark mode; numbered `##` headings and one or two short sentences; fewer than 50 words including the heading |
| Grouping | For workflows with four or more functional nodes, surround each related group with a section note; at least two nodes per group, with every functional node in exactly one group |
| Layout | Readable flow order, consistent spacing, no colliding notes or nodes, and enough clearance between note text and node labels |

Use `n8n-nodes-base.stickyNote`, `typeVersion: 1`. Set `parameters.color` to
`1` for the yellow overview and `7` for neutral sections. Size the notes for
their rendered content and enclosed nodes. The overview must remain outside
the execution groups. One-to-three-node workflows can use an overview alone.

Do not recreate detached rows of long instruction cards above the workflow.
Do not duplicate installation instructions on several cards, assign a different
color to every stage, or put large tables and code samples on the canvas.
Retain detailed material in the companion Markdown guide and link to it from
the overview. Verify that the link's repository, branch and filename exist.

## What the instructions must explain

**How it works:** name the intended user, input, main transformation and actual
output. State whether delivery or publication is included, optional, or a step
the user must add. Describe implemented behavior only.

**Setup:** give the prerequisites in execution order. For native Zvid workflows,
include this installation instruction before credentials:

> Install `@zvid/n8n-nodes-zvid` from **Settings → Community nodes** before
> configuring Zvid credentials. A workspace owner/admin may need to install it.

Then explain the **Zvid API** credential, the key page
`https://app.zvid.io/api-keys`, Base URL `https://api.zvid.io`, and which nodes
need it. List other service credentials, required sheet headers or webhook
fields, source selection, and the configuration node. Explain any setup needed
for an optional branch where that branch is documented.

Render templates default to `dryRun: false` where that setting exists, as
requested for this series. State that a run renders and spends Zvid credits.
Explain `dryRun: true` as an editor draft and credit quote when supported; do
not call the entire run free if upstream AI, speech, transcription or other
services may charge. When updating an existing configured instance, preserve
its settings unless the task specifically asks to change them.

Use the native Zvid node for every operation supported by the published package.
Recheck the package before describing a capability as unsupported. If an HTTP
exception is necessary, document the reason on the canvas and in the companion
guide. For conversational workflows using the built-in MCP Client Tool,
document the MCP endpoint, authentication and actual approval/credit controls;
do not imply that a prompt instruction is a hard approval lock or invent a
`dryRun` setting.

**Customization:** point to the real configuration fields for branding, media,
timings, batch limits or destinations. Keep required setup out of this optional
section. Use canonical Zvid URLs and refer to stock media as **Zvid's stock
library**, without naming upstream stock providers.

## Completed-media preview

Include **Watch video** after the successful render path. Keep a guard before
it so missing media URLs, draft-only outputs and dry runs skip the download.
The step downloads the completed file into binary `data`; it must not start
another render. Preserve any URL allow-list used by an agent.

For chat agents, enable intermediate tool results and read the actual completed
Zvid response, not only the model's final prose. n8n may namespace tool names
as `Zvid_MCP_tools_get_media` and wrap observations in JSON arrays containing
`response` text blocks; a render `result` may be a URL string. Test this native
shape, omitted final links, drafts, failed/running jobs and disallowed URLs.
Return a readable `watchReason` when no completed media exists. A draft/quote
is not a video: preserve render approval, and follow the MCP tool's background
render contract by checking once when asked instead of polling inside the agent.

Bound preview downloads with a 30,000 ms request timeout and at most three
attempts, five seconds apart. Keep `onError: continueRegularOutput`, so a
download failure does not invalidate a completed render; the preceding result
node retains its video URL. On the tested local n8n 2.29.10 runtime, HTTP Request
v4 can retain a response stream in manual-run context and fail to serialize its
TLS socket when saving an execution. The affected templates use the built-in
HTTP Request v2 file downloader (`responseFormat: file`, `dataPropertyName: data`)
through `workflow-runtime-repairs.js`. Verify manual execution and actual MP4
playback before changing this compatibility setting. Preview downloads are
ordinary media GET requests; supported Zvid API operations still use Zvid nodes.

For local download failures, inspect saved execution errors and compare CDN
reachability from the n8n container before changing workflow logic. A bounded
timeout is not a connectivity fix. Diagnose resolver-dependent routes without
pinning CDN IPs or disabling TLS/SSRF protection, then verify repeated downloads
and a manual editor run with inline playback. Reuse completed media to avoid
unnecessary paid renders during preview testing.

Test repeat execution against the actual populated history, not only an empty
log. A Sheets log reader downstream of multiple source rows must execute once
when it reads the entire log; otherwise each source item repeats every history
row and falsely triggers duplicate-key errors. Retain genuine duplicate-key
checks. Provide an explicit saved-job playback mode for demo reruns, skipping
paid submission, history writes and delivery. Label it as replay, preserve the
completed-state and URL checks, and document how to return to new-content mode.

A playback test is not proof of new-video creation. Never configure an unrelated
completed asset as the default when the user requests rendering or a usable
creation demo. Verify draft creation, the actual signed quote, paid submission
when authorized, and playback of that submitted job. A chat agent must not claim
it saved a draft based only on validation; require the actual creation response.
Keep optional saved-job replay fields empty on new-content paths. Clearly label
fictional demo inputs and explain that each new manual render spends credits.

Distinguish a preview download problem from a render failure. Preserve the
failed job and actual reason in the tracking log, then surface an execution
error before Watch; never bypass the completed-media gate. Explicit HTTP 429
submission rejections must not remain ambiguously marked submitting. Persist
their rejected state and retry within a bounded loop that honors Retry-After,
while never retrying uncertain submissions. Test this with real n8n error-output
serialization, not only plain JavaScript fixtures.

The nearby section note should explain **Watch video → Binary → data → View**.
For batches, explain selecting the output item; for mixed output, explain that
images open as images. Document any existing optional publishing branch without
enabling it as part of note generation.

## Integrate the standard into generation

For multi-asset workflows using individual render operations, submit one asset,
wait for that accepted job to complete, then submit the next. Never enable
whole-node retries on a multi-item paid submission: a later rejection can replay
earlier accepted requests. Retry only explicit HTTP 429 rejections, honor server
retry delays with a minimum 30-second wait, and bound submission retries and
render polling separately using per-item timestamps. Keep each asset's metadata
with its job and collect completed results before the final summary. The podcast,
blog content-kit and flash-sale templates implement this in
`workflow-runtime-repairs.js`; the integration smoke test must simulate a rejected
submission and prove accepted jobs are not duplicated.

Podcast sampling must also cap downloaded audio to the configured render asset
limit, then check actual binary size before paid transcription. A Range request
alone is insufficient because a source host may ignore it. Repeated sheet tests
should reset only the intended test rows' completion status after verifying
write-back; retain production deduplication and the original input data.

Sheet queues must return an explicit zero-work report when all eligible rows
are complete; do not let an empty output look like a failed music check. For
intentional reruns, clear only the selected completion markers (`Status` and
`VideoUrl` for listings, `VideoUrl` for hiring), after saving their old values.
Daily dated templates should explain their fallback option and show the selected
row's original date when reusing past content. Do not change sheet dates to make
old sample data appear current.

When an upgrade adds source fields, migrate the connected example inputs as
part of the task and test those actual inputs through planning and free Zvid
validation. A successful no-work execution does not prove the render path works.
Keep completion history. Quiz keys may be derived from normalized question text
for old sheets, never from movable row numbers; approve content only after checking
its answer and source. Missing live KPI configuration must give a setup error.
An explicitly selected sample mode must label the video and review outputs,
separate its recovery keys from real reports, and block downstream publication.
Sports fallback must be explicit, age-bounded, retain actual match dates and
respect user-specified periods; never relabel old results as the current week.

Verify the downloaded source-media dimensions as well as the project canvas.
A width-only photo resize may exceed the input limit on its height. For known
stock-library hosts that support it, bound both dimensions with an
aspect-preserving fit; leave arbitrary customer and signed URLs unchanged.
Test both sheet-provided photos and configured fallbacks, and use a video
rendition within the account's input limit. Free schema validation alone does
not prove that remote media can be downloaded and rendered.

The current implementation is split across:

- [series-sticky-content.js](../scripts/series-sticky-content.js): template-specific
  titles, behavior, setup instructions and semantic node groups.
- [publication-sticky-notes.js](../scripts/publication-sticky-notes.js): overview
  generation, layout, stable note IDs, group membership and assertions. Faceless
  Shorts and Daily Quote have explicit layouts here.
- [organize-workflow-series.js](../scripts/organize-workflow-series.js): Watch-step
  organization and application of recognized publication layouts.
- [workflow-series.json](../scripts/workflow-series.json): the series file list;
  the organizer also includes the abandoned-checkout variant explicitly.
- [workflow-preview.test.js](../test/workflow-preview.test.js): exported-file,
  layout, Watch-gate and repeatability checks.

When adding a template, provide its own accurate overview and meaningful groups.
For the shared implementation, add an unambiguous `specs` entry with a distinctive
node-name match and cover its actual node names. Register a series template in
the series list; a non-series generator must invoke and validate its layout
explicitly. The organizer command processes its registered entries only and
does not automatically discover every workflow in the repository. Unknown
layouts must not be assumed to meet this standard.

Call `organizeWorkflow(workflow).workflow` at the end of a compatible generator,
as the checkout generator does, or use a dedicated equivalent layout for a
different workflow structure. Do not feed a differently shaped workflow into a
series layout just to obtain a passing result. Preserve the helper's stable
overview marker and Watch-note IDs if using the shared implementation, so later
maintenance recognizes the layout and does not add duplicate setup notes.

## Verify before delivery

### Review lessons: structure and distinct use cases

For days 25–29, `build-late-series.js` embeds independently tested domain
functions from `late-series-runtime.js`. Rebuild with that generator and
`late-series-guides.js`; `late-series-layouts.js` integrates the canvas format
with the standard organizer. These are revisions of the existing canonical
templates, not new near-duplicate submissions.

The distinct outcomes are a balanced three-round quiz and answer/source pack,
a verified KPI exception briefing and owner action register, an outdoor booking
call sheet with tentative calendar proposals, an editorial match approval and
correction lifecycle, and a consent-aware annual celebration queue. Domain facts must
affect selection and the actual output; extra guard nodes alone are insufficient.

After the duplicate-content feedback on days 27–28, use
`weather-sports-revisions.js` and `weather-sports-revision-runtime.js` through
the existing late-series generator. Weather uses dated requests, confirmed
reservations, priorities and forecast constraints to propose keep/reschedule/defer
decisions. Its ICS files are tentative and send no invitations. Sports checks a
specific queued event against exact human approval of its facts and edition,
invalidates stale approvals, and retains previous results and video links in
correction editions. Do not infer approval while adding example inputs. Keep
old render logs and recover accepted jobs before fetching new source data.
Do not increase a configured local credit ceiling during migration. Test live
provider reads and native free validation separately from fixture assertions;
report expired credentials and untested paid paths precisely. Revise existing
creator entries instead of creating new near-duplicate submissions.

Never substitute invented demo metrics or historical demo sports results after
a production source failure. Use explicit fixture data in isolated tests. Derive
comparisons and scoreline text deterministically, distinguish missing baselines,
and describe bounded API coverage accurately. Do not infer editorial approval,
contact consent or permission to reveal age while migrating source sheets.

Record render completion separately from delivery acknowledgement. A successful
video must not imply that an email was sent. Keep optional delivery off by
default, persist its pending state, and do not retry uncertain sends automatically.
Keep the original review context with accepted jobs, recover before new paid
work, and keep large raw forecasts and render payloads out of Sheets log cells.

Day 30 already uses a distinct conversational draft/quote/render flow. Preserve
its chat allow-list, memory isolation, server credit ceiling, guarded finished
media paths and provider-error response. State clearly that approval is a prompt
instruction, not a deterministic approval lock. Test existing controls before
adding complexity merely to increase the node count.

Do not treat additional validation, polling or sheet updates as sufficient
originality. The hiring template now combines recruiter-requested role spotlight
and multi-role roundup in one submission, including tracked application links
and a referral handoff. The restaurant template plans a category-balanced weekly
menu using availability, approval and prior-week history, then produces three
dated caption drafts. Domain decisions and useful outputs distinguish templates;
swapping source rows or video labels does not.

For complex canvases, keep the principal stages on a continuous left-to-right
line, with local branches above/below their decisions. Keep the batch return in
a clear lane beneath the stages. Do not wrap an arbitrary four-node grid across
rows when that causes long diagonal connections through unrelated sections.
Number notes in execution order, including the batch entry. Inspect both the
whole flow and readable zoom. The workout revision preserves all functional
nodes and connections while applying this layout.

`build-review-campaigns.js`, `review-campaign-runtime.js`, and
`review-campaign-layouts.js` generate the domain campaigns and their layouts.
Campaigns persist one snapshot per campaign key, not one video per source row.
Document required source and log tabs, real booking/application links, protected
form credentials when used, and migration from prior row-based templates.
Test source selection, incomplete briefs, category coverage, historical rotation,
CSV output, duplicate runs, snapshot recovery, previews and credit ceilings.
Validate representative default designs against the published native node;
schema success with a quote over the default cap is not a usable default.

For reviewer feedback that a template is too basic, add useful domain behavior
rather than increasing node count. The workout template implements content
approval, stable sheet keys, quoted credit ceilings, persisted render recovery,
and separately tracked coach-authored standard and scaled versions.
`upgrade-reviewed-templates.js` generates its revision and publication layout,
with embedded functions in `review-template-runtime.js`.
The exported-graph tests cover service boundaries, and isolated n8n executions
verify the loop, expressions and branch behavior without paid renders.

Describe every node's action and its object, including configuration, validation,
polling and summaries. When renaming, rewrite expression references and connection
keys/targets together. The earlier restaurant naming revision used `renameNodes`;
its subsequent campaign-planning revision changes functionality too. Updating
notes later must retain the descriptive names of the current graph.

Persist `submitting` before a paid request and the accepted job ID afterward.
Never auto-retry an uncertain paid request. Document that Sheets is not an atomic
lock, retain failed/timed-out IDs for inspection, and distinguish quoted credits
from actual charges. A preview must not write tracking cells or resume saved jobs.
When the published Zvid node lacks Project → Create, a validation-only preview
must explicitly say it returns JSON and a quote, not an editor draft.

1. Generate the canonical, credential-free JSON. For registered series templates,
   run `npm run workflows:organize` from this repository. Check the diff because
   that command writes every registered template.
2. Run `npm test` and the applicable workflow-specific validator. For the current
   Shopify variants, run `node scripts/validate-shopify-catalog-videos.js` and
   `node scripts/validate-shopify-abandoned-checkout-recovery.js`.
3. Check the actual exported JSON: one overview, correct headings and colors,
   word limits, complete group membership, unique names/IDs, valid connections,
   supported node types, scoped package names and no embedded credentials.
   Applying the organizer twice must not move notes or add nodes again.
4. For a notes-only revision, compare functional nodes excluding positions and
   verify that parameters, expressions, names, IDs and connections are unchanged.
   For a local import, back up the workflows and preserve credential references,
   settings, static data, pinned data, editor metadata and active/archived states.
   If an active workflow is revised, verify the published local version too.
5. Open the saved workflow in n8n and inspect it at fit-to-screen and readable
   zoom. Check heading/body clipping, card and node collisions, text clearance,
   the flow of connections, and the Watch section. Data checks alone do not
   establish that the rendered layout is readable.
6. Record which files and local copies changed and which checks passed. A notes
   revision does not require running a paid render. Apply the repository's
   separate launch-tracking instructions when creating or adopting a new
   canonical workflow; publishing remains a distinct action.

## References

- [n8n sticky-note guidelines](https://n8n.notion.site/Sticky-note-guidelines-for-templates-2aa5b6e0c94f8058b0aefddd02655887)
- [n8n's annotation video](https://www.youtube.com/watch?v=RScKsGfrhs4)
- [Auto-generate sticky notes and rename nodes](https://n8n.io/workflows/13868-auto-generate-sticky-notes-and-rename-nodes/)
- [Daily Quote example](../workflows/zvid-daily-quote-reels.json)
- [Faceless Shorts example](../workflows/zvid-faceless-shorts-autopilot.json)
