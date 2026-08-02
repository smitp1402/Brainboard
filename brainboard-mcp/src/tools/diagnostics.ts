/**
 * A connectivity check that answers the two questions the Brainboard docs
 * don't: does this key work, and which Authorization header form does it want.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { BrainboardClient } from "../client.js";
import { runTool } from "../result.js";

export const registerDiagnosticTools = (server: McpServer, client: BrainboardClient): void => {
  server.registerTool(
    "brainboard_check_connection",
    {
      title: "Check connection",
      description:
        "Verify the API key and region by calling /projects. Reports which Authorization " +
        "header form the API accepted. Run this first when something is not working.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () =>
      runTool(async () => {
        const projects = await client.get<unknown[]>("/projects");
        return {
          ok: true,
          base_url: client.baseUrl,
          auth_scheme: client.activeScheme === "bearer" ? "Bearer <key>" : "<key> (raw)",
          project_count: Array.isArray(projects) ? projects.length : "unknown",
        };
      }),
  );
};
