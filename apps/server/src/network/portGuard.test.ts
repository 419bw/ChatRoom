import { describe, expect, test, vi } from "vitest";

import { attachListenErrorHandler, formatPortInUseMessage } from "./portGuard";

describe("portGuard", () => {
  test("占用提示会输出明确端口信息", () => {
    expect(formatPortInUseMessage(3001, "0.0.0.0")).toContain("3001");
    expect(formatPortInUseMessage(3001, "0.0.0.0")).toContain("0.0.0.0:3001");
  });

  test("监听错误处理器会在端口占用时设置退出码", () => {
    const listeners = new Map<string, (error: NodeJS.ErrnoException) => void>();
    const server = {
      on(event: string, listener: (error: NodeJS.ErrnoException) => void) {
        listeners.set(event, listener);
        return this;
      },
    } as never;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const originalExitCode = process.exitCode;

    attachListenErrorHandler(server, 3001, "0.0.0.0");
    listeners.get("error")?.({
      code: "EADDRINUSE",
      message: "already in use",
      name: "Error",
    } as NodeJS.ErrnoException);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalled();

    process.exitCode = originalExitCode;
    errorSpy.mockRestore();
  });
});
