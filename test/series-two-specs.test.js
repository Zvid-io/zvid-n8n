'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const specs = require('../scripts/series-two-specs');
const { runTransform } = require('../scripts/series-two-framework');
const copy = (value) => JSON.parse(JSON.stringify(value));
const byDay = (day) => specs.find((spec) => spec.day === day);
const run = (day, edit) => {
  const spec = byDay(day), input = copy(spec.sample);
  if (edit) edit(input);
  return runTransform(spec, input);
};

const expectations = {
  31: { changeCount: 3, counts: { added: 1, improved: 1, fixed: 1 } },
  32: { stepCount: 3, readingSeconds: 9 },
  33: { planCount: 3, commonFeatures: ['Shared inbox', 'Email support'], uniqueFeatures: { Starter: [], Team: ['Team analytics'], Scale: ['Dedicated onboarding'] } },
  34: { durationMinutes: 75, eventCount: 3, finalStatus: 'Resolved' },
  35: { durationMinutes: 90, hoursUntilStart: 48, inProgress: false },
  36: { status: 'shipped', completedStageCount: 2, nextStage: 'out_for_delivery', totalQuantity: 3 },
  37: { regularTotal: 50, bundlePrice: 40, savings: 10, surcharge: 0, savingsPercent: 20 },
  38: { delayDays: 2 },
  39: { taskCount: 3, appointmentAt: '2026-10-06T10:00:00.000Z' },
  40: { daysRemaining: 14, itemCount: 1, stepCount: 3 },
  41: { sessionCount: 3, workdayDates: ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'] },
  42: { sessionCount: 2, interviewMinutes: 60, agendaMinutes: 75, breakMinutes: 15 },
  43: { moduleCount: 3, totalMinutes: 60 },
  44: { hazardCount: 3, highPriorityCount: 1, orderedSeverities: ['high', 'medium', 'low'] },
  45: { passed: true, score: 92, passingScore: 80, marginPoints: 12 },
  46: { actionCount: 3, ownerCounts: { 'Support team': 2, 'Product team': 1 }, overdueCount: 1, earliestDueDate: '2026-09-30' },
  47: { dueCount: 1, checkedCount: 2, earliestDueDate: '2026-09-24', maximumOverdueDays: 7 },
  48: { reorderCount: 2, totalUnits: 47, quantities: { 'DEMO-MAT': 22, 'DEMO-PEN': 25 } },
  49: { stopCount: 3, totalMinutes: 85, arrivalTimes: ['2026-10-02T08:20:00.000Z', '2026-10-02T08:45:00.000Z', '2026-10-02T09:15:00.000Z'], finishAt: '2026-10-02T09:25:00.000Z' },
  50: { daysRemaining: 19, eligibilityCount: 2, documentCount: 3 },
  51: { dayCount: 2, activityCount: 3, firstDate: '2026-10-10', orderedTimes: [['09:00', '13:30'], ['10:00']] },
  52: { arrivalStepCount: 3, amenityCount: 3, checkInTime: '15:00' },
  53: { traitCount: 2, careNeedCount: 2, adoptionUrl: 'https://example.com/adopt/milo-demo' },
  54: { volunteerCount: 3, stationCount: 2, stationCoverage: { 'Welcome desk': 2, 'Equipment point': 1 }, durationMinutes: 180 },
  55: { impactUnits: 10, remainder: 5, donationAmount: 125, unitCost: 12 },
  56: { totalVotes: 60, percentages: { 'Workflow basics': 40, 'Data cleanup': 30, 'Video reporting': 30 }, winners: ['Workflow basics'] },
  57: { raised: 550, remaining: 450, excess: 0, progressPercent: 55, reached: false },
  58: { improvementCount: 2, metricCount: 2, changes: [{ name: 'Setup time', change: -15, percentageChange: -37.5, improved: true }, { name: 'Completed onboarding', change: 18, percentageChange: 30, improved: true }] },
  59: { completeCount: 1, overdueCount: 1, completionPercent: 33.3, nextMilestone: 'Pilot workspace', milestoneCount: 3 },
  60: { scaleFactor: 2, targetServings: 4, ingredientCount: 3, stepCount: 3, scaledIngredients: [{ name: 'Cooked rice', quantity: 400, unit: 'g' }, { name: 'Mixed vegetables', quantity: 600, unit: 'g' }, { name: 'Olive oil', quantity: 2, unit: 'tbsp' }] },
};

test('The additional series contains exactly thirty distinct day 31–60 templates', () => {
  assert.equal(specs.length, 30);
  assert.deepEqual(specs.map((spec) => spec.day), Array.from({ length: 30 }, (_, i) => i + 31));
  assert.equal(new Set(specs.map((spec) => spec.slug)).size, 30);
  assert.equal(new Set(specs.map((spec) => spec.title)).size, 30);
});

for (const spec of specs) {
  test(`Day ${spec.day} computes the exact expected business result without mutating input`, () => {
    const input = copy(spec.sample), before = copy(input), result = runTransform(spec, input);
    assert.deepEqual(result.meta, expectations[spec.day]);
    assert.deepEqual(input, before);
    assert.equal(result.skip, undefined);
    assert.ok(result.cards.length >= 3 && result.cards.length <= 5);
    assert.ok(result.title && result.sourceKey);
    assert.deepEqual(runTransform(spec, input), result, 'Repeated input must be deterministic');
  });

  test(`Day ${spec.day} rejects every missing required top-level field before rendering`, () => {
    for (const field of spec.fields) {
      const input = copy(spec.sample);
      delete input[field];
      assert.throws(() => runTransform(spec, input), Error, `Missing ${field} must fail`);
    }
    assert.throws(() => runTransform(spec, null), /input/i);
    assert.throws(() => runTransform(spec, []), /input/i);
  });
}

const invalidCases = [
  [31, (src) => { src.changes[0].type = 'unknown'; }, /change.type/],
  [32, (src) => { src.steps.length = 1; }, /steps/],
  [33, (src) => { src.plans[1].name = src.plans[0].name; }, /unique/],
  [34, (src) => { src.events[0].at = '2026-10-01T07:59:00Z'; }, /within/],
  [35, (src) => { src.endsAt = src.startsAt; }, /after/],
  [36, (src) => { src.status = 'canceled'; }, /status/],
  [37, (src) => { src.bundlePrice = 40.001; }, /decimal/],
  [38, (src) => { src.revisedDeliveryDate = '2026-10-02'; }, /precede/],
  [39, (src) => { src.appointmentAt = '2026-10-06T10:00:00+02:00'; }, /UTC/],
  [40, (src) => { src.deadline = '2026-02-30'; }, /calendar/],
  [41, (src) => { src.sessions[0].day = 1.5; }, /integer/],
  [42, (src) => { src.sessions[1].startsAt = '2026-10-07T09:20:00Z'; }, /overlap/],
  [43, (src) => { src.modules[0].minutes = 0; }, /module.minutes/],
  [44, (src) => { src.hazards[0].severity = 'critical'; }, /severity/],
  [45, (src) => { src.score = 101; }, /score/],
  [46, (src) => { src.actions[0].dueDate = '2026-13-01'; }, /calendar/],
  [47, (src) => { src.equipment[0].lastServicedAt = '2026-10-02'; }, /after/],
  [48, (src) => { src.items[0].targetStock = src.items[0].reorderPoint; }, /above/],
  [49, (src) => { src.stops[1].sequence = src.stops[0].sequence; }, /unique/],
  [50, (src) => { src.eligibility = []; }, /eligibility/],
  [51, (src) => { src.days[0].activities[0].time = '24:00'; }, /24-hour/],
  [52, (src) => { src.checkInTime = '15:60'; }, /24-hour/],
  [53, (src) => { src.adoptionUrl = 'http://example.com/adopt'; }, /HTTPS/],
  [54, (src) => { src.endsAt = src.startsAt; }, /after/],
  [55, (src) => { src.unitCost = 0; }, /unitCost/],
  [56, (src) => { src.options[0].votes = 0.5; }, /integer/],
  [57, (src) => { src.goal = 0; }, /goal/],
  [58, (src) => { src.metrics[0].direction = 'neutral'; }, /direction/],
  [59, (src) => { src.milestones[0].status = 'done'; }, /status/],
  [60, (src) => { src.baseServings = 0; }, /baseServings/],
];
for (const [day, edit, message] of invalidCases) {
  test(`Day ${day} rejects its malformed business input`, () => assert.throws(() => run(day, edit), message));
}

test('Release changes group correctly when only fixes are supplied', () => {
  const result = run(31, (src) => { src.changes = [src.changes[2]]; });
  assert.deepEqual(result.meta.counts, { added: 0, improved: 0, fixed: 1 });
  assert.equal(result.cards.length, 1);
});
test('Two-step procedures are accepted and reject empty instruction text', () => {
  assert.equal(run(32, (src) => { src.steps.length = 2; }).meta.stepCount, 2);
  assert.throws(() => run(32, (src) => { src.steps[0].instruction = '  '; }), /instruction/);
});
test('Plan feature comparison deduplicates repeated features without manufacturing unique benefits', () => {
  const result = run(33, (src) => { src.plans = src.plans.slice(0, 2); src.plans[0].features.push('Shared inbox'); });
  assert.deepEqual(result.meta.commonFeatures, ['Shared inbox', 'Email support']);
  assert.deepEqual(result.meta.uniqueFeatures, { Starter: [], Team: ['Team analytics'] });
});
test('Incident sorting retains the final chronological status and accepts a zero-minute resolved window', () => {
  assert.equal(run(34, (src) => { src.events.reverse(); }).meta.finalStatus, 'Resolved');
  const result = run(34, (src) => { src.resolvedAt = src.startedAt; src.events = [src.events[0]]; });
  assert.equal(result.meta.durationMinutes, 0);
  assert.throws(() => run(34, (src) => { src.startedAt = '2026-02-30T08:00:00Z'; }), /calendar|valid/);
});
test('Maintenance at its start is in progress; at its end it is explicit zero-work', () => {
  const started = run(35, (src) => { src.referenceDate = src.startsAt; });
  assert.equal(started.meta.inProgress, true);
  assert.equal(started.meta.hoursUntilStart, 0);
  const ended = run(35, (src) => { src.referenceDate = src.endsAt; });
  assert.equal(ended.skip, true);
  assert.match(ended.reason, /ended/);
});
test('Delivered orders have no next stage and never promise future delivery', () => {
  const result = run(36, (src) => { src.status = 'delivered'; });
  assert.equal(result.meta.nextStage, null);
  assert.equal(result.meta.completedStageCount, 4);
  assert.equal(result.cards[2].value, 'Delivered');
  assert.throws(() => run(36, (src) => { src.items[0].quantity = true; }), /quantity/);
});
test('Bundle savings use integer cents, include zero savings and label a surcharge accurately', () => {
  assert.equal(run(37, (src) => { src.bundlePrice = 50; }).meta.savings, 0);
  const surcharge = run(37, (src) => { src.bundlePrice = 55; });
  assert.equal(surcharge.meta.savings, 0);
  assert.equal(surcharge.meta.surcharge, 5);
  assert.equal(surcharge.meta.savingsPercent, 0);
  assert.match(surcharge.cards[3].detail, /no savings/);
  const cents = run(37, (src) => { src.components = [{ name: 'A', price: 0.1 }, { name: 'B', price: 0.2 }]; src.bundlePrice = 0.2; });
  assert.equal(cents.meta.regularTotal, 0.3);
  assert.equal(cents.meta.savings, 0.1);
  assert.throws(() => run(37, (src) => { src.components.forEach((item) => { item.price = 0; }); }), /positive/);
});
test('Unchanged delivery estimates do not claim a delay and impossible dates fail', () => {
  const result = run(38, (src) => { src.revisedDeliveryDate = src.originalDeliveryDate; });
  assert.equal(result.meta.delayDays, 0);
  assert.match(result.subtitle, /confirmed/);
  assert.throws(() => run(38, (src) => { src.originalDeliveryDate = '2026-09-31'; }), /calendar/);
});
test('Appointment preparation permits a single task and requires real UTC timestamps', () => {
  assert.equal(run(39, (src) => { src.preparation.length = 1; }).meta.taskCount, 1);
  assert.throws(() => run(39, (src) => { src.appointmentAt = '2026-10-06T24:00:00Z'; }), /valid/);
});
test('Return deadline day is allowed and expired authorization cannot reach a render brief', () => {
  assert.equal(run(40, (src) => { src.referenceDate = src.deadline; }).meta.daysRemaining, 0);
  const expired = run(40, (src) => { src.referenceDate = '2026-10-16'; });
  assert.equal(expired.skip, true);
  assert.match(expired.reason, /expired/);
});
test('Employee workdays skip a weekend and preserve the supplied date rather than using today', () => {
  const result = run(41, (src) => { src.startDate = '2026-10-03'; });
  assert.deepEqual(result.meta.workdayDates, ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
  assert.throws(() => run(41, (src) => { src.sessions[0].day = 6; }), /session.day/);
});
test('Adjacent interview sessions have zero break time and unordered sessions are sorted', () => {
  const result = run(42, (src) => { src.sessions[1].startsAt = src.sessions[0].endsAt; src.sessions[1].endsAt = '2026-10-07T10:00:00Z'; src.sessions.reverse(); });
  assert.equal(result.meta.interviewMinutes, 60);
  assert.equal(result.meta.agendaMinutes, 60);
  assert.equal(result.meta.breakMinutes, 0);
});
test('A one-minute course module is accepted and nonnumeric duration is rejected', () => {
  const result = run(43, (src) => { src.modules = [{ ...src.modules[0], minutes: 1 }]; });
  assert.equal(result.meta.totalMinutes, 1);
  assert.throws(() => run(43, (src) => { src.modules[0].minutes = '20'; }), /module.minutes/);
});
test('Safety hazards sort by severity even when the supplied order is reversed', () => {
  assert.deepEqual(run(44, (src) => { src.hazards.reverse(); }).meta.orderedSeverities, ['high', 'medium', 'low']);
  assert.throws(() => run(44, (src) => { src.hazards[0].control = ''; }), /control/);
});
test('Training passes at the threshold and a failed score does not display a certificate', () => {
  assert.equal(run(45, (src) => { src.score = 80; }).meta.passed, true);
  const failed = run(45, (src) => { src.score = 79; });
  assert.equal(failed.meta.passed, false);
  assert.equal(failed.meta.marginPoints, -1);
  assert.equal(failed.cards[3].label, 'RESULT REFERENCE');
  assert.match(failed.cards[3].detail, /does not issue/);
});
test('Meeting actions due today are not overdue; an empty list reports explicit zero-work', () => {
  const today = run(46, (src) => { src.actions = [{ ...src.actions[0], dueDate: src.referenceDate }]; });
  assert.equal(today.meta.overdueCount, 0);
  const empty = run(46, (src) => { src.actions = []; });
  assert.equal(empty.skip, true);
  assert.match(empty.reason, /no meeting actions/);
});
test('Equipment due today is selected; healthy equipment and an empty inventory report zero-work', () => {
  const today = run(47, (src) => { src.referenceDate = '2026-09-24'; src.equipment = [src.equipment[0]]; });
  assert.equal(today.meta.dueCount, 1);
  assert.equal(today.meta.maximumOverdueDays, 0);
  const healthy = run(47, (src) => { src.equipment = [src.equipment[1]]; });
  assert.equal(healthy.skip, true);
  assert.match(healthy.reason, /No equipment/);
  assert.equal(run(47, (src) => { src.equipment = []; }).skip, true);
});
test('Reorder threshold includes equality; healthy stock and empty lists produce zero-work', () => {
  const equality = run(48, (src) => { src.items = [src.items[1]]; });
  assert.equal(equality.meta.totalUnits, 25);
  assert.equal(run(48, (src) => { src.items = [src.items[2]]; }).skip, true);
  assert.equal(run(48, (src) => { src.items = []; }).skip, true);
  assert.throws(() => run(48, (src) => { src.items[1].sku = src.items[0].sku; }), /unique/);
});
test('Dispatch sequences sort and a zero-minute stop has the supplied departure time', () => {
  assert.deepEqual(run(49, (src) => { src.stops.reverse(); }).meta.arrivalTimes, expectations[49].arrivalTimes);
  const result = run(49, (src) => { src.stops = [{ ...src.stops[0], travelMinutes: 0, serviceMinutes: 0 }]; });
  assert.equal(result.meta.totalMinutes, 0);
  assert.equal(result.meta.arrivalTimes[0], '2026-10-02T08:00:00.000Z');
});
test('Tender deadline day is included and expired tenders cannot produce a bid briefing', () => {
  assert.equal(run(50, (src) => { src.referenceDate = src.deadline; }).meta.daysRemaining, 0);
  const expired = run(50, (src) => { src.referenceDate = '2026-10-21'; });
  assert.equal(expired.skip, true);
  assert.match(expired.reason, /passed/);
});
test('Tender cards preserve every synthetic document name before brief normalization', () => {
  const spec=byDay(50),input=copy(spec.sample);
  const raw=new Function('src',spec.transform)(input);
  const eligibility=raw.cards.find(card=>card.label==='ELIGIBILITY'),documents=raw.cards.find(card=>card.label==='DOCUMENTS');
  assert.equal(eligibility.value,'2 checks');
  assert.equal(documents.value,'3 documents to review');
  for(const name of input.documents)assert.ok(documents.detail.includes(name),'Document name must remain visible: '+name);
  for(const card of raw.cards){assert.ok(card.value.length<=80);assert.ok(card.detail.length<=140);}
  assert.match(raw.cards.find(card=>card.label==='FINAL CHECK').detail,/full issuer terms.*document owners\/statuses/);
});
test('Tender owner/status provenance stays complete while long display labels have explicit ellipses', () => {
  const {fixtureFor,prepareSource}=require('../scripts/series-two-source-adapters');
  const fixture=fixtureFor(50,'2026-10-01T12:00:00.000Z');
  for(const row of fixture.details){
    if(row.kind==='document'){row.owner='Responsible procurement coordinator '+row.name+' '.repeat(2)+'verified department '.repeat(20);row.ready=row.position!==2;}
    if(row.kind==='eligibility')row.requirement='Mandatory verified requirement '+row.requirement+' supporting evidence '.repeat(10);
  }
  const before=copy(fixture),prepared=prepareSource(50,fixture.primary,fixture.details,'2026-10-01T12:00:00.000Z');
  assert.equal(prepared.decision,'ready');
  const inputBefore=copy(prepared.input),raw=new Function('src',byDay(50).transform)(prepared.input);
  const documents=raw.cards.find(card=>card.label==='DOCUMENTS'),eligibility=raw.cards.find(card=>card.label==='ELIGIBILITY');
  for(const row of fixture.details.filter(row=>row.kind==='document')){
    assert.ok(documents.detail.includes(row.name));
    assert.ok(!documents.detail.includes(row.owner));
    const source=prepared.context.details.find(detail=>detail.kind==='document'&&detail.position===row.position);
    assert.equal(source.owner,row.owner);assert.equal(source.ready,row.ready);
    assert.ok(prepared.input.documents.some(value=>value.includes(row.owner)&&(row.ready?value.endsWith('(ready)'):value.endsWith('(needed)'))));
  }
  assert.ok(!documents.detail.includes('(ready)'));assert.ok(!documents.detail.includes('(needed)'));
  for(const label of eligibility.detail.split(' • ')){assert.ok(label.length<=40);assert.ok(label.endsWith('…'));}
  for(const card of raw.cards){assert.ok(card.value.length<=80);assert.ok(card.detail.length<=140);}
  const longName=copy(prepared.input);longName.documents[0]='Verified supporting document title '.repeat(5)+' — '+fixture.details.find(row=>row.kind==='document').owner+' (needed)';
  const shortened=new Function('src',byDay(50).transform)(longName).cards.find(card=>card.label==='DOCUMENTS').detail.split(' • ')[0];
  assert.ok(shortened.length<=40);assert.ok(shortened.endsWith('…'));
  assert.deepEqual(prepared.input,inputBefore);assert.deepEqual(fixture,before);
});
test('Travel days and activities sort and preserve destination-local midnight', () => {
  assert.deepEqual(run(51, (src) => { src.days.reverse(); src.days[1].activities.reverse(); }).meta.orderedTimes, expectations[51].orderedTimes);
  assert.equal(run(51, (src) => { src.days[0].activities[0].time = '00:00'; }).meta.orderedTimes[0][0], '00:00');
  assert.throws(() => run(51, (src) => { src.days[1].date = src.days[0].date; }), /unique/);
});
test('Arrival guides support midnight check-in and an explicitly empty amenity list', () => {
  const result = run(52, (src) => { src.checkInTime = '00:00'; src.amenities = []; });
  assert.equal(result.meta.checkInTime, '00:00');
  assert.equal(result.meta.amenityCount, 0);
  assert.match(result.cards.at(-1).value, /Ask reception/);
});
test('Adoption profiles reject credentials embedded in URLs and retain a valid HTTPS CTA', () => {
  assert.equal(run(53).cards[2].value, 'https://example.com/adopt/milo-demo');
  assert.throws(() => run(53, (src) => { src.adoptionUrl = 'https://name:secret@example.com/adopt'; }), /without credentials/);
  assert.throws(() => run(53, (src) => { src.careNeeds = []; }), /careNeeds/);
});
test('Adoption URL validation is portable without the URL global and supports canonical HTTPS authorities', () => {
  const spec = byDay(53);
  const portableTransform = new Function('src', 'URL', spec.transform);
  for (const url of ['https://example.com/adopt?campaign=demo#apply', 'HTTPS://example.com:443/adopt', 'https://example.com:8443/adopt', 'https://127.0.0.1/adopt', 'https://[2001:db8::1]/adopt', 'https://[::ffff:192.0.2.1]:443/adopt', 'https://example%2Ecom/adopt', 'https://xn--bcher-kva.example/adopt', 'https://bücher.example/adopt']) {
    const input = { ...copy(spec.sample), adoptionUrl: url };
    assert.equal(portableTransform(input, undefined).meta.adoptionUrl, url);
  }
  for (const url of ['https:///adopt', 'https://', '//example.com/adopt', 'javascript:alert(1)', 'ftp://example.com/adopt', 'https://user@example.com/adopt', 'https://user:pass@example.com/adopt', 'https://example.com:65536/adopt', 'https://example.com:abc/adopt', 'https://[:::]/adopt', 'https://[2001:db8:1]/adopt', 'https://[::ffff:999.0.0.1]/adopt', 'https://256.0.0.1/adopt', 'https://example.com\\other/adopt', 'https://exa mple.com/adopt', 'https://example..com/adopt', 'https://%40example.com/adopt']) {
    const input = { ...copy(spec.sample), adoptionUrl: url };
    assert.throws(() => portableTransform(input, undefined), Error, 'Reject malformed HTTPS authority');
  }
});
test('Repeated volunteer assignments do not inflate unique volunteer or station coverage counts', () => {
  const result = run(54, (src) => { src.assignments.push({ ...src.assignments[0], task: 'Hand out a second information sheet.' }); });
  assert.equal(result.meta.volunteerCount, 3);
  assert.equal(result.meta.stationCoverage['Welcome desk'], 2);
});
test('Donation impact rounds down whole units and labels a sub-unit contribution as zero estimated units', () => {
  const result = run(55, (src) => { src.amount = 5; });
  assert.equal(result.meta.impactUnits, 0);
  assert.equal(result.meta.remainder, 5);
  assert.match(result.cards[1].detail, /estimate/);
  assert.throws(() => run(55, (src) => { src.amount = 0; }), /amount/);
});
test('Survey ties remain ties and zero votes return an explicit zero-work result', () => {
  const tied = run(56, (src) => { src.options = [{ label: 'A', votes: 1 }, { label: 'B', votes: 1 }]; });
  assert.deepEqual(tied.meta.winners, ['A', 'B']);
  assert.deepEqual(tied.meta.percentages, { A: 50, B: 50 });
  assert.equal(tied.cards.at(-1).label, 'TIED LEAD');
  const empty = run(56, (src) => { src.options.forEach((item) => { item.votes = 0; }); });
  assert.equal(empty.skip, true);
  assert.match(empty.reason, /zero votes/);
  assert.throws(() => run(56, (src) => { src.options[1].label = src.options[0].label; }), /unique/);
});
test('Fundraising preserves over-goal totals and supports a campaign with zero contributions', () => {
  const over = run(57, (src) => { src.contributions = [{ amount: 1200 }]; });
  assert.deepEqual(over.meta, { raised: 1200, remaining: 0, excess: 200, progressPercent: 120, reached: true });
  const exact = run(57, (src) => { src.contributions = [{ amount: 1000 }]; });
  assert.equal(exact.meta.reached, true);
  assert.equal(exact.meta.excess, 0);
  const zero = run(57, (src) => { src.contributions = []; });
  assert.deepEqual(zero.meta, { raised: 0, remaining: 1000, excess: 0, progressPercent: 0, reached: false });
});
test('Before-and-after calculations handle zero baselines, unchanged values and a worse result', () => {
  const zero = run(58, (src) => { src.metrics = [{ ...src.metrics[1], before: 0, after: 10 }]; });
  assert.equal(zero.meta.changes[0].percentageChange, null);
  assert.equal(zero.meta.changes[0].improved, true);
  const unchanged = run(58, (src) => { src.metrics[0].after = src.metrics[0].before; });
  assert.equal(unchanged.meta.changes[0].improved, false);
  const worse = run(58, (src) => { src.metrics[0].after = 50; });
  assert.equal(worse.meta.changes[0].improved, false);
  assert.equal(worse.meta.changes[0].percentageChange, 25);
});
test('Completed milestones have no next task or overdue count, even with past due dates', () => {
  const result = run(59, (src) => { src.milestones.forEach((item) => { item.status = 'complete'; }); src.milestones.reverse(); });
  assert.equal(result.meta.completionPercent, 100);
  assert.equal(result.meta.overdueCount, 0);
  assert.equal(result.meta.nextMilestone, null);
  const today = run(59, (src) => { src.milestones = [{ ...src.milestones[1], dueDate: src.referenceDate }]; });
  assert.equal(today.meta.overdueCount, 0);
});
test('Recipe quantities support downscaling while cooking times remain the original instructions', () => {
  const result = run(60, (src) => { src.targetServings = 1; });
  assert.equal(result.meta.scaleFactor, 0.5);
  assert.equal(result.meta.scaledIngredients[0].quantity, 100);
  assert.equal(result.meta.scaledIngredients[2].quantity, 0.5);
  assert.match(result.footer, /does not automatically scale cooking times/);
  assert.throws(() => run(60, (src) => { src.ingredients[0].quantity = Infinity; }), /quantity/);
});

test('Cooking cards preserve complete source instructions as details with accurate step progress', () => {
  const spec = byDay(60), input = copy(spec.sample);
  input.steps = [...input.steps, 'Cook for the full recipe’s original 20 minutes.', 'Check doneness as directed by the complete recipe.'];
  const original = copy(input), result = runTransform(spec, input), cookingCards = result.cards.slice(1);
  assert.deepEqual(cookingCards.map((card) => card.label), ['COOK 1', 'COOK 2', 'COOK 3', 'COOK 4']);
  assert.deepEqual(cookingCards.map((card) => card.value), ['Step 1 of 5', 'Step 2 of 5', 'Step 3 of 5', 'Step 4 of 5']);
  assert.deepEqual(cookingCards.map((card) => card.detail), original.steps.slice(0, 4));
  assert.equal(cookingCards[3].detail, 'Cook for the full recipe’s original 20 minutes.');
  assert.equal(result.meta.stepCount, 5);
  assert.deepEqual(input, original);
  assert.match(result.footer, /does not automatically scale cooking times/);
  const sample = run(60).cards.slice(1);
  assert.deepEqual(sample.map((card) => card.value), ['Step 1 of 3', 'Step 2 of 3', 'Step 3 of 3']);
  assert.deepEqual(sample.map((card) => card.detail), spec.sample.steps);
});

test('Every numeric transform rejects unsafe nonfinite, boolean and string numeric inputs', () => {
  const paths = [
    [36, ['items', 0, 'quantity']], [37, ['bundlePrice']], [41, ['sessions', 0, 'day']],
    [43, ['modules', 0, 'minutes']], [45, ['score']], [47, ['equipment', 0, 'intervalDays']],
    [48, ['items', 0, 'onHand']], [49, ['stops', 0, 'travelMinutes']], [55, ['amount']],
    [56, ['options', 0, 'votes']], [57, ['goal']], [58, ['metrics', 0, 'before']], [60, ['targetServings']],
  ];
  for (const [day, keys] of paths) {
    for (const invalid of [NaN, Infinity, -Infinity, true, '1', null]) {
      const spec = byDay(day), input = copy(spec.sample);
      let target = input;
      for (const key of keys.slice(0, -1)) target = target[key];
      target[keys.at(-1)] = invalid;
      assert.throws(() => runTransform(spec, input), Error, `Day ${day} must reject ${String(invalid)}`);
    }
  }
});

test('Date calculations reject implicit local time, invalid calendar days and locale date strings', () => {
  for (const value of ['2026-02-30', '01/10/2026', '2026-10-01T00:00:00Z']) {
    assert.throws(() => run(40, (src) => { src.referenceDate = value; }), Error);
  }
  for (const value of ['2026-10-01T08:00:00', '2026-10-01T08:00:00+00:00', '2026-10-01T24:00:00Z', '2026-02-30T08:00:00Z']) {
    assert.throws(() => run(34, (src) => { src.startedAt = value; }), Error);
  }
});
