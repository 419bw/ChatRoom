import { describe, expect, test } from "vitest";

import { RoomStore } from "./roomStore";

describe("RoomStore", () => {
  test("收到快照后进入 joined 状态，初始化时间线并清空连接错误", () => {
    const now = Date.now();
    const store = new RoomStore();
    store.setConnectionErrorMessage("无法连接房间服务");
    store.applySnapshot({
      roomId: "cozy-lounge",
      roomTheme: "warm-lounge",
      bounds: {
        width: 1280,
        height: 720,
        minX: 180,
        maxX: 1100,
        minY: 180,
        maxY: 610,
      },
      selfUserId: "user-1",
      sessionToken: "session-1",
      users: [
        {
          userId: "user-1",
          nickname: "阿青",
          avatar: {
            cosmetic: "mint",
          },
          position: {
            x: 520,
            y: 420,
          },
          joinedAt: 1000,
          lastActiveAt: 1000,
        },
      ],
      recentMessages: [],
      recentTimeline: [
        {
          id: "entry-1",
          category: "presence_event",
          message: "阿青 加入了房间",
          createdAt: now - 1_000,
          actorId: "user-1",
          actorName: "阿青",
          meta: {
            action: "join",
          },
        },
      ],
    });

    expect(store.getState().connectionStatus).toBe("joined");
    expect(store.getState().selfUserId).toBe("user-1");
    expect(store.getState().connectionErrorMessage).toBeNull();
    expect(store.getState().timelineEntries).toHaveLength(1);
    expect(store.getState().recentActivityByUserId["user-1"]?.kind).toBe("joined");
  });

  test("实时动态会按 id 去重，并更新最近活动状态", () => {
    const now = Date.now();
    const store = new RoomStore();
    store.applySnapshot({
      roomId: "cozy-lounge",
      roomTheme: "warm-lounge",
      bounds: {
        width: 1280,
        height: 720,
        minX: 180,
        maxX: 1100,
        minY: 180,
        maxY: 610,
      },
      selfUserId: "user-1",
      sessionToken: "session-1",
      users: [
        {
          userId: "user-1",
          nickname: "阿青",
          avatar: {
            cosmetic: "mint",
          },
          position: {
            x: 520,
            y: 420,
          },
          joinedAt: 1000,
          lastActiveAt: 1000,
        },
      ],
      recentMessages: [],
      recentTimeline: [],
    });

    store.addTimelineEntry({
      id: "entry-2",
      category: "chat_message",
      message: "阿青 发送了一条消息：你好",
      createdAt: now,
      actorId: "user-1",
      actorName: "阿青",
      meta: {
        preview: "你好",
      },
    });
    store.addTimelineEntry({
      id: "entry-2",
      category: "chat_message",
      message: "阿青 发送了一条消息：你好",
      createdAt: now,
      actorId: "user-1",
      actorName: "阿青",
      meta: {
        preview: "你好",
      },
    });

    expect(store.getState().timelineEntries).toHaveLength(1);
    expect(store.getState().recentActivityByUserId["user-1"]?.kind).toBe("spoke");
  });

  test("最近活动会按窗口过期清理", () => {
    const now = Date.now();
    const store = new RoomStore();
    store.applySnapshot({
      roomId: "cozy-lounge",
      roomTheme: "warm-lounge",
      bounds: {
        width: 1280,
        height: 720,
        minX: 180,
        maxX: 1100,
        minY: 180,
        maxY: 610,
      },
      selfUserId: "user-1",
      sessionToken: "session-1",
      users: [
        {
          userId: "user-1",
          nickname: "阿青",
          avatar: {
            cosmetic: "mint",
          },
          position: {
            x: 520,
            y: 420,
          },
          joinedAt: 1000,
          lastActiveAt: 1000,
        },
      ],
      recentMessages: [],
      recentTimeline: [
        {
          id: "entry-3",
          category: "avatar_event",
          message: "阿青 切换了角色外观",
          createdAt: now - 1_000,
          actorId: "user-1",
          actorName: "阿青",
          meta: {
            cosmetic: "rose",
          },
        },
      ],
    });

    store.pruneExpiredRecentActivity(now + 6_100);

    expect(store.getState().recentActivityByUserId).toEqual({});
  });

  test("断线后会清空房间级活动状态但保留 sessionToken 和错误文案", () => {
    const now = Date.now();
    const store = new RoomStore();
    store.applySnapshot({
      roomId: "cozy-lounge",
      roomTheme: "warm-lounge",
      bounds: {
        width: 1280,
        height: 720,
        minX: 180,
        maxX: 1100,
        minY: 180,
        maxY: 610,
      },
      selfUserId: "user-1",
      sessionToken: "session-keep",
      users: [
        {
          userId: "user-1",
          nickname: "阿青",
          avatar: {
            cosmetic: "mint",
          },
          position: {
            x: 520,
            y: 420,
          },
          joinedAt: 1000,
          lastActiveAt: 1000,
        },
      ],
      recentMessages: [
        {
          id: "msg-1",
          userId: "user-1",
          nickname: "阿青",
          avatar: {
            cosmetic: "mint",
          },
          text: "你好",
          sentAt: 1200,
        },
      ],
      recentTimeline: [
        {
          id: "entry-4",
          category: "presence_event",
          message: "阿青 加入了房间",
          createdAt: now - 1_000,
          actorId: "user-1",
          actorName: "阿青",
          meta: {
            action: "join",
          },
        },
      ],
    });
    store.setConnectionErrorMessage("连接已断开，请重新进入房间。");

    store.clearActiveRoom("disconnected");

    const state = store.getState();
    expect(state.connectionStatus).toBe("disconnected");
    expect(state.selfUserId).toBeNull();
    expect(state.roomId).toBeNull();
    expect(state.messages).toHaveLength(0);
    expect(state.timelineEntries).toHaveLength(0);
    expect(state.sessionToken).toBe("session-keep");
    expect(state.connectionErrorMessage).toContain("重新进入");
  });
});
