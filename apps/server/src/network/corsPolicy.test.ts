import { describe, expect, test } from "vitest";

import { createCorsOriginValidator, isAllowedOrigin } from "./corsPolicy";

describe("corsPolicy", () => {
  test("放行本机和局域网 IP 来源", () => {
    expect(isAllowedOrigin("http://localhost:5173")).toBe(true);
    expect(isAllowedOrigin("http://192.168.1.18:5173")).toBe(true);
    expect(isAllowedOrigin("http://10.0.0.20:5173")).toBe(true);
  });

  test("放行局域网主机名来源", () => {
    expect(isAllowedOrigin("http://DESKTOP-ABC:5173")).toBe(true);
  });

  test("拒绝未显式放行的公网来源", () => {
    expect(isAllowedOrigin("https://example.com")).toBe(false);
  });

  test("支持额外白名单来源", () => {
    expect(isAllowedOrigin("https://example.com", ["https://example.com"])).toBe(true);
  });

  test("验证器函数会把结果回传给回调", () => {
    const validator = createCorsOriginValidator("https://example.com");
    let allow = false;

    validator("https://example.com", (_error, accepted) => {
      allow = Boolean(accepted);
    });

    expect(allow).toBe(true);
  });
});
