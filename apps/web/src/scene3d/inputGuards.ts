import type { SceneControlMode } from "./sceneControl";

export const MOVEMENT_KEYS = [
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
] as const;

const MOVEMENT_KEY_SET = new Set<string>(MOVEMENT_KEYS);
const EDITABLE_SELECTOR =
  'input, textarea, select, button, [contenteditable=""], [contenteditable="true"]';

const isElement = (value: unknown): value is Element =>
  typeof Element !== "undefined" && value instanceof Element;

export const isEditableElement = (value: unknown) => {
  if (!isElement(value)) {
    return false;
  }

  const element = value as HTMLElement;
  return element.isContentEditable || Boolean(element.closest(EDITABLE_SELECTOR));
};

export const isMovementKey = (key: string) =>
  MOVEMENT_KEY_SET.has(key.toLowerCase());

export const shouldIgnoreMoveKeyboardInput = (input: {
  key: string;
  target: EventTarget | null;
  activeElement?: Element | null;
  controlMode?: SceneControlMode;
}) => {
  if (!isMovementKey(input.key)) {
    return false;
  }

  if ((input.controlMode ?? "look") !== "look") {
    return true;
  }

  return (
    isEditableElement(input.target) ||
    isEditableElement(input.activeElement ?? null)
  );
};

export const shouldClearMoveKeysForActiveElement = (
  activeElement: Element | null | undefined,
  controlMode: SceneControlMode = "look",
) => controlMode !== "look" || isEditableElement(activeElement ?? null);

export const resolveMoveDirectionFromPressedKeys = (
  pressedKeys: ReadonlySet<string>,
  activeElement: Element | null | undefined,
  controlMode: SceneControlMode = "look",
) => {
  if (shouldClearMoveKeysForActiveElement(activeElement, controlMode)) {
    return null;
  }

  const x =
    Number(pressedKeys.has("d") || pressedKeys.has("arrowright")) -
    Number(pressedKeys.has("a") || pressedKeys.has("arrowleft"));
  const y =
    Number(pressedKeys.has("s") || pressedKeys.has("arrowdown")) -
    Number(pressedKeys.has("w") || pressedKeys.has("arrowup"));

  if (!x && !y) {
    return null;
  }

  const length = Math.hypot(x, y) || 1;
  return {
    x: x / length,
    y: y / length,
  };
};
