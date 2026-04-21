import { useFrame } from "@react-three/fiber";
import { useRef, type MutableRefObject } from "react";
import { Object3D, Vector3 } from "three";

import {
  THIRD_PERSON_CAMERA_DEFAULTS,
  resolveSmoothedSpringArmDistance,
  resolveSpringArmDistance,
  resolveThirdPersonAimTarget,
  resolveThirdPersonCameraPosition,
  resolveThirdPersonFocusTarget,
  smoothAlpha,
} from "./cameraMath";
import { applyCrosshairNodeState } from "./viewportDom";
import { type SceneRuntimeStore } from "./sceneRuntimeStore";
import {
  isViewportChatMode,
  isViewportLookMode,
  type ViewportMode,
} from "./sceneControl";
import type {
  CameraControlState,
  ReticleControlState,
} from "./viewportRuntimeTypes";
import {
  resolveSmoothedLookCameraState,
  resolveSmoothedReticleOffset,
} from "./viewportLookControls";

const CAMERA_RIG_DAMPING = 19;
const RETICLE_DAMPING = 17;

export const CameraSystem = ({
  targetRef,
  focusHeight,
  viewportMode,
  viewportRef,
  crosshairRef,
  cameraControlRef,
  reticleControlRef,
  cameraRoomBounds,
  cameraObstacleAabbs,
  runtimeStore,
}: {
  targetRef: MutableRefObject<Object3D | null>;
  focusHeight: number;
  viewportMode: ViewportMode;
  viewportRef: MutableRefObject<HTMLDivElement | null>;
  crosshairRef: MutableRefObject<HTMLDivElement | null>;
  cameraControlRef: MutableRefObject<CameraControlState>;
  reticleControlRef: MutableRefObject<ReticleControlState>;
  cameraRoomBounds: Parameters<typeof resolveSpringArmDistance>[0]["roomBounds"];
  cameraObstacleAabbs: Parameters<typeof resolveSpringArmDistance>[0]["obstacles"];
  runtimeStore: SceneRuntimeStore;
}) => {
  const desiredCameraPositionRef = useRef(new Vector3());
  const currentDistanceRef = useRef<number>(THIRD_PERSON_CAMERA_DEFAULTS.distance);
  const aimTargetRef = useRef(new Vector3());

  useFrame(({ camera }, delta) => {
    if (!targetRef.current) {
      return;
    }

    const targetPosition = targetRef.current.position;
    const focusTarget = resolveThirdPersonFocusTarget(targetPosition, focusHeight);
    const shouldUseReticle =
      isViewportLookMode(viewportMode) && !isViewportChatMode(viewportMode);
    const nextReticleTarget = shouldUseReticle
      ? reticleControlRef.current.target
      : { x: 0, y: 0 };

    const nextCameraState = resolveSmoothedLookCameraState({
      cameraState: cameraControlRef.current,
      deltaSeconds: delta,
    });
    cameraControlRef.current = nextCameraState;
    reticleControlRef.current.display = resolveSmoothedReticleOffset({
      displayOffset: reticleControlRef.current.display,
      targetOffset: nextReticleTarget,
      deltaSeconds: delta,
      damping: RETICLE_DAMPING,
    });

    const desiredCameraPosition = resolveThirdPersonCameraPosition({
      focusTarget,
      yaw: cameraControlRef.current.displayYaw,
      pitch: cameraControlRef.current.displayPitch,
      distance: THIRD_PERSON_CAMERA_DEFAULTS.distance,
    });
    const cameraDistance = resolveSpringArmDistance({
      focusTarget,
      desiredCameraPosition,
      roomBounds: cameraRoomBounds,
      obstacles: cameraObstacleAabbs,
    });
    currentDistanceRef.current = resolveSmoothedSpringArmDistance({
      currentDistance: currentDistanceRef.current,
      targetDistance: cameraDistance,
      deltaSeconds: delta,
    });
    cameraControlRef.current.distance = currentDistanceRef.current;
    desiredCameraPositionRef.current.copy(
      resolveThirdPersonCameraPosition({
        focusTarget,
        yaw: cameraControlRef.current.displayYaw,
        pitch: cameraControlRef.current.displayPitch,
        distance: currentDistanceRef.current,
      }),
    );

    camera.position.lerp(
      desiredCameraPositionRef.current,
      smoothAlpha(delta, CAMERA_RIG_DAMPING),
    );
    aimTargetRef.current.copy(
      resolveThirdPersonAimTarget({
        focusTarget,
        yaw: cameraControlRef.current.displayYaw,
        pitch: cameraControlRef.current.displayPitch,
        reticleOffset: reticleControlRef.current.display,
      }),
    );
    camera.lookAt(aimTargetRef.current);
    applyCrosshairNodeState(crosshairRef.current, reticleControlRef.current.display);
    runtimeStore.setCamera(cameraControlRef.current);
    runtimeStore.setReticle({
      target: reticleControlRef.current.target,
      display: reticleControlRef.current.display,
    });

    if (viewportRef.current) {
      viewportRef.current.dataset.cameraDistance =
        cameraControlRef.current.distance.toFixed(4);
    }
  });

  return null;
};
