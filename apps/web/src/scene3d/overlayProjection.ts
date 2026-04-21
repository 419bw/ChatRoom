type ProjectedAnchor = {
  x: number;
  y: number;
  z: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

type OverlayState = {
  visible: boolean;
  x: number;
  y: number;
};

export type StabilizedOverlayState = OverlayState & {
  visibleFrames: number;
  hiddenFrames: number;
};

const VIEWPORT_TOLERANCE = 0.05;
const SCREEN_CLAMP_PADDING = 24;
const DEFAULT_HIDE_HYSTERESIS_FRAMES = 2;
const DEFAULT_SHOW_HYSTERESIS_FRAMES = 1;
const DEFAULT_COMMIT_EPSILON = 0.01;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const isFiniteProjectedAnchor = (projected: ProjectedAnchor) =>
  Number.isFinite(projected.x) &&
  Number.isFinite(projected.y) &&
  Number.isFinite(projected.z);

export const projectAnchorToScreen = (
  projected: ProjectedAnchor,
  viewport: ViewportSize,
  clampPadding = SCREEN_CLAMP_PADDING,
) => ({
  x: clamp(
    (projected.x * 0.5 + 0.5) * viewport.width,
    clampPadding,
    viewport.width - clampPadding,
  ),
  y: clamp(
    (-projected.y * 0.5 + 0.5) * viewport.height,
    clampPadding,
    viewport.height - clampPadding,
  ),
});

export const isProjectedAnchorVisible = (
  projected: ProjectedAnchor,
  tolerance = VIEWPORT_TOLERANCE,
) =>
  isFiniteProjectedAnchor(projected) &&
  projected.z > -1 &&
  projected.z < 1 &&
  Math.abs(projected.x) <= 1 + tolerance &&
  Math.abs(projected.y) <= 1 + tolerance;

export const resolveLabelOverlayState = (input: {
  projected: ProjectedAnchor;
  viewport: ViewportSize;
  distance: number;
  maxDistance: number;
}): OverlayState => {
  const { projected, viewport, distance, maxDistance } = input;
  const screen = projectAnchorToScreen(projected, viewport);
  return {
    visible: isProjectedAnchorVisible(projected) && distance <= maxDistance,
    x: screen.x,
    y: screen.y,
  };
};

export const resolveBubbleOverlayState = (input: {
  projected: ProjectedAnchor;
  viewport: ViewportSize;
  distance: number;
  maxDistance: number;
  hasText: boolean;
  labelVisible: boolean;
}): OverlayState => {
  const { projected, viewport, distance, maxDistance, hasText, labelVisible } = input;
  const screen = projectAnchorToScreen(projected, viewport);
  return {
    visible:
      labelVisible &&
      hasText &&
      isFiniteProjectedAnchor(projected) &&
      distance <= maxDistance,
    x: screen.x,
    y: screen.y,
  };
};

export const stabilizeOverlayState = (
  previous: StabilizedOverlayState | null,
  next: OverlayState,
  input: {
    hideHysteresisFrames?: number;
    showHysteresisFrames?: number;
  } = {},
): StabilizedOverlayState => {
  const hideHysteresisFrames =
    input.hideHysteresisFrames ?? DEFAULT_HIDE_HYSTERESIS_FRAMES;
  const showHysteresisFrames =
    input.showHysteresisFrames ?? DEFAULT_SHOW_HYSTERESIS_FRAMES;

  if (!previous) {
    return {
      ...next,
      visibleFrames: next.visible ? 1 : 0,
      hiddenFrames: next.visible ? 0 : 1,
    };
  }

  const visibleFrames = next.visible ? previous.visibleFrames + 1 : 0;
  const hiddenFrames = next.visible ? 0 : previous.hiddenFrames + 1;
  const shouldStayVisible =
    previous.visible && hiddenFrames < hideHysteresisFrames;
  const shouldBecomeVisible = next.visible && visibleFrames >= showHysteresisFrames;

  return {
    visible: shouldStayVisible || shouldBecomeVisible,
    x: next.x,
    y: next.y,
    visibleFrames,
    hiddenFrames,
  };
};

export const shouldCommitOverlayState = (
  previous: OverlayState | null,
  next: OverlayState,
  epsilon = DEFAULT_COMMIT_EPSILON,
) => {
  if (!previous) {
    return true;
  }

  if (previous.visible !== next.visible) {
    return true;
  }

  if (!next.visible) {
    return false;
  }

  return (
    Math.abs(previous.x - next.x) >= epsilon ||
    Math.abs(previous.y - next.y) >= epsilon
  );
};

export const resolveOverlayTransform = (state: OverlayState) =>
  state.visible
    ? `translate3d(${state.x}px, ${state.y}px, 0) translate(-50%, -50%)`
    : "translate3d(-9999px, -9999px, 0)";
