'use strict';

// Each transform is self-contained so the generator can embed the exact body
// in an n8n Code node without importing local modules.
function validationHelpers() {
  const DAY = 86400000;
  function text(value, label, max = 2000) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a nonempty string`);
    const clean = value.trim();
    if (clean.length > max) throw new Error(`${label} exceeds ${max} characters`);
    return clean;
  }
  function number(value, label, min = 0, max = 1e12, integer = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new Error(`${label} must be ${integer ? 'an integer' : 'a finite number'} between ${min} and ${max}`);
    }
    return value;
  }
  function array(value, label, min = 1, max = 100) {
    if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`${label} must contain ${min} to ${max} items`);
    return value;
  }
  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
    return value;
  }
  function choice(value, label, options) {
    const clean = text(value, label, 100);
    if (!options.includes(clean)) throw new Error(`${label} must be one of ${options.join(', ')}`);
    return clean;
  }
  function date(value, label) {
    const clean = text(value, label, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) throw new Error(`${label} must be an ISO date YYYY-MM-DD`);
    const result = Date.parse(`${clean}T00:00:00Z`);
    if (!Number.isFinite(result) || new Date(result).toISOString().slice(0, 10) !== clean) throw new Error(`${label} is not a valid calendar date`);
    return result;
  }
  function instant(value, label) {
    const clean = text(value, label, 30);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(clean)) throw new Error(`${label} must be an ISO timestamp with seconds and UTC Z`);
    const result = Date.parse(clean);
    if (!Number.isFinite(result) || new Date(result).toISOString().slice(0, 19) !== clean.slice(0, 19)) throw new Error(`${label} is not a valid UTC timestamp`);
    return result;
  }
  function dateText(value) { return new Date(value).toISOString().slice(0, 10); }
  function timeText(value) { return new Date(value).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; }
  function currency(value) {
    const clean = text(value, 'currency', 3);
    if (!/^[A-Z]{3}$/.test(clean)) throw new Error('currency must be a three-letter uppercase code');
    return clean;
  }
  function cents(value, label, min = 0) {
    number(value, label, min, 1e10);
    const scaled = value * 100;
    if (Math.abs(scaled - Math.round(scaled)) > 0.00001) throw new Error(`${label} must have at most two decimal places`);
    return Math.round(scaled);
  }
  function amount(value, code) { return `${code} ${(value / 100).toFixed(2)}`; }
  function sum(values, label = 'total') { return number(values.reduce((total, value) => total + value, 0), label, 0, 1e15); }
  function percent(value) { return Math.round(value * 10) / 10; }
  function url(value, label) {
    const clean = text(value, label, 2000);
    // n8n's Code sandbox does not guarantee the WHATWG URL global. Validate
    // an absolute HTTPS authority without importing any builtin modules.
    const match = /^https:\/\/([^/?#]+)(?:[/?#].*)?$/i.exec(clean);
    if (!match || /[\s\\\u0000-\u001f\u007f]/.test(clean)) throw new Error(`${label} must be an absolute HTTPS URL`);
    const authority = match[1];
    if (authority.includes('@')) throw new Error(`${label} must be an absolute HTTPS URL without credentials`);
    let host, port;
    if (authority.startsWith('[')) {
      const bracket = /^\[([^\]]+)\](?::(\d+))?$/.exec(authority);
      if (!bracket) throw new Error(`${label} has an invalid HTTPS host`);
      host = bracket[1]; port = bracket[2];
      const pieces = host.split('::');
      if (pieces.length > 2) throw new Error(`${label} has an invalid IPv6 host`);
      const groups = pieces.flatMap((part) => part ? part.split(':') : []);
      if (groups.length && groups.at(-1).includes('.')) {
        const ipv4 = groups.pop().split('.');
        if (ipv4.length !== 4 || ipv4.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) throw new Error(`${label} has an invalid IPv6 host`);
        groups.push('0', '0');
      }
      if (groups.some((group) => !/^[a-f\d]{1,4}$/i.test(group)) || (pieces.length === 1 ? groups.length !== 8 : groups.length >= 8)) throw new Error(`${label} has an invalid IPv6 host`);
    } else {
      const normal = /^([^:]+)(?::(\d+))?$/.exec(authority);
      if (!normal) throw new Error(`${label} has an invalid HTTPS host`);
      try { host = decodeURIComponent(normal[1]); } catch { throw new Error(`${label} has an invalid HTTPS host`); }
      port = normal[2];
      if (!host || /[\s\/@\[\]?#:\\]/.test(host) || !/^[\p{L}\p{N}_.-]+$/u.test(host) || host.replace(/\.$/, '').split('.').some((part) => !part || part.startsWith('-') || part.endsWith('-'))) throw new Error(`${label} has an invalid HTTPS host`);
      if (/^[\d.]+$/.test(host)) {
        const ipv4 = host.split('.');
        if (ipv4.length !== 4 || ipv4.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) throw new Error(`${label} has an invalid IPv4 host`);
      }
    }
    if (port !== undefined && (port.length > 5 || Number(port) > 65535)) throw new Error(`${label} has an invalid HTTPS port`);
    return clean;
  }
  function strings(value, label, min = 1, max = 100) { return array(value, label, min, max).map((item, i) => text(item, `${label}[${i}]`)); }
  function card(label, value, detail = '') { return { label: String(label), value: String(value), detail: String(detail) }; }
  function out(title, subtitle, cards, footer, sourceKey, meta) {
    return { title, subtitle, cards: cards.slice(0, 5), footer, sourceKey, meta };
  }
  return { DAY, text, number, array, object, choice, date, instant, dateText, timeText, currency, cents, amount, sum, percent, url, strings, card, out };
}

const helperBody = `const u = (${validationHelpers.toString()})();\nu.object(src, 'input');\n`;
const businessRules = {
  31: 'Each change requires type added, improved or fixed plus nonempty title and detail. The video contains one card per populated change category and displays at most two examples per category; category counts include every supplied change.',
  32: 'Supply at least two steps with title and instruction. The video displays the first four steps and the expected outcome; longer procedures require viewers to use the full source instructions. Reading-time metadata estimates three words per second, with a three-second minimum per step; configured sceneSeconds controls the actual video timing.',
  33: 'Supply two to four plans with distinct names, a price string and a nonempty feature array. Repeated features within one plan are deduplicated. Common features must appear in every plan; a unique feature must occur in only one plan. Prices remain exactly the supplied wording; the workflow does not fetch or verify commercial terms.',
  34: 'startedAt, resolvedAt and each event.at must be exact ISO UTC timestamps with seconds and Z, for example 2026-10-01T08:00:00Z. Events must fall inside the incident window; resolvedAt cannot precede startedAt. Events are sorted chronologically. The first three updates and final update are shown when there are more than four; duration metadata includes the full window.',
  35: 'startsAt, endsAt and referenceDate must be exact ISO UTC timestamps with seconds and Z. The window must have a positive duration. A reference at or after the end returns nothing_to_render; a reference inside the window shows maintenance in progress and zero hours until start. Up to four affected feature names are displayed. No system maintenance is executed.',
  36: 'status must be received, processing, shipped, out_for_delivery or delivered. estimatedDelivery must be YYYY-MM-DD. Each item requires a name and integer quantity from 1 to 1,000,000. The total includes every item; up to three item names are displayed. Delivered orders show completion instead of a future delivery promise. Unsupported statuses, including cancellation, fail validation.',
  37: 'Supply at least two named components. Prices and bundlePrice must be nonnegative numeric JSON values with at most two decimal places; the separate-product total must be positive. currency must be a three-letter uppercase code. Integer-cent calculations preserve accurate totals. A bundle above the regular total is explicitly labeled a surcharge and claims zero savings; an equal price claims zero savings. Up to three component names are shown.',
  38: 'Both delivery estimates must be real YYYY-MM-DD dates. A revised date before the original fails validation; an equal date is an unchanged estimate with zero delay. reason and nextStep are supplied statements, not generated promises. Delay days use UTC calendar dates.',
  39: 'appointmentAt must be an exact ISO UTC timestamp with seconds and Z. Supply at least one preparation instruction. The video displays the appointment and first four preparation tasks; longer checklists remain in the booking details. This workflow creates the video only and does not send appointment reminders.',
  40: 'deadline and referenceDate must be real YYYY-MM-DD dates. An expired deadline returns nothing_to_render; the deadline day itself is eligible. Supply nonempty items and steps arrays. The video displays up to three item names and the first three steps, with a reminder to consult the complete return instructions when needed. It does not authorize a return or change the deadline.',
  41: 'startDate must be YYYY-MM-DD. Each session requires an integer day from 1 to 5, title and location. Workday dates are the next five Monday–Friday dates starting on or after startDate; a weekend start advances to Monday. Local holidays and other workweeks are not inferred. Sessions group by day; up to two titles and locations are shown for each day.',
  42: 'Each session requires ISO UTC startsAt and endsAt timestamps with seconds and Z plus topic and interviewer. Sessions must have positive duration and may touch but cannot overlap. Sorting occurs before overlap checks. Interview duration excludes breaks; agenda span includes them. The video displays the first four sessions plus a duration summary.',
  43: 'Each module requires title, outcome and integer minutes from 1 to 10,000. All module durations contribute to the course total. The first four module outcomes and total duration are displayed; the complete syllabus remains the course reference.',
  44: 'Each hazard requires title, control and severity high, medium or low. Hazards are sorted in that priority order; the first four and the supplied emergencyInstruction are displayed. The workflow summarizes approved source instructions and does not generate or certify site safety procedures.',
  45: 'completedAt must be YYYY-MM-DD; score and passingScore must be numeric JSON values from 0 to 100. A score equal to the threshold passes. A failing result uses a result reference and explicitly does not issue a certificate. certificateId is an existing source-system reference; this workflow creates no qualifications or credentials.',
  46: 'referenceDate and every dueDate must be YYYY-MM-DD. Each action requires task and owner. Due today is not overdue; earlier dates are. Empty actions return nothing_to_render. Tasks sort by deadline and group by owner; the first four owners and two earliest tasks per owner are shown. Owner counts and overdue metadata include every supplied action.',
  47: 'referenceDate and lastServicedAt must be YYYY-MM-DD; last service cannot occur after the reference. intervalDays must be an integer from 1 to 36,500. Next-service dates equal last service plus the interval. Due today is selected with zero overdue days; older due dates sort first. No due equipment, including an empty equipment array, returns nothing_to_render. Up to four due assets are displayed. No equipment operation or maintenance action is performed.',
  48: 'Each stock item requires a unique sku, name and integer onHand, reorderPoint and targetStock from 0 to 1,000,000,000. targetStock must exceed reorderPoint. Stock at or below the reorder threshold is selected; replenishment quantity is targetStock minus onHand. Healthy or empty inventory returns nothing_to_render. Totals include all selected items; up to four items are displayed. No purchase order is created.',
  49: 'departureAt must be an exact ISO UTC timestamp with seconds and Z. Stop sequence must be a unique positive integer; travelMinutes and serviceMinutes are nonnegative numeric durations up to 1,440 each. Stops sort by sequence. Arrival estimates accumulate supplied travel and prior service time; the route duration includes final service. The first four stops and total are shown. This workflow does not calculate routes or fetch live traffic.',
  50: 'deadline and referenceDate must be YYYY-MM-DD. An expired tender returns nothing_to_render; the deadline day is eligible. Supply nonempty eligibility and documents arrays. The brief shows counts and up to three labels per group, each capped at 40 characters with an explicit ellipsis. Document labels omit the owner/status suffix after " — "; keep the full owners and statuses in the authoritative source and context. Consult the complete issuer terms and document checklist. It does not verify eligibility or submit bids.',
  51: 'Each trip day requires a distinct YYYY-MM-DD date and at least one activity with 24-hour HH:MM time, title and location. Days and activities sort chronologically. Activity times remain destination-local as supplied; no timezone conversion is inferred. The first four days and two activities per day are shown, while metadata counts all activities.',
  52: 'checkInTime must be 24-hour HH:MM local time. Supply property, address and at least one arrival step; amenities may be an explicitly empty array. The video shows the first three steps and first three amenities. Supply public arrival information only; keep private access codes and guest credentials in the booking confirmation. Check-in availability is not independently verified.',
  53: 'Supply name, species and age strings plus nonempty traits and careNeeds arrays. adoptionUrl must be an absolute HTTPS URL without embedded username/password credentials. The video displays the first three traits and care needs and the supplied adoption link. It does not verify availability, process an application or claim medical or behavioral suitability.',
  54: 'startsAt and endsAt must be exact ISO UTC timestamps with seconds and Z, with a positive shift duration. Each assignment requires person, station and task. Volunteer totals count distinct supplied names, and coverage counts distinct names per station. Up to four stations and two task examples per station are displayed. Complete coordinator instructions remain the source of truth.',
  55: 'amount and unitCost must be positive numeric JSON amounts with at most two decimal places; currency is a three-letter uppercase code. Whole estimated impact units use floor(amount / unitCost), with the remainder shown separately. Contributions smaller than one unit show zero estimated whole units. The impact calculation is an estimate rather than proof of delivery, a donation receipt or a tax statement.',
  56: 'Supply at least two options with unique labels and nonnegative integer votes up to 1,000,000,000. Zero total votes returns nothing_to_render. Options rank by votes; ties remain ties. Percentages are independently rounded to one decimal and may not total exactly 100%. The first four options and up to three tied leader names are displayed; metadata contains all leaders.',
  57: 'goal must be positive; contributions may be empty or zero-valued. Monetary values are numeric JSON amounts with at most two decimal places, and currency is a three-letter uppercase code. Integer-cent totals include every supplied contribution. Progress may exceed 100%; remaining is never negative and excess is shown when above goal. An empty campaign is a valid zero-progress video rather than a skipped run.',
  58: 'Each metric requires name, nonnegative numeric before and after values, unit and direction higher or lower. Metric names must be unique. Absolute change is after minus before; a zero before value produces null percentageChange instead of division by zero. Unchanged metrics are not counted as improved. The first four metrics and overall count are shown. Differences do not prove causation.',
  59: 'referenceDate and dueDate must be YYYY-MM-DD. status must be planned, in_progress or complete. Milestones sort by date. Due today is not overdue; incomplete work with earlier dates is overdue. Completion is based on milestone count, not weighted effort. The next milestone is the earliest unfinished item, including overdue work; all complete means no next milestone. The first four milestones and summary are shown.',
  60: 'baseServings and targetServings must be integers from 1 to 1,000. Each ingredient requires name, positive numeric quantity and unit. Quantities scale by target/base and round to six decimals. The video lists up to four ingredients and the first four cooking steps. Each cooking card shows its position out of all supplied steps and keeps the original instruction in its detail text; metadata retains all scaled quantities. Scaling ingredients never automatically changes cooking times or temperatures; use the full recipe.',
};
function spec(day, slug, title, description, fields, sample, transform) {
  const limits = ' Required text must be nonempty and at most 2,000 characters unless a field has a narrower format. Most input arrays allow up to 100 records; display cards and text are bounded separately. Calculations use all validated input records. Numeric values must be JSON numbers, not numeric strings. This workflow renders a brief and performs no external messaging or publication.';
  return { day, slug, title, description, fields, sample, rules: businessRules[day] + limits, transform: helperBody + `return (${transform.toString()})(src);` };
}

module.exports = [
  spec(31, 'release-notes-video', 'Release notes to a feature announcement video',
    'Turn structured product release notes into a video grouped by added, improved and fixed changes.',
    ['product', 'version', 'changes'],
    { product: 'Acme Desk', version: '2.4', changes: [
      { type: 'added', title: 'Shared inbox', detail: 'Assign customer conversations to a team.' },
      { type: 'improved', title: 'Faster search', detail: 'Find past conversations with clearer filters.' },
      { type: 'fixed', title: 'Export dates', detail: 'CSV exports now keep UTC dates consistent.' },
    ] },
    (src) => {
      const product = u.text(src.product, 'product'), version = u.text(src.version, 'version', 60);
      const changes = u.array(src.changes, 'changes').map((item, i) => {
        u.object(item, `changes[${i}]`);
        return { type: u.choice(item.type, 'change.type', ['added', 'improved', 'fixed']), title: u.text(item.title, 'change.title'), detail: u.text(item.detail, 'change.detail') };
      });
      const counts = Object.fromEntries(['added', 'improved', 'fixed'].map((type) => [type, changes.filter((item) => item.type === type).length]));
      const cards = ['added', 'improved', 'fixed'].filter((type) => counts[type]).map((type) => {
        const group = changes.filter((item) => item.type === type);
        return u.card(type.toUpperCase(), `${counts[type]} ${type === 'fixed' ? (counts[type] === 1 ? 'fix' : 'fixes') : (counts[type] === 1 ? 'change' : 'changes')}`, group.slice(0, 2).map((item) => `${item.title}: ${item.detail}`).join(' • '));
      });
      return u.out(`${product} ${version}`, `${changes.length} release ${changes.length === 1 ? 'change' : 'changes'}`, cards, 'Explore the latest release', `${product}:${version}`, { changeCount: changes.length, counts });
    }),

  spec(32, 'procedure-tutorial-video', 'A procedure to a step-by-step tutorial video',
    'Number validated instructions and show the expected outcome of a practical procedure.',
    ['title', 'steps', 'outcome'],
    { title: 'Set up a shared workspace', steps: [
      { title: 'Create the workspace', instruction: 'Choose a workspace name and select Create.' },
      { title: 'Invite your team', instruction: 'Add teammates from the Members page.' },
      { title: 'Choose a project', instruction: 'Create your first project and assign its owner.' },
    ], outcome: 'Your team has a workspace and an owned project.' },
    (src) => {
      const title = u.text(src.title, 'title'), outcome = u.text(src.outcome, 'outcome');
      const steps = u.array(src.steps, 'steps', 2).map((item, i) => {
        u.object(item, `steps[${i}]`);
        const instruction = u.text(item.instruction, 'step.instruction');
        return { title: u.text(item.title, 'step.title'), instruction, readingSeconds: Math.max(3, Math.ceil(instruction.split(/\s+/).length / 3)) };
      });
      const visible = steps.slice(0, 4);
      const cards = visible.map((item, i) => u.card(`STEP ${i + 1}`, item.title, item.instruction));
      cards.push(u.card('EXPECTED RESULT', outcome, steps.length > visible.length ? `${steps.length - visible.length} additional steps remain in the source instructions.` : 'Follow the steps in order.'));
      return u.out(title, `${steps.length} ordered steps`, cards, 'Use the full source procedure for every step', title, { stepCount: steps.length, readingSeconds: u.sum(steps.map((step) => step.readingSeconds)) });
    }),

  spec(33, 'plan-comparison-video', 'Pricing plans to a feature comparison video',
    'Compare supplied plan prices and separate shared features from features unique to each plan.',
    ['product', 'plans'],
    { product: 'Acme Desk', plans: [
      { name: 'Starter', price: 'USD 12 / month', features: ['Shared inbox', 'Email support'] },
      { name: 'Team', price: 'USD 29 / month', features: ['Shared inbox', 'Email support', 'Team analytics'] },
      { name: 'Scale', price: 'USD 59 / month', features: ['Shared inbox', 'Email support', 'Dedicated onboarding'] },
    ] },
    (src) => {
      const product = u.text(src.product, 'product');
      const plans = u.array(src.plans, 'plans', 2, 4).map((item, i) => {
        u.object(item, `plans[${i}]`);
        return { name: u.text(item.name, 'plan.name'), price: u.text(item.price, 'plan.price'), features: [...new Set(u.strings(item.features, 'plan.features'))] };
      });
      if (new Set(plans.map((item) => item.name)).size !== plans.length) throw new Error('plan names must be unique');
      const commonFeatures = plans[0].features.filter((feature) => plans.every((plan) => plan.features.includes(feature)));
      const uniqueFeatures = Object.fromEntries(plans.map((plan) => [plan.name, plan.features.filter((feature) => plans.filter((other) => other !== plan).every((other) => !other.features.includes(feature)))]));
      const cards = plans.map((plan) => u.card(plan.name, plan.price, uniqueFeatures[plan.name].length ? `Unique: ${uniqueFeatures[plan.name].join(' • ')}` : `Included: ${plan.features.join(' • ')}`));
      cards.push(u.card('ALL PLANS INCLUDE', commonFeatures.length ? commonFeatures.join(' • ') : 'No common features supplied', 'Prices and features are supplied by your team.'));
      return u.out(`${product}: choose your plan`, `${plans.length} plans compared`, cards, 'Confirm current terms before purchase', product, { planCount: plans.length, commonFeatures, uniqueFeatures });
    }),

  spec(34, 'incident-timeline-video', 'A service incident to a status timeline video',
    'Sort supplied incident events and calculate the actual UTC resolution duration.',
    ['service', 'startedAt', 'resolvedAt', 'events'],
    { service: 'Acme File Sync', startedAt: '2026-10-01T08:00:00Z', resolvedAt: '2026-10-01T09:15:00Z', events: [
      { at: '2026-10-01T08:00:00Z', status: 'Investigating', detail: 'Some file sync requests are delayed.' },
      { at: '2026-10-01T08:30:00Z', status: 'Mitigating', detail: 'Traffic is moving to healthy workers.' },
      { at: '2026-10-01T09:15:00Z', status: 'Resolved', detail: 'File sync is operating normally.' },
    ] },
    (src) => {
      const service = u.text(src.service, 'service'), started = u.instant(src.startedAt, 'startedAt'), resolved = u.instant(src.resolvedAt, 'resolvedAt');
      if (resolved < started) throw new Error('resolvedAt cannot precede startedAt');
      const events = u.array(src.events, 'events').map((item, i) => {
        u.object(item, `events[${i}]`);
        const at = u.instant(item.at, 'event.at');
        if (at < started || at > resolved) throw new Error('event timestamps must fall within the incident');
        return { at, status: u.text(item.status, 'event.status'), detail: u.text(item.detail, 'event.detail') };
      }).sort((a, b) => a.at - b.at);
      const minutes = (resolved - started) / 60000;
      const visible = events.length <= 4 ? events : [...events.slice(0, 3), events.at(-1)];
      const cards = visible.map((event) => u.card(u.timeText(event.at), event.status, event.detail));
      cards.push(u.card('RESOLUTION TIME', `${u.percent(minutes)} minutes`, `${u.timeText(started)} to ${u.timeText(resolved)}`));
      return u.out(`${service}: incident timeline`, `${events.length} status updates`, cards, `Final update: ${events.at(-1).status}`, `${service}:${src.startedAt}`, { durationMinutes: minutes, eventCount: events.length, finalStatus: events.at(-1).status });
    }),

  spec(35, 'maintenance-notice-video', 'A maintenance window to a customer notice video',
    'Calculate the maintenance duration and time until it starts, using an explicit UTC reference timestamp.',
    ['service', 'startsAt', 'endsAt', 'affectedFeatures', 'referenceDate'],
    { service: 'Acme Desk', startsAt: '2026-10-03T01:00:00Z', endsAt: '2026-10-03T02:30:00Z', affectedFeatures: ['Report exports', 'Workspace analytics'], referenceDate: '2026-10-01T01:00:00Z' },
    (src) => {
      const service = u.text(src.service, 'service'), start = u.instant(src.startsAt, 'startsAt'), end = u.instant(src.endsAt, 'endsAt'), reference = u.instant(src.referenceDate, 'referenceDate');
      const features = u.strings(src.affectedFeatures, 'affectedFeatures');
      if (end <= start) throw new Error('endsAt must be after startsAt');
      if (reference >= end) return { skip: true, reason: 'The maintenance window has already ended.' };
      const durationMinutes = (end - start) / 60000, hoursUntilStart = Math.max(0, (start - reference) / 3600000);
      return u.out(`${service}: maintenance notice`, reference >= start ? 'Maintenance is in progress' : `Starts in ${u.percent(hoursUntilStart)} hours`, [
        u.card('WINDOW', `${u.timeText(start)} to ${u.timeText(end)}`, 'All times shown in UTC.'),
        u.card('DURATION', `${u.percent(durationMinutes)} minutes`, 'Plan around the stated service window.'),
        u.card('AFFECTED FEATURES', features.slice(0, 4).join(' • '), `${features.length} features listed in the source notice.`),
      ], 'Check your service status page for updates', `${service}:${src.startsAt}`, { durationMinutes, hoursUntilStart, inProgress: reference >= start });
    }),

  spec(36, 'order-progress-video', 'An order status to a fulfillment progress video',
    'Map a validated order status to completed, current and next fulfillment stages.',
    ['orderNumber', 'status', 'estimatedDelivery', 'items'],
    { orderNumber: 'DEMO-1042', status: 'shipped', estimatedDelivery: '2026-10-05', items: [{ name: 'Desk organizer', quantity: 2 }, { name: 'Notebook', quantity: 1 }] },
    (src) => {
      const order = u.text(src.orderNumber, 'orderNumber'), stages = ['received', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
      const status = u.choice(src.status, 'status', stages), estimated = u.date(src.estimatedDelivery, 'estimatedDelivery');
      const items = u.array(src.items, 'items').map((item, i) => { u.object(item, `items[${i}]`); return { name: u.text(item.name, 'item.name'), quantity: u.number(item.quantity, 'item.quantity', 1, 1e6, true) }; });
      const index = stages.indexOf(status), totalQuantity = u.sum(items.map((item) => item.quantity)), nextStage = stages[index + 1] || null;
      return u.out(`Order ${order}`, status.replace(/_/g, ' ').toUpperCase(), [
        u.card('CURRENT STAGE', status.replace(/_/g, ' '), `${index} earlier fulfillment stages complete.`),
        u.card('YOUR ITEMS', `${totalQuantity} ${totalQuantity === 1 ? 'item' : 'items'}`, items.slice(0, 3).map((item) => `${item.quantity} × ${item.name}`).join(' • ')),
        u.card(status === 'delivered' ? 'DELIVERY STATUS' : 'ESTIMATED DELIVERY', status === 'delivered' ? 'Delivered' : u.dateText(estimated), status === 'delivered' ? 'The estimated date is no longer a future promise.' : 'This date is the supplied estimate.'),
        u.card('NEXT', nextStage ? nextStage.replace(/_/g, ' ') : 'All stages complete', nextStage ? 'Track your order for the next update.' : 'Thank you for your order.'),
      ], 'Keep your order number for support', order, { status, completedStageCount: index, nextStage, totalQuantity });
    }),

  spec(37, 'product-bundle-savings-video', 'Product components to a bundle savings explainer video',
    'Calculate the regular component total, bundle price and accurate savings using integer cents.',
    ['product', 'components', 'bundlePrice', 'currency'],
    { product: 'Workspace starter bundle', components: [{ name: 'Desk mat', price: 24 }, { name: 'Organizer', price: 18 }, { name: 'Notebook', price: 8 }], bundlePrice: 40, currency: 'USD' },
    (src) => {
      const product = u.text(src.product, 'product'), currency = u.currency(src.currency);
      const components = u.array(src.components, 'components', 2).map((item, i) => { u.object(item, `components[${i}]`); return { name: u.text(item.name, 'component.name'), cents: u.cents(item.price, 'component.price') }; });
      const regularCents = u.sum(components.map((item) => item.cents)), bundleCents = u.cents(src.bundlePrice, 'bundlePrice');
      if (regularCents === 0) throw new Error('the regular component total must be positive');
      const difference = regularCents - bundleCents, savingsCents = Math.max(0, difference), surchargeCents = Math.max(0, -difference), savingsPercent = u.percent(savingsCents / regularCents * 100);
      return u.out(product, `${components.length} products in one bundle`, [
        u.card('INCLUDED', components.slice(0, 3).map((item) => item.name).join(' • '), `${components.length} component products.`),
        u.card('BOUGHT SEPARATELY', u.amount(regularCents, currency), 'Sum of the supplied component prices.'),
        u.card('BUNDLE PRICE', u.amount(bundleCents, currency), 'The supplied bundle price.'),
        u.card(surchargeCents ? 'PRICE DIFFERENCE' : 'YOU SAVE', surchargeCents ? `${u.amount(surchargeCents, currency)} more` : u.amount(savingsCents, currency), surchargeCents ? 'This bundle costs more than the listed components; no savings claim applies.' : `${savingsPercent}% below the separate-product total.`),
      ], 'Review bundle details and current prices', product, { regularTotal: regularCents / 100, bundlePrice: bundleCents / 100, savings: savingsCents / 100, surcharge: surchargeCents / 100, savingsPercent });
    }),

  spec(38, 'delivery-delay-video', 'A delivery delay to a revised ETA video',
    'Calculate a real delay from original and revised UTC dates and explain the supplied next step.',
    ['orderNumber', 'originalDeliveryDate', 'revisedDeliveryDate', 'reason', 'nextStep'],
    { orderNumber: 'DEMO-1042', originalDeliveryDate: '2026-10-03', revisedDeliveryDate: '2026-10-05', reason: 'A carrier sorting delay affected this shipment.', nextStep: 'Check tracking for the next carrier scan.' },
    (src) => {
      const order = u.text(src.orderNumber, 'orderNumber'), original = u.date(src.originalDeliveryDate, 'originalDeliveryDate'), revised = u.date(src.revisedDeliveryDate, 'revisedDeliveryDate');
      const reason = u.text(src.reason, 'reason'), nextStep = u.text(src.nextStep, 'nextStep');
      if (revised < original) throw new Error('revisedDeliveryDate cannot precede originalDeliveryDate');
      const delayDays = (revised - original) / u.DAY;
      return u.out(`Order ${order}: delivery update`, delayDays ? `${delayDays}-day revised estimate` : 'Delivery estimate confirmed', [
        u.card('ORIGINAL ESTIMATE', u.dateText(original), 'The previous delivery date.'),
        u.card('REVISED ESTIMATE', u.dateText(revised), delayDays ? `${delayDays} days later than the previous estimate.` : 'The delivery date has not changed.'),
        u.card('REASON', reason, 'Information supplied by the fulfillment team.'),
        u.card('NEXT STEP', nextStep, 'Keep your order number for reference.'),
      ], 'Thank you for your patience', `${order}:${src.revisedDeliveryDate}`, { delayDays });
    }),

  spec(39, 'appointment-preparation-video', 'An appointment to a preparation checklist video',
    'Turn appointment details and preparation requirements into a numbered reminder video.',
    ['appointmentType', 'appointmentAt', 'location', 'preparation'],
    { appointmentType: 'Design consultation', appointmentAt: '2026-10-06T10:00:00Z', location: 'Acme Studio reception', preparation: ['Bring room measurements.', 'Choose three reference photos.', 'Write down your main design goals.'] },
    (src) => {
      const type = u.text(src.appointmentType, 'appointmentType'), at = u.instant(src.appointmentAt, 'appointmentAt'), location = u.text(src.location, 'location');
      const tasks = u.strings(src.preparation, 'preparation');
      const cards = [u.card('APPOINTMENT', u.timeText(at), location), ...tasks.slice(0, 4).map((task, i) => u.card(`PREPARE ${i + 1}`, task, 'Complete before your appointment.'))];
      return u.out(`Prepare for your ${type}`, `${tasks.length} preparation tasks`, cards, tasks.length > 4 ? `Review all ${tasks.length} tasks in your booking details` : 'Keep your booking confirmation handy', `${type}:${src.appointmentAt}`, { taskCount: tasks.length, appointmentAt: new Date(at).toISOString() });
    }),

  spec(40, 'return-instructions-video', 'A return authorization to a packing and drop-off video',
    'Check the return deadline and combine authorized items with ordered return instructions.',
    ['returnNumber', 'deadline', 'referenceDate', 'items', 'steps'],
    { returnNumber: 'DEMO-RET-208', deadline: '2026-10-15', referenceDate: '2026-10-01', items: ['Desk organizer'], steps: ['Pack the authorized item securely.', 'Include the return reference.', 'Use the return label from your order portal.'] },
    (src) => {
      const reference = u.text(src.returnNumber, 'returnNumber'), deadline = u.date(src.deadline, 'deadline'), today = u.date(src.referenceDate, 'referenceDate');
      const items = u.strings(src.items, 'items'), steps = u.strings(src.steps, 'steps');
      const daysRemaining = (deadline - today) / u.DAY;
      if (daysRemaining < 0) return { skip: true, reason: 'The return deadline has expired; request updated authorization.' };
      return u.out(`Return ${reference}`, daysRemaining === 0 ? 'Return deadline is today' : `${daysRemaining} days until the deadline`, [
        u.card('AUTHORIZED ITEMS', items.slice(0, 3).join(' • '), `${items.length} authorized ${items.length === 1 ? 'item' : 'items'}.`),
        u.card('DEADLINE', u.dateText(deadline), `Reference date: ${u.dateText(today)}.`),
        ...steps.slice(0, 3).map((step, i) => u.card(`STEP ${i + 1}`, step, 'Follow the authorized return process.')),
      ], steps.length > 3 ? 'Review the complete return instructions in your order portal' : 'Keep proof of drop-off', reference, { daysRemaining, itemCount: items.length, stepCount: steps.length });
    }),

  spec(41, 'employee-first-week-video', 'An employee start date to a first-week agenda video',
    'Group onboarding sessions by day and derive the five actual workday dates from the supplied start date.',
    ['employeeName', 'role', 'startDate', 'sessions'],
    { employeeName: 'Jordan Demo', role: 'Customer success specialist', startDate: '2026-10-05', sessions: [{ day: 1, title: 'Team welcome', location: 'Main office' }, { day: 2, title: 'Product orientation', location: 'Training room' }, { day: 5, title: 'First-week check-in', location: 'Team meeting room' }] },
    (src) => {
      const name = u.text(src.employeeName, 'employeeName'), role = u.text(src.role, 'role'), start = u.date(src.startDate, 'startDate');
      const dates = [];
      for (let at = start; dates.length < 5; at += u.DAY) { const weekday = new Date(at).getUTCDay(); if (weekday !== 0 && weekday !== 6) dates.push(at); }
      const sessions = u.array(src.sessions, 'sessions').map((item, i) => { u.object(item, `sessions[${i}]`); return { day: u.number(item.day, 'session.day', 1, 5, true), title: u.text(item.title, 'session.title'), location: u.text(item.location, 'session.location') }; });
      const days = [...new Set(sessions.map((session) => session.day))].sort((a, b) => a - b);
      const cards = days.map((day) => { const group = sessions.filter((item) => item.day === day); return u.card(`DAY ${day}: ${u.dateText(dates[day - 1])}`, group.slice(0, 2).map((item) => item.title).join(' • '), group.slice(0, 2).map((item) => item.location).join(' • ')); });
      return u.out(`Welcome, ${name}`, `Your first week as ${role}`, cards, 'Weekdays are Monday–Friday; adjust for local holidays', `${name}:${src.startDate}`, { sessionCount: sessions.length, workdayDates: dates.map(u.dateText) });
    }),

  spec(42, 'interview-agenda-video', 'An interview schedule to a candidate agenda video',
    'Validate nonoverlapping interview sessions and calculate session time versus the full agenda span.',
    ['candidateName', 'role', 'sessions'],
    { candidateName: 'Taylor Demo', role: 'Product designer', sessions: [{ startsAt: '2026-10-07T09:00:00Z', endsAt: '2026-10-07T09:30:00Z', topic: 'Portfolio discussion', interviewer: 'Design panel' }, { startsAt: '2026-10-07T09:45:00Z', endsAt: '2026-10-07T10:15:00Z', topic: 'Collaboration discussion', interviewer: 'Product panel' }] },
    (src) => {
      const name = u.text(src.candidateName, 'candidateName'), role = u.text(src.role, 'role');
      const sessions = u.array(src.sessions, 'sessions').map((item, i) => {
        u.object(item, `sessions[${i}]`);
        const start = u.instant(item.startsAt, 'session.startsAt'), end = u.instant(item.endsAt, 'session.endsAt');
        if (end <= start) throw new Error('interview session endsAt must be after startsAt');
        return { start, end, topic: u.text(item.topic, 'session.topic'), interviewer: u.text(item.interviewer, 'session.interviewer') };
      }).sort((a, b) => a.start - b.start);
      for (let i = 1; i < sessions.length; i++) if (sessions[i].start < sessions[i - 1].end) throw new Error('interview sessions cannot overlap');
      const interviewMinutes = u.sum(sessions.map((item) => (item.end - item.start) / 60000)), agendaMinutes = (sessions.at(-1).end - sessions[0].start) / 60000;
      const cards = sessions.slice(0, 4).map((item) => u.card(u.timeText(item.start), item.topic, `${item.interviewer} • ${(item.end - item.start) / 60000} minutes`));
      cards.push(u.card('TOTAL AGENDA', `${u.percent(agendaMinutes)} minutes`, `${u.percent(interviewMinutes)} interview minutes plus ${u.percent(agendaMinutes - interviewMinutes)} break minutes.`));
      return u.out(`${name}: interview agenda`, role, cards, 'All times shown in UTC; review your full invitation', `${name}:${new Date(sessions[0].start).toISOString()}`, { sessionCount: sessions.length, interviewMinutes, agendaMinutes, breakMinutes: agendaMinutes - interviewMinutes });
    }),

  spec(43, 'course-roadmap-video', 'A course syllabus to a learning roadmap video',
    'Calculate course duration and present the supplied learning outcomes in module order.',
    ['course', 'modules'],
    { course: 'Practical workflow foundations', modules: [{ title: 'Inputs and triggers', minutes: 20, outcome: 'Identify the right trigger for a task.' }, { title: 'Validation and branching', minutes: 25, outcome: 'Check inputs before an action.' }, { title: 'Results and monitoring', minutes: 15, outcome: 'Understand successful and skipped runs.' }] },
    (src) => {
      const course = u.text(src.course, 'course');
      const modules = u.array(src.modules, 'modules').map((item, i) => { u.object(item, `modules[${i}]`); return { title: u.text(item.title, 'module.title'), minutes: u.number(item.minutes, 'module.minutes', 1, 10000, true), outcome: u.text(item.outcome, 'module.outcome') }; });
      const totalMinutes = u.sum(modules.map((item) => item.minutes));
      const cards = modules.slice(0, 4).map((item, i) => u.card(`MODULE ${i + 1}: ${item.minutes} MIN`, item.title, item.outcome));
      cards.push(u.card('LEARNING TIME', `${totalMinutes} minutes`, `${modules.length} modules in the supplied syllabus.`));
      return u.out(course, 'Your learning roadmap', cards, 'Follow the complete course syllabus', course, { moduleCount: modules.length, totalMinutes });
    }),

  spec(44, 'safety-briefing-video', 'Workplace hazards to a safety briefing video',
    'Prioritize supplied workplace hazards by severity and pair each with its approved control.',
    ['site', 'hazards', 'emergencyInstruction'],
    { site: 'Acme Workshop', hazards: [{ title: 'Moving equipment', severity: 'high', control: 'Stay within marked pedestrian routes.' }, { title: 'Loose packaging', severity: 'medium', control: 'Keep walkways clear during unpacking.' }, { title: 'Workstation clutter', severity: 'low', control: 'Store tools after each task.' }], emergencyInstruction: 'Follow the posted evacuation plan and meet at the marked assembly point.' },
    (src) => {
      const site = u.text(src.site, 'site'), emergency = u.text(src.emergencyInstruction, 'emergencyInstruction'), levels = ['high', 'medium', 'low'];
      const hazards = u.array(src.hazards, 'hazards').map((item, i) => { u.object(item, `hazards[${i}]`); return { title: u.text(item.title, 'hazard.title'), severity: u.choice(item.severity, 'hazard.severity', levels), control: u.text(item.control, 'hazard.control') }; }).sort((a, b) => levels.indexOf(a.severity) - levels.indexOf(b.severity));
      const cards = hazards.slice(0, 4).map((item) => u.card(`${item.severity.toUpperCase()} PRIORITY`, item.title, item.control));
      cards.push(u.card('EMERGENCY ACTION', emergency, 'Use the approved site instructions.'));
      return u.out(`${site}: safety briefing`, `${hazards.length} supplied hazards`, cards, 'This briefing summarizes your approved site controls', site, { hazardCount: hazards.length, highPriorityCount: hazards.filter((item) => item.severity === 'high').length, orderedSeverities: hazards.map((item) => item.severity) });
    }),

  spec(45, 'training-completion-video', 'A training result to a completion video',
    'Compare a supplied assessment score with its passing threshold and show a certificate only for a passing result.',
    ['recipient', 'course', 'completedAt', 'score', 'passingScore', 'certificateId'],
    { recipient: 'Morgan Demo', course: 'Customer support foundations', completedAt: '2026-09-30', score: 92, passingScore: 80, certificateId: 'DEMO-CERT-2026-014' },
    (src) => {
      const recipient = u.text(src.recipient, 'recipient'), course = u.text(src.course, 'course'), completed = u.date(src.completedAt, 'completedAt');
      const score = u.number(src.score, 'score', 0, 100), threshold = u.number(src.passingScore, 'passingScore', 0, 100), id = u.text(src.certificateId, 'certificateId');
      const passed = score >= threshold;
      return u.out(passed ? `Well done, ${recipient}` : `${recipient}: training result`, course, [
        u.card('ASSESSMENT', `${score}%`, `Passing score: ${threshold}%.`),
        u.card('RESULT', passed ? 'Passed' : 'Further study needed', passed ? 'The supplied score meets the threshold.' : 'Review the course and follow your training team’s retry process.'),
        u.card('COMPLETED ON', u.dateText(completed), 'Date supplied by the training system.'),
        u.card(passed ? 'CERTIFICATE REFERENCE' : 'RESULT REFERENCE', id, passed ? 'Reference supplied by the training system; no credential is created here.' : 'This result does not issue a certificate.'),
      ], passed ? 'Celebrate your learning progress' : 'Keep learning and try again', id, { passed, score, passingScore: threshold, marginPoints: score - threshold });
    }),

  spec(46, 'meeting-action-brief-video', 'Meeting actions to an owner and deadline brief video',
    'Sort meeting actions by due date, calculate overdue counts and group tasks by owner.',
    ['meeting', 'referenceDate', 'actions'],
    { meeting: 'Launch readiness review', referenceDate: '2026-10-01', actions: [{ task: 'Confirm the support checklist', owner: 'Support team', dueDate: '2026-09-30' }, { task: 'Approve the release notes', owner: 'Product team', dueDate: '2026-10-02' }, { task: 'Schedule the onboarding walkthrough', owner: 'Support team', dueDate: '2026-10-03' }] },
    (src) => {
      const meeting = u.text(src.meeting, 'meeting'), today = u.date(src.referenceDate, 'referenceDate');
      const actions = u.array(src.actions, 'actions', 0).map((item, i) => { u.object(item, `actions[${i}]`); return { task: u.text(item.task, 'action.task'), owner: u.text(item.owner, 'action.owner'), due: u.date(item.dueDate, 'action.dueDate') }; }).sort((a, b) => a.due - b.due);
      if (!actions.length) return { skip: true, reason: 'There are no meeting actions to brief.' };
      const owners = [...new Set(actions.map((item) => item.owner))], overdueCount = actions.filter((item) => item.due < today).length;
      const ownerCounts = Object.fromEntries(owners.map((owner) => [owner, actions.filter((item) => item.owner === owner).length]));
      const cards = owners.slice(0, 4).map((owner) => { const tasks = actions.filter((item) => item.owner === owner); return u.card(owner, `${tasks.length} ${tasks.length === 1 ? 'action' : 'actions'}`, tasks.slice(0, 2).map((item) => `${u.dateText(item.due)}: ${item.task}`).join(' • ')); });
      cards.push(u.card('DEADLINE CHECK', `${overdueCount} overdue`, `Reference date: ${u.dateText(today)} • ${actions.length} actions overall.`));
      return u.out(meeting, 'Owners and next actions', cards, 'Keep the full action list in your meeting record', `${meeting}:${src.referenceDate}`, { actionCount: actions.length, ownerCounts, overdueCount, earliestDueDate: u.dateText(actions[0].due) });
    }),

  spec(47, 'equipment-maintenance-video', 'Equipment records to a maintenance-due video',
    'Calculate next-service dates and create a briefing only for equipment whose service is due.',
    ['referenceDate', 'equipment'],
    { referenceDate: '2026-10-01', equipment: [{ name: 'Packing station A', lastServicedAt: '2026-08-25', intervalDays: 30, instruction: 'Book the approved inspection checklist with the maintenance team.' }, { name: 'Label printer B', lastServicedAt: '2026-09-20', intervalDays: 30, instruction: 'Arrange the standard cleaning and alignment check.' }] },
    (src) => {
      const today = u.date(src.referenceDate, 'referenceDate');
      const equipment = u.array(src.equipment, 'equipment', 0).map((item, i) => {
        u.object(item, `equipment[${i}]`);
        const serviced = u.date(item.lastServicedAt, 'equipment.lastServicedAt'), interval = u.number(item.intervalDays, 'equipment.intervalDays', 1, 36500, true);
        if (serviced > today) throw new Error('lastServicedAt cannot be after referenceDate');
        return { name: u.text(item.name, 'equipment.name'), due: serviced + interval * u.DAY, instruction: u.text(item.instruction, 'equipment.instruction') };
      });
      const due = equipment.filter((item) => item.due <= today).sort((a, b) => a.due - b.due);
      if (!due.length) return { skip: true, reason: 'No equipment is due for maintenance on the reference date.' };
      const cards = due.slice(0, 4).map((item) => u.card(item.name, `${(today - item.due) / u.DAY} days overdue`, `${u.dateText(item.due)} • ${item.instruction}`));
      cards.push(u.card('DUE EQUIPMENT', `${due.length} of ${equipment.length}`, `Checked against ${u.dateText(today)}.`));
      if (cards.length < 3) cards.push(u.card('NEXT ACTION', 'Arrange approved maintenance', 'This briefing does not operate or service equipment.'));
      return u.out('Maintenance due', u.dateText(today), cards, 'Use the approved maintenance procedure for each asset', `maintenance:${src.referenceDate}`, { dueCount: due.length, checkedCount: equipment.length, earliestDueDate: u.dateText(due[0].due), maximumOverdueDays: (today - due[0].due) / u.DAY });
    }),

  spec(48, 'inventory-replenishment-video', 'Stock levels to a replenishment brief video',
    'Select inventory at or below its reorder threshold and calculate quantities needed to reach target stock.',
    ['warehouse', 'items'],
    { warehouse: 'North demo warehouse', items: [{ sku: 'DEMO-MAT', name: 'Desk mat', onHand: 8, reorderPoint: 10, targetStock: 30 }, { sku: 'DEMO-PEN', name: 'Pen pack', onHand: 15, reorderPoint: 15, targetStock: 40 }, { sku: 'DEMO-NOTE', name: 'Notebook', onHand: 35, reorderPoint: 10, targetStock: 30 }] },
    (src) => {
      const warehouse = u.text(src.warehouse, 'warehouse');
      const items = u.array(src.items, 'items', 0).map((item, i) => {
        u.object(item, `items[${i}]`);
        const onHand = u.number(item.onHand, 'item.onHand', 0, 1e9, true), reorderPoint = u.number(item.reorderPoint, 'item.reorderPoint', 0, 1e9, true), targetStock = u.number(item.targetStock, 'item.targetStock', 0, 1e9, true);
        if (targetStock <= reorderPoint) throw new Error('targetStock must be above reorderPoint');
        return { sku: u.text(item.sku, 'item.sku'), name: u.text(item.name, 'item.name'), onHand, reorderPoint, targetStock, reorderQuantity: Math.max(0, targetStock - onHand) };
      });
      if (new Set(items.map((item) => item.sku)).size !== items.length) throw new Error('inventory SKU values must be unique');
      const selected = items.filter((item) => item.onHand <= item.reorderPoint).sort((a, b) => a.onHand - b.onHand), totalUnits = u.sum(selected.map((item) => item.reorderQuantity));
      if (!selected.length) return { skip: true, reason: 'Every supplied stock item is above its reorder point.' };
      const cards = selected.slice(0, 4).map((item) => u.card(item.name, `Replenish ${item.reorderQuantity}`, `${item.sku}: ${item.onHand} on hand • target ${item.targetStock}.`));
      cards.push(u.card('TOTAL REQUIREMENT', `${totalUnits} units`, `${selected.length} stock items need replenishment.`));
      return u.out(`${warehouse}: replenishment brief`, 'Calculated stock requirements', cards, 'Review quantities before creating purchase orders', warehouse, { reorderCount: selected.length, totalUnits, quantities: Object.fromEntries(selected.map((item) => [item.sku, item.reorderQuantity])) });
    }),

  spec(49, 'delivery-route-brief-video', 'A dispatch plan to a delivery-route briefing video',
    'Sort numbered stops and derive estimated arrival times from supplied travel and service durations.',
    ['route', 'departureAt', 'stops'],
    { route: 'Demo route A', departureAt: '2026-10-02T08:00:00Z', stops: [{ sequence: 1, address: 'Demo North Depot', travelMinutes: 20, serviceMinutes: 10 }, { sequence: 2, address: 'Demo Central Workshop', travelMinutes: 15, serviceMinutes: 5 }, { sequence: 3, address: 'Demo South Studio', travelMinutes: 25, serviceMinutes: 10 }] },
    (src) => {
      const route = u.text(src.route, 'route'), departure = u.instant(src.departureAt, 'departureAt');
      const stops = u.array(src.stops, 'stops').map((item, i) => { u.object(item, `stops[${i}]`); return { sequence: u.number(item.sequence, 'stop.sequence', 1, 1e6, true), address: u.text(item.address, 'stop.address'), travelMinutes: u.number(item.travelMinutes, 'stop.travelMinutes', 0, 1440), serviceMinutes: u.number(item.serviceMinutes, 'stop.serviceMinutes', 0, 1440) }; }).sort((a, b) => a.sequence - b.sequence);
      if (new Set(stops.map((item) => item.sequence)).size !== stops.length) throw new Error('stop sequence values must be unique');
      let cursor = departure;
      const estimates = stops.map((stop) => { cursor += stop.travelMinutes * 60000; const arrival = cursor; cursor += stop.serviceMinutes * 60000; return { ...stop, arrival }; });
      const totalMinutes = (cursor - departure) / 60000, arrivalTimes = estimates.map((item) => new Date(item.arrival).toISOString());
      const cards = estimates.slice(0, 4).map((item) => u.card(`STOP ${item.sequence}`, item.address, `${u.timeText(item.arrival)} • ${item.serviceMinutes} minutes on site.`));
      cards.push(u.card('ROUTE PLAN', `${u.percent(totalMinutes)} minutes`, `${stops.length} stops • departure ${u.timeText(departure)}.`));
      return u.out(route, 'Estimated arrival briefing', cards, 'Estimates use supplied durations; adjust for live conditions', `${route}:${src.departureAt}`, { stopCount: stops.length, totalMinutes, arrivalTimes, finishAt: new Date(cursor).toISOString() });
    }),

  spec(50, 'tender-checklist-video', 'Tender requirements to a bid checklist video',
    'Check the submission deadline and separate eligibility rules from required bid documents.',
    ['title', 'deadline', 'referenceDate', 'eligibility', 'documents'],
    { title: 'Demo office fit-out tender', deadline: '2026-10-20', referenceDate: '2026-10-01', eligibility: ['Registered business', 'Relevant project experience'], documents: ['Scope response', 'Pricing schedule', 'Delivery timeline'] },
    (src) => {
      const title = u.text(src.title, 'title'), deadline = u.date(src.deadline, 'deadline'), today = u.date(src.referenceDate, 'referenceDate');
      const eligibility = u.strings(src.eligibility, 'eligibility'), documents = u.strings(src.documents, 'documents'), daysRemaining = (deadline - today) / u.DAY;
      if (daysRemaining < 0) return { skip: true, reason: 'The tender submission deadline has passed.' };
      const concise = (value) => value.length > 40 ? value.slice(0, 39).trimEnd() + '…' : value;
      return u.out(title, daysRemaining === 0 ? 'Submission deadline is today' : `${daysRemaining} days to submit`, [
        u.card('DEADLINE', u.dateText(deadline), `Reference date: ${u.dateText(today)}.`),
        u.card('ELIGIBILITY', `${eligibility.length} checks`, eligibility.slice(0, 3).map(concise).join(' • ')),
        u.card('DOCUMENTS', `${documents.length} documents to review`, documents.slice(0, 3).map((document) => concise(document.split(' — ')[0].trim())).join(' • ')),
        u.card('FINAL CHECK', 'Review the complete tender', 'Confirm the full issuer terms, document owners/statuses and local deadline details in the authoritative source.'),
      ], 'This briefing summarizes the supplied tender requirements', `${title}:${src.deadline}`, { daysRemaining, eligibilityCount: eligibility.length, documentCount: documents.length });
    }),

  spec(51, 'travel-itinerary-video', 'Travel bookings to a day-by-day itinerary video',
    'Sort trip days and activities chronologically without changing the supplied destination-local times.',
    ['trip', 'days'],
    { trip: 'Demo coastal weekend', days: [{ date: '2026-10-10', activities: [{ time: '09:00', title: 'Harbor walk', location: 'Demo Harbor' }, { time: '13:30', title: 'Museum visit', location: 'Demo Maritime Museum' }] }, { date: '2026-10-11', activities: [{ time: '10:00', title: 'Old-town tour', location: 'Demo Visitor Center' }] }] },
    (src) => {
      const trip = u.text(src.trip, 'trip');
      const days = u.array(src.days, 'days').map((item, i) => {
        u.object(item, `days[${i}]`);
        const date = u.date(item.date, 'day.date');
        const activities = u.array(item.activities, 'day.activities').map((activity, j) => {
          u.object(activity, `activities[${j}]`);
          const time = u.text(activity.time, 'activity.time', 5);
          if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('activity.time must be HH:MM in 24-hour format');
          return { time, title: u.text(activity.title, 'activity.title'), location: u.text(activity.location, 'activity.location') };
        }).sort((a, b) => a.time.localeCompare(b.time));
        return { date, activities };
      }).sort((a, b) => a.date - b.date);
      if (new Set(days.map((item) => item.date)).size !== days.length) throw new Error('trip day dates must be unique');
      const activityCount = u.sum(days.map((item) => item.activities.length));
      const cards = days.slice(0, 4).map((day, i) => u.card(`DAY ${i + 1}: ${u.dateText(day.date)}`, day.activities.slice(0, 2).map((item) => `${item.time} ${item.title}`).join(' • '), day.activities.slice(0, 2).map((item) => item.location).join(' • ')));
      cards.push(u.card('TRIP OVERVIEW', `${days.length} days • ${activityCount} activities`, `${u.dateText(days[0].date)} to ${u.dateText(days.at(-1).date)}.`));
      return u.out(trip, 'Your day-by-day plan', cards, 'Activity times remain destination-local as supplied', trip, { dayCount: days.length, activityCount, firstDate: u.dateText(days[0].date), orderedTimes: days.map((day) => day.activities.map((item) => item.time)) });
    }),

  spec(52, 'hotel-arrival-guide-video', 'Accommodation details to a public arrival guide video',
    'Combine public arrival instructions with amenities without embedding access codes or guest credentials.',
    ['property', 'checkInTime', 'address', 'arrivalSteps', 'amenities'],
    { property: 'Demo Harbor Stay', checkInTime: '15:00', address: 'Demo Harbor reception', arrivalSteps: ['Enter through the main reception.', 'Show your booking confirmation to the reception team.', 'Ask reception for your room directions.'], amenities: ['Breakfast lounge', 'Luggage storage', 'Guest workspace'] },
    (src) => {
      const property = u.text(src.property, 'property'), time = u.text(src.checkInTime, 'checkInTime', 5), address = u.text(src.address, 'address');
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('checkInTime must be HH:MM in 24-hour format');
      const steps = u.strings(src.arrivalSteps, 'arrivalSteps'), amenities = u.strings(src.amenities, 'amenities', 0);
      const cards = [u.card('CHECK-IN', `From ${time} local time`, address), ...steps.slice(0, 3).map((step, i) => u.card(`ARRIVE ${i + 1}`, step, 'Follow your booking confirmation for guest-specific details.')), u.card('AMENITIES', amenities.length ? amenities.slice(0, 3).join(' • ') : 'Ask reception for available amenities', `${amenities.length} amenities supplied.`)];
      return u.out(`Welcome to ${property}`, 'Your arrival guide', cards, 'Keep private access details in your booking confirmation', property, { arrivalStepCount: steps.length, amenityCount: amenities.length, checkInTime: time });
    }),

  spec(53, 'pet-adoption-video', 'A rescue profile to a pet adoption video',
    'Create an adoption profile from supplied temperament and care requirements with a validated HTTPS application link.',
    ['name', 'species', 'age', 'traits', 'careNeeds', 'adoptionUrl'],
    { name: 'Milo Demo', species: 'Cat', age: '3 years', traits: ['Calm companion', 'Enjoys quiet play'], careNeeds: ['Indoor home', 'Gradual introductions to other pets'], adoptionUrl: 'https://example.com/adopt/milo-demo' },
    (src) => {
      const name = u.text(src.name, 'name'), species = u.text(src.species, 'species'), age = u.text(src.age, 'age');
      const traits = u.strings(src.traits, 'traits'), care = u.strings(src.careNeeds, 'careNeeds'), url = u.url(src.adoptionUrl, 'adoptionUrl');
      return u.out(`Meet ${name}`, `${species} • ${age}`, [
        u.card('PERSONALITY', traits.slice(0, 3).join(' • '), 'Traits supplied by the rescue team.'),
        u.card('CARE NEEDS', care.slice(0, 3).join(' • '), 'Review the full rescue profile before applying.'),
        u.card('APPLY TO ADOPT', url, 'Learn about the rescue’s adoption process.'),
      ], 'Find the right home with the rescue team', url, { traitCount: traits.length, careNeedCount: care.length, adoptionUrl: url });
    }),

  spec(54, 'volunteer-shift-video', 'A volunteer roster to a station briefing video',
    'Group volunteer tasks by station and calculate coverage and shift duration.',
    ['event', 'startsAt', 'endsAt', 'assignments'],
    { event: 'Demo community cleanup', startsAt: '2026-10-10T08:00:00Z', endsAt: '2026-10-10T11:00:00Z', assignments: [{ person: 'Alex Demo', station: 'Welcome desk', task: 'Hand out the route sheet.' }, { person: 'Sam Demo', station: 'Welcome desk', task: 'Record volunteer arrivals.' }, { person: 'Robin Demo', station: 'Equipment point', task: 'Distribute approved cleanup equipment.' }] },
    (src) => {
      const event = u.text(src.event, 'event'), start = u.instant(src.startsAt, 'startsAt'), end = u.instant(src.endsAt, 'endsAt');
      if (end <= start) throw new Error('endsAt must be after startsAt');
      const assignments = u.array(src.assignments, 'assignments').map((item, i) => { u.object(item, `assignments[${i}]`); return { person: u.text(item.person, 'assignment.person'), station: u.text(item.station, 'assignment.station'), task: u.text(item.task, 'assignment.task') }; });
      const stations = [...new Set(assignments.map((item) => item.station))], volunteerCount = new Set(assignments.map((item) => item.person)).size;
      const stationCoverage = Object.fromEntries(stations.map((station) => [station, new Set(assignments.filter((item) => item.station === station).map((item) => item.person)).size]));
      const cards = stations.slice(0, 4).map((station) => { const team = assignments.filter((item) => item.station === station); return u.card(station, `${stationCoverage[station]} ${stationCoverage[station] === 1 ? 'volunteer' : 'volunteers'}`, team.slice(0, 2).map((item) => `${item.person}: ${item.task}`).join(' • ')); });
      const durationMinutes = (end - start) / 60000;
      cards.push(u.card('SHIFT', `${u.percent(durationMinutes)} minutes`, `${u.timeText(start)} to ${u.timeText(end)}.`));
      return u.out(event, `${volunteerCount} volunteers • ${stations.length} stations`, cards, 'Follow the coordinator’s complete roster and instructions', `${event}:${src.startsAt}`, { volunteerCount, stationCount: stations.length, stationCoverage, durationMinutes });
    }),

  spec(55, 'donation-impact-video', 'A donation to an estimated impact thank-you video',
    'Calculate whole impact units from the supplied amount and unit cost, clearly labeling the estimate.',
    ['donor', 'amount', 'currency', 'campaign', 'unitCost', 'impactUnit'],
    { donor: 'Community Demo Fund', amount: 125, currency: 'USD', campaign: 'School supply drive', unitCost: 12, impactUnit: 'school supply kits' },
    (src) => {
      const donor = u.text(src.donor, 'donor'), campaign = u.text(src.campaign, 'campaign'), unit = u.text(src.impactUnit, 'impactUnit'), currency = u.currency(src.currency);
      const donated = u.cents(src.amount, 'amount', 0.01), unitCost = u.cents(src.unitCost, 'unitCost', 0.01), impactUnits = Math.floor(donated / unitCost), remainderCents = donated % unitCost;
      return u.out(`Thank you, ${donor}`, campaign, [
        u.card('YOUR CONTRIBUTION', u.amount(donated, currency), 'Amount supplied in the donation record.'),
        u.card('ESTIMATED IMPACT', `${impactUnits} ${unit}`, `Calculated at ${u.amount(unitCost, currency)} per unit; this is an estimate, not proof of delivery.`),
        u.card('REMAINING CONTRIBUTION', u.amount(remainderCents, currency), 'Amount remaining after the whole-unit calculation.'),
      ], 'Your support helps the campaign move forward', `${campaign}:${donor}`, { impactUnits, remainder: remainderCents / 100, donationAmount: donated / 100, unitCost: unitCost / 100 });
    }),

  spec(56, 'survey-results-video', 'Survey response counts to a results breakdown video',
    'Calculate vote percentages, rank answer options and preserve ties without inventing a winner.',
    ['question', 'options'],
    { question: 'Which workshop should we run next?', options: [{ label: 'Workflow basics', votes: 24 }, { label: 'Data cleanup', votes: 18 }, { label: 'Video reporting', votes: 18 }] },
    (src) => {
      const question = u.text(src.question, 'question');
      const options = u.array(src.options, 'options', 2).map((item, i) => { u.object(item, `options[${i}]`); return { label: u.text(item.label, 'option.label'), votes: u.number(item.votes, 'option.votes', 0, 1e9, true) }; });
      if (new Set(options.map((item) => item.label)).size !== options.length) throw new Error('survey option labels must be unique');
      const totalVotes = u.sum(options.map((item) => item.votes));
      if (totalVotes === 0) return { skip: true, reason: 'The survey has zero votes; no result video is generated.' };
      options.sort((a, b) => b.votes - a.votes);
      const winners = options.filter((item) => item.votes === options[0].votes).map((item) => item.label), percentages = Object.fromEntries(options.map((item) => [item.label, u.percent(item.votes / totalVotes * 100)]));
      const cards = options.slice(0, 4).map((item) => u.card(item.label, `${percentages[item.label]}%`, `${item.votes} of ${totalVotes} supplied votes.`));
      cards.push(u.card(winners.length > 1 ? 'TIED LEAD' : 'TOP RESPONSE', winners.slice(0, 3).join(' • '), `${winners.length} leading ${winners.length === 1 ? 'option' : 'options'}. Percentages rounded independently.`));
      return u.out('Survey results', question, cards, `${totalVotes} votes in the supplied results`, question, { totalVotes, percentages, winners });
    }),

  spec(57, 'fundraiser-progress-video', 'Fundraiser contributions to a progress video',
    'Sum contributions in integer cents and distinguish remaining goal, goal reached and funds above the goal.',
    ['campaign', 'goal', 'currency', 'contributions'],
    { campaign: 'Demo community garden', goal: 1000, currency: 'USD', contributions: [{ amount: 250 }, { amount: 175 }, { amount: 125 }] },
    (src) => {
      const campaign = u.text(src.campaign, 'campaign'), currency = u.currency(src.currency), goalCents = u.cents(src.goal, 'goal', 0.01);
      const contributions = u.array(src.contributions, 'contributions', 0).map((item, i) => { u.object(item, `contributions[${i}]`); return u.cents(item.amount, 'contribution.amount'); });
      const raisedCents = u.sum(contributions), remainingCents = Math.max(0, goalCents - raisedCents), excessCents = Math.max(0, raisedCents - goalCents), progressPercent = u.percent(raisedCents / goalCents * 100), reached = raisedCents >= goalCents;
      return u.out(campaign, reached ? 'Fundraising goal reached' : 'Campaign progress', [
        u.card('RAISED', u.amount(raisedCents, currency), `${contributions.length} supplied contribution ${contributions.length === 1 ? 'record' : 'records'}.`),
        u.card('GOAL', u.amount(goalCents, currency), 'The campaign target supplied by your team.'),
        u.card('PROGRESS', `${progressPercent}%`, 'Percentage can exceed 100% when support passes the goal.'),
        u.card(excessCents ? 'ABOVE GOAL' : 'REMAINING', u.amount(excessCents || remainingCents, currency), reached ? 'Thank you for helping meet the goal.' : 'Amount still needed to meet the supplied goal.'),
      ], 'Thank you to the campaign’s supporters', campaign, { raised: raisedCents / 100, remaining: remainingCents / 100, excess: excessCents / 100, progressPercent, reached });
    }),

  spec(58, 'before-after-case-study-video', 'Before-and-after measurements to a case study video',
    'Calculate absolute and percentage changes and interpret improvement according to each metric’s direction.',
    ['project', 'metrics'],
    { project: 'Demo onboarding improvement', metrics: [{ name: 'Setup time', before: 40, after: 25, unit: 'minutes', direction: 'lower' }, { name: 'Completed onboarding', before: 60, after: 78, unit: 'people', direction: 'higher' }] },
    (src) => {
      const project = u.text(src.project, 'project');
      const metrics = u.array(src.metrics, 'metrics').map((item, i) => {
        u.object(item, `metrics[${i}]`);
        const before = u.number(item.before, 'metric.before'), after = u.number(item.after, 'metric.after'), direction = u.choice(item.direction, 'metric.direction', ['higher', 'lower']);
        const change = after - before, percentageChange = before === 0 ? null : u.percent(change / before * 100), improved = direction === 'higher' ? change > 0 : change < 0;
        return { name: u.text(item.name, 'metric.name'), unit: u.text(item.unit, 'metric.unit'), before, after, change, percentageChange, improved, direction };
      });
      if (new Set(metrics.map((item) => item.name)).size !== metrics.length) throw new Error('metric names must be unique');
      const improvementCount = metrics.filter((item) => item.improved).length;
      const cards = metrics.slice(0, 4).map((item) => u.card(item.name, `${item.before} → ${item.after} ${item.unit}`, `${item.change > 0 ? '+' : ''}${item.change} ${item.unit} • ${item.percentageChange === null ? 'percentage unavailable from a zero baseline' : `${item.percentageChange > 0 ? '+' : ''}${item.percentageChange}%`} • ${item.change === 0 ? 'unchanged' : item.improved ? 'improved' : 'did not improve'}.`));
      cards.push(u.card('RESULT SUMMARY', `${improvementCount} of ${metrics.length} improved`, 'Direction is supplied per metric; changes do not establish causation.'));
      return u.out(project, 'Before-and-after measurements', cards, 'Review the source measurements and measurement periods', project, { improvementCount, metricCount: metrics.length, changes: metrics.map(({ name, change, percentageChange, improved }) => ({ name, change, percentageChange, improved })) });
    }),

  spec(59, 'milestone-roadmap-video', 'Project milestones to a delivery roadmap video',
    'Sort milestones, calculate completion and identify overdue unfinished work and the next planned milestone.',
    ['project', 'referenceDate', 'milestones'],
    { project: 'Demo workspace launch', referenceDate: '2026-10-01', milestones: [{ title: 'Requirements approved', dueDate: '2026-09-25', status: 'complete' }, { title: 'Pilot workspace', dueDate: '2026-09-30', status: 'in_progress' }, { title: 'Team rollout', dueDate: '2026-10-07', status: 'planned' }] },
    (src) => {
      const project = u.text(src.project, 'project'), today = u.date(src.referenceDate, 'referenceDate');
      const milestones = u.array(src.milestones, 'milestones').map((item, i) => { u.object(item, `milestones[${i}]`); return { title: u.text(item.title, 'milestone.title'), due: u.date(item.dueDate, 'milestone.dueDate'), status: u.choice(item.status, 'milestone.status', ['planned', 'in_progress', 'complete']) }; }).sort((a, b) => a.due - b.due);
      const completeCount = milestones.filter((item) => item.status === 'complete').length, overdueCount = milestones.filter((item) => item.status !== 'complete' && item.due < today).length, next = milestones.find((item) => item.status !== 'complete'), completionPercent = u.percent(completeCount / milestones.length * 100);
      const cards = milestones.slice(0, 4).map((item) => u.card(u.dateText(item.due), item.title, `${item.status.replace(/_/g, ' ')}${item.status !== 'complete' && item.due < today ? ' • overdue' : ''}.`));
      cards.push(u.card('PROJECT PROGRESS', `${completionPercent}% complete`, `${overdueCount} overdue • next: ${next ? next.title : 'all milestones complete'}.`));
      return u.out(project, 'Delivery roadmap', cards, `Reference date: ${u.dateText(today)}; confirm dates with the project owner`, `${project}:${src.referenceDate}`, { completeCount, overdueCount, completionPercent, nextMilestone: next ? next.title : null, milestoneCount: milestones.length });
    }),

  spec(60, 'recipe-cooking-guide-video', 'Recipe ingredients to a scaled cooking guide video',
    'Scale ingredient quantities to a requested serving count and display the supplied cooking steps in order.',
    ['recipe', 'baseServings', 'targetServings', 'ingredients', 'steps'],
    { recipe: 'Demo roasted vegetable bowl', baseServings: 2, targetServings: 4, ingredients: [{ name: 'Cooked rice', quantity: 200, unit: 'g' }, { name: 'Mixed vegetables', quantity: 300, unit: 'g' }, { name: 'Olive oil', quantity: 1, unit: 'tbsp' }], steps: ['Prepare the ingredients as described in your full recipe.', 'Roast the vegetables using the recipe’s temperature and timing.', 'Serve the vegetables with the rice and dressing.'] },
    (src) => {
      const recipe = u.text(src.recipe, 'recipe'), base = u.number(src.baseServings, 'baseServings', 1, 1000, true), target = u.number(src.targetServings, 'targetServings', 1, 1000, true), ratio = target / base;
      const ingredients = u.array(src.ingredients, 'ingredients').map((item, i) => {
        u.object(item, `ingredients[${i}]`);
        const quantity = u.number(item.quantity, 'ingredient.quantity', 0.000001, 1e9), scaled = Math.round(quantity * ratio * 1000000) / 1000000;
        return { name: u.text(item.name, 'ingredient.name'), quantity: scaled, unit: u.text(item.unit, 'ingredient.unit') };
      });
      const steps = u.strings(src.steps, 'steps');
      const cards = [u.card('SCALED INGREDIENTS', `${target} ${target === 1 ? 'serving' : 'servings'}`, ingredients.slice(0, 4).map((item) => `${item.quantity} ${item.unit} ${item.name}`).join(' • ')), ...steps.slice(0, 4).map((step, i) => u.card(`COOK ${i + 1}`, `Step ${i + 1} of ${steps.length}`, step))];
      return u.out(recipe, `${target} ${target === 1 ? 'serving' : 'servings'} • ${ratio}× ingredient quantities`, cards, 'Scaling ingredients does not automatically scale cooking times', recipe, { scaleFactor: ratio, targetServings: target, ingredientCount: ingredients.length, stepCount: steps.length, scaledIngredients: ingredients });
    }),
];
