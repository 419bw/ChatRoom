import type {
  TimelineEntry,
  TimelineCategory,
  UserPresenceState,
} from "@chat/protocol";

export const TIMELINE_ENTRY_LIMIT = 40;
export const TIMELINE_PANEL_LIMIT = 12;

export type RecentActivityKind =
  | "joined"
  | "spoke"
  | "changed-avatar"
  | "reconnected";

export type RecentActivityState = {
  kind: RecentActivityKind;
  updatedAt: number;
  expiresAt: number;
  sourceEntryId: string;
};

export type RecentActivityByUserId = Record<string, RecentActivityState>;

const RECENT_ACTIVITY_TTL_MS: Record<RecentActivityKind, number> = {
  joined: 10_000,
  spoke: 8_000,
  "changed-avatar": 6_000,
  reconnected: 10_000,
};

const RECENT_ACTIVITY_PRIORITY: Record<RecentActivityKind, number> = {
  spoke: 4,
  reconnected: 3,
  joined: 2,
  "changed-avatar": 1,
};

const isStringMetaValue = (value: TimelineEntry["meta"][string] | undefined): value is string =>
  typeof value === "string" && value.length > 0;

const resolveRecentActivityKind = (
  entry: TimelineEntry,
): RecentActivityKind | null => {
  if (entry.category === "chat_message") {
    return "spoke";
  }

  if (entry.category === "avatar_event") {
    return "changed-avatar";
  }

  if (entry.category !== "presence_event") {
    return null;
  }

  const action = entry.meta.action;
  if (action === "join") {
    return "joined";
  }

  if (action === "reconnect") {
    return "reconnected";
  }

  return null;
};

export const resolveRecentActivityFromTimelineEntry = (
  entry: TimelineEntry,
  now = Date.now(),
): { userId: string; activity: RecentActivityState } | null => {
  const userId = entry.actorId;
  const kind = resolveRecentActivityKind(entry);
  if (!userId || !kind) {
    return null;
  }

  const expiresAt = entry.createdAt + RECENT_ACTIVITY_TTL_MS[kind];
  if (expiresAt <= now) {
    return null;
  }

  return {
    userId,
    activity: {
      kind,
      updatedAt: entry.createdAt,
      expiresAt,
      sourceEntryId: entry.id,
    },
  };
};

export const mergeTimelineEntries = (
  currentEntries: TimelineEntry[],
  incomingEntries: TimelineEntry[],
  limit = TIMELINE_ENTRY_LIMIT,
) => {
  const knownIds = new Set(currentEntries.map((entry) => entry.id));
  const merged = [...currentEntries];

  for (const entry of incomingEntries) {
    if (knownIds.has(entry.id)) {
      continue;
    }

    knownIds.add(entry.id);
    merged.push(entry);
  }

  return merged
    .slice()
    .sort((left, right) => left.createdAt - right.createdAt)
    .slice(-limit);
};

export const deriveRecentActivityByUserId = (
  entries: TimelineEntry[],
  now = Date.now(),
) => {
  const nextActivities: RecentActivityByUserId = {};
  const sortedEntries = entries
    .slice()
    .sort((left, right) => left.createdAt - right.createdAt);

  for (const entry of sortedEntries) {
    const resolved = resolveRecentActivityFromTimelineEntry(entry, now);
    if (!resolved) {
      continue;
    }

    nextActivities[resolved.userId] = resolved.activity;
  }

  return nextActivities;
};

export const pruneExpiredRecentActivityByUserId = (
  activities: RecentActivityByUserId,
  now = Date.now(),
) => {
  const nextActivities: RecentActivityByUserId = {};

  for (const [userId, activity] of Object.entries(activities)) {
    if (activity.expiresAt > now) {
      nextActivities[userId] = activity;
    }
  }

  return nextActivities;
};

export const getRecentActivityLabel = (activity: RecentActivityState | null | undefined) => {
  if (!activity) {
    return null;
  }

  switch (activity.kind) {
    case "joined":
      return "刚加入";
    case "reconnected":
      return "已回到房间";
    case "spoke":
      return "刚发言";
    case "changed-avatar":
      return "换装";
    default:
      return null;
  }
};

export const compareUsersByRecentActivity = (
  left: UserPresenceState,
  right: UserPresenceState,
  activities: RecentActivityByUserId,
) => {
  const leftActivity = activities[left.userId];
  const rightActivity = activities[right.userId];

  if (leftActivity && !rightActivity) {
    return -1;
  }

  if (!leftActivity && rightActivity) {
    return 1;
  }

  if (leftActivity && rightActivity) {
    const priorityDelta =
      RECENT_ACTIVITY_PRIORITY[rightActivity.kind] -
      RECENT_ACTIVITY_PRIORITY[leftActivity.kind];
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    if (leftActivity.updatedAt !== rightActivity.updatedAt) {
      return rightActivity.updatedAt - leftActivity.updatedAt;
    }
  }

  if (left.position.y !== right.position.y) {
    return left.position.y - right.position.y;
  }

  return left.userId.localeCompare(right.userId);
};

export const getTimelineCategoryLabel = (category: TimelineCategory) => {
  switch (category) {
    case "chat_message":
      return "发言";
    case "presence_event":
      return "到场";
    case "avatar_event":
      return "换装";
    default:
      return "动态";
  }
};

export const getTimelineActorName = (entry: TimelineEntry) =>
  entry.actorName ?? entry.actorId ?? "房间";

export const getTimelineSummary = (entry: TimelineEntry) => {
  if (entry.category === "chat_message") {
    const preview = entry.meta.preview;
    return isStringMetaValue(preview) ? `发送了：${preview}` : "发送了一条消息";
  }

  if (entry.category === "avatar_event") {
    return "切换了外观";
  }

  if (entry.category === "presence_event") {
    const action = entry.meta.action;
    if (action === "join") {
      return "加入了房间";
    }
    if (action === "reconnect") {
      return "回到了房间";
    }
    if (action === "leave") {
      return "离开了房间";
    }
  }

  return entry.message;
};
