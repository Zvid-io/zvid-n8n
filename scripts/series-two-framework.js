'use strict';

// Dedicated, credential-free authoring framework for days 31–60. Runtime helpers
// are serialized into Code nodes so the exported workflows need no local modules.
const assert = require('node:assert/strict');
const STICKY = 'n8n-nodes-base.stickyNote';
const ZVID = '@zvid/n8n-nodes-zvid.zvid';

function req(value, label = 'value') {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) throw new Error(label + ' is required.');
  return value;
}
function str(value, max = 100) {
  return String(value === undefined || value === null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function num(value, label = 'number', min = 0, max = 1e12) {
  req(value, label);
  if (typeof value === 'boolean' || typeof value === 'object') throw new Error(label + ' must be a finite number.');
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(label + ' must be a finite number from ' + min + ' to ' + max + '.');
  return n;
}
function list(value, label = 'items') {
  if (!Array.isArray(value)) throw new Error(label + ' must be an array.');
  if (value.length > 1000) throw new Error(label + ' is limited to 1,000 input records per run.');
  return value;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"'{}]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '{': '&#123;', '}': '&#125;' }[c]));
}
function normalizeBrief(brief) {
  if (!brief || typeof brief !== 'object' || Array.isArray(brief)) throw new Error('The transformation must return a video brief or explicit skip result.');
  if (brief.skip === true) return { skip: true, reason: str(req(brief.reason, 'Skip reason'), 250), meta: brief.meta || {} };
  const cards = list(brief.cards, 'cards');
  if (!cards.length || cards.length > 6) throw new Error('The video brief must contain one to six cards.');
  return {
    title: str(req(brief.title, 'Video title'), 100),
    subtitle: str(brief.subtitle, 180),
    cards: cards.map((card, i) => {
      if (!card || typeof card !== 'object') throw new Error('Card ' + (i + 1) + ' must be an object.');
      return { label: str(req(card.label, 'Card label'), 60), value: str(req(card.value, 'Card value'), 80), detail: str(card.detail, 140) };
    }),
    footer: str(brief.footer || 'Review the result before sharing.', 160),
    sourceKey: str(req(brief.sourceKey, 'sourceKey'), 160),
    meta: brief.meta && typeof brief.meta === 'object' ? brief.meta : {},
  };
}
function normalizeConfig(cfg = {}) {
  if (typeof cfg.dryRun !== 'boolean') throw new Error('Config dryRun must be a boolean.');
  const color = String(cfg.accentColor || '#D8F17C');
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('accentColor must use six hexadecimal digits.');
  return {
    dryRun: cfg.dryRun,
    brandName: str(cfg.brandName || 'Zvid', 45),
    accentColor: color,
    maxRenderCredits: num(cfg.maxRenderCredits ?? 30, 'maxRenderCredits', 0, 1000),
    sceneSeconds: num(cfg.sceneSeconds ?? 6, 'sceneSeconds', 2, 8),
    pollSeconds: num(cfg.pollSeconds ?? 5, 'pollSeconds', 1, 30),
    maxWaitSeconds: num(cfg.maxWaitSeconds ?? 600, 'maxWaitSeconds', 10, 1200),
  };
}
function buildPayload(inputBrief, inputCfg = {}, spec = {}) {
  const brief = normalizeBrief(inputBrief);
  if (brief.skip) return null;
  const cfg = normalizeConfig({ dryRun: false, maxRenderCredits: 30, ...inputCfg });
  const duration = cfg.sceneSeconds;
  const accent = cfg.accentColor;
  const ink = '#102026';
  const cream = '#F5F2E8';
  const text = (html, x, y, width, track = 2, size = 32) => ({ type: 'TEXT', x, y, width, anchor: 'top-left', track, enterBegin: 0.15, enterEnd: 0.5, enterAnimation: 'fade', exitEnd: duration, style: { fontFamily: 'Arial', color: cream, fontSize: size }, html });
  const svg = (markup) => ({ type: 'SVG', width: 1280, height: 720, track: 0, enterBegin: 0, exitEnd: duration, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">' + markup + '</svg>' });
  const limited = (value, style, lines) => {
    const size = Number((style.match(/font-size:(\d+)px/) || [0, 32])[1]);
    const leading = Number((style.match(/line-height:([\d.]+)/) || [0, 1.3])[1]);
    const height = Math.ceil(size * leading * lines) + 2;
    return '<div style="overflow:hidden;max-height:' + height + 'px;overflow-wrap:anywhere;' + style + '">' + escapeHtml(value) + '</div>';
  };
  const smallHeader = (label, dark = false) => text('<div style="font-size:20px;font-weight:700;letter-spacing:3px;color:' + (dark ? ink : accent) + ';">' + escapeHtml(label) + '</div>', 74, 54, 1110, 3);
  const scenes = [{ id: 'opening', duration, backgroundColor: ink, visuals: [
    svg('<rect width="1280" height="720" fill="' + ink + '"/><circle cx="1170" cy="130" r="280" fill="' + accent + '" opacity=".12"/><path d="M900 0V720 M1060 0V720 M1220 0V720" stroke="' + cream + '" opacity=".08"/><rect x="74" y="143" width="94" height="7" rx="3" fill="' + accent + '"/>'),
    smallHeader(cfg.brandName + ' / ' + String(spec.day || 'BRIEF')),
    text(limited(brief.title, 'font-size:' + (brief.title.length > 70 ? 54 : 66) + 'px;line-height:1.09;font-weight:800;color:' + cream + ';', 3), 74, 192, 1030, 2),
    text(limited(brief.subtitle, 'font-size:27px;line-height:1.4;color:#BBD0CE;', 3), 78, 460, 1020, 2),
    text('<div style="font-size:17px;color:#BBD0CE;letter-spacing:2px;">' + escapeHtml(brief.sourceKey) + '</div>', 78, 645, 1110, 3),
  ] }];
  for (let start = 0; start < brief.cards.length; start += 3) {
    const cards = brief.cards.slice(start, start + 3);
    const count = cards.length;
    const gap = 24;
    const width = Math.floor((1132 - gap * (count - 1)) / count);
    const visuals = [svg('<rect width="1280" height="720" fill="' + cream + '"/><rect x="74" y="139" width="1132" height="2" fill="' + ink + '" opacity=".16"/>'), smallHeader(cfg.brandName + ' / THE DETAILS', true)];
    cards.forEach((card, i) => {
      const left = 74 + i * (width + gap);
      visuals.push({ ...svg('<rect x="' + left + '" y="192" width="' + width + '" height="407" rx="22" fill="' + ink + '"/><circle cx="' + (left + width - 35) + '" cy="226" r="8" fill="' + accent + '"/>'), track: 1 });
      visuals.push(text(limited(card.label, 'font-size:20px;line-height:1.35;letter-spacing:1px;font-weight:700;color:' + accent + ';', 2), left + 26, 237, width - 52, 2));
      const valueSize = card.value.length > 42 ? 28 : card.value.length > 22 ? 36 : 48;
      visuals.push(text(limited(card.value, 'font-size:' + valueSize + 'px;line-height:1.1;font-weight:800;color:' + cream + ';', 3), left + 26, 324, width - 52, 2));
      visuals.push(text(limited(card.detail, 'font-size:19px;line-height:1.35;color:#C3D3D0;', 4), left + 26, 482, width - 52, 2));
    });
    visuals.push(text('<div style="font-size:18px;color:' + ink + ';">' + (start + 1) + '–' + (start + cards.length) + ' / ' + brief.cards.length + '</div>', 74, 650, 1110, 3));
    scenes.push({ id: 'details-' + (start / 3 + 1), duration, backgroundColor: cream, visuals });
  }
  scenes.push({ id: 'closing', duration, backgroundColor: accent, visuals: [
    svg('<rect width="1280" height="720" fill="' + accent + '"/><circle cx="1140" cy="560" r="230" fill="none" stroke="' + ink + '" stroke-width="2" opacity=".2"/><circle cx="1140" cy="560" r="180" fill="none" stroke="' + ink + '" stroke-width="2" opacity=".2"/><path d="M78 181h100" stroke="' + ink + '" stroke-width="8"/>'),
    smallHeader(cfg.brandName + ' / NEXT STEP', true),
    text(limited(brief.footer, 'font-size:51px;line-height:1.17;font-weight:800;color:' + ink + ';', 4), 74, 248, 1000, 2),
    text('<div style="font-size:19px;color:' + ink + ';">' + escapeHtml(brief.sourceKey) + '</div>', 78, 645, 1080, 3),
  ] });
  return { name: String(spec.slug || 'zvid-business-brief').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100), resolution: 'hd', frameRate: 30, backgroundColor: ink, outputFormat: 'mp4', scenes, audios: [] };
}

function checkValidationResult(result, build, cfg) {
  if (!result || result.valid !== true) {
    const errors = Array.isArray(result && result.errors) ? result.errors.map(e => (e.field || 'project') + ': ' + e.message).join('; ') : 'Project did not validate.';
    throw new Error('Zvid validation failed: ' + errors.slice(0, 1000));
  }
  const credits = num(result.creditsRequired, 'Validation creditsRequired', 0, 1000);
  if (credits > cfg.maxRenderCredits) throw new Error('Render requires ' + credits + ' credits; maxRenderCredits is ' + cfg.maxRenderCredits + '. Increase the configured cap deliberately.');
  return { ...build, quotedCredits: credits, warnings: result.warnings || [], payload: result.payload || build.payload };
}

const HELPERS = [req, str, num, list, escapeHtml, normalizeBrief, normalizeConfig, buildPayload, checkValidationResult].map(fn => fn.toString()).join('\n\n');
function runTransform(spec, src) {
  if (!src || typeof src !== 'object' || Array.isArray(src)) throw new Error('Input must be a JSON object.');
  return normalizeBrief(new Function('src', 'req', 'str', 'num', 'list', '"use strict";\n' + spec.transform)(src, req, str, num, list));
}

function boolCondition(leftValue, id) {
  return { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id, leftValue, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} };
}
function buildWorkflow(spec) {
  assert.ok(Number.isInteger(spec.day) && spec.day >= 31 && spec.day <= 60, 'day must be 31–60');
  assert.match(spec.slug, /^(?:zvid-)?[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(spec.title && spec.description && spec.transform && spec.sample, 'title, description, transform, sample are required');
  runTransform(spec, spec.sample);
  const config = { brandName: spec.brandName || 'Zvid', accentColor: ['#D8F17C', '#FFCD8B', '#A7DDD8', '#D7C2F3', '#F5ADA1', '#ADD4FF'][(spec.day - 31) % 6], dryRun: false, maxRenderCredits: 30, sceneSeconds: 6, pollSeconds: 5, maxWaitSeconds: 600 };
  const baseId = 'zvid-series-two-' + spec.day + '-';
  let index = 0;
  const nodes = [];
  const node = (name, type, position, parameters = {}, extra = {}) => {
    const n = { id: baseId + String(++index).padStart(2, '0'), name, type, typeVersion: type === ZVID || type === STICKY || type === 'n8n-nodes-base.manualTrigger' ? 1 : type === 'n8n-nodes-base.set' ? 3.4 : type === 'n8n-nodes-base.if' ? 2.2 : 2, position, parameters, ...extra };
    nodes.push(n); return n;
  };
  node('Test manually', 'n8n-nodes-base.manualTrigger', [70, 160]);
  node('Sample input', 'n8n-nodes-base.code', [310, 160], { jsCode: 'return [{ json: ' + JSON.stringify(spec.sample, null, 2) + ' }];' });
  node('Receive event', 'n8n-nodes-base.webhook', [70, 340], { httpMethod: 'POST', path: spec.slug, responseMode: 'onReceived', options: { responseCode: { values: { responseCode: 'customCode', customCode: 202 } }, responseData: '{"accepted":true,"message":"Inspect the workflow execution for its result."}', responseHeaders: { entries: [{ name: 'Content-Type', value: 'application/json' }] } } }, { webhookId: baseId + 'event' });
  node('Config', 'n8n-nodes-base.set', [590, 245], { mode: 'raw', jsonOutput: JSON.stringify(config, null, 2), includeOtherFields: true, options: {} });
  const normalizeCode = HELPERS + '\nconst incoming = $input.first().json;\nconst src = incoming.body !== undefined ? incoming.body : incoming;\nif (!src || typeof src !== "object" || Array.isArray(src)) throw new Error("Input must be a JSON object.");\nconst cfg = normalizeConfig($("Config").first().json);\nconst transform = (src) => {\n' + spec.transform + '\n};\nconst sourceBrief = transform(src);\nconst brief = normalizeBrief(sourceBrief);\nif (brief.skip) return [{ json: { ready: false, status: "nothing_to_render", reason: brief.reason, meta: brief.meta } }];\nconst payload = buildPayload(brief, cfg, ' + JSON.stringify({ slug: spec.slug, day: spec.day }) + ');\nreturn [{ json: { ready: true, brief, sourceBrief, payload, sourceKey: brief.sourceKey, meta: brief.meta, seconds: payload.scenes.reduce((total,scene)=>total+scene.duration,0) } }];';
  node('Normalize and build video', 'n8n-nodes-base.code', [1010, 160], { jsCode: normalizeCode });
  node('Work found?', 'n8n-nodes-base.if', [1260, 160], boolCondition('={{ $json.ready === true }}', baseId + 'work'));
  node('Nothing to render', 'n8n-nodes-base.code', [1510, 340], { jsCode: 'const result=$input.first().json; return [{json:{status:"nothing_to_render",reason:result.reason,meta:result.meta,renderSubmitted:false}}];' });
  node('Validate project (free)', ZVID, [1970, 160], { resource: 'render', operation: 'validate', source: 'json', projectJson: '={{ JSON.stringify($json.payload) }}', additionalFields: {} });
  node('Check validation and credit cap', 'n8n-nodes-base.code', [2220, 160], { jsCode: HELPERS + '\nconst result=checkValidationResult($input.first().json,$("Normalize and build video").first().json,normalizeConfig($("Config").first().json));return [{json:result}];' });
  node('Dry run?', 'n8n-nodes-base.if', [2470, 160], boolCondition('={{ $("Config").first().json.dryRun === true }}', baseId + 'dry'));
  node('Save draft to editor', ZVID, [2940, 25], { resource: 'project', operation: 'create', projectName: '={{ $("Normalize and build video").first().json.brief.title }}', projectJson: '={{ JSON.stringify($json.payload) }}' }, { onError: 'continueRegularOutput', alwaysOutputData: true });
  node('Draft and credit quote', 'n8n-nodes-base.code', [3200, 25], { jsCode: 'const saved=$input.first().json;const built=$("Check validation and credit cap").first().json;const project=saved.project||saved;const id=project.id||project.projectId;const editorLink=typeof id==="string"&&/^prj_[a-zA-Z0-9_-]+$/.test(id)?"https://editor.zvid.io/?project="+encodeURIComponent(id):null;const editorDraftSaved=Boolean(editorLink);return [{json:{status:editorDraftSaved?"draft":"draft_unavailable",dryRun:true,renderSubmitted:false,editorDraftSaved,sourceKey:built.sourceKey,quotedCredits:built.quotedCredits,seconds:built.seconds,brief:built.brief,sourceBrief:built.sourceBrief,editorLink,editorDraftError:saved.error?String(saved.error.message||saved.error).slice(0,500):null,meta:built.meta}}];' });
  node('Submit render once', ZVID, [2940, 510], { resource: 'render', operation: 'create', renderType: 'video', source: 'json', projectJson: '={{ JSON.stringify($json.payload) }}', waitForCompletion: false, additionalFields: {} });
  node('Wait for completed render', ZVID, [3200, 510], { resource: 'render', operation: 'get', jobId: '={{ $json.jobId || $json.id }}', waitForCompletion: true, waitOptions: { pollInterval: '={{ $("Config").first().json.pollSeconds }}', maxWaitTime: '={{ $("Config").first().json.maxWaitSeconds }}' } });
  node('Video result', 'n8n-nodes-base.code', [3460, 510], { jsCode: 'const job=$input.first().json;const built=$("Check validation and credit cap").first().json;const result=job.result||job.output||job.returnvalue||{};const raw=job.outputUrl||job.videoUrl||(typeof result==="string"?result:result.url||result.outputUrl||result.videoUrl);const status=String(job.state||job.status||"");if(status!=="completed")throw new Error("Render ended with state "+status);if(typeof raw!=="string"||!/^https:\\/\\//i.test(raw))throw new Error("Completed render job "+String(job.jobId||job.id||"unknown")+" has no HTTPS video URL. Its video upload is missing or unavailable. Inspect the job in your Zvid dashboard before running again. Another run spends credits. This workflow does not resubmit automatically.");return [{json:{status,dryRun:false,jobId:job.jobId||job.id,videoUrl:raw,sourceKey:built.sourceKey,quotedCredits:built.quotedCredits,seconds:built.seconds,title:built.brief.title,brief:built.brief,sourceBrief:built.sourceBrief,meta:built.meta,renderSubmitted:true}}];' });
  node('Completed video available?', 'n8n-nodes-base.if', [3980, 510], boolCondition('={{ $json.status === "completed" && $json.dryRun === false && typeof $json.videoUrl === "string" && $json.videoUrl.startsWith("https://") }}', baseId + 'watch'));
  node('Watch video', 'n8n-nodes-base.httpRequest', [4240, 510], { url: '={{ $json.videoUrl }}', responseFormat: 'file', dataPropertyName: 'data', options: { timeout: 30000 } }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000, onError: 'continueRegularOutput' });

  const groups = [
    ['1. Choose input', 'Run the included sample manually, or POST JSON to Receive event. The webhook acknowledges immediately; its execution contains the eventual result. Edit Config before rendering.', [0, 0, 850, 540], ['Test manually', 'Sample input', 'Receive event', 'Config']],
    ['2. Apply the business rules', 'Normalize required fields and calculate the actual brief. Empty eligible input produces a visible zero-work result and skips validation and rendering.', [940, 0, 850, 540], ['Normalize and build video', 'Work found?', 'Nothing to render']],
    ['3. Validate and control credits', 'Zvid checks the project free of render charges. Reject invalid input, unavailable quotes and quotes above maxRenderCredits before choosing draft or paid rendering.', [1900, 0, 850, 400], ['Validate project (free)', 'Check validation and credit cap', 'Dry run?']],
    ['4. Optional editor draft', 'Only dryRun=true enters this branch. Open editorLink and inspect the quoted credits. A draft-save error remains visible in editorDraftError.', [2870, -160, 620, 360], ['Save draft to editor', 'Draft and credit quote']],
    ['5. Render once and retain the URL', 'Paid submission has no automatic retries. Poll the accepted job within the configured wait budget; Video result keeps its completed URL and source metadata.', [2870, 330, 920, 380], ['Submit render once', 'Wait for completed render', 'Video result']],
    ['6. Watch the completed MP4', 'Completed media only: Watch video → Binary → data → View. Downloads have a 30-second timeout and at most three attempts. The result URL survives a failed preview.', [3910, 330, 620, 380], ['Completed video available?', 'Watch video']],
  ];
  const fields = Array.isArray(spec.fields) ? spec.fields.map(f => typeof f === 'string' ? f : f.name).join(', ') : String(spec.fields || Object.keys(spec.sample).join(', '));
  const guideReference = spec.docLink ? 'See the [companion guide](' + spec.docLink + ') for exact input rules.' : 'Exact input rules are in the included `' + spec.slug.replace(/^zvid-/, '') + '.md` companion; [Zvid documentation](https://docs.zvid.io) covers API setup.';
  const overview = '## ' + spec.title + '\n\n### How it works\n' + spec.description + ' Run the included sample manually or POST the required JSON to the webhook. The workflow applies deterministic business rules and creates a branded 1280×720 MP4 with vector graphics and text. The output contains the source key, calculated metadata, credit quote and completed video URL. Delivery and social publishing can be added after reviewing the result.\n\n### Setup\n1. Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before configuring Zvid credentials. A workspace owner/admin may need to install it.\n2. Create a **Zvid API** credential at https://app.zvid.io/api-keys with Base URL `https://api.zvid.io`. Select it on all four Zvid nodes.\n3. Required input: **' + fields + '**. Edit **Sample input** or send the same shape to **Receive event**.\n4. Edit **Config**. The default **`dryRun: false` renders and spends credits** after checking `maxRenderCredits`. Set `dryRun: true` for an editor draft and quote.\n5. Review **Watch video → Binary → data → View**. The webhook returns an immediate 202 acknowledgement; open its execution for the result.\n\n### Customization\nChange brandName, accentColor, sceneSeconds and the bounded polling controls in Config. ' + guideReference + ' Support: https://zvid.io/contact';
  node('Overview — day ' + spec.day, STICKY, [-740, -160], { color: 1, width: 660, height: 1140, content: overview });
  groups.forEach((g, i) => node(g[0], STICKY, g[2].slice(0, 2), { color: 7, width: g[2][2], height: g[2][3], content: '## ' + g[0] + '\n' + g[1] }, { id: baseId + 'section-' + (i + 1) }));
  const connections = {};
  const wire = (from, to, branch = 0) => { if (!connections[from]) connections[from] = { main: [] }; while (connections[from].main.length <= branch) connections[from].main.push([]); connections[from].main[branch].push({ node: to, type: 'main', index: 0 }); };
  wire('Test manually', 'Sample input'); wire('Sample input', 'Config'); wire('Receive event', 'Config'); wire('Config', 'Normalize and build video'); wire('Normalize and build video', 'Work found?');
  wire('Work found?', 'Validate project (free)'); wire('Work found?', 'Nothing to render', 1); wire('Validate project (free)', 'Check validation and credit cap'); wire('Check validation and credit cap', 'Dry run?');
  wire('Dry run?', 'Save draft to editor'); wire('Save draft to editor', 'Draft and credit quote'); wire('Dry run?', 'Submit render once', 1); wire('Submit render once', 'Wait for completed render'); wire('Wait for completed render', 'Video result'); wire('Video result', 'Completed video available?'); wire('Completed video available?', 'Watch video');
  const workflow = { name: 'Day ' + spec.day + ' · ' + spec.title + ' (Zvid)', nodes, connections, pinData: {}, active: false, settings: { executionOrder: 'v1', executionTimeout: 1500 }, meta: { templateCredsSetupCompleted: false, seriesTwo: { day: spec.day, slug: spec.slug, groups: groups.map(g => ({ note: g[0], nodes: g[3] })) } } };
  assertWorkflow(workflow);
  return { workflow, doc: buildDoc(spec, fields, config) };
}

function buildDoc(spec, fields, config) {
  return '# Day ' + spec.day + ': ' + spec.title + '\n\n' + spec.description + '\n\nThis template runs from an included manual sample or an HTTP POST event. It produces one 1280×720 MP4 per event with three or four scenes. It uses generated vector graphics and text, so it does not depend on stock media, speech, AI subscriptions or other service credentials. Delivery and social publishing are optional extensions.\n\n## Setup\n\n1. Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before configuring Zvid credentials. A workspace owner/admin may need to install it.\n2. Get a Zvid API key at https://app.zvid.io/api-keys. Create the **Zvid API** credential with Base URL `https://api.zvid.io`; select it on **Validate project (free)**, **Save draft to editor**, **Submit render once**, and **Wait for completed render**.\n3. Import `' + ('zvid-' + spec.slug.replace(/^zvid-/, '')) + '.json`, edit **Config**, then run **Test manually**.\n4. For real input, activate the workflow and POST JSON to its production webhook `/webhook/' + spec.slug + '`. For testing, click **Listen for test event** and POST to `/webhook-test/' + spec.slug + '`. Configure webhook authentication and upstream access controls for production.\n\nRequired fields: **' + fields + '**. The exact example is:\n\n```json\n' + JSON.stringify(spec.sample, null, 2) + '\n```\n\n## Business rules\n\n' + (spec.rules || spec.description) + '\n\nThe transformation is deterministic: the sample and the webhook share the same calculation code. Missing or malformed required input fails before any paid submission. An explicit zero-work condition returns `status: nothing_to_render` and the reason. This template does not maintain a persistent processed-record ledger; upstream systems must avoid resending events that should produce only one video.\n\n## Configuration and cost\n\n```json\n' + JSON.stringify(config, null, 2) + '\n```\n\n`dryRun: false` is the default and spends Zvid credits. Free validation supplies `creditsRequired`; invalid or missing quotes and quotes above `maxRenderCredits` stop before rendering. `dryRun: true` saves an editable draft and returns its credit quote, without submitting a render. A project-limit or draft-save failure returns `status: draft_unavailable` and `editorDraftSaved: false`, preserves `editorDraftError`, and retains the credit quote. A saved editor draft returns `status: draft` and `editorDraftSaved: true`. Scenes use `sceneSeconds` (2–8 seconds each). Input record limits are validated by the individual template; see its business rules and sample. The video displays one to six calculated cards. Text is escaped and bounded to keep the layout readable.\n\nPaid **Submit render once** has no node retries. **Wait for completed render** polls the accepted job every `pollSeconds` (1–30), for at most `maxWaitSeconds` (10–1,200). A timeout is an incomplete wait, not proof that a job failed; inspect the accepted job before rerunning, because another manual run submits another paid render. A completed job without a usable video URL also stops with its job ID and asks you to inspect the job in https://app.zvid.io before running again.\n\n## Outputs and preview\n\nThe production webhook acknowledges receipt immediately with HTTP 202. This acknowledgement does not mean rendering succeeded. Open the corresponding n8n execution for its final status, source key, calculated metadata, quoted credits and `videoUrl`. Store the URL in your destination or add delivery after **Video result** when needed.\n\nFor completed media, open **Watch video → Binary → data → View** to play the MP4. Drafts and zero-work results skip downloads. The built-in HTTP Request v2 downloader writes binary `data`, uses a 30-second timeout, retries at most three total attempts five seconds apart, and continues after download errors; **Video result** retains the completed URL. The downloader performs an ordinary media GET; all supported Zvid API operations use native Zvid nodes.\n\nSupport: https://zvid.io/contact\n';
}

function assertWorkflow(workflow) {
  const names = new Set(); const ids = new Set();
  for (const n of workflow.nodes) {
    assert.ok(!names.has(n.name), 'duplicate node name'); names.add(n.name);
    assert.ok(!ids.has(n.id), 'duplicate node id'); ids.add(n.id);
    assert.ok(!n.credentials, 'canonical templates must not embed credential references');
    assert.ok(n.type.startsWith('n8n-nodes-base.') || n.type === ZVID, 'unsupported node type');
  }
  const notes = workflow.nodes.filter(n => n.type === STICKY);
  const overview = notes.filter(n => n.parameters.color === 1);
  assert.equal(overview.length, 1);
  const words = overview[0].parameters.content.trim().split(/\s+/).length;
  assert.ok(words >= 100 && words <= 300, 'overview must have 100–300 words, got ' + words);
  assert.match(overview[0].parameters.content, /### How it works/); assert.match(overview[0].parameters.content, /### Setup/);
  const seen = new Set();
  for (const group of workflow.meta.seriesTwo.groups) {
    const note = workflow.nodes.find(n => n.name === group.note);
    assert.equal(note.parameters.color, 7); assert.ok(note.parameters.content.trim().split(/\s+/).length < 50);
    assert.ok(group.nodes.length >= 2);
    for (const name of group.nodes) {
      assert.ok(!seen.has(name), 'node has multiple groups'); seen.add(name);
      const n = workflow.nodes.find(n => n.name === name); assert.ok(n, 'unknown group member');
      assert.ok(n.position[0] >= note.position[0] + 35 && n.position[0] + 145 <= note.position[0] + note.parameters.width, 'node extends beyond its note');
      assert.ok(n.position[1] >= note.position[1] + 135 && n.position[1] + 140 <= note.position[1] + note.parameters.height, 'node or label extends beyond its note');
    }
  }
  assert.equal(seen.size, workflow.nodes.filter(n => n.type !== STICKY).length, 'all functional nodes need exactly one group');
  for (const from of Object.keys(workflow.connections)) {
    assert.ok(names.has(from));
    for (const branch of workflow.connections[from].main) for (const edge of branch) assert.ok(names.has(edge.node), 'connection targets missing node');
  }
  const submit = workflow.nodes.find(n => n.name === 'Submit render once'); assert.ok(!submit.retryOnFail, 'paid renders must not retry');
  assert.equal(submit.parameters.resource, 'render'); assert.equal(submit.parameters.operation, 'create');
  const watch = workflow.nodes.find(n => n.name === 'Watch video'); assert.equal(watch.typeVersion, 2); assert.equal(watch.parameters.options.timeout, 30000); assert.equal(watch.maxTries, 3); assert.equal(watch.waitBetweenTries, 5000); assert.equal(watch.onError, 'continueRegularOutput');
  assert.equal(JSON.parse(workflow.nodes.find(n => n.name === 'Config').parameters.jsonOutput).dryRun, false);
  return true;
}

module.exports = { buildWorkflow, buildPayload, buildDoc, runTransform, normalizeBrief, normalizeConfig, checkValidationResult, assertWorkflow, helpers: { req, str, num, list, escapeHtml } };
