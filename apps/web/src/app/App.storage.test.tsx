import type { RoomSnapshot } from "@chat/protocol";
import {
  act,
  cleanup,
  render,
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
  onTimelineEntry?: (entry: unknown) => void;
  onSystemNotice: (notice: unknown) => void;
};

const mockSocketState = vi.hoisted(() => ({
  latestHandlers: null as MockHandlers | null,
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
    }
  },
}));

vi.mock("../scene3d/loadRoomViewport3D", () => ({
  LazyRoomPreview3D: () => <div data-testid="mock-room-preview">mock-room-preview</div>,
  LazyRoomViewport3D: () => <div data-testid="mock-room-viewport">mock-room-viewport</div>,
  preloadRoomViewport3D: vi.fn(() => Promise.resolve({})),
}));

import { App } from "./App";

const createJoinedSnapshot = (): RoomSnapshot => ({
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
  recentTimeline: [],
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  mockSocketState.latestHandlers = null;
  vi.restoreAllMocks();
});

describe("App storage fallback", () => {
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
  });

  test("localStorage 写入失败时仍能正常渲染并处理房间快照", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    const { container } = render(<App />);

    expect(container.querySelector('[data-testid="mock-room-preview"]')).toBeTruthy();

    await act(async () => {
      mockSocketState.latestHandlers?.onRoomSnapshot(createJoinedSnapshot());
    });

    await waitFor(() => {
      expect(container.querySelector(".room-drawer-toggle")).toBeTruthy();
      expect(container.querySelector('[data-testid="mock-room-viewport"]')).toBeTruthy();
    });
  });
});
