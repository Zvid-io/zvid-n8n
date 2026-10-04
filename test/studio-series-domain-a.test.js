'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const specs=require('../scripts/studio-series/domain-a');
const assets=path.resolve(__dirname,'../scripts/studio-series/assets');
function execute(day,change=()=>{}) {
 const spec=specs.find(s=>s.day===day);
 const fixture=structuredClone(spec.sample);change(fixture);
 let state={...fixture,history:[],config:{nowISO:spec.sampleAnchorISO},defaults:{},variables:{},decision:{},artifacts:[]};
 if(day===39)state.template=JSON.parse(fs.readFileSync(path.join(assets,'day-39.json')));
 // The actual generator embeds functions: exercise serialization, not closure access.
 for(const fn of spec.stages)state=(0,eval)('('+fn.toString()+')')(state);
 return state;
}
const find=(x,kind,id)=>x.records.find(r=>r.kind===kind&&(!id||r.record_id===id));

for(const spec of specs){
 test(`D${spec.day} complete sample serializes and maps every business variable`,()=>{
  const result=execute(spec.day);assert.equal(result.status,'ready',result.reason);
  const design=JSON.parse(fs.readFileSync(path.join(assets,`day-${spec.day}.json`)));
  const keys=Object.keys(design.variables).filter(k=>!['musicUrl','musicVolume'].includes(k)).sort();
  assert.deepEqual(Object.keys(result.variables).sort(),keys);
  assert.equal(result.artifacts.length,1);assert.ok(Object.keys(result.decision).length>1);
  assert.ok(!('musicUrl' in result.variables));assert.ok(!('musicVolume' in result.variables));
 });
 test(`D${spec.day} repeated identical input is deterministic`,()=>assert.deepEqual(execute(spec.day),execute(spec.day)));
 test(`D${spec.day} unapproved brief fails closed without output`,()=>{
  const r=execute(spec.day,x=>x.request.approval='draft');assert.equal(r.status,'review');assert.equal(r.artifacts.length,0);assert.deepEqual(r.variables,{});
 });
 test(`D${spec.day} duplicate record identity is rejected`,()=>{
  const r=execute(spec.day,x=>x.records.push({...x.records[0]}));assert.equal(r.status,'review');assert.match(r.reason,/Duplicate record_id/);
 });
}

test('D31 chooses relevant products and approved reasons',()=>{const r=execute(31);assert.deepEqual(r.decision.selectedSkus,['M1','S1','B1']);assert.equal(r.decision.budgetType,'per_item');assert.equal(r.variables.mugReason,'For your slow mornings');});
test('D31 missing available category stops rendering',()=>{const r=execute(31,x=>find(x,'product','s1').stock=0);assert.equal(r.status,'review');assert.match(r.reason,/category shoe/);});
test('D31 price changes affect the material shopping decision',()=>{const r=execute(31,x=>find(x,'product','m1').price_minor=3200);assert.equal(r.variables.mugPrice,'USD 32.00');assert.equal(r.decision.selected[0].price_minor,3200);});
test('D31 no matching approved reason fails closed',()=>{const r=execute(31,x=>x.records=x.records.filter(y=>y.kind!=='reason'||y.category!=='bag'));assert.equal(r.status,'review');assert.match(r.reason,/approved relevance copy/);});

test('D32 produces a complete basket with an exact balance',()=>{const r=execute(32);assert.deepEqual(r.decision.selectedSkus,['B1','S1','G1']);assert.equal(r.decision.total,20500);assert.equal(r.decision.budgetRemainingMinor,2500);});
test('D32 optimizes complete combinations rather than independent winners',()=>{
 const r=execute(32,x=>{
  find(x,'accessory','B1').price_minor=10000;find(x,'compatibility','e0').style_score=99;
  x.records.push({...find(x,'accessory','B1'),record_id:'B2',sku:'B2',name:'Alternative bag',price_minor:8000},{...find(x,'compatibility','e0'),record_id:'e3',accessory_sku:'B2',style_score:70});
 });assert.equal(r.status,'ready');assert.deepEqual(r.decision.selectedSkus,['B2','S1','G1']);assert.equal(r.decision.total,21700);
});
test('D32 unavailable requested shoe size goes to review',()=>{const r=execute(32,x=>x.request.shoe_size='46');assert.equal(r.status,'review');assert.match(r.reason,/shoe size/);});
test('D32 contradictory duplicate compatibility fails closed',()=>{const r=execute(32,x=>x.records.push({...find(x,'compatibility','e0'),record_id:'conflict',approved:false}));assert.equal(r.status,'review');assert.match(r.reason,/Duplicate accessory_sku/);});

test('D33 repeated export rows count one support thread',()=>{const r=execute(33,x=>x.records.push({...find(x,'question','q1'),record_id:'repeat-export'}));assert.equal(r.status,'ready');assert.equal(r.decision.selectedTopic.count,3);});
test('D33 current coverage suppresses a duplicate editorial topic',()=>{const r=execute(33,x=>x.records.push({kind:'coverage',record_id:'covered',product_id:'ESP1',topic_id:'brew',valid_until:'2026-11-01T00:00:00Z'}));assert.equal(r.status,'skip');});
test('D33 unsupported rights prevent clip substitution',()=>{const r=execute(33,x=>find(x,'demonstration').expires_at='2026-10-01T00:00:00Z');assert.equal(r.status,'review');assert.match(r.reason,/effective approved demonstration/);});
test('D33 a changed approved answer changes video and reply draft',()=>{const r=execute(33,x=>find(x,'demonstration').first_answer='Watch the brew begin.');assert.equal(r.variables.firstAnswer,'Watch the brew begin.');assert.match(r.decision.replyDraft,/Watch the brew begin/);});

test('D34 scores declared weighted preferences',()=>{const r=execute(34);assert.deepEqual(r.decision.scores,{left:3,right:2});assert.equal(r.decision.winner,'left');assert.equal(r.decision.matrix.length,2);});
test('D34 changed evidence can change the recommended option',()=>{const r=execute(34,x=>find(x,'evidence','R-ease').value=5);assert.equal(r.status,'ready');assert.equal(r.decision.winner,'right');assert.deepEqual(r.decision.scores,{left:1.5,right:3.5});});
test('D34 identical criteria remain a tie',()=>{const r=execute(34,x=>{find(x,'evidence','R-ease').value=5;find(x,'evidence','L-control').value=5;});assert.equal(r.decision.winner,'tie');});
test('D34 incomparable evidence units fail closed',()=>{const r=execute(34,x=>find(x,'evidence','R-ease').unit='seconds');assert.equal(r.status,'review');assert.match(r.reason,/Incomparable/);});
test('D34 over-budget products cannot enter a rendered comparison',()=>{const r=execute(34,x=>x.request.budget_minor=30000);assert.equal(r.status,'review');});

test('D35 allocates oldest waiters under stock and cohort caps',()=>{const r=execute(35);assert.equal(r.decision.sellable,10);assert.equal(r.decision.plannedUnits,8);assert.deepEqual(r.decision.selectedSubscriberIds,['SUB0','SUB1','SUB2','SUB3']);assert.equal(r.decision.deferred.length,4);assert.equal(r.decision.inventoryMutation,false);});
test('D35 already positive inventory is not a restock',()=>{const r=execute(35,x=>find(x,'snapshot','sn0').on_hand=10);assert.equal(r.status,'skip');assert.match(r.reason,/zero-to-positive/);});
test('D35 recent prior contacts are excluded from a first-access cohort',()=>{const r=execute(35,x=>x.records.push({kind:'contact',record_id:'sent0',restock_id:'RESTOCK1',subscriber_id:'SUB0',status:'sent'}));assert.equal(r.status,'ready');assert.deepEqual(r.decision.selectedSubscriberIds,['SUB1','SUB2','SUB3','SUB4']);});
test('D35 a stale stock snapshot cannot support availability copy',()=>{const r=execute(35,x=>find(x,'snapshot','sn1').at='2026-10-02T08:00:01Z');assert.equal(r.status,'review');assert.match(r.reason,/stale/);});

test('D36 from-price is supported by stock and independent of hero priority',()=>{const r=execute(36);assert.equal(r.decision.heroSku,'C1');assert.equal(r.decision.fromPriceSku,'C2');assert.equal(r.variables.price,'From AUD 28.00');});
test('D36 a future launch yields explicit no work',()=>{const r=execute(36,x=>x.request.launch_at='2026-10-04T08:00:00Z');assert.equal(r.status,'skip');});
test('D36 overlapping active price windows require review',()=>{const r=execute(36,x=>x.records.push({...find(x,'price','pC1'),record_id:'conflict',price_minor:1}));assert.equal(r.status,'review');assert.match(r.reason,/Exactly one effective/);});
test('D36 availability changes the supported starting price',()=>{const r=execute(36,x=>find(x,'product','C2').stock=0);assert.equal(r.status,'ready');assert.equal(r.variables.price,'From AUD 40.00');assert.equal(r.decision.fromPriceSku,'C1');});

test('D37 coherent customer pair preserves demo disclosure',()=>{const r=execute(37);assert.deepEqual(r.decision.selectedClipIds,['routineA','applicationA']);assert.match(r.variables.footageLabel,/DEMO/);assert.equal(r.decision.reviewAfter,'2026-10-31T00:00:00Z');});
test('D37 permission must cover the entire campaign, not only its start',()=>{const r=execute(37,x=>find(x,'release').valid_until='2026-10-10T00:00:00Z');assert.equal(r.status,'review');assert.match(r.reason,/valid rights/);});
test('D37 release for a different contributor cannot authorize a clip',()=>{const r=execute(37,x=>find(x,'release').contributor_id='WRONG');assert.equal(r.status,'review');});
test('D37 withdrawal of a quote prevents publication-copy fallback',()=>{const r=execute(37,x=>find(x,'caption').approval='withdrawn');assert.equal(r.status,'review');});
test('D37 updated approved quotation changes the story',()=>{const r=execute(37,x=>find(x,'caption').caption='My quiet morning routine.');assert.equal(r.variables.approvedCaption,'My quiet morning routine.');});

test('D38 diagnoses sufficiently sampled fatigue and excludes live angle',()=>{const r=execute(38);assert.equal(r.decision.relativeCTRDecline,0.5);assert.equal(r.decision.recentFrequency,4);assert.equal(r.decision.selectedAngle.angle_id,'new-city');assert.equal(r.decision.adAccountMutation,false);});
test('D38 weak evidence is not labeled fatigue',()=>{const r=execute(38,x=>{const m=find(x,'window_metric','recent');m.impressions=200;m.clicks=3;m.reach=100;});assert.equal(r.status,'skip');assert.match(r.reason,/Insufficient evidence/);});
test('D38 improving CTR does not trigger a replacement',()=>{const r=execute(38,x=>find(x,'window_metric','recent').clicks=400);assert.equal(r.status,'skip');assert.match(r.reason,/No fatigue signal/);});
test('D38 impossible clicks are rejected before diagnosing anything',()=>{const r=execute(38,x=>find(x,'window_metric','recent').clicks=11000);assert.equal(r.status,'review');assert.match(r.reason,/Inconsistent/);});
test('D38 a zero baseline CTR has no relative-decline inference',()=>{const r=execute(38,x=>find(x,'window_metric','baseline').clicks=0);assert.equal(r.status,'skip');});

test('D39 area diversity is bounded by an explicit score tolerance',()=>{const r=execute(39);assert.deepEqual(r.decision.selectedListingIds,['A','C','B']);assert.deepEqual(r.decision.selected.map(x=>x.score),[30,20,30]);});
test('D39 sold property never fills an empty visual slot',()=>{const r=execute(39,x=>find(x,'listing','B').status='sold');assert.equal(r.status,'review');assert.equal(r.decision.partialShortlist.length,2);assert.equal(r.variables.firstImage,undefined);});
test('D39 stale availability is rejected and explained',()=>{const r=execute(39,x=>find(x,'listing','C').updated_at='2026-09-01T00:00:00Z');assert.equal(r.status,'review');assert.ok(r.decision.rejected.find(x=>x.listing_id==='C').reasons.includes('stale availability'));});
test('D39 changed buyer preference changes explained ordering',()=>{const r=execute(39,x=>x.request.preferred=['light']);assert.equal(r.status,'ready');assert.equal(r.decision.selectedListingIds[0],'C');assert.equal(r.variables.firstFit,'For the light-filled mornings');});
test('D39 chooses distinct supported reasons and headings rather than repeating a shared preference',()=>{const r=execute(39);assert.equal(r.status,'ready');assert.deepEqual(r.decision.selected.map(x=>x.reason_feature),['outdoor','light','privacy']);assert.deepEqual(r.decision.reasonHeadings.map(x=>x.heading),['01 / OUTDOOR SPACE','02 / NATURAL LIGHT','03 / PRIVACY']);assert.deepEqual([r.variables.firstFit,r.variables.secondFit,r.variables.thirdFit],['For the outdoor days','For the light-filled mornings','For a private retreat']);assert.equal(r.decision.reasonReuseRequired,false);const html=JSON.stringify(r.template);assert.doesNotMatch(html,/THE LIGHT EDIT|THE QUIET EDIT|THE OUTDOOR EDIT/);assert.match(html,/02 \/ NATURAL LIGHT/);});
test('D39 reason assignment looks ahead so an earlier flexible listing does not consume the only later reason',()=>{const r=execute(39,x=>{find(x,'listing','A').features=['parking','outdoor','light'];find(x,'listing','B').features=['parking','outdoor'];find(x,'listing','C').features=['parking','privacy'];});assert.equal(r.status,'ready');assert.equal(r.decision.distinctReasonFeatures,3);assert.deepEqual(Object.fromEntries(r.decision.selected.map(x=>[x.listing_id,x.reason_feature])),{A:'light',C:'privacy',B:'outdoor'});});
test('D39 repeats only supported reasons when no distinct assignment exists and aligns every heading to the fallback',()=>{const r=execute(39,x=>x.request.preferred=['light']);assert.equal(r.status,'ready');assert.equal(r.decision.distinctReasonFeatures,1);assert.equal(r.decision.reasonReuseRequired,true);assert.ok(r.decision.reasonHeadings.every(x=>x.heading.endsWith('NATURAL LIGHT')));assert.ok(r.decision.selected.every(x=>x.reason_feature==='light'));});
test('D39 duplicate reason records for one feature do not masquerade as different reasons',()=>{const r=execute(39,x=>{x.request.preferred=['light'];x.records.push({...find(x,'reason','reason1'),record_id:'reason-light-copy'});});assert.equal(r.status,'ready');assert.equal(r.decision.distinctReasonFeatures,1);assert.equal(r.decision.reasonReuseRequired,true);});
test('D39 explicit approved short headings follow the selected feature and escape ampersands',()=>{const r=execute(39,x=>find(x,'reason','reason1').heading='Light & space');assert.equal(r.status,'ready');assert.equal(r.decision.reasonHeadings[1].heading,'02 / LIGHT & SPACE');assert.match(JSON.stringify(r.template),/LIGHT &amp; SPACE/);});
test('D39 unsafe or overlong reason headings cannot enter the approved design',()=>{assert.equal(execute(39,x=>find(x,'reason','reason1').heading='<script>alert(1)</script>').status,'review');assert.equal(execute(39,x=>find(x,'reason','reason1').heading='A heading that is too long for this compact design').status,'review');});

test('D40 respects party size and confirmed capacity without booking',()=>{const r=execute(40);assert.equal(r.status,'ready');assert.deepEqual(r.decision.proposedInvitations.map(x=>[x.interest_id,x.slot_start]),[['I1','2026-10-04T10:30:00Z'],['I2','2026-10-04T10:00:00Z']]);assert.equal(r.decision.bookingMutation,false);assert.equal(r.variables.eventDate,'Sunday 4 October');assert.match(r.variables.eventTime,/11:00/);});
test('D40 full event returns no misleading invitation',()=>{const r=execute(40,x=>{find(x,'booking').party_size=4;x.records.push({...find(x,'booking'),record_id:'BK2',booking_id:'BK2',slot_start:'2026-10-04T10:30:00Z'});});assert.equal(r.status,'skip');assert.match(r.reason,/fully booked/);});
test('D40 overbooked slot is a review failure',()=>{const r=execute(40,x=>find(x,'booking').party_size=5);assert.equal(r.status,'review');assert.match(r.reason,/exceed slot capacity/);});
test('D40 changed capacity produces a different invitation plan',()=>{const r=execute(40,x=>x.request.per_slot_capacity=5);assert.equal(r.status,'ready');assert.equal(r.decision.proposedInvitations[0].slot_start,'2026-10-04T10:00:00Z');assert.equal(r.decision.proposedInvitations[1].slot_start,'2026-10-04T10:30:00Z');});
