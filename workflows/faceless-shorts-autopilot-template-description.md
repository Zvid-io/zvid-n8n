# Create faceless YouTube Shorts with Zvid, ElevenLabs and OpenRouter

## Who it is for

Creators and small content teams producing narrated vertical videos without filming.

## What it does

Run manually or on a daily schedule to choose a topic, write a script with OpenRouter,
generate ElevenLabs narration with word timings, and select footage and optional
music from Zvid's stock library. Zvid renders a 1080 × 1920 video with synchronized
captions, scene transitions, and channel branding. Open **Watch video → Binary →
data → View** to review the finished MP4. YouTube upload is optional and disabled
by default.

## Setup and requirements

1. Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before
   configuring Zvid credentials. A workspace owner/admin may need to install it.
   On n8n Cloud, the owner can install the [verified Zvid integration](https://n8n.io/integrations/zvid/)
   by searching for **Zvid** in the Nodes panel.
2. Create a **Zvid API** credential using a key from
   [app.zvid.io/api-keys](https://app.zvid.io/api-keys), with Base URL
   `https://api.zvid.io`. Select it on the Zvid nodes and **Upload voiceover**.
3. Connect OpenRouter and an ElevenLabs Header Auth credential (`xi-api-key`).
4. Customize **Channel Config**: topic niche, audience, channel handle, voice,
   colors, captions, and target duration.
5. Execute manually. **`dryRun: false` is the default**, so rendering spends Zvid
   credits. `dryRun: true` skips the paid render and returns an editor draft and
   quote; OpenRouter and ElevenLabs usage can still incur charges.
6. Connect YouTube OAuth2 and enable `uploadToYouTube` when ready; upload privacy
   defaults to `private`. Activate the schedule after reviewing the output.

All supported Zvid operations use its community node. Voiceover upload uses HTTP
Request because the published node does not expose multipart uploads. Provider
accounts and suitable usage allowances are required. Review factual claims before
publishing.
