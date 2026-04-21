import type { AvatarCosmetic } from "@chat/protocol";
import type { MutableRefObject } from "react";
import type { Group, Object3D } from "three";

import type { BubblePhase } from "./bubbleLifecycle";
import type { StabilizedOverlayState } from "./overlayProjection";
import type { ViewportCameraControlState } from "./viewportLookControls";
import type { ReticleOffset } from "./cameraMath";
import type { LocalMotionState } from "./sceneRuntimeStore";
import type { RuntimeActorFidelity, RuntimeOverlayPriority } from "./runtimeScenePolicy";
import type { RecentActivityKind } from "../domain/recentActivity";

export type OverlayItem = {
  userId: string;
  nickname: string;
  bubbleText?: string;
  bubblePhase?: BubblePhase;
  priority: RuntimeOverlayPriority;
  statusText?: string;
  statusKind?: RecentActivityKind;
};

export type OverlayAnchor = {
  label: StabilizedOverlayState;
  bubble: StabilizedOverlayState;
};

export type OverlayDomRefs = {
  labelNodes: Map<string, HTMLDivElement>;
  bubbleNodes: Map<string, HTMLDivElement>;
};

export type CameraControlState = ViewportCameraControlState;

export type ReticleControlState = {
  target: ReticleOffset;
  display: ReticleOffset;
};

export type ViewportSharedRefs = {
  viewportRef: MutableRefObject<HTMLDivElement | null>;
  crosshairRef: MutableRefObject<HTMLDivElement | null>;
  overlayAnchorRef: MutableRefObject<Map<string, OverlayAnchor>>;
  overlayDomRefsRef: MutableRefObject<OverlayDomRefs>;
  displayGroupMapRef: MutableRefObject<Map<string, Group>>;
  localDisplayRef: MutableRefObject<Object3D | null>;
  cameraControlRef: MutableRefObject<CameraControlState>;
  reticleControlRef: MutableRefObject<ReticleControlState>;
};

export type ViewportRuntimeDebugState = {
  localMotion: LocalMotionState;
};

export type ActorRenderState = {
  userId: string;
  nickname: string;
  avatar: {
    cosmetic: AvatarCosmetic;
  };
  worldPosition: [number, number, number];
  heading: number;
  isLocal: boolean;
  fidelity: RuntimeActorFidelity;
};
