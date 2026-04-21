import { describe, expect, test } from "vitest";

import {
  isEditableElement,
  resolveMoveDirectionFromPressedKeys,
  shouldClearMoveKeysForActiveElement,
  shouldIgnoreMoveKeyboardInput,
} from "./inputGuards";

describe("inputGuards", () => {
  test("输入控件会被识别为可编辑元素", () => {
    const textarea = document.createElement("textarea");
    const input = document.createElement("input");
    const button = document.createElement("button");
    const contentEditable = document.createElement("div");
    contentEditable.setAttribute("contenteditable", "true");

    expect(isEditableElement(textarea)).toBe(true);
    expect(isEditableElement(input)).toBe(true);
    expect(isEditableElement(button)).toBe(true);
    expect(isEditableElement(contentEditable)).toBe(true);
  });

  test("look 模式聚焦可编辑控件时会忽略移动按键", () => {
    const textarea = document.createElement("textarea");

    expect(
      shouldIgnoreMoveKeyboardInput({
        key: "w",
        target: textarea,
        activeElement: textarea,
        controlMode: "look",
      }),
    ).toBe(true);
  });

  test("ui 模式下无论焦点在哪都不会解析移动方向", () => {
    const stage = document.createElement("div");
    const direction = resolveMoveDirectionFromPressedKeys(
      new Set(["w", "d"]),
      stage,
      "ui",
    );

    expect(direction).toBeNull();
    expect(shouldClearMoveKeysForActiveElement(stage, "ui")).toBe(true);
  });

  test("look 模式失焦后移动能力恢复且方向会归一化", () => {
    const stage = document.createElement("div");
    const direction = resolveMoveDirectionFromPressedKeys(
      new Set(["w", "d"]),
      stage,
      "look",
    );

    expect(direction).toEqual({
      x: expect.closeTo(Math.SQRT1_2, 6),
      y: expect.closeTo(-Math.SQRT1_2, 6),
    });
    expect(shouldClearMoveKeysForActiveElement(stage, "look")).toBe(false);
  });
});
