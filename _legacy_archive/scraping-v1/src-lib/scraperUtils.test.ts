import { describe, expect, it } from "vitest";
import { buildRotatingHeaders, getRandomUserAgent, USER_AGENTS } from "../scraperUtils";

describe("scraperUtils", () => {
  it("returns a user agent from the pool", () => {
    const userAgent = getRandomUserAgent();
    expect(USER_AGENTS).toContain(userAgent);
  });

  it("buildRotatingHeaders merges additional headers", () => {
    const headers = buildRotatingHeaders({ Accept: "text/html" });
    expect(headers["User-Agent"]).toBeTruthy();
    expect(headers.Accept).toBe("text/html");
  });
});
