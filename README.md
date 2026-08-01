<p align="center">
  <img src="https://cdn.zvid.io/assets/logo.svg" alt="Zvid" width="184" />
</p>

# @zvid/n8n-nodes-zvid

n8n community nodes for [Zvid](https://zvid.io) — render videos and images from JSON or templates, and trigger workflows when renders finish.

## Ready-made workflows

| Workflow | What it does |
| -------- | ------------ |
| [Faceless YouTube Shorts on autopilot](workflows/faceless-shorts-autopilot.md) | Daily: topic → script → voiceover → stock b-roll → captioned 1080×1920 render → YouTube. Core nodes only, so it runs on n8n Cloud unmodified. |
| [Zvid AI Agent](workflows/zvid-ai-agent.json) | Chat agent wired to the hosted MCP endpoint (see below). |

## Nodes

### One-click Zvid AI Agent

Import [`workflows/zvid-ai-agent.json`](workflows/zvid-ai-agent.json) to add a complete
chat agent instead of wiring the AI nodes and Zvid operations manually. The template
comes with:

- an n8n Chat Trigger and AI Agent;
- an OpenRouter Chat Model placeholder that can be replaced with any n8n chat model;
- credential-free conversation memory; and
- n8n's built-in **MCP Client Tool** configured for the hosted Zvid MCP
  endpoint, Zvid OAuth, the safe `creator` profile, and **Tools to Include:
  All**.

The MCP connection discovers the tools allowed by the selected profile at runtime,
so new profile tools become available without adding more nodes. After import, the
only required setup is selecting an AI-model credential and signing in to Zvid from
the **Zvid MCP Tools** node — OAuth sign-in, no API key; see
[Credentials](#credentials) for both authentication methods.

The profile and **Max Render Credits** are concrete query parameters on the MCP
endpoint stored in the n8n workflow JSON. Changing them affects only that workflow.
Changing the Zvid dashboard defaults never changes existing n8n workflows.
Downloading the workflow from the dashboard captures the current defaults; the
packaged JSON uses `creator` and 120 credits. The dashboard MCP credit limit, when
set, remains a hard server-side ceiling on top of any workflow value.

The checked-in JSON is also the safe `creator` source artifact for publishing the
Zvid AI Agent to the n8n workflow-template gallery.

### Zvid (action node)

| Resource         | Operations                                                                                                                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authoring        | **Plan Creative Video**, **Get Project Schema**, **List Supported Elements**, **Get Element Documentation**, **Get Example Project**, **Repair Project JSON**; all plan-aware and suitable for AI Agent tool use                                                                 |
| Creative Library | **Search**, **Get Metadata**, **Get Content** for complete examples, animated design templates, canvas presets, and shapes                                                                                                                                                       |
| Stock Media      | **Get Library Availability**, **Search** Zvid's stock library for normalized image/video/GIF/audio results with render-ready URLs                                                                                                                                                     |
| Render           | **Create** (video/image, from project JSON or template + variables, optional _Wait for Completion_ polling), **Create Bulk** (one template × up to 500 variable sets), **Get** (status + output URL, optional wait), **Get Many**, **Validate** (pre-flight payload check, free) |
| Template         | **Create**, **Get**, **Get Many**, **Update**, **Delete (Archive)**, **Duplicate**, **Preview** (free dry run), **Render** (template + variables, optional wait)                                                                                                                 |
| Credit           | **Get Balance**                                                                                                                                                                                                                                                                  |

The action node is available for deterministic workflows and can also be attached
directly to an AI Agent. For agent workflows, the recommended integration is n8n's
built-in **MCP Client Tool** with the hosted Zvid MCP endpoint because it applies
MCP profiles, credit limits, render quotes, and disabled destructive tools.

#### Validate before rendering

For AI generation, import the ready-made agent workflow or configure n8n's built-in
**MCP Client Tool**. For a deterministic workflow, use the individual action-node
operations in this order: creative plan -> library discovery -> stock media ->
schema/docs -> generate JSON -> repair/validate -> fix every error and layout
warning -> draft/final render.

The Authoring resource provides this schema/docs/example context directly; connecting a separate MCP server is optional.

#### Creative variation and missing templates

**Plan Creative Video** is template-driven, not template-only:

- `consistent` creates a stable seed for reproducible automation output.
- `fresh` creates a new direction and accepts `Recent Asset Slugs` so workflows can avoid repeating recent examples/designs.
- `explore` returns 2-5 materially different directions with different layout/style/storyboard treatments.

Search complete examples first and inspect their preview metadata. If no full example genuinely fits, the plan explicitly builds a new storyboard from scene recipes, animated design templates, canvas presets, shapes, and topic-specific stock media. It does not force the nearest unrelated template.

For repetition control across workflow executions, store the selected library slug and returned direction seed in n8n workflow static data, a Data Table, or your database; pass recent slugs back into the next Plan Creative Video operation.

For reusable-template creation, use Authoring to compose and validate the project first, then Template → Create. Fetch the current template before updating it. Delete is a soft delete (archive), and agents should call it only on an explicit removal request.

**Render → Validate** sends the same envelope as Create (project JSON, or template + variables, plus overrides) to `POST /api/render/validate/api-key`, which runs the _actual_ backend validation — template resolution, your plan's limits, the full project schema — without rendering or spending credits. The node never fails on an invalid payload; it outputs one item you can branch on with an IF node:

```json
{
	"valid": true,
	"creditsRequired": 3,
	"payload": { "...": "resolved project with defaults applied" }
}
```

```json
{
	"valid": false,
	"error": "Validation failed",
	"errors": [{ "field": "visuals[0].src", "message": "\"src\" must be a public http(s) URL" }],
	"planLimits": { "maxDuration": 300, "maxVideosCount": 5 }
}
```

Typical AI workflow: _LLM node generates project JSON → Zvid Validate → IF `valid` → Zvid Create; else feed `errors` back to the LLM to fix._ The `errors` array is field-level (`visuals[2].enterEnd`, `subtitle.captions[0].text`, …), which LLMs handle well. For the JSON Schema and per-element docs, use the hosted MCP server's `get_project_schema` / `get_element_docs` tools or the [Zvid documentation](https://docs.zvid.io) — both are derived from the backend validation, which always wins over any other docs.

When an LLM authors the project JSON, put the schema package's `AUTHORING_GUIDELINES` (or the `authoringGuidelines` from the MCP `get_project_schema` tool) into its prompt — a payload can be valid and still render badly. The short version: use `scenes` for sequential messages; `position` presets OVERWRITE x/y (use `position: "custom"` for offsets); put headline + subline inside ONE TEXT element's `html`; build cards/pills as one flex-centered TEXT element (no CSS padding, no SVG box + separate TEXT); keep text contrast ≥ 4.5:1 (scrim over photos).

### Zvid Trigger

Registers a Zvid webhook for `render.completed` / `render.failed` when the workflow activates and deletes it on deactivation. Incoming deliveries are verified against the endpoint's `whsec_…` secret (HMAC-SHA256 over `"<X-Zvid-Timestamp>.<raw body>"`, compared with `X-Zvid-Signature: sha256=<hex>` using a constant-time comparison); unsigned or tampered requests get a 401. Verification can be disabled per node, but don't.

**Wait vs. trigger:** _Wait for Completion_ blocks the execution while polling — fine for short renders. For long videos, prefer submitting with Create and letting a second workflow start from the Zvid Trigger.

## Credentials

There are two ways to authenticate with Zvid from n8n. Which one you need
depends on the node:

| # | Method | n8n credential | Used by | What you need |
| --- | --- | --- | --- | --- |
| 1 | **API key** | **Zvid API** (from this package) | **Zvid** action node, **Zvid Trigger** | A `zvid_…` key from [app.zvid.io/api-keys](https://app.zvid.io/api-keys) |
| 2 | **OAuth — sign in with Zvid** | **MCP OAuth2 API** (built into n8n) | **Zvid MCP Tools** node in the AI-agent workflow | Your Zvid account — no API key |

The two methods are independent: a workflow that combines the AI agent with
direct action-node operations needs both credentials.

### Method 1 — API key (Zvid API credential)

Used by the **Zvid** action node and the **Zvid Trigger**. Create a
**Zvid API** credential and paste an API key (`zvid_…`) from
[app.zvid.io/api-keys](https://app.zvid.io/api-keys); n8n then sends it in the
`X-Api-Key` header on every request. The _Base URL_ defaults to
`https://api.zvid.io`; change it only for self-hosted/local instances. The
credential test calls `GET /api/credits/balance`, so a wrong or revoked key
fails as soon as you save the credential.

### Method 2 — OAuth sign-in (MCP OAuth2 API credential)

Used only by the **Zvid MCP Tools** node in the ready-made AI-agent workflow
(n8n's built-in **MCP Client Tool**). Create n8n's built-in **MCP OAuth2 API**
credential, keep dynamic client registration enabled, keep the endpoint on
`https://mcp.zvid.io/mcp`, and connect — you sign in to Zvid in the browser
and approve access. No API key is created or pasted; the workflow receives
short-lived, revocable tokens instead. Only change the endpoint when you are
intentionally testing a local Zvid MCP server.

## Installation

After n8n verifies the package, n8n Cloud workspace owners can search for **Zvid**
in the node panel and install it from **More from the community**.

On self-hosted n8n: **Settings → Community Nodes → Install** and enter
`@zvid/n8n-nodes-zvid`, or install it manually:

```bash
cd ~/.n8n/nodes
npm install @zvid/n8n-nodes-zvid
```

From this checkout:

```bash
pnpm install && pnpm run build
cd ~/.n8n/nodes && npm install /path/to/zvid-n8n
```

## Development

```bash
pnpm install
pnpm run build  # official n8n-node production build
pnpm run lint   # n8n Cloud community-node checks
pnpm run test   # smoke tests incl. webhook HMAC verification
```

### Local Docker test loop

When this checkout is already bind-mounted into the n8n container as
`/custom/n8n-nodes-zvid`, no `npm link`, package reinstall, or persistent shell
environment variables are needed. After changing the node, run only:

```powershell
Set-Location D:\Nodejs\Projects\zvid-cline\zvid-integrations\n8n
pnpm run build
docker restart n8n
```

For the full local OAuth/profile flow, open the local Zvid dashboard, choose and
save the default under **Settings → AI agent tools**, then download the n8n
workflow there. In development that download contains
`http://host.docker.internal:8080/mcp` and concrete copies of the saved profile and
maximum credits per render.
Import it into n8n, connect the AI-model credential, and create one **MCP OAuth2
API** credential in **Zvid MCP Tools**. Later dashboard changes do not alter the
imported workflow.

## Publishing

Releases are published by
[`publish.yml`](.github/workflows/publish.yml) from version tags such as
`v0.1.3`. The workflow verifies the tag against `package.json`, installs from
the lockfile, runs lint and tests, and publishes the public npm package with an
npm provenance statement.

Configure npm Trusted Publishing for the `Zvid-io/zvid-n8n` repository and the
`publish.yml` workflow before pushing a release tag. Do not publish manually:
n8n requires verified community nodes to be published from GitHub Actions with
provenance. After the npm release passes
`npx @n8n/scan-community-package @zvid/n8n-nodes-zvid`, submit the package
through the [n8n Creator Portal](https://creators.n8n.io/).
