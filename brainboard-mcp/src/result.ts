/**
 * Helpers for turning API calls into MCP tool results.
 *
 * Every tool funnels through `runTool` so failures reach the model as readable
 * text rather than an exception that kills the call, and so success payloads
 * are serialised the same way everywhere.
 */
import { BrainboardApiError } from "./client.js";

export interface ToolResult {
  readonly content: Array<{ type: "text"; text: string }>;
  readonly isError?: boolean;
  [key: string]: unknown;
}

const text = (value: string, isError = false): ToolResult =>
  isError
    ? { content: [{ type: "text", text: value }], isError: true }
    : { content: [{ type: "text", text: value }] };

export const ok = (payload: unknown): ToolResult =>
  text(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));

/** Turn an error into guidance the model (or the user reading it) can act on. */
const describe = (error: unknown): string => {
  if (error instanceof BrainboardApiError) {
    switch (error.status) {
      case 401:
      case 403:
        return (
          `${error.message}\n\n` +
          "The API key was rejected. Check that BRAINBOARD_API_KEY is valid and that " +
          "BRAINBOARD_REGION matches the region your organization is hosted in (us1 or apac1)."
        );
      case 404:
        return `${error.message}\n\nThe UUID may be wrong, or it may belong to another project or environment.`;
      case 408:
        return `${error.message}\n\nRaise BRAINBOARD_TIMEOUT_MS if the operation is expected to be slow.`;
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : String(error);
};

/** Run a tool body, mapping any throw into an MCP error result. */
export const runTool = async (fn: () => Promise<unknown>): Promise<ToolResult> => {
  try {
    return ok(await fn());
  } catch (error) {
    return text(describe(error), true);
  }
};
