import { describe, expect, test } from "vitest";

import { DEFAULT_ROOM_ID } from "@chat/protocol";

import { resolveRoomId } from "./roomPolicy";

describe("roomPolicy", () => {
  test("默认房间保持不变", () => {
    expect(resolveRoomId(DEFAULT_ROOM_ID)).toBe(DEFAULT_ROOM_ID);
  });

  test("非默认房间会被归一化到默认房间", () => {
    expect(resolveRoomId("another-room")).toBe(DEFAULT_ROOM_ID);
  });
});
