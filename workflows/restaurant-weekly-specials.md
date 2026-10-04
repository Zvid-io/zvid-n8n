# Weekly menu planning and video promotion pack

For restaurant marketers: select a balanced menu from approved dishes available throughout the campaign week, create one specials reel, and prepare three dated promotional captions with tracked reservation links. The workflow uses last week's completed campaign to rotate equal-priority dishes. It does not manage inventory, infer ingredients or allergens, schedule posts, or publish to social platforms.

## Install and connect
1. Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before configuring Zvid credentials. A workspace owner/admin may need to install it.
2. Create a **Zvid API** credential with a key from https://app.zvid.io/api-keys and Base URL `https://api.zvid.io`. Select it on every Zvid node.
3. Connect Google Sheets credentials and one document. **Read nominated menu dishes** uses the menu tab; the other Sheets nodes use a separate **Menu Campaigns** tab.
4. In **Set weekly menu campaign rules**, configure restaurant branding, timezone, a real `bookingUrl`, source media, `minDishes`, `maxDishes`, `minCategories`, and `maxCreditsPerVideo`.
5. Test manually and review the entire pack before enabling the Monday schedule. Check the n8n workflow's schedule timezone as well as the configuration timezone.

## Menu input
Required headers:

| Header | Meaning |
| --- | --- |
| DishKey | Stable, unique dish ID |
| Dish | Menu name, up to 70 characters |
| Category | Such as Starter, Main or Dessert |
| Price | Approved display price, up to 18 characters |
| PhotoUrl | Public HTTPS URL to an authentic photo of this dish |
| ThisWeek | TRUE to nominate the dish |
| InStock | TRUE when the restaurant confirms availability |
| Approval | `approved` after menu and price review |

Optional headers: `Description, AvailableFrom, AvailableUntil, Priority`.
Descriptions are limited to 180 characters. Availability dates use real YYYY-MM-DD values. Blank dates mean no date restriction. Provided dates must cover **Monday through Sunday of the entire campaign week**, not just the execution day. For a shorter promotion, prepare a separate deliberate campaign rather than advertising it as a full-week special.

The workflow excludes unapproved, unavailable, unmarked, incomplete or oversized rows and reports the reasons. It sorts by descending Priority, then favors dishes not used in the previous week when priorities tie. It picks one dish per category first, then fills remaining places. It stops with a menu-revision report if the minimum dish count or category variety cannot be met.

Defaults: at least 3 dishes, at least 2 categories, at most 5 dishes. No stock photos substitute for missing dish photos in the campaign path. The underlying design helper still bounds supported stock-library image URLs on both dimensions; arbitrary customer or signed URLs are preserved. Supply media within your account's input limits.

## Campaign log and recovery
Create **Menu Campaigns** with exact headers:

```text
CampaignKey,Status,JobId,CreditsQuoted,VideoUrl,Caption,PlanJson,CompletedAt
```

Campaign keys are `menu-YYYY-MM-DD-revision`, using the configured timezone's Monday and `campaignRevision` (default 1). A completed campaign is skipped. A saved rendering job resumes from the original design, menu and captions stored in PlanJson. Changing today's menu does not silently replace an already accepted video.

Change `campaignRevision` only when intentionally paying for a replacement campaign. The log reserves the key as `submitting` before the paid request, then saves its accepted job ID. No automatic paid retries are enabled. Avoid overlapping executions: Sheets is not an atomic lock. Inspect `submitting`, `failed`, `timed_out` or `needs_review` in Zvid before repairing the log; retain IDs and snapshots.

## What the pack contains
- One vertical video: restaurant introduction, one card per selected dish with its photo/description/price, and a booking end card.
- A Monday menu-launch caption, Wednesday spotlight and Friday reservation reminder. Each includes a tracked booking link and the relevant availability dates.
- A downloadable CSV with dates, purposes, captions, video URL and review status.

Past posting dates are explicitly marked `past_date_do_not_publish`. Future or same-day drafts are `review_before_scheduling`. Dates in the CSV are a plan, not automatic scheduling. Recheck real availability and prices before sharing.

## Costs and preview
**dryRun=false renders and spends Zvid credits.** The free native validation step enforces `maxCreditsPerVideo` (default 30) before logging or rendering. Actual quotes vary with the design; quoted credits are not a billing receipt.

Set `dryRun=true` for the menu plan, caption drafts, design JSON and quote only. It performs no log writes, creates no editor draft and does not resume a saved job. All Zvid operations use the published native node.

After completion use **Watch video → Binary → data → View**. Use **Download the weekly posting plan CSV → Binary → data** for the handoff. Downloads time out after 30 seconds, with at most three attempts; saved video links remain available if preview downloading fails.

Support: https://zvid.io/contact

