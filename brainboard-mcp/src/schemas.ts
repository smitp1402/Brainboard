/** Shared Zod pieces mirrored from BrainboardAPI.json (OpenAPI 3.0). */
import { z } from "zod";

export const uuid = z.string().uuid();

/** `brainboard_co_brainboard_pkg_domain_security_visibility.Visibility` */
export const visibility = z.enum(["public", "organization"]);

/**
 * `CloneArchitectureRequest` — shared by CloneFromTemplate, CloneArchitecture
 * and CreateArchitectureTemplate.
 */
export const cloneRequestFields = {
  name: z.string().min(1).describe("Name for the new architecture."),
  description: z.string().optional().describe("Description for the new architecture."),
  project: uuid.optional().describe("Destination project UUID."),
  environment: uuid.optional().describe("Destination environment UUID."),
  visibility: visibility.optional().describe("'organization' (default) or 'public'."),
  variable_values: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Map of variable name to value, overriding the source architecture's variables."),
} as const;
