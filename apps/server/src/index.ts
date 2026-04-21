import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";
import { Server, type Socket } from "socket.io";
import { ZodError } from "zod";
import {
  DEFAULT_ROOM_ID,
  createSystemNotice,
  parseJoinRoomPayload,
  parseMoveIntentPayload,
  parseSendChatPayload,
  parseUpdateAvatarPayload,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@chat/protocol";

import { JsonlAuditSink } from "./audit/JsonlAuditSink";
import { RoomBroadcastCoordinator } from "./network/RoomBroadcastCoordinator";
import { createCorsOriginValidator } from "./network/corsPolicy";
import { attachListenErrorHandler } from "./network/portGuard";
import { RoomManager } from "./room/RoomManager";
import { resolveRoomId } from "./room/roomPolicy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const logDir = path.resolve(rootDir, "logs");

const roomManager = new RoomManager();
const auditSink = new JsonlAuditSink(logDir);
const corsOriginValidator = createCorsOriginValidator(process.env.WEB_ORIGIN);

const app = express();
app.use(
  cors({
    origin: corsOriginValidator,
    credentials: true,
  }),
);

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    service: "chat-room-server",
    time: Date.now(),
  });
});

const httpServer = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: corsOriginValidator,
    credentials: true,
  },
});
const broadcastCoordinator = new RoomBroadcastCoordinator(io, auditSink);

const emitNotice = async (
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  message: string,
  severity: "info" | "warning" | "error" = "info",
) => {
  const notice = createSystemNotice(message, severity);
  await broadcastCoordinator.emitNotice(socket, notice);
};

const toUserMessage = (error: unknown) => {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "请求参数无效";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "服务端发生未知错误";
};

io.on("connection", (socket) => {
  let joinedRoomId: string | null = null;

  socket.on("join_room", async (payload) => {
    try {
      const parsed = parseJoinRoomPayload(payload);
      const roomId = resolveRoomId(parsed.roomId);
      const room = roomManager.getRoom(roomId);
      const result = room.joinUser({
        socketId: socket.id,
        payload: {
          ...parsed,
          roomId,
        },
      });

      joinedRoomId = room.roomId;
      socket.join(room.roomId);
      await broadcastCoordinator.emitJoin(socket, room.roomId, result);

      if (parsed.roomId !== DEFAULT_ROOM_ID) {
        await emitNotice(socket, "当前仅开放默认房间，已自动切换到暖光会客室。");
      }

      await emitNotice(
        socket,
        result.restored ? "已恢复上一次会话状态。" : "已成功进入房间。",
      );
    } catch (error) {
      await emitNotice(socket, toUserMessage(error), "error");
    }
  });

  socket.on("move_intent", async (payload) => {
    try {
      if (!joinedRoomId) {
        await emitNotice(socket, "你还没有进入房间", "warning");
        return;
      }

      const parsed = parseMoveIntentPayload(payload);
      const room = roomManager.getRoom(joinedRoomId);
      const userId = room.getUserIdBySocket(socket.id);
      if (!userId) {
        await emitNotice(socket, "当前会话未绑定角色", "warning");
        return;
      }

      const user = room.applyMoveIntent(userId, parsed);
      if (user) {
        broadcastCoordinator.emitMove(joinedRoomId, user);
      }
    } catch (error) {
      await emitNotice(socket, toUserMessage(error), "error");
    }
  });

  socket.on("send_chat", async (payload) => {
    try {
      if (!joinedRoomId) {
        await emitNotice(socket, "你还没有进入房间", "warning");
        return;
      }

      const parsed = parseSendChatPayload(payload);
      const room = roomManager.getRoom(joinedRoomId);
      const userId = room.getUserIdBySocket(socket.id);
      if (!userId) {
        await emitNotice(socket, "当前会话未绑定角色", "warning");
        return;
      }

      const result = room.postChat(userId, parsed.text);
      if (!result) {
        await emitNotice(socket, "消息发送失败", "warning");
        return;
      }

      await broadcastCoordinator.emitChat(joinedRoomId, result);
    } catch (error) {
      await emitNotice(socket, toUserMessage(error), "error");
    }
  });

  socket.on("update_avatar", async (payload) => {
    try {
      if (!joinedRoomId) {
        await emitNotice(socket, "你还没有进入房间", "warning");
        return;
      }

      const parsed = parseUpdateAvatarPayload(payload);
      const room = roomManager.getRoom(joinedRoomId);
      const userId = room.getUserIdBySocket(socket.id);
      if (!userId) {
        await emitNotice(socket, "当前会话未绑定角色", "warning");
        return;
      }

      const result = room.updateAvatar(userId, parsed.avatar);
      if (!result) {
        await emitNotice(socket, "外观更新失败", "warning");
        return;
      }

      await broadcastCoordinator.emitAvatar(joinedRoomId, result);
      await emitNotice(socket, "外观已更新");
    } catch (error) {
      await emitNotice(socket, toUserMessage(error), "error");
    }
  });

  socket.on("sync_ready", async () => {
    if (!joinedRoomId) {
      await emitNotice(socket, "请先进入房间", "warning");
      return;
    }

    await emitNotice(socket, "房间同步完成");
  });

  socket.on("disconnect", async () => {
    if (!joinedRoomId) {
      return;
    }

    const room = roomManager.getRoom(joinedRoomId);
    const result = room.leaveUser(socket.id);
    if (!result) {
      return;
    }

    await broadcastCoordinator.emitLeave(joinedRoomId, result);
  });
});

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

attachListenErrorHandler(httpServer, port, host);
httpServer.listen(port, host, () => {
  console.log(`聊天室服务已启动：http://${host}:${port}`);
});
