/**
 * Environment configuration for the Brainboard MCP server.
 *
 * Read once at startup and treated as immutable thereafter. Failing here is
 * intentional: a server that starts without credentials would only surface the
 * problem later as a wall of 401s inside the agent's tool calls.
 */

/** Brainboard exposes one API host per region. */
export const REGION_HOSTS = {
  us1: "https://api.us1.brainboard.co",
  apac1: "https://api.apac1.brainboard.co",
} as const;

export type Region = keyof typeof REGION_HOSTS;

/**
 * How the API key is presented in the `Authorization` header.
 *
 * The OpenAPI spec only declares `type: apiKey, in: header, name: Authorization`
 * — it never states whether a `Bearer ` prefix is expected, and Brainboard's
 * docs page for the API is an empty stub. `auto` resolves this at runtime by
 * trying the raw key first and falling back to `Bearer` on a 401/403.
 */
export type AuthScheme = "auto" | "raw" | "bearer";

export interface Config {
  readonly apiKey: string;
  readonly region: Region;
  readonly baseUrl: string;
  readonly authScheme: AuthScheme;
  readonly requestTimeoutMs: number;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const isRegion = (value: string): value is Region => value in REGION_HOSTS;

const isAuthScheme = (value: string): value is AuthScheme =>
  value === "auto" || value === "raw" || value === "bearer";

const parseTimeout = (raw: string | undefined): number => {
  if (!raw) return 30_000;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ConfigError(
      `BRAINBOARD_TIMEOUT_MS must be a positive number, got "${raw}".`,
    );
  }
  return parsed;
};

/** Build config from `process.env`, or throw a message a human can act on. */
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const apiKey = env.BRAINBOARD_API_KEY?.trim();
  if (!apiKey) {
    throw new ConfigError(
      "BRAINBOARD_API_KEY is not set. Generate a key in Brainboard settings and " +
        "pass it to the server, e.g. in your MCP client config:\n" +
        '  "env": { "BRAINBOARD_API_KEY": "<your-key>" }',
    );
  }

  const rawRegion = (env.BRAINBOARD_REGION ?? "us1").trim().toLowerCase();
  if (!isRegion(rawRegion)) {
    throw new ConfigError(
      `BRAINBOARD_REGION must be one of ${Object.keys(REGION_HOSTS).join(", ")}, got "${rawRegion}".`,
    );
  }

  const rawScheme = (env.BRAINBOARD_AUTH_SCHEME ?? "auto").trim().toLowerCase();
  if (!isAuthScheme(rawScheme)) {
    throw new ConfigError(
      `BRAINBOARD_AUTH_SCHEME must be auto, raw or bearer, got "${rawScheme}".`,
    );
  }

  const baseUrl = env.BRAINBOARD_BASE_URL?.trim() || REGION_HOSTS[rawRegion];

  return Object.freeze({
    apiKey,
    region: rawRegion,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    authScheme: rawScheme,
    requestTimeoutMs: parseTimeout(env.BRAINBOARD_TIMEOUT_MS),
  });
};
