'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const specs=require('../scripts/studio-series/domain-c');
const assets=path.resolve(__dirname,'../scripts/studio-series/assets');
function initial(day){const spec=specs.find(s=>s.day===day),template=JSON.parse(fs.readFileSync(path.join(assets,'day-'+day+'.json'),'utf8'));return {request:structuredClone(spec.sample.request),records:structuredClone(spec.sample.records),history:[],config:{nowISO:'2026-10-03T12:00:00Z'},defaults:template.variables,template,variables:{},decision:{},artifacts:[]};}
function run(day,edit=()=>{},count=3){let state=initial(day);edit(state);for(const fn of specs.find(s=>s.day===day).stages.slice(0,count))state=fn(state);return state;}
const item=(s,kind)=>s.records.find(x=>x.kind===kind);
function reapprove(day,state){const spec=specs.find(s=>s.day===day),review=spec.stages[2](state),record=item(state,'narration');record.content_fingerprint=review.artifacts.at(-1).contentFingerprint;record.script=state.request.approved_script;record.url='https://media.example.test/new-approved-recording.mp3';return spec.stages[2](state);}
for(const spec of specs){
 test('D'+spec.day+' sample produces approved source calculations and matching narration',()=>{const state=run(spec.day);assert.equal(state.status,'ready',state.reason);assert.equal(state.decision.narrationBound,true);assert.match(state.decision.contentFingerprint,/^[a-f0-9]{64}$/);assert.equal(state.artifacts.length,1);assert.ok(Object.keys(state.decision).length>=8);});
 test('D'+spec.day+' stages run without module closures in a Code-node sandbox',()=>{let state=initial(spec.day);for(const fn of spec.stages)state=vm.runInNewContext('('+fn.toString()+')(state)',{state},{timeout:1500});assert.equal(state.status,'ready',state.reason);});
 test('D'+spec.day+' pending approvals skip and unverified sources need review',()=>{assert.equal(run(spec.day,s=>s.request.approval='pending').status,'skip');assert.equal(run(spec.day,s=>item(s,'evidence').approval='pending').status,'review');});
 test('D'+spec.day+' stale narration or changed script returns a useful handoff, no render-ready state',()=>{const stale=run(spec.day,s=>item(s,'narration').content_fingerprint='stale');assert.equal(stale.status,'review');assert.ok(stale.artifacts[0].script);const changed=run(spec.day,s=>s.request.approved_script+=' Revised ending.');assert.equal(changed.status,'review');assert.match(changed.reason,/Narration approval/);});
 test('D'+spec.day+' unrelated revision records cannot contaminate source joins',()=>{const expected=run(spec.day),actual=run(spec.day,s=>s.records.push({...item(s,'evidence'),parent_id:'unrelated',claim:'Not this lesson'}));assert.deepEqual(actual.variables,expected.variables);});
}
test('SHA-256 content binding agrees with the standard implementation including Unicode',()=>{const state=run(51),content=Object.fromEntries(Object.entries(state.variables).filter(([k])=>!/(?:AudioBegin|AudioEnd|narrationUrl|narrationSeconds)$/.test(k)));const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;const geometry=crypto.createHash('sha256').update(JSON.stringify(state.template.scenes.map(({audios,...scene})=>scene))).digest('hex');const raw=JSON.stringify({content:canonical(content),script:state.request.approved_script,sceneSeconds:state.template.scenes.map(x=>x.duration),designGeometry:geometry});assert.equal(state.decision.contentFingerprint,crypto.createHash('sha256').update(raw).digest('hex'));});

test('D51–53 samples bind same-photo thumbnails to unchanged approved narration and scene timing',()=>{
 for(const day of [51,52,53]){
  const state=run(day),original=initial(day),narration=item(state,'narration');
  const photos=state.records.filter(r=>r.kind==='media'&&new URL(r.url).hostname==='thumb.wikimedia.org');
  assert.equal(photos.length,day===53?2:1);
  for(const photo of photos){
   const thumb=new URL(photo.url),full=new URL(state.defaults[photo.variable]);
   assert.equal(decodeURIComponent(thumb.pathname.split('/').slice(0,-1).join('/').replace('/thumb/','/')),decodeURIComponent(full.pathname));
   assert.match(thumb.pathname.split('/').at(-1),/^1280px-/);
   assert.equal(photo.rights,state.defaults.credit);
  }
  assert.equal(narration.url,state.defaults.narrationUrl);assert.equal(narration.script,state.request.approved_script);
  assert.deepEqual(state.template,original.template);
  const stale=run(day,s=>{for(const p of s.records.filter(r=>r.kind==='media'))p.url=s.defaults[p.variable];});
  assert.equal(stale.status,'review');assert.match(stale.reason,/Narration approval/);
  assert.notEqual(stale.decision.contentFingerprint,state.decision.contentFingerprint);
 }
});
test('D51 competition totals are reconciled and changed goals require narration review',()=>{assert.equal(run(51,s=>item(s,'season').league_goals=99).status,'review');const changed=run(51,s=>item(s,'season').all_goals=32,2);assert.equal(changed.decision.otherCompetitionGoals,11);assert.equal(specs[0].stages[2](changed).status,'review');changed.request.approved_script='Editor-approved revised goal totals.';assert.equal(reapprove(51,changed).status,'ready');});
test('D52 goal order, scoring team and final result must agree',()=>{assert.equal(run(52,s=>item(s,'goal').minute=70).status,'review');assert.equal(run(52,s=>item(s,'goal').team='Milan').status,'review');assert.equal(run(52,s=>s.request.final_away=4).status,'review');assert.deepEqual(run(52).decision.scoreProgression,['3-1','3-2','3-3']);});
test('D53 requires both club sources and chronological consistency',()=>{assert.equal(run(53,s=>s.records.filter(x=>x.kind==='evidence').forEach(x=>x.url='https://one.example/history')).status,'review');assert.equal(run(53,s=>item(s,'historical_event').year=1900).status,'review');assert.equal(run(53).decision.sharedGroundYears,8);});
test('D54 pass graph is independently checked against the three player roles',()=>{assert.equal(run(54,s=>item(s,'phase').to=7).status,'review');const state=run(54,s=>{for(const p of s.records.filter(x=>x.kind==='player'))if(p.number===8)p.number=6;for(const p of s.records.filter(x=>x.kind==='phase')){if(p.from===8)p.from=6;if(p.to===8)p.to=6;}},2);assert.equal(state.variables.playerA,'6');assert.deepEqual(state.decision.passGraph,[['6','10'],['10','6'],['6','7']]);assert.equal(specs.find(s=>s.day===54).stages[2](state).status,'review');});
test('D55 tied ceilings never become guaranteed titles',()=>{const state=run(55,s=>s.records.find(x=>x.role==='leader').points=70,2);assert.equal(state.decision.titleVerdicts[0],'TIE-BREAK POSSIBLE');assert.match(state.variables.winText,/TIE-BREAK/);assert.equal(run(55,s=>item(s,'standing').remaining=2).status,'review');});

test('Blank, null and boolean football statistics are never silently treated as zero',()=>{for(const blank of [undefined,null,'','   ',false,true]){const goals=run(51,s=>item(s,'season').league_goals=blank);assert.equal(goals.status,'review');assert.match(goals.reason,/requires a number/);const points=run(55,s=>item(s,'standing').points=blank);assert.equal(points.status,'review');assert.match(points.reason,/requires a number/);}const zero=run(51,s=>item(s,'season').league_goals=0,2);assert.equal(zero.status,'ready',zero.reason);});
test('D56 lesson is generated only when the measured misconception exceeds threshold',()=>{const state=run(56);assert.deepEqual(state.decision.answers,['5/6','3/4']);assert.equal(run(56,s=>item(s,'assessment').count=1).status,'skip');assert.equal(run(56,s=>item(s,'fraction_problem').b=7).status,'review');});
test('D57 validates clue specificity, hides the answer and regenerates safe outlines',()=>{assert.equal(run(57,s=>item(s,'clue').text='The answer is Japan.').status,'review');assert.equal(run(57,s=>item(s,'map').polygons_json='[[[0,0],["<script>",0],[1,1]]]').status,'review');const repeated=run(57,s=>s.history=[{country_code:'JP',status:'delivered',completed_at:'2026-10-02T00:00:00Z'}]);assert.equal(repeated.status,'skip');const current=run(57);assert.deepEqual(current.trustedMarkupVariables,['countryMap','markedMap']);assert.match(current.variables.countryMap,/^<svg/);});
test('D57 rejects numeric outlines without approved map provenance and rights',()=>{for(const edit of [s=>item(s,'map').approval='pending',s=>delete item(s,'map').url,s=>item(s,'map').url='http://example.test/map',s=>item(s,'map').url='https://user:secret@example.test/map',s=>item(s,'map').rights='   ']){const result=run(57,edit);assert.equal(result.status,'review');assert.match(result.reason,/map provenance|Map rights/);}const current=run(57);assert.equal(current.decision.mapSourceUrl,item(current,'map').url);assert.equal(current.decision.mapRights,item(current,'map').rights);});
test('D58 exactly one answer, exact transcript and measured waveform are mandatory',()=>{assert.equal(run(58,s=>item(s,'choice').correct=true).status,'review');assert.equal(run(58,s=>item(s,'recording').transcript='Different audio.').status,'review');assert.equal(run(58,s=>item(s,'recording').rms_bins_json='[0,1]').status,'review');assert.equal(run(58).decision.plays,2);});
test('D58 plays a newly approved 5.5-second recording in full twice while preserving reveal timing',()=>{
 const spec=specs.find(s=>s.day===58),state=run(58,s=>{item(s,'recording').seconds=5.5;item(s,'recording').url='https://media.example.test/slower-approved-listening.mp3';},2);
 assert.equal(state.status,'ready',state.reason);assert.equal(state.project.scenes[0].audios[0].audioEnd,5.5);assert.equal(state.project.scenes[2].audios[0].audioEnd,5.5);assert.equal(state.project.scenes[0].audios[0].exit,6.5);assert.equal(state.project.scenes[2].audios[0].exit,6.5);
 assert.deepEqual(state.project.scenes.map(s=>s.duration),[7,6,7,6,4]);assert.equal(state.decision.answerRevealAtSeconds,20);
 const stale=spec.stages[2](state);assert.equal(stale.status,'review');const recording=item(state,'recording'),narration=item(state,'narration');narration.content_fingerprint=stale.artifacts.at(-1).contentFingerprint;narration.url=recording.url;narration.seconds=recording.seconds;
 const approved=spec.stages[2](state);assert.equal(approved.status,'ready',approved.reason);assert.equal(approved.decision.narrationSeconds,5.5);assert.equal(approved.variables.audioUrl,recording.url);
 narration.seconds=4.416;assert.equal(spec.stages[2](state).status,'review');
});
test('D58 timing changes invalidate existing audio approval even when the recording URL is unchanged',()=>{
 const original=run(58),changed=run(58,s=>item(s,'recording').seconds=5.1);
 assert.equal(changed.status,'review');assert.notEqual(changed.artifacts.at(-1).contentFingerprint,original.decision.contentFingerprint);
 assert.equal(run(58,s=>item(s,'recording').seconds=5.6).status,'review');
});
test('D59 prediction analytics choose a teaching focus but do not invent science',()=>{const state=run(59);assert.equal(state.decision.distanceMisconceptionRate,.6);assert.match(state.decision.teachingFocus,/distance misconception/);assert.equal(run(59,s=>s.request.minimum_responses=40).status,'skip');assert.equal(run(59,s=>item(s,'science_fact').value=90).status,'review');});
test('D60 both models and actual cell counts change together, then await matching voice',()=>{const state=run(60,s=>Object.assign(s.request,{rows:8,columns:4,split_rows:5}),2);assert.equal(state.decision.product,32);assert.deepEqual(state.decision.distributive,[20,12]);assert.deepEqual(state.decision.doubling,[16,16]);for(const key of ['arrayModel','decomposedModel','doubledModel'])assert.equal((state.variables[key].match(/<rect/g)||[]).length,32);assert.equal(specs.at(-1).stages[2](state).status,'review');state.request.approved_script='Eight times four. Five rows give twenty, three give twelve; double sixteen gives thirty-two.';assert.equal(reapprove(60,state).status,'ready');assert.equal(run(60,s=>s.request.rows=7).status,'review');assert.equal(run(60,s=>item(s,'mastery').accuracy=.9).status,'skip');});
