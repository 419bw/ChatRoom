import { getShortestAngleDelta } from "./avatarLocomotion";
import {
  normalizeCameraYaw,
  resolveNextCameraPitch,
  resolveNextCameraYaw,
  resolveNextReticleOffset,
  smoothAlpha,
  type ReticleOffset,
} from "./cameraMath";
import { type SceneControlMode } from "./sceneControl";

const LOOK_SENSITIVITY = 0.0023;
const LOOK_INPUT_DEADZONE = 0.35;
const LOOK_INPUT_MAX_DELTA = 22;
export const CAMERA_LOOK_DAMPING = 18;

export type ViewportCameraControlState = {
  targetYaw: number;
  targetPitch: number;
  displayYaw: number;
  displayPitch: number;
  distance: number;
};

export const normalizeLookInputDelta = (
  delta: number,
  deadzone = LOOK_INPUT_DEADZONE,
  maxDelta = LOOK_INPUT_MAX_DELTA,
) => {
  const magnitude = Math.abs(delta);
  if (magnitude <= deadzone) {
    return 0;
  }

  const adjustedMagnitude = magnitude - deadzone;
  const softenedMagnitude =
    maxDelta * Math.tanh(adjustedMagnitude / maxDelta);

  return Math.sign(delta) * softenedMagnitude;
};

export const shouldHandlePointerLockedLookInput = (input: {
  viewportNode: HTMLDivElement | null;
  sceneControlMode: SceneControlMode;
  pointerLockElement: Element | null;
  viewportChatOpen: boolean;
}) =>
  Boolean(
    input.viewportNode &&
      input.sceneControlMode === "look" &&
      !input.viewportChatOpen &&
      input.pointerLockElement === input.viewportNode,
  );

export const applyLookDeltaToCamera = (input: {
  cameraState: ViewportCameraControlState;
  reticleOffset: ReticleOffset;
  deltaX: number;
  deltaY: number;
}) => {
  const filteredDeltaX = normalizeLookInputDelta(input.deltaX);
  const filteredDeltaY = normalizeLookInputDelta(input.deltaY);

  return {
    cameraState: {
      ...input.cameraState,
      targetYaw: resolveNextCameraYaw(
        input.cameraState.targetYaw,
        filteredDeltaX,
        LOOK_SENSITIVITY,
      ),
      targetPitch: resolveNextCameraPitch(
        input.cameraState.targetPitch,
        filteredDeltaY,
        LOOK_SENSITIVITY,
      ),
    },
    reticleOffset: resolveNextReticleOffset(
      input.reticleOffset,
      filteredDeltaX,
      filteredDeltaY,
    ),
  };
};

export const freezeLookCameraState = (
  cameraState: ViewportCameraControlState,
): ViewportCameraControlState => ({
  ...cameraState,
  targetYaw: cameraState.displayYaw,
  targetPitch: cameraState.displayPitch,
});

export const resolveSmoothedLookCameraState = (input: {
  cameraState: ViewportCameraControlState;
  deltaSeconds: number;
  damping?: number;
}): ViewportCameraControlState => {
  const alpha = smoothAlpha(
    input.deltaSeconds,
    input.damping ?? CAMERA_LOOK_DAMPING,
  );
  const yawDelta = getShortestAngleDelta(
    input.cameraState.displayYaw,
    input.cameraState.targetYaw,
  );

  return {
    ...input.cameraState,
    displayYaw: normalizeCameraYaw(input.cameraState.displayYaw + yawDelta * alpha),
    displayPitch:
      input.cameraState.displayPitch +
      (input.cameraState.targetPitch - input.cameraState.displayPitch) * alpha,
  };
};

export const resolveSmoothedReticleOffset = (input: {
  displayOffset: ReticleOffset;
  targetOffset: ReticleOffset;
  deltaSeconds: number;
  damping: number;
}): ReticleOffset => {
  const alpha = smoothAlpha(input.deltaSeconds, input.damping);

  return {
    x:
      input.displayOffset.x +
      (input.targetOffset.x - input.displayOffset.x) * alpha,
    y:
      input.displayOffset.y +
      (input.targetOffset.y - input.displayOffset.y) * alpha,
  };
};
