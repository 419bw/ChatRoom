import { ROOM_LAYOUT_CONFIG } from "@chat/protocol";
import { describe, expect, test } from "vitest";

import {
  createWorldActorStates,
  networkPointToWorld,
  obstacleToWorld,
  resolveHeadingFromPositions,
  worldToNetworkPoint,
} from "./worldMapping";

describe("worldMapping", () => {
  test("网络坐标与世界坐标可以互相映射", () => {
    const world = networkPointToWorld({ x: 640, y: 395 });
    expect(worldToNetworkPoint({ x: world[0], z: world[2] })).toEqual({
      x: 640,
      y: 395,
    });
  });

  test("家具阻挡盒会映射成世界尺寸", () => {
    const worldObstacle = obstacleToWorld(ROOM_LAYOUT_CONFIG.obstacles[0]);
    expect(worldObstacle.size[0]).toBeGreaterThan(0);
    expect(worldObstacle.size[2]).toBeGreaterThan(0);
  });

  test("朝向会根据移动方向计算", () => {
    const heading = resolveHeadingFromPositions([0, 0, 0], [1, 0, 1]);
    expect(heading).not.toBe(0);
  });

  test("WorldActorState 会标记本地用户并保留世界坐标", () => {
    const previous = new Map<string, [number, number, number]>();
    const actors = createWorldActorStates(
      [
        {
          userId: "user-1",
          nickname: "阿青",
          avatar: { cosmetic: "mint" },
          position: { x: 640, y: 395 },
          joinedAt: 1000,
          lastActiveAt: 1000,
        },
      ],
      "user-1",
      previous,
    );

    expect(actors[0]?.isLocal).toBe(true);
    expect(Array.isArray(actors[0]?.worldPosition)).toBe(true);
  });
});
