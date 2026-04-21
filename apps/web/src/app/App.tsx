import {
  DEFAULT_ROOM_ID,
  ROOM_THEME,
  avatarCosmetics,
  type AvatarCosmetic,
  type ChatMessage,
  type SystemNotice,
} from "@chat/protocol";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import {
  loadAmbientAudioPreference,
  saveAmbientAudioPreference,
  useAmbientRoomAudio,
} from "./ambientRoomAudio";
import {
  compareUsersByRecentActivity,
  TIMELINE_PANEL_LIMIT,
} from "../domain/recentActivity";
import {
  RoomStore,
  type ConnectionStatus,
  useRoomStoreSelector,
} from "../domain/roomStore";
import { ChatSocketClient } from "../network/socketClient";
import {
  LazyRoomPreview3D,
  LazyRoomViewport3D,
  preloadRoomViewport3D,
} from "../scene3d/loadRoomViewport3D";
import { unlockBubbleSound } from "../scene3d/bubbleSound";
import {
  DEFAULT_VIEWPORT_MODE,
  resolveSceneControlMode,
  type ViewportMode,
} from "../scene3d/sceneControl";
import { ChatPanel } from "../ui/ChatPanel";
import { CollapsiblePanel } from "../ui/CollapsiblePanel";
import { JoinOverlay } from "../ui/JoinOverlay";
import { OnlineList } from "../ui/OnlineList";
import { SettingsPanel } from "../ui/SettingsPanel";
import { TimelinePanel } from "../ui/TimelinePanel";
import { avatarLabels } from "../ui/avatarLabels";
import { SceneViewportBoundary } from "./SceneViewportBoundary";
import {
  defaultCollapsedPanels,
  loadCollapsedPanels,
  normalizeCollapsedPanelsForViewport,
  saveCollapsedPanels,
  toggleCollapsedPanel,
} from "./sidebarState";
import { safeStorageGetItem, safeStorageSetItem } from "./browserStorage";
import "./App.css";

const SESSION_STORAGE_KEY = "chat-room-session-token";
const PROFILE_STORAGE_KEY = "chat-room-profile";
const MOBILE_SIDEBAR_MEDIA_QUERY = "(max-width: 780px)";
const NOTICE_TOAST_DURATION_MS = 3400;
const ENTRY_HINT_DURATION_MS = 2_800;
const PREJOIN_DEFAULT_STATUS_TEXT = "准备进入暖光会客室。";
const RECENT_ACTIVITY_PRUNE_INTERVAL_MS = 1_000;

type StageUiMode = "prejoin" | "joined";

type ProfileState = {
  nickname: string;
  avatar: AvatarCosmetic;
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const createFallbackProfile = (): ProfileState => ({
  nickname: "游客",
  avatar: avatarCosmetics[0] as AvatarCosmetic,
});

const getIsMobileSidebar = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(MOBILE_SIDEBAR_MEDIA_QUERY).matches;

const getHasJoinedRoom = (
  connectionStatus: ConnectionStatus,
  selfUserId: string | null,
) => connectionStatus === "joined" && Boolean(selfUserId);

const loadProfile = (): ProfileState => {
  if (typeof window === "undefined") {
    return createFallbackProfile();
  }

  const raw = safeStorageGetItem(window.localStorage, PROFILE_STORAGE_KEY);
  if (!raw) {
    return createFallbackProfile();
  }

  try {
    const parsed = JSON.parse(raw) as { nickname?: string; avatar?: AvatarCosmetic };
    return {
      nickname: parsed.nickname?.trim() || "游客",
      avatar:
        parsed.avatar && avatarCosmetics.includes(parsed.avatar)
          ? parsed.avatar
          : (avatarCosmetics[0] as AvatarCosmetic),
    };
  } catch {
    return createFallbackProfile();
  }
};

const loadSessionToken = () =>
  typeof window === "undefined"
    ? undefined
    : safeStorageGetItem(window.localStorage, SESSION_STORAGE_KEY) ?? undefined;

const isDrawerHotkeyBlocked = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return false;
  }

  const element = target as HTMLElement;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    element.isContentEditable
  );
};

const ConnectionStatusChip = ({ store }: { store: RoomStore }) => {
  const connectionStatus = useRoomStoreSelector(store, (state) => state.connectionStatus);
  const selfUserId = useRoomStoreSelector(store, (state) => state.selfUserId);
  const hasJoinedRoom = getHasJoinedRoom(connectionStatus, selfUserId);

  return (
    <div className="status-chip">
      <strong>{hasJoinedRoom ? "房间已连接" : "等待进入"}</strong>
      <span>
        {connectionStatus === "joined"
          ? "联机正常"
          : connectionStatus === "connecting"
            ? "正在连接"
            : connectionStatus === "error"
              ? "连接异常"
              : connectionStatus === "disconnected"
                ? "连接断开"
                : "空闲中"}
      </span>
    </div>
  );
};

const NoticeToast = ({ notice }: { notice: SystemNotice | null }) => {
  const [activeNotice, setActiveNotice] = useState<SystemNotice | null>(null);

  useEffect(() => {
    if (!notice) {
      return;
    }

    setActiveNotice(notice);
    const timer = window.setTimeout(() => {
      setActiveNotice((current) => (current?.id === notice.id ? null : current));
    }, NOTICE_TOAST_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  if (!activeNotice) {
    return null;
  }

  return (
    <div className={`notice-toast notice-toast--${activeNotice.severity}`} role="status">
      {activeNotice.message}
    </div>
  );
};

const RoomStage = ({
  store,
  client,
  profile,
  uiMode,
  viewportMode,
  drawerOpen,
  chatDraft,
  entryHintVisible,
  onNicknameChange,
  onAvatarChange,
  onJoin,
  onViewportModeChange,
  onChatDraftChange,
  onSendChat,
}: {
  store: RoomStore;
  client: ChatSocketClient;
  profile: ProfileState;
  uiMode: StageUiMode;
  viewportMode: ViewportMode;
  drawerOpen: boolean;
  chatDraft: string;
  entryHintVisible: boolean;
  onNicknameChange: (value: string) => void;
  onAvatarChange: (avatar: AvatarCosmetic) => void;
  onJoin: () => void;
  onViewportModeChange: (mode: ViewportMode) => void;
  onChatDraftChange: (value: string) => void;
  onSendChat: () => boolean;
}) => {
  const connectionStatus = useRoomStoreSelector(store, (state) => state.connectionStatus);
  const connectionErrorMessage = useRoomStoreSelector(
    store,
    (state) => state.connectionErrorMessage,
  );
  const selfUserId = useRoomStoreSelector(store, (state) => state.selfUserId);
  const users = useRoomStoreSelector(store, (state) => state.users);
  const roomTheme = useRoomStoreSelector(store, (state) => state.roomTheme);
  const recentActivityByUserId = useRoomStoreSelector(
    store,
    (state) => state.recentActivityByUserId,
  );
  const latestChatMessage = useRoomStoreSelector(
    store,
    (state) => state.messages.at(-1) ?? null,
  );
  const latestNotice = useRoomStoreSelector(store, (state) => state.notices.at(-1) ?? null);
  const hasJoinedRoom = getHasJoinedRoom(connectionStatus, selfUserId);
  const sceneControlMode = resolveSceneControlMode(viewportMode);
  const onlineUsers = useMemo(
    () =>
      Object.values(users).sort((left, right) =>
        compareUsersByRecentActivity(left, right, recentActivityByUserId),
      ),
    [recentActivityByUserId, users],
  );

  const controlsHintText = !hasJoinedRoom
    ? null
    : viewportMode === "chat"
      ? "Enter 发送 · Esc 取消"
      : drawerOpen
        ? "M 收起面板 · 点击场景回到休息室视角"
      : sceneControlMode === "look"
        ? "Enter 聊天 · M 面板 · Esc 退出视角"
        : "点击场景回到休息室视角";

  return (
    <section
      className="room-stage"
      data-stage-mode={uiMode}
      data-control-mode={sceneControlMode}
      data-viewport-chat-open={viewportMode === "chat" ? "true" : "false"}
    >
      <ConnectionStatusChip store={store} />

      <SceneViewportBoundary
        resetKey={hasJoinedRoom ? selfUserId ?? "scene-idle" : "scene-preview"}
      >
        <Suspense fallback={<div className="room-viewport room-viewport--shell" />}>
          {hasJoinedRoom ? (
            <LazyRoomViewport3D
              users={onlineUsers}
              selfUserId={selfUserId}
              roomTheme={roomTheme}
              latestChatMessage={latestChatMessage}
              recentActivityByUserId={recentActivityByUserId}
              viewportMode={viewportMode}
              chatValue={chatDraft}
              onMoveIntent={(payload) => {
                client.sendMoveIntent(payload);
              }}
              onViewportModeChange={onViewportModeChange}
              onChatValueChange={onChatDraftChange}
              onViewportChatSend={onSendChat}
            />
          ) : (
            <LazyRoomPreview3D roomTheme={roomTheme} />
          )}
        </Suspense>
      </SceneViewportBoundary>

      <NoticeToast notice={latestNotice} />

      {entryHintVisible ? (
        <div className="entry-hint" role="status">
          <strong>已进入休息室视角</strong>
          <span>
            <code>Enter</code> 聊天 · <code>M</code> 面板 · <code>Esc</code> 退出视角
          </span>
        </div>
      ) : null}

      {controlsHintText ? <div className="controls-chip">{controlsHintText}</div> : null}

      {!hasJoinedRoom ? (
        <JoinOverlay
          nickname={profile.nickname}
          avatar={profile.avatar}
          errorMessage={connectionErrorMessage}
          statusText={
            connectionErrorMessage
              ? "修正服务状态后可重新尝试进入房间。"
              : (latestNotice?.message ?? PREJOIN_DEFAULT_STATUS_TEXT)
          }
          busy={connectionStatus === "connecting"}
          onNicknameChange={onNicknameChange}
          onAvatarChange={onAvatarChange}
          onSubmit={onJoin}
        />
      ) : null}
    </section>
  );
};

const RoomMembersPanel = ({ store }: { store: RoomStore }) => {
  const users = useRoomStoreSelector(store, (state) => state.users);
  const selfUserId = useRoomStoreSelector(store, (state) => state.selfUserId);
  const recentActivityByUserId = useRoomStoreSelector(
    store,
    (state) => state.recentActivityByUserId,
  );
  const onlineUsers = useMemo(
    () =>
      Object.values(users).sort((left, right) =>
        compareUsersByRecentActivity(left, right, recentActivityByUserId),
      ),
    [recentActivityByUserId, users],
  );

  return (
    <OnlineList
      users={onlineUsers}
      selfUserId={selfUserId}
      recentActivityByUserId={recentActivityByUserId}
    />
  );
};

const RoomTimelinePanel = ({
  store,
  collapsed,
  onUnreadCountChange,
}: {
  store: RoomStore;
  collapsed: boolean;
  onUnreadCountChange: (count: number) => void;
}) => {
  const timelineEntries = useRoomStoreSelector(store, (state) => state.timelineEntries);
  const visibleEntries = useMemo(
    () => timelineEntries.slice(-TIMELINE_PANEL_LIMIT),
    [timelineEntries],
  );

  return (
    <TimelinePanel
      collapsed={collapsed}
      entries={visibleEntries}
      onUnreadCountChange={onUnreadCountChange}
    />
  );
};

const RoomAppearancePanel = ({
  store,
  profile,
  ambientAudioEnabled,
  onChangeAvatar,
  onChangeAmbientAudioEnabled,
}: {
  store: RoomStore;
  profile: ProfileState;
  ambientAudioEnabled: boolean;
  onChangeAvatar: (avatar: AvatarCosmetic) => void;
  onChangeAmbientAudioEnabled: (enabled: boolean) => void;
}) => {
  const connectionStatus = useRoomStoreSelector(store, (state) => state.connectionStatus);
  const selfUserId = useRoomStoreSelector(store, (state) => state.selfUserId);
  const currentAvatar = useRoomStoreSelector(store, (state) => {
    if (!state.selfUserId) {
      return profile.avatar;
    }

    return state.users[state.selfUserId]?.avatar.cosmetic ?? profile.avatar;
  });
  const hasJoinedRoom = getHasJoinedRoom(connectionStatus, selfUserId);

  return (
    <SettingsPanel
      currentAvatar={currentAvatar}
      disabled={!hasJoinedRoom}
      ambientAudioEnabled={ambientAudioEnabled}
      onChangeAvatar={onChangeAvatar}
      onChangeAmbientAudioEnabled={onChangeAmbientAudioEnabled}
    />
  );
};

const RoomChatPanel = ({
  store,
  collapsed,
  value,
  onUnreadCountChange,
  onChange,
  onSend,
}: {
  store: RoomStore;
  collapsed: boolean;
  value: string;
  onUnreadCountChange: (count: number) => void;
  onChange: (value: string) => void;
  onSend: () => void;
}) => {
  const connectionStatus = useRoomStoreSelector(store, (state) => state.connectionStatus);
  const selfUserId = useRoomStoreSelector(store, (state) => state.selfUserId);
  const messages = useRoomStoreSelector(store, (state) => state.messages);
  const hasJoinedRoom = getHasJoinedRoom(connectionStatus, selfUserId);

  return (
    <ChatPanel
      collapsed={collapsed}
      messages={messages}
      value={value}
      disabled={!hasJoinedRoom}
      onUnreadCountChange={onUnreadCountChange}
      onChange={onChange}
      onSend={onSend}
    />
  );
};

const RoomSidebar = ({
  store,
  profile,
  ambientAudioEnabled,
  drawerOpen,
  isMobileSidebar,
  collapsedPanels,
  chatDraft,
  chatUnreadCount,
  timelineUnreadCount,
  onTogglePanel,
  onChangeAvatar,
  onChangeAmbientAudioEnabled,
  onChatUnreadCountChange,
  onTimelineUnreadCountChange,
  onChatDraftChange,
  onSendChat,
}: {
  store: RoomStore;
  profile: ProfileState;
  ambientAudioEnabled: boolean;
  drawerOpen: boolean;
  isMobileSidebar: boolean;
  collapsedPanels: typeof defaultCollapsedPanels;
  chatDraft: string;
  chatUnreadCount: number;
  timelineUnreadCount: number;
  onTogglePanel: (panel: keyof typeof defaultCollapsedPanels) => void;
  onChangeAvatar: (avatar: AvatarCosmetic) => void;
  onChangeAmbientAudioEnabled: (enabled: boolean) => void;
  onChatUnreadCountChange: (count: number) => void;
  onTimelineUnreadCountChange: (count: number) => void;
  onChatDraftChange: (value: string) => void;
  onSendChat: () => void;
}) => {
  const onlineCount = useRoomStoreSelector(store, (state) => Object.keys(state.users).length);
  const messageCount = useRoomStoreSelector(store, (state) => state.messages.length);
  const timelineCount = useRoomStoreSelector(store, (state) => state.timelineEntries.length);
  const appearanceSubtitle = useRoomStoreSelector(store, (state) => {
    if (!state.selfUserId) {
      return "进入房间后可切换";
    }

    const avatar = state.users[state.selfUserId]?.avatar.cosmetic ?? profile.avatar;
    return `当前：${avatarLabels[avatar]}`;
  });
  const chatCollapsed = collapsedPanels.chat || !drawerOpen;
  const membersCollapsed = collapsedPanels.members || !drawerOpen;
  const timelineCollapsed = collapsedPanels.timeline || !drawerOpen;
  const appearanceCollapsed = collapsedPanels.appearance || !drawerOpen;
  const timelineSubtitle =
    timelineCollapsed && timelineUnreadCount > 0
      ? `${timelineUnreadCount} 条未读`
      : `${Math.min(timelineCount, TIMELINE_PANEL_LIMIT)} 条动态`;
  const chatSubtitle =
    chatCollapsed && chatUnreadCount > 0
      ? `${chatUnreadCount} 条未读`
      : `${messageCount} 条消息`;

  return (
    <aside className="side-stack" data-sidebar-mode={isMobileSidebar ? "mobile" : "desktop"}>
      <CollapsiblePanel
        panelId="chat-panel"
        title="聊天"
        subtitle={chatSubtitle}
        collapsed={chatCollapsed}
        onToggle={() => onTogglePanel("chat")}
        grow="chat"
      >
        <RoomChatPanel
          store={store}
          collapsed={chatCollapsed}
          value={chatDraft}
          onUnreadCountChange={onChatUnreadCountChange}
          onChange={onChatDraftChange}
          onSend={onSendChat}
        />
      </CollapsiblePanel>

      <CollapsiblePanel
        panelId="members-panel"
        title="房间成员"
        subtitle={`${onlineCount} 在线`}
        collapsed={membersCollapsed}
        onToggle={() => onTogglePanel("members")}
        grow="members"
      >
        <RoomMembersPanel store={store} />
      </CollapsiblePanel>

      <CollapsiblePanel
        panelId="timeline-panel"
        title="房间动态"
        subtitle={timelineSubtitle}
        collapsed={timelineCollapsed}
        onToggle={() => onTogglePanel("timeline")}
        grow="timeline"
      >
        <RoomTimelinePanel
          store={store}
          collapsed={timelineCollapsed}
          onUnreadCountChange={onTimelineUnreadCountChange}
        />
      </CollapsiblePanel>

      <CollapsiblePanel
        panelId="appearance-panel"
        title="快速换装"
        subtitle={appearanceSubtitle}
        collapsed={appearanceCollapsed}
        onToggle={() => onTogglePanel("appearance")}
        grow="appearance"
      >
        <RoomAppearancePanel
          store={store}
          profile={profile}
          ambientAudioEnabled={ambientAudioEnabled}
          onChangeAvatar={onChangeAvatar}
          onChangeAmbientAudioEnabled={onChangeAmbientAudioEnabled}
        />
      </CollapsiblePanel>
    </aside>
  );
};

export const App = () => {
  const store = useMemo(() => new RoomStore(), []);
  const [profile, setProfile] = useState(loadProfile);
  const [ambientAudioEnabled, setAmbientAudioEnabled] = useState(() =>
    loadAmbientAudioPreference(
      typeof window === "undefined" ? undefined : window.localStorage,
    ),
  );
  const [stageUiMode, setStageUiMode] = useState<StageUiMode>("prejoin");
  const [viewportMode, setViewportMode] = useState<ViewportMode>(
    DEFAULT_VIEWPORT_MODE,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [timelineUnreadCount, setTimelineUnreadCount] = useState(0);
  const [entryHintVisible, setEntryHintVisible] = useState(false);
  const [hasShownEntryHint, setHasShownEntryHint] = useState(false);
  const [isMobileSidebar, setIsMobileSidebar] = useState(getIsMobileSidebar);
  const [collapsedPanels, setCollapsedPanels] = useState(() =>
    loadCollapsedPanels(
      typeof window === "undefined" ? undefined : window.localStorage,
    ),
  );
  const joinedRoomTheme = useRoomStoreSelector(store, (state) => state.roomTheme) ?? ROOM_THEME;
  const hasJoinedRoom = useRoomStoreSelector(store, (state) =>
    getHasJoinedRoom(state.connectionStatus, state.selfUserId),
  );

  useAmbientRoomAudio({
    roomTheme: joinedRoomTheme,
    enabled: ambientAudioEnabled,
    hasJoinedRoom,
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_SIDEBAR_MEDIA_QUERY);
    const syncViewport = () => {
      setIsMobileSidebar(mediaQuery.matches);
    };

    syncViewport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => {
        mediaQuery.removeEventListener("change", syncViewport);
      };
    }

    mediaQuery.addListener(syncViewport);
    return () => {
      mediaQuery.removeListener(syncViewport);
    };
  }, []);

  useEffect(() => {
    setCollapsedPanels((previous) =>
      normalizeCollapsedPanelsForViewport(previous, isMobileSidebar),
    );
  }, [isMobileSidebar]);

  useEffect(() => {
    saveCollapsedPanels(
      collapsedPanels,
      typeof window === "undefined" ? undefined : window.localStorage,
    );
  }, [collapsedPanels]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    safeStorageSetItem(
      window.localStorage,
      PROFILE_STORAGE_KEY,
      JSON.stringify(profile),
    );
  }, [profile]);

  useEffect(() => {
    saveAmbientAudioPreference(
      ambientAudioEnabled,
      typeof window === "undefined" ? undefined : window.localStorage,
    );
  }, [ambientAudioEnabled]);

  useEffect(() => {
    setStageUiMode(hasJoinedRoom ? "joined" : "prejoin");

    if (!hasJoinedRoom) {
      setViewportMode(DEFAULT_VIEWPORT_MODE);
      setDrawerOpen(false);
      setChatDraft("");
      setChatUnreadCount(0);
      setTimelineUnreadCount(0);
      setEntryHintVisible(false);
    }
  }, [hasJoinedRoom]);

  useEffect(() => {
    if (!hasJoinedRoom) {
      return;
    }

    setDrawerOpen(false);
    setViewportMode("look");

    if (hasShownEntryHint) {
      return;
    }

    setHasShownEntryHint(true);
    setEntryHintVisible(true);
    const timer = window.setTimeout(() => {
      setEntryHintVisible(false);
    }, ENTRY_HINT_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [hasJoinedRoom, hasShownEntryHint]);

  useEffect(() => {
    if (!hasJoinedRoom) {
      return;
    }

    const interval = window.setInterval(() => {
      store.pruneExpiredRecentActivity();
    }, RECENT_ACTIVITY_PRUNE_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [hasJoinedRoom, store]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const idleWindow = window as IdleWindow;
    const warmupScene = () => {
      void preloadRoomViewport3D().catch(() => undefined);
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      const idleHandle = idleWindow.requestIdleCallback(warmupScene);
      return () => {
        idleWindow.cancelIdleCallback?.(idleHandle);
      };
    }

    const timeoutHandle = window.setTimeout(warmupScene, 280);
    return () => {
      window.clearTimeout(timeoutHandle);
    };
  }, []);

  const client = useMemo(
    () =>
      new ChatSocketClient({
        onConnectionStatus: (status) => {
          if (status === "connecting" || status === "joined" || status === "idle") {
            store.setConnectionErrorMessage(null);
          }

          if (status === "disconnected" || status === "error") {
            store.clearActiveRoom(status);
            setViewportMode(DEFAULT_VIEWPORT_MODE);
            setDrawerOpen(false);
            setChatDraft("");
            return;
          }

          store.setConnectionStatus(status);
        },
        onConnectionErrorMessage: (message) => {
          store.setConnectionErrorMessage(message);
        },
        onRoomSnapshot: (snapshot) => {
          store.applySnapshot(snapshot);
          client.setSessionToken(snapshot.sessionToken);
          safeStorageSetItem(
            window.localStorage,
            SESSION_STORAGE_KEY,
            snapshot.sessionToken,
          );
          client.syncReady(snapshot.roomId);
        },
        onUserJoined: (user) => {
          store.upsertUser(user);
        },
        onUserLeft: ({ userId }) => {
          store.removeUser(userId);
        },
        onUserMoved: (user) => {
          store.upsertUser(user);
        },
        onChatPosted: (message: ChatMessage) => {
          store.addMessage(message);
        },
        onTimelineEntry: (entry) => {
          store.addTimelineEntry(entry);
        },
        onSystemNotice: (notice) => {
          store.pushNotice(notice);
        },
      }),
    [store],
  );

  useEffect(() => {
    return () => {
      client.disconnect();
    };
  }, [client]);

  const handleJoin = useCallback(() => {
    const nickname = profile.nickname.trim();
    if (!nickname) {
      return;
    }

    void preloadRoomViewport3D().catch(() => undefined);
    client.connect({
      roomId: DEFAULT_ROOM_ID,
      nickname,
      avatar: profile.avatar,
      sessionToken: loadSessionToken(),
    });
  }, [client, profile.avatar, profile.nickname]);

  const handleAvatarChange = useCallback(
    (avatar: AvatarCosmetic) => {
      setProfile((previous) => ({
        ...previous,
        avatar,
      }));

      if (!hasJoinedRoom) {
        return;
      }

      client.updateAvatar({
        avatar,
      });
    },
    [client, hasJoinedRoom],
  );

  const handleSendChat = useCallback(() => {
    const text = chatDraft.trim();
    if (!text || !hasJoinedRoom) {
      return false;
    }

    void unlockBubbleSound();
    client.sendChat(text);
    setChatDraft("");
    return true;
  }, [chatDraft, client, hasJoinedRoom]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    if (hasJoinedRoom) {
      setViewportMode("look");
    }
  }, [hasJoinedRoom]);

  const openDrawer = useCallback(() => {
    if (!hasJoinedRoom) {
      return;
    }

    setDrawerOpen(true);
    setViewportMode("ui");
    setEntryHintVisible(false);
  }, [hasJoinedRoom]);

  const toggleDrawer = useCallback(() => {
    if (drawerOpen) {
      closeDrawer();
      return;
    }

    openDrawer();
  }, [closeDrawer, drawerOpen, openDrawer]);

  const handleTogglePanel = useCallback(
    (panel: keyof typeof defaultCollapsedPanels) => {
      setCollapsedPanels((previous) =>
        toggleCollapsedPanel(previous, panel, isMobileSidebar),
      );
    },
    [isMobileSidebar],
  );

  const handleViewportModeChange = useCallback((mode: ViewportMode) => {
    setViewportMode(mode);
    if (mode !== "ui") {
      setDrawerOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!hasJoinedRoom) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (isDrawerHotkeyBlocked(event.target)) {
        return;
      }

      const normalizedKey = event.key.toLowerCase();
      if (normalizedKey === "m") {
        event.preventDefault();
        toggleDrawer();
        return;
      }

      if (normalizedKey === "escape" && drawerOpen) {
        event.preventDefault();
        closeDrawer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDrawer, drawerOpen, hasJoinedRoom, toggleDrawer]);

  const drawerUnreadCount = chatUnreadCount + timelineUnreadCount;

  return (
    <div className="app-shell">
      <div className="room-backdrop" />
      <main
        className="app-layout"
        data-sidebar-visible={drawerOpen ? "true" : "false"}
        data-drawer-open={drawerOpen ? "true" : "false"}
        data-control-mode={resolveSceneControlMode(viewportMode)}
      >
        <RoomStage
          store={store}
          client={client}
          profile={profile}
          uiMode={stageUiMode}
          viewportMode={viewportMode}
          drawerOpen={drawerOpen}
          chatDraft={chatDraft}
          entryHintVisible={entryHintVisible}
          onNicknameChange={(nickname) =>
            setProfile((previous) => ({
              ...previous,
              nickname,
            }))
          }
          onAvatarChange={(avatar) =>
            setProfile((previous) => ({
              ...previous,
              avatar,
            }))
          }
          onJoin={handleJoin}
          onViewportModeChange={handleViewportModeChange}
          onChatDraftChange={setChatDraft}
          onSendChat={handleSendChat}
        />

        {stageUiMode === "joined" ? (
          <>
            {!drawerOpen ? (
              <button
                type="button"
                className="room-drawer-toggle"
                aria-controls="room-drawer"
                aria-expanded={drawerOpen}
                onClick={openDrawer}
              >
                面板
                {drawerUnreadCount > 0 ? (
                  <span className="room-drawer-toggle__badge">{drawerUnreadCount}</span>
                ) : null}
              </button>
            ) : null}

            <button
              type="button"
              className="room-drawer-scrim"
              aria-hidden={drawerOpen ? "false" : "true"}
              tabIndex={drawerOpen ? 0 : -1}
              onClick={closeDrawer}
            />

            <aside
              id="room-drawer"
              className="room-drawer"
              data-open={drawerOpen ? "true" : "false"}
              aria-hidden={drawerOpen ? "false" : "true"}
            >
              <header className="room-drawer__header">
                <div className="room-drawer__title-group">
                  <span className="room-drawer__eyebrow">Warm lounge</span>
                  <strong>房间面板</strong>
                  <span>把聊天、动态和换装收在一处，视线仍留给休息室本身。</span>
                </div>
                <button
                  type="button"
                  className="room-drawer__close"
                  onClick={closeDrawer}
                >
                  收起
                </button>
              </header>

              <div className="room-drawer__body">
                <RoomSidebar
                  store={store}
                  profile={profile}
                  ambientAudioEnabled={ambientAudioEnabled}
                  drawerOpen={drawerOpen}
                  isMobileSidebar={isMobileSidebar}
                  collapsedPanels={collapsedPanels}
                  chatDraft={chatDraft}
                  chatUnreadCount={chatUnreadCount}
                  timelineUnreadCount={timelineUnreadCount}
                  onTogglePanel={handleTogglePanel}
                  onChangeAvatar={handleAvatarChange}
                  onChangeAmbientAudioEnabled={setAmbientAudioEnabled}
                  onChatUnreadCountChange={setChatUnreadCount}
                  onTimelineUnreadCountChange={setTimelineUnreadCount}
                  onChatDraftChange={setChatDraft}
                  onSendChat={() => {
                    void handleSendChat();
                  }}
                />
              </div>
            </aside>
          </>
        ) : null}
      </main>
    </div>
  );
};

export default App;
