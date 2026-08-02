# brainboard-mcp

An [MCP](https://modelcontextprotocol.io) server for the [Brainboard](https://www.brainboard.co/) public API.

> **Unofficial.** A community project, not affiliated with, endorsed by, or maintained by
> Brainboard. Built against their public API and OpenAPI spec. "Brainboard" is their trademark.

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

**Verified against `api.us1` on 2026-08-02: both forms are accepted.** `auto` therefore resolves to
the raw key on the first request, with no retry cost. The fallback stays in place in case the
behaviour differs by region or changes later.

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

## Verification status

Exercised end-to-end through the MCP server against the live API on 2026-08-02 (`api.us1`):

| Behaviour | Result |
| --- | --- |
| Auth — raw key and `Bearer` | both accepted, `200` |
| `list_projects`, `list_environments`, `list_architectures` | bare JSON arrays, matching the spec |
| `list_templates` | `200`, 122 templates |
| `list_workflows`, `list_workflow_templates` | `200` |
| `clone_from_template` into a real environment | `200`, architecture created and visible in the UI |
| Invalid UUID input | rejected by Zod before the request, clean error message |
| `trigger_pipeline` | **not exercised** — it can apply real infrastructure |
| `import_variables` | **failing**, see below |

### Known gaps

Limits of the public API, not of this server:

- **No node-level diagram editing.** You can clone and configure architectures, not place
  individual resources. Design happens from templates.
- **No raw Terraform fetch.** The generated code is not exposed through the API.
- **`import_variables` returns `INVALID_BODY` for every documented request shape.** Probing
  narrowed it down but did not solve it: a JSON body returns `FILE_UPLOAD_MAX_SIZE`, which proves
  the server does attempt a multipart parse, so the spec's declared content type is right. Yet all
  20 multipart combinations tried — seven file-field names, four content formats, and the
  `override` / `import_type` flags — return `INVALID_BODY`, never the spec's distinct
  `MISSING_FILE_UPLOAD`. Something required is unpublished. Full evidence, the attempt matrix, and
  curl reproductions are in [docs/BUG-import-variables.md](docs/BUG-import-variables.md). The tool
  ships with `file_field` and `extra_fields` escape hatches so it will work once Brainboard
  clarifies, without a code change. Until then, set variables through `variable_values` on the
  clone tools, which does work.

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
