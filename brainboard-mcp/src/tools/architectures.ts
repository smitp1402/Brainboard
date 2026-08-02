/** Architectures: listing, cloning and versioning existing diagrams. */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { BrainboardClient } from "../client.js";
import { runTool } from "../result.js";
import { cloneRequestFields, uuid } from "../schemas.js";

export const registerArchitectureTools = (
  server: McpServer,
  client: BrainboardClient,
): void => {
  server.registerTool(
    "brainboard_list_architectures",
    {
      title: "List architectures",
      description: "List the architectures inside an environment.",
      inputSchema: z.object({
        environment_uuid: uuid.describe(
          "Environment UUID, from brainboard_list_environments.",
        ),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ environment_uuid }) =>
      runTool(() =>
        client.get(`/environments/${encodeURIComponent(environment_uuid)}/architectures`),
      ),
  );

  server.registerTool(
    "brainboard_clone_architecture",
    {
      title: "Clone architecture",
      description:
        "Clone an existing architecture into a project and environment, optionally overriding " +
        "its variables. Use brainboard_clone_from_template to start from a public template instead.",
      inputSchema: z.object({
        architecture_uuid: uuid.describe("UUID of the architecture to clone."),
        ...cloneRequestFields,
        synced: z
          .boolean()
          .optional()
          .describe("Keep the clone synced with the source architecture."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ architecture_uuid, ...body }) =>
      runTool(() =>
        client.post(`/architectures/${encodeURIComponent(architecture_uuid)}/clone`, body),
      ),
  );

  server.registerTool(
    "brainboard_version_architecture",
    {
      title: "Version architecture",
      description:
        "Create a new version (a commit) of an architecture, capturing its current state.",
      inputSchema: z.object({
        architecture_uuid: uuid.describe("UUID of the architecture to version."),
        commitMsg: z.string().optional().describe("Message describing this version."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ architecture_uuid, commitMsg }) =>
      runTool(() =>
        client.post(`/architectures/${encodeURIComponent(architecture_uuid)}/versions`, {
          commitMsg,
        }),
      ),
  );
};
