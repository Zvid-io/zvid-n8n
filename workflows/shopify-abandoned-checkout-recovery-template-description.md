# n8n creator submission copy

## Title

Recover abandoned Shopify checkouts with personalized Zvid videos

## Quick overview

Find eligible abandoned Shopify checkouts, verify they remain recoverable, create
a personalized vertical Zvid product video, and optionally email it. A second
Shopify conversion check stops the follow-up after purchase.

## How it works

The workflow runs manually or every 15 minutes and selects one open Shopify
abandoned checkout that is not already locked or handled. After the configured
wait, it confirms that no order or draft order exists, inventory is available,
the abandonment is still current, and Shopify has not already sent a recovery
email. It maps up to three products into a privacy-safe Zvid project, validates
the project for free, and either saves an editor draft with the exact credit
quote or renders the MP4. Optional SMTP delivery sends the first message, waits,
checks conversion again, and suppresses the follow-up when the shopper has
completed an order.

## Setup

Create a Shopify Dev Dashboard app with `read_orders`, `read_customers`, and
`read_products`, and ensure its installing user has **Manage abandoned
checkouts** permission. Exchange the Client ID and Client secret for an access
token, then create an n8n Header Auth credential named
`X-Shopify-Access-Token`; assign it to the three Shopify HTTP Request nodes.
Set `shopDomain` from the canonical `*.myshopify.com` domain shown in Shopify
Admin under **Settings → Domains**, not from the `/store/...` Admin URL handle.
A redirecting alias can cause n8n to drop the access-token header.
Before configuring Zvid, install `@zvid/n8n-nodes-zvid` from **Settings →
Community nodes**; a workspace owner or admin may need to install it. Create a
Zvid key at https://app.zvid.io/api-keys, store it in a **Zvid API** credential
with the default `https://api.zvid.io` Base URL, and assign it to the four
official Zvid nodes: Render → Validate, Project → Create Editor Project, Render
→ Create, and Render → Get. Update `shopDomain`, brand copy, colors, fonts, and
timing in `Config`.
First run with `manualFixture: true`, `dryRun: true`, and `sendEmail: false`.
Review the editor draft and credit quote, then enable live Shopify data,
rendering, and optional SMTP delivery separately.

## Requirements

- Shopify store and Dev Dashboard app
- Shopify Admin API scopes: `read_orders`, `read_customers`, `read_products`
- Shopify staff permission: **Manage abandoned checkouts**
- n8n community package: `@zvid/n8n-nodes-zvid`
- Zvid API key from https://app.zvid.io/api-keys
- Optional SMTP credential for recovery email

## Customization

- Change the initial and follow-up waits, query, scan limit, and lock TTL.
- Replace the default hook, cart, total, and CTA copy.
- Set the brand name, store URL, colors, fonts, music, and output resolution.
- Keep SMTP disabled, replace it with an approved SMS provider, or hand the
  recovery assets to an existing marketing platform.
- Turn off the follow-up entirely, or keep the conversion gate and adjust its
  delay.

## Additional information

The example fixture mirrors a real product from the Zvid Shopify test store:
**Clay Pocket Oversized Tee**, variant **M**, quantity **1**, total **$35**, with
its Shopify CDN hero image. It uses fake contact values, short waits, sends
nothing, and simulates conversion before the follow-up.

The workflow uses Shopify Admin GraphQL through built-in HTTP Request nodes
because the n8n Shopify node does not expose the required abandoned-checkout and
abandonment fields. Tokens are stored only in n8n credentials. Email, phone, and
the Shopify recovery URL are excluded from the Zvid project and final summary.
The workflow remembers handled checkout IDs and prevents overlapping runs from
processing the same checkout.
