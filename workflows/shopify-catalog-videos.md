# Create and publish Shopify product videos with Zvid

[`zvid-shopify-catalog-videos.json`](zvid-shopify-catalog-videos.json)

This workflow finds active Shopify products without video media, turns the next
catalog batch into Zvid Studio vertical videos with one Zvid bulk render, and
can attach each finished MP4 to the matching Shopify product.

```text
Manual / daily schedule
  -> query Shopify catalog
  -> skip products that already have video or unusable product data
  -> build one Zvid template plus per-product variables
  -> validate and quote the batch for free
  -> dry run: save the first product as an editor preview
     OR
  -> bulk render -> poll -> map each video to its Shopify product GID
  -> review-only links
     OR
  -> read MP4 size -> stagedUploadsCreate -> upload MP4 to Shopify staging
  -> productUpdate(media: VIDEO) with Shopify's staged resource URL
  -> add zvid-video tag -> summary
```

## Business behavior

- **One catalog queue:** successfully submitted products receive the
  `zvid-video` tag. The default Shopify query excludes the tag, so later runs
  advance through the catalog instead of rendering the same products again.
- **Existing media is respected:** a product with non-failed Shopify `VIDEO`
  or `EXTERNAL_VIDEO` media is skipped even if it does not have the Zvid tag.
- **One Zvid bulk request:** the design is shared and only product variables
  differ. `maxProducts` defaults to 5 so the workflow fits the free-plan bulk
  cap.
- **Stable mapping:** render jobs are mapped back by submit index and Shopify
  product GID, never by product title.
- **Review and automatic modes:** `dryRun` provides a free quote and editor
  preview. After rendering, `publishToShopify: false` returns review links;
  `true` attaches the videos automatically.
- **No product data is overwritten:** publishing adds video media and a tag.
  It does not replace titles, descriptions, prices, images, variants, or the
  product's existing tags.
- **Catalog-native creative:** the video uses up to four images, the first
  three product-description bullets, available sizes, product type, vendor,
  price, and compare-at price from Shopify. Product-color tags select a muted
  terracotta, navy, sage, washed-black, or ivory accent automatically.

## Creative direction

The bundled design is based on the connected Zvid Studio apparel catalog:

- warm ivory paper, charcoal type, fine editorial rules, and restrained color;
- square image cards that preserve the store's studio and flat-lay photography
  without forcing it into a destructive full-screen vertical crop; Shopify
  supplies render-sized 1600px WebP variants to reduce transfer and decoding
  failures from oversized source PNGs;
- a hero image and product name, an angle/detail composition with real garment
  specifications, and a flat-lay shop card with price and call to action; and
- apparel-specific labels such as `THE EVERYDAY EDIT`,
  `CUT · CLOTH · FINISH`, sizes, and `Explore the fit`.

The template remains data-driven: later changes to Shopify images, description
bullets, variants, or prices flow into the next render without editing the
workflow JSON.

## Example product catalog

The example design and manual QA use five active Zvid Studio apparel products:

| Product | Price | Visual treatment | Variants |
| --- | ---: | --- | --- |
| Alpine Crest Heavyweight Tee — Ivory | $34 | Warm-ivory studio/flat-lay imagery with an embroidered crest | S–XXL |
| Clay Pocket Oversized Tee — Terracotta | $35 | Terracotta oversized tee with a clean chest-pocket detail | S–XXL |
| Dawnline Garment-Dyed Tee — Washed Black | $32 | Washed-black tee with a minimalist rising-sun emblem | S–XXL |
| Harbor Stripe Breton Tee — Navy & Ivory | $36 | Narrow navy-and-ivory stripes with a solid navy collar | S–XXL |
| Meadow Sprig Cotton Tee — Sage | $30 | Muted-sage everyday tee with a tonal botanical chest mark | S–XXL |

Each product has a square hero image, additional catalog photography, a title,
description copy, price, vendor/type metadata, and five size variants. The
workflow does not depend on those exact titles: they demonstrate the expected
input shape and the apparel-oriented sample copy. For another category, keep
the data mapping and change the labels in **Config**.

## Requirements

### Shopify custom app and access token

The value sent in `X-Shopify-Access-Token` is an **Admin API access token**. It
is not the Client ID and it is not the Client secret.

For a new app created in 2026 or later:

1. In Shopify Admin, open **Settings → Apps → Develop apps → Build apps in Dev
   Dashboard**.
2. Create an app and an app version. For an API-only integration, Shopify
   allows its default app-home URL.
3. Request the least-privilege scopes required by this workflow:
   `read_products`, `write_products`, and `write_files`.
4. Release the version, open the app's **Home** page, choose **Install app**, and
   install it on the target store.
5. Open the app's **Settings** page and copy its Client ID and Client secret.
   Keep the secret private.
6. Exchange those credentials for the actual access token. Replace the three
   placeholders below; do not paste their real values into the workflow JSON.

```bash
curl -X POST \
  "https://YOUR_STORE.myshopify.com/admin/oauth/access_token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

Copy `access_token` from the JSON response. Dev Dashboard client-credentials
tokens expire after 24 hours; request a replacement and update the n8n
credential before a later run. For unattended daily scheduling, add a secure
token-refresh step or use an existing admin-created custom app whose installed
token remains supported. New admin-created legacy apps can no longer be made,
but existing ones continue to work.

In n8n, create a **Header Auth** credential:

```text
Name:  X-Shopify-Access-Token
Value: the returned Admin API access_token
```

Attach the credential to **Get Shopify catalog**, **Create Shopify upload
targets**, **Attach video to Shopify product**, and **Mark product processed**.
Updating this one credential updates all four calls.

The workflow uses Shopify GraphQL Admin API `2026-07`. It reads each rendered
MP4's byte size, requests a secure target with `stagedUploadsCreate`, downloads
the MP4 from Zvid, uploads it to Shopify staging, and calls `productUpdate` with
Shopify's staged resource URL. Shopify then processes the video asynchronously.
A rejected upload or association is never tagged as processed.

Official references: [create a Dev Dashboard app](https://shopify.dev/docs/apps/build/dev-dashboard/create-apps-using-dev-dashboard),
[obtain a client-credentials token](https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens?lang=curl),
and [manage Shopify product media](https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/manage-media).

### Why the Shopify steps use HTTP Request nodes

n8n's built-in Shopify node is useful for common order and product CRUD. Its
current product implementation calls the REST Product resource, advertises API
version `2024-07`, and exposes Create, Delete, Get, Get Many, and Update. This
workflow instead needs an exact GraphQL selection containing product media,
four images, HTML description bullets, and variants, followed by
`stagedUploadsCreate`, a signed multipart upload,
`productUpdate(media: VIDEO)`, and `tagsAdd` mutations.

Shopify classifies the REST Admin API as legacy and requires new public apps to
use GraphQL. Keeping the four Shopify-authenticated calls as HTTP Request nodes therefore
avoids a legacy API dependency and pins the required GraphQL contract. The same
Shopify Header Auth credential is reused across all four nodes, so there is no
extra secret to manage.

Sources: [n8n Shopify node implementation](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Shopify/Shopify.node.ts),
[Shopify REST Admin API status](https://shopify.dev/docs/api/admin-rest/latest),
[Shopify REST Product deprecation](https://shopify.dev/docs/api/admin-rest/latest/resources/product),
and [Shopify staged uploads](https://shopify.dev/docs/api/admin-graphql/latest/mutations/stagedUploadsCreate).

### Zvid

Install the verified **`@zvid/n8n-nodes-zvid`** community package if it is not
already available, then create a key at
[app.zvid.io/api-keys](https://app.zvid.io/api-keys). Store it in the package's
**Zvid API** credential; keep the default base URL, `https://api.zvid.io`.

Select the same Zvid API credential on:

- **Validate project (free)**
- **Save draft to editor**
- **Submit bulk render**
- **Get batch status**

**Submit bulk render** is the native Zvid action node. The other three steps
remain HTTP Request nodes because this workflow needs API shapes the action node
does not yet expose exactly: resolving the first catalog item's variables during
validation, saving the resolved preview as an editor draft, and polling a bulk
batch. They use **Predefined Credential Type → Zvid API**, so the key is stored
only once and is never placed in the workflow JSON.

### How n8n associates this template with Zvid

n8n associates a workflow template with an integration from the serialized
`nodes[].type` value. A canvas label such as "Submit Zvid render," a Zvid URL,
or an `x-api-key` header does not count: an HTTP Request node remains
`n8n-nodes-base.httpRequest`.

This workflow deliberately includes **Submit bulk render** with the published
type `@zvid/n8n-nodes-zvid.zvid`. Keep that exact scoped type when exporting an
update for the n8n template library. Exports made from a development mount can
contain a dev-only or unscoped type and will not be attributed to the published
Zvid integration.

## Setup

1. Install `@zvid/n8n-nodes-zvid` and import
   `zvid-shopify-catalog-videos.json` into n8n.
2. Attach the Shopify Header Auth credential to the four Shopify API nodes.
3. Create one Zvid API credential and select it on the four Zvid-facing nodes
   listed above.
4. The submission file uses `your-store`. Set `shopDomain` to only the Shopify
   subdomain. For `https://acme.myshopify.com`, use `acme`, and update `website`
   to the storefront domain you want displayed in the video.
5. Review `brandName`, `website`, the palette, and copy labels. The defaults
   already match the connected Zvid Studio catalog.
6. Keep `dryRun: true` and execute manually. The output includes the exact
   batch credit quote and an `editorLink` for the first product.
7. Set `dryRun: false` to render. Keep `publishToShopify: false` for a batch of
   review links, or set it to `true` to attach each result automatically.
8. Activate the daily schedule only after reviewing a live batch and deciding
   how the Shopify credential will stay valid. Dev Dashboard client-credentials
   tokens expire after 24 hours; refresh the token securely before scheduled
   runs or use a supported existing admin-created app token.

The imported workflow is inactive and ships with both safety controls enabled:
`dryRun: true` and `publishToShopify: false`.

## Configuration

| Key | Default | Purpose |
| --- | --- | --- |
| `shopDomain` | `your-store` | Shopify `.myshopify.com` subdomain only. |
| `shopifyApiVersion` | `2026-07` | GraphQL Admin API version. |
| `shopifyProductQuery` | `status:active -tag:zvid-video` | Candidate product search. Narrow by collection, vendor, tag, or status when needed. |
| `scanLimit` | `100` | Products inspected per run; Shopify allows up to 250 in this query. |
| `maxProducts` | `5` | Videos submitted in one Zvid bulk batch. |
| `processedTag` | `zvid-video` | Added only after Shopify accepts the product-media request. |
| `dryRun` | `true` | Free validate, quote, and first-product editor preview. |
| `publishToShopify` | `false` | `false` returns rendered review links; `true` writes product media. |
| `brandName` / `website` | `Zvid Studio` / `your-store.myshopify.com` | Sample brand and storefront copy displayed throughout each video. |
| palette and type keys | Zvid Studio editorial defaults | Rebrand the shared video design. Product-specific accents are selected from title and tags. |
| `musicUrl` | empty | Silent by default. Supply a public audio URL if wanted. |
| `pollSeconds` / `timeoutMinutes` | `10` / `20` | Zvid bulk-render polling controls. |

## Product data mapping

| Shopify value | Video use |
| --- | --- |
| Product title | Hero, offer card, and render name |
| First four product images | Hero, angle, detail, and final flat-lay card; available images are reused when fewer than four exist |
| First variant price / compare-at price | Current price plus optional markdown treatment |
| First three `<li>` items in `descriptionHtml` | Garment facts in the `CUT · CLOTH · FINISH` scene |
| Variant size options | Available-size line, such as `S · M · L · XL · XXL` |
| Vendor and product type | Editorial footer metadata |
| Product title and tags | Product-color label plus matching accent/tint palette |
| Primary storefront domain + handle | Product URL in the run output |

Text is whitespace-normalized, length-limited, and HTML-escaped before it is
substituted into the Zvid project. Products without a title, image, or priced
variant are reported in `skipped` and are not rendered.

## Operational notes

- Shopify processes hosted video asynchronously. Confirm the new media reaches
  `READY` in Shopify Admin before reordering media or treating it as published
  on the storefront.
- Shopify currently limits app-created hosted videos to 1,000 per store in a
  seven-day period. Large catalogs need a publish schedule that stays below
  that limit.
- `scanLimit` is capped at 250. The processed tag lets normal catalogs progress
  across scheduled runs. If many products already have third-party video but
  lack the tag, narrow `shopifyProductQuery` or tag those products separately.
- A failed Zvid render is not published or tagged. A Shopify mutation failure
  leaves the rendered Zvid URL in the error output so the asset can be retried
  without losing it.
- The final summary records `PROCESSING` after Shopify accepts the association.
  This workflow does not poll Shopify's transcoding pipeline.

## Verification

- The workflow JSON parses successfully.
- Node IDs and names are unique, and every graph connection resolves.
- Every Code node passes JavaScript syntax compilation.
- The Zvid builder uses square editorial image cards tailored to the connected
  apparel catalog and keeps all four product-image roles data-driven.
- All five connected-store catalog products were resolved, validated, and
  rendered locally as 12.6-second 1080×1920 H.264 videos. Fifteen frames across
  the hero, details, and shop scenes were reviewed for layout and asset loading.
- Shopify queries and mutations use GraphQL Admin API `2026-07` shapes for
  product media and tags.
- A live one-product smoke test uploaded the existing Meadow Sprig MP4 through
  Shopify staging and successfully associated it with product
  `gid://shopify/Product/8449570275372`. No additional Zvid render credits were
  used for this test.

No Shopify or Zvid credentials are stored in the workflow JSON.
