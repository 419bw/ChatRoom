import type { ChatComposerHandle } from "../ui/ChatComposer";
import type { LocomotionDiagnostics } from "./avatarLocomotion";
import type { ReticleOffset } from "./cameraMath";
import type { SceneRuntimeSnapshot } from "./sceneRuntimeStore";
import {
  isViewportChatMode,
  resolveSceneControlMode,
  type ViewportMode,
} from "./sceneControl";
import {
  resolveOverlayTransform,
  type StabilizedOverlayState,
} from "./overlayProjection";

export const getActiveElement = () =>
  typeof document === "undefined" ? null : document.activeElement;

export const blurActiveElement = () => {
  if (typeof document === "undefined") {
    return;
  }

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

export const focusViewportRoot = (viewportNode: HTMLDivElement | null) => {
  if (!viewportNode) {
    return false;
  }

  viewportNode.focus({
    preventScroll: true,
  });
  return true;
};

export const focusViewportSink = (focusSink: HTMLButtonElement | null) => {
  if (!focusSink) {
    return false;
  }

  focusSink.focus({
    preventScroll: true,
  });
  return true;
};

export const focusViewportImeSink = (imeSink: HTMLInputElement | null) => {
  if (!imeSink) {
    return false;
  }

  imeSink.value = "";
  imeSink.focus({
    preventScroll: true,
  });
  try {
    imeSink.setSelectionRange(0, 0);
  } catch {
    // 某些输入法状态下会拒绝设置选区，这里忽略即可。
  }
  return true;
};

export const releaseViewportChatTextarea = (
  chatComposerHandle: ChatComposerHandle | null,
) => {
  if (!chatComposerHandle) {
    return false;
  }

  try {
    return chatComposerHandle.blurAndReset();
  } catch {
    // 某些浏览器或输入法状态下可能拒绝设置选区，这里忽略即可。
  }
  return false;
};

export const scheduleDeferredPointerLockRequest = (callback: () => void) => {
  if (typeof window === "undefined") {
    callback();
    return null;
  }

  return window.requestAnimationFrame(() => {
    callback();
  });
};

export type DeferredPointerLockHandle = number | null;

export const scheduleViewportInputHandoff = (input: {
  imeSink: HTMLInputElement | null;
  focusSink: HTMLButtonElement | null;
  onAfterRelease: () => void;
}) => {
  void focusViewportImeSink(input.imeSink);

  if (typeof window === "undefined") {
    input.imeSink?.blur();
    void focusViewportSink(input.focusSink);
    input.onAfterRelease();
    return null;
  }

  return window.setTimeout(() => {
    input.imeSink?.blur();
    void focusViewportSink(input.focusSink);
    input.onAfterRelease();
  }, 0);
};

export type ViewportInputHandoffHandle = number | null;

export const cancelDeferredPointerLockRequest = (
  handle: DeferredPointerLockHandle,
) => {
  if (handle === null || typeof window === "undefined") {
    return;
  }

  window.cancelAnimationFrame(handle);
};

export const cancelViewportInputHandoff = (
  handle: ViewportInputHandoffHandle,
) => {
  if (handle === null || typeof window === "undefined") {
    return;
  }

  window.clearTimeout(handle);
};

export const applyOverlayNodeState = (
  node: HTMLDivElement,
  nextState: StabilizedOverlayState,
) => {
  node.style.opacity = nextState.visible ? "1" : "0";
  node.style.transform = resolveOverlayTransform(nextState);
};

export const applyCrosshairNodeState = (
  node: HTMLDivElement | null,
  reticleOffset: ReticleOffset,
) => {
  if (!node) {
    return;
  }

  node.style.left = `${50 + reticleOffset.x * 50}%`;
  node.style.top = `${50 + reticleOffset.y * 50}%`;
};

export const setViewportOverlayDebugDataset = (
  viewportNode: HTMLDivElement | null,
  prefix: "label" | "bubble",
  state: StabilizedOverlayState,
) => {
  if (!viewportNode) {
    return;
  }

  const capitalizedPrefix = prefix === "label" ? "Label" : "Bubble";
  viewportNode.dataset[`local${capitalizedPrefix}Visible`] = state.visible
    ? "true"
    : "false";
  viewportNode.dataset[`local${capitalizedPrefix}X`] = state.x.toFixed(2);
  viewportNode.dataset[`local${capitalizedPrefix}Y`] = state.y.toFixed(2);
};

export const setViewportLocomotionDebugDataset = (
  viewportNode: HTMLDivElement | null,
  diagnostics: LocomotionDiagnostics,
) => {
  if (!viewportNode) {
    return;
  }

  viewportNode.dataset.localHeadingError = diagnostics.headingError.toFixed(4);
  viewportNode.dataset.localGaitPhase = diagnostics.gaitPhase.toFixed(4);
  viewportNode.dataset.localMoveSpeed = diagnostics.moveSpeed.toFixed(4);
};

export const setViewportRuntimeDataset = (
  viewportNode: HTMLDivElement | null,
  snapshot: SceneRuntimeSnapshot,
  viewportMode: ViewportMode,
) => {
  if (!viewportNode) {
    return;
  }

  const controlMode = resolveSceneControlMode(viewportMode);
  viewportNode.dataset.cameraYaw = snapshot.camera.displayYaw.toFixed(4);
  viewportNode.dataset.cameraPitch = snapshot.camera.displayPitch.toFixed(4);
  viewportNode.dataset.cameraDistance = snapshot.camera.distance.toFixed(4);
  viewportNode.dataset.controlMode = controlMode;
  viewportNode.dataset.viewportMode = viewportMode;
  viewportNode.dataset.pointerLock = snapshot.pointer.isLocked ? "true" : "false";
  viewportNode.dataset.dragLook = snapshot.pointer.isDragLookActive ? "true" : "false";
  viewportNode.dataset.reticleOffsetX = snapshot.reticle.display.x.toFixed(4);
  viewportNode.dataset.reticleOffsetY = snapshot.reticle.display.y.toFixed(4);
  viewportNode.dataset.localMotion = snapshot.localMotion;
  viewportNode.dataset.localHeadingError = snapshot.localDiagnostics.headingError.toFixed(4);
  viewportNode.dataset.localGaitPhase = snapshot.localDiagnostics.gaitPhase.toFixed(4);
  viewportNode.dataset.localMoveSpeed = snapshot.localDiagnostics.moveSpeed.toFixed(4);
  viewportNode.dataset.viewportChatOpen = isViewportChatMode(viewportMode) ? "true" : "false";
  viewportNode.dataset.visibleOverlayCount = String(snapshot.visibleOverlayUserIds.length);
};
