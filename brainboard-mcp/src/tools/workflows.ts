/** Workflows and pipeline runs — Terraform plan/apply from the agent. */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { BrainboardClient } from "../client.js";
import { runTool } from "../result.js";
import { uuid } from "../schemas.js";

export const registerWorkflowTools = (server: McpServer, client: BrainboardClient): void => {
  server.registerTool(
    "brainboard_list_workflows",
    {
      title: "List workflows",
      description:
        "List the CI/CD workflows attached to an architecture. Each workflow has an ID needed " +
        "by brainboard_trigger_pipeline.",
      inputSchema: z.object({
        architecture_uuid: uuid.describe("Architecture UUID."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ architecture_uuid }) =>
      runTool(() =>
        client.get(`/architectures/${encodeURIComponent(architecture_uuid)}/workflows`),
      ),
  );

  server.registerTool(
    "brainboard_list_workflow_templates",
    {
      title: "List workflow templates",
      description: "List the reusable workflow (pipeline) templates available to the organization.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => runTool(() => client.get("/workflow_templates")),
  );

  server.registerTool(
    "brainboard_trigger_pipeline",
    {
      title: "Trigger pipeline",
      description:
        "Trigger a workflow run for an architecture. Depending on how the workflow is configured " +
        "this can run terraform plan or apply against real cloud infrastructure, so confirm with " +
        "the user before calling it. Returns the pipeline record.",
      inputSchema: z.object({
        architecture_uuid: uuid.describe("Architecture UUID."),
        workflow_id: z
          .string()
          .min(1)
          .describe("Workflow ID, from brainboard_list_workflows."),
      }),
      annotations: {
        readOnlyHint: false,
        // A run can create or destroy cloud resources.
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ architecture_uuid, workflow_id }) =>
      runTool(() =>
        client.post(
          `/architectures/${encodeURIComponent(architecture_uuid)}` +
            `/workflows/${encodeURIComponent(workflow_id)}/trigger`,
        ),
      ),
  );
};
