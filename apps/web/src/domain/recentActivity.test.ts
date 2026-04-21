import type { TimelineEntry } from "@chat/protocol";
import { describe, expect, test } from "vitest";

import {
  compareUsersByRecentActivity,
  deriveRecentActivityByUserId,
  getRecentActivityLabel,
  getTimelineSummary,
  mergeTimelineEntries,
  pruneExpiredRecentActivityByUserId,
} from "./recentActivity";

const createUser = (
  userId: string,
  y: number,
) => ({
  userId,
  nickname: userId,
  avatar: {
    cosmetic: "mint" as const,
  },
  position: {
    x: 640,
    y,
  },
  joinedAt: 1_000,
  lastActiveAt: 2_000,
});

describe("recentActivity", () => {
  test("时间线合并时会按 id 去重并保留最新上限", () => {
    const merged = mergeTimelineEntries(
      [
        {
          id: "entry-1",
          category: "presence_event",
          message: "u1 加入了房间",
          createdAt: 1_000,
          actorId: "u1",
          actorName: "u1",
          meta: {
            action: "join",
          },
        },
      ],
      [
        {
          id: "entry-1",
          category: "presence_event",
          message: "u1 加入了房间",
          createdAt: 1_000,
          actorId: "u1",
          actorName: "u1",
          meta: {
            action: "join",
          },
        },
        {
          id: "entry-2",
          category: "chat_message",
          message: "u1 发送了一条消息：hello",
          createdAt: 2_000,
          actorId: "u1",
          actorName: "u1",
          meta: {
            preview: "hello",
          },
        },
      ],
    );

    expect(merged.map((entry) => entry.id)).toEqual(["entry-1", "entry-2"]);
  });

  test("会从时间线中导出最近活动并支持过期清理", () => {
    const entries: TimelineEntry[] = [
      {
        id: "entry-1",
        category: "presence_event",
        message: "u1 加入了房间",
        createdAt: 1_000,
        actorId: "u1",
        actorName: "u1",
        meta: {
          action: "join",
        },
      },
      {
        id: "entry-2",
        category: "chat_message",
        message: "u2 发送了一条消息：hi",
        createdAt: 2_000,
        actorId: "u2",
        actorName: "u2",
        meta: {
          preview: "hi",
        },
      },
    ];

    const activities = deriveRecentActivityByUserId(entries, 4_000);
    expect(getRecentActivityLabel(activities.u1)).toBe("刚加入");
    expect(getRecentActivityLabel(activities.u2)).toBe("刚发言");

    expect(pruneExpiredRecentActivityByUserId(activities, 12_100)).toEqual({});
  });

  test("成员排序会优先最近活动用户，再按位置排序", () => {
    const activities = {
      "user-2": {
        kind: "spoke" as const,
        updatedAt: 3_000,
        expiresAt: 10_000,
        sourceEntryId: "entry-2",
      },
    };
    const users = [
      createUser("user-1", 420),
      createUser("user-2", 600),
      createUser("user-3", 380),
    ];

    const sortedUsers = users.slice().sort((left, right) =>
      compareUsersByRecentActivity(left, right, activities),
    );

    expect(sortedUsers.map((user) => user.userId)).toEqual([
      "user-2",
      "user-3",
      "user-1",
    ]);
  });

  test("聊天动态会优先显示预览文案", () => {
    expect(
      getTimelineSummary({
        id: "entry-2",
        category: "chat_message",
        message: "u2 发送了一条消息：hi",
        createdAt: 2_000,
        actorId: "u2",
        actorName: "u2",
        meta: {
          preview: "hi",
        },
      }),
    ).toContain("hi");
  });
});
