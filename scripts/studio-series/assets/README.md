# Approved Zvid studio-series design source

These 30 payloads are the approved Days 31–60 designs, including the distinct music selected for Days 31–50 and repaired narration for Days 57 and 59. They are authoring inputs for `build-studio-series.js`, not independent n8n workflows.

`design-manifest.json` records each title, public editor reference and SHA-256 of `JSON.stringify(payload)`. All 30 hashes were checked against the approved delivery before copying. The three narration-script files bind the editorial fixtures to their reviewed wording. No account credentials or local preview URLs are included in the manifest.

The generator and domain fixtures load this repository-local directory; the original private design-review workspace is not required. Do not remove or modify the payloads or narration independently of their approval and content-binding tests. Remote media references remain part of the source; review rights and replace demonstration destination URLs for production use.

Run `node --test test/studio-series-domain-a.test.js test/studio-series-domain-b.test.js test/studio-series-domain-c.test.js test/studio-series-framework.test.js` from the n8n repository to verify the domain mappings and render workflow contract.
