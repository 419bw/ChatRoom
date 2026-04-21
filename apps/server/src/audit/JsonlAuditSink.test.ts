import { beforeEach, describe, expect, test, vi } from "vitest";

const { appendFileMock, mkdirMock } = vi.hoisted(() => ({
  appendFileMock: vi.fn(),
  mkdirMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:fs/promises", () => ({
  appendFile: appendFileMock,
  mkdir: mkdirMock,
}));

import { JsonlAuditSink } from "./JsonlAuditSink";

describe("JsonlAuditSink", () => {
  beforeEach(() => {
    appendFileMock.mockReset();
    mkdirMock.mockClear();
  });

  test("遇到 EBUSY 时会重试并最终写入成功", async () => {
    appendFileMock
      .mockRejectedValueOnce(Object.assign(new Error("busy"), { code: "EBUSY" }))
      .mockResolvedValue(undefined);

    const sink = new JsonlAuditSink("C:/temp/chat-log-test");

    await expect(
      sink.appendNotice({
        id: "notice-1",
        severity: "info",
        message: "进入房间",
        createdAt: 1000,
      }),
    ).resolves.toBeUndefined();

    expect(mkdirMock).toHaveBeenCalledTimes(1);
    expect(appendFileMock).toHaveBeenCalledTimes(2);
  });

  test("非重试错误会被吞掉，不阻断主流程", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    appendFileMock.mockRejectedValueOnce(new Error("disk failed"));

    const sink = new JsonlAuditSink("C:/temp/chat-log-test");

    await expect(
      sink.appendTimeline({
        id: "timeline-1",
        category: "presence_event",
        message: "阿青加入了房间",
        createdAt: 1000,
        meta: {},
      }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
