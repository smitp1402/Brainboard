## What changed

<!-- One or two sentences. What does this PR do? -->

## Why

<!-- The reason, not a restatement of the diff. What was wrong, or what does
     this unlock? Link an issue if there is one. -->

## How it was verified

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Exercised against the live Brainboard API, or explicitly not (say which)

<!-- If a tool's behaviour against the live API changed, update the
     verification table in brainboard-mcp/README.md in this PR. -->

## Risk

<!-- Delete the lines that don't apply. -->

- [ ] Touches `brainboard_trigger_pipeline` — this tool can run `terraform apply`
      against real cloud accounts. Describe how you tested it without applying.
- [ ] Changes a tool's input schema — this is a breaking change for agents that
      already call it. Note it in `brainboard-mcp/CHANGELOG.md`.
- [ ] Changes auth or request shaping in `client.ts`.
- [ ] None of the above; internal only.
