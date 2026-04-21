import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ChatPanel } from "./ChatPanel";

const createMessages = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `message-${index}`,
    userId: "user-1",
    nickname: "阿青",
    avatar: {
      cosmetic: "mint" as const,
    },
    text: `消息 ${index + 1}`,
    sentAt: 1_700_000_000_000 + index * 1000,
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

describe("ChatPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    HTMLDivElement.prototype.scrollTo = vi.fn();
  });

  test("首次带消息渲染时会自动滚到底部", () => {
    const { container } = render(
      <ChatPanel
        collapsed={false}
        messages={createMessages(3)}
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
      />,
    );

    const history = container.querySelector(".chat-history") as HTMLDivElement;
    mockScrollMetrics(history);

    expect(HTMLDivElement.prototype.scrollTo).toHaveBeenCalled();
  });

  test("用户离开底部后，新消息不会强制打断阅读", () => {
    const { container, rerender } = render(
      <ChatPanel
        collapsed={false}
        messages={createMessages(2)}
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
      />,
    );

    const history = container.querySelector(".chat-history") as HTMLDivElement;
    mockScrollMetrics(history, {
      scrollHeight: 800,
      clientHeight: 100,
      scrollTop: 120,
    });

    vi.mocked(HTMLDivElement.prototype.scrollTo).mockClear();
    fireEvent.scroll(history);

    rerender(
      <ChatPanel
        collapsed={false}
        messages={createMessages(3)}
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
      />,
    );

    expect(HTMLDivElement.prototype.scrollTo).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "有 1 条新消息，回到底部" })).toBeTruthy();
  });

  test("本地发送后即使此前未贴底，也会在新消息到达时回到底部", () => {
    const onSend = vi.fn();
    const { container, rerender } = render(
      <ChatPanel
        collapsed={false}
        messages={createMessages(2)}
        value="你好"
        onChange={vi.fn()}
        onSend={onSend}
      />,
    );

    const history = container.querySelector(".chat-history") as HTMLDivElement;
    const sendButton = container.querySelector(".chat-input-row button") as HTMLButtonElement;
    mockScrollMetrics(history, {
      scrollHeight: 900,
      clientHeight: 120,
      scrollTop: 100,
    });

    fireEvent.scroll(history);
    vi.mocked(HTMLDivElement.prototype.scrollTo).mockClear();
    fireEvent.click(sendButton);

    rerender(
      <ChatPanel
        collapsed={false}
        messages={createMessages(3)}
        value=""
        onChange={vi.fn()}
        onSend={onSend}
      />,
    );

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(HTMLDivElement.prototype.scrollTo).toHaveBeenCalled();
  });
});
