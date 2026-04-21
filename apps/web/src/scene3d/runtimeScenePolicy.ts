import { ROOM_NETWORK_CENTER, type Point, type UserPresenceState } from "@chat/protocol";

import type { SceneQualityProfile } from "./sceneQuality";

export type RuntimeLoadTier = "normal" | "crowded" | "overflow-observe";

export type RuntimeActorFidelity = "full" | "reduced" | "proxy";

export type RuntimeOverlayPriority = "self" | "speaker" | "nearby" | "ambient";

export type RuntimeScenePolicy = {
  loadTier: RuntimeLoadTier;
  maxHighFidelityRemoteActors: number;
  maxReducedRemoteActors: number;
  allowRemoteShadows: boolean;
  allowPostprocessing: boolean;
  allowBloom: boolean;
  allowVignette: boolean;
  dynamicResolutionMinDpr: number;
  dynamicResolutionMaxDpr: number;
  liveOverlayIntervalSeconds: number;
  ambientOverlayIntervalSeconds: number;
  maxNearbyLabels: number;
  maxAmbientLabels: number;
};

type OverlayPriorityInput = {
  users: UserPresenceState[];
  selfUserId: string | null;
  speakingUserIds?: Iterable<string>;
  policy: RuntimeScenePolicy;
};

type ActorFidelityInput = {
  users: UserPresenceState[];
  selfUserId: string | null;
  speakingUserIds?: Iterable<string>;
  policy: RuntimeScenePolicy;
};

const distanceToFocalPoint = (point: Point, focalPoint: Point) =>
  Math.hypot(point.x - focalPoint.x, point.y - focalPoint.y);

const fallbackFocalPoint: Point = {
  x: ROOM_NETWORK_CENTER.x,
  y: ROOM_NETWORK_CENTER.y,
};

const getFocalPoint = (
  users: UserPresenceState[],
  selfUserId: string | null,
): Point =>
  users.find((user) => user.userId === selfUserId)?.position ?? fallbackFocalPoint;

const rankRemoteUsers = (
  users: UserPresenceState[],
  selfUserId: string | null,
  speakingUserIds: Set<string>,
) => {
  const focalPoint = getFocalPoint(users, selfUserId);

  return users
    .filter((user) => user.userId !== selfUserId)
    .slice()
    .sort((left, right) => {
      const leftSpeaking = speakingUserIds.has(left.userId);
      const rightSpeaking = speakingUserIds.has(right.userId);
      if (leftSpeaking !== rightSpeaking) {
        return leftSpeaking ? -1 : 1;
      }

      const distanceDelta =
        distanceToFocalPoint(left.position, focalPoint) -
        distanceToFocalPoint(right.position, focalPoint);
      if (Math.abs(distanceDelta) > 0.001) {
        return distanceDelta;
      }

      if (left.lastActiveAt !== right.lastActiveAt) {
        return right.lastActiveAt - left.lastActiveAt;
      }

      return left.userId.localeCompare(right.userId);
    });
};

export const resolveRuntimeLoadTier = (participantCount: number): RuntimeLoadTier => {
  if (participantCount <= 4) {
    return "normal";
  }

  if (participantCount <= 8) {
    return "crowded";
  }

  return "overflow-observe";
};

export const resolveRuntimeScenePolicy = (input: {
  participantCount: number;
  quality: SceneQualityProfile;
}): RuntimeScenePolicy => {
  const loadTier = resolveRuntimeLoadTier(input.participantCount);
  const normalDynamicResolutionMinDpr = input.quality.dynamicResolution.minDpr;
  const normalDynamicResolutionMaxDpr = input.quality.dpr;

  if (loadTier === "normal") {
    return {
      loadTier,
      maxHighFidelityRemoteActors: Number.POSITIVE_INFINITY,
      maxReducedRemoteActors: 0,
      allowRemoteShadows: true,
      allowPostprocessing: true,
      allowBloom: true,
      allowVignette: true,
      dynamicResolutionMinDpr: normalDynamicResolutionMinDpr,
      dynamicResolutionMaxDpr: normalDynamicResolutionMaxDpr,
      liveOverlayIntervalSeconds: 1 / 30,
      ambientOverlayIntervalSeconds: 1 / 18,
      maxNearbyLabels: Number.POSITIVE_INFINITY,
      maxAmbientLabels: Number.POSITIVE_INFINITY,
    };
  }

  if (loadTier === "crowded") {
    const crowdedDynamicResolutionMaxDpr = Math.min(
      normalDynamicResolutionMaxDpr,
      input.quality.tier === "desktop-high" ? 0.84 : 0.78,
    );
    return {
      loadTier,
      maxHighFidelityRemoteActors: input.quality.tier === "desktop-high" ? 3 : 2,
      maxReducedRemoteActors: 1,
      allowRemoteShadows: false,
      allowPostprocessing: false,
      allowBloom: false,
      allowVignette: false,
      dynamicResolutionMinDpr: Math.min(crowdedDynamicResolutionMaxDpr, 0.64),
      dynamicResolutionMaxDpr: crowdedDynamicResolutionMaxDpr,
      liveOverlayIntervalSeconds: 1 / 16,
      ambientOverlayIntervalSeconds: 1 / 5,
      maxNearbyLabels: 1,
      maxAmbientLabels: 0,
    };
  }

  const overflowDynamicResolutionMaxDpr = Math.min(
    normalDynamicResolutionMaxDpr,
    0.82,
  );
  return {
    loadTier,
    maxHighFidelityRemoteActors: 1,
    maxReducedRemoteActors: 1,
    allowRemoteShadows: false,
    allowPostprocessing: false,
    allowBloom: false,
    allowVignette: false,
    dynamicResolutionMinDpr: Math.min(overflowDynamicResolutionMaxDpr, 0.65),
    dynamicResolutionMaxDpr: overflowDynamicResolutionMaxDpr,
    liveOverlayIntervalSeconds: 1 / 12,
    ambientOverlayIntervalSeconds: 1 / 4,
    maxNearbyLabels: 1,
    maxAmbientLabels: 0,
  };
};

export const resolveRuntimeOverlayPriorities = (
  input: OverlayPriorityInput,
): Map<string, RuntimeOverlayPriority> => {
  const speakingUserIds = new Set(input.speakingUserIds ?? []);
  const priorities = new Map<string, RuntimeOverlayPriority>();
  const rankedRemoteUsers = rankRemoteUsers(
    input.users,
    input.selfUserId,
    speakingUserIds,
  );

  if (input.selfUserId) {
    priorities.set(input.selfUserId, "self");
  }

  for (const user of rankedRemoteUsers) {
    if (speakingUserIds.has(user.userId)) {
      priorities.set(user.userId, "speaker");
    }
  }

  let nearbyCount = 0;
  for (const user of rankedRemoteUsers) {
    if (priorities.has(user.userId)) {
      continue;
    }

    if (nearbyCount >= input.policy.maxNearbyLabels) {
      break;
    }

    priorities.set(user.userId, "nearby");
    nearbyCount += 1;
  }

  let ambientCount = 0;
  for (const user of rankedRemoteUsers) {
    if (priorities.has(user.userId)) {
      continue;
    }

    if (ambientCount >= input.policy.maxAmbientLabels) {
      break;
    }

    priorities.set(user.userId, "ambient");
    ambientCount += 1;
  }

  return priorities;
};

export const resolveRuntimeActorFidelity = (
  input: ActorFidelityInput,
): Map<string, RuntimeActorFidelity> => {
  const speakingUserIds = new Set(input.speakingUserIds ?? []);
  const fidelityMap = new Map<string, RuntimeActorFidelity>();
  const rankedRemoteUsers = rankRemoteUsers(
    input.users,
    input.selfUserId,
    speakingUserIds,
  );

  if (input.selfUserId) {
    fidelityMap.set(input.selfUserId, "full");
  }

  let highFidelityCount = 0;
  let reducedCount = 0;
  for (const user of rankedRemoteUsers) {
    if (highFidelityCount < input.policy.maxHighFidelityRemoteActors) {
      fidelityMap.set(user.userId, "full");
      highFidelityCount += 1;
      continue;
    }

    if (reducedCount < input.policy.maxReducedRemoteActors) {
      fidelityMap.set(user.userId, "reduced");
      reducedCount += 1;
      continue;
    }

    fidelityMap.set(user.userId, "proxy");
  }

  return fidelityMap;
};
