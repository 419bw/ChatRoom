import {
  ROOM_THEME,
  type AvatarCosmetic,
  type RoomAssetManifest,
  type RoomAudioAsset,
  type RoomAvatarAsset,
  type RoomEnvironmentAsset,
  type RoomEnvironmentVariant,
  type RoomFxAsset,
  type RoomLightingAsset,
  type RoomTheme,
} from "@chat/protocol";

const AVATAR_SCALE_FACTOR = 0.92;

const scaleAvatarMetric = (value: number) =>
  Number((value * AVATAR_SCALE_FACTOR).toFixed(4));

const ROOM_ANCHOR_NODE_NAMES = [
  "WindowFrame",
  "WindowSill",
  "CurtainRod",
  "LampShade",
  "WallArt",
  "SunPanel",
] as const;

const defaultAvatarAsset: RoomAvatarAsset = {
  modelUrl: "/models/avatar-formal.glb",
  scale: AVATAR_SCALE_FACTOR,
  labelHeight: scaleAvatarMetric(2.2),
  bubbleHeight: scaleAvatarMetric(2.45),
  focusHeight: scaleAvatarMetric(1.52),
  shadowRadius: scaleAvatarMetric(0.72),
  idleClip: "Idle",
  walkClip: "Walk",
};

const createAvatarAsset = (
  overrides: Partial<RoomAvatarAsset>,
): RoomAvatarAsset => ({
  ...defaultAvatarAsset,
  ...overrides,
});

export type ResolvedRoomEnvironmentAsset = RoomEnvironmentAsset & {
  modelUrl: string;
};

const defaultEnvironmentAsset: RoomLightingAsset = {
  environmentMapUrl: "/environments/warm-lounge-sunset.svg",
  lightmapIntensity: 1.1,
};

const defaultRoomAsset: RoomEnvironmentAsset = {
  scale: 1,
  desktopModelUrl: "/models/warm-lounge-room.desktop.glb",
  mobileModelUrl: "/models/warm-lounge-room.mobile.glb",
  anchorNodeNames: [...ROOM_ANCHOR_NODE_NAMES],
};

const defaultFxAsset: RoomFxAsset = {
  bubbleSoundUrl: undefined,
};

const defaultAudioAsset: RoomAudioAsset = {
  ambientLoopUrl: "/audio/warm-lounge-ambient.wav",
};

export const roomAssetManifest: RoomAssetManifest = {
  [ROOM_THEME]: {
    environment: defaultEnvironmentAsset,
    room: defaultRoomAsset,
    avatar: createAvatarAsset({}),
    fx: defaultFxAsset,
    audio: defaultAudioAsset,
  },
};

export const resolveRoomEnvironmentAsset = (
  roomTheme: RoomTheme,
  roomVariant: RoomEnvironmentVariant,
): ResolvedRoomEnvironmentAsset => {
  const roomAsset = roomAssetManifest[roomTheme]?.room ?? defaultRoomAsset;
  return {
    ...roomAsset,
    modelUrl:
      roomVariant === "mobile"
        ? roomAsset.mobileModelUrl
        : roomAsset.desktopModelUrl,
  };
};

export const resolveRoomLightingAsset = (roomTheme: RoomTheme) =>
  roomAssetManifest[roomTheme]?.environment ?? defaultEnvironmentAsset;

export const resolveRoomFxAsset = (roomTheme: RoomTheme) =>
  roomAssetManifest[roomTheme]?.fx ?? defaultFxAsset;

export const resolveRoomAudioAsset = (roomTheme: RoomTheme) =>
  roomAssetManifest[roomTheme]?.audio ?? defaultAudioAsset;

export const resolveAvatarAsset = (roomTheme: RoomTheme) =>
  roomAssetManifest[roomTheme]?.avatar ?? defaultAvatarAsset;

export const avatarColorMap: Record<
  AvatarCosmetic,
  {
    body: string;
    accent: string;
    hair: string;
    skin: string;
  }
> = {
  apricot: {
    body: "#efb387",
    accent: "#d77e53",
    hair: "#8a5a39",
    skin: "#f3ddc7",
  },
  mint: {
    body: "#9bc8ac",
    accent: "#6fa081",
    hair: "#4e5d4a",
    skin: "#f2dfcf",
  },
  sky: {
    body: "#88b7d6",
    accent: "#5f8eae",
    hair: "#5c6685",
    skin: "#f1dacc",
  },
  sunflower: {
    body: "#f0ca6f",
    accent: "#cf9d36",
    hair: "#826338",
    skin: "#f0d5bf",
  },
  rose: {
    body: "#dd9dad",
    accent: "#ba7183",
    hair: "#6f4c57",
    skin: "#efd8cd",
  },
};
