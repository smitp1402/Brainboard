/** Single place to wire every tool group onto the server. */
import type { McpServer } from "@modelcontextprotocol/server";
import type { BrainboardClient } from "../client.js";
import { registerArchitectureTools } from "./architectures.js";
import { registerDiagnosticTools } from "./diagnostics.js";
import { registerProjectTools } from "./projects.js";
import { registerTemplateTools } from "./templates.js";
import { registerVariableTools } from "./variables.js";
import { registerWorkflowTools } from "./workflows.js";

export const registerAllTools = (server: McpServer, client: BrainboardClient): void => {
  registerDiagnosticTools(server, client);
  registerProjectTools(server, client);
  registerArchitectureTools(server, client);
  registerTemplateTools(server, client);
  registerWorkflowTools(server, client);
  registerVariableTools(server, client);
};
