import {
  BUBBLE_EXIT_MS,
  BUBBLE_VISIBLE_MS,
  createEnteringBubble,
  markBubbleLeaving,
  markBubbleVisible,
  type ActorBubbleState,
  type BubblePhase,
} from "./bubbleLifecycle";
import { preloadSceneAssets, RoomCanvas3D } from "./RoomScene3D";
import { getClientSceneQualityProfile } from "./sceneQuality";
import { ROOM_NETWORK_CENTER, ROOM_THEME, ROOM_WORLD_SCALE, ROOM_WORLD_FLOOR_Y, type ChatMessage, type MoveIntentPayload, type RoomTheme, type UserPresenceState } from "@chat/protocol";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Object3D, Vector3 } from "three";

import { unlockBubbleSound, playBubbleSound } from "./bubbleSound";
import { DEFAULT_VIEWPORT_MODE, type ViewportMode } from "./sceneControl";
import {
  getRecentActivityLabel,
  type RecentActivityByUserId,
} from "../domain/recentActivity";
import { isEditableElement } from "./inputGuards";
import { useLocalAvatarPresentation } from "./localAvatarPresentation";
import {
  getRoomHotspotById,
  isWithinHotspotRadius,
  resolveNearbyHotspotId,
  shouldAllowHotspotActivation,
  type HotspotPresenceState,
  type HotspotSelectionState,
} from "./roomHotspots";
import {
  resolveRuntimeActorFidelity,
  resolveRuntimeOverlayPriorities,
  resolveRuntimeScenePolicy,
} from "./runtimeScenePolicy";
import {
  createWorldActorStates,
  resolveHeadingFromPositions,
} from "./worldMapping";
import {
  blurActiveElement,
  focusViewportRoot,
  focusViewportImeSink,
  focusViewportSink,
  getActiveElement,
  releaseViewportChatTextarea,
  scheduleDeferredPointerLockRequest,
  scheduleViewportInputHandoff,
  setViewportRuntimeDataset,
} from "./viewportDom";
import { ViewportChrome } from "./ViewportChrome";
import { useViewportInputSystem } from "./InputSystem";
import { ViewportRuntimeRoot } from "./ViewportRuntimeRoot";
import { WorldOverlayLayer } from "./OverlaySystem";
import {
  SceneRuntimeStore,
  type LocalMotionState,
} from "./sceneRuntimeStore";
import { type ChatComposerHandle } from "../ui/ChatComposer";
import type {
  ActorRenderState,
  OverlayAnchor,
  OverlayDomRefs,
  OverlayItem,
  ViewportSharedRefs,
} from "./viewportRuntimeTypes";
import { normalizeCameraYaw, THIRD_PERSON_CAMERA_DEFAULTS } from "./cameraMath";

type RoomViewport3DProps = {
  users: UserPresenceState[];
  selfUserId: string | null;
  roomTheme: RoomTheme | null;
  latestChatMessage: ChatMessage | null;
  recentActivityByUserId: RecentActivityByUserId;
  viewportMode: ViewportMode;
  chatValue: string;
  onMoveIntent: (payload: MoveIntentPayload) => void;
  onViewportModeChange: (mode: ViewportMode) => void;
  onChatValueChange: (value: string) => void;
  onViewportChatSend: () => boolean;
};

type BubbleMap = Record<string, ActorBubbleState>;

const isDocumentVisible = () =>
  typeof document === "undefined" || document.visibilityState === "visible";

const useActorBubbles = (latestChatMessage: ChatMessage | null) => {
  const [bubbles, setBubbles] = useState<BubbleMap>({});
  const lifecycleHandlesRef = useRef<
    Map<
      string,
      {
        enterFrame: number | null;
        leavingTimer: number | null;
        removeTimer: number | null;
      }
    >
  >(new Map());

  const clearBubbleLifecycleHandles = useCallback((userId: string) => {
    const handles = lifecycleHandlesRef.current.get(userId);
    if (!handles || typeof window === "undefined") {
      return;
    }

    if (handles.enterFrame !== null) {
      window.cancelAnimationFrame(handles.enterFrame);
    }
    if (handles.leavingTimer !== null) {
      window.clearTimeout(handles.leavingTimer);
    }
    if (handles.removeTimer !== null) {
      window.clearTimeout(handles.removeTimer);
    }

    lifecycleHandlesRef.current.delete(userId);
  }, []);

  useEffect(() => {
    return () => {
      for (const userId of Array.from(lifecycleHandlesRef.current.keys())) {
        clearBubbleLifecycleHandles(userId);
      }
    };
  }, [clearBubbleLifecycleHandles]);

  useEffect(() => {
    if (!latestChatMessage) {
      return;
    }

    clearBubbleLifecycleHandles(latestChatMessage.userId);
    setBubbles((previous) => ({
      ...previous,
      [latestChatMessage.userId]: createEnteringBubble(latestChatMessage),
    }));

    if (typeof window === "undefined") {
      return;
    }

    const handles = {
      enterFrame: null as number | null,
      leavingTimer: null as number | null,
      removeTimer: null as number | null,
    };
    lifecycleHandlesRef.current.set(latestChatMessage.userId, handles);

    handles.enterFrame = window.requestAnimationFrame(() => {
      handles.enterFrame = null;
      setBubbles((previous) => {
        if (previous[latestChatMessage.userId]?.id !== latestChatMessage.id) {
          return previous;
        }

        return {
          ...previous,
          [latestChatMessage.userId]: markBubbleVisible(
            previous[latestChatMessage.userId] as ActorBubbleState,
          ),
        };
      });
      void playBubbleSound();

      handles.leavingTimer = window.setTimeout(() => {
        handles.leavingTimer = null;
        setBubbles((previous) => {
          if (previous[latestChatMessage.userId]?.id !== latestChatMessage.id) {
            return previous;
          }

          return {
            ...previous,
            [latestChatMessage.userId]: markBubbleLeaving(
              previous[latestChatMessage.userId] as ActorBubbleState,
            ),
          };
        });

        handles.removeTimer = window.setTimeout(() => {
          handles.removeTimer = null;
          setBubbles((previous) => {
            if (previous[latestChatMessage.userId]?.id !== latestChatMessage.id) {
              return previous;
            }

            const next = { ...previous };
            delete next[latestChatMessage.userId];
            return next;
          });
          lifecycleHandlesRef.current.delete(latestChatMessage.userId);
        }, BUBBLE_EXIT_MS);
      }, BUBBLE_VISIBLE_MS);
    });

    return () => {
      clearBubbleLifecycleHandles(latestChatMessage.userId);
    };
  }, [clearBubbleLifecycleHandles, latestChatMessage]);

  return bubbles;
};

const RoomViewport3D = ({
  users,
  selfUserId,
  roomTheme,
  latestChatMessage,
  recentActivityByUserId,
  viewportMode,
  chatValue,
  onMoveIntent,
  onViewportModeChange,
  onChatValueChange,
  onViewportChatSend,
}: RoomViewport3DProps) => {
  const initialPitch = 0.28;
  const previousPositionMapRef = useRef(new Map<string, [number, number, number]>());
  const qualityRef = useRef(getClientSceneQualityProfile());
  const runtimeStoreRef = useRef(new SceneRuntimeStore());
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const chatComposerRef = useRef<ChatComposerHandle | null>(null);
  const imeSinkRef = useRef<HTMLInputElement | null>(null);
  const focusSinkRef = useRef<HTMLButtonElement | null>(null);
  const crosshairRef = useRef<HTMLDivElement | null>(null);
  const overlayAnchorRef = useRef(new Map<string, OverlayAnchor>());
  const overlayDomRefsRef = useRef<OverlayDomRefs>({
    labelNodes: new Map<string, HTMLDivElement>(),
    bubbleNodes: new Map<string, HTMLDivElement>(),
  });
  const hotspotLabelRef = useRef<HTMLDivElement | null>(null);
  const displayGroupMapRef = useRef(new Map<string, import("three").Group>());
  const localDisplayRef = useRef<Object3D | null>(null);
  const cameraControlRef = useRef({
    targetYaw: 0.56,
    targetPitch: initialPitch,
    displayYaw: 0.56,
    displayPitch: initialPitch,
    distance: THIRD_PERSON_CAMERA_DEFAULTS.distance,
  });
  const reticleControlRef = useRef({
    target: { x: 0, y: 0 },
    display: { x: 0, y: 0 },
  });
  const hasInitializedCameraRef = useRef(false);
  const [hotspotPresence, setHotspotPresence] = useState<HotspotPresenceState>({
    nearbyHotspotId: null,
  });
  const [hotspotSelection, setHotspotSelection] = useState<HotspotSelectionState>({
    selectedHotspotId: null,
  });
  const bubbleMap = useActorBubbles(latestChatMessage);
  const sceneTheme = roomTheme ?? ROOM_THEME;
  const selfUser = selfUserId ? users.find((user) => user.userId === selfUserId) ?? null : null;
  const { presentation, applyMoveIntent } = useLocalAvatarPresentation(selfUser);
  const speakingUserIds = useMemo(
    () => Object.keys(bubbleMap).filter((userId) => Boolean(bubbleMap[userId])),
    [bubbleMap],
  );
  const runtimePolicy = useMemo(
    () =>
      resolveRuntimeScenePolicy({
        participantCount: users.length,
        quality: qualityRef.current,
      }),
    [users.length],
  );
  const overlayPriorityMap = useMemo(
    () =>
      resolveRuntimeOverlayPriorities({
        users,
        selfUserId,
        speakingUserIds,
        policy: runtimePolicy,
      }),
    [runtimePolicy, selfUserId, speakingUserIds, users],
  );
  const actorFidelityMap = useMemo(
    () =>
      resolveRuntimeActorFidelity({
        users,
        selfUserId,
        speakingUserIds,
        policy: runtimePolicy,
      }),
    [runtimePolicy, selfUserId, speakingUserIds, users],
  );
  const localWorldPosition = useMemo<[number, number, number] | null>(() => {
    if (presentation) {
      return presentation.targetWorldPosition;
    }

    if (!selfUser) {
      return null;
    }

    return [
      (selfUser.position.x - ROOM_NETWORK_CENTER.x) * ROOM_WORLD_SCALE,
      ROOM_WORLD_FLOOR_Y,
      (selfUser.position.y - ROOM_NETWORK_CENTER.y) * ROOM_WORLD_SCALE,
    ];
  }, [presentation, selfUser]);
  const nearbyHotspot = useMemo(
    () => getRoomHotspotById(hotspotPresence.nearbyHotspotId),
    [hotspotPresence.nearbyHotspotId],
  );
  const selectedHotspot = useMemo(
    () => getRoomHotspotById(hotspotSelection.selectedHotspotId),
    [hotspotSelection.selectedHotspotId],
  );
  const activeHotspot = selectedHotspot ?? nearbyHotspot;
  const isHotspotSelected = Boolean(selectedHotspot);

  const actors = useMemo(
    () => createWorldActorStates(users, selfUserId, previousPositionMapRef.current),
    [selfUserId, users],
  );

  const presentedActors = useMemo<ActorRenderState[]>(
    () =>
      actors.map((actor) =>
        actor.isLocal && presentation
          ? {
              ...actor,
              worldPosition: presentation.targetWorldPosition,
              heading: presentation.displayHeading,
              fidelity: actorFidelityMap.get(actor.userId) ?? "full",
            }
          : {
              ...actor,
              fidelity: actorFidelityMap.get(actor.userId) ?? "full",
            }
      ),
    [actorFidelityMap, actors, presentation],
  );

  const overlayItems = useMemo<OverlayItem[]>(
    () =>
      presentedActors
      .map((actor) => {
        const activity = recentActivityByUserId[actor.userId];
        const activityLabel = getRecentActivityLabel(activity);
        const priority = overlayPriorityMap.get(actor.userId) ?? "ambient";

        return {
          userId: actor.userId,
          nickname: actor.nickname,
          bubbleText: bubbleMap[actor.userId]?.text,
          bubblePhase: bubbleMap[actor.userId]?.phase as BubblePhase | undefined,
          priority,
          statusText:
            activityLabel &&
            activity?.kind !== "spoke" &&
            priority !== "ambient"
              ? activityLabel
              : undefined,
          statusKind:
            activity?.kind !== "spoke" && priority !== "ambient"
              ? activity?.kind
              : undefined,
        };
      })
      .filter((item) => overlayPriorityMap.has(item.userId)),
    [bubbleMap, overlayPriorityMap, presentedActors, recentActivityByUserId],
  );

  const sharedRefs: ViewportSharedRefs = {
    viewportRef,
    crosshairRef,
    overlayAnchorRef,
    overlayDomRefsRef,
    displayGroupMapRef,
    localDisplayRef,
    cameraControlRef,
    reticleControlRef,
  };

  useEffect(() => {
    const unsubscribe = runtimeStoreRef.current.subscribe(() => {
      setViewportRuntimeDataset(
        viewportRef.current,
        runtimeStoreRef.current.getSnapshot(),
        viewportMode,
      );
    });

    setViewportRuntimeDataset(
      viewportRef.current,
      runtimeStoreRef.current.getSnapshot(),
      viewportMode,
    );

    return unsubscribe;
  }, [viewportMode]);

  useEffect(() => {
    const activeIds = new Set(users.map((user) => user.userId));
    for (const userId of Array.from(previousPositionMapRef.current.keys())) {
      if (!activeIds.has(userId)) {
        previousPositionMapRef.current.delete(userId);
      }
    }
  }, [users]);

  useEffect(() => {
    setHotspotPresence((previous) => {
      const nearbyHotspotId = resolveNearbyHotspotId({
        worldPosition: localWorldPosition,
        previousHotspotId: previous.nearbyHotspotId,
      });

      if (previous.nearbyHotspotId === nearbyHotspotId) {
        return previous;
      }

      return {
        nearbyHotspotId,
      };
    });
  }, [localWorldPosition]);

  useEffect(() => {
    if (viewportMode === "chat" && hotspotSelection.selectedHotspotId) {
      setHotspotSelection({
        selectedHotspotId: null,
      });
    }
  }, [hotspotSelection.selectedHotspotId, viewportMode]);

  useEffect(() => {
    if (!selectedHotspot || !localWorldPosition) {
      return;
    }

    if (!isWithinHotspotRadius(selectedHotspot, localWorldPosition, selectedHotspot.exitRadius)) {
      if (!hotspotSelection.selectedHotspotId) {
        return;
      }
      setHotspotSelection({
        selectedHotspotId: null,
      });
    }
  }, [hotspotSelection.selectedHotspotId, localWorldPosition, selectedHotspot]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = getActiveElement();
      if (
        shouldAllowHotspotActivation({
          key: event.key,
          isChatOpen: viewportMode === "chat",
          isEditableTarget: isEditableElement(activeElement),
          hasNearbyHotspot: Boolean(nearbyHotspot),
          hasSelectedHotspot: Boolean(hotspotSelection.selectedHotspotId),
        })
      ) {
        event.preventDefault();
        setHotspotSelection({
          selectedHotspotId: nearbyHotspot?.id ?? null,
        });
        return;
      }

      if (event.key !== "Escape" || !hotspotSelection.selectedHotspotId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setHotspotSelection({
        selectedHotspotId: null,
      });
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [hotspotSelection.selectedHotspotId, nearbyHotspot, viewportMode]);

  useEffect(() => {
    if (activeHotspot || !hotspotLabelRef.current) {
      return;
    }

    hotspotLabelRef.current.style.opacity = "0";
    hotspotLabelRef.current.style.transform = "translate3d(-9999px, -9999px, 0)";
  }, [activeHotspot]);

  useEffect(() => {
    if (hasInitializedCameraRef.current || !selfUser) {
      return;
    }

    const loungeTarget = new Vector3(0.85, 0, -2.78);
    const selfWorldPosition = presentation
      ? new Vector3(...presentation.targetWorldPosition)
      : new Vector3(
          (selfUser.position.x - ROOM_NETWORK_CENTER.x) * ROOM_WORLD_SCALE,
          ROOM_WORLD_FLOOR_Y,
          (selfUser.position.y - ROOM_NETWORK_CENTER.y) * ROOM_WORLD_SCALE,
        );
    const initialYaw = normalizeCameraYaw(
      resolveHeadingFromPositions(
        [selfWorldPosition.x, 0, selfWorldPosition.z],
        [loungeTarget.x, 0, loungeTarget.z],
        0,
      ),
    );
    cameraControlRef.current = {
      ...cameraControlRef.current,
      targetYaw: initialYaw,
      displayYaw: initialYaw,
      targetPitch: initialPitch,
      displayPitch: initialPitch,
    };
    runtimeStoreRef.current.setCamera(cameraControlRef.current);
    hasInitializedCameraRef.current = true;
  }, [presentation?.targetWorldPosition, selfUser]);

  const handleMoveIntent = (payload: MoveIntentPayload) => {
    if (selfUserId) {
      applyMoveIntent(payload);
    }
    onMoveIntent(payload);
  };

  const {
    handleViewportClick,
    handleViewportMouseDown,
    beginViewportLookReentry,
  } = useViewportInputSystem({
    viewportMode,
    onViewportModeChange,
    viewportRef,
    imeSinkRef,
    focusSinkRef,
    cameraControlRef,
    reticleControlRef,
    runtimeStore: runtimeStoreRef.current,
  });

  const restoreLookMode = useCallback(() => {
    releaseViewportChatTextarea(chatComposerRef.current);
    blurActiveElement();
    beginViewportLookReentry();
  }, [beginViewportLookReentry]);

  const handleViewportChatSend = useCallback(() => {
    const hasSent = onViewportChatSend();
    if (!hasSent) {
      return false;
    }

    void unlockBubbleSound();
    releaseViewportChatTextarea(chatComposerRef.current);
    blurActiveElement();
    beginViewportLookReentry();
    return true;
  }, [beginViewportLookReentry, onViewportChatSend]);

  const handleViewportChatCancel = useCallback(() => {
    restoreLookMode();
  }, [restoreLookMode]);

  return (
    <div
      ref={viewportRef}
      className="room-viewport"
      tabIndex={-1}
      onClick={handleViewportClick}
      onMouseDown={handleViewportMouseDown}
      data-scene-mode="r3f"
      data-scene-ready="true"
      data-local-motion={"idle" satisfies LocalMotionState}
      data-local-heading-error="0"
      data-local-gait-phase="0"
      data-local-move-speed="0"
      data-camera-yaw={cameraControlRef.current.displayYaw.toFixed(4)}
      data-camera-pitch={cameraControlRef.current.displayPitch.toFixed(4)}
      data-control-mode={viewportMode === "look" ? "look" : "ui"}
      data-pointer-lock="false"
      data-drag-look="false"
      data-reticle-offset-x="0.0000"
      data-reticle-offset-y="0.0000"
      data-viewport-chat-open={viewportMode === "chat" ? "true" : "false"}
      data-viewport-mode={viewportMode}
      data-runtime-load-tier={runtimePolicy.loadTier}
      data-runtime-participant-count={String(users.length)}
      data-hotspot-id={activeHotspot?.id ?? ""}
      data-hotspot-selected={isHotspotSelected ? "true" : "false"}
      data-visible-overlay-count="0"
    >
      <ViewportChrome
        viewportMode={viewportMode}
        runtimeStore={runtimeStoreRef.current}
        chatValue={chatValue}
        imeSinkRef={imeSinkRef}
        focusSinkRef={focusSinkRef}
        crosshairRef={crosshairRef}
        chatComposerRef={chatComposerRef}
        onChatValueChange={onChatValueChange}
        onViewportChatSend={() => {
          void handleViewportChatSend();
        }}
        onViewportChatCancel={handleViewportChatCancel}
      />

      <RoomCanvas3D quality={qualityRef.current} runtimePolicy={runtimePolicy}>
        <ViewportRuntimeRoot
          actors={presentedActors}
          overlayItems={overlayItems}
          roomTheme={sceneTheme}
          selfUserId={selfUserId}
          viewportMode={viewportMode}
          quality={qualityRef.current}
          runtimePolicy={runtimePolicy}
          activeHotspot={activeHotspot}
          isHotspotSelected={isHotspotSelected}
          hotspotLabelRef={hotspotLabelRef}
          sharedRefs={sharedRefs}
          runtimeStore={runtimeStoreRef.current}
          onMoveIntent={handleMoveIntent}
        />
      </RoomCanvas3D>

      <WorldOverlayLayer
        items={overlayItems}
        overlayAnchorRef={overlayAnchorRef}
        overlayDomRefsRef={overlayDomRefsRef}
      />

      <div className="world-anchor world-anchor--hotspot" ref={hotspotLabelRef}>
        {activeHotspot ? (
          <div className="hotspot-world-label" data-hotspot-id={activeHotspot.id}>
            <span className="hotspot-world-label__eyebrow">驻足点</span>
            <strong>{activeHotspot.label}</strong>
          </div>
        ) : null}
      </div>

      {activeHotspot && viewportMode !== "chat" ? (
        <aside
          className="room-viewport__hotspot-card"
          role="status"
          data-hotspot-id={activeHotspot.id}
          data-hotspot-selected={isHotspotSelected ? "true" : "false"}
        >
          <span className="room-viewport__hotspot-eyebrow">
            {isHotspotSelected ? "正在停留" : "空间邀请"}
          </span>
          <strong>{activeHotspot.label}</strong>
          <p>{isHotspotSelected ? activeHotspot.detailText : activeHotspot.hintText}</p>
          <span className="room-viewport__hotspot-hint">
            {isHotspotSelected
              ? "Esc 或离开该区域即可继续移动。"
              : "F 停留 · Enter 仍可直接聊天"}
          </span>
        </aside>
      ) : null}
    </div>
  );
};

export {
  focusViewportRoot,
  focusViewportImeSink,
  focusViewportSink,
  preloadSceneAssets,
  releaseViewportChatTextarea,
  scheduleDeferredPointerLockRequest,
  scheduleViewportInputHandoff,
  RoomViewport3D,
};

export default RoomViewport3D;
