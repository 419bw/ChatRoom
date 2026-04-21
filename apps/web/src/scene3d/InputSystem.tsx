import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
} from "react";

import {
  applyLookDeltaToCamera,
  freezeLookCameraState,
  shouldHandlePointerLockedLookInput,
} from "./viewportLookControls";
import type { CameraControlState, ReticleControlState } from "./viewportRuntimeTypes";
import type { SceneRuntimeStore } from "./sceneRuntimeStore";
import {
  blurActiveElement,
  cancelDeferredPointerLockRequest,
  cancelViewportInputHandoff,
  focusViewportRoot,
  scheduleDeferredPointerLockRequest,
  scheduleViewportInputHandoff,
  type DeferredPointerLockHandle,
  type ViewportInputHandoffHandle,
} from "./viewportDom";
import {
  type ViewportMode,
  isViewportChatMode,
  isViewportLookMode,
} from "./sceneControl";

const shouldUsePointerLock = () =>
  typeof navigator !== "undefined" && !navigator.webdriver;

export const useViewportInputSystem = ({
  viewportMode,
  onViewportModeChange,
  viewportRef,
  imeSinkRef,
  focusSinkRef,
  cameraControlRef,
  reticleControlRef,
  runtimeStore,
}: {
  viewportMode: ViewportMode;
  onViewportModeChange: (mode: ViewportMode) => void;
  viewportRef: MutableRefObject<HTMLDivElement | null>;
  imeSinkRef: MutableRefObject<HTMLInputElement | null>;
  focusSinkRef: MutableRefObject<HTMLButtonElement | null>;
  cameraControlRef: MutableRefObject<CameraControlState>;
  reticleControlRef: MutableRefObject<ReticleControlState>;
  runtimeStore: SceneRuntimeStore;
}) => {
  const viewportModeRef = useRef(viewportMode);
  const pendingPointerLockRef = useRef(false);
  const dragLookActiveRef = useRef(false);
  const lastDragPointRef = useRef<{ x: number; y: number } | null>(null);
  const inputHandoffHandleRef = useRef<ViewportInputHandoffHandle>(null);
  const deferredPointerLockHandleRef = useRef<DeferredPointerLockHandle | null>(null);

  useEffect(() => {
    viewportModeRef.current = viewportMode;
  }, [viewportMode]);

  const commitViewportMode = useCallback(
    (nextMode: ViewportMode) => {
      viewportModeRef.current = nextMode;
      onViewportModeChange(nextMode);
    },
    [onViewportModeChange],
  );

  useEffect(() => {
    if (isViewportLookMode(viewportMode)) {
      return;
    }

    dragLookActiveRef.current = false;
    lastDragPointRef.current = null;
    cameraControlRef.current = freezeLookCameraState(cameraControlRef.current);
    reticleControlRef.current.target = { x: 0, y: 0 };
    runtimeStore.setPointer({
      isLocked: false,
      isDragLookActive: false,
    });
  }, [cameraControlRef, reticleControlRef, runtimeStore, viewportMode]);

  const fallbackToDragLook = useCallback(() => {
    pendingPointerLockRef.current = false;
    blurActiveElement();
    commitViewportMode("look");
    runtimeStore.setPointer({
      isLocked: false,
      promptVisible: false,
      isDragLookActive: false,
    });
    void focusViewportRoot(viewportRef.current);
    return true;
  }, [commitViewportMode, runtimeStore, viewportRef]);

  const enterLookMode = useCallback(() => {
    if (!viewportRef.current) {
      return false;
    }

    runtimeStore.setPointer({
      promptVisible: false,
    });

    if (
      shouldUsePointerLock() &&
      typeof viewportRef.current.requestPointerLock === "function"
    ) {
      pendingPointerLockRef.current = true;
      commitViewportMode("reenter");
      try {
        const result = viewportRef.current.requestPointerLock();
        if (result && typeof result === "object" && "catch" in result) {
          void result.catch(() => {
            void fallbackToDragLook();
          });
        }
        return true;
      } catch {
        return fallbackToDragLook();
      }
    }

    return fallbackToDragLook();
  }, [commitViewportMode, fallbackToDragLook, runtimeStore, viewportRef]);

  const beginViewportLookReentry = useCallback(() => {
    cancelViewportInputHandoff(inputHandoffHandleRef.current);
    cancelDeferredPointerLockRequest(deferredPointerLockHandleRef.current);
    commitViewportMode("reenter");
    runtimeStore.setPointer({
      promptVisible: false,
    });
    inputHandoffHandleRef.current = scheduleViewportInputHandoff({
      imeSink: imeSinkRef.current,
      focusSink: focusSinkRef.current,
      onAfterRelease: () => {
        inputHandoffHandleRef.current = null;
        deferredPointerLockHandleRef.current = scheduleDeferredPointerLockRequest(() => {
          deferredPointerLockHandleRef.current = null;
          void enterLookMode();
        });
      },
    });
  }, [
    enterLookMode,
    focusSinkRef,
    imeSinkRef,
    commitViewportMode,
    runtimeStore,
  ]);

  useEffect(() => {
    const handlePointerLockChange = () => {
      const isLocked =
        typeof document !== "undefined" &&
        document.pointerLockElement === viewportRef.current;

      if (isLocked) {
        pendingPointerLockRef.current = false;
        dragLookActiveRef.current = false;
        lastDragPointRef.current = null;
        void focusViewportRoot(viewportRef.current);
        commitViewportMode("look");
        runtimeStore.setPointer({
          isLocked: true,
          promptVisible: false,
          isDragLookActive: false,
        });
        return;
      }

      runtimeStore.setPointer({
        isLocked: false,
        isDragLookActive: false,
      });

      if (pendingPointerLockRef.current) {
        void fallbackToDragLook();
        return;
      }

      if (viewportModeRef.current === "look") {
        commitViewportMode("ui");
        runtimeStore.setPointer({
          promptVisible: true,
        });
      }
    };

    const handlePointerLockError = () => {
      void fallbackToDragLook();
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (
        shouldHandlePointerLockedLookInput({
          viewportNode: viewportRef.current,
          sceneControlMode: "look",
          pointerLockElement:
            typeof document === "undefined" ? null : document.pointerLockElement,
          viewportChatOpen: isViewportChatMode(viewportModeRef.current),
        })
      ) {
        const nextState = applyLookDeltaToCamera({
          cameraState: cameraControlRef.current,
          reticleOffset: reticleControlRef.current.target,
          deltaX: event.movementX,
          deltaY: event.movementY,
        });
        cameraControlRef.current = nextState.cameraState;
        reticleControlRef.current.target = nextState.reticleOffset;
        return;
      }

      if (
        !isViewportLookMode(viewportModeRef.current) ||
        dragLookActiveRef.current === false ||
        lastDragPointRef.current === null
      ) {
        return;
      }

      const deltaX = event.clientX - lastDragPointRef.current.x;
      const deltaY = event.clientY - lastDragPointRef.current.y;
      lastDragPointRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      const nextState = applyLookDeltaToCamera({
        cameraState: cameraControlRef.current,
        reticleOffset: reticleControlRef.current.target,
        deltaX,
        deltaY,
      });
      cameraControlRef.current = nextState.cameraState;
      reticleControlRef.current.target = nextState.reticleOffset;
    };

    const handleMouseUp = () => {
      if (!dragLookActiveRef.current) {
        return;
      }
      dragLookActiveRef.current = false;
      lastDragPointRef.current = null;
      runtimeStore.setPointer({
        isDragLookActive: false,
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isViewportLookMode(viewportModeRef.current)) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        commitViewportMode("chat");
        runtimeStore.setPointer({
          promptVisible: false,
          isDragLookActive: false,
        });
        if (document.pointerLockElement === viewportRef.current) {
          document.exitPointerLock?.();
        }
        return;
      }

      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      commitViewportMode("ui");
      runtimeStore.setPointer({
        promptVisible: false,
        isDragLookActive: false,
      });
      if (document.pointerLockElement === viewportRef.current) {
        document.exitPointerLock?.();
      }
    };

    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockError);
    document.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleMouseUp);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("pointerlockerror", handlePointerLockError);
      document.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", handleMouseUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    cameraControlRef,
    fallbackToDragLook,
    commitViewportMode,
    reticleControlRef,
    runtimeStore,
    viewportRef,
  ]);

  useEffect(() => {
    return () => {
      cancelViewportInputHandoff(inputHandoffHandleRef.current);
      cancelDeferredPointerLockRequest(deferredPointerLockHandleRef.current);
    };
  }, []);

  const handleViewportClick = useCallback(() => {
    if (
      !viewportRef.current ||
      isViewportChatMode(viewportModeRef.current) ||
      document.pointerLockElement === viewportRef.current
    ) {
      return;
    }

    void enterLookMode();
  }, [enterLookMode, viewportRef]);

  const handleViewportMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (
        !isViewportLookMode(viewportModeRef.current) ||
        document.pointerLockElement === viewportRef.current
      ) {
        return;
      }

      dragLookActiveRef.current = true;
      lastDragPointRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      runtimeStore.setPointer({
        isDragLookActive: true,
        promptVisible: false,
      });
    },
    [runtimeStore, viewportRef],
  );

  return {
    handleViewportClick,
    handleViewportMouseDown,
    beginViewportLookReentry,
  };
};
