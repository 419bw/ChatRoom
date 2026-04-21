import { describe, expect, test } from "vitest";

import {
  TURN_SLOWDOWN_MIN_FACTOR,
  WALK_HOLD_DURATION_SECONDS,
  getShortestAngleDelta,
  resolveLocomotionDiagnostics,
  resolveTurnSlowdownFactor,
  resolveWalkAnimationTimeScale,
  resolveWalkingState,
  stepHeadingTowardsTarget,
} from "./avatarLocomotion";

describe("avatarLocomotion", () => {
  test("明显位移或速度会进入 walking", () => {
    expect(
      resolveWalkingState({
        isWalking: false,
        distanceToTarget: 0.04,
        moveSpeed: 0,
        timeSinceLastMotion: 1,
      }),
    ).toBe(true);

    expect(
      resolveWalkingState({
        isWalking: false,
        distanceToTarget: 0,
        moveSpeed: 0.2,
        timeSinceLastMotion: 1,
      }),
    ).toBe(true);
  });

  test("短时速度掉零时仍保持 walking", () => {
    expect(
      resolveWalkingState({
        isWalking: true,
        distanceToTarget: 0.008,
        moveSpeed: 0.01,
        timeSinceLastMotion: WALK_HOLD_DURATION_SECONDS / 2,
      }),
    ).toBe(true);
  });

  test("超过保持窗口后才回到 idle", () => {
    expect(
      resolveWalkingState({
        isWalking: true,
        distanceToTarget: 0.008,
        moveSpeed: 0.01,
        timeSinceLastMotion: WALK_HOLD_DURATION_SECONDS + 0.05,
      }),
    ).toBe(false);
  });

  test("walk 动画速率会被限制在安全范围内", () => {
    expect(resolveWalkAnimationTimeScale(0.01)).toBeGreaterThanOrEqual(0.95);
    expect(resolveWalkAnimationTimeScale(20)).toBeLessThanOrEqual(1.45);
  });

  test("目标朝向跨越 -pi/pi 时会沿最短路径转向", () => {
    const delta = getShortestAngleDelta(Math.PI - 0.1, -Math.PI + 0.1);
    const next = stepHeadingTowardsTarget(Math.PI - 0.1, -Math.PI + 0.1, 0.016, 8);

    expect(Math.abs(delta)).toBeLessThan(0.25);
    expect(next).toBeLessThanOrEqual(Math.PI);
  });

  test("大角度转向时会降低位移追赶系数", () => {
    const mild = resolveTurnSlowdownFactor(0.05);
    const hard = resolveTurnSlowdownFactor(Math.PI / 2);

    expect(mild).toBe(1);
    expect(hard).toBe(TURN_SLOWDOWN_MIN_FACTOR);
  });

  test("诊断信息会输出可采样的 heading error 和 gait phase", () => {
    const diagnostics = resolveLocomotionDiagnostics({
      currentHeading: 0,
      targetHeading: Math.PI / 2,
      gaitTimeSeconds: 1.25,
      gaitDurationSeconds: 1,
      moveSpeed: 1.6,
    });

    expect(diagnostics.headingError).toBeCloseTo(Math.PI / 2);
    expect(diagnostics.gaitPhase).toBeCloseTo(0.25);
    expect(diagnostics.moveSpeed).toBeCloseTo(1.6);
  });
});
