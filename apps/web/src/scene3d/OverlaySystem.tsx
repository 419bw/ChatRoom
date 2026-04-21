import { useFrame } from "@react-three/fiber";
import { useRef, type MutableRefObject } from "react";
import { Vector3, type Group } from "three";

import { type RoomTheme } from "@chat/protocol";
import { resolveAvatarAsset } from "./assetManifest";
import {
  resolveBubbleOverlayState,
  resolveLabelOverlayState,
  shouldCommitOverlayState,
  stabilizeOverlayState,
} from "./overlayProjection";
import { type SceneRuntimeStore } from "./sceneRuntimeStore";
import { applyOverlayNodeState, setViewportOverlayDebugDataset } from "./viewportDom";
import type {
  OverlayAnchor,
  OverlayDomRefs,
  OverlayItem,
} from "./viewportRuntimeTypes";
import { type SceneQualityProfile } from "./sceneQuality";
import { type RuntimeScenePolicy } from "./runtimeScenePolicy";

const OVERLAY_SYNC_INTERVAL_SECONDS = 1 / 30;

const sameOverlayIds = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const OverlaySystem = ({
  items,
  roomTheme,
  quality,
  runtimePolicy,
  selfUserId,
  displayGroupMapRef,
  overlayAnchorRef,
  overlayDomRefsRef,
  viewportRef,
  runtimeStore,
}: {
  items: OverlayItem[];
  roomTheme: RoomTheme;
  quality: SceneQualityProfile;
  runtimePolicy: RuntimeScenePolicy;
  selfUserId: string | null;
  displayGroupMapRef: MutableRefObject<Map<string, Group>>;
  overlayAnchorRef: MutableRefObject<Map<string, OverlayAnchor>>;
  overlayDomRefsRef: MutableRefObject<OverlayDomRefs>;
  viewportRef: MutableRefObject<HTMLDivElement | null>;
  runtimeStore: SceneRuntimeStore;
}) => {
  const avatarAsset = resolveAvatarAsset(roomTheme);
  const labelVectorRef = useRef(new Vector3());
  const bubbleVectorRef = useRef(new Vector3());
  const lastSyncAtRef = useRef(0);
  const itemSyncAtRef = useRef(new Map<string, number>());

  useFrame(({ camera, size, clock }) => {
    if (clock.elapsedTime === 0) {
      return;
    }

    if (clock.elapsedTime - lastSyncAtRef.current < OVERLAY_SYNC_INTERVAL_SECONDS) {
      return;
    }
    lastSyncAtRef.current = clock.elapsedTime;

    const activeIds = new Set<string>();
    const visibleOverlayUserIds: string[] = [];

    for (const item of items) {
      activeIds.add(item.userId);
      const group = displayGroupMapRef.current.get(item.userId);
      const previousAnchor = overlayAnchorRef.current.get(item.userId) ?? null;
      const syncInterval =
        item.priority === "ambient"
          ? runtimePolicy.ambientOverlayIntervalSeconds
          : runtimePolicy.liveOverlayIntervalSeconds;
      const lastItemSyncAt = itemSyncAtRef.current.get(item.userId) ?? 0;
      const shouldSyncItem =
        clock.elapsedTime - lastItemSyncAt >= syncInterval ||
        previousAnchor === null ||
        Boolean(item.bubbleText);

      if (!shouldSyncItem) {
        if (previousAnchor?.label.visible || previousAnchor?.bubble.visible) {
          visibleOverlayUserIds.push(item.userId);
        }

        continue;
      }

      itemSyncAtRef.current.set(item.userId, clock.elapsedTime);

      const labelStateInput = group
        ? resolveLabelOverlayState({
            projected: (() => {
              const labelVector = labelVectorRef.current
                .copy(group.position)
                .setY(group.position.y + avatarAsset.labelHeight)
                .project(camera);
              return {
                x: labelVector.x,
                y: labelVector.y,
                z: labelVector.z,
              };
            })(),
            viewport: size,
            distance: camera.position.distanceTo(group.position),
            maxDistance: quality.labelMaxDistance,
          })
        : {
            visible: false,
            x: previousAnchor?.label.x ?? 0,
            y: previousAnchor?.label.y ?? 0,
          };

      const bubbleStateInput = group
        ? resolveBubbleOverlayState({
            projected: (() => {
              const bubbleVector = bubbleVectorRef.current
                .copy(group.position)
                .setY(group.position.y + avatarAsset.bubbleHeight)
                .project(camera);
              return {
                x: bubbleVector.x,
                y: bubbleVector.y,
                z: bubbleVector.z,
              };
            })(),
            viewport: size,
            distance: camera.position.distanceTo(group.position),
            maxDistance: quality.bubbleMaxDistance,
            hasText: Boolean(item.bubbleText),
            labelVisible: labelStateInput.visible,
          })
        : {
            visible: false,
            x: previousAnchor?.bubble.x ?? 0,
            y: previousAnchor?.bubble.y ?? 0,
          };

      const nextAnchor: OverlayAnchor = {
        label: stabilizeOverlayState(previousAnchor?.label ?? null, labelStateInput),
        bubble: stabilizeOverlayState(previousAnchor?.bubble ?? null, bubbleStateInput),
      };

      overlayAnchorRef.current.set(item.userId, nextAnchor);

      const labelNode = overlayDomRefsRef.current.labelNodes.get(item.userId);
      const bubbleNode = overlayDomRefsRef.current.bubbleNodes.get(item.userId);

      if (
        labelNode &&
        shouldCommitOverlayState(previousAnchor?.label ?? null, nextAnchor.label)
      ) {
        applyOverlayNodeState(labelNode, nextAnchor.label);
      }

      if (
        bubbleNode &&
        shouldCommitOverlayState(previousAnchor?.bubble ?? null, nextAnchor.bubble)
      ) {
        applyOverlayNodeState(bubbleNode, nextAnchor.bubble);
      }

      if (nextAnchor.label.visible || nextAnchor.bubble.visible) {
        visibleOverlayUserIds.push(item.userId);
      }

      if (item.userId === selfUserId) {
        setViewportOverlayDebugDataset(viewportRef.current, "label", nextAnchor.label);
        setViewportOverlayDebugDataset(viewportRef.current, "bubble", nextAnchor.bubble);
      }
    }

    for (const userId of Array.from(overlayAnchorRef.current.keys())) {
      if (!activeIds.has(userId)) {
        overlayAnchorRef.current.delete(userId);
        itemSyncAtRef.current.delete(userId);
      }
    }

    const previousVisibleIds = runtimeStore.getSnapshot().visibleOverlayUserIds;
    if (!sameOverlayIds(previousVisibleIds, visibleOverlayUserIds)) {
      runtimeStore.setVisibleOverlayUserIds(visibleOverlayUserIds);
    }

    if (selfUserId && !activeIds.has(selfUserId) && viewportRef.current) {
      delete viewportRef.current.dataset.localLabelVisible;
      delete viewportRef.current.dataset.localLabelX;
      delete viewportRef.current.dataset.localLabelY;
      delete viewportRef.current.dataset.localBubbleVisible;
      delete viewportRef.current.dataset.localBubbleX;
      delete viewportRef.current.dataset.localBubbleY;
    }
  });

  return null;
};

export const WorldOverlayLayer = ({
  items,
  overlayAnchorRef,
  overlayDomRefsRef,
}: {
  items: OverlayItem[];
  overlayAnchorRef: MutableRefObject<Map<string, OverlayAnchor>>;
  overlayDomRefsRef: MutableRefObject<OverlayDomRefs>;
}) => (
  <div className="world-overlay-layer">
    {items.map((item) => (
      <div key={item.userId}>
        <div
          className="world-anchor"
          ref={(node) => {
            if (!node) {
              overlayDomRefsRef.current.labelNodes.delete(item.userId);
              return;
            }

            overlayDomRefsRef.current.labelNodes.set(item.userId, node);
            const anchor = overlayAnchorRef.current.get(item.userId);
            if (anchor) {
              applyOverlayNodeState(node, anchor.label);
            }
          }}
        >
          {item.statusText ? (
            <div
              className="world-status"
              data-activity-kind={item.statusKind ?? "joined"}
            >
              {item.statusText}
            </div>
          ) : null}
          <div className="world-label">{item.nickname}</div>
        </div>
        {item.bubbleText ? (
          <div
            className="world-anchor"
            ref={(node) => {
              if (!node) {
                overlayDomRefsRef.current.bubbleNodes.delete(item.userId);
                return;
              }

              overlayDomRefsRef.current.bubbleNodes.set(item.userId, node);
              const anchor = overlayAnchorRef.current.get(item.userId);
              if (anchor) {
                applyOverlayNodeState(node, anchor.bubble);
              }
            }}
          >
            <div
              className="world-bubble"
              data-bubble-phase={item.bubblePhase ?? "visible"}
            >
              {item.bubbleText}
            </div>
          </div>
        ) : null}
      </div>
    ))}
  </div>
);
