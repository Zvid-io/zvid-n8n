'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const specs = require('../scripts/studio-series/domain-b');
const assets = path.resolve(__dirname, '../scripts/studio-series/assets');
const delivery = JSON.parse(fs.readFileSync(path.join(assets, 'design-manifest.json')));
const byDay = Object.fromEntries(specs.map(s => [s.day,s]));
function execute(day, alter=()=>{}) {
  const s=byDay[day];
  const payload=JSON.parse(fs.readFileSync(path.join(assets,delivery.templates.find(t=>t.day===day).payloadFile)));
  let state={...structuredClone(s.sample),history:[],config:{nowISO:s.sampleAnchorISO},defaults:payload.variables,variables:{},decision:{},artifacts:[]};
  alter(state);
  for(const fn of s.stages) {
    // Mirrors exported Code nodes: no authoring-module closure is available.
    const isolated=vm.runInNewContext('('+fn.toString()+')');
    state=isolated(state);
  }
  return JSON.parse(JSON.stringify(state));
}
for(const spec of specs) {
  test(`day ${spec.day} stages execute independently and map only approved variables`,()=>{
    const out=execute(spec.day);
    assert.equal(out.status,'ready',out.reason);
    const payload=JSON.parse(fs.readFileSync(path.join(assets,delivery.templates.find(t=>t.day===spec.day).payloadFile)));
    for(const key of Object.keys(out.variables)) assert.ok(Object.hasOwn(payload.variables,key),`Undeclared ${key}`);
    assert.equal(out.artifacts.length,1);
    assert.equal(JSON.parse(out.artifacts[0].content).requestId,spec.sample.request.request_id);
    assert.equal(spec.stages.length,3);
  });
  test(`day ${spec.day} does not continue after a source gate fails`,()=>{
    const out=execute(spec.day,state=>{delete state.request.request_id;});
    assert.equal(out.status,'review');
    assert.deepEqual(out.variables,{});
    assert.equal(out.artifacts.length,0);
  });
}

test('41 ranks actual approved asking prices and rejects incomplete floor-plan approval',()=>{
  const changed=execute(41,s=>{s.records[1].priceCents=40000000;});
  assert.equal(changed.variables.unitOne,'Unit B 508');
  assert.equal(changed.variables.unitOnePrice,'USD 400000.00');
  assert.equal(changed.decision.floorPlanUnitId,'B508');
  const blocked=execute(41,s=>{s.records[1].floorPlanApproved=false;});
  assert.equal(blocked.status,'review');
  assert.match(blocked.decision.rejections[0].reason,/Floor plan/);
});
test('42 recomputes mixed nightly rates, fees and tax; missing/closed nights stop rendering',()=>{
  const original=execute(42);
  assert.equal(original.decision.totalCents,89100);
  const changed=execute(42,s=>{s.records.find(x=>x.kind==='night').nightlyCents=25000;});
  assert.equal(changed.decision.totalCents,95700);
  assert.match(changed.variables.nightlyPrice,/190.00.*250.00/);
  assert.equal(execute(42,s=>{s.records.pop();}).status,'review');
  assert.equal(execute(42,s=>{s.records[1].available=false;}).status,'review');
});
test('43 prioritizes unexposed available stock and excludes sold vehicles',()=>{
  const changed=execute(43,s=>{
    s.records.push({...s.records[0],record_id:'NLNEW',name:'New arrival',acquiredAt:'2026-10-02T10:00:00Z'});
    s.history=[{status:'completed',selectedVehicleIds:['NL1042','NL1098','NL1131']}];
  });
  assert.equal(changed.decision.selectedVehicleIds[0],'NLNEW');
  const stopped=execute(43,s=>{s.records[0].status='sold';});
  assert.equal(stopped.status,'review');
});
test('44 changing buyer weights changes ranking while hard requirements remain binding',()=>{
  const original=execute(44),changed=execute(44,s=>{s.request.priceWeight=1;s.request.cargoWeight=0;});
  assert.equal(original.decision.selectedVehicleIds[0],'NL1042');
  assert.equal(changed.decision.selectedVehicleIds[0],'NL1098');
  assert.notEqual(original.variables.optionOne,changed.variables.optionOne);
  assert.equal(execute(44,s=>{s.request.minCargoLitres=600;}).status,'review');
});
test('45 only renders the exact valid approved offer revision and price',()=>{
  const changed=execute(45,s=>{s.records[0].priceCents=2700000;s.records[1].approvedPriceCents=2700000;});
  assert.equal(changed.variables.currentPrice,'USD 27000.00');
  assert.equal(execute(45,s=>{s.records[0].priceCents=2700000;}).status,'review');
  assert.equal(execute(45,s=>{s.records[0].offerVersion='4';}).status,'review');
  assert.equal(execute(45,s=>{s.config.nowISO='2026-10-11T00:00:00Z';s.records[2].updatedAt=s.config.nowISO;}).status,'skip');
});
test('46 updates matching observation text and never omits a critical finding silently',()=>{
  const changed=execute(46,s=>{s.records[1].observation='Recorded light scratch on the front bumper.';});
  assert.equal(changed.variables.exteriorNote,'Recorded light scratch on the front bumper.');
  assert.equal(execute(46,s=>{s.records[1].severity='critical';}).status,'review');
  assert.equal(execute(46,s=>{s.records[1].vehicle_id='OTHER';}).status,'review');
});
test('47 computes bottleneck portions per branch rather than advertising unavailable ingredients',()=>{
  const original=execute(47);
  assert.equal(original.decision.branchCapacity[0].sellablePortions,25);
  const changed=execute(47,s=>{s.records.find(x=>x.kind==='ingredient'&&x.branch_id==='downtown'&&x.ingredient_id==='bread').availableUnits=12;});
  assert.equal(changed.variables.branchOne,'Quayside branch');
  assert.equal(changed.decision.branchCapacity[1].sellablePortions,6);
  assert.equal(execute(47,s=>{s.records.find(x=>x.kind==='ingredient').availableUnits=1;}).status,'review');
});
test('48 scales a written quote, respects capacity, and rejects known allergen conflicts',()=>{
  const changed=execute(48,s=>{s.request.guests=50;});
  assert.equal(changed.variables.foodTotal,'USD 1600.00');
  assert.equal(changed.variables.total,'USD 1780.00');
  assert.equal(execute(48,s=>{s.request.excludedAllergens=['MILK'];}).status,'review');
  assert.equal(execute(48,s=>{s.records[1].bookedGuests=180;}).status,'review');
});
test('49 reconciles bookings and turnover; candidate starts are alternatives, not simultaneous reservations',()=>{
  const original=execute(49);
  assert.equal(original.variables.slotOne,'16:30');
  assert.deepEqual(original.decision.selectedSlots[0].tableIds,['T2']);
  const changed=execute(49,s=>{s.records.push({kind:'reservation',record_id:'R3',table_id:'T2',startsAt:'2026-10-03T16:30:00Z',endsAt:'2026-10-03T18:00:00Z',status:'confirmed'});});
  assert.equal(changed.variables.slotOne,'18:30');
  assert.equal(changed.decision.doesNotCreateReservations,true);
  assert.equal(execute(49,s=>{s.request.snapshotAt='2026-10-03T09:00:00Z';}).status,'review');
});
test('50 changes approved dish copy and rejects mismatched media revisions or missing traceability',()=>{
  const changed=execute(50,s=>{s.records[0].story='Salmon and seasonal vegetables, plated by the kitchen team.';});
  assert.equal(changed.variables.dishStory,'Salmon and seasonal vegetables, plated by the kitchen team.');
  assert.equal(execute(50,s=>{s.records.find(x=>x.kind==='media'&&x.role==='cook').recipeRevision='old';}).status,'review');
  assert.equal(execute(50,s=>{s.records.find(x=>x.kind==='ingredient').traceabilityApproved=false;}).status,'review');
});

