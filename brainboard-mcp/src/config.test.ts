import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig, REGION_HOSTS } from "./config.js";

const base = { BRAINBOARD_API_KEY: "key-123" } as NodeJS.ProcessEnv;

describe("loadConfig", () => {
  it("defaults to the us1 region", () => {
    const config = loadConfig(base);
    expect(config.region).toBe("us1");
    expect(config.baseUrl).toBe(REGION_HOSTS.us1);
    expect(config.authScheme).toBe("auto");
    expect(config.requestTimeoutMs).toBe(30_000);
  });

  it("throws a actionable error when the key is missing", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({ BRAINBOARD_API_KEY: "   " })).toThrow(/BRAINBOARD_API_KEY/);
  });

  it("accepts apac1 and is case-insensitive", () => {
    expect(loadConfig({ ...base, BRAINBOARD_REGION: "APAC1" }).baseUrl).toBe(
      REGION_HOSTS.apac1,
    );
  });

  it("rejects an unknown region", () => {
    expect(() => loadConfig({ ...base, BRAINBOARD_REGION: "eu9" })).toThrow(/us1, apac1/);
  });

  it("rejects an unknown auth scheme", () => {
    expect(() => loadConfig({ ...base, BRAINBOARD_AUTH_SCHEME: "basic" })).toThrow(
      /auto, raw or bearer/,
    );
  });

  it("rejects a non-numeric timeout", () => {
    expect(() => loadConfig({ ...base, BRAINBOARD_TIMEOUT_MS: "soon" })).toThrow(
      /positive number/,
    );
  });

  it("strips trailing slashes from an explicit base url", () => {
    const config = loadConfig({ ...base, BRAINBOARD_BASE_URL: "https://example.test/api//" });
    expect(config.baseUrl).toBe("https://example.test/api");
  });

  it("returns a frozen object", () => {
    expect(Object.isFrozen(loadConfig(base))).toBe(true);
  });
});
