# Current canvas aggregation

The child CUA session exposes no browsers. This builder uses fresh root-captured native browser records and screenshot files; it never invokes UI/state APIs or uses the earlier generation-only canvas evidence.

Run `node local-test/series-2/publication/build-upgraded-canvas-audit.js` from the n8n directory. The output is `upgraded-canvas-audit.json` and `canvas/day-XX-proof.json`. The latter has the exact canonical hash and genuine PNG references expected by the Flowlu readiness helper. Only real supplied captures can pass.

## Native DOM records

Save `canvas/day-XX-dom.json` with the supplied schema: day, workflowId, URL, observed title, capturedAt, fitPng and nodes. Each node has id, name, type and rendered rect. Each note additionally has sticky style dimensions, actual note rect, rendered text, content/text rect, client and scroll dimensions. Functional nodes need an actual labelRect. When labels require a separate capture, save `canvas/day-XX-labels-dom.json` with the same complete native node/note schema after using the Reset Zoom control. Only records matching all current IDs/types/names and rendered note content supply label evidence.

The builder derives scale from actual note rect/style width ratios when the supplied viewport selector has no transform. It measures text inside the 170-pixel section header or full overview height, checks native scroll overflow, checks card/icon collisions, and requires every icon and actual label to fit one intended section without hitting its note text. Missing labels remain pending. Intentionally enclosing nodes inside their own section is not treated as an overlap.

## Readability record

Save `upgraded-canvas-readability.json` after actual image review. The child can set `inspectorConfirmed: true` after inspecting captures with `view_image`; this does not claim root completion. Per-view original capture hashes must match the reviewed bytes:

```json
{
  "inspectorConfirmed": true,
  "representativeWorkflowSha256": "<exact current Day31 canonical SHA-256>",
  "workflows": [
    { "day": 31, "fitInspected": true, "fitCaptureSha256": "<original SHA-256>", "overviewPng": "canvas/day-31-overview.png", "overviewCaptureSha256": "<original SHA-256>", "overviewReadable": true }
  ],
  "sections": [
    { "day": 31, "section": 1, "noteName": "1. Configure and read saved state", "png": "canvas/day-31-section-1.png", "captureSha256": "<original SHA-256>", "scale": 1, "readable": true }
  ]
}
```

Supply all 30 overview views and all ten representative Day31 section views at 100% (scale at least 0.95). Tall sections 2, 4 and 8 also require their three lower-row views, recorded as `bottomPng`, `bottomCaptureSha256` and `bottomReadable: true`. The section layout/font is shared; each day's distinct policy and overview text is separately checked by its actual DOM measurements. No image is declared readable solely because its file exists. Readability flags must follow actual visual inspection. `record-upgraded-canvas-review.js` records each day's fit/overview image hashes only after those captures were actually inspected. `record-upgraded-section-review.js` records the 13 actually inspected representative images and binds them to the exact current Day31 canonical bytes.

PNG files must exist inside the new publication directory and contain complete PNG structure. If a capture contains JPEG bytes with a PNG filename, the builder preserves that original and converts only the format to a separate `canvas/normalized` PNG with Pillow. Both original and PNG hashes are recorded. Image content is not regenerated.

`passed` remains false while capture, matching import, clipping, coverage, label bounds, overview or representative readability proof is missing. This report does not close Flowlu or replace the main catalog.
