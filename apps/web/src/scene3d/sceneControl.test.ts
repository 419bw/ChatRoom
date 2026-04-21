import { describe, expect, test } from "vitest";

import {
  isViewportChatMode,
  isViewportLookMode,
  isViewportReenterMode,
  resolveSceneControlMode,
} from "./sceneControl";

describe("sceneControl", () => {
  test("viewport mode 会映射到兼容的 control mode", () => {
    expect(resolveSceneControlMode("ui")).toBe("ui");
    expect(resolveSceneControlMode("look")).toBe("look");
    expect(resolveSceneControlMode("chat")).toBe("ui");
    expect(resolveSceneControlMode("reenter")).toBe("ui");
  });

  test("模式辅助函数能识别聊天、视角与重入状态", () => {
    expect(isViewportChatMode("chat")).toBe(true);
    expect(isViewportLookMode("look")).toBe(true);
    expect(isViewportReenterMode("reenter")).toBe(true);
    expect(isViewportLookMode("ui")).toBe(false);
  });
});
