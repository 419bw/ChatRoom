import type { CSSProperties, PropsWithChildren } from "react";

type PanelGrow = "chat" | "members" | "timeline" | "appearance";

type CollapsiblePanelProps = PropsWithChildren<{
  panelId: string;
  title: string;
  subtitle?: string;
  collapsed: boolean;
  onToggle: () => void;
  grow: PanelGrow;
}>;

const growWeight: Record<PanelGrow, number> = {
  chat: 1.6,
  members: 1,
  timeline: 1.15,
  appearance: 0.9,
};

export const CollapsiblePanel = ({
  panelId,
  title,
  subtitle,
  collapsed,
  onToggle,
  grow,
  children,
}: CollapsiblePanelProps) => (
  <section
    className={collapsed ? "side-panel is-collapsed" : "side-panel"}
    data-collapsed={collapsed ? "true" : "false"}
    data-grow={grow}
    style={{ "--panel-grow": growWeight[grow] } as CSSProperties}
  >
    <header className="side-panel__header" id={`${panelId}-heading`}>
      <div className="side-panel__title-group">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      <button
        type="button"
        className="side-panel__toggle"
        aria-controls={`${panelId}-body`}
        aria-expanded={!collapsed}
        aria-label={collapsed ? `展开${title}` : `收起${title}`}
        onClick={onToggle}
      >
        {collapsed ? "展开" : "收起"}
      </button>
    </header>
    <div
      className="side-panel__body-wrap"
      id={`${panelId}-body`}
      role="region"
      aria-labelledby={`${panelId}-heading`}
    >
      <div className="side-panel__body">{children}</div>
    </div>
  </section>
);
