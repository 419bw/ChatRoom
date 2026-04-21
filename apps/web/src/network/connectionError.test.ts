import { describe, expect, test } from "vitest";

import { resolveConnectionErrorMessage } from "./connectionError";

describe("connectionError", () => {
  test("会把服务不可达映射成明确的启动提示", () => {
    expect(
      resolveConnectionErrorMessage("connect_error", {
        message: "websocket error",
      }),
    ).toContain("启动");
  });

  test("join 超时会返回可重试文案", () => {
    expect(resolveConnectionErrorMessage("join_timeout")).toContain("超时");
  });

  test("断线会返回重新进入提示", () => {
    expect(resolveConnectionErrorMessage("disconnect")).toContain("重新进入");
  });
});
