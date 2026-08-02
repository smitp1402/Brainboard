/** Projects and environments — the top of Brainboard's hierarchy. */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { BrainboardClient } from "../client.js";
import { runTool } from "../result.js";
import { projectRole, uuid } from "../schemas.js";

export const registerProjectTools = (server: McpServer, client: BrainboardClient): void => {
  server.registerTool(
    "brainboard_list_projects",
    {
      title: "List projects",
      description:
        "List all projects in the Brainboard organization, including their environments. " +
        "Start here — project and environment UUIDs from this call feed almost every other tool.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => runTool(() => client.get("/projects")),
  );

  server.registerTool(
    "brainboard_list_environments",
    {
      title: "List environments",
      description:
        "List the environments belonging to a project (for example dev, staging, prod).",
      inputSchema: z.object({
        project_uuid: uuid.describe("Project UUID, from brainboard_list_projects."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ project_uuid }) =>
      runTool(() => client.get(`/projects/${encodeURIComponent(project_uuid)}/environments`)),
  );

  server.registerTool(
    "brainboard_create_project",
    {
      title: "Create project",
      description:
        "Create a new project. Both environments and teams are required by the API — pass at " +
        "least one environment name, and a team UUID from brainboard_list_projects if unsure. " +
        "Each team needs a project role: 'admin' or 'guest'.",
      inputSchema: z.object({
        name: z.string().min(1).describe("Project name."),
        description: z.string().optional().describe("Project description."),
        environments: z
          .array(
            z.object({
              name: z.string().min(1).describe("Environment name, e.g. 'staging'."),
              description: z.string().optional(),
            }),
          )
          .min(1)
          .describe("Environments to create alongside the project."),
        teams: z
          .array(
            z.object({
              uuid: uuid.describe("Existing team UUID, from brainboard_list_projects."),
              // Undocumented in the spec: `role` is required, and the accepted
              // values are narrower than the org-level roles. Verified against
              // api.us1 — 'owner', 'member' and 'viewer' are all rejected with
              // "project role is invalid".
              role: projectRole.describe("Team's role on this project: 'admin' or 'guest'."),
            }),
          )
          .min(1)
          .describe("Teams granted access to the project, each with a project role."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (input) => runTool(() => client.post("/projects", input)),
  );
};
