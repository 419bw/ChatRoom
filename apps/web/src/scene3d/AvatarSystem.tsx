import {
  MOVE_KEYBOARD_INTERVAL_MS,
  ROOM_LAYOUT_CONFIG,
  type MoveIntentPayload,
  type RoomTheme,
} from "@chat/protocol";
import { useFrame } from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Vector3,
} from "three";
import { clone as cloneSkinnedScene } from "three/examples/jsm/utils/SkeletonUtils.js";

import { avatarColorMap, resolveAvatarAsset } from "./assetManifest";
import { syncAvatarSceneMaterials } from "./avatarSceneMaterials";
import {
  type LocomotionDiagnostics,
  getShortestAngleDelta,
  resolveLocomotionDiagnostics,
  resolveTurnSlowdownFactor,
  resolveWalkAnimationTimeScale,
  resolveWalkingState,
  WALK_MIN_SPEED,
  WALK_STOP_DISTANCE,
  stepHeadingTowardsTarget,
} from "./avatarLocomotion";
import { smoothAlpha, resolveLocalAvatarOpacity, resolveCameraRelativeMoveDirection } from "./cameraMath";
import { useSceneGltf } from "./RoomScene3D";
import { getActiveElement } from "./viewportDom";
import {
  isMovementKey,
  resolveMoveDirectionFromPressedKeys,
  shouldClearMoveKeysForActiveElement,
  shouldIgnoreMoveKeyboardInput,
} from "./inputGuards";
import { type ViewportMode } from "./sceneControl";
import { type SceneQualityProfile } from "./sceneQuality";
import { type SceneRuntimeStore } from "./sceneRuntimeStore";
import { type CameraControlState } from "./viewportRuntimeTypes";
import { obstacleToWorld } from "./worldMapping";
import { type RuntimeActorFidelity, type RuntimeScenePolicy } from "./runtimeScenePolicy";
import {
  disposeOwnedStandardMaterials,
  prepareOwnedStandardMaterials,
} from "./ownedStandardMaterials";

const AVATAR_POSITION_DAMPING = 14;
const WALK_FADE_DURATION_SECONDS = 0.18;
const REDUCED_FIDELITY_UPDATE_INTERVAL_SECONDS = 1 / 15;
const PROXY_FIDELITY_UPDATE_INTERVAL_SECONDS = 1 / 6;
const isDocumentVisible = () =>
  typeof document === "undefined" || document.visibilityState === "visible";

const getFidelityUpdateInterval = (fidelity: RuntimeActorFidelity) => {
  if (fidelity === "reduced") {
    return REDUCED_FIDELITY_UPDATE_INTERVAL_SECONDS;
  }

  if (fidelity === "proxy") {
    return PROXY_FIDELITY_UPDATE_INTERVAL_SECONDS;
  }

  return 0;
};

const getFidelityPositionDamping = (fidelity: RuntimeActorFidelity) => {
  if (fidelity === "reduced") {
    return 10;
  }

  if (fidelity === "proxy") {
    return 7;
  }

  return AVATAR_POSITION_DAMPING;
};

const BlobShadow = ({ radius }: { radius: number }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={1}>
    <circleGeometry args={[radius, 28]} />
    <meshBasicMaterial color="#3c2415" transparent opacity={0.24} depthWrite={false} />
  </mesh>
);

const AvatarProxy = ({
  userId,
  cosmetic,
  targetPosition,
  targetHeading,
  avatarAsset,
  onDisplayRefChange,
}: {
  userId: string;
  cosmetic: keyof typeof avatarColorMap;
  targetPosition: [number, number, number];
  targetHeading: number;
  avatarAsset: ReturnType<typeof resolveAvatarAsset>;
  onDisplayRefChange: (userId: string, object: Group | null) => void;
}) => {
  const colors = avatarColorMap[cosmetic];
  const groupRef = useRef<Group>(null);
  const targetRef = useRef(new Vector3(...targetPosition));
  const headingRef = useRef(targetHeading);
  const initializedRef = useRef(false);
  const accumulatedDeltaRef = useRef(0);

  useLayoutEffect(() => {
    if (!groupRef.current) {
      return;
    }

    if (!initializedRef.current) {
      groupRef.current.position.set(...targetPosition);
      initializedRef.current = true;
    }

    targetRef.current.set(...targetPosition);
    headingRef.current = targetHeading;
  }, [targetHeading, targetPosition]);

  useEffect(() => {
    onDisplayRefChange(userId, groupRef.current);
    return () => {
      onDisplayRefChange(userId, null);
    };
  }, [onDisplayRefChange, userId]);

  useFrame((_, delta) => {
    if (!groupRef.current || !isDocumentVisible()) {
      return;
    }

    const clampedDelta = Math.min(delta, 1 / 20);
    accumulatedDeltaRef.current += clampedDelta;
    if (accumulatedDeltaRef.current < PROXY_FIDELITY_UPDATE_INTERVAL_SECONDS) {
      return;
    }

    const fidelityDelta = Math.min(
      accumulatedDeltaRef.current,
      PROXY_FIDELITY_UPDATE_INTERVAL_SECONDS * 2,
    );
    accumulatedDeltaRef.current = 0;
    groupRef.current.position.lerp(
      targetRef.current,
      smoothAlpha(fidelityDelta, getFidelityPositionDamping("proxy")),
    );
    groupRef.current.rotation.y = stepHeadingTowardsTarget(
      groupRef.current.rotation.y,
      headingRef.current,
      fidelityDelta,
    );
  });

  return (
    <group ref={groupRef}>
      <BlobShadow radius={avatarAsset.shadowRadius * 0.82} />
      <group scale={avatarAsset.scale}>
        <mesh position={[0, 0.84, 0]}>
          <boxGeometry args={[0.62, 1.08, 0.42]} />
          <meshStandardMaterial color={colors.body} roughness={0.9} metalness={0.02} />
        </mesh>
        <mesh position={[0, 1.62, 0]}>
          <sphereGeometry args={[0.27, 12, 12]} />
          <meshStandardMaterial color={colors.skin} roughness={0.82} metalness={0.01} />
        </mesh>
        <mesh position={[0, 1.82, -0.02]}>
          <boxGeometry args={[0.34, 0.18, 0.34]} />
          <meshStandardMaterial color={colors.hair} roughness={0.88} metalness={0.02} />
        </mesh>
        <mesh position={[0, 0.98, 0.22]}>
          <boxGeometry args={[0.38, 0.18, 0.08]} />
          <meshStandardMaterial color={colors.accent} roughness={0.72} metalness={0.04} />
        </mesh>
      </group>
    </group>
  );
};

const AvatarModel = ({
  userId,
  cosmetic,
  targetPosition,
  targetHeading,
  fidelity,
  avatarAsset,
  enableShadows,
  viewportMode,
  onDisplayRefChange,
  runtimeStore,
}: {
  userId: string;
  cosmetic: keyof typeof avatarColorMap;
  targetPosition: [number, number, number];
  targetHeading: number;
  fidelity: RuntimeActorFidelity;
  avatarAsset: ReturnType<typeof resolveAvatarAsset>;
  enableShadows: boolean;
  viewportMode: ViewportMode;
  onDisplayRefChange: (userId: string, object: Group | null) => void;
  runtimeStore: SceneRuntimeStore | null;
}) => {
  const gltf = useSceneGltf(avatarAsset.modelUrl);
  const groupRef = useRef<Group>(null);
  const materialRefs = useRef<MeshStandardMaterial[]>([]);
  const targetRef = useRef(new Vector3(...targetPosition));
  const headingRef = useRef(targetHeading);
  const initializedRef = useRef(false);
  const isWalkingRef = useRef(false);
  const lastMotionAtRef = useRef(0);
  const previousPositionRef = useRef(new Vector3(...targetPosition));
  const accumulatedDeltaRef = useRef(0);
  const mixerRef = useRef<AnimationMixer | null>(null);
  const actionRef = useRef<{
    idle: AnimationAction | null;
    walk: AnimationAction | null;
  }>({
    idle: null,
    walk: null,
  });
  const preparedAvatarScene = useMemo(() => {
    const scene = cloneSkinnedScene(gltf.scene) as Group;
    const ownedMaterials = prepareOwnedStandardMaterials(scene);
    return {
      scene,
      ownedMaterials,
    };
  }, [gltf.scene, userId]);

  useEffect(() => {
    materialRefs.current = syncAvatarSceneMaterials({
      root: preparedAvatarScene.scene,
      cosmetic,
      enableShadows,
    });
  }, [cosmetic, enableShadows, preparedAvatarScene]);

  useEffect(() => {
    return () => {
      materialRefs.current = [];
      disposeOwnedStandardMaterials(preparedAvatarScene.ownedMaterials);
    };
  }, [preparedAvatarScene]);

  useEffect(() => {
    const mixer = new AnimationMixer(preparedAvatarScene.scene);
    const idleClip = AnimationClip.findByName(gltf.animations, avatarAsset.idleClip);
    const walkClip = AnimationClip.findByName(gltf.animations, avatarAsset.walkClip);
    const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
    const walkAction = !walkClip ? null : mixer.clipAction(walkClip);

    idleAction?.reset().setEffectiveWeight(1).play();
    walkAction?.reset().setEffectiveWeight(0).play();

    mixerRef.current = mixer;
    actionRef.current = {
      idle: idleAction,
      walk: walkAction,
    };

    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
      actionRef.current = {
        idle: null,
        walk: null,
      };
    };
  }, [
    avatarAsset.idleClip,
    avatarAsset.walkClip,
    fidelity,
    gltf.animations,
    preparedAvatarScene.scene,
  ]);

  useLayoutEffect(() => {
    if (!groupRef.current) {
      return;
    }

    if (!initializedRef.current) {
      groupRef.current.position.set(...targetPosition);
      previousPositionRef.current.copy(groupRef.current.position);
      initializedRef.current = true;
    }

    targetRef.current.set(...targetPosition);
    headingRef.current = targetHeading;
  }, [targetHeading, targetPosition]);

  useEffect(() => {
    onDisplayRefChange(userId, groupRef.current);
    return () => {
      onDisplayRefChange(userId, null);
    };
  }, [onDisplayRefChange, userId]);

  useFrame((state, delta) => {
    if (!groupRef.current || !isDocumentVisible()) {
      return;
    }

    const clampedDelta = Math.min(delta, 1 / 24);
    const updateInterval = getFidelityUpdateInterval(fidelity);
    accumulatedDeltaRef.current += clampedDelta;
    if (updateInterval > 0 && accumulatedDeltaRef.current < updateInterval) {
      return;
    }

    const fidelityDelta =
      updateInterval > 0
        ? Math.min(accumulatedDeltaRef.current, updateInterval * 2)
        : clampedDelta;
    accumulatedDeltaRef.current = 0;
    const group = groupRef.current;
    const headingErrorBeforeStep = Math.abs(
      getShortestAngleDelta(group.rotation.y, headingRef.current),
    );
    const turnSlowdownFactor = resolveTurnSlowdownFactor(headingErrorBeforeStep);
    group.position.lerp(
      targetRef.current,
      smoothAlpha(
        fidelityDelta,
        getFidelityPositionDamping(fidelity) * turnSlowdownFactor,
      ),
    );
    group.rotation.y = stepHeadingTowardsTarget(
      group.rotation.y,
      headingRef.current,
      fidelityDelta,
    );

    const distanceToTarget = group.position.distanceTo(targetRef.current);
    const frameDistance = previousPositionRef.current.distanceTo(group.position);
    const moveSpeed = fidelityDelta > 0 ? frameDistance / fidelityDelta : 0;
    if (distanceToTarget >= WALK_STOP_DISTANCE || moveSpeed >= WALK_MIN_SPEED) {
      lastMotionAtRef.current = state.clock.elapsedTime;
    }

    const shouldWalk =
      resolveWalkingState({
        isWalking: isWalkingRef.current,
        distanceToTarget,
        moveSpeed,
        timeSinceLastMotion: state.clock.elapsedTime - lastMotionAtRef.current,
      });

    if (shouldWalk !== isWalkingRef.current) {
      isWalkingRef.current = shouldWalk;
      const idleAction = actionRef.current.idle;
      const walkAction = actionRef.current.walk;
      if (shouldWalk) {
        idleAction?.fadeOut(WALK_FADE_DURATION_SECONDS);
        walkAction?.reset().setEffectiveWeight(1).fadeIn(WALK_FADE_DURATION_SECONDS).play();
      } else {
        walkAction?.fadeOut(WALK_FADE_DURATION_SECONDS);
        idleAction?.reset().setEffectiveWeight(1).fadeIn(WALK_FADE_DURATION_SECONDS).play();
      }

      if (runtimeStore) {
        runtimeStore.setLocalMotion(shouldWalk ? "walking" : "idle");
      }
    }

    const walkAction = actionRef.current.walk;
    walkAction?.setEffectiveTimeScale(resolveWalkAnimationTimeScale(moveSpeed));
    const diagnostics: LocomotionDiagnostics = resolveLocomotionDiagnostics({
      currentHeading: group.rotation.y,
      targetHeading: headingRef.current,
      gaitTimeSeconds: walkAction?.time ?? 0,
      gaitDurationSeconds: walkAction?.getClip().duration ?? 1,
      moveSpeed,
    });
    previousPositionRef.current.copy(group.position);
    mixerRef.current?.update(fidelityDelta);
    runtimeStore?.setLocalDiagnostics(diagnostics);

    const cameraDistance = state.camera.position.distanceTo(group.position);
    const opacity = resolveLocalAvatarOpacity({
      cameraDistance,
      isLookMode: viewportMode === "look",
      fadeStartDistance: 4.2,
      fadeEndDistance: 2.2,
      minOpacity: 0.1,
    });

    for (const material of materialRefs.current) {
      material.transparent = opacity < 0.999;
      material.opacity = opacity;
      material.depthWrite = opacity >= 0.98;
    }
  });

  return (
    <group ref={groupRef}>
      {!enableShadows ? <BlobShadow radius={avatarAsset.shadowRadius} /> : null}
      <primitive object={preparedAvatarScene.scene} scale={avatarAsset.scale} />
    </group>
  );
};

const KeyboardMover = ({
  enabled,
  viewportMode,
  cameraControlRef,
  onMoveIntent,
}: {
  enabled: boolean;
  viewportMode: ViewportMode;
  cameraControlRef: MutableRefObject<CameraControlState>;
  onMoveIntent: (payload: MoveIntentPayload) => void;
}) => {
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const lastMoveAtRef = useRef(0);
  const controlMode = viewportMode === "look" ? "look" : "ui";

  useEffect(() => {
    const clearPressedKeys = () => {
      if (pressedKeysRef.current.size) {
        pressedKeysRef.current.clear();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = getActiveElement();
      if (
        shouldIgnoreMoveKeyboardInput({
          key: event.key,
          target: event.target,
          activeElement,
          controlMode,
        })
      ) {
        return;
      }

      if (!isMovementKey(event.key)) {
        return;
      }

      event.preventDefault();
      pressedKeysRef.current.add(event.key.toLowerCase());
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!isMovementKey(event.key)) {
        return;
      }

      event.preventDefault();
      pressedKeysRef.current.delete(event.key.toLowerCase());
    };

    const handleBlur = () => {
      clearPressedKeys();
    };
    const handleFocusIn = () => {
      if (shouldClearMoveKeysForActiveElement(getActiveElement(), controlMode)) {
        clearPressedKeys();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [controlMode]);

  useFrame((state) => {
    if (!enabled) {
      pressedKeysRef.current.clear();
      return;
    }

    const activeElement = getActiveElement();
    const direction = resolveMoveDirectionFromPressedKeys(
      pressedKeysRef.current,
      activeElement,
      controlMode,
    );
    if (!direction) {
      return;
    }

    if (state.clock.elapsedTime * 1000 - lastMoveAtRef.current < MOVE_KEYBOARD_INTERVAL_MS) {
      return;
    }

    const moveDirection = resolveCameraRelativeMoveDirection({
      x: direction.x,
      y: direction.y,
      yaw: cameraControlRef.current.displayYaw,
    });
    lastMoveAtRef.current = state.clock.elapsedTime * 1000;
    onMoveIntent({
      direction: moveDirection,
    });
  });

  return null;
};

export const AvatarSystem = ({
  actors,
  roomTheme,
  selfUserId,
  viewportMode,
  quality,
  runtimePolicy,
  cameraControlRef,
  displayGroupMapRef,
  localDisplayRef,
  runtimeStore,
  onMoveIntent,
}: {
  actors: Array<{
    userId: string;
    nickname: string;
    avatar: { cosmetic: keyof typeof avatarColorMap };
    worldPosition: [number, number, number];
    heading: number;
    isLocal: boolean;
    fidelity: RuntimeActorFidelity;
  }>;
  roomTheme: RoomTheme;
  selfUserId: string | null;
  viewportMode: ViewportMode;
  quality: SceneQualityProfile;
  runtimePolicy: RuntimeScenePolicy;
  cameraControlRef: MutableRefObject<CameraControlState>;
  displayGroupMapRef: MutableRefObject<Map<string, Group>>;
  localDisplayRef: MutableRefObject<Object3D | null>;
  runtimeStore: SceneRuntimeStore;
  onMoveIntent: (payload: MoveIntentPayload) => void;
}) => {
  const avatarAsset = resolveAvatarAsset(roomTheme);

  const handleDisplayRefChange = (userId: string, object: Group | null) => {
    if (object) {
      displayGroupMapRef.current.set(userId, object);
    } else {
      displayGroupMapRef.current.delete(userId);
    }

    if (userId === selfUserId) {
      localDisplayRef.current = object;
    }
  };

  return (
    <>
      {ROOM_LAYOUT_CONFIG.obstacles.map((obstacle) => {
        const worldObstacle = obstacleToWorld(obstacle);
        return (
          <mesh
            key={obstacle.id}
            position={[
              worldObstacle.center[0],
              worldObstacle.size[1] / 2,
              worldObstacle.center[2],
            ]}
            visible={false}
          >
            <boxGeometry args={worldObstacle.size} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        );
      })}
      {actors.map((actor) => (
        <Suspense key={actor.userId} fallback={null}>
          {actor.fidelity === "proxy" ? (
            <AvatarProxy
              userId={actor.userId}
              cosmetic={actor.avatar.cosmetic}
              targetPosition={actor.worldPosition}
              targetHeading={actor.heading}
              avatarAsset={avatarAsset}
              onDisplayRefChange={handleDisplayRefChange}
            />
          ) : (
            <AvatarModel
              userId={actor.userId}
              cosmetic={actor.avatar.cosmetic}
              targetPosition={actor.worldPosition}
              targetHeading={actor.heading}
              fidelity={actor.fidelity}
              avatarAsset={avatarAsset}
              enableShadows={
                quality.shadowMode === "directional" &&
                (actor.isLocal || (runtimePolicy.allowRemoteShadows && actor.fidelity === "full"))
              }
              viewportMode={viewportMode}
              onDisplayRefChange={handleDisplayRefChange}
              runtimeStore={actor.userId === selfUserId ? runtimeStore : null}
            />
          )}
        </Suspense>
      ))}
      <KeyboardMover
        enabled={Boolean(selfUserId)}
        viewportMode={viewportMode}
        cameraControlRef={cameraControlRef}
        onMoveIntent={onMoveIntent}
      />
    </>
  );
};
