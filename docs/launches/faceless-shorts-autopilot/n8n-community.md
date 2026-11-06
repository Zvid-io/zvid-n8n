# Generate faceless YouTube Shorts with n8n: script, voice and captions

Give n8n a niche and let it assemble the script, narration, footage and captions into a finished Short.

![Complete faceless YouTube Shorts workflow in n8n, showing script generation, stock footage, narration, rendering and optional YouTube upload](https://cdn.zvid.io/blog/faceless-shorts-autopilot/cc86c0b29367/full-workflow.png)

We built this at Zvid for narrated videos that don't need a presenter on camera. The template connects OpenRouter, ElevenLabs and Zvid, with a manual trigger for testing and a daily schedule when you're ready.

## How it works

**Channel brief → Script → Footage + narration → Captioned MP4 → Optional YouTube upload**

1. **Write the script.** OpenRouter uses your niche and audience to produce narration split into scenes, plus a title and description.
2. **Find the visuals.** Each scene gets a stock search query. The workflow selects footage from Zvid's stock library and looks for optional background music.
3. **Generate the voice.** ElevenLabs returns narration and alignment data, which the workflow converts into word timings.
4. **Build and render.** Zvid combines the scenes, voiceover, karaoke captions, transitions and channel branding into a vertical MP4.
5. **Watch or upload.** View the result inside n8n, or enable the included YouTube upload branch for future runs.

The timing part is useful to reuse: captions come from the same response as the voiceover, so there's no separate transcription request. The video builder also uses those timings to calculate scene cuts and accounts for transition overlap.

## Make it your own

Open **Channel Config** to change the niche, audience, voice, target duration, caption style, colors and outro. The **Build project JSON** Code node is where you can change the video layout further.

YouTube upload is off by default. When enabled, its default visibility is `private`. Add an approval step if you want a human checkpoint before uploading; review generated claims and footage before publishing.

To try it, install `@zvid/n8n-nodes-zvid` from **Settings → Community nodes** before configuring Zvid credentials; a workspace owner/admin may need to install it. Connect OpenRouter and ElevenLabs, then follow the setup notes on the canvas.

The template is free; service usage applies. The default `dryRun: false` renders and spends Zvid credits. Set it to `true` for an editor draft and render estimate, but OpenRouter and ElevenLabs still run and may charge.

[Import the n8n template](https://n8n.io/workflows/19628-create-faceless-youtube-shorts-with-zvid-elevenlabs-and-openrouter/)

[Watch the walkthrough](https://youtu.be/8_6NqPSh8xg)

[Read the full setup guide](https://zvid.io/blog/tutorials/faceless-youtube-shorts-n8n)

What would you add first: a Google Sheets script queue or an approval step before generating the voiceover?
