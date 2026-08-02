/**
 * Variable import.
 *
 * Caveat: the OpenAPI spec declares this endpoint as `multipart/form-data` but
 * only documents the `override` field — the name of the file part is not in the
 * spec, and Brainboard's API docs page is empty. `file` is the conventional
 * guess; `file_field` lets a caller correct it without a code change.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { BrainboardClient } from "../client.js";
import { runTool } from "../result.js";
import { uuid } from "../schemas.js";

export const registerVariableTools = (server: McpServer, client: BrainboardClient): void => {
  server.registerTool(
    "brainboard_import_variables",
    {
      title: "Import variables",
      description:
        "Import Terraform variables into an architecture by uploading tfvars content. " +
        "Note: the file field name is not documented by Brainboard; if the API rejects the " +
        "upload, retry with a different file_field value.",
      inputSchema: z.object({
        architecture_uuid: uuid.describe("Architecture UUID to import variables into."),
        content: z
          .string()
          .min(1)
          .describe('Variable file contents, e.g. \'region = "us-east-1"\'.'),
        filename: z.string().default("terraform.tfvars").describe("Name for the uploaded file."),
        override: z
          .boolean()
          .default(false)
          .describe("Overwrite variables that already exist on the architecture."),
        file_field: z
          .string()
          .default("file")
          .describe("Multipart field name for the file part. Change only if the upload fails."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ architecture_uuid, content, filename, override, file_field }) =>
      runTool(() => {
        const form = new FormData();
        form.append(file_field, new Blob([content], { type: "text/plain" }), filename);
        form.append("override", String(override));
        return client.postForm(
          `/variables/import/${encodeURIComponent(architecture_uuid)}`,
          form,
        );
      }),
  );
};
