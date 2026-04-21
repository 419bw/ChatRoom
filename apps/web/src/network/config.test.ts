import { describe, expect, test } from "vitest";

import { resolveSocketUrl } from "./config";

describe("resolveSocketUrl", () => {
  test("优先使用显式配置的 Socket 地址", () => {
    expect(
      resolveSocketUrl("http://192.168.1.8:4000", {
        protocol: "http:",
        hostname: "192.168.1.3",
      }),
    ).toBe("http://192.168.1.8:4000");
  });

  test("未配置时根据当前访问主机推导 Socket 地址", () => {
    expect(
      resolveSocketUrl(undefined, {
        protocol: "http:",
        hostname: "192.168.1.10",
      }),
    ).toBe("http://192.168.1.10:3001");
  });

  test("无浏览器上下文时回退到 localhost", () => {
    expect(resolveSocketUrl()).toBe("http://localhost:3001");
  });
});
