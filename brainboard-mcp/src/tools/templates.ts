/** Architecture templates — the fastest path from prompt to running diagram. */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { BrainboardClient } from "../client.js";
import { runTool } from "../result.js";
import { cloneRequestFields, uuid } from "../schemas.js";

export const registerTemplateTools = (server: McpServer, client: BrainboardClient): void => {
  server.registerTool(
    "brainboard_list_templates",
    {
      title: "List architecture templates",
      description:
        "List the architecture templates available to the organization — reusable, pre-built " +
        "cloud designs (AWS three-tier, AKS cluster, and so on). Use the UUID of one with " +
        "brainboard_clone_from_template.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => runTool(() => client.get("/architectures/templates")),
  );

  server.registerTool(
    "brainboard_clone_from_template",
    {
      title: "Clone from template",
      description:
        "Clone a template into a project and environment as a new architecture, optionally " +
        "overriding variables such as region or instance size. This is the main way to go from " +
        "a natural-language request to a real diagram plus Terraform.",
      inputSchema: z.object({
        template_uuid: uuid.describe(
          "UUID of the template to clone, from brainboard_list_templates.",
        ),
        ...cloneRequestFields,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ template_uuid, ...body }) =>
      runTool(() =>
        client.post(`/architectures/templates/${encodeURIComponent(template_uuid)}/clone`, {
          ...body,
          architecture: template_uuid,
        }),
      ),
  );

  server.registerTool(
    "brainboard_create_template",
    {
      title: "Create architecture template",
      description: "Promote an architecture into a reusable template.",
      inputSchema: z.object({
        architecture: uuid
          .optional()
          .describe("UUID of the source architecture to turn into a template."),
        ...cloneRequestFields,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (input) => runTool(() => client.post("/architectures/templates", input)),
  );
};
