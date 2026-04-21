import { safeStorageGetItem, safeStorageSetItem } from "./browserStorage";

export type SidebarPanelKey = "members" | "timeline" | "appearance" | "chat";

export type CollapsedPanels = Record<SidebarPanelKey, boolean>;

export const RIGHT_SIDEBAR_STORAGE_KEY = "ui:right-sidebar:v1";

export const defaultCollapsedPanels: CollapsedPanels = {
  members: true,
  timeline: true,
  appearance: true,
  chat: false,
};

const panelKeys: SidebarPanelKey[] = ["members", "timeline", "appearance", "chat"];

const collapseAllExcept = (panel: SidebarPanelKey): CollapsedPanels => ({
  members: true,
  timeline: true,
  appearance: true,
  chat: true,
  [panel]: false,
});

const isValidCollapsedPanels = (value: unknown): value is CollapsedPanels =>
  Boolean(
    value &&
      typeof value === "object" &&
      panelKeys.every(
        (key) =>
          key in (value as Record<string, unknown>) &&
          typeof (value as Record<string, unknown>)[key] === "boolean",
      ),
  );

export const loadCollapsedPanels = (
  storage?: Pick<Storage, "getItem"> | undefined,
): CollapsedPanels => {
  const raw = safeStorageGetItem(storage, RIGHT_SIDEBAR_STORAGE_KEY);
  if (!raw) {
    return defaultCollapsedPanels;
  }

  try {
    const parsed = JSON.parse(raw);
    return isValidCollapsedPanels(parsed) ? parsed : defaultCollapsedPanels;
  } catch {
    return defaultCollapsedPanels;
  }
};

export const saveCollapsedPanels = (
  panels: CollapsedPanels,
  storage?: Pick<Storage, "setItem"> | undefined,
) => {
  safeStorageSetItem(
    storage,
    RIGHT_SIDEBAR_STORAGE_KEY,
    JSON.stringify(panels),
  );
};

export const normalizeCollapsedPanelsForViewport = (
  panels: CollapsedPanels,
  _isMobile: boolean,
): CollapsedPanels => {
  const expandedPanels = panelKeys.filter((key) => !panels[key]);
  if (expandedPanels.length <= 1) {
    return panels;
  }

  const preferredPanel = expandedPanels.includes("chat")
    ? "chat"
    : expandedPanels[0];

  return collapseAllExcept(preferredPanel);
};

export const toggleCollapsedPanel = (
  panels: CollapsedPanels,
  panel: SidebarPanelKey,
  _isMobile: boolean,
): CollapsedPanels => {
  const nextCollapsed = !panels[panel];

  if (nextCollapsed) {
    return {
      ...panels,
      [panel]: true,
    };
  }

  return collapseAllExcept(panel);
};

export const expandPanel = (
  panels: CollapsedPanels,
  panel: SidebarPanelKey,
  _isMobile: boolean,
): CollapsedPanels => {
  return collapseAllExcept(panel);
};
