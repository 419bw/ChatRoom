import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { ChatComposerHandle } from "../ui/ChatComposer";
import {
  focusViewportRoot,
  focusViewportImeSink,
  focusViewportSink,
  releaseViewportChatTextarea,
  scheduleDeferredPointerLockRequest,
  scheduleViewportInputHandoff,
} from "./RoomViewport3D";
import {
  applyLookDeltaToCamera,
  normalizeLookInputDelta,
  resolveSmoothedLookCameraState,
  resolveSmoothedReticleOffset,
  shouldHandlePointerLockedLookInput,
} from "./viewportLookControls";

const originalConsoleWarn = console.warn.bind(console);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("RoomViewport3D interactions", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation((message?: unknown, ...rest: unknown[]) => {
      if (
        typeof message === "string" &&
        message.includes("Multiple instances of Three.js being imported")
      ) {
        return;
      }

      originalConsoleWarn(message, ...rest);
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  test("鼠标位移只会先更新目标态，不会立刻改写显示态", () => {
    const nextState = applyLookDeltaToCamera({
      cameraState: {
        targetYaw: 0,
        targetPitch: 0.2,
        displayYaw: 0,
        displayPitch: 0.2,
        distance: 3.3,
      },
      reticleOffset: {
        x: 0,
        y: 0,
      },
      deltaX: 24,
      deltaY: -18,
    });

    expect(nextState.cameraState.targetYaw).toBeGreaterThan(0);
    expect(nextState.cameraState.targetPitch).toBeLessThan(0.2);
    expect(nextState.cameraState.displayYaw).toBe(0);
    expect(nextState.cameraState.displayPitch).toBe(0.2);
    expect(nextState.reticleOffset.x).toBeGreaterThan(0);
    expect(nextState.reticleOffset.y).toBeLessThan(0);
  });

  test("输入限幅会压住异常大的原始鼠标位移，避免首帧突跳", () => {
    expect(Math.abs(normalizeLookInputDelta(240))).toBeLessThan(40);
    expect(Math.abs(normalizeLookInputDelta(240))).toBeGreaterThan(0);
    expect(normalizeLookInputDelta(0.1)).toBe(0);
  });

  test("显示态会按更快的阻尼平滑追赶目标态", () => {
    const nextState = resolveSmoothedLookCameraState({
      cameraState: {
        targetYaw: 0.4,
        targetPitch: 0.08,
        displayYaw: 0,
        displayPitch: 0.2,
        distance: 3.3,
      },
      deltaSeconds: 1 / 60,
    });

    expect(nextState.displayYaw).toBeGreaterThan(0);
    expect(nextState.displayYaw).toBeLessThan(0.4);
    expect(nextState.displayPitch).toBeLessThan(0.2);
    expect(nextState.displayPitch).toBeGreaterThan(0.08);
  });

  test("聊天打开时准星只会平滑回中，不会瞬间归零", () => {
    const nextReticle = resolveSmoothedReticleOffset({
      displayOffset: {
        x: 0.18,
        y: -0.12,
      },
      targetOffset: {
        x: 0,
        y: 0,
      },
      deltaSeconds: 1 / 60,
      damping: 17,
    });

    expect(nextReticle.x).toBeGreaterThan(0);
    expect(nextReticle.x).toBeLessThan(0.18);
    expect(nextReticle.y).toBeLessThan(0);
    expect(nextReticle.y).toBeGreaterThan(-0.12);
  });

  test("发送成功时会先 blurAndReset，再走 IME sink -> focus sink -> setTimeout -> rAF", () => {
    vi.useFakeTimers();
    let scheduledFrame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      scheduledFrame = callback;
      return 7;
    });

    const composerHandle: ChatComposerHandle = {
      focusToEnd: vi.fn(() => true),
      blurAndReset: vi.fn(() => true),
      getElement: vi.fn(() => null),
    };
    const imeSink = document.createElement("input");
    const focusSink = document.createElement("button");
    const imeFocusSpy = vi.spyOn(imeSink, "focus");
    const imeBlurSpy = vi.spyOn(imeSink, "blur");
    const focusSinkSpy = vi.spyOn(focusSink, "focus");
    const pointerLockRequest = vi.fn();

    expect(releaseViewportChatTextarea(composerHandle)).toBe(true);
    expect(composerHandle.blurAndReset).toHaveBeenCalledTimes(1);
    expect(focusViewportImeSink(imeSink)).toBe(true);
    expect(imeFocusSpy).toHaveBeenCalledTimes(1);

    const timeoutHandle = scheduleViewportInputHandoff({
      imeSink,
      focusSink,
      onAfterRelease: () => {
        scheduleDeferredPointerLockRequest(pointerLockRequest);
      },
    });

    expect(timeoutHandle).not.toBeNull();
    expect(pointerLockRequest).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();
    expect(imeBlurSpy).toHaveBeenCalledTimes(1);
    expect(focusViewportSink(focusSink)).toBe(true);
    expect(focusSinkSpy).toHaveBeenCalled();
    expect(pointerLockRequest).not.toHaveBeenCalled();
    expect(scheduledFrame).toBeTypeOf("function");

    (scheduledFrame as FrameRequestCallback)(0);
    expect(pointerLockRequest).toHaveBeenCalledTimes(1);
  });

  test("回到视角时会把焦点交还给 viewport，而不是停在隐藏 focus sink 上", () => {
    const viewport = document.createElement("div");
    viewport.tabIndex = -1;
    const focusSink = document.createElement("button");
    document.body.appendChild(viewport);
    document.body.appendChild(focusSink);

    focusSink.focus();
    expect(document.activeElement).toBe(focusSink);
    expect(focusViewportRoot(viewport)).toBe(true);
    expect(document.activeElement).toBe(viewport);

    viewport.remove();
    focusSink.remove();
  });

  test("未锁鼠时不会继续允许自由转镜头", () => {
    const viewportNode = document.createElement("div");

    expect(
      shouldHandlePointerLockedLookInput({
        viewportNode,
        sceneControlMode: "look",
        pointerLockElement: null,
        viewportChatOpen: false,
      }),
    ).toBe(false);

    expect(
      shouldHandlePointerLockedLookInput({
        viewportNode,
        sceneControlMode: "ui",
        pointerLockElement: viewportNode,
        viewportChatOpen: false,
      }),
    ).toBe(false);

    expect(
      shouldHandlePointerLockedLookInput({
        viewportNode,
        sceneControlMode: "look",
        pointerLockElement: viewportNode,
        viewportChatOpen: false,
      }),
    ).toBe(true);
  });
});
