import { describe, expect, test } from "vitest";

import {
  projectAnchorToScreen,
  resolveBubbleOverlayState,
  resolveLabelOverlayState,
  resolveOverlayTransform,
  shouldCommitOverlayState,
  stabilizeOverlayState,
} from "./overlayProjection";

describe("overlayProjection", () => {
  test("标签在视口内且距离合格时可见", () => {
    const state = resolveLabelOverlayState({
      projected: { x: 0, y: 0, z: 0 },
      viewport: { width: 1280, height: 720 },
      distance: 8,
      maxDistance: 16,
    });

    expect(state.visible).toBe(true);
    expect(state.x).toBe(640);
    expect(state.y).toBe(360);
  });

  test("气泡会跟随标签可见性并受距离约束", () => {
    const state = resolveBubbleOverlayState({
      projected: { x: 0.1, y: -0.2, z: 0.1 },
      viewport: { width: 1280, height: 720 },
      distance: 12,
      maxDistance: 13,
      hasText: true,
      labelVisible: true,
    });

    expect(state.visible).toBe(true);
  });

  test("气泡在超距离时会隐藏", () => {
    const state = resolveBubbleOverlayState({
      projected: { x: 0, y: 0, z: 0 },
      viewport: { width: 1280, height: 720 },
      distance: 18,
      maxDistance: 13,
      hasText: true,
      labelVisible: true,
    });

    expect(state.visible).toBe(false);
  });

  test("屏幕坐标会做边缘夹取", () => {
    const screen = projectAnchorToScreen(
      { x: 4, y: -4, z: 0 },
      { width: 1280, height: 720 },
    );

    expect(screen.x).toBeLessThan(1280);
    expect(screen.x).toBeGreaterThanOrEqual(24);
    expect(screen.y).toBeLessThan(720);
    expect(screen.y).toBeGreaterThanOrEqual(24);
  });

  test("覆盖层位置会直接锚定到当前投影点", () => {
    const next = stabilizeOverlayState(
      {
        visible: true,
        x: 100,
        y: 200,
        visibleFrames: 3,
        hiddenFrames: 0,
      },
      {
        visible: true,
        x: 140,
        y: 240,
      },
    );

    expect(next.visible).toBe(true);
    expect(next.x).toBe(140);
    expect(next.y).toBe(240);
  });

  test("覆盖层会通过滞回避免一帧闪隐", () => {
    const next = stabilizeOverlayState(
      {
        visible: true,
        x: 100,
        y: 200,
        visibleFrames: 2,
        hiddenFrames: 0,
      },
      {
        visible: false,
        x: 110,
        y: 210,
      },
    );

    expect(next.visible).toBe(true);
    expect(next.hiddenFrames).toBe(1);
  });

  test("只要有可见位置变化就会提交 DOM", () => {
    expect(
      shouldCommitOverlayState(
        { visible: true, x: 100, y: 200 },
        { visible: true, x: 100, y: 200 },
      ),
    ).toBe(false);

    expect(
      shouldCommitOverlayState(
        { visible: true, x: 100, y: 200 },
        { visible: true, x: 100.05, y: 200 },
      ),
    ).toBe(true);
  });

  test("隐藏状态会被转换成离屏 transform", () => {
    expect(resolveOverlayTransform({ visible: false, x: 0, y: 0 })).toContain(
      "-9999px",
    );
  });
});
