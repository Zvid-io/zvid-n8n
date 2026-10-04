# Recruiter-requested hiring video campaigns

This template combines **role spotlight** and **multi-role roundup** in one workflow. A recruiter submits a brief; the workflow matches approved open roles, produces one campaign video, and supplies tracked application links and employee referral copy. It does not evaluate applicants, contact candidates, send messages or publish social posts.

## Install and connect
1. Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before configuring Zvid credentials. A workspace owner/admin may need to install it.
2. Create a **Zvid API** credential using a key from https://app.zvid.io/api-keys and Base URL `https://api.zvid.io`. Select it on all Zvid nodes.
3. Connect Google Sheets credentials to the catalog read node and all campaign-log nodes. Select the same document, your jobs tab for **Read approved job catalog**, and a separate **Hiring Campaigns** tab for the log nodes.
4. Set company branding, a real `careersUrl`, timezone, `maxRoles`, `maxCreditsPerVideo` and `manualBrief` in **Set recruitment campaign defaults**.
5. Configure an **HTTP Basic Auth** credential on **Receive a recruiter campaign brief** before enabling its form. The template does not ship with a username/password. Use the form's Test URL while testing, and publish the local workflow only when ready to use its Production URL.

## Job catalog
Required headers and values:

| Header | Meaning |
| --- | --- |
| JobKey | Stable unique role ID |
| Role | Approved public job title, up to 90 characters |
| Approval | Exactly `approved` after editorial review |
| ApplyUrl | Public HTTPS application URL |

Optional headers: `Team, Location, SalaryRange, Perk1, Perk2, Perk3, OpensOn, ClosesOn, Priority`.
Dates use real YYYY-MM-DD values; opening and closing days are inclusive in the configured timezone. Team and location filters are exact, case-insensitive matches. Team is limited to 80 characters, location to 100, salary to 80, and each perk to 160. The workflow rejects oversized copy instead of silently changing job details.

The job catalog is read-only. Old per-role VideoUrl or RenderStatus columns are not the new campaign log. Inspect unfinished jobs from an older workflow before starting a new campaign.

## Campaign brief
- `CampaignKey`: 3–64 letters, numbers, underscores or hyphens. Reuse to recover a campaign; use a new key only for an intentional new video.
- `Mode`: `spotlight` or `roundup`.
- `JobKeys`: one key is required for spotlight. Roundup can name comma-separated keys or leave it blank to select from matching roles.
- `Team` and `Location`: optional catalog filters.
- `MaxRoles`: 1–4; otherwise the configured maximum applies (default 2).

Every explicitly requested role must be eligible. Missing, unapproved, closed or out-of-scope requested roles return a brief-revision report; no partial campaign is silently rendered. Roundups sort by earliest closing date, then priority, then key. Deferred and skipped roles remain visible in the result.

Spotlight features the role and optional benefits. Roundup opens with the campaign, presents each role, and ends with an application call to action. Role scenes last seven seconds; roundup introduction and application end card last three seconds each.

## Campaign log
Create **Hiring Campaigns** with these exact headers:

```text
CampaignKey,Status,JobId,CreditsQuoted,VideoUrl,Caption,PlanJson,CompletedAt
```

The workflow reserves the key as `submitting` before the paid request, saves the accepted job ID, then polls that job through the native Zvid node. A complete campaign is skipped. A rendering campaign resumes using its original saved design and copy even if the catalog has changed.

The sheet is not an atomic lock: run only one execution at a time. A submission with an uncertain response is not automatically retried. Inspect `submitting`, `failed`, `timed_out` or `needs_review` in Zvid before deliberately clearing or repairing the corresponding log row. Keep the job ID. Never delete a log merely to retry a possibly accepted paid request.

## Costs, preview and output
**dryRun=false is the default and spends Zvid credits.** Validation checks `maxCreditsPerVideo` before the first log write or paid request. A two-role roundup currently quotes 20 credits; longer roundups can exceed the default 20-credit ceiling. Review the actual quote and intentionally adjust the maximum when needed. The quote is not a billing receipt.

`dryRun=true` returns the campaign plan, caption, referral copy, design JSON and quote. It does not create an editor draft, write log cells, or resume a saved paid job. Zvid's published node v0.1.8 supports the render operations used here.

After completion:
- **Watch video → Binary → data → View** plays or downloads the MP4.
- **Download the recruiter handoff CSV → Binary → data** provides one row per role with its application link and referral copy. CSV cells are escaped to prevent spreadsheet formula execution.
- Application URLs preserve existing query parameters and fragments, replacing only the campaign's UTM fields.

Preview downloads are bounded to 30 seconds and at most three attempts. A download failure leaves the saved video URL available. Review media, copy and links before sharing manually.

Support: https://zvid.io/contact

