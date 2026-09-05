import { afterEach, describe, expect, it, vi } from "vitest";
import { BrainboardApiError, BrainboardClient } from "./client.js";
import { loadConfig } from "./config.js";

const config = (env: Record<string, string | undefined> = {}) =>
  loadConfig({ BRAINBOARD_API_KEY: "key-123", ...env });

/**
 * A Response body can only be read once, so mocks must mint a fresh instance
 * per call rather than resolving the same object repeatedly.
 */
const json = (status: number, body: unknown) => () =>
  new Response(JSON.stringify(body), { status });

const authOf = (call: unknown[]): string => {
  const init = call[1] as RequestInit;
  return (init.headers as Record<string, string>).Authorization ?? "";
};

afterEach(() => vi.unstubAllGlobals());

describe("auth scheme resolution", () => {
  it("uses the raw key when the API accepts it", async () => {
    const fetchMock = vi.fn().mockImplementation(json(200, []));
    vi.stubGlobal("fetch", fetchMock);

    const client = new BrainboardClient(config());
    await client.get("/projects");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authOf(fetchMock.mock.calls[0]!)).toBe("key-123");
    expect(client.activeScheme).toBe("raw");
  });

  it("falls back to Bearer after a 401 and remembers it", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(json(401, { error: "unauthorized" }))
      .mockImplementation(json(200, []));
    vi.stubGlobal("fetch", fetchMock);

    const client = new BrainboardClient(config());
    await client.get("/projects");

    expect(authOf(fetchMock.mock.calls[0]!)).toBe("key-123");
    expect(authOf(fetchMock.mock.calls[1]!)).toBe("Bearer key-123");
    expect(client.activeScheme).toBe("bearer");

    // Second call should not re-probe the raw form.
    await client.get("/projects");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(authOf(fetchMock.mock.calls[2]!)).toBe("Bearer key-123");
  });

  it("honours an explicitly pinned scheme without probing", async () => {
    const fetchMock = vi.fn().mockImplementation(json(401, {}));
    vi.stubGlobal("fetch", fetchMock);

    const client = new BrainboardClient(config({ BRAINBOARD_AUTH_SCHEME: "bearer" }));
    await expect(client.get("/projects")).rejects.toBeInstanceOf(BrainboardApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("error handling", () => {
  it("does not retry non-auth failures", async () => {
    const fetchMock = vi.fn().mockImplementation(json(404, { error: "missing" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new BrainboardClient(config());
    await expect(client.get("/projects/x")).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("wraps network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const client = new BrainboardClient(config());
    await expect(client.get("/projects")).rejects.toThrow(/ECONNREFUSED/);
  });
});

describe("request shaping", () => {
  it("sends JSON bodies with a content type", async () => {
    const fetchMock = vi.fn().mockImplementation(json(200, { uuid: "abc" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new BrainboardClient(config());
    await client.post("/projects", { name: "demo" });

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "demo" }));
  });

  it("leaves the content type unset for multipart uploads", async () => {
    const fetchMock = vi.fn().mockImplementation(json(200, {}));
    vi.stubGlobal("fetch", fetchMock);

    const form = new FormData();
    form.append("override", "true");
    const client = new BrainboardClient(config());
    await client.postForm("/variables/import/abc", form);

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("treats an empty 204 as success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Response(null, { status: 204 })));
    const client = new BrainboardClient(config());
    await expect(client.post("/variables/import/abc")).resolves.toEqual({ ok: true });
  });
});
