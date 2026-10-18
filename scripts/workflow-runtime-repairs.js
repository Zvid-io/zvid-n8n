'use strict';

// Keep these repairs in generation, so organizing a template cannot restore
// unsafe whole-node submission retries or unbounded media downloads.
const PREVIEW_TIMEOUT_MS = 30000;

function fitCartImageUrl(value) {
  const src = String(value || '').trim();
  // This stock-library image host supports a bounding box. Restrict rewriting
  // to this exact host; arbitrary product URLs may be signed or use other APIs.
  const match = /^(https:\/\/images\.pexels\.com\/[^?#]+)(?:\?([^#]*))?(#.*)?$/i.exec(src);
  if (!match) return src;
  const params = (match[2] || '').split('&').filter(Boolean)
    .filter(part => !/^(?:w|h|fit|dpr)=/i.test(part));
  return match[1] + '?' + [...params, 'w=1920', 'h=1920', 'fit=max', 'dpr=1'].join('&') + (match[3] || '');
}

function fitMenuImageUrl(value) {
  const src = String(value || '').trim();
  // Both bundled image hosts support aspect-preserving bounds. Leave other
  // customer and signed URLs byte-for-byte unchanged.
  const match = /^(https:\/\/images\.(?:pexels\.com|unsplash\.com)\/[^?#]+)(?:\?([^#]*))?(#.*)?$/i.exec(src);
  if (!match) return src;
  const params = (match[2] || '').split('&').filter(Boolean)
    .filter(part => !/^(?:w|h|fit|dpr)=/i.test(part));
  return match[1] + '?' + [...params, 'w=1920', 'h=1920', 'fit=max', 'dpr=1'].join('&') + (match[3] || '');
}

function repairHiringQueue(workflow) {
  const find = name => workflow.nodes.find(n => n.name === name);
  const queue = find('Rows to render');
  if (!queue || !find('Read job openings')) return;
  const empty = "[{ json: { pendingCount: 0, totalRowsRead: rows.length } }]";
  queue.parameters.jsCode = queue.parameters.jsCode
    .replace('const rows = $input.all().map((i) => i.json);', "const rows = $input.all().map((i) => i.json).filter(r => Object.keys(r).some(k => k !== 'row_number' && String(r[k] ?? '').trim()));")
    .replace('if (!rows.length) return [];', 'if (!rows.length) return ' + empty + ';')
    .replace('return open.slice(0, limit).map((r) => ({ json: r }));', 'if (!open.length) return ' + empty + ';\nreturn open.slice(0, limit).map((r) => ({ json: { ...r, pendingCount: open.length } }));');
  if (!queue.parameters.jsCode.includes('pendingCount: 0')) throw new Error('Unrecognized hiring queue; inspect Rows to render.');
  find('Read job openings').alwaysOutputData = true;
  const probe = find('Check music track');
  if (probe) {
    probe.alwaysOutputData = true;
    probe.onError = 'continueRegularOutput';
    probe.parameters.options = { ...probe.parameters.options, timeout: 15000 };
  }
  const builder = find('Build project JSON');
  builder.parameters.jsCode = builder.parameters.jsCode.replace('/* probe unavailable - keep the configured track */', "musicUrl = ''; /* Optional music must not block a hiring video. */");
  const additions = [
    { id: 'zvid-hiring-pending', name: 'Jobs need videos?', type: 'n8n-nodes-base.if', typeVersion: 2.2,
      parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id: 'zvid-hiring-pending-condition', leftValue: '={{ Number($json.pendingCount) > 0 }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} } },
    { id: 'zvid-hiring-empty', name: 'No pending job openings', type: 'n8n-nodes-base.code', typeVersion: 2,
      parameters: { jsCode: "const queue = $input.first().json;\nreturn [{ json: { status: 'nothing_to_render', rendered: false, creditsSpent: 0, totalRowsRead: queue.totalRowsRead, reason: 'No pending openings. Fill Role and ApplyUrl and leave VideoUrl empty. To rerender a completed opening, clear only its VideoUrl cell.' } }];" } },
  ];
  for (const node of additions) if (!find(node.name)) workflow.nodes.push({ position: [0, 0], ...node });
  workflow.connections['Rows to render'] = { main: [[edge('Jobs need videos?')]] };
  workflow.connections['Jobs need videos?'] = { main: [[edge('One row at a time')], [edge('No pending job openings')]] };
}

const prepareAttempt = `// Each deliverable owns its retry deadline; an accepted job is never resubmitted.
return $input.all().map((item, i) => ({
  json: { ...item.json, submitStartedAt: Date.now(), submitAttempts: 0 },
  pairedItem: { item: i },
}));`;

const retryRejected = `// Retry only an explicit HTTP 429 rejection. Timeouts/5xx may have accepted
// a paid job already, so they stop for inspection instead of creating duplicates.
const item = $input.first();
const error = item.error || item.json.error || {};
const previous = $('Prepare render attempt').first().json;
const carried = item.json.payload ? item.json : previous;
const status = Number(error.httpCode || error.statusCode || error.response?.status || error.cause?.statusCode || error.cause?.response?.status);
// n8n's task-runner serialization drops httpCode but retains its exact,
// status-specific NodeApiError message and the API response in context.data.
const serialized429 = !status && error.name === 'NodeApiError' && error.message === 'The service is receiving too many requests from you';
if (status !== 429 && !serialized429) {
  throw new Error('Render submission failed: ' + (error.description || error.message || String(error)) + '. Check https://app.zvid.io before retrying; the request may already have created a job.');
}
let body = error.response?.data || error.context?.data || error.cause?.response?.data || error.cause?.error || {};
if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
const headers = error.response?.headers || error.cause?.response?.headers || {};
const rawRetry = headers['retry-after'] ?? body.retryAfter;
const retrySeconds = Number(rawRetry) || Math.ceil((Date.parse(rawRetry) - Date.now()) / 1000) || 30;
const waitSeconds = Math.max(30, retrySeconds);
const deadline = Number(previous.submitStartedAt) + Number($('Config').first().json.timeoutMinutes || 20) * 60000;
if (Date.now() + waitSeconds * 1000 >= deadline) {
  throw new Error('Render capacity stayed full until the submission deadline. Check https://app.zvid.io; completed assets from this run remain in Render one asset at a time.');
}
return [{ json: { ...carried, submitStartedAt: previous.submitStartedAt, submitAttempts: Number(carried.submitAttempts || 0) + 1, retrySeconds: waitSeconds }, pairedItem: { item: 0 } }];`;

const attachJob = `const response = $input.first().json;
const jobId = response.jobId || response.id;
if (!jobId) throw new Error('Render submission returned no jobId. Check https://app.zvid.io before retrying.');
const { payload, ...asset } = $('Prepare render attempt').first().json;
return [{ json: { ...asset, jobId, renderStartedAt: Date.now() }, pairedItem: { item: 0 } }];`;

const mergeStatus = `const carried = $('Attach job to item').first().json;
const job = $input.first().json;
return [{ json: { ...carried, state: job.state, failedReason: job.failedReason || null, result: job.result || null }, pairedItem: { item: 0 } }];`;

const stillRendering = `const item = $input.first().json;
if (item.state === 'failed') throw new Error('The ' + item.kind + ' render failed: ' + (item.failedReason || 'no reason given'));
const timeoutMs = Number($('Config').first().json.timeoutMinutes || 20) * 60000;
if (Date.now() - Number(item.renderStartedAt) >= timeoutMs) {
  throw new Error('Render ' + item.jobId + ' timed out. It may still finish on Zvid; check https://app.zvid.io before retrying.');
}
return $input.all();`;

const edge = node => ({ node, type: 'main', index: 0 });
function repairSerialBatch(workflow) {
  const find = name => workflow.nodes.find(n => n.name === name);
  const kind = find('Poll price drops') ? 'fs' : find('Pick latest episode') ? 'pa' : find('Pick highlights') ? 'vs' : find('Prepare kit prompt') ? 'bk' : null;
  if (!kind) return;
  const attachName = kind === 'pa' || kind === 'vs' ? 'Attach job to clip' : kind === 'bk' ? 'Attach job to piece' : 'Attach job to item';
  const outputName = kind === 'fs' ? 'Collect outputs' : 'Run summary';
  const submit = find('Submit render');
  submit.retryOnFail = false;
  submit.onError = 'continueErrorOutput';
  submit.parameters.renderType = '={{ $json.payload.type === "image" ? "image" : "video" }}';
  const nodes = [
    { id:`zvid-${kind}-asset-loop`, name:'Render one asset at a time', type:'n8n-nodes-base.splitInBatches', typeVersion:3, parameters:{batchSize:1,options:{}} },
    { id:`zvid-${kind}-prepare-attempt`, name:'Prepare render attempt', type:'n8n-nodes-base.code', typeVersion:2, parameters:{jsCode:prepareAttempt} },
    { id:`zvid-${kind}-retry-rejection`, name:'Check submission rejection', type:'n8n-nodes-base.code', typeVersion:2, parameters:{jsCode:retryRejected} },
    { id:`zvid-${kind}-capacity-wait`, name:'Wait for render capacity', type:'n8n-nodes-base.wait', typeVersion:1.1, parameters:{amount:'={{ $json.retrySeconds }}',unit:'seconds'}, webhookId:`zvid-${kind === 'fs' ? 'flash-sale' : kind}-capacity-wait` },
  ];
  for (const n of nodes) {
    const saved = find(n.name);
    if (saved) saved.parameters = n.parameters;
    else workflow.nodes.push({position:[0,0],...n});
  }
  find(attachName).parameters.jsCode = attachJob;
  find('Merge job status').parameters.jsCode = mergeStatus.replace('Attach job to item', attachName);
  find('Still rendering?').parameters.jsCode = stillRendering;
  find('Render finished?').parameters.conditions.conditions[0].leftValue = "={{ $json.state === 'completed' }}";
  workflow.connections['Dry run?'].main[1] = [edge('Render one asset at a time')];
  workflow.connections['Render one asset at a time'] = {main:[[edge(outputName)],[edge('Prepare render attempt')]]};
  workflow.connections['Prepare render attempt'] = {main:[[edge('Submit render')]]};
  workflow.connections['Submit render'] = {main:[[edge(attachName)],[edge('Check submission rejection')]]};
  workflow.connections['Check submission rejection'] = {main:[[edge('Wait for render capacity')]]};
  workflow.connections['Wait for render capacity'] = {main:[[edge('Submit render')]]};
  workflow.connections['Render finished?'].main[0] = [edge('Render one asset at a time')];
}

function repairPodcastSample(workflow) {
  const picker = workflow.nodes.find(n => n.name === 'Pick latest episode');
  if (!picker) return;
  // Upgrade older configured copies without replacing their feed or branding.
  const legacy = /const mb = Math\.max\(1, Math\.min\(25, Number\(cfg\.maxTranscribeMB \|\| 12\)\)\);\r?\nconst maxBytes = Math\.round\(mb \* 1048576\);/;
  picker.parameters.jsCode = picker.parameters.jsCode.replace(legacy, `const requestedMB = Number(cfg.maxTranscribeMB ?? 4);
const maxAudioBytes = Number(cfg.maxAudioBytes ?? 5242880);
if (!Number.isFinite(requestedMB) || requestedMB <= 0 || !Number.isFinite(maxAudioBytes) || maxAudioBytes < 1) {
  throw new Error('maxTranscribeMB and maxAudioBytes must be positive numbers in Config.');
}
const maxBytes = Math.floor(Math.min(requestedMB * 1048576, 25 * 1048576, maxAudioBytes));`);
  if (!picker.parameters.jsCode.includes('cfg.maxAudioBytes')) throw new Error('Unrecognized podcast sample limit; inspect Pick latest episode before importing.');
  if (!workflow.nodes.some(n => n.name === 'Check audio sample')) {
    workflow.nodes.push({id:'zvid-pa-audio-size-guard',name:'Check audio sample',type:'n8n-nodes-base.code',typeVersion:2,position:[0,0],parameters:{jsCode:`// Check actual bytes before paid transcription. Some hosts ignore Range.
const items = $input.all();
const maxBytes = Number($('Pick latest episode').first().json.maxBytes);
if (!Number.isFinite(maxBytes) || maxBytes < 1) throw new Error('Invalid audio sample size limit. Check Config.');
for (let i = 0; i < items.length; i++) {
  if (!items[i].binary?.data) throw new Error('The episode download returned no audio file.');
  const buffer = await this.helpers.getBinaryDataBuffer(i, 'data');
  if (!buffer.length) throw new Error('The episode download returned an empty audio file.');
  if (buffer.length > maxBytes) throw new Error('Downloaded audio is ' + buffer.length + ' bytes, above the ' + maxBytes + '-byte sample limit. The source may have ignored Range. Use a smaller audio file or a host that supports byte ranges. No transcription or render request has been made.');
}
return items;`}});
    workflow.connections['Check audio sample'] = workflow.connections['Fetch episode audio'];
    workflow.connections['Fetch episode audio'] = {main:[[edge('Check audio sample')]]};
  }
}

function repairWorkflowRuntime(workflow) {
  require('./chat-agent-runtime').repairChatAgent(workflow);
  const names = new Set(workflow.nodes.map(n => n.name));
  const affected = names.has('Poll price drops') || names.has('Poll checkouts') || names.has('Fetch Judge.me reviews') || names.has('Read leads sheet')
    || names.has('Pick latest episode') || names.has('Pick highlights') || names.has('Prepare kit prompt') || names.has('Prepare compilation')
    || names.has('On new signup') || names.has('Deal webhook') || names.has('No-show webhook')
    || (names.has('On the 1st of each month') && names.has('Normalize metrics'))
    || names.has('Read listings sheet') || names.has('Read job openings') || names.has('Read workout sheet') || names.has('Read menu sheet')
    || names.has('Read hiring campaign queue') || names.has('Read dated coach workout plans') || names.has('Read specials from Google Sheets')
    || names.has('Read approved job catalog') || names.has('Read nominated menu dishes')
    || (names.has('Screen request') && names.has('Chat reply'));
  if (!affected) return workflow;
  for (const node of workflow.nodes) if (/^▶ (?:Watch video|View banner)(?: — .+)?$/.test(node.name)) {
    node.parameters.options = {...node.parameters.options, timeout:PREVIEW_TIMEOUT_MS};
    if (node.typeVersion !== 2) {
      // HTTP Request v4 stores the live response stream in manual-run context.
      // n8n 2.29.10 then fails to serialize its TLS socket when saving the run,
      // leaving the editor spinning after the download has already completed.
      // The built-in v2 downloader has the same binary output without that
      // pagination-preview context. Keep the URL expression and media guard.
      node.typeVersion = 2;
      node.parameters = {
        authentication: 'none', requestMethod: 'GET', url: node.parameters.url,
        responseFormat: 'file', dataPropertyName: 'data', jsonParameters: false,
        options: { timeout: PREVIEW_TIMEOUT_MS },
      };
    }
  }
  repairSerialBatch(workflow);
  repairPodcastSample(workflow);
  repairHiringQueue(workflow);
  if (names.has('Read workout sheet') || names.has('Read dated coach workout plans')) {
    const picker = workflow.nodes.find(n => n.name === "Pick today's row");
    if (picker) picker.parameters.jsCode = picker.parameters.jsCode.replace('set fallbackToLatest: true in Config', 'enable fallbackToLatest in Config');
    const config = workflow.nodes.find(n => n.name === 'Config' || n.name === 'Set gym branding and workout limits');
    const cfg = JSON.parse(config.parameters.jsonOutput);
    // Upgrade only the old bundled asset, leaving custom gym footage intact.
    if (cfg.heroVideo === 'https://videos.pexels.com/video-files/6454274/6454274-uhd_1440_2560_24fps.mp4') {
      cfg.heroVideo = 'https://videos.pexels.com/video-files/6454274/6454274-hd_1080_1920_24fps.mp4';
      config.parameters.jsonOutput = JSON.stringify(cfg, null, 2);
    }
  }
  if (names.has('Read menu sheet')) {
    const builder = workflow.nodes.find(n => n.name === 'Build project JSON');
    if (!builder.parameters.jsCode.includes('function fitMenuImageUrl(')) {
      builder.parameters.jsCode = fitMenuImageUrl.toString() + '\n\n' + builder.parameters.jsCode.replace('    // Keep descriptions to ~3 lines on the card.', '    d.photo = fitMenuImageUrl(d.photo);\n    // Keep descriptions to ~3 lines on the card.');
      if (!builder.parameters.jsCode.includes('d.photo = fitMenuImageUrl(d.photo);')) throw new Error('Unrecognized menu builder; inspect its photo handling.');
    }
  }
  if (names.has('Poll checkouts')) {
    const builder = workflow.nodes.find(n => n.name === 'Build project JSON');
    if (!builder.parameters.jsCode.includes('function fitCartImageUrl(')) {
      builder.parameters.jsCode = fitCartImageUrl.toString() + '\n\n' + builder.parameters.jsCode.replace('imageUrl: clean(it && it.imageUrl),', 'imageUrl: fitCartImageUrl(it && it.imageUrl),');
    }
  }
  return workflow;
}

module.exports = { repairWorkflowRuntime, fitCartImageUrl, fitMenuImageUrl, PREVIEW_TIMEOUT_MS, retryRejected };
