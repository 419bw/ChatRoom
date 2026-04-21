import {
  DEFAULT_ROOM_ID,
  RECENT_CHAT_LIMIT,
  RECENT_TIMELINE_LIMIT,
  ROOM_BOUNDS,
  ROOM_THEME,
  SESSION_TTL_MS,
  MOVE_KEYBOARD_STEP,
  ROOM_LAYOUT_CONFIG,
  resolveRoomCollisionPoint,
  type AvatarCosmetic,
  type ChatMessage,
  type JoinRoomPayload,
  type MoveIntentPayload,
  type Point,
  type RoomSnapshot,
  type TimelineCategory,
  type TimelineEntry,
  type UserAvatarState,
  type UserPresenceState,
} from "@chat/protocol";

export type JoinSessionInput = {
  socketId: string;
  payload: JoinRoomPayload;
  now?: number;
};

type SessionRecord = {
  userId: string;
  sessionToken: string;
  nickname: string;
  avatar: UserAvatarState;
  position: Point;
  expiresAt: number;
};

export type JoinUserResult = {
  snapshot: RoomSnapshot;
  user: UserPresenceState;
  timelineEntry: TimelineEntry;
  restored: boolean;
};

export type LeaveUserResult = {
  user: UserPresenceState;
  timelineEntry: TimelineEntry;
};

export type ChatResult = {
  message: ChatMessage;
  timelineEntry: TimelineEntry;
};

export type AvatarResult = {
  user: UserPresenceState;
  timelineEntry: TimelineEntry;
};

const cloneUser = (user: UserPresenceState): UserPresenceState => ({
  ...user,
  avatar: { ...user.avatar },
  position: { ...user.position },
});

const createTimelineEntry = (
  category: TimelineCategory,
  message: string,
  actorId?: string,
  actorName?: string,
  meta: TimelineEntry["meta"] = {},
): TimelineEntry => ({
  id: crypto.randomUUID(),
  category,
  message,
  createdAt: Date.now(),
  actorId,
  actorName,
  meta,
});

export class RoomService {
  readonly roomId: string;
  private readonly users = new Map<string, UserPresenceState>();
  private readonly socketToUser = new Map<string, string>();
  private readonly sessionRecords = new Map<string, SessionRecord>();
  private readonly recentMessages: ChatMessage[] = [];
  private readonly recentTimeline: TimelineEntry[] = [];

  constructor(roomId = DEFAULT_ROOM_ID) {
    this.roomId = roomId;
  }

  createRoom(roomId = DEFAULT_ROOM_ID) {
    return new RoomService(roomId);
  }

  joinUser({ socketId, payload, now = Date.now() }: JoinSessionInput): JoinUserResult {
    this.pruneExpiredSessions(now);

    const existingRecord =
      payload.sessionToken ? this.sessionRecords.get(payload.sessionToken) : undefined;
    const restored =
      Boolean(existingRecord) &&
      Boolean(payload.sessionToken) &&
      (existingRecord?.expiresAt ?? 0) > now &&
      !this.users.has(existingRecord!.userId);

    const sessionToken = restored ? existingRecord!.sessionToken : crypto.randomUUID();
    const userId = restored ? existingRecord!.userId : crypto.randomUUID();
    const position = restored
      ? resolveRoomCollisionPoint({ ...existingRecord!.position })
      : resolveRoomCollisionPoint(
          ROOM_LAYOUT_CONFIG.spawnPoints[this.users.size % ROOM_LAYOUT_CONFIG.spawnPoints.length] ??
            ROOM_LAYOUT_CONFIG.spawnPoints[0],
        );

    const user: UserPresenceState = {
      userId,
      nickname: payload.nickname,
      avatar: {
        cosmetic: restored ? existingRecord!.avatar.cosmetic : payload.avatar,
      },
      position,
      joinedAt: now,
      lastActiveAt: now,
    };

    this.users.set(user.userId, user);
    this.socketToUser.set(socketId, user.userId);
    this.sessionRecords.set(sessionToken, {
      userId: user.userId,
      sessionToken,
      nickname: user.nickname,
      avatar: { ...user.avatar },
      position: { ...user.position },
      expiresAt: now + SESSION_TTL_MS,
    });

    const timelineEntry = createTimelineEntry(
      "presence_event",
      restored ? `${user.nickname} 重新回到了房间` : `${user.nickname} 加入了房间`,
      user.userId,
      user.nickname,
      {
        action: restored ? "reconnect" : "join",
        cosmetic: user.avatar.cosmetic,
      },
    );

    this.appendTimeline(timelineEntry);

    return {
      snapshot: this.buildSnapshot(user.userId, sessionToken),
      user: cloneUser(user),
      timelineEntry,
      restored,
    };
  }

  leaveUser(socketId: string, now = Date.now()): LeaveUserResult | null {
    const userId = this.socketToUser.get(socketId);
    if (!userId) {
      return null;
    }

    const user = this.users.get(userId);
    if (!user) {
      this.socketToUser.delete(socketId);
      return null;
    }

    this.users.delete(userId);
    this.socketToUser.delete(socketId);

    for (const session of this.sessionRecords.values()) {
      if (session.userId === userId) {
        session.position = { ...user.position };
        session.avatar = { ...user.avatar };
        session.nickname = user.nickname;
        session.expiresAt = now + SESSION_TTL_MS;
        break;
      }
    }

    const timelineEntry = createTimelineEntry(
      "presence_event",
      `${user.nickname} 离开了房间`,
      user.userId,
      user.nickname,
      {
        action: "leave",
      },
    );
    this.appendTimeline(timelineEntry);

    return {
      user: cloneUser(user),
      timelineEntry,
    };
  }

  applyMoveIntent(userId: string, payload: MoveIntentPayload, now = Date.now()) {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const intendedPosition = payload.target
      ? payload.target
      : {
          x: user.position.x + (payload.direction?.x ?? 0) * MOVE_KEYBOARD_STEP,
          y: user.position.y + (payload.direction?.y ?? 0) * MOVE_KEYBOARD_STEP,
        };

    user.position = resolveRoomCollisionPoint(intendedPosition);
    user.lastActiveAt = now;

    this.syncSessionRecord(user);
    return cloneUser(user);
  }

  postChat(userId: string, text: string, now = Date.now()): ChatResult | null {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      userId: user.userId,
      nickname: user.nickname,
      avatar: { ...user.avatar },
      text,
      sentAt: now,
    };

    this.recentMessages.push(message);
    if (this.recentMessages.length > RECENT_CHAT_LIMIT) {
      this.recentMessages.shift();
    }

    const timelineEntry = createTimelineEntry(
      "chat_message",
      `${user.nickname} 发送了一条消息：${text}`,
      user.userId,
      user.nickname,
      {
        preview: text.slice(0, 24),
      },
    );
    this.appendTimeline(timelineEntry);
    this.syncSessionRecord(user);

    return {
      message,
      timelineEntry,
    };
  }

  updateAvatar(userId: string, avatar: AvatarCosmetic, now = Date.now()): AvatarResult | null {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    user.avatar = { cosmetic: avatar };
    user.lastActiveAt = now;
    this.syncSessionRecord(user);

    const timelineEntry = createTimelineEntry(
      "avatar_event",
      `${user.nickname} 切换了角色外观`,
      user.userId,
      user.nickname,
      {
        cosmetic: avatar,
      },
    );
    this.appendTimeline(timelineEntry);

    return {
      user: cloneUser(user),
      timelineEntry,
    };
  }

  appendTimeline(entry: TimelineEntry) {
    this.recentTimeline.push(entry);
    if (this.recentTimeline.length > RECENT_TIMELINE_LIMIT) {
      this.recentTimeline.shift();
    }
  }

  getRecentTimeline(limit = RECENT_TIMELINE_LIMIT) {
    return this.recentTimeline
      .slice(-limit)
      .map((entry) => ({ ...entry, meta: { ...entry.meta } }));
  }

  getRecentMessages(limit = RECENT_CHAT_LIMIT) {
    return this.recentMessages.slice(-limit).map((message) => ({
      ...message,
      avatar: { ...message.avatar },
    }));
  }

  getUsers() {
    return Array.from(this.users.values()).map(cloneUser);
  }

  getUserIdBySocket(socketId: string) {
    return this.socketToUser.get(socketId) ?? null;
  }

  getSnapshot(sessionToken: string, userId: string) {
    return this.buildSnapshot(userId, sessionToken);
  }

  private buildSnapshot(selfUserId: string, sessionToken: string): RoomSnapshot {
    return {
      roomId: this.roomId,
      roomTheme: ROOM_THEME,
      bounds: { ...ROOM_BOUNDS },
      selfUserId,
      sessionToken,
      users: this.getUsers(),
      recentMessages: this.getRecentMessages(),
      recentTimeline: this.getRecentTimeline(),
    };
  }

  private syncSessionRecord(user: UserPresenceState) {
    for (const session of this.sessionRecords.values()) {
      if (session.userId === user.userId) {
        session.nickname = user.nickname;
        session.avatar = { ...user.avatar };
        session.position = { ...user.position };
        session.expiresAt = Date.now() + SESSION_TTL_MS;
      }
    }
  }

  private pruneExpiredSessions(now = Date.now()) {
    for (const [token, session] of this.sessionRecords.entries()) {
      if (session.expiresAt <= now) {
        this.sessionRecords.delete(token);
      }
    }
  }
}

export const createRoom = (roomId = DEFAULT_ROOM_ID) => new RoomService(roomId);
