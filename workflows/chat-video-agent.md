# Telegram chat to a finished video, with an AI agent

[`zvid-chat-video-agent.json`](zvid-chat-video-agent.json)

Message your own Telegram bot — *"12-second vertical teaser for FocusFlow, dark
premium look, tagline Focus without friction"* — and an n8n AI Agent does the
rest: it plans the video, adapts the closest design from Zvid's published
library, saves it as a draft and replies with the **exact credit quote plus an
editor link**. Reply yes and it renders, then posts the finished MP4 back into
the chat as a clip you can play. Every other template in this series renders a
shape you designed in advance; this one decides what to build.

```
Telegram message ─▶ Prepare chat input ─▶ Config ─▶ Screen request
   ─▶ Zvid AI Agent  (OpenRouter model + per-chat memory + Zvid MCP tools)
   ─▶ Chat reply ─▶ Send reply ─▶ Send video ─▶ ▶ Watch video
```

## Why this one is different

**Rendering is quote-gated, and the ceiling is server-side.** Drafting is free:
`create_media_from_example` returns a draft plus a **signed** quote. `render_media`
will not run without that token, and the server re-checks the draft version, the
payload hash and the price before accepting it — move any of them and the render
is refused. On top of that, `maxRenderCredits` (in **Config**, ships at **25**)
is a hard **per-render** ceiling applied by the MCP server and combined with your
dashboard's MCP credit limit, lower wins. What is *not* enforced is the asking:
the same tool result that saves the draft also hands the model the quote token,
so "quote, then wait for your yes" is a system-message rule, not a lock. Read
[the safety flow](#the-safety-flow-quoted-first-rendered-second) — it says
plainly which guard is which, and why `maxRenderCredits` is the number that
actually bounds a mistake.

**It picks the design, not just the copy.** The agent runs
`plan_creative_video` / `find_matching_examples` over hundreds of published
example projects and adapts the strongest match through its declared
variables — so a launch teaser comes back as a three-scene designed promo with
video hook, feature rails and a CTA card, not white text on a stock photo. The
system message explicitly forbids flattening an example into plain text on a
background — the quickest way for a model to throw away everything the library
was giving it.

**Nine tools, not the whole catalogue.** *Zvid MCP tools* is set to
**Selected** with exactly nine tool names. The full Zvid tool schema is roughly
74 KB of prompt on *every* turn, which slows small models down and makes them
wander. Nine keeps the agent on the example-first path — and none of the nine
can start a render without a quote.

**The bot is private by default, and only posts a finished render.**
`allowedChatIds` ships empty and an empty list answers *no* Telegram chat: bot
usernames are public, and a bot that can spend credits should not fail open.
Separately, the URL that gets posted as a clip has to start with one of the
`videoUrlPrefixes` entries — `https://cdn.zvid.io/videos/` by default, which is
where Zvid serves finished renders. That is a **path** prefix, not just a host,
and the path half is the interesting one: every library example the agent looks
at also has an MP4 preview on `cdn.zvid.io`, so a host-only check would let
"here is what the design looks like" post another project's demo clip as your
finished video, before anything had rendered. Telegram and n8n both *fetch* that
URL, and the text it is lifted from was written by a model that just read a chat
message.

**It runs with no Telegram credential at all.** *Test manually* feeds a fixed
brief into the same path, so you can exercise the agent — and compare models —
before you ever talk to BotFather. The shipped brief carries no approval, so
there is nothing in it for the agent to render against.

## Requirements

| | |
| --- | --- |
| n8n with the built-in AI nodes | *AI Agent*, *OpenRouter Chat Model*, *Simple Memory* and *MCP Client Tool* ship with n8n Cloud and with any current self-hosted install. No community package. Built and version-checked against **n8n 2.29.10**. |
| Telegram bot | `/newbot` in [@BotFather](https://t.me/BotFather), about two minutes, gives you a token. The trigger is a **webhook**, so n8n has to be reachable from the internet — Cloud is; a local instance needs a tunnel or `N8N_WEBHOOK_URL` pointing at a public address. |
| OpenRouter API key | One key, any model. Prefer OpenAI, Anthropic or a local gateway directly? Swap *Chat model (OpenRouter)* for the matching model node — nothing else changes. |
| Zvid API key | [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Free accounts include enough credits to try it. |

No Google account, no stock-media account, no payload builder — the agent
composes from Zvid's library through the MCP endpoint.

## Setup

1. **Import** `zvid-chat-video-agent.json`.
2. **OpenRouter credential** — create an **OpenRouter API** credential and
   attach it to *Chat model (OpenRouter)*.
3. **Zvid credential** — create a key at
   [app.zvid.io/api-keys](https://app.zvid.io/api-keys), add an n8n
   **Header Auth** credential with name `x-api-key` and your key as the value,
   and attach it to *Zvid MCP tools*. (Same credential type the rest of this
   series uses for the Zvid HTTP nodes.)
4. **Try it before Telegram exists.** Click **Test manually**. The fixed brief
   in *Test brief* runs the whole agent loop and **carries no approval**, so the
   agent's instructions are to stop at the quote — read its words in the
   *Chat reply* node. `allowedChatIds` never applies to this path, so nothing you
   do in step 6 can break it. (Stopping at the quote is a prompt-level rule like
   every other asking rule here; `maxRenderCredits` is the enforced ceiling.)
5. **Telegram credential** — talk to [@BotFather](https://t.me/BotFather), send
   `/newbot`, copy the token. In n8n create a **Telegram API** credential with
   that token and attach it to *On Telegram message*, *Send reply* and
   *Send video*. Then **activate the workflow** — the webhook only exists while
   it is active, and nothing arrives otherwise.
6. **Let your own chat in.** `allowedChatIds` in **Config** ships empty, which
   answers *no* Telegram chat at all. Message the bot once: it replies *"This
   bot is private… This chat is 774112900."* Paste that number into
   `allowedChatIds`, save, and message again.
7. **Send a brief** — *"12-second vertical teaser for FocusFlow, dark premium
   look, tagline Focus without friction"*. Expect two turns: a quote plus an
   editor link, then the video after you reply yes.
8. **Decide your ceiling.** `maxRenderCredits` ships at 25 — enough for a short
   vertical clip, and the one number that bounds what a misunderstanding can
   cost. See [Cost](#cost) for the honest worst case.

## The safety flow: quoted first, rendered second

| Step | Tool | Spends credits? |
| --- | --- | --- |
| 1. Plan the video | `plan_creative_video`, `find_matching_examples` | No |
| 2. Read the best example's variables | `start_from_example` | No |
| 3. Swap copy, media, colours; save a draft | `create_media_from_example` | **No** — returns a draft + a signed quote |
| 4. Report the quote and the editor link (`https://editor.zvid.io/?project=prj_…`), and ask | — | No |
| 5. Render, after your explicit yes | `render_media` (exact `draftId` + `quoteToken`) | **Yes, the quoted amount** |
| 6. Poll until finished, return the URL | `get_media` | No |

**Enforced by Zvid's server — a confused model cannot talk past these:**

- **`render_media` needs the signed quote.** No token, no render; and the server
  re-verifies its signature, the draft version, the payload hash and the price
  before submitting. Change the design or the cost and you get *"call get_media
  for a new quote"* instead of a charge.
- **`maxRenderCredits` is a per-render ceiling.** It travels in the *Zvid MCP
  tools* endpoint URL, comes from **Config**, and the server rejects any render
  quoted above it. Your dashboard's MCP credit limit is combined with it and the
  lower value wins, so you cannot raise your exposure from n8n alone.
- **No un-quoted render tool exists on this endpoint.** The URL pins
  `profile=creator`, and that profile never registers the direct-render,
  render-from-example or bulk-render tools — there is nothing for a model to
  find, whatever it is asked. (Separately, on the n8n side, *Zvid MCP tools* is
  set to **Selected**, so the model is bound to the nine listed tools.)

**Asked for in the system message — model behaviour, not a lock:**

- Quoting first and **waiting for your yes**. `create_media_from_example` returns
  the quote token in the *same* tool result, so a model *could* quote and render
  inside one turn; the instruction not to is what stops it, and instructions are
  not guarantees. Same for **one render per message** — `maxIterations` is a
  tool-call budget, not a render counter.
- `allowSameMessageApproval` in **Config** decides which rule the agent is given:
  at the default `false` the model is told that nothing inside the message
  carrying the brief can approve a render — not a credit ceiling, not "you may
  treat this as approval". Set it to `true` only for unattended one-shot runs,
  where a single message may approve its own render if it names a ceiling.
- The quote's ~15-minute expiry guards against **price and payload drift**, not
  against an eager agent: `get_media` on a draft mints a fresh signed quote on
  demand, by design, so the agent can always re-quote.

**Who can talk to it at all:** `allowedChatIds` is checked in *Screen request*
before any tool runs, and an empty list refuses every Telegram chat. The manual
test path carries no chat id and is deliberately exempt.

## Configuration

Everything lives in the `Config` node. Credentials never do.

| Key | Default | Notes |
| --- | --- | --- |
| `model` | `openai/gpt-4.1-mini` | Any OpenRouter model id. Cheap, and enough to drive the flow. **A stronger model plans noticeably better videos** — it picks better examples, writes better copy, and holds a multi-step rule more reliably — so reach for a current frontier model (a Claude Sonnet or GPT-5 class id; check OpenRouter's model list for the exact string) if results feel generic or the agent fumbles the quote-then-ask sequence. No model's behaviour was measured while building this. |
| `maxIterations` | `30` | Tool-call budget per message. A full build is roughly five calls plus polling; below ~20 the agent runs out mid-render. It is **not** a spend limit — several build-and-render cycles fit inside 30. |
| `memoryWindow` | `10` | Turns kept per chat. This is what lets "yes, render it" refer to the quote in the previous message. |
| `maxRenderCredits` | `25` | **The one server-enforced spend limit.** Sent to the MCP endpoint; any render quoted above it is refused. A 12–15 s vertical clip is 13–15 credits. Raise it deliberately, not casually. |
| `allowedChatIds` | `[]` | Chat IDs allowed to use the bot, e.g. `["774112900"]`. **Empty refuses every Telegram chat** — the template fails closed. Does not affect *Test manually*. |
| `allowSameMessageApproval` | `false` | When `false` the agent is told that a brief can never approve its own render. `true` allows a one-message approval that names a credit ceiling — for unattended runs only. |
| `videoUrlPrefixes` | `["https://cdn.zvid.io/videos/"]` | What a returned video URL must **start with** before *Send video* and **▶ Watch video** are allowed to fetch it. A path prefix, not just a host: finished renders are served from `https://cdn.zvid.io/videos/…`, while library example previews sit on the same host under `/library/examples/previews/…`, so a bare `https://cdn.zvid.io/` would accept a preview as if it were your video. Keep the trailing slash. An empty or malformed list blocks every link. |
| `replyOnError` | *"I ran into a problem finishing that…"* | Sent when the agent node itself fails (provider timeout, parsing failure, iteration cap) so the chat never goes silent. |

The MCP endpoint and its `profile=creator` live on the *Zvid MCP tools* node
rather than in Config, because they are that node's contract with the server;
`maxRenderCredits` is interpolated into that URL from Config. If the expression
ever fails to resolve, the MCP server answers `400 Invalid Zvid
maxRenderCredits value` — it does not quietly fall back to a bigger ceiling.

## Cost

**Chatting is free of credits.** Planning, matching examples, reading an
example's variables, saving a draft and getting a quote spend none — only
`render_media` does, and only at the number you were shown.

A render is billed by finished duration: **one credit per second of video at
1080p or below, rounded up**. The 12.5-second launch example the library returns
as the strongest match for a teaser brief therefore works out at **13 credits**,
and a 15-second cut at 15. The agent reports the server's own figure before it
asks you anything.

**The honest worst case.** `maxRenderCredits` caps a *single* render — not a
message, not a conversation, not an hour. Nothing above it is enforced:

- **Per message:** a full build is roughly five tool calls, and `maxIterations`
  ships at 30, so one message has room for something like **five** renders —
  on the order of `5 × maxRenderCredits`, about 125 credits at the shipped 25,
  not 25. (That is arithmetic on the call count, not a measured figure.)
- **Per hour:** the hourly render-job limit is a **Free-plan** limit — 20 jobs
  per hour. Paid plans (Hobby, Startup, Business) have **no** hourly job limit
  at all, so on a paid plan there is no hourly ceiling to fall back on: the
  outer bound is your credit balance. Even the Free-plan limit is best-effort —
  the rate limiter fails **open** if it cannot reach Redis.

So size `maxRenderCredits` against "how much would I mind losing to one
misunderstood conversation", not against an hourly cap that may not exist for
you. And keep `allowedChatIds` down to the chats you actually want served — who
can talk to the bot at all is the one part of this that genuinely fails closed.

Your model provider bills its own tokens per message, separately from Zvid
credits. A full build-and-render conversation on a mini-class model is cents,
not dollars — but a long argument with a frontier model is not free.

## How it works

| Node | What it does |
| --- | --- |
| **On Telegram message** | Telegram trigger, `message` updates only. A webhook: it needs an active workflow and a publicly reachable n8n. |
| **Test manually** → **Test brief** | The no-Telegram entry point. *Test brief* is a `Set` node holding one fixed brief — deliberately with no pre-approval in it, so a default click has nothing to approve. |
| **Prepare chat input** | Normalises both entry points into one shape: chat ID, message text, and whether this is really a Telegram chat. Photos and documents carry their words in `caption`, so those count as text too; stickers and voice notes do not. |
| **Config** | The eight knobs above. |
| **Screen request** | The gate in front of the agent: the message must contain text, and a Telegram chat must be listed in `allowedChatIds` — empty list, no answer. The refusal tells the owner their own chat id so setup is self-documenting. Not applied to the manual path, which has no chat id. Also derives the memory key (`tg-<chatId>`) and the approval rule handed to the agent. |
| **Brief ready?** | Routes a screened-out message straight to the reply, so a sticker or a stranger never reaches a model or a tool. |
| **Zvid AI Agent** | The tools agent. System message pins the example-first flow, the quote-then-confirm rule (with `allowSameMessageApproval` interpolated into it), one render per message, chat-length replies, and "print the MP4 URL on its own line". Its **error output** is wired, so a provider failure produces `replyOnError` instead of silence. It deliberately has **no** `retryOnFail`: a retry re-runs the entire turn from the top, so a render that had already gone through would be quoted and paid for a second time. |
| **Chat model (OpenRouter)** | Reads `model` from Config. Swap this node for another model provider without touching anything else. |
| **Chat memory** | Window buffer keyed on `tg-<chatId>`, `memoryWindow` turns deep. |
| **Zvid MCP tools** | n8n's stock **MCP Client Tool** against `https://mcp.zvid.io/mcp?profile=creator&maxRenderCredits=<Config>`, Header Auth (`x-api-key`), streamable HTTP, `include: selected` with the nine tools listed above. |
| **Chat reply** | The single exit for all three paths — the agent's answer, the agent's error output, a screened-out message. Takes the **last** `.mp4` URL that starts with a `videoUrlPrefixes` entry (so none of an older link, an off-host one, or an on-host *preview* can hijack the fetch), HTML-escapes the text, and trims to Telegram's 4096-character limit without ever dropping the video URL. `replyPlain` holds the un-escaped text for reading a run. |
| **Reply in Telegram?** | Real chat → the Telegram nodes. Manual run → straight to *▶ Watch video*, so a test run needs no Telegram credential. |
| **Send reply** | `sendMessage` with `parse_mode: HTML`. That is not cosmetic: the Telegram node **forces legacy Markdown when no parse mode is set**, and one unbalanced `_` — which any `prj_…` id or job id supplies — either fails the send with `400 can't parse entities` or silently italicises and eats part of the editor link. *Chat reply* escapes `& < >` to match. Attribution footer off, retries 3×, and set to continue on error so a text failure can never stop the clip going out. |
| **Video ready?** | True only when *Chat reply* found an allowed MP4 URL. |
| **Send video** | `sendVideo` with the render's own CDN URL, so Telegram fetches the file and plays it inline. It deliberately ships **no** additional fields: n8n's attribution footer is a `sendMessage`-only option, so on `sendVideo` there is nothing to switch off — and a flag set here would be copied straight into the Bot API request as an unrecognised parameter. Continues on error: if Telegram cannot fetch it (size or format), the run still ends green and the text reply already carried the link. |
| **▶ Watch video** | Downloads the MP4 as binary so you can play the result inside n8n too. Retries a few times (the CDN can 404 for a moment right after a render) and can never fail the run. On a quote-only run there is no URL to fetch and it shows a warning. |

## Extending it

- **Publish the result** — after *Send video*, add an HTTP Request node (GET the
  URL, response format *File*) into the native **YouTube** node, or pass the URL
  to a scheduler like Blotato, Buffer or Metricool over their HTTP API. Kept out
  of the required path on purpose.
- **Sign in instead of pasting a key** — switch *Zvid MCP tools* to an
  **MCP OAuth2 API** credential (keep dynamic client registration enabled) and
  sign in with your Zvid account rather than sending an `x-api-key` header. The
  rest of the flow is unchanged.
- **Slack, Discord, WhatsApp, email** — replace the trigger and the two send
  nodes. Everything between *Prepare chat input* and *Chat reply* is
  channel-agnostic; *Prepare chat input* is the only node that knows what a
  Telegram update looks like.
- **More tools** — add names to `includeTools` on *Zvid MCP tools*.
  `revise_media` (edit an existing draft) is the usual next one; keep the list
  short, and remember that anything you add is also something the model can call.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Nothing happens when you message the bot | The workflow is not **active**, or n8n is not reachable from the internet. Telegram delivers by webhook to a public URL — a laptop instance needs a tunnel or `N8N_WEBHOOK_URL` set to a public address. Also check no *other* n8n workflow or script has claimed the same bot token: Telegram gives the webhook to whoever set it last. |
| *"This bot is private… This chat is 774112900."* | Working as designed on a fresh import: `allowedChatIds` ships empty and refuses every chat. Copy the number from that reply into `allowedChatIds` in **Config** and save. |
| `OUTPUT_PARSING_FAILURE` | The model returned something the agent could not parse, most often a provider dropping or mangling a tool call mid-stream. Resend the message; if a particular model does it repeatedly, put a more stable one in `model`. |
| `Request timed out` | The provider or a tool call did not answer in time. Several things can cause it — provider load, a slow tool round trip, a long render poll — so do not assume one. Resend the message, and if it repeats, try another `model`. Ask the agent for the status of any render that had already started rather than starting a new one. |
| MCP `401` / "Authentication required" | The credential on *Zvid MCP tools* is wrong or of the wrong kind. It must be a **Header Auth** credential with name exactly `x-api-key` and a `zvid_…` key as its value, with the node's Authentication set to *Header Auth*. An OAuth credential is a different mode. |
| MCP `400 Invalid Zvid maxRenderCredits value` | The `maxRenderCredits` expression in the *Zvid MCP tools* endpoint URL resolved to nothing — usually the key was renamed or removed in **Config**. Put an integer back. The server refusing to start is the intended failure: it never falls back to a larger ceiling. |
| Nodes import as `CUSTOM.zvidAgentTools` (or the import fails outright) | You are importing a file exported from an instance that had Zvid's community node mounted as a local extension. `CUSTOM.`-prefixed node types only resolve on that machine. Use this file, which uses the stock MCP Client Tool. |
| The agent quotes but never renders | Working as designed — it needs an explicit yes in a **later** message. Reply with the number, e.g. "yes, render it, 13 credits is fine". |
| It rendered without me approving | Check `allowSameMessageApproval` first — at `true`, one message naming a credit ceiling is treated as its own approval. At `false` the agent was told not to, and it did anyway: asking is prompt-enforced, not locked (see [the safety flow](#the-safety-flow-quoted-first-rendered-second)). Lower `maxRenderCredits` — that ceiling *is* enforced — and consider a cheaper-to-be-wrong model. |
| "Draft payload changed after quoting" / "Render cost changed after quoting" | The quote is signed against the exact draft and price and lasts about fifteen minutes. The agent should call `get_media` for a fresh quote and ask again. |
| "above the MCP per-render limit" | The video costs more than `maxRenderCredits` in **Config** (or your dashboard's MCP limit, whichever is lower). Ask for a shorter cut, or raise the limit deliberately. |
| The reply says *"Not posted as a clip: that link is not a finished Zvid render."* | The URL in the agent's answer did not start with a `videoUrlPrefixes` entry, so nothing fetched it. The common case is **not** a hostile link: it is the model pasting a library example's `cdn.zvid.io/library/examples/previews/…` preview at quote time — that is another project's demo clip, and posting it as your video would be worse than the notice. Off-host links land here too. If your account genuinely serves renders from another host or path, add that prefix (with its trailing slash) to `videoUrlPrefixes`. |
| The link arrived but no clip played | Telegram could not fetch the file — usually size (it fetches a URL up to roughly 20 MB, which a short clip is nowhere near, but a long one can exceed) or format. *Send video* continues on error precisely so the run still ends green; the text reply already contains the URL, and **▶ Watch video** has the file. |
| A stranger is talking to my bot | Bot usernames are public and anyone can message one. Only ids in `allowedChatIds` get an answer, and everyone else is turned away in *Screen request* before any tool call — so if this is happening, that list is not what you think it is. |
| Replies get cut off | Telegram's hard limit is 4096 characters. *Chat reply* trims and marks it, keeping the video URL. If the agent is writing essays, that is a model-verbosity problem — the system message asks for a few short lines. |
| `429` / `hourly_limit_exceeded` on a render | Your plan's hourly render limit is spent — the message says how many minutes remain. This is a **Free-plan** limit (20 jobs per hour); paid plans have no hourly job limit, so you will not see this row there. A person chatting will not hit it; a rapid test loop can. Nothing is charged for a rejected submit. |
| Two people get each other's context | They should not: memory is keyed `tg-<chatId>`. If it happens, check that *Chat memory* still reads `sessionId` from *Screen request* and that `sessionIdType` is *Define below*. |
| `403 Template limit reached` — *"Your Free plan allows up to 5 templates"* | **Hit this in a real run.** The example-first path saves your draft as a **template** on the account, so a Free plan that already holds 5 cannot create another one — the agent never gets as far as a quote, and it will tell you so rather than pretend. Archive a template you no longer need at [app.zvid.io](https://app.zvid.io) (or upgrade), then send the brief again. Nothing is charged when this happens. Worth knowing before you demo the workflow to somebody. |

## Verified

**The agent core was executed inside n8n; the Telegram leg was not.** Everything
below is what was actually checked. See **Live n8n execution** at the end for the
run itself.

- **Node types and versions** — every node type and `typeVersion` in the file
  was checked against a table introspected from a running **n8n 2.29.10**
  container (`agent` 3.1, `lmChatOpenRouter` 1, `memoryBufferWindow` 1.4,
  `mcpClientTool` 1.4, `telegramTrigger` 1.3, `telegram` 1.2, plus core
  `set` 3.4 / `code` 2 / `if` 2.2 / `httpRequest` 4.2 / `manualTrigger` 1 /
  `stickyNote` 1). Nothing exceeds what that install offers, and no
  `CUSTOM.`-prefixed type appears anywhere.
- **Structure** — 291 automated assertions on the shipped JSON, plus a second
  independently written check pass over the same file: it parses;
  every connection resolves, including the `ai_languageModel`, `ai_memory` and
  `ai_tool` ports landing on the agent; every node is reachable from a trigger;
  names and ids are unique; all three code nodes compile; every `$('Node')`
  reference in every expression points at a node that really exists **and runs
  earlier in the graph**; every `$('Config')…` key exists in the Config JSON;
  no node carries a `credentials` block; the MCP node's nine `includeTools` are
  exactly the intended nine and its ceiling comes from Config; the safe defaults
  ship as documented (empty allow-list, `allowSameMessageApproval: false`,
  `maxRenderCredits` well under the MCP default, `videoUrlPrefixes` carrying a
  *path* and not a bare host, a `Test brief` with no pre-approval in it);
  `Send reply` pins `parse_mode: HTML` and `appendAttribution: false` while
  *Send video* ships no additional fields at all; the `▶ Watch video` node
  matches the series' contract and is the rightmost node; and no API key, bot
  token or non-canonical URL is present.
- **The three code nodes were executed** against 17 fixtures with mocked n8n
  globals, read straight out of the shipped workflow file: a real Telegram
  update, a photo-with-caption update, a sticker (screened out politely), a
  non-listed sender, an empty allow-list (screened, and the reply carries the
  chat id), an allow-listed sender with mixed number/string/blank entries, the
  manual brief with and without a populated allow-list (never screened),
  same-message approval on and off, an agent error item, an empty answer, a
  reply containing two MP4 URLs (the last one wins), a reply whose only `.mp4`
  links are off-host, host-prefix-spoofed or plain `http` (**none fetched**, and
  the reply says so), a reply that pastes a real library example's on-host
  `/library/examples/previews/…` preview at quote time (**also not fetched** —
  the case a host-only allow-list would have posted as the user's finished
  video), a reply full of `_`, `&`, `<` and `>` (escaped, so the HTML parse mode
  cannot 400), and a 5 270-character reply (trimmed to exactly 4096 with the
  video URL preserved and no half-written HTML entity at the cut). All 17 pass.
  The embedded code and system message are asserted byte-identical to their
  standalone sources.
- **The render URL shape was read in the source**, which is what
  `videoUrlPrefixes` is pinned to: the render worker uploads a finished video
  under the key `videos/<userId>/<name>-<timestamp>.mp4`
  (`zvid-cell/services/maybeUpload.js`, `keyPrefix: 'videos'`), and the API turns
  that relative path into `https://cdn.zvid.io/…` (`orch/utils/url.js`,
  `orch/services/jobLifecycle.js`). Library example previews live on the same
  host under `library/examples/previews/`. The fixtures use the real
  `/videos/<userId>/…` shape, not an invented one.
- **The cost bounds were read in the source**, so the [Cost](#cost) section can
  be specific about what is *not* bounded: `jobs_limit_per_hour` is seeded to 20
  for the **Free** plan and `NULL` for Hobby, Startup and Business
  (`orch/database/schema.sql`, `orch/database/migrations/015_plan_rate_limits.sql`),
  and `NULL` is treated as unlimited in `orch/services/renderRateLimiter.js` —
  which also fails **open** on any error. There is therefore no hourly render
  ceiling on a paid plan, which is why the docs point at `maxRenderCredits` and
  the balance instead of an hourly figure.
- **The credit guards were read in the source**, not assumed: `render_media`
  requires the signed `quoteToken` and re-verifies signature, draft version,
  payload hash and quoted credits; `maxRenderCredits` is enforced server-side
  per render and combined with the dashboard cap by `Math.min`; the `creator`
  profile excludes every direct/bulk render tool; and `get_media` on a draft
  mints a fresh quote on demand (which is why the expiry is a drift guard, not
  a spend guard). The claims in [the safety flow](#the-safety-flow-quoted-first-rendered-second)
  are written to match that code, including what it does **not** guarantee.
- **The example-first chain was probed read-only against the live MCP
  endpoint** (`https://mcp.zvid.io/mcp`, the same endpoint the workflow points
  at, though through a different MCP client — not through the n8n node):
  `find_matching_examples` on the launch-teaser brief returned
  `decision: "adapt-example"` against a pool of **410 published examples**, with
  `saas-product-hunt-launch` (12.5 s, 3 scenes, free) as the strong match, and
  `start_from_example` returned that example's full payload plus its 15 declared
  variables and adaptation map. Nothing was created and no credits were spent.
- **The credit figures above come from the API's credit rule** (one credit per
  second of ≤1080p video, rounded up) applied to that example's 12.5 s, not from
  a quote issued in this template. The agent always reports the server's own
  number before asking.

**Not verified here:** the Telegram leg. The n8n instance used for authoring has
no Telegram credential, so *On Telegram message*, *Send reply* and *Send video*
are structurally complete and version-checked but were never exercised against
Telegram's API. What the two send nodes *are* based on is n8n's own published
source for the Telegram node, read directly: `addAdditionalFields()` puts the
whole attribution block — the `appendAttribution === undefined → true` default
for node version ≥ 1.1, the text append, and the `delete` that strips the flag
again — inside `if (operation === 'sendMessage')`, and defaults `parse_mode` to
legacy `Markdown` in the same block, then runs
`Object.assign(body, additionalFields)` unconditionally. Hence `parse_mode: HTML`
and `appendAttribution: false` on *Send reply* (both do something) and no
additional fields at all on *Send video* (nothing to suppress, and anything left
there would be forwarded to the Bot API verbatim). Reading source is not the same
as sending a message, and this is the one leg no run has touched.

Nothing about how a specific model behaves is verified either — not its planning
quality and not whether it honours the quote-then-ask rule. That is exactly why
`maxRenderCredits` ships low.

### Live n8n execution (2026-07-30)

Imported into **n8n 2.29.10** (self-hosted, Docker) and executed from the CLI via
the *Test manually* path, with a real OpenRouter credential on *Chat model* and a
real Zvid API key on *Zvid MCP tools* (Header Auth). Brief: *"Create a 12-second
vertical launch teaser for a productivity app called FocusFlow, dark premium
look."* — the shipped test brief, which carries no approval.

What this run proves:

- **The graph runs green end to end.** All 13 functional nodes on the manual path
  executed, status `success`, ending on **▶ Watch video**.
- **The agent really is wired.** *Chat model (OpenRouter)* and *Chat memory* each
  ran **4** iterations and *Zvid MCP tools* ran **3** times — so the
  `ai_languageModel`, `ai_memory` and `ai_tool` connections all resolve at
  runtime, against the live `https://mcp.zvid.io/mcp` endpoint with header auth.
- **It refused to invent a result.** The third MCP call came back
  `403 Template limit reached — Your Free plan allows up to 5 templates` (the test
  account already holds 12). The agent reported that honestly and asked what to do
  next, instead of claiming a draft, a quote or a URL that did not exist. That is
  the behaviour the SAFETY section asks for, observed rather than assumed.
- **The reply path shaped the answer correctly**: *Chat reply* emitted
  `status: answered`, `hasVideo: false`, `videoUrlBlocked: false`, `videoUrl: ""`,
  and `sessionId: manual-test` — so the no-video branch is exercised, and
  **▶ Watch video** continued green with nothing to fetch.
- **The manual path is reachable while the allow-list stays closed.**
  `allowedChatIds` shipped empty and the run still worked, confirming
  `!isTelegram || allowList.includes(chatId)` lets the local test through while a
  Telegram stranger is turned away.
- **Nothing was charged.** 0 credits: the run never reached `render_media`, which
  is exactly right for a brief containing no approval.

**Not executed:** the draft → quote → confirm → render sequence (blocked by the
template-limit above, an account-state limit rather than a workflow defect — see
the troubleshooting row), and the entire Telegram leg (*On Telegram message*,
*Send reply*, *Send video*) because this instance has no Telegram credential.
No model behaviour beyond the single turn above is measured: whether a model
reliably waits for a yes before rendering is a prompt-level property, and the
structural guards named in [the safety flow](#the-safety-flow-quoted-first-rendered-second)
are what actually bound a mistake.
