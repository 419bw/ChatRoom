import type { TimelineEntry } from "@chat/protocol";
import { useEffect, useRef, useState } from "react";

import {
  getTimelineActorName,
  getTimelineCategoryLabel,
  getTimelineSummary,
} from "../domain/recentActivity";

type TimelinePanelProps = {
  collapsed: boolean;
  entries: TimelineEntry[];
  onUnreadCountChange?: (count: number) => void;
};

const BOTTOM_THRESHOLD_PX = 24;

const isNearBottom = (element: HTMLDivElement) =>
  element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_THRESHOLD_PX;

export const TimelinePanel = ({
  collapsed,
  entries,
  onUnreadCountChange,
}: TimelinePanelProps) => {
  const historyRef = useRef<HTMLDivElement | null>(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const previousEntryCountRef = useRef(0);
  const previousCollapsedRef = useRef(collapsed);
  const hasInitializedRef = useRef(false);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const element = historyRef.current;
    if (!element) {
      return;
    }

    if (typeof element.scrollTo === "function") {
      element.scrollTo({
        top: element.scrollHeight,
        behavior,
      });
    }

    element.scrollTop = element.scrollHeight;
  };

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [onUnreadCountChange, unreadCount]);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      previousEntryCountRef.current = entries.length;
      previousCollapsedRef.current = collapsed;

      if (!collapsed && entries.length > 0) {
        requestAnimationFrame(() => {
          scrollToBottom("auto");
        });
      }

      return;
    }

    const previousCount = previousEntryCountRef.current;
    const delta = entries.length - previousCount;

    if (delta <= 0) {
      previousEntryCountRef.current = entries.length;
      previousCollapsedRef.current = collapsed;
      return;
    }

    if (collapsed) {
      previousEntryCountRef.current = entries.length;
      previousCollapsedRef.current = true;
      setUnreadCount((current) => current + delta);
      return;
    }

    const shouldStickToBottom =
      previousCollapsedRef.current ||
      previousCount === 0 ||
      isPinnedToBottom;

    if (shouldStickToBottom && entries.length > 0) {
      requestAnimationFrame(() => {
        scrollToBottom(previousCollapsedRef.current ? "auto" : "smooth");
      });
      setUnreadCount(0);
    } else {
      setUnreadCount((current) => current + delta);
    }

    previousEntryCountRef.current = entries.length;
    previousCollapsedRef.current = false;
  }, [collapsed, entries.length, isPinnedToBottom]);

  const handleScroll = () => {
    const element = historyRef.current;
    if (!element) {
      return;
    }

    const nextPinned = isNearBottom(element);
    setIsPinnedToBottom(nextPinned);
    if (nextPinned) {
      setUnreadCount(0);
    }
  };

  const handleJumpToLatest = () => {
    setIsPinnedToBottom(true);
    setUnreadCount(0);
    requestAnimationFrame(() => {
      scrollToBottom("smooth");
    });
  };

  const showJumpToLatest = !collapsed && (unreadCount > 0 || !isPinnedToBottom);

  return (
    <>
      <div className="timeline-history" ref={historyRef} onScroll={handleScroll}>
        {entries.length ? (
          entries.map((entry) => (
            <article key={entry.id} className="timeline-item">
              <div className="timeline-item__meta">
                <span className="timeline-category-chip">
                  {getTimelineCategoryLabel(entry.category)}
                </span>
                <span>
                  {new Date(entry.createdAt).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <strong>{getTimelineActorName(entry)}</strong>
              <p>{getTimelineSummary(entry)}</p>
            </article>
          ))
        ) : (
          <div className="timeline-empty">还没有房间动态，等第一位成员动起来。</div>
        )}
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          className="timeline-jump-chip"
          onClick={handleJumpToLatest}
        >
          {unreadCount > 0 ? `有 ${unreadCount} 条未读动态，回到底部` : "回到底部"}
        </button>
      ) : null}
    </>
  );
};

export default TimelinePanel;
