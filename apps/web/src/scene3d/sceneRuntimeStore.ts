import { useSyncExternalStore } from "react";

import type { LocomotionDiagnostics } from "./avatarLocomotion";
import type { ReticleOffset } from "./cameraMath";
import type { ViewportCameraControlState } from "./viewportLookControls";

export type LocalMotionState = "idle" | "walking";

export type SceneRuntimeSnapshot = {
  camera: ViewportCameraControlState;
  reticle: {
    target: ReticleOffset;
    display: ReticleOffset;
  };
  pointer: {
    isLocked: boolean;
    promptVisible: boolean;
    isDragLookActive: boolean;
  };
  localMotion: LocalMotionState;
  localDiagnostics: LocomotionDiagnostics;
  visibleOverlayUserIds: string[];
};

const initialSnapshot: SceneRuntimeSnapshot = {
  camera: {
    targetYaw: 0.56,
    targetPitch: 0.42,
    displayYaw: 0.56,
    displayPitch: 0.42,
    distance: 3.3,
  },
  reticle: {
    target: { x: 0, y: 0 },
    display: { x: 0, y: 0 },
  },
  pointer: {
    isLocked: false,
    promptVisible: false,
    isDragLookActive: false,
  },
  localMotion: "idle",
  localDiagnostics: {
    headingError: 0,
    gaitPhase: 0,
    moveSpeed: 0,
  },
  visibleOverlayUserIds: [],
};

export class SceneRuntimeStore {
  private snapshot: SceneRuntimeSnapshot = initialSnapshot;
  private readonly listeners = new Set<() => void>();

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  reset() {
    this.snapshot = initialSnapshot;
    this.emit();
  }

  patch(partial: Partial<SceneRuntimeSnapshot>) {
    this.snapshot = {
      ...this.snapshot,
      ...partial,
    };
    this.emit();
  }

  setCamera(camera: ViewportCameraControlState) {
    this.snapshot = {
      ...this.snapshot,
      camera,
    };
    this.emit();
  }

  setReticle(reticle: SceneRuntimeSnapshot["reticle"]) {
    this.snapshot = {
      ...this.snapshot,
      reticle,
    };
    this.emit();
  }

  setPointer(pointer: Partial<SceneRuntimeSnapshot["pointer"]>) {
    this.snapshot = {
      ...this.snapshot,
      pointer: {
        ...this.snapshot.pointer,
        ...pointer,
      },
    };
    this.emit();
  }

  setLocalMotion(localMotion: LocalMotionState) {
    if (this.snapshot.localMotion === localMotion) {
      return;
    }

    this.snapshot = {
      ...this.snapshot,
      localMotion,
    };
    this.emit();
  }

  setLocalDiagnostics(localDiagnostics: LocomotionDiagnostics) {
    this.snapshot = {
      ...this.snapshot,
      localDiagnostics,
    };
    this.emit();
  }

  setVisibleOverlayUserIds(visibleOverlayUserIds: string[]) {
    this.snapshot = {
      ...this.snapshot,
      visibleOverlayUserIds,
    };
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const useSceneRuntimeStoreSelector = <Selected,>(
  store: SceneRuntimeStore,
  selector: (snapshot: SceneRuntimeSnapshot) => Selected,
) => useSyncExternalStore(store.subscribe, () => selector(store.getSnapshot()));
