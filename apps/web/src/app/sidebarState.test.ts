import { describe, expect, test } from "vitest";

import {
  RIGHT_SIDEBAR_STORAGE_KEY,
  defaultCollapsedPanels,
  loadCollapsedPanels,
  normalizeCollapsedPanelsForViewport,
  saveCollapsedPanels,
  toggleCollapsedPanel,
} from "./sidebarState";

describe("sidebarState", () => {
  test("没有历史偏好时默认只展开聊天面板", () => {
    expect(defaultCollapsedPanels).toEqual({
      members: true,
      timeline: true,
      appearance: true,
      chat: false,
    });
  });

  test("可以从 localStorage 恢复折叠状态", () => {
    const storage = {
      getItem: (key: string) =>
        key === RIGHT_SIDEBAR_STORAGE_KEY
          ? JSON.stringify({
              members: true,
              timeline: false,
              appearance: true,
              chat: true,
            })
          : null,
    };

    expect(loadCollapsedPanels(storage)).toEqual({
      members: true,
      timeline: false,
      appearance: true,
      chat: true,
    });
  });

  test("保存折叠状态时会写入固定 key", () => {
    let savedKey = "";
    let savedValue = "";
    const storage = {
      setItem: (key: string, value: string) => {
        savedKey = key;
        savedValue = value;
      },
    };

    saveCollapsedPanels(
      {
        members: false,
        timeline: true,
        appearance: true,
        chat: true,
      },
      storage,
    );

    expect(savedKey).toBe(RIGHT_SIDEBAR_STORAGE_KEY);
    expect(JSON.parse(savedValue)).toEqual({
      members: false,
      timeline: true,
      appearance: true,
      chat: true,
    });
  });

  test("保存侧栏状态写入失败时不会抛出异常", () => {
    expect(() =>
      saveCollapsedPanels(defaultCollapsedPanels, {
        setItem: () => {
          throw new DOMException("denied", "QuotaExceededError");
        },
      }),
    ).not.toThrow();
  });

  test("展开一个面板时会自动收起其余面板", () => {
    expect(
      toggleCollapsedPanel(
        {
          members: false,
          timeline: false,
          appearance: true,
          chat: true,
        },
        "chat",
        true,
      ),
    ).toEqual({
      members: true,
      timeline: true,
      appearance: true,
      chat: false,
    });
  });

  test("桌面端也只保留一个展开面板", () => {
    expect(toggleCollapsedPanel(defaultCollapsedPanels, "members", false)).toEqual({
      members: false,
      timeline: true,
      appearance: true,
      chat: true,
    });
  });

  test("切换视口时会归一化为单面板展开", () => {
    expect(
      normalizeCollapsedPanelsForViewport(
        {
          members: false,
          timeline: false,
          appearance: true,
          chat: false,
        },
        true,
      ),
    ).toEqual({
      members: true,
      timeline: true,
      appearance: true,
      chat: false,
    });
  });
});
