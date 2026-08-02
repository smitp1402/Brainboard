/**
 * Thin HTTP client over the Brainboard public API.
 *
 * Responsibilities kept deliberately narrow: auth, timeouts, and turning
 * non-2xx responses into readable errors. Endpoint knowledge lives in the
 * tool modules, not here.
 */
import type { AuthScheme, Config } from "./config.js";

export class BrainboardApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly body: string;

  constructor(status: number, path: string, body: string) {
    super(`Brainboard API ${status} on ${path}${body ? `: ${body}` : ""}`);
    this.name = "BrainboardApiError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

interface RequestOptions {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly body?: unknown;
  /** Sent as multipart/form-data instead of JSON. */
  readonly form?: FormData;
}

/** Header value for a given scheme. Brainboard uses `Authorization` for both. */
const authHeader = (apiKey: string, scheme: Exclude<AuthScheme, "auto">): string =>
  scheme === "bearer" ? `Bearer ${apiKey}` : apiKey;

const isAuthFailure = (status: number): boolean => status === 401 || status === 403;

export class BrainboardClient {
  private readonly config: Config;

  /**
   * Resolved header scheme. Starts unset when configured as `auto` and is
   * pinned to whichever form the API accepts on the first successful call, so
   * the probe cost is paid at most once per process.
   */
  private resolvedScheme: Exclude<AuthScheme, "auto"> | undefined;

  constructor(config: Config) {
    this.config = config;
    if (config.authScheme !== "auto") {
      this.resolvedScheme = config.authScheme;
    }
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  /** The auth form in use, once known. Exposed for the diagnostics tool. */
  get activeScheme(): AuthScheme {
    return this.resolvedScheme ?? "auto";
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const candidates: Array<Exclude<AuthScheme, "auto">> = this.resolvedScheme
      ? [this.resolvedScheme]
      : ["raw", "bearer"];

    let lastError: BrainboardApiError | undefined;

    for (const scheme of candidates) {
      const response = await this.send(options, scheme);

      if (response.ok) {
        this.resolvedScheme = scheme;
        return (await this.parse(response)) as T;
      }

      const body = await response.text().catch(() => "");
      lastError = new BrainboardApiError(response.status, options.path, body.slice(0, 800));

      // Only an auth failure is worth retrying with the other header form.
      if (!isAuthFailure(response.status)) throw lastError;
    }

    throw lastError ?? new BrainboardApiError(0, options.path, "no response");
  }

  private async send(
    options: RequestOptions,
    scheme: Exclude<AuthScheme, "auto">,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: authHeader(this.config.apiKey, scheme),
      Accept: "application/json",
    };

    let body: string | FormData | undefined;
    if (options.form) {
      // Let fetch set the multipart boundary itself.
      body = options.form;
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      return await fetch(`${this.config.baseUrl}${options.path}`, {
        method: options.method,
        headers,
        body,
        signal: controller.signal,
      });
    } catch (cause) {
      if (controller.signal.aborted) {
        throw new BrainboardApiError(
          408,
          options.path,
          `request timed out after ${this.config.requestTimeoutMs}ms`,
        );
      }
      throw new BrainboardApiError(
        0,
        options.path,
        cause instanceof Error ? cause.message : String(cause),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async parse(response: Response): Promise<unknown> {
    if (response.status === 204) return { ok: true };
    const text = await response.text();
    if (!text) return { ok: true };
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>({ method: "GET", path });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>({ method: "POST", path, body });
  }

  postForm<T>(path: string, form: FormData): Promise<T> {
    return this.request<T>({ method: "POST", path, form });
  }
}
