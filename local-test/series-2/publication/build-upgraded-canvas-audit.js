'use strict';
// Read fresh native DOM captures and screenshot files. This does not control the UI.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { adapters } = require('../../../scripts/series-two-source-adapters');
const { functionalHash } = require('./infra-functional-fingerprint');
const ROOT = __dirname, N8N = path.resolve(ROOT, '../../..');
const CANVAS = path.join(ROOT, 'canvas');
const STICKY = 'n8n-nodes-base.stickyNote';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
function rect(value) {
  if (!value || !['x', 'y', 'width', 'height'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key])) || value.width <= 0 || value.height <= 0) return null;
  return { x: value.x, y: value.y, width: value.width, height: value.height, right: value.x + value.width, bottom: value.y + value.height };
}
function union(...values) {
  const found = values.map(rect).filter(Boolean);
  if (!found.length) return null;
  const x = Math.min(...found.map(r => r.x)), y = Math.min(...found.map(r => r.y));
  return rect({ x, y, width: Math.max(...found.map(r => r.right)) - x, height: Math.max(...found.map(r => r.bottom)) - y });
}
function contains(outer, inner, epsilon = 0.5) {
  return !!outer && !!inner && inner.x >= outer.x - epsilon && inner.y >= outer.y - epsilon && inner.right <= outer.right + epsilon && inner.bottom <= outer.bottom + epsilon;
}
function intersects(a, b, epsilon = 0.5) {
  return !!a && !!b && Math.min(a.right, b.right) - Math.max(a.x, b.x) > epsilon && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > epsilon;
}
function normalized(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/^\s*#{1,6}\s+/gm, '').replace(/^\s*(?:\d+\.\s+|[-*]\s+)/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`]/g, '').replace(/\s+/g, '').trim();
}
function geometry(raw) {
  const notes = (raw?.nodes || []).filter(n => n.sticky).map(n => ({ n, r: rect(n.sticky.rect || n.rect), w: Number.parseFloat(n.sticky.width) }));
  const ratios = notes.filter(({ r, w }) => r && w > 0).map(({ r, w }) => r.width / w);
  const scale = ratios.length ? ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length : null;
  return { scale, scaleConsistent: !!scale && ratios.length === notes.length && ratios.every(ratio => Math.abs(ratio - scale) < 0.0001) };
}
function relativeToRoot(file) { return path.relative(ROOT, file).replace(/\\/g, '/'); }
function safeFile(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Screenshot path missing');
  const resolved = path.resolve(ROOT, value), relative = path.relative(ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Screenshot is outside the new publication directory');
  const real = fs.realpathSync(resolved), realRelative = path.relative(ROOT, real);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw new Error('Screenshot resolves outside the publication directory');
  return real;
}
function pngStructure(bytes) {
  if (bytes.length < 45 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  let position = 8, dimensions, pixels = false;
  while (position + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(position), type = bytes.toString('ascii', position + 4, position + 8);
    if (length > bytes.length - position - 12) return null;
    if (!dimensions) {
      if (type !== 'IHDR' || length !== 13) return null;
      dimensions = { width: bytes.readUInt32BE(position + 8), height: bytes.readUInt32BE(position + 12) };
      if (!dimensions.width || !dimensions.height) return null;
    }
    if (type === 'IDAT') pixels = true;
    position += length + 12;
    if (type === 'IEND') return pixels && length === 0 && position === bytes.length ? dimensions : null;
  }
  return null;
}
function imageReference(value, day, role) {
  const original = safeFile(value), originalBytes = fs.readFileSync(original);
  let file = original, bytes = originalBytes, dimensions = pngStructure(bytes);
  if (!dimensions) {
    // Preserve the original capture, including JPEG bytes written with a .png suffix.
    const output = path.join(CANVAS, 'normalized', `day-${day}-${role}-${sha(originalBytes).slice(0, 12)}.png`);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    if (!fs.existsSync(output) || !pngStructure(fs.readFileSync(output))) {
      const python = process.env.ZVID_QA_PYTHON || 'C:/Users/menan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
      execFileSync(python, ['-c', 'from PIL import Image; import sys; im=Image.open(sys.argv[1]); im.load(); im.convert("RGB").save(sys.argv[2],"PNG")', original, output], { stdio: 'pipe' });
    }
    file = output; bytes = fs.readFileSync(file); dimensions = pngStructure(bytes);
  }
  if (!dimensions) throw new Error('Image is not a complete genuine PNG');
  return { path: `publication/${relativeToRoot(file)}`, sha256: sha(bytes), bytes: bytes.length, ...dimensions,
    originalCapture: `publication/${relativeToRoot(original)}`, originalSha256: sha(originalBytes), formatConverted: file !== original };
}
function pngView(value, day, role, errors) {
  try { return imageReference(value, day, role); }
  catch (error) { errors.push(`${role}: ${error.message}`); return null; }
}
function representativeReadable(item, png, bottomPng, bottomRequired, confirmed, canonicalMatches) {
  const bottomReadable = !!bottomPng && item?.bottomReadable === true && item.bottomCaptureSha256 === bottomPng.originalSha256;
  return !!png && item?.readable === true && item.captureSha256 === png.originalSha256 && item.scale >= 0.95 && confirmed === true && canonicalMatches === true && (!bottomRequired || bottomReadable);
}
function noteContentMatches(raw, workflow) {
  const map = new Map((raw?.nodes || []).map(node => [node.id, node]));
  return workflow.nodes.filter(node => node.type === STICKY).every(note => normalized(map.get(note.id)?.sticky?.text) === normalized(note.parameters.content));
}
function recordMatches(raw, workflow, day) {
  const expected = new Map(workflow.nodes.map(node => [node.id, node]));
  return raw?.day === day && raw.workflowId === `ZvidSeries2Day${day}` &&
    raw.url === `http://localhost:5678/workflow/ZvidSeries2Day${day}` && Array.isArray(raw.nodes) && raw.nodes.length === expected.size &&
    new Set(raw.nodes.map(n => n.id)).size === expected.size && raw.nodes.every(node => expected.get(node.id)?.name === node.name && expected.get(node.id)?.type === node.type) &&
    noteContentMatches(raw, workflow);
}
function auditDom(raw, workflow, day, labelRecords = []) {
  const errors = [], actual = new Map((raw?.nodes || []).map(node => [node.id, node]));
  const notes = workflow.nodes.filter(node => node.type === STICKY), functional = workflow.nodes.filter(node => node.type !== STICKY);
  const groups = workflow.meta?.seriesTwo?.groups || [];
  if (!recordMatches(raw, workflow, day)) errors.push('Actual node IDs/types/names or rendered note content differ from current canonical');
  if (!raw?.capturedAt || !Number.isFinite(Date.parse(raw.capturedAt))) errors.push('Native capture timestamp missing');
  const measured = geometry(raw), scale = measured.scale;
  if (!measured.scaleConsistent) errors.push('Rendered note scale is missing or inconsistent');
  const overview = notes.filter(note => note.parameters.color === 1);
  if (overview.length !== 1 || notes.length !== 11 || groups.length !== 10) errors.push('Current canvas must contain one overview and ten section notes');
  const noteResults = notes.map(note => {
    const observed = actual.get(note.id), sticky = observed?.sticky || {}, bounds = rect(sticky.rect || observed?.rect);
    const content = rect(sticky.textRect || sticky.contentRect);
    const headerHeight = note.parameters.color === 1 ? note.parameters.height : 170;
    const header = bounds && scale ? rect({ x: bounds.x, y: bounds.y, width: bounds.width, height: headerHeight * scale }) : null;
    const dimensionsMatch = Number.parseFloat(sticky.width) === note.parameters.width && Number.parseFloat(sticky.height) === note.parameters.height;
    const noScrollOverflow = ['clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight'].every(key => typeof sticky[key] === 'number') && sticky.scrollWidth <= sticky.clientWidth + 1 && sticky.scrollHeight <= sticky.clientHeight + 1;
    const textMatches = normalized(sticky.text) === normalized(note.parameters.content);
    const textFits = !!bounds && !!content && !!header && contains(bounds, content) && contains(header, content) && noScrollOverflow;
    if (!dimensionsMatch) errors.push(`${note.name}: rendered note dimensions differ`);
    if (!textMatches) errors.push(`${note.name}: rendered text differs`);
    if (!textFits) errors.push(`${note.name}: text does not fit its reserved header/overview bounds`);
    return { id: note.id, name: note.name, overview: note.parameters.color === 1, bounds, contentRect: content, headerRect: header, dimensionsMatch, textMatches, textFits,
      contentHeight: sticky.clientHeight ?? null, contentScrollHeight: sticky.scrollHeight ?? null, contentWidth: sticky.clientWidth ?? null, contentScrollWidth: sticky.scrollWidth ?? null };
  });
  const overlaps = [];
  for (let i = 0; i < noteResults.length; i++) for (let j = i + 1; j < noteResults.length; j++) {
    if (intersects(noteResults[i].bounds, noteResults[j].bounds)) overlaps.push({ kind: 'cards', first: noteResults[i].name, second: noteResults[j].name });
  }
  const assignment = new Map();
  for (const group of groups) {
    if (!Array.isArray(group.nodes) || group.nodes.length < 2) errors.push(`${group.note}: fewer than two functional nodes`);
    for (const name of group.nodes || []) {
      if (!functional.some(node => node.name === name)) errors.push(`${group.note}: unknown functional node ${name}`);
      assignment.set(name, [...(assignment.get(name) || []), group.note]);
    }
  }
  const validLabelRecords = [raw, ...labelRecords].filter(record => recordMatches(record, workflow, day) && geometry(record).scaleConsistent);
  const nodeResults = functional.map(node => {
    const membership = assignment.get(node.name) || [], observed = actual.get(node.id), own = noteResults.find(note => note.name === membership[0]);
    const body = rect(observed?.rect);
    const bodyCovered = membership.length === 1 && !!own && contains(own.bounds, body) && (!own.contentRect || !intersects(own.contentRect, body));
    const candidates = validLabelRecords.map(record => ({ record, observed: record.nodes.find(n => n.id === node.id) })).filter(value => rect(value.observed?.labelRect));
    const labelSource = candidates.at(-1), label = rect(labelSource?.observed?.labelRect);
    const labelGroup = labelSource?.record.nodes.find(n => n.name === membership[0] && n.sticky);
    const groupBounds = rect(labelGroup?.sticky?.rect || labelGroup?.rect);
    const groupText = rect(labelGroup?.sticky?.textRect || labelGroup?.sticky?.contentRect);
    const visibleBounds = union(labelSource?.observed?.rect, label);
    const labelCovered = membership.length === 1 && !!label && !!groupBounds && contains(groupBounds, visibleBounds) && (!groupText || !intersects(groupText, visibleBounds));
    if (!bodyCovered) errors.push(`${node.name}: icon does not belong wholly to one intended section without hitting note text`);
    if (!labelCovered) errors.push(`${node.name}: actual label bounds missing or outside intended section`);
    for (const other of noteResults.filter(note => note.name !== membership[0])) if (intersects(other.bounds, body)) overlaps.push({ kind: 'node_other_card', first: node.name, second: other.name });
    return { id: node.id, name: node.name, section: membership[0] || null, membershipCount: membership.length, bodyRect: body, bodyCovered,
      labelRect: label, visibleBounds, labelCovered, labelSourceCapturedAt: labelSource?.record.capturedAt || null, labelSourceScale: labelSource ? geometry(labelSource.record).scale : null };
  });
  for (let i = 0; i < nodeResults.length; i++) for (let j = i + 1; j < nodeResults.length; j++) {
    if (intersects(nodeResults[i].bodyRect, nodeResults[j].bodyRect)) overlaps.push({ kind: 'functional_nodes', first: nodeResults[i].name, second: nodeResults[j].name });
    if (nodeResults[i].labelSourceCapturedAt && nodeResults[i].labelSourceCapturedAt === nodeResults[j].labelSourceCapturedAt && intersects(nodeResults[i].visibleBounds, nodeResults[j].visibleBounds)) overlaps.push({ kind: 'node_labels', first: nodeResults[i].name, second: nodeResults[j].name });
  }
  if (overlaps.length) errors.push('Actual rendered cards or functional nodes overlap');
  return { actualNodeCount: raw?.nodes?.length || 0, expectedNodeCount: workflow.nodes.length, functionalNodeCount: functional.length,
    noteCount: notes.length, sectionCount: groups.length, renderedScale: scale, viewportTransform: raw?.viewportTransform ?? null,
    nativeContentMatches: recordMatches(raw, workflow, day), allTextFits: noteResults.every(note => note.textFits),
    allNodeIconsCovered: nodeResults.every(node => node.bodyCovered), allFunctionalNodesCovered: nodeResults.every(node => node.bodyCovered && node.labelCovered),
    actualLabelBoundsCount: nodeResults.filter(node => node.labelRect).length, overlaps, notes: noteResults, nodes: nodeResults, errors: [...new Set(errors)] };
}
function readabilityFor(day, workflow, record, evidence, errors) {
  const days = evidence?.workflows || [], item = days.find(value => Number(value.day) === day) || {};
  const overviewPath = record.overviewPng || item.overviewPng;
  const overviewPng = overviewPath ? pngView(overviewPath, day, 'overview', errors) : null;
  const inspectionConfirmed = evidence?.rootConfirmed === true || evidence?.inspectorConfirmed === true;
  const overviewReadable = !!overviewPng && item.overviewReadable === true && item.overviewCaptureSha256 === overviewPng.originalSha256 && inspectionConfirmed;
  const expected = (workflow.meta?.seriesTwo?.groups || []).map(group => group.note);
  const sections = (evidence?.sections || []).filter(value => Number(value.day) === 31);
  const representativeFile = path.join(N8N, 'workflows', `zvid-${adapters[31].slug}.json`);
  const representativeBytes = fs.readFileSync(representativeFile);
  const representativeWorkflow = JSON.parse(representativeBytes);
  const canonicalMatches = evidence?.representativeWorkflowSha256 === sha(representativeBytes);
  const representativeSections = expected.map((name, index) => {
    const item = sections.find(value => value.noteName === name || value.section === index + 1);
    const png = item?.png ? pngView(item.png, 31, `section-${index + 1}`, errors) : null;
    const note = representativeWorkflow.nodes.find(node => node.name === name && node.type === STICKY);
    // Tall groups have a third row below the editor viewport at 100% zoom.
    const bottomRequired = !!note && note.parameters.height > 700;
    const bottomPng = item?.bottomPng ? pngView(item.bottomPng, 31, `section-${index + 1}-bottom`, errors) : null;
    const bottomReadable = !!bottomPng && item.bottomReadable === true && item.bottomCaptureSha256 === bottomPng.originalSha256;
    return { noteName: name, png, bottomRequired, bottomPng, bottomReadable,
      readable: representativeReadable(item, png, bottomPng, bottomRequired, inspectionConfirmed, canonicalMatches) };
  });
  const sectionsReadable = representativeSections.length === 10 && representativeSections.every(view => view.readable);
  return { overviewPng, readableOverview: overviewReadable, representativeSectionsReadable: sectionsReadable, representativeSections };
}
function build() {
  fs.mkdirSync(CANVAS, { recursive: true });
  const imports = read(path.join(ROOT, 'infra-import-audit.json'));
  const readability = read(path.join(ROOT, 'upgraded-canvas-readability.json'));
  const workflows = Object.values(adapters).sort((a, b) => a.day - b.day).map(adapter => {
    const canonicalFile = path.join(N8N, 'workflows', `zvid-${adapter.slug}.json`), bytes = fs.readFileSync(canonicalFile);
    const workflow = JSON.parse(bytes.toString('utf8')), hash = functionalHash(workflow), artifactSha256 = sha(bytes);
    const workflowId = `ZvidSeries2Day${adapter.day}`, rawFile = path.join(CANVAS, `day-${adapter.day}-dom.json`), raw = read(rawFile);
    const record = raw || { day: adapter.day, workflowId, nodes: [] }, errors = [];
    const imported = imports?.workflows?.find(item => Number(item.day) === adapter.day && item.passed === true && item.canonicalFunctionalHash === hash && item.installedFunctionalHash === hash);
    if (!imported) errors.push('Current native installed workflow hash is not verified');
    if (!raw) errors.push('Fresh native DOM capture missing');
    const extraFiles = fs.readdirSync(CANVAS).filter(name => new RegExp(`^day-${adapter.day}-.+-dom\\.json$`).test(name));
    const labelRecords = extraFiles.map(name => read(path.join(CANVAS, name))).filter(Boolean);
    const dom = auditDom(record, workflow, adapter.day, labelRecords);
    errors.push(...dom.errors);
    const fitPng = record.fitPng ? pngView(record.fitPng, adapter.day, 'fit', errors) : null;
    if (!fitPng) errors.push('Fresh full workflow PNG missing');
    const readable = readabilityFor(adapter.day, workflow, record, readability, errors);
    const fitReview = readability?.workflows?.find(item => Number(item.day) === adapter.day);
    const fitVisuallyInspected = !!fitPng && fitReview?.fitInspected === true && fitReview.fitCaptureSha256 === fitPng.originalSha256 && (readability?.rootConfirmed === true || readability?.inspectorConfirmed === true);
    if (!fitVisuallyInspected) errors.push('Actual full workflow PNG visual inspection pending');
    if (!readable.readableOverview) errors.push('Fresh readable overview PNG/review pending');
    if (!readable.representativeSectionsReadable) errors.push('Representative actual section screenshots at 100% and readability review pending');
    const titleMatches = typeof record.title === 'string' && record.title.includes(adapter.title) && new RegExp(`(?:D|Day\\s*)${adapter.day}\\b`).test(record.title);
    if (!titleMatches) errors.push('Actual workflow title does not identify this day and use case');
    const result = { day: adapter.day, workflowId, functionalHash: hash, artifactSha256, canonicalSha256: artifactSha256,
      capturedAt: record.capturedAt || null, observedUrl: record.url || null, observedTitle: record.title || null, titleMatches,
      actualCanvasInspected: !!raw && !!fitPng && dom.nativeContentMatches && !!imported,
      inspected: !!raw && !!fitPng && dom.nativeContentMatches && !!imported,
      ...dom, ...readable, fitPng, fitVisuallyInspected, overlap: dom.overlaps, passed: errors.length === 0, errors: [...new Set(errors)],
      rawDom: raw ? { path: `publication/${relativeToRoot(rawFile)}`, sha256: sha(fs.readFileSync(rawFile)) } : null,
      labelDom: extraFiles.map(name => { const file = path.join(CANVAS, name); return { path: `publication/${relativeToRoot(file)}`, sha256: sha(fs.readFileSync(file)) }; }),
    };
    const proofFile = path.join(CANVAS, `day-${adapter.day}-proof.json`);
    fs.writeFileSync(proofFile, JSON.stringify(result, null, 2) + '\n');
    result.flowluArtifact = { path: `publication/${relativeToRoot(proofFile)}`, sha256: sha(fs.readFileSync(proofFile)) };
    return result;
  });
  const report = { schemaVersion: 1, capturedAt: new Date().toISOString(), method: 'Fresh root native readonly DOM captures and actual screenshots, independently aggregated; no prior-generation evidence',
    childNativeCaptureAvailable: false, oldCanvasEvidenceExcluded: true, totalExpected: 30, totalCaptured: workflows.filter(w => w.actualCanvasInspected).length,
    totalTextFits: workflows.filter(w => w.allTextFits && w.nativeContentMatches).length,
    totalIconsCovered: workflows.filter(w => w.allNodeIconsCovered && w.nativeContentMatches).length,
    totalLabelsCovered: workflows.filter(w => w.allFunctionalNodesCovered && w.nativeContentMatches).length,
    totalReadableOverviews: workflows.filter(w => w.readableOverview).length, totalPassed: workflows.filter(w => w.passed).length,
    allPassed: workflows.every(w => w.passed), workflows };
  fs.writeFileSync(path.join(ROOT, 'upgraded-canvas-audit.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ totalExpected: report.totalExpected, totalCaptured: report.totalCaptured, textFits: report.totalTextFits, iconsCovered: report.totalIconsCovered, labelsCovered: report.totalLabelsCovered, readableOverviews: report.totalReadableOverviews, passed: report.totalPassed }));
  return report;
}
if (require.main === module) build();
module.exports = { rect, union, contains, intersects, normalized, geometry, pngStructure, recordMatches, auditDom, representativeReadable, readabilityFor, build };
