import type {
  AvatarResult,
  ChatResult,
  JoinUserResult,
  LeaveUserResult,
} from "@chat/core";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SystemNotice,
  UserPresenceState,
} from "@chat/protocol";
import type { Server, Socket } from "socket.io";

import { JsonlAuditSink } from "../audit/JsonlAuditSink";

export class RoomBroadcastCoordinator {
  constructor(
    private readonly io: Server<ClientToServerEvents, ServerToClientEvents>,
    private readonly auditSink: JsonlAuditSink,
  ) {}

  async emitNotice(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    notice: SystemNotice,
  ) {
    socket.emit("system_notice", notice);
    await this.auditSink.appendNotice(notice);
  }

  async emitJoin(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    roomId: string,
    result: JoinUserResult,
  ) {
    socket.emit("room_snapshot", result.snapshot);
    socket.to(roomId).emit("user_joined", result.user);
    socket.to(roomId).emit("timeline_entry", result.timelineEntry);
    await this.auditSink.appendTimeline(result.timelineEntry);
  }

  emitMove(roomId: string, user: UserPresenceState) {
    this.io.to(roomId).emit("user_moved", user);
  }

  async emitChat(roomId: string, result: ChatResult) {
    this.io.to(roomId).emit("chat_posted", result.message);
    this.io.to(roomId).emit("timeline_entry", result.timelineEntry);
    await this.auditSink.appendTimeline(result.timelineEntry);
  }

  async emitAvatar(roomId: string, result: AvatarResult) {
    this.io.to(roomId).emit("user_moved", result.user);
    this.io.to(roomId).emit("timeline_entry", result.timelineEntry);
    await this.auditSink.appendTimeline(result.timelineEntry);
  }

  async emitLeave(roomId: string, result: LeaveUserResult) {
    this.io.to(roomId).emit("user_left", {
      userId: result.user.userId,
    });
    this.io.to(roomId).emit("timeline_entry", result.timelineEntry);
    await this.auditSink.appendTimeline(result.timelineEntry);
  }
}
