# Create and publish Shopify product videos with Zvid

Turn active Shopify apparel products into branded vertical videos with Zvid,
review the results, and optionally attach every finished MP4 to its matching
product. It is designed for ecommerce and marketing teams producing catalog
creative in repeatable batches.

## How it works

- Finds active products and skips items with existing video or the processed
  tag.
- Maps up to four images, prices, description bullets, sizes, vendor, type,
  title, and tags into one shared vertical design.
- Validates the batch and returns a free editor preview and credit quote.
- Renders approved products together and returns review links.
- When enabled, stages every MP4 in Shopify, associates it with the correct
  product, and tags only successful products.

## Set up steps

1. Install a Shopify app with `read_products`, `write_products`, and
   `write_files`, then obtain an Admin API access token.
2. Store it in n8n Header Auth as `X-Shopify-Access-Token` and assign it to the
   four Shopify-authenticated HTTP Request nodes.
3. Install `@zvid/n8n-nodes-zvid`, create a key at
   https://app.zvid.io/api-keys, and store it in a **Zvid API** credential.
   Select that credential on the native **Submit bulk render** node and the
   three advanced Zvid API steps.
4. Update the store, brand, palette, query, and batch size in Config.
5. Run manually with `dryRun: true`; review the preview and quote first.

## Requirements

- Shopify products with public images and priced variants.
- A Zvid account and credits for non-dry runs.
- n8n Cloud or self-hosted n8n with the verified
  `@zvid/n8n-nodes-zvid` community package installed.

## Why Zvid still has some HTTP Request steps

The bulk submission uses the native Zvid node. First-item variable validation,
the editor draft, and bulk-status polling currently need advanced API shapes,
so those steps remain HTTP Request nodes and reuse the same **Zvid API**
credential. n8n associates this template with Zvid through the exported native
node type, `@zvid/n8n-nodes-zvid.zvid`; node labels and Zvid API URLs alone do
not create that association.

## How to customize

The sample targets apparel with square studio or flat-lay images. Change the
labels, palette, copy, query, schedule, and processed tag in Config for another
brand or catalog segment.
