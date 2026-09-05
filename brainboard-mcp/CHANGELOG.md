# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-09-05

### Added
- Complete MCP tool suite: 14 tools covering all Brainboard API operations
- Comprehensive test coverage: 16 tests validating auth, errors, and request handling
- Demo commands reference (`DEMO_COMMANDS.md`) for live presentations
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
- **Production ready**: Tested against live Brainboard API
- **Fast startup**: ~200ms server initialization time
- **Minimal dependencies**: Only 2 npm packages (@modelcontextprotocol/server, zod)

## [0.1.1] - 2026-09-04

### Initial Release
- Basic MCP server structure
- Foundation for Brainboard API integration
