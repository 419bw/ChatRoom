export type RoomHotspotId = "window-side" | "sofa-corner" | "coffee-table";

export type RoomHotspot = {
  id: RoomHotspotId;
  label: string;
  worldCenter: [number, number, number];
  triggerRadius: number;
  exitRadius: number;
  hintText: string;
  detailText: string;
};

export type HotspotPresenceState = {
  nearbyHotspotId: RoomHotspotId | null;
};

export type HotspotSelectionState = {
  selectedHotspotId: RoomHotspotId | null;
};

export const ROOM_HOTSPOTS: RoomHotspot[] = [
  {
    id: "window-side",
    label: "窗边",
    worldCenter: [2.65, 0, -4.7],
    triggerRadius: 1.28,
    exitRadius: 1.68,
    hintText: "晚霞正落在窗边，靠近看看。",
    detailText: "暖橙色沿着窗框慢慢滑进来，很适合在这里安静放空一会儿。",
  },
  {
    id: "sofa-corner",
    label: "沙发角",
    worldCenter: [-2.1, 0, -2.45],
    triggerRadius: 1.2,
    exitRadius: 1.58,
    hintText: "沙发角留着一小块安静，靠近看看。",
    detailText: "这里像把房间里的声音轻轻压低，只剩下柔软的余温和片刻私人感。",
  },
  {
    id: "coffee-table",
    label: "茶几旁",
    worldCenter: [0.12, 0, -1.58],
    triggerRadius: 1.1,
    exitRadius: 1.48,
    hintText: "茶几旁像在等下一句闲聊，靠近看看。",
    detailText: "木纹和余光把这里撑得刚刚好，像是在等一段轻松聊天自然落下来。",
  },
];

const squaredDistance = (
  left: [number, number, number],
  right: [number, number, number],
) => {
  const deltaX = left[0] - right[0];
  const deltaZ = left[2] - right[2];
  return deltaX * deltaX + deltaZ * deltaZ;
};

export const getRoomHotspotById = (hotspotId: RoomHotspotId | null) =>
  hotspotId ? ROOM_HOTSPOTS.find((hotspot) => hotspot.id === hotspotId) ?? null : null;

export const isWithinHotspotRadius = (
  hotspot: RoomHotspot,
  worldPosition: [number, number, number],
  radius: number,
) => squaredDistance(hotspot.worldCenter, worldPosition) <= radius * radius;

export const resolveNearbyHotspotId = (input: {
  worldPosition: [number, number, number] | null;
  previousHotspotId: RoomHotspotId | null;
}) => {
  if (!input.worldPosition) {
    return null;
  }

  const previousHotspot = getRoomHotspotById(input.previousHotspotId);
  if (
    previousHotspot &&
    isWithinHotspotRadius(previousHotspot, input.worldPosition, previousHotspot.exitRadius)
  ) {
    return previousHotspot.id;
  }

  let nextHotspot: RoomHotspot | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const hotspot of ROOM_HOTSPOTS) {
    if (!isWithinHotspotRadius(hotspot, input.worldPosition, hotspot.triggerRadius)) {
      continue;
    }

    const distance = squaredDistance(hotspot.worldCenter, input.worldPosition);
    if (distance < bestDistance) {
      bestDistance = distance;
      nextHotspot = hotspot;
    }
  }

  return nextHotspot?.id ?? null;
};

export const shouldAllowHotspotActivation = (input: {
  key: string;
  isChatOpen: boolean;
  isEditableTarget: boolean;
  hasNearbyHotspot: boolean;
  hasSelectedHotspot: boolean;
}) =>
  input.key.toLowerCase() === "f" &&
  !input.isChatOpen &&
  !input.isEditableTarget &&
  input.hasNearbyHotspot &&
  !input.hasSelectedHotspot;
