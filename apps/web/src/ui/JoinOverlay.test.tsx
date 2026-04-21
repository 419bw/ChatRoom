import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { JoinOverlay } from "./JoinOverlay";

afterEach(() => {
  cleanup();
});

describe("JoinOverlay", () => {
  test("文案强调默认进入空间视角，不再承诺点击地面移动", () => {
    render(
      <JoinOverlay
        nickname="游客"
        avatar="mint"
        statusText="准备进入暖光会客室"
        busy={false}
        onNicknameChange={vi.fn()}
        onAvatarChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("暖光会客室")).toBeTruthy();
    expect(screen.getByText(/默认进入空间视角/)).toBeTruthy();
    expect(screen.getByText("Enter")).toBeTruthy();
    expect(screen.queryByText(/点击地面移动/)).toBeNull();
  });

  test("连接错误时会展示明确提示并切换为重试按钮", () => {
    render(
      <JoinOverlay
        nickname="游客"
        avatar="mint"
        statusText="修正服务状态后可重新尝试进入房间。"
        errorMessage="无法连接房间服务，请先启动本地服务器后重试。"
        busy={false}
        onNicknameChange={vi.fn()}
        onAvatarChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("进入房间失败");
    expect(screen.getByRole("button", { name: "重新进入" })).toBeTruthy();
  });

  test("中文输入法组合态下按回车不会触发进入房间", () => {
    const onSubmit = vi.fn();
    render(
      <JoinOverlay
        nickname="游客"
        avatar="mint"
        statusText="准备进入暖光会客室"
        busy={false}
        onNicknameChange={vi.fn()}
        onAvatarChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const input = screen.getByPlaceholderText("例如：阿青");
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, {
      key: "Enter",
      nativeEvent: {
        isComposing: true,
      },
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
