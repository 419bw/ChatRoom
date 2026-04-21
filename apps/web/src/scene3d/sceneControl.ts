export type SceneControlMode = "look" | "ui";
export type ViewportMode = "ui" | "look" | "chat" | "reenter";

export const DEFAULT_SCENE_CONTROL_MODE: SceneControlMode = "ui";
export const DEFAULT_VIEWPORT_MODE: ViewportMode = "ui";

export const resolveSceneControlMode = (
  viewportMode: ViewportMode,
): SceneControlMode => (viewportMode === "look" ? "look" : "ui");

export const isViewportChatMode = (viewportMode: ViewportMode) =>
  viewportMode === "chat";

export const isViewportLookMode = (viewportMode: ViewportMode) =>
  viewportMode === "look";

export const isViewportReenterMode = (viewportMode: ViewportMode) =>
  viewportMode === "reenter";
