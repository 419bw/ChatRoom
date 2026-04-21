import { describe, expect, test } from "vitest";

import {
  MOVE_KEYBOARD_INTERVAL_MS,
  MOVE_KEYBOARD_STEP,
  ROOM_LAYOUT_CONFIG,
  joinRoomPayloadSchema,
  moveIntentPayloadSchema,
  resolveRoomCollisionPoint,
  sendChatPayloadSchema,
} from "./index";

describe("protocol schema", () => {
  test("允许合法昵称和外观进入房间", () => {
    const result = joinRoomPayloadSchema.safeParse({
      roomId: "cozy-lounge",
      nickname: "测试玩家_1",
      avatar: "mint",
    });

    expect(result.success).toBe(true);
  });

  test("拒绝非法昵称", () => {
    const result = joinRoomPayloadSchema.safeParse({
      roomId: "cozy-lounge",
      nickname: "测试 玩家",
      avatar: "mint",
    });

    expect(result.success).toBe(false);
  });

  test("拒绝空移动指令", () => {
    const result = moveIntentPayloadSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test("拒绝超长消息", () => {
    const result = sendChatPayloadSchema.safeParse({
      text: "a".repeat(121),
    });

    expect(result.success).toBe(false);
  });

  test("共享碰撞解算器会把点推出障碍物", () => {
    const obstacle = ROOM_LAYOUT_CONFIG.obstacles[0];
    const result = resolveRoomCollisionPoint({
      x: obstacle.center.x,
      y: obstacle.center.y,
    });

    expect(result).not.toEqual({
      x: obstacle.center.x,
      y: obstacle.center.y,
    });
  });

  test("质量档位暴露三层预设与阴影/后处理配置", () => {
    expect(MOVE_KEYBOARD_STEP).toBe(14);
    expect(MOVE_KEYBOARD_INTERVAL_MS).toBe(40);
    expect(ROOM_LAYOUT_CONFIG.quality.mobile.bubbleMaxDistance).toBe(13);
    expect(ROOM_LAYOUT_CONFIG.quality.mobile.shadowMode).toBe("blob");
    expect(ROOM_LAYOUT_CONFIG.quality.mobile.roomVariant).toBe("mobile");
    expect(ROOM_LAYOUT_CONFIG.quality.desktop.postprocessing.antialiasPass).toBe("fxaa");
    expect(ROOM_LAYOUT_CONFIG.quality.desktop.shadowMapSize).toBe(1536);
    expect(ROOM_LAYOUT_CONFIG.quality.desktopHigh.shadowMapSize).toBe(2048);
    expect(ROOM_LAYOUT_CONFIG.quality.desktopHigh.dynamicResolution.enabled).toBe(true);
    expect(ROOM_LAYOUT_CONFIG.quality.desktopHigh.bubbleMaxDistance).toBe(18);
  });
});
