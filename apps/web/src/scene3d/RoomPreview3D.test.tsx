import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

const previewMockState = vi.hoisted(() => ({
  canvasQuality: null as unknown,
  sceneQuality: null as unknown,
}));

vi.mock("./RoomScene3D", () => ({
  RoomCanvas3D: ({
    children,
    quality,
  }: {
    children: ReactNode;
    quality: unknown;
  }) => {
    previewMockState.canvasQuality = quality;
    return <div data-testid="preview-canvas">{children}</div>;
  },
  RoomScene3D: ({ quality }: { quality: unknown }) => {
    previewMockState.sceneQuality = quality;
    return <div data-testid="preview-scene">preview-scene</div>;
  },
}));

vi.mock("./sceneQuality", () => ({
  getClientSceneQualityProfile: () => ({
    tier: "desktop",
    dpr: 1,
    coarsePointer: false,
    maxDpr: 2,
    antialias: true,
    shadows: true,
    shadowMode: "directional",
    shadowMapSize: 1536,
    roomVariant: "desktop",
    postprocessing: {
      enabled: true,
      antialiasPass: "fxaa",
      bloomIntensity: 0.18,
      vignette: true,
    },
    dynamicResolution: {
      enabled: true,
      minDpr: 1.1,
      adjustStep: 0.1,
      settleFrames: 28,
      targetFrameMs: 18.5,
    },
    labelMaxDistance: 22,
    bubbleMaxDistance: 16,
  }),
  resolvePreviewSceneQualityProfile: (baseQuality: Record<string, unknown>) => ({
    ...baseQuality,
    dpr: 1,
    roomVariant: "mobile",
    postprocessing: {
      enabled: false,
      antialiasPass: "none",
      bloomIntensity: 0,
      vignette: false,
    },
    dynamicResolution: {
      ...(baseQuality.dynamicResolution as Record<string, unknown>),
      enabled: false,
    },
  }),
}));

import { RoomPreview3D } from "./RoomPreview3D";

afterEach(() => {
  cleanup();
});

describe("RoomPreview3D", () => {
  test("无用户和输入时也能挂载并显示轻量预览画布", () => {
    const { container } = render(<RoomPreview3D />);

    expect(container.querySelector('.room-viewport[data-scene-mode="preview"]')).toBeTruthy();
    expect(container.querySelector('.room-viewport[data-scene-ready="true"]')).toBeTruthy();
    expect(screen.getByTestId("preview-canvas")).toBeTruthy();
    expect(previewMockState.canvasQuality).toMatchObject({
      roomVariant: "mobile",
      dpr: 1,
      postprocessing: {
        enabled: false,
        bloomIntensity: 0,
        vignette: false,
      },
      dynamicResolution: {
        enabled: false,
      },
    });
    expect(previewMockState.sceneQuality).toMatchObject({
      roomVariant: "mobile",
      dpr: 1,
    });
  });
});
