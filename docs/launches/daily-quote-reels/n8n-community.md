# Turn Google Sheets rows into daily quote videos with n8n

What if adding a quote to a spreadsheet was all you needed to queue tomorrow's video?

![Complete n8n template for daily quote videos, showing the Google Sheets queue, preview branch, rendering and Sheet update](https://cdn.zvid.io/assets/blogs/automate-daily-quote-videos-n8n-google-sheets/b025443c12910e35-workflow.png)

We built an n8n workflow that picks the next quote from Google Sheets, turns it into a vertical MP4 with animated text, background footage and music, then saves the video link back to the same row. We're the team behind Zvid, which handles the rendering.

The quotes come from your Sheet, so there's no LLM or quote-generation step to configure.

## How the workflow fits together

**Daily trigger → Read Sheet → Pick next quote → Build and render video → Update Sheet**

1. Run it manually or on the included daily schedule.
2. Pick the first row with an empty `Status`. If there are no pending rows, finish without rendering.
3. Build the video from `Quote`, `Author` and an optional `AuthorNote`, using a background and music rotation.
4. Validate the project, submit the render through the Zvid node, and wait for the result.
5. After a successful render, write `done` and `VideoUrl` to the original row. You can watch the MP4 inside n8n.

## What you can change

Your channel name, call to action, fonts, colors, background footage and music are configurable. The video layout lives in the **Build project JSON** Code node if you want to change the design further.

The finished `videoUrl` is also a useful starting point for your own next step: send it to Telegram for approval, archive it in Drive, or connect your publishing workflow. Those extensions aren't included in this template.

To try it, install `@zvid/n8n-nodes-zvid` from **Settings → Community nodes** before configuring the Zvid credential; a workspace owner/admin may need to install it. Connect Google Sheets and follow the setup notes on the canvas. The template is free; rendering uses Zvid credits. Set `dryRun: true` for an editor preview and credit estimate first; the supplied default is `false`.

One queue limitation: run one execution at a time and keep the row order stable until it finishes.

[Import the n8n template](https://n8n.io/workflows/19632-create-daily-quote-videos-from-google-sheets-with-zvid/)

[Watch the walkthrough](https://youtu.be/Ra6mPdmDDYs)

[Read the full setup guide](https://zvid.io/blog/developer-tutorials/automate-daily-quote-videos-n8n-google-sheets)

What would you connect after the render: a Telegram approval step, a publishing tool, or something else?
