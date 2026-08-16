# Recover abandoned Shopify checkouts with personalized Zvid videos

[`zvid-shopify-abandoned-checkout-recovery.json`](zvid-shopify-abandoned-checkout-recovery.json)

This workflow turns one eligible abandoned Shopify checkout into a private,
personalized vertical product video. It waits before recovery, verifies that no
order or draft order has appeared, checks inventory, creates a free editor draft
and credit quote, and can then render and send the video by email. A second
conversion check stops the optional follow-up after purchase.

## Flow

```text
Manual or 15-minute schedule
  -> fixture or Shopify abandoned-checkout query
  -> choose and lock one checkout
  -> wait 60 minutes
  -> confirm no order, draft order, newer abandonment, prior Shopify email,
     or unavailable inventory
  -> build and validate a privacy-safe Zvid project
  -> free editor draft, or paid MP4 render
  -> optional initial SMTP email
  -> optional 12-hour wait and conversion recheck
  -> stop after conversion, or send one follow-up
  -> remember the checkout and output an audit summary
```

## Requirements

- A Shopify app created in the Dev Dashboard with Admin API access to
  `read_orders`, `read_customers`, and `read_products`.
- The app's installing user must have Shopify's **Manage abandoned checkouts**
  permission. Shopify treats this as protected customer data.
- A Shopify access token stored in an n8n **Header Auth** credential.
- The official Zvid community package, `@zvid/n8n-nodes-zvid`.
- A Zvid API key from [app.zvid.io/api-keys](https://app.zvid.io/api-keys), stored
  in the package's **Zvid API** credential.
- Optional: an n8n SMTP credential for the two email nodes.

Before configuring Zvid, install `@zvid/n8n-nodes-zvid` from **Settings →
Community nodes**. A workspace owner or admin may need to install it.

## Shopify authentication

The `X-Shopify-Access-Token` is neither the Client ID nor the Client secret. For
a Dev Dashboard app, release an app version, install it on the store, and then
exchange the app credentials for an access token:

First open Shopify Admin **Settings → Domains** and copy the canonical
`*.myshopify.com` domain. `YOUR_STORE` below is that domain's subdomain, not
necessarily the `/store/...` handle in the Shopify Admin URL. If an alias
redirects to a different host, n8n can drop `X-Shopify-Access-Token` during the
redirect and Shopify will return HTTP 401 even when the token is valid.

```bash
curl -X POST https://YOUR_STORE.myshopify.com/admin/oauth/access_token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials' \
  -d 'client_id=YOUR_CLIENT_ID' \
  -d 'client_secret=YOUR_CLIENT_SECRET'
```

Create an n8n **Header Auth** credential with:

- Name: `X-Shopify-Access-Token`
- Value: the returned `access_token`

Assign it to:

- **Find open abandoned checkouts**
- **Confirm no purchase and inventory**
- **Confirm before follow-up**

Dev Dashboard access tokens expire after 24 hours. Refresh the n8n credential
before later scheduled runs, or use a secure token-refresh service. See
Shopify's [access-token guide](https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens?lang=curl).

If Shopify returns `The user must have manage_abandoned_checkouts permission`,
open **Settings -> Users**, confirm that the user who installed the app can
manage abandoned checkouts, then release and install an app version with
`read_orders` and exchange a fresh token. Shopify documents both the
`read_orders` scope and this separate user permission on the
[abandonedCheckouts query](https://shopify.dev/docs/api/admin-graphql/latest/queries/abandonedCheckouts).

## Zvid authentication

Install `@zvid/n8n-nodes-zvid` from **Settings → Community nodes**, then create a
key at [app.zvid.io/api-keys](https://app.zvid.io/api-keys). Create an n8n
**Zvid API** credential with:

- API Key: your `zvid_...` key
- Base URL: `https://api.zvid.io`

Assign it to the four official Zvid nodes:

- **Validate project (free)** — Render → Validate
- **Save draft to editor** — Project → Create Editor Project
- **Submit render** — Render → Create
- **Get render status** — Render → Get

These are native Zvid operations, not renamed HTTP Request nodes. The native
nodes preserve Zvid attribution in an n8n Creator template and give users the
package's credential test and operation-specific controls.

Keep `dryRun: true` for the first test. Validation and saving the editor draft do
not render an MP4. The dry-run summary returns the exact credit quote and a link
for [editor.zvid.io](https://editor.zvid.io). Set `dryRun: false` only after the
draft and credit cost are approved.

## Safe first run

Import the JSON, connect the credentials, and leave these `Config` values as:

```json
{
  "manualFixture": true,
  "dryRun": true,
  "sendEmail": false,
  "testFixtureRecoveredBeforeFollowUp": true
}
```

The fixture represents shopper **Alex** with one **Clay Pocket Oversized Tee**,
variant **M**, quantity **1**, a **$35** total, and the product's Shopify CDN hero
image. It uses two-second waits and simulates a purchase before the follow-up,
proving that the later reminder stops. Its example contact values are never sent.

The current design is a 1080x1920 reel with three scenes and a single-item layout.
It expands for two or three checkout items, shortens long titles, formats prices,
and falls back to a designed numbered tile when an image URL is missing.

## Switch to live Shopify data

1. Set `shopDomain` to the canonical `*.myshopify.com` prefix shown under
   **Settings → Domains**, for example `your-store`. Do not copy the Shopify
   Admin `/store/...` handle unless it is identical.
2. Confirm the API version is `2026-07`.
3. Set `manualFixture: false` while leaving `dryRun: true` and
   `sendEmail: false`.
4. Run manually. No eligible checkout is a successful no-op.
5. Review the editor draft and quoted credits.
6. Set `dryRun: false` to allow the paid render only after approval.

Shopify's built-in n8n node is not used for the abandoned-checkout reads because
it does not expose the required Admin GraphQL abandonment objects, recovery URL,
conversion flags, and inventory gates. The three Shopify HTTP Request nodes call
the current GraphQL API and still use n8n credentials, so no token is embedded in
the workflow. See Shopify's
[AbandonedCheckout](https://shopify.dev/docs/api/admin-graphql/latest/objects/AbandonedCheckout)
and [Abandonment](https://shopify.dev/docs/api/admin-graphql/latest/objects/Abandonment)
objects.

## Optional email delivery

Attach an SMTP credential to both email nodes, set `emailFrom` to a verified
sender, and enable `sendEmail` only after a private test. The email includes the
Shopify recovery link and rendered video link. Configure consent, quiet hours,
SPF, DKIM, and local recovery-message rules before activation. The default guard
stops before rendering when Shopify has already sent an abandonment email.

## Privacy and duplicate prevention

Only the shopper's first name, product titles, product images, prices, and cart
total enter the video project. Email, phone, and the recovery URL are excluded
from the video payload, project name, and final summary. n8n execution history
can still contain the delivery address required by SMTP, so restrict workflow
access and choose an appropriate execution-retention period.

The workflow holds one in-flight checkout ID while waiting, clears stale locks
after `lockTtlHours`, and remembers up to 500 handled IDs. A render timeout does
not necessarily cancel the remote Zvid job; check [app.zvid.io](https://app.zvid.io)
before retrying to avoid duplicate credit use.
