import { describe, expect, test } from "vitest";

import {
  createEnteringBubble,
  markBubbleLeaving,
  markBubbleVisible,
} from "./bubbleLifecycle";

describe("bubbleLifecycle", () => {
  test("气泡会按 entering -> visible -> leaving 顺序推进", () => {
    const enteringBubble = createEnteringBubble({
      id: "msg-1",
      text: "你好",
    } as const);
    const visibleBubble = markBubbleVisible(enteringBubble);
    const leavingBubble = markBubbleLeaving(visibleBubble);

    expect(enteringBubble.phase).toBe("entering");
    expect(visibleBubble.phase).toBe("visible");
    expect(leavingBubble.phase).toBe("leaving");
    expect(leavingBubble.text).toBe("你好");
  });
});
