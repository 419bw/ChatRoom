import type { RoomSnapshot, TimelineEntry } from "@chat/protocol";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type MockHandlers = {
  onConnectionStatus: (status: string) => void;
  onConnectionErrorMessage?: (message: string | null) => void;
  onRoomSnapshot: (snapshot: RoomSnapshot) => void;
  onUserJoined: (user: unknown) => void;
  onUserLeft: (payload: { userId: string }) => void;
  onUserMoved: (user: unknown) => void;
  onChatPosted: (message: unknown) => void;
  onTimelineEntry?: (entry: TimelineEntry) => void;
  onSystemNotice: (notice: unknown) => void;
};

type MockClient = {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  sendMoveIntent: ReturnType<typeof vi.fn>;
  sendChat: ReturnType<typeof vi.fn>;
  updateAvatar: ReturnType<typeof vi.fn>;
  setSessionToken: ReturnType<typeof vi.fn>;
  syncReady: ReturnType<typeof vi.fn>;
};

const mockSocketState = vi.hoisted(() => ({
  latestHandlers: null as MockHandlers | null,
  latestClient: null as MockClient | null,
}));

vi.mock("../network/socketClient", () => ({
  ChatSocketClient: class MockChatSocketClient {
    connect = vi.fn();
    disconnect = vi.fn();
    sendMoveIntent = vi.fn();
    sendChat = vi.fn();
    updateAvatar = vi.fn();
    setSessionToken = vi.fn();
    syncReady = vi.fn();

    constructor(handlers: MockHandlers) {
      mockSocketState.latestHandlers = handlers;
      mockSocketState.latestClient = this;
    }
  },
}));

vi.mock("../scene3d/loadRoomViewport3D", () => ({
  LazyRoomPreview3D: () => <div data-testid="mock-room-preview">mock-room-preview</div>,
  LazyRoomViewport3D: (props: {
    viewportMode: "ui" | "look" | "chat" | "reenter";
    chatValue: string;
    onViewportModeChange: (mode: "ui" | "look" | "chat" | "reenter") => void;
    onChatValueChange: (value: string) => void;
    onViewportChatSend: () => boolean;
  }) => (
    <div
      data-testid="mock-room-viewport"
      data-viewport-chat-open={props.viewportMode === "chat" ? "true" : "false"}
      data-viewport-mode={props.viewportMode}
    >
      <button type="button" onClick={() => props.onViewportModeChange("look")}>
        进入视角
      </button>
      <button type="button" onClick={() => props.onViewportModeChange("ui")}>
        锁鼠失败
      </button>
      <button type="button" onClick={() => props.onViewportModeChange("chat")}>
        打开聊天
      </button>
      <button type="button" onClick={() => props.onViewportModeChange("ui")}>
        退出视角
      </button>
      <button type="button" onClick={() => props.onViewportModeChange("look")}>
        重入成功
      </button>
      <button type="button" onClick={() => props.onViewportModeChange("ui")}>
        重入失败
      </button>
      {props.viewportMode === "chat" ? (
        <div>
          <textarea
            placeholder="输入聊天内容..."
            value={props.chatValue}
            onChange={(event) => props.onChatValueChange(event.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              const hasSent = props.onViewportChatSend();
              if (!hasSent) {
                return;
              }

              props.onViewportModeChange("reenter");
            }}
          >
            发送场景聊天
          </button>
        </div>
      ) : null}
    </div>
  ),
  preloadRoomViewport3D: vi.fn(() => Promise.resolve({})),
}));

import { App } from "./App";

const AMBIENT_AUDIO_STORAGE_KEY = "ui:ambient-audio:v1";

const createJoinedSnapshot = (recentTimeline: TimelineEntry[] = []): RoomSnapshot => ({
  roomId: "cozy-lounge",
  roomTheme: "warm-lounge",
  bounds: {
    width: 1280,
    height: 720,
    minX: 180,
    maxX: 1100,
    minY: 180,
    maxY: 610,
  },
  selfUserId: "user-1",
  sessionToken: "session-1",
  users: [
    {
      userId: "user-1",
      nickname: "阿青",
      avatar: {
        cosmetic: "mint",
      },
      position: {
        x: 520,
        y: 420,
      },
      joinedAt: 1000,
      lastActiveAt: 1000,
    },
  ],
  recentMessages: [],
  recentTimeline,
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  mockSocketState.latestHandlers = null;
  mockSocketState.latestClient = null;
  vi.restoreAllMocks();
});

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
    Object.defineProperty(window, "requestIdleCallback", {
      writable: true,
      value: vi.fn((callback: () => void) => {
        callback();
        return 1;
      }),
    });
    Object.defineProperty(window, "cancelIdleCallback", {
      writable: true,
      value: vi.fn(),
    });
    HTMLDivElement.prototype.scrollTo = vi.fn();
  });

  test("未进入房间前渲染 3D 预览，且抽屉保持关闭", () => {
    const { container } = render(<App />);

    expect(container.querySelector('[data-testid="mock-room-preview"]')).toBeTruthy();
    expect(
      container.querySelector('.app-layout[data-drawer-open="false"]'),
    ).toBeTruthy();
  });

  test("连接失败时 Join Overlay 会显示明确错误和重试入口", async () => {
    render(<App />);

    await act(async () => {
      mockSocketState.latestHandlers?.onConnectionErrorMessage?.(
        "无法连接房间服务，请先启动本地服务器后重试。",
      );
      mockSocketState.latestHandlers?.onConnectionStatus("error");
    });

    expect(screen.getByRole("alert").textContent).toContain("进入房间失败");
    expect(screen.getByRole("button", { name: "重新进入" })).toBeTruthy();
  });

  test("收到快照与实时 timeline_entry 后，房间动态面板会正确渲染", async () => {
    const initialTimeline: TimelineEntry[] = [
      {
        id: "entry-1",
        category: "presence_event",
        message: "阿青 加入了房间",
        createdAt: 1_000,
        actorId: "user-1",
        actorName: "阿青",
        meta: {
          action: "join",
        },
      },
    ];
    render(<App />);

    await act(async () => {
      mockSocketState.latestHandlers?.onRoomSnapshot(createJoinedSnapshot(initialTimeline));
    });

    fireEvent.click(screen.getByRole("button", { name: "面板" }));
    fireEvent.click(screen.getByRole("button", { name: "展开房间动态" }));

    expect(screen.getByText("阿青")).toBeTruthy();
    expect(screen.getByText("加入了房间")).toBeTruthy();

    await act(async () => {
      mockSocketState.latestHandlers?.onTimelineEntry?.({
        id: "entry-2",
        category: "chat_message",
        message: "阿青 发送了一条消息：你好",
        createdAt: 2_000,
        actorId: "user-1",
        actorName: "阿青",
        meta: {
          preview: "你好",
        },
      });
    });

    expect(screen.getByText("发送了：你好")).toBeTruthy();
  });

  test("房间动态面板折叠时会显示未读计数", async () => {
    const { container } = render(<App />);

    await act(async () => {
      mockSocketState.latestHandlers?.onRoomSnapshot(createJoinedSnapshot());
    });

    await act(async () => {
      mockSocketState.latestHandlers?.onTimelineEntry?.({
        id: "entry-3",
        category: "avatar_event",
        message: "阿青 切换了角色外观",
        createdAt: 2_000,
        actorId: "user-1",
        actorName: "阿青",
        meta: {
          cosmetic: "rose",
        },
      });
    });

    expect(container.querySelector(".room-drawer-toggle__badge")?.textContent).toBe("1");
  });

  test("快速换装面板可以切换环境音并写入本地偏好", async () => {
    render(<App />);

    await act(async () => {
      mockSocketState.latestHandlers?.onRoomSnapshot(createJoinedSnapshot());
    });

    fireEvent.click(screen.getByRole("button", { name: "面板" }));
    fireEvent.click(screen.getByRole("button", { name: "展开快速换装" }));

    const audioToggle = screen.getByRole("button", { name: "已开启" });
    fireEvent.click(audioToggle);

    await waitFor(() => {
      expect(localStorage.getItem(AMBIENT_AUDIO_STORAGE_KEY)).toBe("false");
    });
    expect(screen.getByRole("button", { name: "已关闭" })).toBeTruthy();
  });

  test("进入房间后默认进入 look 模式，且不会自动展开抽屉", async () => {
    const { container } = render(<App />);

    await act(async () => {
      mockSocketState.latestHandlers?.onRoomSnapshot(createJoinedSnapshot());
    });

    await waitFor(() => {
      expect(
        container.querySelector('.app-layout[data-control-mode="look"]'),
      ).toBeTruthy();
      expect(container.querySelector('.room-drawer[data-open="false"]')).toBeTruthy();
    });
  });

  test("按 M 打开抽屉会切到 ui，关闭后回到 look", async () => {
    const { container } = render(<App />);

    await act(async () => {
      mockSocketState.latestHandlers?.onRoomSnapshot(createJoinedSnapshot());
    });

    fireEvent.keyDown(window, {
      key: "m",
    });

    await waitFor(() => {
      expect(container.querySelector('.room-drawer[data-open="true"]')).toBeTruthy();
      expect(
        container.querySelector('.app-layout[data-control-mode="ui"]'),
      ).toBeTruthy();
    });

    fireEvent.keyDown(window, {
      key: "Escape",
    });

    await waitFor(() => {
      expect(container.querySelector('.room-drawer[data-open="false"]')).toBeTruthy();
      expect(
        container.querySelector('.app-layout[data-control-mode="look"]'),
      ).toBeTruthy();
    });
  });

  test("进入房间后可以从视角模式切换到场景聊天，且抽屉保持关闭", async () => {
    const { container } = render(<App />);

    await act(async () => {
      mockSocketState.latestHandlers?.onRoomSnapshot(createJoinedSnapshot());
    });

    fireEvent.click(screen.getByRole("button", { name: "打开聊天" }));
    await waitFor(() => {
      expect(container.querySelector('.room-drawer[data-open="false"]')).toBeTruthy();
      expect(
        container.querySelector('[data-viewport-chat-open="true"]'),
      ).toBeTruthy();
    });

    expect(
      container.querySelector('[data-testid="mock-room-viewport"] textarea'),
    ).toBeTruthy();
  });

  test("发送成功后聊天框关闭，但重入视角完成前右侧边栏不会闪现", async () => {
    const { container } = render(<App />);

    await act(async () => {
      mockSocketState.latestHandlers?.onRoomSnapshot(createJoinedSnapshot());
    });

    fireEvent.click(screen.getByRole("button", { name: "打开聊天" }));

    const textarea = await waitFor(() => {
      const element = container.querySelector(
        '[data-testid="mock-room-viewport"] textarea',
      ) as HTMLTextAreaElement | null;
      expect(element).toBeTruthy();
      return element as HTMLTextAreaElement;
    });
    fireEvent.change(textarea, {
      target: {
        value: "大家好",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送场景聊天" }));

    expect(mockSocketState.latestClient?.sendChat).toHaveBeenCalledWith("大家好");
    expect(
      container.querySelector('[data-viewport-chat-open="true"]'),
    ).toBeNull();
    expect(
      container.querySelector('.app-layout[data-control-mode="ui"]'),
    ).toBeTruthy();
    expect(container.querySelector('.room-drawer[data-open="false"]')).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "重入成功" }));

    await waitFor(() => {
      expect(
        container.querySelector('.app-layout[data-control-mode="look"]'),
      ).toBeTruthy();
    });
  });
});
