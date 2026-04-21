import { describe, expect, test } from "vitest";

import { SceneRuntimeStore } from "./sceneRuntimeStore";

describe("SceneRuntimeStore", () => {
  test("高频运行时状态可以按域更新", () => {
    const store = new SceneRuntimeStore();

    store.setPointer({
      isLocked: true,
    });
    store.setVisibleOverlayUserIds(["user-1", "user-2"]);
    store.setLocalMotion("walking");

    const snapshot = store.getSnapshot();
    expect(snapshot.pointer.isLocked).toBe(true);
    expect(snapshot.visibleOverlayUserIds).toEqual(["user-1", "user-2"]);
    expect(snapshot.localMotion).toBe("walking");
  });

  test("reset 会恢复初始状态", () => {
    const store = new SceneRuntimeStore();
    store.setPointer({
      isLocked: true,
      promptVisible: true,
    });

    store.reset();

    const snapshot = store.getSnapshot();
    expect(snapshot.pointer.isLocked).toBe(false);
    expect(snapshot.pointer.promptVisible).toBe(false);
    expect(snapshot.visibleOverlayUserIds).toEqual([]);
  });
});
