# n8n manual-review render workflow

Import
[`zvid-n8n-review-render-demo.json`](./zvid-n8n-review-render-demo.json)
into a self-hosted n8n instance after installing
`@zvid/n8n-nodes-zvid@0.1.4`.

## Setup

1. Create a Zvid API key at <https://app.zvid.io/api-keys>.
2. In n8n, create a **Zvid API** credential and keep the default Base URL,
   `https://api.zvid.io`.
3. Select the credential on **Check Zvid balance**, **Validate project (free)**,
   **Submit render (4 credits)**, and **Get render status**.
4. Execute the workflow.

The flow checks the live account balance, validates the complete project without
spending credits, branches on `valid`, and submits only the validated project.
It then waits three seconds, fetches the render job, and loops until the job
state is `completed`. A failed job stops immediately, and a three-minute timeout
prevents an endless loop. The four-second demo costs four credits. The final node
refuses queued or URL-less results and returns the completed job ID, status, and
video URL for an easy manual-review walkthrough.

## Recording

Use the imported flow to rehearse and confirm that the local n8n instance and
credentials work. For the final n8n Creator Portal recording, create a new
workflow and add the essential Zvid nodes live. The review instructions require
one continuous video showing npm installation, new-workflow creation, credential
testing, common actions, and one Zvid action used as an AI Agent tool.

The project JSON in this workflow has passed the live Zvid validator with zero
errors and zero layout warnings.
