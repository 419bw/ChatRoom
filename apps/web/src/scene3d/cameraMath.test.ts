import { Vector3 } from "three";
import { describe, expect, test } from "vitest";

import {
  clampCameraPitch,
  clampReticleOffset,
  resolveCameraForwardVector,
  resolveCameraRelativeMoveDirection,
  resolveLocalAvatarOpacity,
  resolveNextCameraPitch,
  resolveNextCameraYaw,
  resolveNextReticleOffset,
  resolveSmoothedSpringArmDistance,
  resolveSpringArmDistance,
  resolveThirdPersonAimTarget,
  resolveThirdPersonCameraPosition,
  resolveThirdPersonFocusTarget,
} from "./cameraMath";

describe("cameraMath", () => {
  test("pitch 会被限制在轻微上下摆动范围内", () => {
    expect(clampCameraPitch(1)).toBeLessThanOrEqual(0.34);
    expect(clampCameraPitch(-1)).toBeGreaterThanOrEqual(-0.08);
  });

  test("第三人称右肩镜头会稳定落在角色后上方且明显偏右", () => {
    const focusTarget = resolveThirdPersonFocusTarget(new Vector3(0, 0, 0), 1.35);
    const cameraPosition = resolveThirdPersonCameraPosition({
      focusTarget,
      yaw: Math.PI,
      pitch: 0.2,
      distance: 3.3,
    });

    expect(cameraPosition.y).toBeGreaterThan(focusTarget.y);
    expect(cameraPosition.z).toBeLessThan(focusTarget.z);
    expect(Math.abs(cameraPosition.x - focusTarget.x)).toBeGreaterThan(0.6);
  });

  test("镜头朝向移动会把 WASD 转成世界方向", () => {
    const direction = resolveCameraRelativeMoveDirection({
      x: 0,
      y: -1,
      yaw: Math.PI / 2,
    });

    expect(direction.x).toBeCloseTo(1, 6);
    expect(direction.y).toBeCloseTo(0, 6);
  });

  test("鼠标上移会让镜头往上看", () => {
    const nextPitch = resolveNextCameraPitch(0.2, -20, 0.01);
    expect(nextPitch).toBeLessThan(0.2);
  });

  test("水平鼠标位移会更新 yaw", () => {
    const nextYaw = resolveNextCameraYaw(0, 40, 0.01);
    expect(nextYaw).toBeGreaterThan(0);
  });

  test("准星偏移会被夹在允许范围内", () => {
    expect(
      clampReticleOffset({
        x: 2,
        y: -2,
      }),
    ).toEqual({
      x: expect.closeTo(0.26, 6),
      y: expect.closeTo(-0.2, 6),
    });

    expect(
      resolveNextReticleOffset(
        { x: 0.2, y: 0.18 },
        120,
        80,
      ),
    ).toEqual({
      x: expect.closeTo(0.26, 6),
      y: expect.closeTo(0.2, 6),
    });
  });

  test("forward 向量与 yaw 一致", () => {
    const forward = resolveCameraForwardVector(Math.PI);

    expect(forward.x).toBeCloseTo(0, 6);
    expect(forward.z).toBeCloseTo(1, 6);
  });

  test("准星偏移会推动瞄准目标，不再永远指向角色中心", () => {
    const focusTarget = resolveThirdPersonFocusTarget(new Vector3(0, 0, 0), 1.35);
    const centeredAimTarget = resolveThirdPersonAimTarget({
      focusTarget,
      yaw: Math.PI,
      pitch: 0.2,
    });
    const shiftedAimTarget = resolveThirdPersonAimTarget({
      focusTarget,
      yaw: Math.PI,
      pitch: 0.2,
      reticleOffset: {
        x: 0.2,
        y: -0.1,
      },
    });

    expect(Math.abs(shiftedAimTarget.x - centeredAimTarget.x)).toBeGreaterThan(0.5);
    expect(shiftedAimTarget.y).toBeGreaterThan(centeredAimTarget.y);
    expect(shiftedAimTarget.z).toBeCloseTo(centeredAimTarget.z, 6);
  });

  test("spring arm 遇到障碍会缩短镜头距离", () => {
    const focusTarget = new Vector3(0, 1.35, 0);
    const desiredCameraPosition = new Vector3(0, 2.1, 3.4);
    const clampedDistance = resolveSpringArmDistance({
      focusTarget,
      desiredCameraPosition,
      roomBounds: {
        min: new Vector3(-5, 0, -5),
        max: new Vector3(5, 4, 5),
      },
      obstacles: [
        {
          min: new Vector3(-0.4, 0.4, 1.2),
          max: new Vector3(0.4, 2.5, 2.2),
        },
      ],
    });

    expect(clampedDistance).toBeLessThan(focusTarget.distanceTo(desiredCameraPosition));
    expect(clampedDistance).toBeGreaterThan(1);
  });

  test("spring arm 碰撞时收缩更快、恢复更慢", () => {
    const shrink = resolveSmoothedSpringArmDistance({
      currentDistance: 3.1,
      targetDistance: 1.4,
      deltaSeconds: 1 / 60,
    });
    const expand = resolveSmoothedSpringArmDistance({
      currentDistance: 1.4,
      targetDistance: 3.1,
      deltaSeconds: 1 / 60,
    });

    expect(3.1 - shrink).toBeGreaterThan(expand - 1.4);
  });

  test("本地角色在镜头过近时会进入半透明", () => {
    expect(
      resolveLocalAvatarOpacity({
        cameraDistance: 1.05,
        isLookMode: true,
      }),
    ).toBeLessThan(0.3);
    expect(
      resolveLocalAvatarOpacity({
        cameraDistance: 2.6,
        isLookMode: true,
      }),
    ).toBe(1);
  });
});
