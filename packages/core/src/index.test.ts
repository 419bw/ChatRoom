import { MOVE_KEYBOARD_STEP, ROOM_LAYOUT_CONFIG } from "@chat/protocol";
import { describe, expect, test } from "vitest";

import { createRoom } from "./index";

describe("room service", () => {
  test("加入房间后返回快照和时间线", () => {
    const room = createRoom();
    const join = room.joinUser({
      socketId: "socket-a",
      payload: {
        roomId: "cozy-lounge",
        nickname: "阿青",
        avatar: "mint",
      },
      now: 1000,
    });

    expect(join.snapshot.users).toHaveLength(1);
    expect(join.timelineEntry.category).toBe("presence_event");
    expect(join.timelineEntry.message).toContain("加入了房间");
  });

  test("断线后短时重连复用同一身份", () => {
    const room = createRoom();
    const firstJoin = room.joinUser({
      socketId: "socket-a",
      payload: {
        roomId: "cozy-lounge",
        nickname: "小林",
        avatar: "sky",
      },
      now: 1000,
    });

    room.leaveUser("socket-a", 1500);

    const secondJoin = room.joinUser({
      socketId: "socket-b",
      payload: {
        roomId: "cozy-lounge",
        nickname: "小林",
        avatar: "rose",
        sessionToken: firstJoin.snapshot.sessionToken,
      },
      now: 2000,
    });

    expect(secondJoin.user.userId).toBe(firstJoin.user.userId);
    expect(secondJoin.restored).toBe(true);
    expect(secondJoin.timelineEntry.message).toContain("重新回到了房间");
  });

  test("聊天与换装会生成时间线，移动不会刷时间线", () => {
    const room = createRoom();
    const join = room.joinUser({
      socketId: "socket-a",
      payload: {
        roomId: "cozy-lounge",
        nickname: "小雨",
        avatar: "apricot",
      },
      now: 1000,
    });

    room.applyMoveIntent(join.user.userId, {
      target: { x: 640, y: 480 },
    });
    const chat = room.postChat(join.user.userId, "你好呀", 1200);
    const avatar = room.updateAvatar(join.user.userId, "sunflower", 1300);

    expect(chat?.timelineEntry.category).toBe("chat_message");
    expect(avatar?.timelineEntry.category).toBe("avatar_event");
    expect(room.getRecentTimeline()).toHaveLength(3);
  });

  test("服务端移动不会穿过家具阻挡盒", () => {
    const room = createRoom();
    const join = room.joinUser({
      socketId: "socket-a",
      payload: {
        roomId: "cozy-lounge",
        nickname: "tester_3d",
        avatar: "mint",
      },
      now: 1000,
    });

    const sofa = ROOM_LAYOUT_CONFIG.obstacles.find((obstacle) => obstacle.id === "sofa-back");
    expect(sofa).toBeTruthy();

    const moved = room.applyMoveIntent(join.user.userId, {
      target: {
        x: sofa!.center.x,
        y: sofa!.center.y,
      },
    });

    expect(moved).toBeTruthy();
    const insideX =
      moved!.position.x > sofa!.center.x - sofa!.halfSize.x &&
      moved!.position.x < sofa!.center.x + sofa!.halfSize.x;
    const insideY =
      moved!.position.y > sofa!.center.y - sofa!.halfSize.y &&
      moved!.position.y < sofa!.center.y + sofa!.halfSize.y;

    expect(insideX && insideY).toBe(false);
  });

  test("服务端键盘移动步长与共享常量保持一致", () => {
    const room = createRoom();
    const join = room.joinUser({
      socketId: "socket-a",
      payload: {
        roomId: "cozy-lounge",
        nickname: "step_tester",
        avatar: "mint",
      },
      now: 1000,
    });

    const moved = room.applyMoveIntent(join.user.userId, {
      direction: {
        x: 1,
        y: 0,
      },
    });

    expect(moved?.position.x).toBe(join.user.position.x + MOVE_KEYBOARD_STEP);
    expect(moved?.position.y).toBe(join.user.position.y);
  });
});
