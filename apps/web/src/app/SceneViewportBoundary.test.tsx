import { lazy, Suspense } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { SceneViewportBoundary } from "./SceneViewportBoundary";

describe("SceneViewportBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("懒加载视口失败时仍显示错误兜底而不是整页空白", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const BrokenViewport = lazy(async () => {
      throw new Error("lazy load failed");
    });

    render(
      <SceneViewportBoundary resetKey="scene-a">
        <Suspense fallback={<div>加载中</div>}>
          <BrokenViewport />
        </Suspense>
      </SceneViewportBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText("3D 场景加载失败")).toBeTruthy();
    });
    expect(
      screen.getByText("请刷新页面后重试，若仍失败请查看控制台日志。"),
    ).toBeTruthy();
    expect(consoleError).toHaveBeenCalled();
  });
});
