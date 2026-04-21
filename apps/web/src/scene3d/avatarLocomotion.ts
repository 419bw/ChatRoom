import { MathUtils } from "three";

export const WALK_START_DISTANCE = 0.03;
export const WALK_STOP_DISTANCE = 0.012;
export const WALK_MIN_SPEED = 0.08;
export const WALK_HOLD_DURATION_SECONDS = 0.22;
export const WALK_ANIMATION_REFERENCE_SPEED = 2;
export const WALK_ANIMATION_MIN_SCALE = 0.95;
export const WALK_ANIMATION_MAX_SCALE = 1.45;
export const MAX_TURN_RATE_RADIANS = Math.PI * 2.4;
export const TURN_SLOWDOWN_START_RADIANS = Math.PI / 7;
export const TURN_SLOWDOWN_FULL_RADIANS = Math.PI / 2;
export const TURN_SLOWDOWN_MIN_FACTOR = 0.38;

type ResolveWalkingStateInput = {
  isWalking: boolean;
  distanceToTarget: number;
  moveSpeed: number;
  timeSinceLastMotion: number;
  startDistance?: number;
  stopDistance?: number;
  minSpeed?: number;
  holdDurationSeconds?: number;
};

export type LocomotionDiagnostics = {
  headingError: number;
  gaitPhase: number;
  moveSpeed: number;
};

export const normalizeAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle));

export const getShortestAngleDelta = (from: number, to: number) =>
  normalizeAngle(to - from);

export const hasActiveLocomotionSignal = (
  distanceToTarget: number,
  moveSpeed: number,
  startDistance = WALK_START_DISTANCE,
  minSpeed = WALK_MIN_SPEED,
) => distanceToTarget >= startDistance || moveSpeed >= minSpeed;

export const resolveWalkingState = ({
  isWalking,
  distanceToTarget,
  moveSpeed,
  timeSinceLastMotion,
  startDistance = WALK_START_DISTANCE,
  stopDistance = WALK_STOP_DISTANCE,
  minSpeed = WALK_MIN_SPEED,
  holdDurationSeconds = WALK_HOLD_DURATION_SECONDS,
}: ResolveWalkingStateInput) => {
  if (hasActiveLocomotionSignal(distanceToTarget, moveSpeed, startDistance, minSpeed)) {
    return true;
  }

  if (!isWalking) {
    return false;
  }

  return (
    distanceToTarget >= stopDistance ||
    timeSinceLastMotion <= holdDurationSeconds
  );
};

export const stepHeadingTowardsTarget = (
  currentHeading: number,
  targetHeading: number,
  deltaSeconds: number,
  maxTurnRateRadians = MAX_TURN_RATE_RADIANS,
) => {
  const headingDelta = getShortestAngleDelta(currentHeading, targetHeading);
  if (deltaSeconds <= 0) {
    return normalizeAngle(currentHeading);
  }

  const maxStep = maxTurnRateRadians * deltaSeconds;
  if (Math.abs(headingDelta) <= maxStep) {
    return normalizeAngle(targetHeading);
  }

  return normalizeAngle(currentHeading + Math.sign(headingDelta) * maxStep);
};

export const resolveTurnSlowdownFactor = (
  headingError: number,
  input: {
    startRadians?: number;
    fullRadians?: number;
    minFactor?: number;
  } = {},
) => {
  const startRadians = input.startRadians ?? TURN_SLOWDOWN_START_RADIANS;
  const fullRadians = input.fullRadians ?? TURN_SLOWDOWN_FULL_RADIANS;
  const minFactor = input.minFactor ?? TURN_SLOWDOWN_MIN_FACTOR;

  if (headingError <= startRadians) {
    return 1;
  }

  if (headingError >= fullRadians) {
    return minFactor;
  }

  const progress = (headingError - startRadians) / (fullRadians - startRadians);
  return MathUtils.lerp(1, minFactor, progress);
};

export const resolveWalkAnimationTimeScale = (
  moveSpeed: number,
  referenceSpeed = WALK_ANIMATION_REFERENCE_SPEED,
  minScale = WALK_ANIMATION_MIN_SCALE,
  maxScale = WALK_ANIMATION_MAX_SCALE,
) =>
  MathUtils.clamp(
    moveSpeed / referenceSpeed,
    minScale,
    maxScale,
  );

export const resolveLocomotionDiagnostics = (input: {
  currentHeading: number;
  targetHeading: number;
  gaitTimeSeconds: number;
  gaitDurationSeconds: number;
  moveSpeed: number;
}): LocomotionDiagnostics => {
  const gaitDurationSeconds = input.gaitDurationSeconds || 1;

  return {
    headingError: Math.abs(
      getShortestAngleDelta(input.currentHeading, input.targetHeading),
    ),
    gaitPhase:
      ((((input.gaitTimeSeconds % gaitDurationSeconds) + gaitDurationSeconds) %
        gaitDurationSeconds) || 0) / gaitDurationSeconds,
    moveSpeed: input.moveSpeed,
  };
};
