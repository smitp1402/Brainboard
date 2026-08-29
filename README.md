# Brainboard MCP

An [MCP](https://modelcontextprotocol.io) server for [Brainboard](https://www.brainboard.co/),
plus notes from building it against their public API.

[![npm](https://img.shields.io/npm/v/brainboard-mcp)](https://www.npmjs.com/package/brainboard-mcp)
[![license](https://img.shields.io/npm/l/brainboard-mcp)](brainboard-mcp/LICENSE)

> **Unofficial.** Built and maintained by the community, not by Brainboard. "Brainboard" is their
> trademark.

Brainboard lets you design cloud infrastructure visually and generates Terraform from the diagram.
This server puts that behind MCP, so an AI agent — Claude Code, Claude Desktop, Cursor — can drive
it directly:

> "Clone the AWS three-tier template into my staging environment, set the region to `eu-west-1`,
> and run the plan."

Fourteen tools cover every endpoint in Brainboard's public API: projects, environments,
architectures, templates, cloning with variable overrides, versioning, and pipeline triggers.

## Install

```bash
npm install -g brainboard-mcp
```

Full setup, the tool reference, and per-tool verification status:
**[brainboard-mcp/README.md](brainboard-mcp/README.md)**

## What's here

| Path | |
| --- | --- |
| [brainboard-mcp/](brainboard-mcp/) | The MCP server — source, tests, and its own README |
| [brainboard-mcp/docs/API-FINDINGS.md](brainboard-mcp/docs/API-FINDINGS.md) | Two spec defects found while building, with reproductions |
| [brainboard-mcp/docs/BUG-import-variables.md](brainboard-mcp/docs/BUG-import-variables.md) | Deep dive on the one endpoint that cannot be called |
| [BrainboardAPI.json](BrainboardAPI.json) | Brainboard's published OpenAPI spec, the source everything was built from |

## Status

Twelve of the fourteen tools are confirmed working against the live API. One
(`trigger_pipeline`) is deliberately untested, since it can apply real cloud infrastructure. One
(`import_variables`) is blocked by an upstream API issue that is documented in full.

Building it surfaced two places where Brainboard's published spec does not match the API:

- **`POST /projects`** requires an undocumented `role` on every team, and only `admin` and `guest`
  are accepted — `owner` is rejected.
- **`POST /variables/import/{uuid}`** returns `INVALID_BODY` for every documented request shape.

Both are written up with evidence in [API-FINDINGS.md](brainboard-mcp/docs/API-FINDINGS.md).

## License

MIT
