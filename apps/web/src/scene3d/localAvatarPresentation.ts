import {
  MOVE_KEYBOARD_STEP,
  resolveRoomCollisionPoint,
  type MoveIntentPayload,
  type Point,
  type UserPresenceState,
} from "@chat/protocol";
import { useEffect, useMemo, useState } from "react";

import {
  networkPointToWorld,
  resolveHeadingFromPositions,
  worldToNetworkPoint,
} from "./worldMapping";
import {
  getShortestAngleDelta,
  normalizeAngle,
} from "./avatarLocomotion";

const HARD_SNAP_DISTANCE = 0.35;
const RECONCILE_BLEND_FACTOR = 2 / 3;
const DISPLAY_BLEND_FACTOR = 0.35;
const HEADING_MIN_DISTANCE = 0.015;
const HEADING_TARGET_MAX_STEP = Math.PI / 3;
const DEFAULT_HEADING = Math.PI;

export type LocalAvatarPresentationState = {
  predictedPosition: Point;
  authoritativePosition: Point;
  targetPosition: Point;
  targetWorldPosition: [number, number, number];
  displayPosition: [number, number, number];
  displayHeading: number;
};

const getWorldDistance = (
  left: [number, number, number],
  right: [number, number, number],
) => {
  const deltaX = left[0] - right[0];
  const deltaZ = left[2] - right[2];
  return Math.hypot(deltaX, deltaZ);
};

export const predictNextPoint = (
  current: Point,
  payload: MoveIntentPayload,
): Point => {
  if (payload.target) {
    return resolveRoomCollisionPoint(payload.target);
  }

  return resolveRoomCollisionPoint({
    x: current.x + (payload.direction?.x ?? 0) * MOVE_KEYBOARD_STEP,
    y: current.y + (payload.direction?.y ?? 0) * MOVE_KEYBOARD_STEP,
  });
};

export const reconcilePredictedWorldPosition = (
  predicted: [number, number, number],
  authoritative: [number, number, number],
  hardSnapDistance = HARD_SNAP_DISTANCE,
  blendFactor = RECONCILE_BLEND_FACTOR,
): [number, number, number] => {
  if (getWorldDistance(predicted, authoritative) > hardSnapDistance) {
    return authoritative;
  }

  return [
    predicted[0] + (authoritative[0] - predicted[0]) * blendFactor,
    authoritative[1],
    predicted[2] + (authoritative[2] - predicted[2]) * blendFactor,
  ];
};

export const resolveHeadingWithThreshold = (
  previous: [number, number, number],
  next: [number, number, number],
  fallback: number,
  minDistance = HEADING_MIN_DISTANCE,
) => {
  const distance = getWorldDistance(previous, next);
  if (distance < minDistance) {
    return fallback;
  }

  return resolveHeadingFromPositions(previous, next, fallback);
};

export const resolveStableHeadingTarget = (
  currentHeading: number,
  nextHeading: number,
  maxStep = HEADING_TARGET_MAX_STEP,
) => {
  const delta = getShortestAngleDelta(currentHeading, nextHeading);
  if (Math.abs(delta) <= maxStep) {
    return normalizeAngle(nextHeading);
  }

  return normalizeAngle(currentHeading + Math.sign(delta) * maxStep);
};

export const createLocalAvatarPresentationState = (
  user: UserPresenceState,
): LocalAvatarPresentationState => {
  const worldPosition = networkPointToWorld(user.position);
  return {
    predictedPosition: user.position,
    authoritativePosition: user.position,
    targetPosition: user.position,
    targetWorldPosition: worldPosition,
    displayPosition: worldPosition,
    displayHeading: DEFAULT_HEADING,
  };
};

export const reconcileLocalAvatarPresentation = (
  previous: LocalAvatarPresentationState,
  authoritativePosition: Point,
): LocalAvatarPresentationState => {
  const authoritativeWorld = networkPointToWorld(authoritativePosition);
  const nextTargetWorld = reconcilePredictedWorldPosition(
    previous.targetWorldPosition,
    authoritativeWorld,
  );
  const nextDisplayPosition = reconcilePredictedWorldPosition(
    previous.displayPosition,
    authoritativeWorld,
    HARD_SNAP_DISTANCE,
    DISPLAY_BLEND_FACTOR,
  );
  const nextPredicted = worldToNetworkPoint({
    x: nextTargetWorld[0],
    z: nextTargetWorld[2],
  });

  return {
    predictedPosition: nextPredicted,
    authoritativePosition,
    targetPosition: nextPredicted,
    targetWorldPosition: nextTargetWorld,
    displayPosition: nextDisplayPosition,
    displayHeading: resolveStableHeadingTarget(
      previous.displayHeading,
      resolveHeadingWithThreshold(
        previous.targetWorldPosition,
        nextTargetWorld,
        previous.displayHeading,
      ),
    ),
  };
};

export const resolveNextPresentationHeading = (
  previous: LocalAvatarPresentationState,
  nextWorld: [number, number, number],
) =>
  resolveStableHeadingTarget(
    previous.displayHeading,
    resolveHeadingWithThreshold(
      previous.targetWorldPosition,
      nextWorld,
      previous.displayHeading,
    ),
  );

export const applyMoveIntentToPresentation = (
  previous: LocalAvatarPresentationState,
  payload: MoveIntentPayload,
): LocalAvatarPresentationState => {
  const nextPoint = predictNextPoint(previous.targetPosition, payload);
  const nextWorld = networkPointToWorld(nextPoint);

  return {
    ...previous,
    predictedPosition: nextPoint,
    targetPosition: nextPoint,
    targetWorldPosition: nextWorld,
    displayHeading: resolveNextPresentationHeading(previous, nextWorld),
  };
};

export const useLocalAvatarPresentation = (
  user: UserPresenceState | null,
) => {
  const initialState = useMemo<LocalAvatarPresentationState | null>(() => {
    if (!user) {
      return null;
    }

    return createLocalAvatarPresentationState(user);
  }, [user]);
  const [presentation, setPresentation] = useState<LocalAvatarPresentationState | null>(
    initialState,
  );

  useEffect(() => {
    if (!user) {
      setPresentation(null);
      return;
    }

    setPresentation((previous) => {
      if (!previous) {
        return createLocalAvatarPresentationState(user);
      }

      return reconcileLocalAvatarPresentation(previous, user.position);
    });
  }, [user]);

  const applyMoveIntent = (payload: MoveIntentPayload) => {
    setPresentation((previous) => {
      if (!previous) {
        return previous;
      }

      return applyMoveIntentToPresentation(previous, payload);
    });
  };

  return {
    presentation,
    applyMoveIntent,
  };
};
