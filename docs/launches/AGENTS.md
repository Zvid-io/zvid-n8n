# Workflow launch blog requirements

For Zvid workflow blog articles, use the production process in
`D:/Codex/Zvid Blogs/blog-system/prompts/daily-zvid-blog.md` as the editorial
reference, alongside the Flowlu workflow launch skill and repository rules.

- Target a NeuronWriter content score of at least 80. Use no more than five
  scoring evaluations per article, retain every measured revision, and choose
  the highest-scoring version that remains accurate and useful. Never add
  unsupported claims or repetitive keywords merely to raise the score.
- Score only reader-facing article HTML. Keep the outline, internal QA, media
  manifest and structured-data source out of scored content.
- Save workflow blog launches to production as drafts under the owner's
  requested workflow. Do not publish them publicly without a publication request.
- Verify draft status and publication date from the server response and saved
  preview. If the automation GET route is unavailable, use the existing admin
  editor/preview rather than treating a 404 as proof no draft exists.
- Check related links against the live published-blog list, not local post
  files: some local guides have never been published.
- The CMS supplies the main title. Preserve H1 in the authoring/scoring source,
  but omit a repeated title from the submitted Markdown body. Match structured
  data to the visible byline and FAQ answers.
- Render final artwork through Zvid and inspect actual output. Check media
  retention before using render URLs in a durable blog. Preserve reviewed bytes
  in the existing blog CDN storage when render links expire, recording source
  job IDs, original URLs, hashes and the delivery exception in the manifest.
- Keep the full publication source, scoring evidence, media manifest, draft
  editor/preview URLs and verification notes with the launch package. Update the
  Flowlu blog child to Review; Done requires a verified public article URL.
- When a walkthrough is supplied, embed it directly after the introduction and
  include a fallback link. Verify actual player loading/playback in the saved
  preview; merely finding an iframe is not sufficient.
- Put a direct, importable workflow JSON download near the start. Verify its
  bytes against the canonical export, valid public node types, absence of
  credentials, and attachment download headers. Link it again in the final CTA.
- Show the complete actual workflow canvas alongside a readable architecture
  overview. A screenshot of the real workflow supplements generated artwork.
- Put prerequisites, a clearly labelled setup-time estimate, first-run outcome
  and cost checkpoint before the tutorial steps. Use short sections, checklists,
  and a dedicated troubleshooting section with concrete recovery actions.
- CTAs should tell readers exactly what to do next: import, create an API key,
  preview, render and review. Retain the workflow's real limitations.
- Choose a distinct background-gradient palette for each new blog thumbnail;
  keep typography and brand treatment consistent without repeating one palette.
