import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test } from "vitest";

import { CollapsiblePanel } from "./CollapsiblePanel";

const PanelHarness = () => {
  const [collapsedPanels, setCollapsedPanels] = useState({
    members: false,
    appearance: false,
    chat: false,
  });

  const togglePanel = (panel: keyof typeof collapsedPanels) => {
    setCollapsedPanels((previous) => ({
      ...previous,
      [panel]: !previous[panel],
    }));
  };

  return (
    <div>
      <CollapsiblePanel
        panelId="members-panel"
        title="房间成员"
        subtitle="2 在线"
        collapsed={collapsedPanels.members}
        onToggle={() => togglePanel("members")}
        grow="members"
      >
        <div>成员内容</div>
      </CollapsiblePanel>
      <CollapsiblePanel
        panelId="appearance-panel"
        title="快速换装"
        subtitle="当前：mint"
        collapsed={collapsedPanels.appearance}
        onToggle={() => togglePanel("appearance")}
        grow="appearance"
      >
        <div>换装内容</div>
      </CollapsiblePanel>
      <CollapsiblePanel
        panelId="chat-panel"
        title="聊天"
        subtitle="3 条"
        collapsed={collapsedPanels.chat}
        onToggle={() => togglePanel("chat")}
        grow="chat"
      >
        <div>聊天内容</div>
      </CollapsiblePanel>
    </div>
  );
};

afterEach(() => {
  cleanup();
});

describe("CollapsiblePanel", () => {
  test("折叠后只保留头部状态标记", () => {
    render(<PanelHarness />);

    const membersPanel = screen.getByText("成员内容").closest(".side-panel");
    expect(membersPanel?.getAttribute("data-collapsed")).toBe("false");
    expect(membersPanel?.getAttribute("data-grow")).toBe("members");

    fireEvent.click(screen.getByRole("button", { name: "收起房间成员" }));

    expect(membersPanel?.getAttribute("data-collapsed")).toBe("true");
    expect(membersPanel?.getAttribute("data-grow")).toBe("members");
  });

  test("折叠一个面板不会影响其他面板的展开状态", () => {
    render(<PanelHarness />);

    fireEvent.click(screen.getByRole("button", { name: "收起房间成员" }));

    const appearancePanel = screen.getByText("换装内容").closest(".side-panel");
    const chatPanel = screen.getByText("聊天内容").closest(".side-panel");

    expect(appearancePanel?.getAttribute("data-collapsed")).toBe("false");
    expect(appearancePanel?.getAttribute("data-grow")).toBe("appearance");
    expect(chatPanel?.getAttribute("data-collapsed")).toBe("false");
    expect(chatPanel?.getAttribute("data-grow")).toBe("chat");
  });
});
