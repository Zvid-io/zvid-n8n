# Daily quote blog — usability revision verification

Production draft **77** updated on 2026-10-14. Status remains `draft`; `publishedAt` remains null. No public publication action was called.

- [Saved private preview](https://zvid.io/preview/blog/77)
- [Edit draft](https://app.zvid.io/blogs/77/edit)
- **NeuronWriter: 82/100**, evaluation 4 of 5. History: 83, 83, 78, 82. The first two versions predate the new requirements; revision 4 is the highest-scoring version meeting the updated brief.

## Requested improvements

1. YouTube walkthrough embedded immediately after the introduction, with video-learning guidance and a fallback link. The embed loads, but YouTube now reports the supplied video is private. Playback requires the owner to make it Public/Unlisted or supply a replacement URL; no visibility change was made.
2. Direct workflow JSON download appears near the top and again in the final CTA. CDN returns `application/json` and attachment filename `zvid-daily-quote-reels.json`.
3. Stronger next actions: download/import, create API key, free validation, paid render, review, then activate the schedule.
4. Complete actual n8n canvas screenshot plus a readable overview diagram and explicit main-route explanation. Import the JSON for detailed node-level zoom; the screenshot is 700×515.
5. Prerequisites table, a clearly labelled 20–30 minute setup estimate, first-run outcome and cost checkpoint before the steps.
6. Five numbered steps, short paragraphs, bold checkpoints and tables; the sample-output video is constrained to a readable portrait width.
7. Dedicated troubleshooting section covers 11 common problems, including credentials, missing nodes, preview limits, credits, timeouts, row updates and clipped text.
8. Distinct teal-and-gold cover, rendered with Zvid, reviewed at 1200×630 and archived unchanged to the blog CDN.

## Verification and provenance

The updated response exactly matches the submitted content, cover and structured data. Independent production preview confirms one H1, all three images loaded, the supplied YouTube player displaying its private-video notice, visible setup/download sections and retained draft status. At a 390px viewport, the iframe is about 343×193px and neither table overflows; desktop iframe is 1024×576px. The sample MP4 is limited to 360px width.

Downloaded JSON is byte-identical to `zvid-integrations/n8n/workflows/zvid-daily-quote-reels.json`: SHA-256 `a2e72e40e5f1b8faaf514568ac2beb99bc0c533d646f1ef9ed49d9527387abea`. It parses with 29 nodes, uses the scoped native Zvid node types and includes no credentials. New cover, screenshot and JSON all returned HTTP 200 with matching hashes. The underlying workflow and Node.js implementation were not changed; the earlier 14 tests and real render evidence remain applicable.

New cover render: `6fdb724f-03eb-4cfc-9831-2b464e08d727`, one-credit validation, zero warnings. Existing diagram and real 10.8-second example video reused. Artwork render URLs expire after seven days, so reviewed bytes are preserved in the existing blog CDN storage. The actual canvas screenshot is explicitly documented as a user-requested supplement to native artwork.

## Site fix required for working embeds

The saved preview initially produced YouTube Error 153 because its sanitizer forced `no-referrer` on allowlisted video frames. The fix sends only the site origin (`strict-origin`) for those frames while keeping private-document `no-referrer`, authentication, noindex and no-store protections. Untrusted iframe hosts and active HTML remain blocked. Responsive iframe sizing and a 360px maximum for sample videos prevent oversized media.

Seven targeted preview/security tests passed; the isolated production build succeeded. Only the landing service was rolled from `zvid/zvid-landing:2026-10-14_1140` to `zvid/zvid-landing:2026-10-14_blog77-media`, using its existing start-first and automatic rollback settings. The image was built from deployed commit `777282fdb62d4a9a2b52a12fbb8d9a8ddca03f83` plus the three-file patch retained with this report. No credentials or private environment files entered the build package.

Full source: `blog-production.md`; public article body: `zvid-blog.md`; media provenance: `blog-media-manifest.json`; measured SEO snapshots: `blog-neuronwriter.json`. Detailed scratch evidence is under `.local/reports/2026-10-14-daily-quote-blog/`, including `revision-ui.json`, `revision-asset-verification.json`, `landing-preview-fix.patch` and production screenshots.

The Flowlu blog child belongs in Review. Public publication and recording the resulting URL remain owner actions. The separate YouTube thumbnail task remains unchanged.

Owner response: the same YouTube video will be made Public or Unlisted. No replacement URL or article edit is required; playback is pending that visibility change. Flowlu issue 1272 is Review and Story 346 remains In Progress; both updated descriptions were read back and matched exactly after newline normalization.

## Final sample-sheet revision

The owner requested a table instead of CSV source code. Draft 77 now renders a five-column table with the exact headers `Quote`, `Author`, `AuthorNote`, `Status`, `VideoUrl`. The matching CSV contains the same one example row and intentionally blank status/output cells. A direct download link and Google Sheets import instruction appear immediately beneath it.

CDN verification returned HTTP 200, `text/csv;charset=utf-8`, attachment filename `daily-quote-example.csv`, and matching SHA-256 `7433d9c3feeec3ae9238ed05e7678efe343649cd7499ae2a0c0b59678cf19dbc`. CSV parsing confirms five headers, one data row, and two empty final fields. The saved production preview shows the table and link with no CSV code block. Production API response confirms draft status and no publication date.

The fifth and final NeuronWriter evaluation is **82/100**, selected as the current version. Final score history: 83, 83, 78, 82, 82. No further evaluation allowance remains under the current five-attempt limit. Local CSV: `data/daily-quote-example.csv`; verification: `.local/reports/2026-10-14-daily-quote-blog/example-sheet-verification.json`.

Flowlu Story 346 (ZWL-64) and blog child 1272 were updated and read back with matching descriptions. The child returned to Review; the Story remains In Progress with 7 remaining launch items. Screenshot proof: `.local/reports/2026-10-14-daily-quote-blog/production-example-sheet.png`.
