/**
 * Variable import — the one endpoint not confirmed working against the live API.
 *
 * What probing established (2026-08-02, api.us1):
 *  - A JSON body returns FILE_UPLOAD_MAX_SIZE, i.e. the server does attempt a
 *    multipart parse. The spec's `multipart/form-data` is therefore correct.
 *  - Every multipart attempt returns INVALID_BODY, not MISSING_FILE_UPLOAD —
 *    and MISSING_FILE_UPLOAD is a distinct code in the spec's error enum. So
 *    the request is rejected for a reason other than an absent file part.
 *  - 20 combinations were tried: file field names (file, variables, tfvars,
 *    varfile, files, files[], data), contents (tfvars, a variable block, JSON
 *    map, JSON array) and flags (override true/false/absent, import_type).
 *    All returned an identical INVALID_BODY.
 *
 * Something required is undocumented. The tool is kept — with `file_field` and
 * `extra_fields` escape hatches — so it works the moment Brainboard clarifies,
 * without a code change.
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
        "KNOWN ISSUE: this endpoint currently returns INVALID_BODY for every documented " +
        "request shape — Brainboard requires something the spec does not publish. Use " +
        "file_field and extra_fields to experiment; prefer setting variables via " +
        "variable_values on the clone tools instead.",
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
        extra_fields: z
          .record(z.string(), z.string())
          .optional()
          .describe("Additional multipart fields to send, for probing undocumented requirements."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ architecture_uuid, content, filename, override, file_field, extra_fields }) =>
      runTool(() => {
        const form = new FormData();
        form.append(file_field, new Blob([content], { type: "text/plain" }), filename);
        form.append("override", String(override));
        for (const [key, value] of Object.entries(extra_fields ?? {})) {
          form.append(key, value);
        }
        return client.postForm(
          `/variables/import/${encodeURIComponent(architecture_uuid)}`,
          form,
        );
      }),
  );
};
