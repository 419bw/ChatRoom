import {
  ROOM_LAYOUT_CONFIG,
  ROOM_NETWORK_CENTER,
  ROOM_WORLD_FLOOR_Y,
  type Point,
  type RoomObstacle,
  type UserPresenceState,
  type WorldActorState,
} from "@chat/protocol";

const rad = (degrees: number) => (degrees * Math.PI) / 180;

export const networkPointToWorld = (point: Point): [number, number, number] => [
  (point.x - ROOM_NETWORK_CENTER.x) * ROOM_LAYOUT_CONFIG.worldScale,
  ROOM_WORLD_FLOOR_Y,
  (point.y - ROOM_NETWORK_CENTER.y) * ROOM_LAYOUT_CONFIG.worldScale,
];

export const worldToNetworkPoint = (worldPoint: { x: number; z: number }): Point => ({
  x: worldPoint.x / ROOM_LAYOUT_CONFIG.worldScale + ROOM_NETWORK_CENTER.x,
  y: worldPoint.z / ROOM_LAYOUT_CONFIG.worldScale + ROOM_NETWORK_CENTER.y,
});

export const obstacleToWorld = (obstacle: RoomObstacle) => ({
  center: networkPointToWorld(obstacle.center),
  size: [
    obstacle.halfSize.x * 2 * ROOM_LAYOUT_CONFIG.worldScale,
    obstacle.worldHeight,
    obstacle.halfSize.y * 2 * ROOM_LAYOUT_CONFIG.worldScale,
  ] as const,
});

export const resolveHeadingFromPositions = (
  previous: [number, number, number],
  next: [number, number, number],
  fallback = rad(180),
) => {
  const deltaX = next[0] - previous[0];
  const deltaZ = next[2] - previous[2];
  if (Math.abs(deltaX) < 0.001 && Math.abs(deltaZ) < 0.001) {
    return fallback;
  }

  return Math.atan2(deltaX, deltaZ);
};

export const createWorldActorStates = (
  users: UserPresenceState[],
  selfUserId: string | null,
  previousMap: Map<string, [number, number, number]>,
): WorldActorState[] =>
  users.map((user) => {
    const worldPosition = networkPointToWorld(user.position);
    const previousPosition = previousMap.get(user.userId) ?? worldPosition;
    const heading = resolveHeadingFromPositions(previousPosition, worldPosition);
    previousMap.set(user.userId, worldPosition);

    return {
      userId: user.userId,
      nickname: user.nickname,
      avatar: user.avatar,
      worldPosition,
      heading,
      isLocal: user.userId === selfUserId,
    };
  });
