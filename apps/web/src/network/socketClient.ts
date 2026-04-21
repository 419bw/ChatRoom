import {
  DEFAULT_ROOM_ID,
  type ChatMessage,
  type ClientToServerEvents,
  type JoinRoomPayload,
  type MoveIntentPayload,
  type RoomSnapshot,
  type ServerToClientEvents,
  type SystemNotice,
  type UpdateAvatarPayload,
  type UserPresenceState,
} from "@chat/protocol";
import { io, type Socket } from "socket.io-client";

import {
  JOIN_ROOM_TIMEOUT_MS,
  resolveConnectionErrorMessage,
} from "./connectionError";
import { SOCKET_URL } from "./config";
import type { ConnectionStatus } from "../domain/roomStore";

type ClientHandlers = {
  onConnectionStatus: (status: ConnectionStatus) => void;
  onConnectionErrorMessage?: (message: string | null) => void;
  onRoomSnapshot: (snapshot: RoomSnapshot) => void;
  onUserJoined: (user: UserPresenceState) => void;
  onUserLeft: (payload: { userId: string }) => void;
  onUserMoved: (user: UserPresenceState) => void;
  onChatPosted: (message: ChatMessage) => void;
  onTimelineEntry?: ServerToClientEvents["timeline_entry"];
  onSystemNotice: (notice: SystemNotice) => void;
};

export class ChatSocketClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private joinPayload: JoinRoomPayload | null = null;
  private isConnecting = false;
  private joinTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private isManualDisconnect = false;

  constructor(private readonly handlers: ClientHandlers) {}

  connect(payload: JoinRoomPayload) {
    if (this.socket?.connected || this.isConnecting) {
      return;
    }

    this.joinPayload = {
      roomId: payload.roomId ?? DEFAULT_ROOM_ID,
      nickname: payload.nickname,
      avatar: payload.avatar,
      sessionToken: payload.sessionToken,
    };

    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        autoConnect: false,
        transports: ["websocket"],
      });
      this.bindEvents(this.socket);
    }

    this.isManualDisconnect = false;
    this.isConnecting = true;
    this.clearJoinTimeout();
    this.joinTimeoutHandle = setTimeout(() => {
      this.isConnecting = false;
      this.isManualDisconnect = true;
      this.socket?.disconnect();
      this.handlers.onConnectionErrorMessage?.(
        resolveConnectionErrorMessage("join_timeout"),
      );
      this.handlers.onConnectionStatus("error");
    }, JOIN_ROOM_TIMEOUT_MS);
    this.handlers.onConnectionErrorMessage?.(null);
    this.handlers.onConnectionStatus("connecting");
    this.socket.connect();
  }

  disconnect() {
    this.isConnecting = false;
    this.isManualDisconnect = true;
    this.clearJoinTimeout();
    this.socket?.disconnect();
  }

  setSessionToken(sessionToken: string) {
    if (!this.joinPayload) {
      return;
    }

    this.joinPayload = {
      ...this.joinPayload,
      sessionToken,
    };
  }

  sendMoveIntent(payload: MoveIntentPayload) {
    if (this.socket?.connected) {
      this.socket.emit("move_intent", payload);
    }
  }

  sendChat(text: string) {
    if (this.socket?.connected) {
      this.socket.emit("send_chat", {
        text,
      });
    }
  }

  updateAvatar(payload: UpdateAvatarPayload) {
    if (this.socket?.connected) {
      this.socket.emit("update_avatar", payload);
    }
  }

  syncReady(roomId: string) {
    if (this.socket?.connected) {
      this.socket.emit("sync_ready", {
        roomId,
      });
    }
  }

  private bindEvents(socket: Socket<ServerToClientEvents, ClientToServerEvents>) {
    socket.on("connect", () => {
      this.isConnecting = false;
      if (!this.joinPayload) {
        return;
      }

      socket.emit("join_room", this.joinPayload);
    });

    socket.on("disconnect", () => {
      this.clearJoinTimeout();
      this.isConnecting = false;
      if (this.isManualDisconnect) {
        this.isManualDisconnect = false;
        return;
      }

      this.handlers.onConnectionErrorMessage?.(
        resolveConnectionErrorMessage("disconnect"),
      );
      this.handlers.onConnectionStatus("disconnected");
      this.isManualDisconnect = false;
    });

    socket.on("connect_error", (error) => {
      this.clearJoinTimeout();
      this.isConnecting = false;
      this.handlers.onConnectionErrorMessage?.(
        resolveConnectionErrorMessage("connect_error", error),
      );
      this.handlers.onConnectionStatus("error");
    });

    socket.on("room_snapshot", (snapshot) => {
      this.clearJoinTimeout();
      this.handlers.onConnectionErrorMessage?.(null);
      this.handlers.onRoomSnapshot(snapshot);
      this.handlers.onConnectionStatus("joined");
    });

    socket.on("user_joined", this.handlers.onUserJoined);
    socket.on("user_left", this.handlers.onUserLeft);
    socket.on("user_moved", this.handlers.onUserMoved);
    socket.on("chat_posted", this.handlers.onChatPosted);
    if (this.handlers.onTimelineEntry) {
      socket.on("timeline_entry", this.handlers.onTimelineEntry);
    }
    socket.on("system_notice", this.handlers.onSystemNotice);
  }

  private clearJoinTimeout() {
    if (this.joinTimeoutHandle === null) {
      return;
    }

    clearTimeout(this.joinTimeoutHandle);
    this.joinTimeoutHandle = null;
  }
}
