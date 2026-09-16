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
- Validates the batch before rendering; an optional dry run returns a free editor preview and credit quote.
- Renders approved products together and returns review links.
- When enabled, stages every MP4 in Shopify, associates it with the correct
  product, and tags only successful products.

## Set up steps

1. Install a Shopify app with `read_products`, `write_products`, and
   `write_files`, then obtain an Admin API access token.
2. Store it in n8n Header Auth as `X-Shopify-Access-Token` and assign it to the
   four Shopify-authenticated HTTP Request nodes.
3. Install `@zvid/n8n-nodes-zvid` from **Settings → Community nodes** before
   configuring Zvid credentials; a workspace owner/admin may need to install it.
   Create a key at https://app.zvid.io/api-keys and store it in a **Zvid API**
   credential. Select it on all four Zvid nodes.
4. Update the store, brand, palette, query, and batch size in Config.
5. Run manually with `dryRun: false` (the default) to render and spend Zvid credits. Set `dryRun: true` for an optional free preview and quote.

## Requirements

- Shopify products with public images and priced variants.
- A Zvid account and credits for non-dry runs.
- n8n Cloud or self-hosted n8n with the verified
  `@zvid/n8n-nodes-zvid` community package installed.

## Zvid nodes

Validation, saving the editor draft, bulk rendering, and bulk-status polling
all use `@zvid/n8n-nodes-zvid.zvid` with the same **Zvid API** credential.
The validation step resolves the first product's variables before quoting
the batch, and the editor preview uses the resolved first product.

## How to customize

The sample targets apparel with square studio or flat-lay images. Change the
labels, palette, copy, query, schedule, and processed tag in Config for another
brand or catalog segment.
