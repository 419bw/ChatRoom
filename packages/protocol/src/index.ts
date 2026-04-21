import { z } from "zod";

export const DEFAULT_ROOM_ID = "cozy-lounge";
export const ROOM_THEME = "warm-lounge";
export const ROOM_BOUNDS = {
  width: 1280,
  height: 720,
  minX: 180,
  maxX: 1100,
  minY: 180,
  maxY: 610,
} as const;

export const ROOM_WORLD_SCALE = 0.02;
export const ROOM_WORLD_FLOOR_Y = 0;
export const ROOM_OBSTACLE_PADDING = 12;
export const ROOM_NETWORK_CENTER = {
  x: (ROOM_BOUNDS.minX + ROOM_BOUNDS.maxX) / 2,
  y: (ROOM_BOUNDS.minY + ROOM_BOUNDS.maxY) / 2,
} as const;

export const SESSION_TTL_MS = 1000 * 60 * 5;
export const MAX_NICKNAME_LENGTH = 16;
export const MAX_CHAT_LENGTH = 120;
export const RECENT_CHAT_LIMIT = 40;
export const RECENT_TIMELINE_LIMIT = 80;
export const MOVE_KEYBOARD_STEP = 14;
export const MOVE_KEYBOARD_INTERVAL_MS = 40;

export const avatarCosmetics = [
  "apricot",
  "mint",
  "sky",
  "sunflower",
  "rose",
] as const;

export const roomThemes = [ROOM_THEME] as const;

export type AvatarCosmetic = (typeof avatarCosmetics)[number];
export type RoomTheme = (typeof roomThemes)[number];

export type TimelineCategory =
  | "chat_message"
  | "system_event"
  | "presence_event"
  | "avatar_event";

export type Severity = "info" | "warning" | "error";

export const pointSchema = z.object({
  x: z.number().finite().min(ROOM_BOUNDS.minX).max(ROOM_BOUNDS.maxX),
  y: z.number().finite().min(ROOM_BOUNDS.minY).max(ROOM_BOUNDS.maxY),
});

export const directionSchema = z.object({
  x: z.number().finite().min(-1).max(1),
  y: z.number().finite().min(-1).max(1),
});

export const avatarCosmeticSchema = z.enum(avatarCosmetics);
export const roomThemeSchema = z.enum(roomThemes);

const nicknamePattern = /^[\p{L}\p{N}_-]{1,16}$/u;

export const nicknameSchema = z
  .string()
  .trim()
  .min(1, "昵称不能为空")
  .max(MAX_NICKNAME_LENGTH, "昵称过长")
  .refine(
    (value) => nicknamePattern.test(value),
    "昵称仅支持中英文、数字、下划线和短横线",
  );

export const chatTextSchema = z
  .string()
  .trim()
  .min(1, "消息不能为空")
  .max(MAX_CHAT_LENGTH, "消息过长");

export const userAvatarStateSchema = z.object({
  cosmetic: avatarCosmeticSchema,
});

export const userPresenceStateSchema = z.object({
  userId: z.string().min(1),
  nickname: nicknameSchema,
  avatar: userAvatarStateSchema,
  position: pointSchema,
  joinedAt: z.number().int().positive(),
  lastActiveAt: z.number().int().positive(),
});

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  nickname: nicknameSchema,
  avatar: userAvatarStateSchema,
  text: chatTextSchema,
  sentAt: z.number().int().positive(),
});

export const timelineEntrySchema = z.object({
  id: z.string().min(1),
  category: z.enum([
    "chat_message",
    "system_event",
    "presence_event",
    "avatar_event",
  ] as const),
  message: z.string().min(1),
  createdAt: z.number().int().positive(),
  actorId: z.string().optional(),
  actorName: z.string().optional(),
  meta: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .default({}),
});

export const systemNoticeSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(["info", "warning", "error"] as const),
  message: z.string().min(1),
  createdAt: z.number().int().positive(),
});

export const roomSnapshotSchema = z.object({
  roomId: z.string().min(1),
  roomTheme: roomThemeSchema,
  bounds: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    minX: z.number(),
    maxX: z.number(),
    minY: z.number(),
    maxY: z.number(),
  }),
  selfUserId: z.string().min(1),
  sessionToken: z.string().min(1),
  users: z.array(userPresenceStateSchema),
  recentMessages: z.array(chatMessageSchema),
  recentTimeline: z.array(timelineEntrySchema),
});

export const joinRoomPayloadSchema = z.object({
  roomId: z.string().min(1).default(DEFAULT_ROOM_ID),
  nickname: nicknameSchema,
  avatar: avatarCosmeticSchema,
  sessionToken: z.string().min(1).optional(),
});

export const moveIntentPayloadSchema = z
  .object({
    target: pointSchema.optional(),
    direction: directionSchema.optional(),
  })
  .refine((value) => value.target || value.direction, "移动事件必须包含目标点或方向");

export const sendChatPayloadSchema = z.object({
  text: chatTextSchema,
});

export const updateAvatarPayloadSchema = z.object({
  avatar: avatarCosmeticSchema,
});

export const syncReadyPayloadSchema = z.object({
  roomId: z.string().min(1).default(DEFAULT_ROOM_ID),
});

export type Point = z.infer<typeof pointSchema>;
export type Direction = z.infer<typeof directionSchema>;
export type UserAvatarState = z.infer<typeof userAvatarStateSchema>;
export type UserPresenceState = z.infer<typeof userPresenceStateSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;
export type SystemNotice = z.infer<typeof systemNoticeSchema>;
export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>;
export type JoinRoomPayload = z.infer<typeof joinRoomPayloadSchema>;
export type MoveIntentPayload = z.infer<typeof moveIntentPayloadSchema>;
export type SendChatPayload = z.infer<typeof sendChatPayloadSchema>;
export type UpdateAvatarPayload = z.infer<typeof updateAvatarPayloadSchema>;
export type SyncReadyPayload = z.infer<typeof syncReadyPayloadSchema>;

export type InteractableObject = {
  id: string;
  label: string;
  anchor: Point;
};

export type EmoteEvent = {
  userId: string;
  emoteKey: string;
  createdAt: number;
};

export type ModerationAction = {
  userId: string;
  action: "mute" | "kick" | "warn";
  createdAt: number;
};

export type RoomObstacle = {
  id: string;
  center: Point;
  halfSize: {
    x: number;
    y: number;
  };
  worldHeight: number;
};

export type RoomLayoutConfig = {
  roomId: string;
  theme: RoomTheme;
  floorY: number;
  worldScale: number;
  camera: {
    offset: [number, number, number];
    lookAtHeight: number;
    deadzone: [number, number];
    focusDamping: number;
    positionDamping: number;
  };
  quality: {
    mobile: SceneQualityPreset;
    desktop: SceneQualityPreset;
    desktopHigh: SceneQualityPreset;
  };
  spawnPoints: Point[];
  obstacles: RoomObstacle[];
};

export type SceneShadowMode = "off" | "blob" | "directional";
export type RoomEnvironmentVariant = "mobile" | "desktop";
export type ScenePostprocessingPreset = {
  enabled: boolean;
  antialiasPass: "none" | "fxaa";
  bloomIntensity: number;
  vignette: boolean;
};

export type DynamicResolutionPreset = {
  enabled: boolean;
  minDpr: number;
  adjustStep: number;
  settleFrames: number;
  targetFrameMs: number;
};

export type SceneQualityPreset = {
  maxDpr: number;
  antialias: boolean;
  shadows: boolean;
  shadowMode: SceneShadowMode;
  shadowMapSize: number;
  roomVariant: RoomEnvironmentVariant;
  postprocessing: ScenePostprocessingPreset;
  dynamicResolution: DynamicResolutionPreset;
  labelMaxDistance: number;
  bubbleMaxDistance: number;
};

export type RoomEnvironmentAsset = {
  scale: number;
  desktopModelUrl: string;
  mobileModelUrl: string;
  anchorNodeNames?: string[];
};

export type RoomLightingAsset = {
  environmentMapUrl: string;
  lightmapIntensity?: number;
};

export type RoomFxAsset = {
  bubbleSoundUrl?: string;
};

export type RoomAudioAsset = {
  ambientLoopUrl?: string;
};

export type RoomAvatarAsset = {
  modelUrl: string;
  scale: number;
  labelHeight: number;
  bubbleHeight: number;
  focusHeight: number;
  shadowRadius: number;
  idleClip: string;
  walkClip: string;
};

export type RoomAssetManifest = Record<
  RoomTheme,
  {
    environment: RoomLightingAsset;
    room: RoomEnvironmentAsset;
    avatar: RoomAvatarAsset;
    fx: RoomFxAsset;
    audio: RoomAudioAsset;
  }
>;

export type WorldActorState = {
  userId: string;
  nickname: string;
  avatar: UserAvatarState;
  worldPosition: [number, number, number];
  heading: number;
  isLocal: boolean;
};

export const ROOM_LAYOUT_CONFIG: RoomLayoutConfig = {
  roomId: DEFAULT_ROOM_ID,
  theme: ROOM_THEME,
  floorY: ROOM_WORLD_FLOOR_Y,
  worldScale: ROOM_WORLD_SCALE,
  camera: {
    offset: [0, 3.95, 4.9],
    lookAtHeight: 1.35,
    deadzone: [0.42, 0.28],
    focusDamping: 16,
    positionDamping: 14,
  },
  quality: {
    mobile: {
      maxDpr: 1.35,
      antialias: false,
      shadows: false,
      shadowMode: "blob",
      shadowMapSize: 0,
      roomVariant: "mobile",
      postprocessing: {
        enabled: false,
        antialiasPass: "none",
        bloomIntensity: 0,
        vignette: false,
      },
      dynamicResolution: {
        enabled: true,
        minDpr: 0.8,
        adjustStep: 0.1,
        settleFrames: 24,
        targetFrameMs: 28,
      },
      labelMaxDistance: 15,
      bubbleMaxDistance: 13,
    },
    desktop: {
      maxDpr: 1.8,
      antialias: true,
      shadows: true,
      shadowMode: "directional",
      shadowMapSize: 1536,
      roomVariant: "desktop",
      postprocessing: {
        enabled: true,
        antialiasPass: "fxaa",
        bloomIntensity: 0.18,
        vignette: true,
      },
      dynamicResolution: {
        enabled: true,
        minDpr: 0.9,
        adjustStep: 0.1,
        settleFrames: 28,
        targetFrameMs: 18.5,
      },
      labelMaxDistance: 22,
      bubbleMaxDistance: 16,
    },
    desktopHigh: {
      maxDpr: 2.25,
      antialias: true,
      shadows: true,
      shadowMode: "directional",
      shadowMapSize: 2048,
      roomVariant: "desktop",
      postprocessing: {
        enabled: true,
        antialiasPass: "fxaa",
        bloomIntensity: 0.24,
        vignette: true,
      },
      dynamicResolution: {
        enabled: true,
        minDpr: 0.95,
        adjustStep: 0.1,
        settleFrames: 32,
        targetFrameMs: 16.8,
      },
      labelMaxDistance: 24,
      bubbleMaxDistance: 18,
    },
  },
  spawnPoints: [
    { x: 520, y: 430 },
    { x: 690, y: 430 },
    { x: 450, y: 520 },
    { x: 790, y: 520 },
    { x: 610, y: 560 },
  ],
  obstacles: [
    {
      id: "sofa-back",
      center: { x: 640, y: 230 },
      halfSize: { x: 190, y: 58 },
      worldHeight: 2.1,
    },
    {
      id: "coffee-table",
      center: { x: 640, y: 360 },
      halfSize: { x: 108, y: 54 },
      worldHeight: 0.9,
    },
    {
      id: "plant-left",
      center: { x: 285, y: 228 },
      halfSize: { x: 42, y: 40 },
      worldHeight: 1.9,
    },
    {
      id: "plant-right",
      center: { x: 995, y: 228 },
      halfSize: { x: 42, y: 40 },
      worldHeight: 1.9,
    },
  ],
};

export interface ClientToServerEvents {
  join_room: (payload: JoinRoomPayload) => void;
  move_intent: (payload: MoveIntentPayload) => void;
  send_chat: (payload: SendChatPayload) => void;
  update_avatar: (payload: UpdateAvatarPayload) => void;
  sync_ready: (payload: SyncReadyPayload) => void;
}

export interface ServerToClientEvents {
  room_snapshot: (snapshot: RoomSnapshot) => void;
  user_joined: (user: UserPresenceState) => void;
  user_left: (payload: { userId: string }) => void;
  user_moved: (user: UserPresenceState) => void;
  chat_posted: (message: ChatMessage) => void;
  timeline_entry: (entry: TimelineEntry) => void;
  system_notice: (notice: SystemNotice) => void;
}

const clampPoint = (point: Point): Point => ({
  x: Math.max(ROOM_BOUNDS.minX, Math.min(point.x, ROOM_BOUNDS.maxX)),
  y: Math.max(ROOM_BOUNDS.minY, Math.min(point.y, ROOM_BOUNDS.maxY)),
});

export const isPointInsideObstacle = (
  point: Point,
  obstacle: RoomObstacle,
  padding = ROOM_OBSTACLE_PADDING,
) =>
  point.x > obstacle.center.x - obstacle.halfSize.x - padding &&
  point.x < obstacle.center.x + obstacle.halfSize.x + padding &&
  point.y > obstacle.center.y - obstacle.halfSize.y - padding &&
  point.y < obstacle.center.y + obstacle.halfSize.y + padding;

export const pushPointOutOfObstacle = (
  point: Point,
  obstacle: RoomObstacle,
  padding = ROOM_OBSTACLE_PADDING,
): Point => {
  if (!isPointInsideObstacle(point, obstacle, padding)) {
    return point;
  }

  const minX = obstacle.center.x - obstacle.halfSize.x - padding;
  const maxX = obstacle.center.x + obstacle.halfSize.x + padding;
  const minY = obstacle.center.y - obstacle.halfSize.y - padding;
  const maxY = obstacle.center.y + obstacle.halfSize.y + padding;

  const escapeOptions = [
    { axis: "x", value: minX, delta: Math.abs(point.x - minX) },
    { axis: "x", value: maxX, delta: Math.abs(point.x - maxX) },
    { axis: "y", value: minY, delta: Math.abs(point.y - minY) },
    { axis: "y", value: maxY, delta: Math.abs(point.y - maxY) },
  ].sort((left, right) => left.delta - right.delta);

  for (const choice of escapeOptions) {
    const next = { ...point };
    if (choice.axis === "x") {
      next.x = choice.value;
    } else {
      next.y = choice.value;
    }

    const clamped = clampPoint(next);
    if (!isPointInsideObstacle(clamped, obstacle, padding)) {
      return clamped;
    }
  }

  return clampPoint(point);
};

export const resolveRoomCollisionPoint = (
  point: Point,
  obstacles = ROOM_LAYOUT_CONFIG.obstacles,
  padding = ROOM_OBSTACLE_PADDING,
): Point => {
  let nextPoint = clampPoint(point);

  for (const obstacle of obstacles) {
    nextPoint = pushPointOutOfObstacle(nextPoint, obstacle, padding);
  }

  return clampPoint(nextPoint);
};

export const parseJoinRoomPayload = (payload: unknown): JoinRoomPayload =>
  joinRoomPayloadSchema.parse(payload);

export const parseMoveIntentPayload = (payload: unknown): MoveIntentPayload =>
  moveIntentPayloadSchema.parse(payload);

export const parseSendChatPayload = (payload: unknown): SendChatPayload =>
  sendChatPayloadSchema.parse(payload);

export const parseUpdateAvatarPayload = (payload: unknown): UpdateAvatarPayload =>
  updateAvatarPayloadSchema.parse(payload);

export const createSystemNotice = (
  message: string,
  severity: Severity = "info",
): SystemNotice => ({
  id: crypto.randomUUID(),
  severity,
  message,
  createdAt: Date.now(),
});
