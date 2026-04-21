import {
  ROOM_LAYOUT_CONFIG,
  type SceneQualityPreset,
} from "@chat/protocol";

export type SceneQualityProfile = SceneQualityPreset & {
  tier: "mobile" | "desktop" | "desktop-high";
  dpr: number;
  coarsePointer: boolean;
};

type DeviceHints = {
  width: number;
  height: number;
  devicePixelRatio: number;
  hardwareConcurrency: number;
  coarsePointer: boolean;
};

const defaultHints: DeviceHints = {
  width: 1280,
  height: 720,
  devicePixelRatio: 1,
  hardwareConcurrency: 8,
  coarsePointer: false,
};

export const resolveSceneQualityProfile = (
  input: Partial<DeviceHints> = {},
): SceneQualityProfile => {
  const hints = {
    ...defaultHints,
    ...input,
  };
  const minViewport = Math.min(hints.width, hints.height);
  const isMobile =
    hints.coarsePointer ||
    minViewport <= 900 ||
    hints.hardwareConcurrency <= 6;
  const shouldUseDesktopHigh =
    !isMobile &&
    minViewport >= 1080 &&
    hints.hardwareConcurrency >= 10 &&
    hints.devicePixelRatio >= 1.5;
  const preset = isMobile
    ? ROOM_LAYOUT_CONFIG.quality.mobile
    : shouldUseDesktopHigh
      ? ROOM_LAYOUT_CONFIG.quality.desktopHigh
      : ROOM_LAYOUT_CONFIG.quality.desktop;
  const tier: SceneQualityProfile["tier"] = isMobile
    ? "mobile"
    : shouldUseDesktopHigh
      ? "desktop-high"
      : "desktop";

  return {
    ...preset,
    tier,
    dpr: Math.min(Math.max(hints.devicePixelRatio, 1), preset.maxDpr),
    coarsePointer: hints.coarsePointer,
  };
};

export const getClientSceneQualityProfile = (): SceneQualityProfile => {
  if (typeof window === "undefined") {
    return resolveSceneQualityProfile();
  }

  const coarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const hardwareConcurrency =
    typeof navigator !== "undefined" && typeof navigator.hardwareConcurrency === "number"
      ? navigator.hardwareConcurrency
      : defaultHints.hardwareConcurrency;

  return resolveSceneQualityProfile({
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    hardwareConcurrency,
    coarsePointer,
  });
};

export const resolvePreviewSceneQualityProfile = (
  baseProfile: SceneQualityProfile = getClientSceneQualityProfile(),
): SceneQualityProfile => ({
  ...baseProfile,
  dpr: 1,
  maxDpr: 1,
  antialias: false,
  shadows: false,
  shadowMode: "off",
  shadowMapSize: 0,
  roomVariant: "mobile",
  postprocessing: {
    enabled: false,
    antialiasPass: "none",
    bloomIntensity: 0,
    vignette: false,
  },
  dynamicResolution: {
    ...baseProfile.dynamicResolution,
    enabled: false,
    minDpr: 1,
    adjustStep: 0,
  },
});
