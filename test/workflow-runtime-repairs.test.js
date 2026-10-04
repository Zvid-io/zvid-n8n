'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {fitCartImageUrl,fitMenuImageUrl,retryRejected,PREVIEW_TIMEOUT_MS,repairWorkflowRuntime} = require('../scripts/workflow-runtime-repairs');

test('Restaurant bounds row photos and fallback photos on both supported hosts', () => {
  const w = require('../workflows/zvid-restaurant-weekly-specials.json');
  const cfg = JSON.parse(w.nodes.find(n => n.id === 'zvid-rws-0003').parameters.jsonOutput);
  const code = w.nodes.find(n => n.id === 'zvid-rws-0006').parameters.jsCode;
  const build = new Function(code.split('\nconst plan=$json;')[0] + '\nreturn buildProject;')();
  const sources = [
    'https://images.pexels.com/photos/17302499/example.jpeg?w=1620',
    'https://images.unsplash.com/photo-example?w=1080&dpr=2&q=80',
  ];
  const built = build({ ...cfg, fallbackDishPhotos: [sources[1]] }, [{ name: 'Dish', photo: sources[0] }, { name: 'Fallback' }]);
  assert.equal(built.payload.resolution, 'instagram-reel');
  const images = built.payload.scenes.flatMap(s => s.visuals).filter(v => v.type === 'IMAGE');
  assert.deepEqual(images.map(i => i.src), sources.map(fitMenuImageUrl));
  for (const src of sources) {
    const url = new URL(fitMenuImageUrl(src));
    assert.equal(url.searchParams.get('w'), '1920');
    assert.equal(url.searchParams.get('h'), '1920');
    assert.equal(url.searchParams.get('fit'), 'max');
    assert.equal(url.searchParams.get('dpr'), '1');
    assert.equal(fitMenuImageUrl(url.href), url.href);
  }
  const signed = 'https://restaurant.example/dish.jpg?signature=exact&w=4000';
  assert.equal(fitMenuImageUrl(signed), signed);
  assert.equal(fitMenuImageUrl('https://images.unsplash.com.attacker.example/a'), 'https://images.unsplash.com.attacker.example/a');
  // Actual downloaded dimensions, including the former 1620×2430 portrait.
  const media = require('./fixtures/restaurant-media.json');
  for (const src of cfg.fallbackDishPhotos.map(fitMenuImageUrl)) {
    const asset = media.assets.find(a => a.src === src);
    assert.ok(asset, 'Missing actual dimensions for bundled photo');
    assert.ok(asset.width <= 1920 && asset.height <= 1920);
  }
});

test('Hiring completed and empty queues report zero work while pending rows reach the loop', () => {
  const {selectHiring}=require('../scripts/review-template-runtime');
  const queue=rows=>selectHiring({maxPerRun:1},rows,new Date()).map(json=>({json}));
  const row = { JobKey: 'role-1', Approval: 'approved', row_number: 2, Role: 'Engineer', ApplyUrl: 'https://example.com/careers' };
  for (const rows of [[], [{}], [{ ...row, VideoUrl: 'https://cdn.example/video.mp4' }]]) {
    const empty = queue(rows);
    assert.equal(empty.length, 1);
    assert.equal(empty[0].json.pendingCount, 0);
    assert.equal(empty[0].json.status, 'nothing_to_render');
    assert.equal(empty[0].json.creditsSpent, 0);
  }
  const pending = queue([row, { ...row, JobKey: 'role-2', row_number: 3 }]);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].json.pendingCount, 2);
  assert.equal(pending[0].json.row_number, 2);
});

test('Workout fallback chooses the latest past date and preserves its date label', () => {
  const w = require('../workflows/zvid-workout-of-the-day.json');
  const code = w.nodes.find(n => n.id === 'review-v2-select').parameters.jsCode;
  const pick = new Function(code.slice(0, code.lastIndexOf('\nreturn ')) + '\nreturn (cfg,rows,now)=>selectWorkout(cfg,rows,now)[0];')();
  const rows = ['2026-07-28', '2026-07-30', '2026-10-02'].map(Date => ({ Date, WorkoutKey: Date, Approval: 'approved', WorkoutName: Date, Ex1: 'Squat x 5x5' }));
  const now = new Date('2026-10-01T12:00:00Z');
  assert.equal(pick({ timezone: 'Africa/Cairo', fallbackToLatest: false }, rows, now).status, 'nothing_to_render');
  const past = pick({ timezone: 'Africa/Cairo', fallbackToLatest: true }, rows, now);
  assert.equal(past.dateIso, '2026-07-30');
  assert.equal(past.usedFallback, true);
  assert.match(past.dateLabel, /JUL 30/);
  assert.equal(pick({ fallbackToLatest: true }, [...rows, { ...rows[0], WorkoutKey: 'today', Date: '2026-10-01' }], now).usedFallback, false);
});

test('Workout bundled footage fits the verified input limit and upgrades only the legacy asset', () => {
  const w = require('../workflows/zvid-workout-of-the-day.json');
  const cfg = JSON.parse(w.nodes.find(n => n.name === 'Set gym branding and workout limits').parameters.jsonOutput);
  const verified = require('./fixtures/workout-media.json');
  assert.equal(cfg.heroVideo, verified.src);
  assert.ok(verified.width <= 1920 && verified.height <= 1920);
  for (const [src, expected] of [
    ['https://videos.pexels.com/video-files/6454274/6454274-uhd_1440_2560_24fps.mp4', verified.src],
    ['https://gym.example/custom.mp4?signature=exact', 'https://gym.example/custom.mp4?signature=exact'],
  ]) {
    const legacy = structuredClone(w);
    const config = legacy.nodes.find(n => n.name === 'Set gym branding and workout limits');
    config.parameters.jsonOutput = JSON.stringify({ ...cfg, heroVideo: src });
    repairWorkflowRuntime(legacy);
    assert.deepEqual(JSON.parse(config.parameters.jsonOutput), { ...cfg, heroVideo: expected });
  }
});

test('Days 21–24 runtime repairs preserve configuration and are idempotent', () => {
  for (const slug of ['real-estate-listing-video', 'were-hiring-video', 'restaurant-weekly-specials', 'workout-of-the-day']) {
    const w = require('../workflows/zvid-' + slug + '.json');
    const repaired = repairWorkflowRuntime(structuredClone(w));
    assert.deepEqual(repaired, w);
    assert.deepEqual(repaired.nodes.find(n => n.type === 'n8n-nodes-base.set'), w.nodes.find(n => n.type === 'n8n-nodes-base.set'));
    assert.equal(repaired.nodes.find(n => /Watch video/.test(n.name)).typeVersion, 2);
  }
});

test('Cart image bounding preserves aspect ratio and leaves unrelated/signed URLs alone', () => {
  const input='https://images.pexels.com/photos/18681225/example.jpeg?auto=compress&w=1620&h=4000&dpr=2';
  const output=fitCartImageUrl(input);
  const url=new URL(output);
  assert.equal(url.searchParams.get('w'),'1920');
  assert.equal(url.searchParams.get('h'),'1920');
  assert.equal(url.searchParams.get('fit'),'max');
  assert.equal(url.searchParams.get('dpr'),'1');
  assert.equal(url.searchParams.get('auto'),'compress');
  assert.equal(fitCartImageUrl(output),output);
  for(const src of ['https://shop.example/product.jpg?signature=exact&w=4000','https://images.pexels.com.attacker.example/a?w=1620','']) assert.equal(fitCartImageUrl(src),src);
});

test('The exported cart builder applies source sizing without changing the video canvas',()=>{
  const w=require('../workflows/zvid-abandoned-cart-video.json');
  const code=w.nodes.find(n=>n.name==='Build project JSON').parameters.jsCode;
  const build=new Function(code.split('// === n8n glue ===')[0]+'\nreturn buildProject;')();
  const cfg=JSON.parse(w.nodes.find(n=>n.name==='Config').parameters.jsonOutput);
  const source='https://images.pexels.com/photos/18681225/example.jpeg?w=1620';
  const built=build(cfg,{firstName:'Example',email:'example@example.com',checkoutUrl:'https://shop.example/cart',items:[{title:'Example product',imageUrl:source,price:'29'}]});
  assert.equal(built.payload.resolution,'instagram-reel');
  const images=built.payload.scenes.flatMap(s=>s.visuals||[]).filter(v=>v.type==='IMAGE');
  assert.ok(images.length>0);
  for(const image of images) assert.equal(image.src,fitCartImageUrl(source));
});

test('Submission retry rejects ambiguous failures and honors rate-limit deadlines', () => {
  const run=new Function('$input','$','Date',retryRejected);
  const previous={payload:{name:'video'},kind:'video',submitStartedAt:100000};
  const evaluate=(error,elapsed=0,body=previous)=>run({first:()=>({json:body,error})},name=>({first:()=>({json:name==='Config'?{timeoutMinutes:2}:previous})}),{now:()=>100000+elapsed,parse:Date.parse});
  for(const statusCode of [400,401,403,422,500,502,504]) assert.throws(()=>evaluate({statusCode,message:'failed'}),/may already have created a job/);
  assert.throws(()=>evaluate({message:'socket timeout'}),/may already have created a job/);
  assert.equal(evaluate({httpCode:'429'})[0].json.retrySeconds,30);
  assert.equal(evaluate({response:{status:429,headers:{'retry-after':'65'}}})[0].json.retrySeconds,65);
  assert.equal(evaluate({statusCode:429,cause:{error:JSON.stringify({retryAfter:45})}})[0].json.retrySeconds,45);
  assert.equal(evaluate({name:'NodeApiError',message:'The service is receiving too many requests from you',context:{data:{retryAfter:70}}})[0].json.retrySeconds,70);
  assert.throws(()=>evaluate({message:'The service is receiving too many requests from you'}),/may already have created a job/);
  assert.throws(()=>evaluate({statusCode:429},100000),/submission deadline/);
  assert.deepEqual(evaluate({statusCode:429},0,{})[0].json.payload,previous.payload,'A rejected native node can omit its input JSON');
});

test('Affected exports keep bounded previews and completed-media guards',()=>{
  for(const slug of ['flash-sale-alert','abandoned-cart-video','review-testimonial-video','cold-outreach-videos','welcome-video-on-signup','proposal-recap-video','no-show-reengagement','month-in-review-stats','podcast-audiogram-clips','blog-content-kit','testimonial-compilation']){
    const w=require('../workflows/zvid-'+slug+'.json');
    const preview=w.nodes.find(n=>/Watch video/.test(n.name));
    assert.equal(preview.parameters.options.timeout,PREVIEW_TIMEOUT_MS);
    assert.equal(preview.onError,'continueRegularOutput');
    assert.equal(preview.typeVersion===2 ? preview.parameters.responseFormat : preview.parameters.options.response.response.responseFormat,'file');
    assert.equal(w.connections['Video ready to watch?'].main[0][0].node,preview.name);
  }
});

test('Podcast, Shorts and blog batches preserve each asset across retries and complete before summary',()=>{
  for(const [slug,attachName] of [['podcast-audiogram-clips','Attach job to clip'],['video-to-shorts','Attach job to clip'],['blog-content-kit','Attach job to piece']]){
    const w=require('../workflows/zvid-'+slug+'.json');
    const node=name=>w.nodes.find(n=>n.name===name);
    assert.equal(node('Render one asset at a time').parameters.batchSize,1);
    assert.equal(node('Submit render').retryOnFail,false);
    assert.equal(node('Submit render').onError,'continueErrorOutput');
    assert.match(node('Submit render').parameters.renderType,/payload.type/);
    assert.equal(w.connections['Render finished?'].main[0][0].node,'Render one asset at a time');
    assert.equal(w.connections['Render one asset at a time'].main[0][0].node,'Run summary');
    const attach=new Function('$input','$',node(attachName).parameters.jsCode);
    const merge=new Function('$input','$',node('Merge job status').parameters.jsCode);
    for(const kind of ['first','second','third']){
      const asset={kind,meta:{label:kind},payload:{name:kind},creditsRequired:7};
      const attached=attach({first:()=>({json:{jobId:kind+'-job'}})},()=>({first:()=>({json:asset})}))[0];
      assert.equal(attached.json.payload,undefined);
      assert.equal(attached.json.kind,kind);
      const completed=merge({first:()=>({json:{state:'completed',result:{url:kind+'.mp4'}}})},name=>{assert.equal(name,attachName);return{first:()=>attached}})[0];
      assert.equal(completed.json.meta.label,kind);
      assert.equal(completed.json.jobId,kind+'-job');
      assert.equal(completed.json.creditsRequired,7);
      const still=new Function('$input','$','Date',node('Still rendering?').parameters.jsCode);
      const input={first:()=>({json:{...attached.json,state:'running'}}),all:()=>[attached]};
      assert.doesNotThrow(()=>still(input,()=>({first:()=>({json:{timeoutMinutes:1}})}),{now:()=>attached.json.renderStartedAt+1000}));
      assert.throws(()=>still(input,()=>({first:()=>({json:{timeoutMinutes:1}})}),{now:()=>attached.json.renderStartedAt+61000}),/may still finish/);
    }
    assert.deepEqual(repairWorkflowRuntime(structuredClone(w)),w);
  }
});

test('Shorts webhook responds once with the complete serial batch',()=>{
  const w=require('../workflows/zvid-video-to-shorts.json');
  assert.equal(w.connections['Render one asset at a time'].main[0][0].node,'Run summary');
  assert.equal(w.connections['Render finished?'].main[0][0].node,'Render one asset at a time');
  assert.deepEqual(w.connections['Run summary'].main[0].map(e=>e.node),['Clips response','Video ready to watch?']);
  const respond=new Function('$input','$',w.nodes.find(n=>n.name==='Clips response').parameters.jsCode);
  const result=respond({all:()=>[1,2].map(clip=>({json:{clip,videoUrl:clip+'.mp4',creditsCharged:10}}))},name=>({first:()=>({json:name==='Video request'?{videoUrl:'source.mp4',title:'Source'}:{transcriptSeconds:90}})}));
  assert.equal(result.length,1);assert.equal(result[0].json.clipCount,2);assert.equal(result[0].json.creditsCharged,20);
  assert.deepEqual(result[0].json.clips.map(c=>c.videoUrl),['1.mp4','2.mp4']);
  assert.equal(w.nodes.find(n=>n.name==='▶ Watch video').parameters.options.timeout,30000);
});

test('Legacy podcast caps a 12 MiB request and rejects hosts that ignore Range before transcription',async()=>{
  const w=structuredClone(require('../workflows/zvid-podcast-audiogram-clips.json'));
  const picker=w.nodes.find(n=>n.name==='Pick latest episode');
  picker.parameters.jsCode=picker.parameters.jsCode.replace(/const requestedMB =[\s\S]+?const maxBytes = [^;]+;/,'const mb = Math.max(1, Math.min(25, Number(cfg.maxTranscribeMB || 12)));\nconst maxBytes = Math.round(mb * 1048576);');
  w.nodes=w.nodes.filter(n=>n.name!=='Check audio sample');
  w.connections['Fetch episode audio']=w.connections['Check audio sample'];delete w.connections['Check audio sample'];
  repairWorkflowRuntime(w);
  const pick=new Function('$input','$',picker.parameters.jsCode);
  const result=pick({all:()=>[{json:{title:'Episode',enclosure:{url:'https://example.com/audio.mp3',type:'audio/mpeg'}}}]},()=>({first:()=>({json:{maxTranscribeMB:12}})}));
  assert.equal(result[0].json.maxBytes,5242880);
  assert.equal(result[0].json.rangeHeader,'bytes=0-5242879');
  const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
  const guard=new AsyncFunction('$input','$',w.nodes.find(n=>n.name==='Check audio sample').parameters.jsCode);
  const items=[{json:{},binary:{data:{}}}];
  const run=length=>guard.call({helpers:{getBinaryDataBuffer:async()=>({length})}},{all:()=>items},()=>({first:()=>result[0]}));
  assert.deepEqual(await run(5242880),items);
  await assert.rejects(run(12582912),/No transcription or render request/);
  assert.equal(w.connections['Fetch episode audio'].main[0][0].node,'Check audio sample');
  assert.equal(w.connections['Check audio sample'].main[0][0].node,'Transcribe (Scribe)');
});

test('Days 12 through 15 upgrade legacy previews without changing render, delivery or saved settings',()=>{
  for(const slug of ['welcome-video-on-signup','proposal-recap-video','no-show-reengagement','month-in-review-stats']){
    const original=structuredClone(require('../workflows/zvid-'+slug+'.json'));
    const watch=original.nodes.find(n=>/Watch video/.test(n.name));
    const url=watch.parameters.url;
    watch.typeVersion=4.2;
    watch.parameters={url,options:{response:{response:{responseFormat:'file',outputPropertyName:'data'}}}};
    watch.credentials={example:{id:'preserve-id',name:'Preserve binding'}};
    const repaired=repairWorkflowRuntime(structuredClone(original));
    const preview=repaired.nodes.find(n=>n.id===watch.id);
    assert.equal(preview.typeVersion,2,'Avoid the v4 manual-run response-stream serialization bug');
    assert.equal(preview.parameters.url,url,'Keep expression-based video selection');
    assert.equal(preview.parameters.options.timeout,30000);
    assert.equal(preview.parameters.responseFormat,'file');
    assert.equal(preview.parameters.dataPropertyName,'data');
    const expected=structuredClone(original);
    Object.assign(expected.nodes.find(n=>n.id===watch.id),{typeVersion:preview.typeVersion,parameters:preview.parameters});
    assert.deepEqual(repaired,expected,'Only the preview implementation may change');
    assert.deepEqual(repairWorkflowRuntime(structuredClone(repaired)),repaired,'Repair is idempotent');
  }
});

test('Flash-sale loops through successful assets without returning to submission',()=>{
  const w=require('../workflows/zvid-flash-sale-alert.json');
  const node=name=>w.nodes.find(n=>n.name===name);
  assert.equal(node('Render one asset at a time').parameters.batchSize,1);
  assert.equal(node('Submit render').retryOnFail,false);
  assert.equal(node('Submit render').onError,'continueErrorOutput');
  assert.equal(w.connections['Render finished?'].main[0][0].node,'Render one asset at a time');
  assert.equal(w.connections['Render one asset at a time'].main[0][0].node,'Collect outputs');
  assert.equal(w.connections['Submit render'].main[1][0].node,'Check submission rejection');
  const merge=new Function('$input','$',node('Merge job status').parameters.jsCode);
  for(const [kind,jobId] of [['video','video-job'],['banner','banner-job']]){
    const out=merge({first:()=>({json:{state:'completed',result:{url:kind+'.mp4'}}})},()=>({first:()=>({json:{kind,jobId,meta:{product:'Example'}}})}));
    assert.equal(out[0].json.kind,kind);assert.equal(out[0].json.jobId,jobId);
  }
});
