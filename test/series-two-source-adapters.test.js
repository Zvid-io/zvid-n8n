'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const {adapters,prepareSource,fixtureFor,serializeRuntime,writebackHeaders} = require('../scripts/series-two-source-adapters');
const specs = require('../scripts/series-two-specs');
const {runTransform} = require('../scripts/series-two-framework');
const NOW='2026-10-01T12:00:00Z';
const evaluate=(day,mutate=()=>{})=>{const fixture=fixtureFor(day,NOW);mutate(fixture);return prepareSource(day,fixture.primary,fixture.details,NOW);};
const detail=(fixture,kind)=>fixture.details.find(row=>row.kind===kind);
const all=(fixture,kind)=>fixture.details.filter(row=>row.kind===kind);

test('All 30 sources expose flat domain-specific schemas and separate automation writeback',()=>{
  assert.equal(Object.keys(adapters).length,30);
  for(let day=31;day<=60;day++){
    const adapter=adapters[day],fixture=fixtureFor(day,NOW);
    assert.equal(adapter.sourceTab,`D${day}Source`);assert.equal(adapter.detailsTab,`D${day}Details`);
    assert.equal(new Set(adapter.primaryHeaders).size,adapter.primaryHeaders.length);
    assert.equal(new Set(adapter.detailHeaders).size,adapter.detailHeaders.length);
    for(const header of writebackHeaders)assert.ok(adapter.primaryHeaders.includes(header));
    for(const value of Object.values(fixture.primary))assert.ok(value===null||['string','number','boolean'].includes(typeof value),'primary source contains a JSON blob');
    for(const row of fixture.details)for(const value of Object.values(row))assert.ok(value===null||['string','number','boolean'].includes(typeof value),'detail row contains a JSON blob');
    assert.match(adapter.need,/\S{4}/);assert.match(adapter.policy,/\S{4}/);assert.match(adapter.outcome,/private Drive/);
    assert.ok(adapter.policyShort.split(/\s+/).length<43);
    assert.equal(adapter.refreshPeriod,[46,47,50,59].includes(day)?'day':'event');
    assert.ok(!fixture.primary.source_id.includes(fixture.primary.product||'impossible-label'),'identity must not be the product display name');
  }
});

for(const spec of specs){
  test(`D${spec.day}: fixture joins produce a valid full business input`,()=>{
    const fixture=fixtureFor(spec.day,NOW),result=prepareSource(spec.day,fixture.primary,fixture.details,NOW);
    assert.equal(result.decision,'ready',result.reason);assert.ok(!runTransform(spec,result.input).skip);
    assert.equal(result.context.details.length,fixture.details.length);
    assert.equal(result.context.sourceId,fixture.primary.source_id);assert.equal(result.context.revision,'r1');
    assert.ok(!Object.hasOwn(result.context.record,'automation_status'));
    assert.ok(!Object.hasOwn(result.context.record,'video_url'));
  });
  test(`D${spec.day}: future/changed source identity is not silently accepted`,()=>{
    assert.equal(evaluate(spec.day,f=>f.primary.updated_at='2026-10-02T12:00:00Z').decision,'review');
    assert.equal(evaluate(spec.day,f=>f.primary.source_id='').decision,'review');
    assert.equal(evaluate(spec.day,f=>f.primary.revision='').decision,'review');
    assert.equal(evaluate(spec.day,f=>f.primary.source_url='http://example.com/source').decision,'review');
  });
  test(`D${spec.day}: unapproved and cancelled sources skip while delivered writeback does not hide revisions`,()=>{
    assert.equal(evaluate(spec.day,f=>f.primary.approval='pending').decision,'skip');
    assert.equal(evaluate(spec.day,f=>f.primary.status='cancelled').decision,'skip');
    assert.equal(evaluate(spec.day,f=>{f.primary.automation_status='delivered';f.primary.video_url='https://example.com/previous.mp4';}).decision,'ready');
  });
  test(`D${spec.day}: unrelated and future-revision rows cannot contaminate the join`,()=>{
    const fixture=fixtureFor(spec.day,NOW),expected=prepareSource(spec.day,fixture.primary,fixture.details,NOW);
    fixture.details.push({parent_id:'another-parent',revision:'r1',kind:'unknown',position:1},{parent_id:fixture.primary.source_id,revision:'r2',kind:'unknown',position:1});
    const actual=prepareSource(spec.day,fixture.primary,fixture.details,NOW);assert.deepEqual(actual.input,expected.input);assert.deepEqual(actual.context,expected.context);
  });
  test(`D${spec.day}: runtime can execute in a module-free Code-node sandbox`,()=>{
    const fixture=fixtureFor(spec.day,NOW),expected=prepareSource(spec.day,fixture.primary,fixture.details,NOW);
    const actual=vm.runInNewContext(`${serializeRuntime(spec.day)}\nprepareSource(day, primary, details, nowISO);`,{day:spec.day,primary:fixture.primary,details:fixture.details,nowISO:NOW},{timeout:1000});
    assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected);
  });
  test(`D${spec.day}: fixture dates remain usable at a later run date`,()=>{
    const later='2026-11-13T08:30:00Z',fixture=fixtureFor(spec.day,later),result=prepareSource(spec.day,fixture.primary,fixture.details,later);
    assert.equal(result.decision,'ready',result.reason);assert.ok(!runTransform(spec,result.input).skip);
  });
  if(adapters[spec.day].detailKinds&&Object.keys(adapters[spec.day].detailKinds).length){
    test(`D${spec.day}: duplicate child positions require source repair`,()=>{
      assert.equal(evaluate(spec.day,f=>f.details.push({...f.details[0],row_number:999})).decision,'review');
    });
  }
}

const cases=[
  [31,'internal-only release is zero-work','skip',f=>all(f,'change').forEach(row=>row.audience='internal')],
  [31,'prerelease is withheld','skip',f=>f.primary.isPrerelease=true],
  [31,'unknown change classification needs review','review',f=>detail(f,'change').type='breaking'],
  [32,'missing step in contiguous procedure requires repair','review',f=>detail(f,'step').position=9],
  [32,'future procedure stays queued','skip',f=>f.primary.effectiveDate='2026-10-02'],
  [32,'ownerless procedure needs review','review',f=>f.primary.procedureOwner=''],
  [33,'missing feature rows for a plan prevent misleading comparison','review',f=>f.details=f.details.filter(row=>!(row.kind==='feature'&&row.plan_id==='plan-3'))],
  [33,'mixed currency catalog needs review','review',f=>detail(f,'plan').currency='EUR'],
  [33,'expired pricing cannot be handed off','skip',f=>f.primary.expiresAt='2026-09-30'],
  [34,'open incident is pending','skip',f=>f.primary.status='investigating'],
  [34,'out-of-window update cannot be represented as incident evidence','review',f=>detail(f,'event').at='2026-10-01T07:00:00Z'],
  [34,'final unresolved update prevents resolved recap','review',f=>all(f,'event').at(-1).eventStatus='Investigating'],
  [35,'far-future maintenance remains queued','skip',f=>{f.primary.startsAt='2026-10-20T12:00:00Z';f.primary.endsAt='2026-10-20T13:00:00Z';}],
  [35,'past window is zero-work','skip',f=>{f.primary.startsAt='2026-10-01T09:00:00Z';f.primary.endsAt='2026-10-01T10:00:00Z';}],
  [35,'invalid maintenance duration requires review','review',f=>f.primary.endsAt=f.primary.startsAt],
  [36,'disallowed order communication is skipped','skip',f=>f.primary.notificationAllowed=false],
  [36,'unsupported fulfillment state requires repair','review',f=>f.primary.fulfillmentStatus='lost'],
  [36,'fractional item quantity cannot describe fulfillment','review',f=>detail(f,'item').quantity='1.5'],
  [37,'bundle surcharge is a review exception','review',f=>f.primary.bundlePrice=100],
  [37,'inactive component prevents current offer','review',f=>detail(f,'component').active=false],
  [37,'duplicate component SKU is ambiguous','review',f=>all(f,'component')[1].sku=all(f,'component')[0].sku],
  [38,'unchanged ETA is zero-work','skip',f=>f.primary.revisedDeliveryDate=f.primary.originalDeliveryDate],
  [38,'delivered shipment needs no delay brief','skip',f=>f.primary.shipmentStatus='delivered'],
  [38,'stale revised ETA needs current confirmation','review',f=>{f.primary.originalDeliveryDate='2026-09-28';f.primary.revisedDeliveryDate='2026-09-29';}],
  [39,'appointment outside reminder window stays queued','skip',f=>f.primary.reminderLeadHours=1],
  [39,'appointment with no preparation requires review','review',f=>f.details=[]],
  [39,'past appointment skips','skip',f=>f.primary.appointmentAt='2026-10-01T08:00:00Z'],
  [40,'expired authorization is zero-work','skip',f=>f.primary.deadline='2026-09-30'],
  [40,'missing return-label source needs review','review',f=>f.primary.labelUrl=''],
  [40,'instructions without authorized items need review','review',f=>f.details=f.details.filter(row=>row.kind!=='item')],
  [41,'already-started hire skips first-week preparation','skip',f=>f.primary.startDate='2026-09-30'],
  [41,'hire outside planning window stays queued','skip',f=>f.primary.startDate='2026-11-01'],
  [41,'day six is not a first-week session','review',f=>detail(f,'session').day=6],
  [42,'overlapping interviews require coordinator review','review',f=>all(f,'session')[1].startsAt='2026-10-07T09:15:00Z'],
  [42,'late agenda skips','skip',f=>{all(f,'session').forEach(row=>{row.startsAt=row.startsAt.replace('2026-10-07','2026-09-30');row.endsAt=row.endsAt.replace('2026-10-07','2026-09-30');});}],
  [42,'interviewerless session requires review','review',f=>detail(f,'session').interviewer=''],
  [43,'withdrawn enrollment receives no orientation asset','skip',f=>f.primary.enrollmentStatus='withdrawn'],
  [43,'draft syllabus stays unpublished','skip',f=>f.primary.syllabusStatus='draft'],
  [43,'module without learning outcome requires review','review',f=>detail(f,'module').outcome=''],
  [44,'expired assessment cannot be used','skip',f=>f.primary.expiresAt='2026-09-30'],
  [44,'uncontrolled hazard needs source review','review',f=>detail(f,'hazard').control=''],
  [44,'missing supervisor prevents unowned briefing','review',f=>f.primary.supervisor=''],
  [45,'provisional attempt is not a final result','skip',f=>f.primary.status='provisional'],
  [45,'passing result without source certificate requires review','review',f=>f.primary.certificateId=''],
  [45,'failing attempt requires its approved remediation instruction','review',f=>{f.primary.score=40;f.primary.remedialInstruction='';}],
  [46,'all complete actions produce zero-work','skip',f=>all(f,'action').forEach(row=>row.actionStatus='complete')],
  [46,'action without owner cannot be assigned','review',f=>detail(f,'action').owner=''],
  [46,'future actions outside report window produce zero-work','skip',f=>all(f,'action').forEach(row=>row.dueDate='2026-11-01')],
  [47,'open service ticket avoids duplicate maintenance work','skip',f=>all(f,'equipment').forEach(row=>row.openWorkItem='WORK-OPEN')],
  [47,'decommissioned equipment is excluded','skip',f=>all(f,'equipment').forEach(row=>row.assetStatus='decommissioned')],
  [47,'future service history needs review','review',f=>detail(f,'equipment').lastServicedAt='2026-10-02'],
  [48,'healthy stock needs no requisition briefing','skip',f=>all(f,'item').forEach(row=>row.onHand=row.targetStock)],
  [48,'open replenishment avoids duplicate requests','skip',f=>all(f,'item').forEach(row=>row.openReplenishment='REQ-OPEN')],
  [48,'duplicate stock SKU requires source repair','review',f=>all(f,'item')[1].sku=all(f,'item')[0].sku],
  [49,'route without driver requires review','review',f=>f.primary.driver=''],
  [49,'duplicate dispatch sequence requires repair','review',f=>all(f,'stop')[1].sequence=all(f,'stop')[0].sequence],
  [49,'past departure needs no departure briefing','skip',f=>f.primary.departureAt='2026-10-01T08:00:00Z'],
  [50,'unverified mandatory eligibility produces review','review',f=>detail(f,'eligibility').verified=false],
  [50,'unassigned required document requires review','review',f=>detail(f,'document').owner=''],
  [50,'expired tender is zero-work','skip',f=>f.primary.deadline='2026-09-30'],
  [51,'unconfirmed trip remains queued','skip',f=>f.primary.bookingStatus='pending'],
  [51,'local time conflict requires coordinator review','review',f=>{const rows=all(f,'activity');rows[1].time=rows[0].time;}],
  [51,'missing destination timezone is not guessed','review',f=>f.primary.destinationTimezone=''],
  [52,'explicit private access-code field is rejected','review',f=>f.primary.access_code='1234'],
  [52,'nonpublic arrival instructions need review','review',f=>detail(f,'arrival').publicOnly=false],
  [52,'arrival outside notice window is zero-work','skip',f=>f.primary.arrivalDate='2026-10-20'],
  [53,'adopted animal is excluded','skip',f=>f.primary.availability='adopted'],
  [53,'publication permission is required','skip',f=>f.primary.publicPermission=false],
  [53,'adoption URL with embedded credentials requires repair','review',f=>f.primary.adoptionUrl='https://username:password@example.com/adopt'],
  [54,'required station coverage gap needs coordinator review','review',f=>detail(f,'requirement').minimumPeople=3],
  [54,'simultaneous assignments cannot conflict','review',f=>{const rows=all(f,'assignment');rows[2].person=rows[0].person;}],
  [54,'past shift needs no preparation asset','skip',f=>{f.primary.startsAt='2026-10-01T08:00:00Z';f.primary.endsAt='2026-10-01T09:00:00Z';}],
  [55,'refunded donation receives no thank-you brief','skip',f=>f.primary.donationStatus='refunded'],
  [55,'missing donor permission skips','skip',f=>f.primary.communicationAllowed=false],
  [55,'currency mismatch in cost model needs review','review',f=>detail(f,'cost').currency='EUR'],
  [56,'open survey is not a closed result','review',f=>f.primary.status='open'],
  [56,'duplicate response IDs cannot inflate votes','review',f=>{const rows=all(f,'response');rows[1].response_id=rows[0].response_id;}],
  [56,'unknown response option needs repair','review',f=>detail(f,'response').option_id='unknown-option'],
  [57,'no new milestone is zero-work','skip',f=>f.primary.lastBriefedMilestone=50],
  [57,'refunded contributions do not count toward milestone','skip',f=>all(f,'contribution').forEach(row=>row.paymentStatus='refunded')],
  [57,'settled contribution currency mismatch needs review','review',f=>detail(f,'contribution').currency='EUR'],
  [58,'publication consent is required','skip',f=>f.primary.publicPermission=false],
  [58,'same measurement periods do not support before/after','review',f=>f.primary.followupPeriod=f.primary.baselinePeriod],
  [58,'duplicate metric names require source repair','review',f=>all(f,'metric')[1].name=all(f,'metric')[0].name],
  [59,'missing reporting period prevents untraceable roadmap','review',f=>f.primary.reportingPeriod=''],
  [59,'invalid milestone state requires review','review',f=>detail(f,'milestone').milestoneStatus='probably_done'],
  [59,'missing milestone source needs review','review',f=>f.details=[]],
  [60,'retired recipe is excluded','skip',f=>f.primary.recipeStatus='retired'],
  [60,'stale preparation request is zero-work','skip',f=>f.primary.requestedAt='2026-09-20T10:00:00Z'],
  [60,'missing cooking step position requires repair','review',f=>detail(f,'step').position=8],
];
for(const [day,name,decision,mutate] of cases)test(`D${day}: ${name}`,()=>{const result=evaluate(day,mutate);assert.equal(result.decision,decision,result.reason);assert.ok(!result.input,'skip/review must not provide paid render input');});

test('Sheet numeric and boolean cells normalize without accepting blank or malformed values',()=>{
  const result=evaluate(36,f=>{f.primary.notificationAllowed='TRUE';detail(f,'item').quantity='2';});assert.equal(result.decision,'ready');assert.equal(result.input.items[0].quantity,2);
  assert.equal(evaluate(36,f=>detail(f,'item').quantity='').decision,'review');assert.equal(evaluate(36,f=>f.primary.notificationAllowed='yes').decision,'review');
});
test('Failed training result retains a result reference and the remediation next action',()=>{
  const result=evaluate(45,f=>{f.primary.score=40;f.primary.certificateId='';});assert.equal(result.decision,'ready');assert.match(result.input.certificateId,/^result:/);assert.match(result.context.nextAction,/retake/);assert.ok(!runTransform(specs.find(s=>s.day===45),result.input).meta.passed);
});
test('Survey totals are calculated from individual source responses with tied winners preserved',()=>{
  const result=evaluate(56);assert.deepEqual(result.input.options.map(row=>row.votes),[24,18,18]);assert.equal(result.context.responseCount,60);
  const fixture=fixtureFor(56,NOW);fixture.details=fixture.details.filter(row=>row.kind!=='response');assert.equal(prepareSource(56,fixture.primary,fixture.details,NOW).decision,'skip');
});
test('Tender briefing retains assigned missing documents as an actionable private exception list',()=>{
  const result=evaluate(50,f=>detail(f,'document').ready=false);assert.equal(result.decision,'ready');assert.equal(result.context.missingDocuments.length,1);assert.match(result.input.documents[0],/needed/);
});
test('Maintenance and stock outputs exclude already assigned work but retain the full source snapshot',()=>{
  const equipment=evaluate(47);assert.equal(equipment.input.equipment.length,1);assert.equal(equipment.context.details.length,2);assert.deepEqual(equipment.context.selectedAssetIds,['QA-ASSET-1']);
  const stock=evaluate(48);assert.equal(stock.input.items.length,2);assert.equal(stock.context.details.length,3);
});
test('Source snapshot fingerprint inputs do not change with execution time or physical sheet row order',()=>{
  const fixture=fixtureFor(35,NOW),first=prepareSource(35,fixture.primary,fixture.details,NOW);
  const later=prepareSource(35,fixture.primary,[...fixture.details].reverse(),'2026-10-01T12:05:00Z');
  assert.notEqual(first.input.referenceDate,later.input.referenceDate);assert.deepEqual(first.sourceSnapshot,later.sourceSnapshot);
});
