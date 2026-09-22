# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-09-05

### Added
- Complete MCP tool suite: 14 tools covering the 13 endpoints in the public API
- Comprehensive test coverage: 16 tests validating auth, errors, and request handling
- Smart auth scheme negotiation: automatically detects raw key vs Bearer format
- Full TypeScript support with strict type safety
- Support for all Brainboard operations:
  - Project management (list, create, environments)
  - Architecture operations (list, clone, version)
  - Template management (list, clone, create)
  - Workflow execution (list, trigger terraform plan/apply)
  - Variable imports
  - Connection diagnostics

### Changed
- Improved type safety in test configuration (`Record<string, string | undefined>`)

### Features
- **Zero state**: Stateless MCP server, no database or cache required
- **Error handling**: All errors returned as readable text for Claude to reason about
- **Verified against the live API**: 12 of 14 tools exercised end-to-end on 2026-08-02.
  `trigger_pipeline` is deliberately untested and `import_variables` is blocked upstream —
  see the verification table in `README.md`
- **Minimal dependencies**: Only 2 npm packages (@modelcontextprotocol/server, zod)

## [0.1.1] - 2026-09-04

### Initial Release
- Basic MCP server structure
- Foundation for Brainboard API integration
