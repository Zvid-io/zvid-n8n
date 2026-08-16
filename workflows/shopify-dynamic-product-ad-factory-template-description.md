# Create dynamic Shopify product ad variants with Zvid

## Quick overview

Turn selected Shopify products into multiple product-first, benefit-first, and
offer-first video ads. Zvid validates and bulk-renders the concepts, while n8n
returns review links or sends a tracking-ready manifest to your asset store or
social scheduler.

## How it works

1. Runs manually or every Monday at 9:00 AM.
2. Queries recently updated Shopify products that match the configurable Admin
   API search expression.
3. Selects products with a title, priced variant, and public image, and reports
   products that cannot be used.
4. Creates up to three creative angles per product: product-first,
   benefit-first, and offer-first.
5. Uses only real Shopify data. A discount is mentioned only when the
   compare-at price is higher than the current price.
6. Builds each concept with the approved **Atelier Editorial · Contrast Fix**
   square design, using up to three Shopify product images. If a product has
   fewer images, the workflow safely reuses the available image.
7. Validates the first resolved ad for free and returns the per-video and total
   credit quote.
8. In dry-run mode, saves the first ad as an editable Zvid project without
   rendering the batch.
9. In live mode, sends all concepts in one Zvid bulk render and polls until the
   batch finishes.
10. Downloads each completed MP4 for inline playback in n8n and builds a
    delivery manifest with stable tracking keys and empty performance fields.
11. Returns the manifest for review when no webhook is configured, or posts it
    to an HTTPS asset-store or social-scheduler endpoint.

## Setup

> **Required community node:** Before configuring credentials or running the
> workflow, an n8n workspace owner or admin should open **Settings → Community
> nodes → Install** and install the exact package
> **`@zvid/n8n-nodes-zvid`**.

1. In Shopify Admin, open **Settings → Apps → Develop apps → Build apps in Dev
   Dashboard**. New custom apps can no longer be created directly in Shopify
   Admin; existing admin-created apps remain supported.
2. In Dev Dashboard, select **Apps → Create app → Start from Dev Dashboard**,
   name the app, and create a version from its **Versions** tab.
3. For an API-only integration, keep Shopify's default app-home URL. Add only
   the Admin API scope `read_products`, and release the version.
4. Open the app's **Home** page, select **Install app**, choose the target
   store, and approve the installation.
5. Open the app's **Settings** page and copy its Client ID and Client secret.
   These identify the app, but neither value is the access token.
6. Exchange them for an Admin API access token. Replace the placeholders below
   locally; never paste real credentials into the workflow JSON.

```bash
curl -X POST \
  "https://YOUR_STORE.myshopify.com/admin/oauth/access_token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

7. Copy `access_token` from Shopify's JSON response. Dev Dashboard
   client-credentials tokens expire after 24 hours. Request another token and
   update the n8n credential before a later run; unattended schedules require
   a secure token-refresh process. Existing admin-created apps can continue to
   use their supported installed token.
8. In n8n, create a **Header Auth** credential with header name
   `X-Shopify-Access-Token` and the returned `access_token` as its value. Assign
   it to **Get Shopify catalog**.
9. After the required community package is installed, create a Zvid API key at
   [app.zvid.io/api-keys](https://app.zvid.io/api-keys), then create a
   **Zvid API** credential in n8n. Paste the `zvid_...` key into **API Key**
   and keep **Base URL** set to `https://api.zvid.io`.
10. Assign that one Zvid API credential to **Validate project (free)**,
   **Save draft to editor**, **Submit bulk render**, and
   **Get batch status**.
11. Open **Config** and replace `shopDomain`, `brandName`, `website`, colors,
   CTA, product query, and batch limits. Enter only the Shopify store prefix in
   `shopDomain`; for example, use `example` for `example.myshopify.com`.
12. Keep `dryRun` set to `true` for the first execution. Review the validation
   warnings, credit quote, concepts, and Zvid editor link.
13. Set `dryRun` to `false` when ready to spend credits and render the batch.
14. Leave `deliveryWebhookUrl` blank to review the assets in n8n. Add an HTTPS
   endpoint only when the destination is ready to accept the manifest. Add any
   required destination authentication directly to
   **Send to asset store or scheduler**.
15. Activate the workflow only after the manual test succeeds, you want the
    weekly schedule to run, and Shopify token refresh is handled.

Shopify's official instructions are available in [Create apps using the Dev
Dashboard](https://shopify.dev/docs/apps/build/dev-dashboard/create-apps-using-dev-dashboard)
and [Get API access tokens for Dev Dashboard
apps](https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens?lang=curl).

## Requirements

- A Shopify store and a Dev Dashboard app with Admin API `read_products`
  access, installed on a store owned by the same organization when using the
  client-credentials grant. Apps intended for other merchants need Shopify's
  appropriate OAuth installation flow instead.
- Shopify products with a title, a priced variant, and a public product image.
- A Zvid account and API key; live renders require sufficient credits.
- An n8n Cloud or self-hosted workspace where a workspace owner or admin has
  installed the `@zvid/n8n-nodes-zvid` community package.
- An optional HTTPS webhook if assets should be sent to external storage or a
  social scheduler.

## Configuration

All merchant-facing controls live in **Config**.

| Setting | Default | Purpose |
| --- | --- | --- |
| `shopDomain` | `your-store` | Shopify store prefix only. |
| `shopifyApiVersion` | `2026-07` | Shopify Admin GraphQL API version. |
| `shopifyProductQuery` | `status:active` | Shopify Admin product search expression. |
| `scanLimit` | `50` | Maximum matching products read from Shopify. |
| `maxProducts` | `3` | Maximum eligible Shopify products selected. |
| `variantsPerProduct` | `3` | Maximum creative variants generated for each selected product. |
| `maxTotalAds` | `5` | Total video-output cap across every selected product. |
| `brandName` | `YOUR BRAND` | Brand label displayed in the opening scene. |
| `website` | `your-store.com` | Website displayed on the CTA end card. |
| `ctaText` | `Shop now` | CTA button copy. |
| `accentColor` | `#C96F4A` | Terracotta accent used for editorial details and benefit icons. |
| `paleAccentColor` | `#F1C7B3` | Light accent used over dark or photographic scenes. |
| `backgroundColor` | `#2B1D18` | Deep brown used for the branded end card and overlays. |
| `creamColor` | `#FAFAF7` | Warm neutral used for light editorial scenes. |
| `resolution` | `instagram-post` | Square 1080 x 1080 output. |
| `hookTemplates` | three examples | Product-first hook rotation. |
| `creativeFormats` | three formats | Product-first, benefit-first, and offer-first. |
| `musicUrl` | blank | Optional licensed audio URL. Blank produces a silent video. |
| `dryRun` | `true` | Free validation, quote, and editor draft when enabled. |
| `deliveryWebhookUrl` | blank | Optional endpoint that receives the finished manifest. |
| `pollSeconds` | `10` | Delay between bulk status checks. |
| `timeoutMinutes` | `20` | Maximum workflow polling time; it does not cancel server-side renders. |

The default `maxTotalAds` is 5 so the workflow remains suitable for plans
with a five-item bulk limit. Increase it only when the connected Zvid plan
supports a larger request.

Variants are allocated round-robin across selected products. Every product
receives its first variant before any product receives a second. Therefore:

- `maxProducts: 2`, `variantsPerProduct: 2`, `maxTotalAds: 4` creates four
  ads: two variants for each of two products.
- The same settings with `maxTotalAds: 2` create two ads total: the first
  variant for each product.

`maxTotalAds` is not a per-product value. It is the final cost and batch-size
limit after applying the other two settings.

Older imported copies may still contain the former name `maxAdVariants`. The
planner continues to read it as a backward-compatible fallback, but new
publication JSON uses `maxTotalAds` because its global meaning is clearer.

## Selecting products

The workflow sorts matching products by `UPDATED_AT` in descending order and
then applies `shopifyProductQuery`. Useful Shopify search expressions include
an active catalog, a vendor, a tag, a product type, or a collection-oriented
tagging convention.

Shopify's product GraphQL connection does not provide a `BEST_SELLING` sort
key. For true sales-ranked selection, use an upstream Shopify orders or
analytics workflow to tag products or pass product IDs into this workflow.
Do not change the GraphQL sort key to `BEST_SELLING`; Shopify rejects it.

## Creative strategy

For each selected product, the workflow rotates through three messaging
angles:

- **Product-first:** introduces the product using one of the configured hook
  templates.
- **Benefit-first:** opens with a shortened version of the Shopify product
  description.
- **Offer-first:** leads with the current price, or a real savings percentage
  when `compareAtPrice` exceeds `price`.

The total concept count is capped by `maxTotalAds`. With the defaults, the
first creative round gives one product-first ad to each of the first three
products. The remaining two slots become benefit-first ads for the first two
products, producing five ads total.

Each format supplies different visible copy—not merely a different internal
label:

- **Product-first** uses the product name as the opener and the matching
  configurable `hookTemplates` entry as its visible subheadline.
- **Benefit-first** uses a benefit-led opener, Shopify description copy, and
  benefit-specific story labels.
- **Offer-first** leads with the current price or real savings and uses the
  product name as supporting copy.

Every angle uses the approved **Atelier Editorial · Contrast Fix** structure:

1. An image-led product opener with the brand and creative angle. A full-frame
   dark wash and stronger bottom gradient protect the white copy against both
   light and visually busy product photography.
2. A second product-image scene with white copy over a dark two-axis overlay.
   The overlay is strongest behind the left-aligned copy and along the bottom,
   preserving product visibility while fixing text contrast.
3. Two animated benefit cards derived from the selected creative angle and
   Shopify description.
4. A photographic offer scene using the third image when available.
5. A branded CTA end card with product name, price, website, tracking key, and
   creative format. The brand name is contained in a wide bordered capsule
   rather than the earlier undersized circle.

Shopify's first three unique public product images are mapped to the opener,
story, and offer scenes. Products with one or two images remain eligible; the
workflow repeats the best available image instead of emitting a broken media
URL.

## Example products and output

The workflow was manually tested with these Shopify products:

| Product | Price | Example concepts |
| --- | ---: | --- |
| Clay Pocket Oversized Tee — Terracotta | $35.00 | Product-first and benefit-first in the current dry run; three Shopify images resolved. |
| Harbor Stripe Breton Tee — Navy & Ivory | $36.00 | Product-first and benefit-first in the current dry run; three Shopify images resolved. |

The live Clay product concept produced:

```json
{
  "trackingKey": "zvid-ad-8449570373676-01",
  "creativeFormat": "product-first",
  "hook": "Meet the Clay Pocket Oversized Tee - Terracotta.",
  "offer": "$35.00 - available now",
  "performance": {
    "status": "not_published",
    "impressions": 0,
    "clicks": 0,
    "conversions": 0,
    "spend": 0,
    "revenue": 0
  }
}
```

Actual Unicode punctuation from Shopify is preserved in customer-facing video
text. Internal Zvid job names are normalized to a conservative character set
so punctuation in product titles cannot cause a bulk item to be rejected.

## Delivery manifest

The workflow sends one JSON object containing campaign metadata, all completed
assets, failures, and total credits used. Each asset includes:

- `trackingKey`
- Shopify `productId`, product name, and storefront URL
- `creativeFormat`, `hook`, and `offer`
- Zvid `videoUrl` and `jobId`
- zeroed `performance` fields for status, impressions, clicks, conversions,
  spend, and revenue

Store the `trackingKey` beside the platform post or ad ID in the destination.
A later reporting workflow can then join platform metrics back to the exact
creative variant.

## Why Shopify uses an HTTP Request node

The Shopify call uses an n8n core **HTTP Request** node because this workflow
needs a precise Admin GraphQL query, transformed image URLs, shop currency and
domain data, and configurable product search in one request. All Zvid API
calls use the published `@zvid/n8n-nodes-zvid` action node: Render → Validate,
Project → Create Editor Project, Render → Create Bulk, and Render → Get Bulk.
The workflow therefore needs only one Zvid API credential for every Zvid step.

## Safety and cost

- `dryRun` defaults to `true`.
- Validation and the editor draft do not render the full batch.
- The dry run reports the exact credit price before the live branch can run.
- The approved 18.9-second square design was quoted at 19 credits per video in
  the current dry run. Users should rely on their own validation result because
  project changes can change the price.
- A timeout stops n8n polling; it does not cancel renders already queued in
  Zvid. Check [app.zvid.io](https://app.zvid.io) before re-running.

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| Shopify returns `401 Unauthorized` | Confirm the Header Auth value is the returned `access_token`, not the client ID or secret. For a Dev Dashboard client-credentials app, request a new token if the current one is more than 24 hours old. |
| Shopify returns `403` or a scope error | Add `read_products` to a new app version, release it, and approve the changed access for the installed store. |
| Token request returns `shop_not_permitted` | The client-credentials grant requires the app and store to belong to the same Shopify organization. Verify both in the same Dev Dashboard organization, or use Shopify's OAuth flow for another merchant's store. |
| `No eligible Shopify products matched` | Broaden `shopifyProductQuery`, increase `scanLimit`, and confirm matching products have a priced variant and public image. |
| `maxProducts: 2` still yields one video | Confirm at least two eligible products match the query, then check `maxTotalAds`. A value of 1 means one video total. Set it to at least 2 to produce one video for each of two products. |
| Two variants appear to have the same copy | Use the current workflow JSON. Each format now passes distinct opener, story, benefit, and offer variables. Confirm `creativeFormats` contains at least two different values. |
| Shopify rejects the GraphQL sort key | Keep `sortKey: UPDATED_AT`; `BEST_SELLING` is not supported for the product connection. |
| Zvid validation fails | Open the error details in **Check validation**. Malformed image URLs or unsupported project values are common causes. |
| `Project limit reached` in the dry-run summary | Delete an unneeded saved project in Zvid, then run again with `dryRun: true`. Validation still completed, but an editor draft could not be saved. |
| Bulk item name is rejected | Use the published workflow unchanged; it already normalizes internal names while preserving display text. |
| `Insufficient credits` | Reduce `maxTotalAds`, add credits, or keep `dryRun: true`. Nothing is queued by a rejected request. |
| Polling times out | Renders continue server-side. Check [app.zvid.io](https://app.zvid.io) before re-running, or raise `timeoutMinutes`. |
| No external delivery occurs | This is expected when `deliveryWebhookUrl` is blank. The review branch returns all asset URLs inside n8n. |

For Zvid help, see [docs.zvid.io](https://docs.zvid.io) or email
[help@zvid.io](mailto:help@zvid.io).

## Manual verification

The publication JSON was imported into n8n 2.29.10 and tested against the live
Shopify and Zvid APIs on August 12, 2026.

- Current approved-design dry run: 2 Shopify products, 4 planned concepts, 3
  resolved images per product, 19 credits quoted per video, 76 credits total,
  no skipped products, and no validation warnings.
- Allocation regression tests: with 2 products × 2 requested variants and a
  total cap of 2, the workflow produced one product-first ad for Clay and one
  for Harbor. With the cap raised to 4, it produced product-first and
  benefit-first ads for both products in round-robin order.
- Five-product Shopify count test: the workflow scanned all 5 active products.
  With `maxProducts: 2`, `variantsPerProduct: 1`, and the former global
  `maxAdVariants: 1`, it selected Clay and Harbor but correctly planned only
  the single globally capped Clay ad. Raising the global cap to 2 planned one
  ad each for Clay and Harbor. Using 5/1/5 selected and planned one ad for each
  of Clay, Harbor, Dawnline, Alpine, and Meadow. All three no-render executions
  finished successfully.
- Corrected local-workflow dry test: after replacing the ambiguous public
  setting name with `maxTotalAds`, a 2/1/2 run scanned 5 products, selected 2,
  and planned a 1+1 distribution for Clay and Harbor. Shopify selection and
  allocation passed; the later Zvid validation step was not completed because
  the saved local Zvid API credential had been revoked and needs replacement.
- Native-node dry run: after replacing every Zvid HTTP Request with the scoped
  Zvid action node, the workflow scanned 5 Shopify products, selected Alpine
  and Dawnline, planned one product-first ad for each, validated successfully,
  quoted 19 credits per video and 38 total, returned zero warnings, and ended
  successfully at **Dry run summary**. The optional editor draft was skipped
  with an explicit project-limit message because the test Zvid account already
  held 100 saved projects. No paid render was submitted.
- All-item remote QA: all 6 generated items across the cap-2 and cap-4 runs
  were independently resolved and validated by Zvid. Every item returned a
  19-credit quote and zero warnings. For each product, the product-first and
  benefit-first versions resolved to different visible opener headlines,
  subheadlines, story labels, benefit copy, and variant identifiers.
- Final publication-JSON rerun: after connecting `hookTemplates` to the visible
  product-first subheadline, all four cap-4 items were resolved and validated
  again. Both products retained a 2+2 distribution, every displayed variable
  resolved correctly, and Zvid returned zero warnings.
- Targeted layout-fix dry run: the exact **Harbor Stripe Breton Tee — Navy &
  Ivory** benefit-first concept completed against Shopify and Zvid with no
  validation warnings. Its opener resolved the full-frame wash and 90%-opacity
  bottom gradient. On the end card, the 420-pixel brand text box resolves from
  x=330 to x=750 inside the capsule's x=300 to x=780 bounds.
- Draft QA: Zvid saved the first fully resolved 18.9-second, 1080 × 1080
  project to the visual editor. The resolved data contained all five design
  sections, both benefit iterations, the first- and second-scene dark
  overlays, the contained end-card brand capsule, the Shopify product media,
  price, offer, CTA, and tracking metadata.
- No paid render was started for the newly approved design. The workflow's
  live bulk-render, polling, MP4 download, and review-manifest path had already
  completed successfully with the preceding 10.4-second design, but that test
  should not be represented as a render of the current Atelier design.
- Not exercised: external webhook delivery, because no third-party endpoint
  was supplied. Leave `deliveryWebhookUrl` blank until a destination is ready.
