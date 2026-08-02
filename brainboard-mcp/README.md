# brainboard-mcp

An [MCP](https://modelcontextprotocol.io) server for the [Brainboard](https://www.brainboard.co/) public API.

It lets any MCP-capable agent — Claude Code, Claude Desktop, Cursor — drive Brainboard directly:
browse projects, clone an architecture template into an environment with variable overrides, and
trigger the Terraform pipeline. The diagram and the generated Terraform show up in Brainboard as if
you had built them by hand.

> "Clone the AWS three-tier template into my staging environment, set the region to `eu-west-1`,
> and run the plan."

## Install

```bash
npm install
npm run build
```

## Configure

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `BRAINBOARD_API_KEY` | yes | — | Generate in Brainboard settings. |
| `BRAINBOARD_REGION` | no | `us1` | `us1` or `apac1`. |
| `BRAINBOARD_AUTH_SCHEME` | no | `auto` | `auto`, `raw`, or `bearer` — see below. |
| `BRAINBOARD_BASE_URL` | no | region host | Override the API host. |
| `BRAINBOARD_TIMEOUT_MS` | no | `30000` | Per-request timeout. |

Add to your MCP client:

```jsonc
{
  "mcpServers": {
    "brainboard": {
      "command": "node",
      "args": ["/absolute/path/to/brainboard-mcp/dist/index.js"],
      "env": { "BRAINBOARD_API_KEY": "<your-key>" }
    }
  }
}
```

Claude Code, in one line:

```bash
claude mcp add brainboard --env BRAINBOARD_API_KEY=<your-key> -- node /absolute/path/to/brainboard-mcp/dist/index.js
```

Then ask the agent to run `brainboard_check_connection` to confirm the key and region.

### About the `Authorization` header

Brainboard's OpenAPI spec declares `apiKey` auth in the `Authorization` header but never states
whether a `Bearer ` prefix is expected, and the API page in their docs is currently an empty stub.
Rather than guess, this server defaults to `auto`: it sends the raw key, and on a `401`/`403`
retries once with `Bearer <key>`, then remembers whichever form worked for the rest of the process.
Pin `BRAINBOARD_AUTH_SCHEME` once you know, to skip the probe.

## Tools

| Tool | Endpoint | Notes |
| --- | --- | --- |
| `brainboard_check_connection` | `GET /projects` | Verifies key, region, and header form. |
| `brainboard_list_projects` | `GET /projects` | Start here — returns project UUIDs. |
| `brainboard_create_project` | `POST /projects` | Requires environments and teams. |
| `brainboard_list_environments` | `GET /projects/{uuid}/environments` | |
| `brainboard_list_architectures` | `GET /environments/{uuid}/architectures` | |
| `brainboard_list_templates` | `GET /architectures/templates` | |
| `brainboard_create_template` | `POST /architectures/templates` | |
| `brainboard_clone_from_template` | `POST /architectures/templates/{uuid}/clone` | The main build path. |
| `brainboard_clone_architecture` | `POST /architectures/{uuid}/clone` | Supports `variable_values`. |
| `brainboard_version_architecture` | `POST /architectures/{uuid}/versions` | |
| `brainboard_list_workflows` | `GET /architectures/{uuid}/workflows` | |
| `brainboard_list_workflow_templates` | `GET /workflow_templates` | |
| `brainboard_trigger_pipeline` | `POST /architectures/{uuid}/workflows/{id}/trigger` | Marked destructive — can apply real infra. |
| `brainboard_import_variables` | `POST /variables/import/{uuid}` | See caveat below. |

`brainboard_trigger_pipeline` carries a `destructiveHint`, so well-behaved clients will ask before
running it. Depending on the workflow it may run `terraform apply` against live cloud accounts.

### Known gaps

These are limits of the public API, not of this server:

- **No node-level diagram editing.** You can clone and configure architectures, not place
  individual resources. Design happens from templates.
- **No raw Terraform fetch.** The generated code is not exposed through the API.
- **`import_variables` is under-specified.** The spec declares `multipart/form-data` and documents
  only the `override` flag — the file part's field name is not published. The tool sends `file` by
  default and exposes `file_field` so you can correct it without editing code.

## Development

```bash
npm run typecheck
npm test
npm run build
```

Tests cover configuration validation and the HTTP client's auth-fallback, retry, and error-mapping
behaviour with `fetch` stubbed; the tool layer is thin delegation over that client.

## Layout

```
src/
  index.ts        server bootstrap, stdio transport
  config.ts       env parsing and validation
  client.ts       HTTP client, auth resolution, error mapping
  result.ts       API calls -> MCP tool results
  schemas.ts      shared Zod pieces mirrored from the OpenAPI spec
  tools/          one module per resource group
```

Generated against `BrainboardAPI.json` (OpenAPI 3.0), using `@modelcontextprotocol/server` v2.

## License

MIT
