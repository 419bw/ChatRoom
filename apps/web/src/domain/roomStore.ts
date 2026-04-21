import {
  RECENT_CHAT_LIMIT,
  type ChatMessage,
  type RoomTheme,
  type RoomSnapshot,
  type SystemNotice,
  type TimelineEntry,
  type UserPresenceState,
} from "@chat/protocol";
import { useSyncExternalStore } from "react";

import {
  TIMELINE_ENTRY_LIMIT,
  type RecentActivityByUserId,
  deriveRecentActivityByUserId,
  mergeTimelineEntries,
  pruneExpiredRecentActivityByUserId,
} from "./recentActivity";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "joined"
  | "disconnected"
  | "error";

export type RoomState = {
  connectionStatus: ConnectionStatus;
  connectionErrorMessage: string | null;
  roomId: string | null;
  roomTheme: RoomTheme | null;
  selfUserId: string | null;
  sessionToken: string | null;
  users: Record<string, UserPresenceState>;
  messages: ChatMessage[];
  timelineEntries: TimelineEntry[];
  recentActivityByUserId: RecentActivityByUserId;
  notices: SystemNotice[];
};

const initialState: RoomState = {
  connectionStatus: "idle",
  connectionErrorMessage: null,
  roomId: null,
  roomTheme: null,
  selfUserId: null,
  sessionToken: null,
  users: {},
  messages: [],
  timelineEntries: [],
  recentActivityByUserId: {},
  notices: [],
};

export class RoomStore {
  private state: RoomState = initialState;
  private readonly listeners = new Set<() => void>();

  getState() {
    return this.state;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  setConnectionStatus(connectionStatus: ConnectionStatus) {
    this.patch({
      connectionStatus,
    });
  }

  setConnectionErrorMessage(connectionErrorMessage: string | null) {
    this.patch({
      connectionErrorMessage,
    });
  }

  clearActiveRoom(connectionStatus: Extract<ConnectionStatus, "idle" | "disconnected" | "error">) {
    this.patch({
      connectionStatus,
      roomId: null,
      roomTheme: null,
      selfUserId: null,
      users: {},
      messages: [],
      timelineEntries: [],
      recentActivityByUserId: {},
    });
  }

  applySnapshot(snapshot: RoomSnapshot) {
    const users = Object.fromEntries(
      snapshot.users.map((user) => [user.userId, user]),
    );
    const timelineEntries = mergeTimelineEntries([], snapshot.recentTimeline, TIMELINE_ENTRY_LIMIT);
    const recentActivityByUserId = deriveRecentActivityByUserId(timelineEntries);

    this.patch({
      connectionStatus: "joined",
      connectionErrorMessage: null,
      roomId: snapshot.roomId,
      roomTheme: snapshot.roomTheme,
      selfUserId: snapshot.selfUserId,
      sessionToken: snapshot.sessionToken,
      users,
      messages: snapshot.recentMessages,
      timelineEntries,
      recentActivityByUserId,
    });
  }

  upsertUser(user: UserPresenceState) {
    this.patch({
      users: {
        ...this.state.users,
        [user.userId]: user,
      },
    });
  }

  removeUser(userId: string) {
    const nextUsers = { ...this.state.users };
    delete nextUsers[userId];
    this.patch({
      users: nextUsers,
    });
  }

  addMessage(message: ChatMessage) {
    this.patch({
      messages: [...this.state.messages, message].slice(-RECENT_CHAT_LIMIT),
    });
  }

  addTimelineEntry(entry: TimelineEntry) {
    const timelineEntries = mergeTimelineEntries(
      this.state.timelineEntries,
      [entry],
      TIMELINE_ENTRY_LIMIT,
    );

    if (
      timelineEntries.length === this.state.timelineEntries.length &&
      timelineEntries.at(-1)?.id === this.state.timelineEntries.at(-1)?.id
    ) {
      return;
    }

    this.patch({
      timelineEntries,
      recentActivityByUserId: deriveRecentActivityByUserId(timelineEntries),
    });
  }

  pruneExpiredRecentActivity(now = Date.now()) {
    const recentActivityByUserId = pruneExpiredRecentActivityByUserId(
      this.state.recentActivityByUserId,
      now,
    );

    const currentKeys = Object.keys(this.state.recentActivityByUserId);
    const nextKeys = Object.keys(recentActivityByUserId);
    if (
      currentKeys.length === nextKeys.length &&
      currentKeys.every((key) => key in recentActivityByUserId)
    ) {
      return;
    }

    this.patch({
      recentActivityByUserId,
    });
  }

  pushNotice(notice: SystemNotice) {
    this.patch({
      notices: [...this.state.notices, notice].slice(-6),
    });
  }

  reset() {
    this.state = initialState;
    this.emit();
  }

  private patch(partial: Partial<RoomState>) {
    this.state = {
      ...this.state,
      ...partial,
    };
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const useRoomStore = (store: RoomStore) =>
  useSyncExternalStore(store.subscribe, () => store.getState());

export const useRoomStoreSelector = <Selected,>(
  store: RoomStore,
  selector: (state: RoomState) => Selected,
) => useSyncExternalStore(store.subscribe, () => selector(store.getState()));
