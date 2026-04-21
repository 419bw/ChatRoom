import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";

export type ChatComposerHandle = {
  focusToEnd: () => boolean;
  blurAndReset: () => boolean;
  getElement: () => HTMLTextAreaElement | null;
};

type ChatComposerProps = {
  value: string;
  disabled?: boolean;
  autoFocus?: boolean;
  focusSignal?: number;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  maxLength?: number;
  className?: string;
  showCancelButton?: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel?: () => void;
};

const joinClassNames = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

const focusTextareaToEnd = (textarea: HTMLTextAreaElement | null) => {
  if (!textarea) {
    return false;
  }

  textarea.focus();
  const length = textarea.value.length;
  textarea.setSelectionRange(length, length);
  return true;
};

const blurTextareaAndReset = (textarea: HTMLTextAreaElement | null) => {
  if (!textarea) {
    return false;
  }

  try {
    textarea.setSelectionRange(0, 0);
  } catch {
    // 某些输入法状态下可能拒绝设置选区，这里忽略即可。
  }

  textarea.blur();
  return true;
};

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
  (
    {
      value,
      disabled = false,
      autoFocus = false,
      focusSignal = 0,
      placeholder = "输入聊天内容...",
      submitLabel = "发送",
      cancelLabel = "取消",
      maxLength = 120,
      className,
      showCancelButton = false,
      onChange,
      onSend,
      onCancel,
    },
    forwardedRef,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const isComposingRef = useRef(false);
    const previousFocusSignalRef = useRef(0);

    useImperativeHandle(
      forwardedRef,
      () => ({
        focusToEnd: () => focusTextareaToEnd(textareaRef.current),
        blurAndReset: () => blurTextareaAndReset(textareaRef.current),
        getElement: () => textareaRef.current,
      }),
      [],
    );

    useLayoutEffect(() => {
      if (disabled || !textareaRef.current) {
        return;
      }

      const shouldFocus = autoFocus || focusSignal > previousFocusSignalRef.current;
      if (!shouldFocus) {
        return;
      }

      previousFocusSignalRef.current = focusSignal;
      requestAnimationFrame(() => {
        void focusTextareaToEnd(textareaRef.current);
      });
    }, [autoFocus, disabled, focusSignal]);

    const handleSend = () => {
      if (disabled || !value.trim()) {
        return;
      }

      onSend();
    };

    return (
      <div className={joinClassNames("chat-input-row", className)}>
        <textarea
          ref={textareaRef}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && onCancel) {
              event.preventDefault();
              onCancel();
              return;
            }

            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !isComposingRef.current &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              handleSend();
            }
          }}
        />

        <div
          className={joinClassNames(
            "chat-input-row__actions",
            !showCancelButton && "chat-input-row__actions--single",
          )}
        >
          {showCancelButton ? (
            <button
              type="button"
              className="chat-input-row__cancel"
              onClick={onCancel}
              disabled={disabled}
            >
              {cancelLabel}
            </button>
          ) : null}
          <button type="button" onClick={handleSend} disabled={disabled || !value.trim()}>
            {submitLabel}
          </button>
        </div>
      </div>
    );
  },
);

ChatComposer.displayName = "ChatComposer";

export default ChatComposer;
