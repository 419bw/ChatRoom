import type { ChatMessage } from "@chat/protocol";
import { useEffect, useRef, useState } from "react";

import { ChatComposer } from "./ChatComposer";

type ChatPanelProps = {
  collapsed: boolean;
  messages: ChatMessage[];
  value: string;
  disabled?: boolean;
  focusSignal?: number;
  showComposer?: boolean;
  onUnreadCountChange?: (count: number) => void;
  onChange: (value: string) => void;
  onSend: () => void;
};

const BOTTOM_THRESHOLD_PX = 24;

const isNearBottom = (element: HTMLDivElement) =>
  element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_THRESHOLD_PX;

export const ChatPanel = ({
  collapsed,
  messages,
  value,
  disabled = false,
  focusSignal = 0,
  showComposer = true,
  onUnreadCountChange,
  onChange,
  onSend,
}: ChatPanelProps) => {
  const historyRef = useRef<HTMLDivElement | null>(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const forcePinAfterSendRef = useRef(false);
  const previousMessageCountRef = useRef(0);
  const previousCollapsedRef = useRef(collapsed);

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
    const previousCount = previousMessageCountRef.current;
    const delta = messages.length - previousCount;

    if (delta <= 0) {
      previousMessageCountRef.current = messages.length;
      previousCollapsedRef.current = collapsed;
      return;
    }

    if (collapsed) {
      previousMessageCountRef.current = messages.length;
      previousCollapsedRef.current = true;
      setUnreadCount((current) => current + delta);
      return;
    }

    const justExpanded = previousCollapsedRef.current;
    const hadMessagesBefore = previousCount > 0;
    const shouldStickToBottom =
      forcePinAfterSendRef.current ||
      (!hadMessagesBefore && messages.length > 0) ||
      (delta > 0 && isPinnedToBottom) ||
      (justExpanded && isPinnedToBottom);

    if (shouldStickToBottom && messages.length > 0) {
      requestAnimationFrame(() => {
        scrollToBottom(forcePinAfterSendRef.current ? "auto" : "smooth");
      });
      setUnreadCount(0);
    } else {
      setUnreadCount((current) => current + delta);
    }

    previousMessageCountRef.current = messages.length;
    previousCollapsedRef.current = false;
    forcePinAfterSendRef.current = false;
  }, [collapsed, isPinnedToBottom, messages.length]);

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

  const handleSend = () => {
    if (disabled || !value.trim()) {
      return;
    }

    forcePinAfterSendRef.current = true;
    setIsPinnedToBottom(true);
    setUnreadCount(0);
    onSend();
  };

  const showJumpToLatest = !collapsed && (unreadCount > 0 || !isPinnedToBottom);

  return (
    <>
      <div className="chat-history" ref={historyRef} onScroll={handleScroll}>
        {messages.length ? (
          messages.map((message) => (
            <article key={message.id} className="chat-item">
              <div className="chat-item-meta">
                <strong>{message.nickname}</strong>
                <span>
                  {new Date(message.sentAt).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p>{message.text}</p>
            </article>
          ))
        ) : (
          <div className="chat-empty">还没有聊天内容，发出第一句话吧。</div>
        )}
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          className="chat-jump-chip"
          onClick={handleJumpToLatest}
        >
          {unreadCount > 0 ? `有 ${unreadCount} 条新消息，回到底部` : "回到底部"}
        </button>
      ) : null}

      {showComposer ? (
        <ChatComposer
          value={value}
          disabled={disabled}
          focusSignal={focusSignal}
          onChange={onChange}
          onSend={handleSend}
        />
      ) : null}
    </>
  );
};

export default ChatPanel;
