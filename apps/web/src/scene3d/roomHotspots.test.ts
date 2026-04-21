import { describe, expect, test } from "vitest";

import {
  getRoomHotspotById,
  resolveNearbyHotspotId,
  shouldAllowHotspotActivation,
} from "./roomHotspots";

describe("roomHotspots", () => {
  test("进入 triggerRadius 会命中热点", () => {
    expect(
      resolveNearbyHotspotId({
        worldPosition: [2.6, 0, -4.65],
        previousHotspotId: null,
      }),
    ).toBe("window-side");
  });

  test("离开 triggerRadius 但仍在 exitRadius 内时不会抖动退出", () => {
    expect(
      resolveNearbyHotspotId({
        worldPosition: [2.65 + 1.45, 0, -4.7],
        previousHotspotId: "window-side",
      }),
    ).toBe("window-side");
  });

  test("超出 exitRadius 后会退出热点", () => {
    const hotspot = getRoomHotspotById("window-side");
    expect(hotspot).toBeTruthy();

    expect(
      resolveNearbyHotspotId({
        worldPosition: [2.65 + (hotspot?.exitRadius ?? 0) + 0.12, 0, -4.7],
        previousHotspotId: "window-side",
      }),
    ).toBeNull();
  });

  test("F 键只会在非聊天、非输入状态且靠近热点时生效", () => {
    expect(
      shouldAllowHotspotActivation({
        key: "f",
        isChatOpen: false,
        isEditableTarget: false,
        hasNearbyHotspot: true,
        hasSelectedHotspot: false,
      }),
    ).toBe(true);

    expect(
      shouldAllowHotspotActivation({
        key: "f",
        isChatOpen: true,
        isEditableTarget: false,
        hasNearbyHotspot: true,
        hasSelectedHotspot: false,
      }),
    ).toBe(false);

    expect(
      shouldAllowHotspotActivation({
        key: "f",
        isChatOpen: false,
        isEditableTarget: true,
        hasNearbyHotspot: true,
        hasSelectedHotspot: false,
      }),
    ).toBe(false);
  });
});
