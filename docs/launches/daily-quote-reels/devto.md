# Automate Quote Videos with Node.js, CSV, and the Zvid API

This example turns the next quote in a CSV into a branded vertical video with background footage, music, and attribution. Here is an actual generated result:

[![A frame from the generated daily quote video](https://raw.githubusercontent.com/Zvid-io/workflow-examples/main/workflows/daily-quote-reels/assets/sample-output.jpg)](https://cdn.zvid.io/assets/blogs/automate-daily-quote-videos-n8n-google-sheets/89123ba2a01de440-demo.mp4)

[Watch or download the sample video](https://cdn.zvid.io/assets/blogs/automate-daily-quote-videos-n8n-google-sheets/89123ba2a01de440-demo.mp4).

The script follows this pipeline:

```text
CSV → Select Quote → Build Project → Validate → Render → Save URL
```

It saves an updated queue and optionally downloads the MP4. You review and publish the video yourself. Preview mode lets you review the project and check estimated rendering credits before generating the final video.

## 1. Prerequisites

- Node.js 20 or later and Git.
- A [Zvid API key](https://app.zvid.io/api-keys), plus credits for an actual render.
- A few approved quotes and checked author attributions. Sample rows are included.

The CLI uses local CSV files. Google Sheets access and a daily trigger are available in the separate n8n version.

## 2. Install the example

```bash
git clone https://github.com/Zvid-io/workflow-examples.git
cd workflow-examples/workflows/daily-quote-reels
npm ci
```

Copy the configuration file on macOS or Linux:

```bash
cp .env.example .env
```

Or in Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Set `ZVID_API_KEY` in `.env` to your own key and keep that file private. The default API URL is `https://api.zvid.io`.

## 3. Check the example and run a preview

```bash
npm run check
npm test
npm run dry-run
```

The first two commands run local checks and mocked tests. Dry run validates the real project and attempts to save an editor draft without submitting a render. Open `out/result.json` for the estimate and, if draft saving succeeded, the editor link. The quote remains pending.

## 4. Render one quote

Once the preview is ready, this command submits a render and downloads the completed video:

```bash
node src/index.js --max-credits 15
```

Rendering spends credits. The example limit of `15` rejects an estimate above that value; it is a per-run check, not an account budget.

Check the files in `out/`:

- `project.json`: the generated video project.
- `result.json`: the job ID, completed video URL, and download result.
- `quotes.csv`: an updated queue with the selected row marked done.
- An MP4, if the download succeeded.

To process the next quote, use the updated queue:

```bash
node src/index.js --data out/quotes.csv --out out --max-credits 15
```

The original input stays unchanged. Reusing it would select the same quote again.

## A complete build-and-validate example

For a closer look at the code, save this as `inspect-project.mjs` in the workflow folder. It uses the same [queue helper](https://github.com/Zvid-io/workflow-examples/blob/cdde6a14b55ade3f3ca073e3f6a780f3b15df309/workflows/daily-quote-reels/src/queue.js), [project builder](https://github.com/Zvid-io/workflow-examples/blob/cdde6a14b55ade3f3ca073e3f6a780f3b15df309/workflows/daily-quote-reels/src/project.js), and SDK call as the CLI. It builds and validates a project without rendering or changing the queue.

```javascript
import { mkdirSync, readFileSync } from 'node:fs';
import { ZvidClient } from '@zvid/sdk';
import { loadQueue } from './src/queue.js';
import { loadProjectBuilder } from './src/project.js';
import { loadEnv, writeJson } from './src/util.js';

loadEnv();
const { pending } = loadQueue(process.argv[2] || 'data/quotes.csv');

if (!pending) {
  console.log('No pending quotes.');
} else {
  const config = JSON.parse(readFileSync('config.json', 'utf8'));
  const buildProject = loadProjectBuilder('n8n/workflow.json');
  const { payload } = buildProject(config, {
    quote: pending.record.Quote,
    author: pending.record.Author,
    authorNote: pending.record.AuthorNote,
    date: new Date(),
  });

  mkdirSync('out', { recursive: true });
  writeJson('out/project.json', payload);

  const client = new ZvidClient({
    apiKey: process.env.ZVID_API_KEY,
    baseUrl: process.env.ZVID_API_URL || undefined,
  });
  const validation = await client.authoring.validate({ payload });
  if (!validation.valid) throw new Error('Project validation failed.');

  console.log(JSON.stringify({
    valid: validation.valid,
    creditsRequired: validation.creditsRequired,
    projectFile: 'out/project.json',
  }, null, 2));
}
```

Run it from that same folder:

```bash
node inspect-project.mjs
```

Use the repository's `src/index.js` for rendering: it also handles job persistence, polling, queue updates, and downloads.

## Customize the content, design, and schedule

**Quotes:** edit `data/quotes.csv` before the first run, or the updated `out/quotes.csv` afterward. Keep the five headers: `Quote`, `Author`, `AuthorNote`, `Status`, and `VideoUrl`. Fill in quote and author; leave status empty for a pending row. Any nonempty status skips it.

**Video design:** edit `config.json` to change `channelName`, `ctaText`, fonts, colors, or `musicVolume`. `backgroundVideoOverride` and `musicUrlOverride` accept replacement media URLs. For scene-level changes, edit the **Build project JSON** code in the bundled `n8n/workflow.json`, then run a fresh preview. Re-import that file to use the same changes in n8n. Use only trusted workflow files because this builder executes code.

**Scheduling:** the CLI runs only when invoked. To schedule it with cron or Windows Task Scheduler, use the workflow folder as the working directory, read the updated queue, and prevent overlapping runs. For a schedule managed inside an automation tool, use the n8n template's daily trigger and Google Sheets queue instead.

## If a run stops

Check `out/result.json` before retrying a timeout; the render may still be running. A failed download can leave a completed video URL you can use directly. The sample does not lock the queue or automatically resume jobs, so run it serially and keep review before publication.

## Try it with one quote

Start with the included sample, run a preview, then render and review one video. Once the result works for your content, customize the design and continue from the updated queue.

- [GitHub repository and complete runnable example](https://github.com/Zvid-io/workflow-examples/tree/main/workflows/daily-quote-reels)
- [Official n8n template](https://n8n.io/workflows/19632-create-daily-quote-videos-from-google-sheets-with-zvid/)
- [YouTube walkthrough](https://youtu.be/Ra6mPdmDDYs)
- [Zvid documentation](https://docs.zvid.io)

For help, visit [https://zvid.io/contact](https://zvid.io/contact).
