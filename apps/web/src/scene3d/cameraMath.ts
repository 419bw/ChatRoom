import { MathUtils, Vector3 } from "three";

export type CameraObstacleAabb = {
  min: Vector3;
  max: Vector3;
};

export const THIRD_PERSON_CAMERA_DEFAULTS = {
  yaw: Math.PI,
  pitch: 0.2,
  minPitch: -0.08,
  maxPitch: 0.34,
  distance: 3.3,
  minDistance: 0.95,
  shoulderOffset: 1.08,
  heightOffset: 0.16,
  collisionPadding: 0.2,
  shrinkDamping: 26,
  expandDamping: 10,
  transparencyFadeStartDistance: 1.85,
  transparencyFadeEndDistance: 1.15,
  minTransparencyOpacity: 0.22,
  reticleMaxOffsetX: 0.26,
  reticleMaxOffsetY: 0.2,
  reticleSensitivityX: 0.0018,
  reticleSensitivityY: 0.0016,
  aimDistance: 7.4,
  aimHorizontalOffsetScale: 3.2,
  aimVerticalOffsetScale: 2.4,
} as const;

export type ReticleOffset = {
  x: number;
  y: number;
};

export const clampCameraPitch = (
  pitch: number,
  minPitch = THIRD_PERSON_CAMERA_DEFAULTS.minPitch,
  maxPitch = THIRD_PERSON_CAMERA_DEFAULTS.maxPitch,
) => MathUtils.clamp(pitch, minPitch, maxPitch);

export const normalizeCameraYaw = (yaw: number) =>
  Math.atan2(Math.sin(yaw), Math.cos(yaw));

export const resolveCameraForwardVector = (yaw: number) =>
  new Vector3(Math.sin(yaw), 0, -Math.cos(yaw)).normalize();

export const resolveCameraRightVector = (yaw: number) =>
  new Vector3(Math.cos(yaw), 0, Math.sin(yaw)).normalize();

export const resolveNextCameraYaw = (
  currentYaw: number,
  deltaX: number,
  sensitivity: number,
) => normalizeCameraYaw(currentYaw + deltaX * sensitivity);

export const resolveNextCameraPitch = (
  currentPitch: number,
  deltaY: number,
  sensitivity: number,
  minPitch = THIRD_PERSON_CAMERA_DEFAULTS.minPitch,
  maxPitch = THIRD_PERSON_CAMERA_DEFAULTS.maxPitch,
) => clampCameraPitch(currentPitch + deltaY * sensitivity, minPitch, maxPitch);

export const resolveCameraRelativeMoveDirection = (input: {
  x: number;
  y: number;
  yaw: number;
}) => {
  const forward = resolveCameraForwardVector(input.yaw);
  const right = resolveCameraRightVector(input.yaw);
  const worldDirection = right.multiplyScalar(input.x).add(
    forward.multiplyScalar(-input.y),
  );
  const length = Math.hypot(worldDirection.x, worldDirection.z) || 1;

  return {
    x: worldDirection.x / length,
    y: worldDirection.z / length,
  };
};

export const resolveThirdPersonFocusTarget = (
  targetPosition: Vector3,
  focusHeight: number,
) => targetPosition.clone().add(new Vector3(0, focusHeight, 0));

export const clampReticleOffset = (
  offset: ReticleOffset,
  maxOffsetX = THIRD_PERSON_CAMERA_DEFAULTS.reticleMaxOffsetX,
  maxOffsetY = THIRD_PERSON_CAMERA_DEFAULTS.reticleMaxOffsetY,
): ReticleOffset => ({
  x: MathUtils.clamp(offset.x, -maxOffsetX, maxOffsetX),
  y: MathUtils.clamp(offset.y, -maxOffsetY, maxOffsetY),
});

export const resolveNextReticleOffset = (
  current: ReticleOffset,
  deltaX: number,
  deltaY: number,
  sensitivityX = THIRD_PERSON_CAMERA_DEFAULTS.reticleSensitivityX,
  sensitivityY = THIRD_PERSON_CAMERA_DEFAULTS.reticleSensitivityY,
  maxOffsetX = THIRD_PERSON_CAMERA_DEFAULTS.reticleMaxOffsetX,
  maxOffsetY = THIRD_PERSON_CAMERA_DEFAULTS.reticleMaxOffsetY,
) =>
  clampReticleOffset(
    {
      x: current.x + deltaX * sensitivityX,
      y: current.y + deltaY * sensitivityY,
    },
    maxOffsetX,
    maxOffsetY,
  );

export const resolveThirdPersonCameraPosition = (input: {
  focusTarget: Vector3;
  yaw: number;
  pitch: number;
  distance: number;
  shoulderOffset?: number;
  heightOffset?: number;
}) => {
  const forward = resolveCameraForwardVector(input.yaw);
  const right = resolveCameraRightVector(input.yaw);
  const horizontalDistance = Math.cos(input.pitch) * input.distance;
  const verticalDistance =
    Math.sin(input.pitch) * input.distance +
    (input.heightOffset ?? THIRD_PERSON_CAMERA_DEFAULTS.heightOffset);

  return input.focusTarget
    .clone()
    .add(right.multiplyScalar(input.shoulderOffset ?? THIRD_PERSON_CAMERA_DEFAULTS.shoulderOffset))
    .add(new Vector3(0, verticalDistance, 0))
    .add(forward.multiplyScalar(-horizontalDistance));
};

export const resolveThirdPersonAimTarget = (input: {
  focusTarget: Vector3;
  yaw: number;
  pitch: number;
  reticleOffset?: ReticleOffset;
  aimDistance?: number;
  horizontalOffsetScale?: number;
  verticalOffsetScale?: number;
}) => {
  const direction = new Vector3(
    Math.sin(input.yaw) * Math.cos(input.pitch),
    -Math.sin(input.pitch),
    -Math.cos(input.yaw) * Math.cos(input.pitch),
  ).normalize();
  const right = resolveCameraRightVector(input.yaw);
  const reticleOffset = clampReticleOffset(input.reticleOffset ?? { x: 0, y: 0 });

  return input.focusTarget
    .clone()
    .add(direction.multiplyScalar(input.aimDistance ?? THIRD_PERSON_CAMERA_DEFAULTS.aimDistance))
    .add(
      right.multiplyScalar(
        reticleOffset.x *
          (input.horizontalOffsetScale ??
            THIRD_PERSON_CAMERA_DEFAULTS.aimHorizontalOffsetScale),
      ),
    )
    .add(
      new Vector3(
        0,
        -reticleOffset.y *
          (input.verticalOffsetScale ??
            THIRD_PERSON_CAMERA_DEFAULTS.aimVerticalOffsetScale),
        0,
      ),
    );
};

export const smoothAlpha = (delta: number, damping: number) =>
  1 - Math.exp(-delta * damping);

export const resolveSmoothedSpringArmDistance = (input: {
  currentDistance: number;
  targetDistance: number;
  deltaSeconds: number;
  shrinkDamping?: number;
  expandDamping?: number;
}) => {
  const damping =
    input.targetDistance < input.currentDistance
      ? (input.shrinkDamping ?? THIRD_PERSON_CAMERA_DEFAULTS.shrinkDamping)
      : (input.expandDamping ?? THIRD_PERSON_CAMERA_DEFAULTS.expandDamping);

  return (
    input.currentDistance +
    (input.targetDistance - input.currentDistance) * smoothAlpha(input.deltaSeconds, damping)
  );
};

export const resolveLocalAvatarOpacity = (input: {
  cameraDistance: number;
  isLookMode: boolean;
  fadeStartDistance?: number;
  fadeEndDistance?: number;
  minOpacity?: number;
}) => {
  if (!input.isLookMode) {
    return 1;
  }

  const fadeStartDistance =
    input.fadeStartDistance ?? THIRD_PERSON_CAMERA_DEFAULTS.transparencyFadeStartDistance;
  const fadeEndDistance =
    input.fadeEndDistance ?? THIRD_PERSON_CAMERA_DEFAULTS.transparencyFadeEndDistance;
  const minOpacity =
    input.minOpacity ?? THIRD_PERSON_CAMERA_DEFAULTS.minTransparencyOpacity;

  if (input.cameraDistance >= fadeStartDistance) {
    return 1;
  }

  if (input.cameraDistance <= fadeEndDistance) {
    return minOpacity;
  }

  const progress =
    (input.cameraDistance - fadeEndDistance) / (fadeStartDistance - fadeEndDistance);

  return MathUtils.lerp(minOpacity, 1, progress);
};

const intersectSegmentWithAabb = (
  origin: Vector3,
  target: Vector3,
  bounds: CameraObstacleAabb,
) => {
  const direction = target.clone().sub(origin);
  let tMin = 0;
  let tMax = 1;

  for (const axis of ["x", "y", "z"] as const) {
    const axisDirection = direction[axis];
    const axisOrigin = origin[axis];
    const axisMin = bounds.min[axis];
    const axisMax = bounds.max[axis];

    if (Math.abs(axisDirection) < 1e-6) {
      if (axisOrigin < axisMin || axisOrigin > axisMax) {
        return null;
      }
      continue;
    }

    const inverse = 1 / axisDirection;
    let t1 = (axisMin - axisOrigin) * inverse;
    let t2 = (axisMax - axisOrigin) * inverse;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
    }

    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);

    if (tMin > tMax) {
      return null;
    }
  }

  return {
    near: tMin,
    far: tMax,
  };
};

export const resolveSpringArmDistance = (input: {
  focusTarget: Vector3;
  desiredCameraPosition: Vector3;
  roomBounds: CameraObstacleAabb;
  obstacles: CameraObstacleAabb[];
  minDistance?: number;
  padding?: number;
}) => {
  const desiredDistance = input.focusTarget.distanceTo(input.desiredCameraPosition);
  if (desiredDistance <= 0) {
    return 0;
  }

  const minDistance = input.minDistance ?? THIRD_PERSON_CAMERA_DEFAULTS.minDistance;
  const padding = input.padding ?? THIRD_PERSON_CAMERA_DEFAULTS.collisionPadding;
  let nextDistance = desiredDistance;

  const roomHit = intersectSegmentWithAabb(
    input.focusTarget,
    input.desiredCameraPosition,
    input.roomBounds,
  );
  if (roomHit) {
    nextDistance = Math.min(
      nextDistance,
      Math.max(desiredDistance * roomHit.far - padding, minDistance),
    );
  }

  for (const obstacle of input.obstacles) {
    const hit = intersectSegmentWithAabb(
      input.focusTarget,
      input.desiredCameraPosition,
      obstacle,
    );
    if (!hit) {
      continue;
    }

    nextDistance = Math.min(
      nextDistance,
      Math.max(desiredDistance * hit.near - padding, minDistance),
    );
  }

  return MathUtils.clamp(nextDistance, minDistance, desiredDistance);
};
