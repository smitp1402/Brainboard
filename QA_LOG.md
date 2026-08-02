# Q&A Log

Technical questions from this project, with short answers. Newest at the bottom.

### Does Brainboard expose an MCP server, and is wrapping its REST API viable?
`2026-08-01` · #mcp #brainboard #iac

No official MCP server exists. Brainboard's AI is in-app only; its listed
integrations are CI/CD, security scanning, cost estimation, webhooks, and GitOps.
The "MCP" result on their site is a Terraform template that *deploys* an MCP
server on Azure Functions — not Brainboard-as-MCP.

It does have a public REST API (API-key auth, regions `api.us1.brainboard.co`
and `api.apac1.brainboard.co`) covering projects, environments, templates, clone,
variables, and pipeline triggers — enough surface for ~8–10 tools. Node-by-node
diagram building and raw Terraform fetch are not exposed, so a demo has to follow
the template → clone → set variables → trigger pipeline path.
