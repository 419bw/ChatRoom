import { ROOM_THEME } from "@chat/protocol";
import { describe, expect, test } from "vitest";

import {
  resolveAvatarAsset,
  resolveRoomEnvironmentAsset,
  roomAssetManifest,
} from "./assetManifest";

describe("assetManifest", () => {
  test("角色资源配置会补齐缩放后的默认高度参数", () => {
    const avatarAsset = resolveAvatarAsset(ROOM_THEME);

    expect(avatarAsset.modelUrl).toContain("avatar-formal.glb");
    expect(avatarAsset.scale).toBeCloseTo(0.92, 6);
    expect(avatarAsset.labelHeight).toBeCloseTo(2.024, 6);
    expect(avatarAsset.bubbleHeight).toBeCloseTo(2.254, 6);
    expect(avatarAsset.focusHeight).toBeCloseTo(1.3984, 6);
    expect(avatarAsset.shadowRadius).toBeCloseTo(0.6624, 6);
    expect(avatarAsset.bubbleHeight).toBeGreaterThan(avatarAsset.labelHeight);
    expect(avatarAsset.idleClip).toBe("Idle");
    expect(avatarAsset.walkClip).toBe("Walk");
  });

  test("房间资源 manifest 同时暴露桌面/移动模型与环境贴图", () => {
    const assetEntry = roomAssetManifest[ROOM_THEME];
    const desktopRoomAsset = resolveRoomEnvironmentAsset(ROOM_THEME, "desktop");
    const mobileRoomAsset = resolveRoomEnvironmentAsset(ROOM_THEME, "mobile");

    expect(assetEntry.room.desktopModelUrl).toContain("warm-lounge-room.desktop.glb");
    expect(assetEntry.room.mobileModelUrl).toContain("warm-lounge-room.mobile.glb");
    expect(assetEntry.environment.environmentMapUrl).toContain("warm-lounge-sunset.svg");
    expect(desktopRoomAsset.modelUrl).toContain("warm-lounge-room.desktop.glb");
    expect(mobileRoomAsset.modelUrl).toContain("warm-lounge-room.mobile.glb");
    expect(assetEntry.avatar.scale).toBeCloseTo(0.92, 6);
    expect(assetEntry.avatar.shadowRadius).toBeCloseTo(0.6624, 6);
  });
});
