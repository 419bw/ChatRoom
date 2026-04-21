import { beforeEach, describe, expect, test, vi } from "vitest";

import { JOIN_ROOM_TIMEOUT_MS } from "./connectionError";

type EventHandler = (...args: any[]) => void;

const eventHandlers = new Map<string, EventHandler>();
const emit = vi.fn();
const connect = vi.fn();
const disconnect = vi.fn();

const fakeSocket = {
  connected: false,
  on: vi.fn((event: string, handler: EventHandler) => {
    eventHandlers.set(event, handler);
    return fakeSocket;
  }),
  emit,
  connect,
  disconnect,
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => fakeSocket),
}));

import { ChatSocketClient } from "./socketClient";

describe("ChatSocketClient", () => {
  beforeEach(() => {
    vi.useRealTimers();
    eventHandlers.clear();
    emit.mockReset();
    connect.mockReset();
    disconnect.mockReset();
    fakeSocket.connected = false;
    fakeSocket.on.mockClear();
  });

  test("重复 connect 不会重复发起连接", () => {
    const statuses: string[] = [];
    const client = new ChatSocketClient({
      onConnectionStatus: (status) => {
        statuses.push(status);
      },
      onRoomSnapshot: vi.fn(),
      onUserJoined: vi.fn(),
      onUserLeft: vi.fn(),
      onUserMoved: vi.fn(),
      onChatPosted: vi.fn(),
      onSystemNotice: vi.fn(),
    });

    client.connect({
      roomId: "cozy-lounge",
      nickname: "阿青",
      avatar: "mint",
    });
    client.connect({
      roomId: "cozy-lounge",
      nickname: "阿青",
      avatar: "mint",
    });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual(["connecting"]);
  });

  test("连接成功后发送 join_room 且默认不绑定 timeline 处理器", () => {
    const client = new ChatSocketClient({
      onConnectionStatus: vi.fn(),
      onRoomSnapshot: vi.fn(),
      onUserJoined: vi.fn(),
      onUserLeft: vi.fn(),
      onUserMoved: vi.fn(),
      onChatPosted: vi.fn(),
      onSystemNotice: vi.fn(),
    });

    client.connect({
      roomId: "cozy-lounge",
      nickname: "阿青",
      avatar: "mint",
      sessionToken: "session-1",
    });

    fakeSocket.connected = true;
    eventHandlers.get("connect")?.();

    expect(emit).toHaveBeenCalledWith("join_room", {
      roomId: "cozy-lounge",
      nickname: "阿青",
      avatar: "mint",
      sessionToken: "session-1",
    });
    expect(eventHandlers.has("timeline_entry")).toBe(false);
  });

  test("connect_error 会映射出明确的启动提示", () => {
    const onConnectionErrorMessage = vi.fn();
    const onConnectionStatus = vi.fn();
    const client = new ChatSocketClient({
      onConnectionStatus,
      onConnectionErrorMessage,
      onRoomSnapshot: vi.fn(),
      onUserJoined: vi.fn(),
      onUserLeft: vi.fn(),
      onUserMoved: vi.fn(),
      onChatPosted: vi.fn(),
      onSystemNotice: vi.fn(),
    });

    client.connect({
      roomId: "cozy-lounge",
      nickname: "阿青",
      avatar: "mint",
    });

    eventHandlers.get("connect_error")?.({
      message: "websocket error",
    });

    expect(onConnectionErrorMessage).toHaveBeenLastCalledWith(
      expect.stringContaining("启动"),
    );
    expect(onConnectionStatus).toHaveBeenLastCalledWith("error");
  });

  test("join 超时会返回可重试错误并主动断开当前尝试", () => {
    vi.useFakeTimers();
    const onConnectionErrorMessage = vi.fn();
    const onConnectionStatus = vi.fn();
    const client = new ChatSocketClient({
      onConnectionStatus,
      onConnectionErrorMessage,
      onRoomSnapshot: vi.fn(),
      onUserJoined: vi.fn(),
      onUserLeft: vi.fn(),
      onUserMoved: vi.fn(),
      onChatPosted: vi.fn(),
      onSystemNotice: vi.fn(),
    });

    client.connect({
      roomId: "cozy-lounge",
      nickname: "阿青",
      avatar: "mint",
    });

    vi.advanceTimersByTime(JOIN_ROOM_TIMEOUT_MS + 1);

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(onConnectionErrorMessage).toHaveBeenLastCalledWith(
      expect.stringContaining("超时"),
    );
    expect(onConnectionStatus).toHaveBeenLastCalledWith("error");
  });

  test("未连接时不会发送聊天消息", () => {
    const client = new ChatSocketClient({
      onConnectionStatus: vi.fn(),
      onRoomSnapshot: vi.fn(),
      onUserJoined: vi.fn(),
      onUserLeft: vi.fn(),
      onUserMoved: vi.fn(),
      onChatPosted: vi.fn(),
      onSystemNotice: vi.fn(),
    });

    client.sendChat("你好");

    expect(emit).not.toHaveBeenCalled();
  });
});
