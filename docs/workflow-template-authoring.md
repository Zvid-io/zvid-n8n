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

The nearby section note should explain **Watch video → Binary → data → View**.
For batches, explain selecting the output item; for mixed output, explain that
images open as images. Document any existing optional publishing branch without
enabling it as part of note generation.

## Integrate the standard into generation

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
