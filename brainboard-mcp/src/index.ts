#!/usr/bin/env node
/**
 * brainboard-mcp — an MCP server for the Brainboard public API.
 *
 * Transport is stdio: the process is launched by the MCP client, so stdout is
 * reserved for protocol traffic and all logging goes to stderr.
 */
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { BrainboardClient } from "./client.js";
import { ConfigError, loadConfig } from "./config.js";
import { registerAllTools } from "./tools/index.js";

const main = async (): Promise<void> => {
  const config = loadConfig();
  const client = new BrainboardClient(config);

  const server = new McpServer({
    name: "brainboard-mcp",
    version: "0.1.0",
  });

  registerAllTools(server, client);

  await server.connect(new StdioServerTransport());
  console.error(`brainboard-mcp ready — region ${config.region} (${config.baseUrl})`);
};

main().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    console.error(`brainboard-mcp: ${error.message}`);
  } else {
    console.error("brainboard-mcp failed to start:", error);
  }
  process.exit(1);
});
