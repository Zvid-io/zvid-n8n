# n8n workflow authoring

Applies to this repository in addition to parent instructions.

Before generating or materially updating a publishable workflow, read
[docs/workflow-template-authoring.md](docs/workflow-template-authoring.md).
This standard applies to future templates as well as the existing series.

- Exactly one yellow overview, top left, 100–300 words, with `### How it works`
  and `### Setup`.
- For workflows with at least four functional nodes, numbered neutral notes
  under 50 words surround related groups of at least two nodes. Cover every
  functional node once; no overlapping cards or clipped text.
- Explain scoped Zvid installation, credentials, input fields, costs, preview
  behavior and any unsupported-operation exceptions. Use native Zvid nodes for
  supported operations and link detailed companion instructions.
- Preserve `dryRun: false` where applicable and the completed-media Watch step.
  Do not invent a dry-run setting for an agent using chat approval.
- Wire the format into generation, validate the exported JSON, and check the
  actual n8n canvas. Notes-only edits preserve functional settings and state.
