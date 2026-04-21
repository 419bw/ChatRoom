import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ChatComposer, type ChatComposerHandle } from "./ChatComposer";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ChatComposer", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  });

  test("会向外暴露可控的 ChatComposerHandle", () => {
    const handleRef = createRef<ChatComposerHandle>();
    render(
      <ChatComposer
        ref={handleRef}
        value="你好"
        onChange={vi.fn()}
        onSend={vi.fn()}
      />,
    );

    expect(handleRef.current).toBeTruthy();
    expect(handleRef.current?.getElement()).toBeInstanceOf(HTMLTextAreaElement);
  });

  test("blurAndReset 会清选区并触发失焦", () => {
    const handleRef = createRef<ChatComposerHandle>();
    render(
      <ChatComposer
        ref={handleRef}
        value="大家好"
        onChange={vi.fn()}
        onSend={vi.fn()}
      />,
    );

    const textarea = handleRef.current?.getElement();
    expect(textarea).toBeTruthy();
    textarea?.setSelectionRange(2, 4);
    const blurSpy = vi.spyOn(textarea as HTMLTextAreaElement, "blur");

    expect(handleRef.current?.blurAndReset()).toBe(true);
    expect(textarea?.selectionStart).toBe(0);
    expect(textarea?.selectionEnd).toBe(0);
    expect(blurSpy).toHaveBeenCalledTimes(1);
  });

  test("中文输入法组合态下按回车不会发送消息", () => {
    const onSend = vi.fn();
    render(
      <ChatComposer
        value="输入中"
        onChange={vi.fn()}
        onSend={onSend}
      />,
    );

    const textarea = screen.getByPlaceholderText("输入聊天内容...");
    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, {
      key: "Enter",
      nativeEvent: {
        isComposing: true,
      },
    });

    expect(onSend).not.toHaveBeenCalled();
  });

  test("按 Enter 发送仍只触发提交，不触发取消", () => {
    const onSend = vi.fn();
    const onCancel = vi.fn();
    render(
      <ChatComposer
        value="准备发送"
        showCancelButton
        onChange={vi.fn()}
        onSend={onSend}
        onCancel={onCancel}
      />,
    );

    const textarea = screen.getByPlaceholderText("输入聊天内容...");
    fireEvent.keyDown(textarea, {
      key: "Enter",
    });
    fireEvent.keyDown(textarea, {
      key: "Enter",
      shiftKey: true,
    });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
