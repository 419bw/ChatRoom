import { describe, expect, test } from "vitest";

import {
  resolvePreviewSceneQualityProfile,
  resolveSceneQualityProfile,
} from "./sceneQuality";

describe("sceneQuality", () => {
  test("粗指针或小屏设备会落到移动档", () => {
    const quality = resolveSceneQualityProfile({
      width: 844,
      height: 390,
      devicePixelRatio: 3,
      hardwareConcurrency: 8,
      coarsePointer: true,
    });

    expect(quality.tier).toBe("mobile");
    expect(quality.roomVariant).toBe("mobile");
    expect(quality.shadowMode).toBe("blob");
    expect(quality.dpr).toBeLessThanOrEqual(1.35);
  });

  test("高分辨率桌面设备会进入 desktop-high", () => {
    const quality = resolveSceneQualityProfile({
      width: 1728,
      height: 1117,
      devicePixelRatio: 2,
      hardwareConcurrency: 12,
      coarsePointer: false,
    });

    expect(quality.tier).toBe("desktop-high");
    expect(quality.roomVariant).toBe("desktop");
    expect(quality.shadowMapSize).toBe(2048);
    expect(quality.postprocessing.enabled).toBe(true);
    expect(quality.dynamicResolution.enabled).toBe(true);
  });

  test("预览档会强制关闭重型渲染特性并固定 dpr", () => {
    const previewQuality = resolvePreviewSceneQualityProfile(
      resolveSceneQualityProfile({
        width: 1728,
        height: 1117,
        devicePixelRatio: 2,
        hardwareConcurrency: 12,
        coarsePointer: false,
      }),
    );

    expect(previewQuality.roomVariant).toBe("mobile");
    expect(previewQuality.dpr).toBe(1);
    expect(previewQuality.postprocessing.enabled).toBe(false);
    expect(previewQuality.dynamicResolution.enabled).toBe(false);
  });
});
