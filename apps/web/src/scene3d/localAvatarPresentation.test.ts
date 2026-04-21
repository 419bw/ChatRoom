import { MOVE_KEYBOARD_STEP } from "@chat/protocol";
import { describe, expect, test } from "vitest";

import {
  applyMoveIntentToPresentation,
  createLocalAvatarPresentationState,
  predictNextPoint,
  reconcileLocalAvatarPresentation,
  reconcilePredictedWorldPosition,
  resolveHeadingWithThreshold,
  resolveStableHeadingTarget,
} from "./localAvatarPresentation";

describe("localAvatarPresentation", () => {
  test("本地预测会沿键盘方向推进一步", () => {
    const next = predictNextPoint(
      { x: 640, y: 520 },
      {
        direction: {
          x: 1,
          y: 0,
        },
      },
    );

    expect(next.x).toBe(640 + MOVE_KEYBOARD_STEP);
    expect(next.y).toBe(520);
  });

  test("键盘意图只推进目标位置而不直接跳显示坐标", () => {
    const initial = createLocalAvatarPresentationState({
      userId: "user-1",
      nickname: "测试用户",
      avatar: {
        cosmetic: "mint",
      },
      position: { x: 640, y: 520 },
      joinedAt: 1,
      lastActiveAt: 1,
    });

    const next = applyMoveIntentToPresentation(initial, {
      direction: {
        x: 1,
        y: 0,
      },
    });

    expect(next.targetPosition.x).toBe(640 + MOVE_KEYBOARD_STEP);
    expect(next.displayPosition).toEqual(initial.displayPosition);
    expect(next.targetWorldPosition).not.toEqual(initial.targetWorldPosition);
  });

  test("小误差会平滑回收而不是硬跳", () => {
    const next = reconcilePredictedWorldPosition(
      [0, 0, 0],
      [0.2, 0, 0.2],
    );

    expect(next[0]).toBeGreaterThan(0);
    expect(next[0]).toBeLessThan(0.2);
  });

  test("权威位置回收会保留平滑展示基线", () => {
    const initial = createLocalAvatarPresentationState({
      userId: "user-1",
      nickname: "测试用户",
      avatar: {
        cosmetic: "mint",
      },
      position: { x: 640, y: 520 },
      joinedAt: 1,
      lastActiveAt: 1,
    });
    const moved = applyMoveIntentToPresentation(initial, {
      direction: {
        x: 1,
        y: 0,
      },
    });

    const reconciled = reconcileLocalAvatarPresentation(moved, {
      x: 640 + MOVE_KEYBOARD_STEP - 3,
      y: 520,
    });

    expect(reconciled.displayPosition[0]).toBeGreaterThan(initial.displayPosition[0]);
    expect(reconciled.displayPosition[0]).toBeLessThan(reconciled.targetWorldPosition[0]);
  });

  test("大误差会直接使用权威坐标", () => {
    const next = reconcilePredictedWorldPosition(
      [0, 0, 0],
      [1, 0, 1],
    );

    expect(next).toEqual([1, 0, 1]);
  });

  test("极小位移不会强制改变朝向", () => {
    const heading = resolveHeadingWithThreshold(
      [0, 0, 0],
      [0.01, 0, 0.01],
      Math.PI,
    );

    expect(heading).toBe(Math.PI);
  });

  test("连续方向切换时目标朝向不会一帧乱跳", () => {
    const stepped = resolveStableHeadingTarget(0, Math.PI);

    expect(stepped).toBeCloseTo(Math.PI / 3);
    expect(Math.abs(stepped)).toBeLessThan(Math.PI);
  });
});
