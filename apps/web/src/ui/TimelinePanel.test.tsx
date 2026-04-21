import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { TimelinePanel } from "./TimelinePanel";

const createEntries = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `entry-${index}`,
    category: "presence_event" as const,
    message: `u${index} 加入了房间`,
    createdAt: 1_700_000_000_000 + index * 1000,
    actorId: `user-${index}`,
    actorName: `成员 ${index + 1}`,
    meta: {
      action: "join",
    },
  }));

const mockScrollMetrics = (
  element: HTMLDivElement,
  metrics?: Partial<Pick<HTMLDivElement, "scrollHeight" | "clientHeight" | "scrollTop">>,
) => {
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: metrics?.scrollHeight ?? 500,
  });
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: metrics?.clientHeight ?? 100,
  });
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    writable: true,
    value: metrics?.scrollTop ?? 400,
  });
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TimelinePanel", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    HTMLDivElement.prototype.scrollTo = vi.fn();
  });

  test("首次带动态渲染时会自动滚动到底部", () => {
    const { container } = render(
      <TimelinePanel collapsed={false} entries={createEntries(3)} />,
    );

    const history = container.querySelector(".timeline-history") as HTMLDivElement;
    mockScrollMetrics(history);

    expect(HTMLDivElement.prototype.scrollTo).toHaveBeenCalled();
  });

  test("用户离开底部后，新动态只会累加未读而不会抢焦点", () => {
    const onUnreadCountChange = vi.fn();
    const { container, rerender } = render(
      <TimelinePanel
        collapsed={false}
        entries={createEntries(2)}
        onUnreadCountChange={onUnreadCountChange}
      />,
    );

    const history = container.querySelector(".timeline-history") as HTMLDivElement;
    mockScrollMetrics(history, {
      scrollHeight: 800,
      clientHeight: 100,
      scrollTop: 120,
    });

    vi.mocked(HTMLDivElement.prototype.scrollTo).mockClear();
    fireEvent.scroll(history);

    rerender(
      <TimelinePanel
        collapsed={false}
        entries={createEntries(3)}
        onUnreadCountChange={onUnreadCountChange}
      />,
    );

    expect(HTMLDivElement.prototype.scrollTo).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "有 1 条未读动态，回到底部" })).toBeTruthy();
    expect(onUnreadCountChange).toHaveBeenLastCalledWith(1);
  });
});
