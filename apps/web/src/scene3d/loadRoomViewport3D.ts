import { lazy } from "react";

import { getClientSceneQualityProfile } from "./sceneQuality";

let roomViewport3DModulePromise: Promise<typeof import("./RoomViewport3D")> | null = null;
let roomPreview3DModulePromise: Promise<typeof import("./RoomPreview3D")> | null = null;

const importRoomViewport3DModule = () => {
  roomViewport3DModulePromise ??= import("./RoomViewport3D");
  return roomViewport3DModulePromise;
};

const importRoomPreview3DModule = () => {
  roomPreview3DModulePromise ??= import("./RoomPreview3D");
  return roomPreview3DModulePromise;
};

export const loadRoomViewport3D = async () => {
  const module = await importRoomViewport3DModule();
  return {
    default: module.default ?? module.RoomViewport3D,
  };
};

export const loadRoomPreview3D = async () => {
  const module = await importRoomPreview3DModule();
  return {
    default: module.default ?? module.RoomPreview3D,
  };
};

export const LazyRoomViewport3D = lazy(loadRoomViewport3D);
export const LazyRoomPreview3D = lazy(loadRoomPreview3D);

export const preloadRoomViewport3D = async () => {
  try {
    const [viewportModule] = await Promise.all([
      importRoomViewport3DModule(),
      importRoomPreview3DModule(),
    ]);
    viewportModule.preloadSceneAssets({
      roomVariant: getClientSceneQualityProfile().roomVariant,
    });
    return viewportModule;
  } catch (error) {
    console.error("[scene3d] 预加载 3D 视口失败", error);
    throw error;
  }
};
