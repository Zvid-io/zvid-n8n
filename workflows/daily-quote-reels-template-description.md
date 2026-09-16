# Create daily motivational quote videos from Google Sheets with Zvid

## Who it is for

Creators and content teams who keep a queue of quotes in Google Sheets and want
branded vertical videos without editing each one manually.

## What it does

Run manually or daily to select the first row with an empty **Status**. Zvid renders
the quote, author, optional author note, and channel branding into a 1080×1920 MP4.
Five background clips rotate by date, paired with music. After a successful render,
the workflow writes **done** and the **VideoUrl** to the same row. Open **Watch video
→ Binary → data → View** to review the result. Social publishing is not included.

## Setup and requirements

1. Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before
   configuring Zvid credentials. A workspace owner/admin may need to install it.
   On n8n Cloud, the owner can install the verified **Zvid** integration from the
   Nodes panel.
2. Create a **Zvid API** credential using a key from
   [app.zvid.io/api-keys](https://app.zvid.io/api-keys) and Base URL
   `https://api.zvid.io`; select it on every Zvid node.
3. Connect Google Sheets and select the same spreadsheet and tab in **Read quote
   sheet** and **Mark row done**. Use these exact headers: **Quote**, **Author**,
   **AuthorNote**, **Status**, **VideoUrl**. Fill Quote and Author; leave Status and
   VideoUrl empty.
4. Customize **Config** with your channel handle, call to action, colors, and fonts.
5. Run manually. **`dryRun: false` is the default**, so rendering spends Zvid
   credits. Set `dryRun: true` for a free editor draft and quote without updating
   the sheet. Review the result before activating the daily schedule.

Requires Google Sheets access and Zvid render credits. The included visual assets
are 1080×1920. Custom media must fit your account's input limits. Confirm quote
attribution before sharing the finished video.
