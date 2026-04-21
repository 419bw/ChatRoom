import { describe, expect, test, vi } from "vitest";

import {
  BUBBLE_SOUND_THROTTLE_MS,
  createBubbleSoundController,
} from "./bubbleSound";

describe("bubbleSound", () => {
  test("节流会阻止极短时间内重复播放", () => {
    const play = vi.fn(() => true);
    let now = 1_000;
    const controller = createBubbleSoundController({
      now: () => now,
      play,
    });

    expect(controller.trigger()).toBe(true);
    expect(controller.trigger()).toBe(false);
    expect(play).toHaveBeenCalledTimes(1);
  });

  test("连续消息超过节流窗口后仍会再次播放", () => {
    const play = vi.fn(() => true);
    let now = 1_000;
    const controller = createBubbleSoundController({
      now: () => now,
      play,
    });

    expect(controller.trigger()).toBe(true);
    now += BUBBLE_SOUND_THROTTLE_MS - 10;
    expect(controller.trigger()).toBe(false);
    now += 20;
    expect(controller.trigger()).toBe(true);
    expect(play).toHaveBeenCalledTimes(2);
  });
});
