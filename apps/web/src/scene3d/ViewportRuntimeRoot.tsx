import {
  ROOM_BOUNDS,
  ROOM_LAYOUT_CONFIG,
  ROOM_NETWORK_CENTER,
  ROOM_WORLD_FLOOR_Y,
  ROOM_WORLD_SCALE,
  type MoveIntentPayload,
  type RoomTheme,
} from "@chat/protocol";
import { Vector3 } from "three";

import { resolveAvatarAsset } from "./assetManifest";
import { AvatarSystem } from "./AvatarSystem";
import { CameraSystem } from "./CameraSystem";
import { HotspotSystem } from "./HotspotSystem";
import { OverlaySystem } from "./OverlaySystem";
import { RoomScene3D } from "./RoomScene3D";
import { type SceneQualityProfile } from "./sceneQuality";
import { type SceneRuntimeStore } from "./sceneRuntimeStore";
import type {
  ActorRenderState,
  OverlayItem,
  ViewportSharedRefs,
} from "./viewportRuntimeTypes";
import { obstacleToWorld } from "./worldMapping";
import { type ViewportMode } from "./sceneControl";
import { type RuntimeScenePolicy } from "./runtimeScenePolicy";
import type { RoomHotspot } from "./roomHotspots";
import type { MutableRefObject } from "react";

const roomBoundsMin = new Vector3(
  (ROOM_BOUNDS.minX - ROOM_NETWORK_CENTER.x) * ROOM_WORLD_SCALE,
  ROOM_WORLD_FLOOR_Y + 0.62,
  (ROOM_BOUNDS.minY - ROOM_NETWORK_CENTER.y) * ROOM_WORLD_SCALE,
);
const roomBoundsMax = new Vector3(
  (ROOM_BOUNDS.maxX - ROOM_NETWORK_CENTER.x) * ROOM_WORLD_SCALE,
  ROOM_WORLD_FLOOR_Y + 3.1,
  (ROOM_BOUNDS.maxY - ROOM_NETWORK_CENTER.y) * ROOM_WORLD_SCALE,
);

const cameraRoomBounds = {
  min: roomBoundsMin,
  max: roomBoundsMax,
};

const cameraObstacleAabbs = ROOM_LAYOUT_CONFIG.obstacles.map((obstacle) => {
  const worldObstacle = obstacleToWorld(obstacle);
  return {
    min: new Vector3(
      worldObstacle.center[0] - worldObstacle.size[0] / 2 - 0.18,
      ROOM_WORLD_FLOOR_Y + 0.28,
      worldObstacle.center[2] - worldObstacle.size[2] / 2 - 0.18,
    ),
    max: new Vector3(
      worldObstacle.center[0] + worldObstacle.size[0] / 2 + 0.18,
      ROOM_WORLD_FLOOR_Y + worldObstacle.size[1] + 0.34,
      worldObstacle.center[2] + worldObstacle.size[2] / 2 + 0.18,
    ),
  };
});

export const ViewportRuntimeRoot = ({
  actors,
  overlayItems,
  roomTheme,
  selfUserId,
  viewportMode,
  quality,
  runtimePolicy,
  activeHotspot,
  isHotspotSelected,
  hotspotLabelRef,
  sharedRefs,
  runtimeStore,
  onMoveIntent,
}: {
  actors: ActorRenderState[];
  overlayItems: OverlayItem[];
  roomTheme: RoomTheme;
  selfUserId: string | null;
  viewportMode: ViewportMode;
  quality: SceneQualityProfile;
  runtimePolicy: RuntimeScenePolicy;
  activeHotspot: RoomHotspot | null;
  isHotspotSelected: boolean;
  hotspotLabelRef: MutableRefObject<HTMLDivElement | null>;
  sharedRefs: ViewportSharedRefs;
  runtimeStore: SceneRuntimeStore;
  onMoveIntent: (payload: MoveIntentPayload) => void;
}) => {
  const avatarAsset = resolveAvatarAsset(roomTheme);

  return (
    <>
      <CameraSystem
        targetRef={sharedRefs.localDisplayRef}
        focusHeight={avatarAsset.focusHeight}
        viewportMode={viewportMode}
        viewportRef={sharedRefs.viewportRef}
        crosshairRef={sharedRefs.crosshairRef}
        cameraControlRef={sharedRefs.cameraControlRef}
        reticleControlRef={sharedRefs.reticleControlRef}
        cameraRoomBounds={cameraRoomBounds}
        cameraObstacleAabbs={cameraObstacleAabbs}
        runtimeStore={runtimeStore}
      />
      <RoomScene3D
        roomTheme={roomTheme}
        quality={quality}
        runtimePolicy={runtimePolicy}
        mode="interactive"
      >
        <AvatarSystem
          actors={actors}
          roomTheme={roomTheme}
          selfUserId={selfUserId}
          viewportMode={viewportMode}
          quality={quality}
          runtimePolicy={runtimePolicy}
          cameraControlRef={sharedRefs.cameraControlRef}
          displayGroupMapRef={sharedRefs.displayGroupMapRef}
          localDisplayRef={sharedRefs.localDisplayRef}
          runtimeStore={runtimeStore}
          onMoveIntent={onMoveIntent}
        />
        <HotspotSystem
          hotspot={activeHotspot}
          selected={isHotspotSelected}
          labelRef={hotspotLabelRef}
        />
        <OverlaySystem
          items={overlayItems}
          roomTheme={roomTheme}
          quality={quality}
          runtimePolicy={runtimePolicy}
          selfUserId={selfUserId}
          displayGroupMapRef={sharedRefs.displayGroupMapRef}
          overlayAnchorRef={sharedRefs.overlayAnchorRef}
          overlayDomRefsRef={sharedRefs.overlayDomRefsRef}
          viewportRef={sharedRefs.viewportRef}
          runtimeStore={runtimeStore}
        />
      </RoomScene3D>
    </>
  );
};
