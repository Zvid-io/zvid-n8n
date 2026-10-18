# Daily motivational quote videos — launch package

Prepared 2026-10-14 for Flowlu Story **ZWL-64**, issue **346**, in **Zvid Workflow Launches**.

This is the first campaign pilot. The n8n template is public. The supplied YouTube video currently reports private; the owner confirmed they will make it Public or Unlisted. The Zvid article is saved as production draft **77**, with a NeuronWriter score of **82/100** after five evaluations. The platform drafts remain unpublished. No weekly automation or publication schedule has been enabled.

[Review the saved blog preview](https://zvid.io/preview/blog/77) · [Edit the production draft](https://app.zvid.io/blogs/77/edit). See [blog-production.md](blog-production.md) for metadata, outline, structured data and media evidence, and [blog-verification.md](blog-verification.md) for checks and delivery details.

## Drafts and angles

| Destination | Angle | Draft |
| --- | --- | --- |
| Zvid blog | Searchable, complete n8n setup guide | [zvid-blog.md](zvid-blog.md) |
| DEV.to | Real output first, step-by-step setup, working code and customization | [devto.md](devto.md) |
| LinkedIn | Repetitive production work and editorial control | [linkedin.md](linkedin.md) |
| Reddit | Discussion about individual versus batch review, with affiliation disclosed | [reddit.md](reddit.md) |
| n8n Community | Recurring-content use case, output, costs and boundaries | [n8n-community.md](n8n-community.md) |
| Existing Zvid workflow page | Correct outdated setup and connect the tutorial | [website-workflow-update.md](website-workflow-update.md) |

The Zvid blog is the source article. The other drafts adapt its verified facts for their audiences; each draft serves a different audience. Shopify Community is not applicable.

The DEV.to tutorial includes verified code examples. The existing architecture diagram remains available as a reusable asset. See [technical article verification](technical-article-verification.md) for source checks, media links and Flowlu attachments.

## Verified links

- Official template: https://n8n.io/workflows/19632-create-daily-quote-videos-from-google-sheets-with-zvid/
- Existing walkthrough: https://youtu.be/Ra6mPdmDDYs
- Shared repository: https://github.com/Zvid-io/workflow-examples
- Published example: https://github.com/Zvid-io/workflow-examples/tree/main/workflows/daily-quote-reels
- Existing workflow page: https://zvid.io/n8n/workflows/google-sheets-daily-quote-videos
- Documentation: https://docs.zvid.io
- API keys: https://app.zvid.io/api-keys
- Customer help: https://zvid.io/contact

The tested example is now published in the shared repository, including its real sample MP4, poster, source project, tests and synchronized n8n export. GitHub CI passed for commit `28184f7fd4850b2e53b4e690ba7ae84b0725700c`. The existing workflow page is live, but its old core-node / Header Auth instructions need the supplied correction. The blog includes a direct canonical JSON download; the official n8n template remains available as an alternative.

## Release order and dependencies

1. Completed: the tested example is public at `Zvid-io/workflow-examples/workflows/daily-quote-reels`, including the required structure and a real sample output. All new workflow examples belong in this shared repository. The old standalone repository remains intact.
2. Apply `website-workflow-update.md` to the existing workflow page. Keep its established URL. Replace the old download JSON with the synchronized native-node export if that CMS asset is still the older version.
3. Publish the original Zvid blog guide. Record its actual URL in `links.json`; no unpublished URL is represented as live here.
4. Add the verified blog URL as a further-reading link in DEV.to. If choosing to syndicate a substantially identical article instead of this adaptation, configure its canonical URL to the published original using that platform's supported publishing settings.
5. Review and submit the adapted articles, LinkedIn post, n8n Community post, and Reddit discussion manually. Confirm each destination's current posting rules and suitable category immediately before submission. The proposed Reddit destination is r/n8n, subject to its rules; no acceptance is assumed.
6. Record each final publication URL in Flowlu and move that specific task to Done. Keep unpublished drafts in Review.

YouTube production remains manual, as requested. The supplied video is already public. The YouTube thumbnail task has no supplied final-image artifact and is left for the owner to resolve. The separate blog cover now uses a reviewed teal-and-gold gradient.

## Suggested metadata

- Blog title: Automate Daily Motivational Quote Videos with n8n and Zvid
- Proposed blog slug: `automate-daily-quote-videos-n8n-google-sheets` (not yet a live URL).
- Meta description: Automate daily motivational quote videos with n8n, Google Sheets, and Zvid. Preview, render, and review each MP4, with a tested Node.js option.
- Primary topic: daily quote video automation.
- Related topics: n8n Google Sheets video workflow; motivational quote video automation; Node.js video generation.
- DEV.to suggested tags: `javascript`, `node`, `automation`, `tutorial` (verify accepted tags when posting).
- Blog hero and inline diagram: native Zvid image renders recorded in `blog-media-manifest.json`; the article also embeds the real sample output.
- Actual complete n8n canvas screenshot is embedded in the article and remains available at `zvid-examples/workflow-examples/workflows/daily-quote-reels/assets/workflow.png`.

Do not add a VideoObject or other structured-data claim that requires unverified upload dates, thumbnails, or publication metadata. The article's visible answers and verified links are sufficient for this draft.

## Verification and artifact locations

See [verification.md](verification.md) for the checked behavior, test results, and limitations. The durable source is `zvid-integrations/n8n/workflows/zvid-daily-quote-reels.json`; the updated example uses the same JSON. Scratch evidence and a portable example ZIP are under `.local/reports/2026-10-14-daily-quote-campaign/`.

The owner approved the initial Flowlu batch on 2026-10-14. All 11 original Story/Task updates were saved and read back with exact description and stage matches. The shared-repository follow-up updates the code links and records the published Node.js example as Done; its Flowlu readback is recorded in the verification report.

Current verified Flowlu counts: 5 Done, 5 Review, 1 Backlog, 0 Blocked. The Story remains In Progress with 6 remaining items across 11 children.

The earlier code ZIP attached to the Node.js example Task (issue 354, file 30) is a historical standalone-layout snapshot; use the shared repository for the current version. The workflow PNG is attached to the screenshot Task (issue 352, file 31) and published in the shared repository. Article/social publication and the three-workflows-per-week automation are still separate future steps.

Hashnode was removed from the campaign on 2026-10-14 at the owner's request. Its Flowlu child was deleted and its former draft is retained only under `archive/removed-platforms/`; do not include it in publication or weekly scheduling.
