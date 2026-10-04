/**
 * Build inspectable Flowlu registration payloads for the second 30-workflow series.
 * This module never contacts Flowlu and never reads credentials.
 * Native MCP performs preview/confirm writes using the generated plan.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const FLOWLU = Object.freeze({
  projectId: 6,
  projectName: 'Zvid Workflow Launches',
  projectKey: 'ZWL',
  workflowId: 3,
  storyTypeId: 3,
  taskTypeId: 1,
  stages: { Backlog: 9, Ready: 10, 'In Progress': 11, Blocked: 12, Review: 13, Done: 14 },
});
export const CHILDREN = Object.freeze([
  '[Build] Create n8n workflow',
  '[Build] Create Make workflow',
  '[Release] Publish/verify in n8n Cloud',
  '[Release] Publish/verify in Make',
  '[Community] Publish to n8n community',
  '[Asset] Capture n8n workflow screenshot',
  '[Asset] Capture Make workflow screenshot',
  '[Example] Create and test Node.js script',
  '[YouTube] Produce video',
  '[YouTube] Create thumbnail',
  '[Social] Write LinkedIn post',
  '[Social] Write Reddit post',
  '[Article] Write Hashnode post',
  '[Article] Write dev.to post',
]);
const EVIDENCE = {
  '[Build] Create n8n workflow': 'Canonical JSON path plus successful validation and local Docker n8n manual execution.',
  '[Build] Create Make workflow': 'Canonical Make blueprint path plus successful validation and execution.',
  '[Release] Publish/verify in n8n Cloud': 'Verified live workflow/template URL or provider identifier and verification note.',
  '[Release] Publish/verify in Make': 'Verified live scenario/template URL or provider identifier and verification note.',
  '[Community] Publish to n8n community': 'Verified live n8n community listing URL or provider identifier and verification note.',
  '[Community] Publish to Shopify community': 'Verified live Shopify community listing URL or provider identifier and verification note.',
  '[Asset] Capture n8n workflow screenshot': 'Actual n8n canvas PNG path or Flowlu attachment, visually inspected.',
  '[Asset] Capture Make workflow screenshot': 'Actual Make scenario PNG path or Flowlu attachment, visually inspected.',
  '[Example] Create and test Node.js script': 'Script path plus successful command and test result.',
  '[YouTube] Produce video': 'Accepted final video file or verified published URL. An unpublished draft remains in Review.',
  '[YouTube] Create thumbnail': 'Final image path or attachment.',
  '[Social] Write LinkedIn post': 'Verified published LinkedIn post URL. An unpublished draft remains in Review.',
  '[Social] Write Reddit post': 'Verified published Reddit post URL. An unpublished draft remains in Review.',
  '[Article] Write Hashnode post': 'Verified published Hashnode article URL. An unpublished draft remains in Review.',
  '[Article] Write dev.to post': 'Verified published dev.to article URL. An unpublished draft remains in Review.',
};
export function esc(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}
export function validateHtml(html) {
  const allowed = new Set(['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'code', 'pre', 'blockquote', 'hr', 'a']);
  for (const match of html.matchAll(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi)) {
    if (!allowed.has(match[1].toLowerCase())) throw new Error('Unsupported HTML tag: ' + match[1]);
    const attrs = match[2].trim();
    if (attrs && !/^href="https:\/\/[^"]*"$/.test(attrs)) throw new Error('Unsupported HTML attribute');
  }
  if (/(^|\n)\s*#{1,6}\s|\*\*|\x60{3}/.test(html)) throw new Error('Raw Markdown control content');
  if (!html.includes('<h2>Launch status</h2>')) throw new Error('Missing launch status section');
  return html;
}
export function normalize(entry) {
  const filename = entry.filename || entry.file || (entry.slug && 'zvid-' + entry.slug + '.json');
  if (!/^zvid-[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(filename || '')) throw new Error('Invalid canonical n8n filename');
  const slug = filename.slice(5, -5);
  if (entry.slug && entry.slug !== slug) throw new Error('Slug does not match filename');
  const title = entry.title || entry.name;
  if (!title) throw new Error('Workflow title required');
  const source = 'zvid-integrations/n8n/workflows/' + filename;
  const shopify = entry.shopify === true || /shopify/i.test(title + ' ' + source + ' ' + (entry.purpose || ''));
  return {
    ...entry, filename, slug, title, source, shopify,
    contentDirectory: entry.contentDirectory || 'zvid-integrations/n8n/local-test/series-2',
  };
}
export function parentDescription(entry) {
  return validateHtml('<h2>Launch status</h2><p>The current request creates and manually tests this n8n automation in local Docker n8n. The n8n build is In Progress; all other launch work remains Backlog until independently completed. No public publication has been performed.</p>' +
    '<h2>Managed workflow</h2><ul>' +
    '<li>Managed by: flowlu-workflow-launch</li>' +
    '<li>Workflow slug: <code>' + esc(entry.slug) + '</code></li>' +
    '<li>n8n source: <code>' + esc(entry.source) + '</code></li>' +
    '<li>Make source: Not created</li>' +
    '<li>Content directory: <code>' + esc(entry.contentDirectory) + '</code></li>' +
    '<li>n8n cloud URL: Not published</li><li>Make cloud URL: Not published</li></ul>' +
    '<h2>Work item</h2><p>' + esc(entry.purpose || entry.title) + '</p>' +
    '<h2>Completion evidence</h2><p>Canonical workflow, validation, local Docker n8n execution, inspected canvas, and resulting media evidence will be recorded as verified.</p>' +
    '<h2>Next action</h2><p>Complete and verify the n8n build. Keep this Story open until every required launch child is Done or explicitly completed as out of scope with a recorded reason.</p>');
}
export function childDescription(entry, title, stage) {
  const active = title === CHILDREN[0];
  const details = active
    ? 'Build the canonical publishable n8n automation and manually test it in the local Docker n8n editor.'
    : title.replace(/^\[[^\]]+\]\s*/, '');
  const dependencies = active
    ? 'Apply the repository workflow-template authoring guide, use the scoped Zvid community node for supported operations, and verify the actual imported canvas and execution.'
    : 'Complete and validate the applicable platform build first. The current request covers n8n preparation and local Docker n8n manual testing; this later launch item is retained in the checklist.';
  let extra = '';
  if (/\[(Social|Article|Community)\]/.test(title)) {
    extra = '<p>Written launch content must retain <code>{{YOUTUBE_VIDEO_URL}}</code> until a verified public video URL is available. Public distribution requires separate authorization.</p>';
  }
  return validateHtml('<h2>Launch status</h2><ul>' +
    '<li>Stage: ' + esc(stage) + '</li>' +
    '<li>Workflow slug: <code>' + esc(entry.slug) + '</code></li>' +
    '<li>Source: <code>' + esc(entry.source) + '</code></li>' +
    '<li>Publication state: Not published</li></ul>' +
    '<h2>Work item</h2><p>' + esc(details) + '</p>' +
    '<h2>Dependencies</h2><p>' + esc(dependencies) + '</p>' + extra +
    '<h2>Completion evidence</h2><p>Required: ' + esc(EVIDENCE[title]) + '</p><p>No completion is claimed at registration.</p>' +
    '<h2>Next action</h2><p>' + (active ? 'Generate the workflow, validate it, import it into Docker n8n, execute it manually, and record verifiable results.' : 'Complete this launch item when requested, then record the contract evidence before advancing it.') + '</p>');
}
export function createPlan(entries) {
  const normalized = entries.map(normalize);
  if (new Set(normalized.map(x => x.slug)).size !== normalized.length) throw new Error('Duplicate workflow slugs');
  return {
    createdFor: 'User request for 30 more n8n automations with manual Docker n8n testing',
    scope: 'Only new canonical workflows in the supplied second-series manifest',
    project: FLOWLU,
    workflows: normalized.map(entry => {
      const titles = [...CHILDREN];
      if (entry.shopify) titles.splice(5, 0, '[Community] Publish to Shopify community');
      return {
        ...entry,
        parent: {
          name: '[Workflow] ' + entry.title,
          description: parentDescription(entry),
          project_id: FLOWLU.projectId,
          type_id: FLOWLU.storyTypeId,
          workflow_stage_id: FLOWLU.stages['In Progress'],
          priority: 40,
        },
        children: titles.map(title => {
          const stage = title === CHILDREN[0] ? 'In Progress' : 'Backlog';
          return { name: title, description: childDescription(entry, title, stage), project_id: FLOWLU.projectId, type_id: FLOWLU.taskTypeId, workflow_stage_id: FLOWLU.stages[stage], priority: 40 };
        }),
      };
    }),
  };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: node flowlu-plan.mjs <catalog.json> <flowlu-registration-plan.json>');
  const catalog = JSON.parse(readFileSync(input, 'utf8'));
  const plan = createPlan(Array.isArray(catalog) ? catalog : catalog.workflows || catalog.items);
  writeFileSync(output, JSON.stringify(plan, null, 2) + '\n');
  console.log(JSON.stringify({ workflows: plan.workflows.length, stories: plan.workflows.length, children: plan.workflows.reduce((sum, x) => sum + x.children.length, 0), output }));
}

