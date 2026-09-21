'use strict';

const assert = require('node:assert/strict');
const { specs } = require('./series-sticky-content');
const STICKY = 'n8n-nodes-base.stickyNote';
const OVERVIEW_PREFIX = 'publication-overview-';
const layouts = {
  faceless: {
    overview: `## Create faceless YouTube Shorts

### How it works
For creators making narrated videos without filming. Run manually or daily: OpenRouter writes a script, Zvid finds stock footage and music, and ElevenLabs supplies narration with timing data. Zvid renders a branded, captioned 1080×1920 video. Review the MP4 in **Watch video → Binary → data → View**. YouTube upload is optional and off by default.

### Setup
1. Install **\`@zvid/n8n-nodes-zvid\`** from **Settings → Community nodes** before configuring credentials. A workspace owner/admin may need to install it. On n8n Cloud, the owner can install verified **Zvid** from the Nodes panel.
2. Create a **Zvid API** credential using [your API key](https://app.zvid.io/api-keys) and Base URL \`https://api.zvid.io\`. Select it on every Zvid node and **Upload voiceover**.
3. Connect OpenRouter to **Write script**. Add an ElevenLabs Header Auth credential named \`xi-api-key\` to **Generate voiceover**. Choose a voice your plan supports.
4. Set your niche, audience, handle, voice and branding in **Channel Config**.
5. Run **Test manually**. **\`dryRun: false\` spends Zvid credits.** Use \`true\` for an editor draft and quote; script and voice generation can still incur charges.
6. For optional publishing, connect YouTube OAuth2 and enable \`uploadToYouTube\`; privacy defaults to \`private\`. Review the video and factual claims before activating the schedule.

### Customization
Adjust captions, scene count, transitions and outro in **Channel Config**. All supported Zvid operations use its node; multipart voice upload uses HTTP Request because the published node lacks that operation.`,
    groups: [
      ['configure', '1. Choose the channel and schedule', 'Edit Channel Config first. Recent topics helps avoid repeating topics from previous production runs.', [0,0,740,520], [['Test manually',40,200],['Every day at 9am',40,360],['Channel Config',280,280],['Recent topics',500,280]]],
      ['script', '2. Write the narration', 'Generate and check a short script before selecting media.', [820,0,520,520], [['Write script',860,280],['Parse script',1080,280]]],
      ['footage', '3. Find footage for each scene', 'Search Zvid’s stock library and select a clip for each narration scene.', [1420,0,740,520], [['Expand scenes',1460,280],['Search stock clips',1680,280],['Pick scene clip',1900,280]]],
      ['music', '4. Choose optional background music', 'Check candidate files before using them. Continue without music if no suitable track is available.', [2240,0,1180,520], [['Music queries',2280,280],['Find background music',2500,280],['Shortlist music',2720,280],['Check music asset',2940,280],['Pick music',3160,280]]],
      ['voice', '5. Generate narration and timings', 'Use the voice alignment for captions and scene cuts. Upload the generated audio to Zvid.', [0,640,740,520], [['Generate voiceover',40,920],['Voice + timings',260,920],['Upload voiceover',480,920]]],
      ['validate', '6. Build and validate the video', 'Combine narration, media, captions and branding. Stop on validation errors before submitting a paid render.', [820,640,740,520], [['Build project JSON',860,920],['Validate project (free)',1080,920],['Check validation',1300,920]]],
      ['preview', '7. Choose an optional editor preview', 'dryRun=true saves a draft and quote. The default false branch continues to rendering.', [1640,640,740,520], [['Dry run?',1680,920],['Save draft to editor',1900,920],['Dry run summary',2120,920]]],
      ['render', '8. Render and wait for the result', 'Rendering spends Zvid credits. Check progress until the video is ready, or stop on failure or timeout.', [2460,640,960,740], [['Submit render',2500,920],['Wait',2720,920],['Get render status',2940,920],['Render finished?',3160,920],['Still rendering?',3160,1160]]],
      ['watch', '9. Review the MP4 and optionally upload', 'YouTube upload is off by default. Open Watch video → Binary → data → View to play the completed MP4.', [2460,1500,1200,740], [['Download video',2500,1780],['Publish to YouTube?',2720,1780],['Upload to YouTube',2940,1680],['Run summary',2940,1920],['Video ready to watch?',3160,1920],['▶ Watch video',3380,1920]]],
    ],
  },
  quote: {
    overview: `## Create daily quote videos from Google Sheets

### How it works
For creators with a queue of quotes. Run manually or daily to select the first row with an empty **Status**. Zvid turns the quote, author and branding into a 1080×1920 video, using a rotating background and music. After rendering, the same row receives **done** and **VideoUrl**. Open **Watch video → Binary → data → View** to review the MP4. Social publishing is not included.

### Setup
1. Install **\`@zvid/n8n-nodes-zvid\`** from **Settings → Community nodes** before configuring credentials. A workspace owner/admin may need to install it. On n8n Cloud, the owner can install verified **Zvid** from the Nodes panel.
2. Create a **Zvid API** credential with [your API key](https://app.zvid.io/api-keys) and Base URL \`https://api.zvid.io\`. Select it on every Zvid node.
3. Connect Google Sheets; choose the same spreadsheet and tab in **Read quote sheet** and **Mark row done**.
4. Add these exact headers: **Quote**, **Author**, **AuthorNote**, **Status**, **VideoUrl**. Fill Quote and Author; AuthorNote is optional. Leave Status and VideoUrl empty.
5. Customize **Config**, then run **Test manually**. **\`dryRun: false\` renders and spends credits.** Use \`true\` for an editor draft and quote without updating the sheet.
6. Review the video and quote attribution before activating the daily schedule.

### Customization
Set your channel name, call to action, fonts and colors in **Config**. Optional background and music overrides replace the rotation. Custom media must fit your account’s input limits; the included visuals are 1080×1920.`,
    groups: [
      ['configure', '1. Connect the quote queue', 'Edit Config, then select your spreadsheet and tab in both Google Sheets nodes.', [0,0,740,560], [['Test manually',40,200],['Every day at 8am',40,380],['Config',280,280],['Read quote sheet',500,280]]],
      ['queue', '2. Pick the next unused quote', 'Take the first empty-Status row. If no row is available, finish without rendering.', [820,0,740,560], [['Pick next quote',860,240],['Row found?',1080,240],['Nothing to render today',1300,400]]],
      ['validate', '3. Build and validate the video', 'Apply the quote design and selected media. Validate before choosing an editor preview or a paid render.', [1640,0,960,560], [['Build project JSON',1680,280],['Validate project (free)',1900,280],['Check validation',2120,280],['Dry run?',2340,280]]],
      ['preview', '4. Preview without updating the sheet', 'This branch runs only when dryRun=true. Open the returned editorLink to inspect the draft.', [2040,680,560,480], [['Save draft to editor',2080,940],['Dry run summary',2320,940]]],
      ['render', '5. Render and wait for the result', 'The default branch spends Zvid credits. Stop on a failed render or timeout; update the sheet only after success.', [0,680,960,740], [['Submit render',40,960],['Wait',260,960],['Get render status',480,960],['Render finished?',700,960],['Still rendering?',700,1200]]],
      ['watch', '6. Save the result and watch', 'Write done and VideoUrl to the same row. Open Watch video → Binary → data → View to play the MP4.', [1040,1280,1000,520], [['Mark row done',1080,1560],['Run summary',1300,1560],['Video ready to watch?',1520,1560],['▶ Watch video',1740,1560]]],
    ],
  },
};

function publicationKind(workflow) {
  const marked = workflow.nodes.find(n => n.type === STICKY && n.id.startsWith(OVERVIEW_PREFIX));
  if (marked) return marked.id.slice(OVERVIEW_PREFIX.length);
  const names = new Set(workflow.nodes.filter(n => n.type !== STICKY).map(n => canonicalName(n.name)));
  if (names.has('Channel Config')) return 'faceless';
  if (names.has('Read quote sheet')) return 'quote';
  return Object.keys(specs).find(kind => names.has(specs[kind].match));
}

function canonicalName(name) {
  // The saved checkout variant has n8n's automatic "1" name suffixes.
  // Resolve layout membership without renaming nodes or changing expressions.
  return name.replace(/1$/, '');
}

function seriesLayout(workflow, kind) {
  const copy = specs[kind];
  assert.ok(copy, 'Unknown series template: ' + kind);
  const functional = workflow.nodes.filter(n => n.type !== STICKY);
  const byName = new Map(functional.map(n => [canonicalName(n.name), n]));
  assert.equal(byName.size, functional.length, 'Ambiguous node name suffixes');
  const assigned = new Set();
  const sections = [];
  const add = (key, title, body, names) => {
    const members = (Array.isArray(names) ? names : names.split('|')).map(name => byName.get(name)).filter(n => n && !assigned.has(n.name));
    if (members.length < 2) return;
    for (const n of members) assigned.add(n.name);
    sections.push({key,title,body,members});
  };
  const post = new Set(['deliver','record','return','response','email','initial','followup','stop','review','headers','stage','publish','telegram']);
  const starterNames = functional.filter(n => /(?:manualTrigger|scheduleTrigger|webhook|telegramTrigger)$/.test(n.type) || /^(?:Config|Company Config)$/.test(canonicalName(n.name))).map(n => canonicalName(n.name));
  add('configure','Choose settings and an entry point','Complete the overview setup first. Use the manual trigger for a test, then check the trigger settings and workflow timezone before activation.',starterNames);
  for (const group of copy.groups || []) if (!post.has(group[0])) add(...group);
  add('script','Write and check the script','Generate concise copy from the supplied source. Review names, claims and attribution before sharing the finished video.','Write script|Parse script|Curate top five|Parse rundown|Write recap|Parse recap');
  add('footage','Choose footage for each scene','Search Zvid’s stock library and match footage to each scene. Review selected clips for relevance and attribution.','Expand scenes|Expand points|Expand stories|Search stock clips|Pick scene clip|Pick story clips');
  add('music','Check the background music','Check the configured track or stock candidates before use. Follow the guard’s result when music is unavailable.','Music queries|Find background music|Shortlist music|Check music asset|Pick music|Check music|Music guard|Check music track|Check music bed');
  add('voice','Create narration and timings','Generate voice audio and caption timings. Multipart audio upload uses HTTP Request because the published Zvid node does not expose uploads.','Generate voiceover|Voice + timings|Upload voiceover');
  add('validate','Build and validate the design','Prepare the media and video design, then validate the payload and credit quote. Resolve validation errors before submitting a render.','Check lead logos|Check music|Check music track|Check music bed|Build project JSON|Build personalized recovery video|Validate project (free)|Validate render (free)|Check validation');
  add('preview','Choose an optional editor preview','dryRun=true returns an editor draft and credit quote. The default false branch renders and spends Zvid credits; upstream AI services may charge separately.','Dry run?|Save draft to editor|Dry run summary|Dry-run row report');
  add('render','Render and wait for completion','Submit the render, then check its status until completion or timeout. Keep each result paired with its source item. Check Zvid before retrying a timed-out job.','Submit render|Submit bulk render|Attach job to item|Attach job to clip|Attach job to piece|Attach job to event|Attach job to contact|Check batch accepted|Wait|Wait for render|Get render status|Get batch status|Merge job status|Render finished?|Batch finished?|All finished?|Still rendering?');
  for (const group of copy.groups || []) if (post.has(group[0])) add(...group);
  add('email','Send the optional delivery','Configure the delivery credential and destination before enabling this branch. Confirm the completed video and recipient in a private test.','Send email?|Email the video|Slack configured?|Post to Slack');
  const recording = 'Collect video links|Write links to sheet|Collect finished videos|Write URLs back|Sheet mode?|Mark row done|Mark listing done'.split('|').filter(n=>byName.has(n)&&!assigned.has(byName.get(n).name));
  add('record','Save the completed result','Write the completed URL back to its source row. Review the result before adding any further distribution steps.',recording);
  const watchNames = ['Run summary','Recovery run summary','Published summary','Video ready to watch?','▶ Watch video','▶ View banner',...recording];
  add('watch','Review the finished media','Open Watch video → Binary → data → View. Select each output item for batches; image outputs open as images. Empty links and preview results skip the download.',watchNames);
  assert.deepEqual(functional.filter(n => !assigned.has(n.name)).map(n=>n.name), [], 'Every node needs a documented section: ' + kind);

  const agent = kind === 'chat-video-agent';
  const upload = functional.some(n => n.type === 'n8n-nodes-base.httpRequest' && /Upload (?:voiceover|episode audio)/.test(n.name));
  const upstream = functional.some(n => /OpenRouter|Generate voiceover|Transcribe|Write script|Write kit copy|Write recap|Curate top five/.test(n.name));
  const steps = agent ? [...copy.setup] : [
    'Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before credentials. A workspace owner/admin may need to install it.',
    'Create a **Zvid API** credential with [your API key](https://app.zvid.io/api-keys) and Base URL `https://api.zvid.io`. Select it on every Zvid node' + (upload ? ' and upload step.' : '.'),
    ...copy.setup,
    '**dryRun=false** renders and spends Zvid credits. Set it to **true** for an editor draft and quote.' + (upstream ? ' AI or transcription charges may still apply.' : ''),
    'Test manually and review the output before activating automatic runs.',
  ];
  const guide = `https://github.com/Zvid-io/zvid-n8n/blob/master/workflows/${kind}.md`;
  const customization = agent
    ? 'Adjust the model and creative brief in Config. Approval is a prompt instruction, not a hard lock; keep a conservative credit ceiling.'
    : 'Adjust branding, media and timing in the configuration node.' + (upload ? ' Multipart upload uses HTTP Request because the published Zvid node lacks that operation.' : '');
  const overview = `## ${copy.title}\n\n### How it works\n${copy.how}\n\n### Setup\n${steps.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\n### Customization\n${customization} [Detailed setup guide](${guide}).`;
  const wordCount = overview.trim().split(/\s+/).length;
  assert.ok(wordCount >= 100 && wordCount <= 300, `${kind} overview contains ${wordCount} words`);

  // Pack sections into a readable multi-row canvas. Within a section preserve
  // the explicitly documented flow order, wrapping long stages at four nodes.
  let x=0, y=0, rowHeight=0;
  const groups = sections.map(({key,title,body,members}, index) => {
    const columns = Math.min(4, members.length);
    const width = columns * 260 + 100;
    const height = Math.ceil(members.length / 4) * 240 + 280;
    if (x && x + width > 3700) { x=0; y+=rowHeight+160; rowHeight=0; }
    const rect = [x,y,width,height];
    const positions = members.map((node,i) => {
      const row=Math.floor(i/4), column=row%2 ? columns-1-i%4 : i%4;
      return [node.name,x+50+column*260,y+240+row*240];
    });
    x+=width+120; rowHeight=Math.max(rowHeight,height);
    return [key,`${index+1}. ${title}`,body,rect,positions];
  });
  return { overview, groups };
}

function applyPublicationNotes(original, kind) {
  const spec = layouts[kind] || seriesLayout(original, kind);
  assert.ok(spec, 'Unknown publication layout');
  const workflow = structuredClone(original);
  const functional = workflow.nodes.filter(n => n.type !== STICKY);
  const byName = new Map(functional.map(n => [n.name, n]));
  const assigned = new Set();
  const notes = [{ id: OVERVIEW_PREFIX + kind, name: 'Workflow overview and setup', type: STICKY, typeVersion: 1, position: [-800,0], parameters: { content: spec.overview, color: 1, width: 720, height: 1160 } }];
  for (const [key, title, body, [x,y,width,height], positions] of spec.groups) {
    assert.ok(positions.length >= 2);
    const content = `## ${title}\n\n${body}`;
    assert.ok(content.split(/\s+/).length < 50);
    for (const [name,nx,ny] of positions) {
      const node = byName.get(name);
      assert.ok(node, 'Missing workflow node: ' + name);
      assert.ok(!assigned.has(name), 'Node assigned twice: ' + name);
      assigned.add(name);
      node.position = [nx,ny];
    }
    notes.push({ id: key === 'watch' ? 'zvid-watch-instructions' : `publication-section-${kind}-${key}`, name: title, type: STICKY, typeVersion: 1, position: [x,y], parameters: { content, color: 7, width, height } });
  }
  assert.equal(assigned.size, functional.length, 'Every functional node must belong to a section');
  workflow.nodes = [...functional, ...notes];
  if (Array.isArray(workflow.nodeGroups)) {
    const validIds = new Set(workflow.nodes.map(n=>n.id));
    for (const group of workflow.nodeGroups) if (Array.isArray(group.nodeIds)) group.nodeIds = group.nodeIds.filter(id=>validIds.has(id));
  }
  return workflow;
}

module.exports = { applyPublicationNotes, publicationKind, OVERVIEW_PREFIX, layouts, seriesLayout };
