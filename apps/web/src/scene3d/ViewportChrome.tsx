import type { MutableRefObject } from "react";

import { type ChatComposerHandle, ChatComposer } from "../ui/ChatComposer";
import { useSceneRuntimeStoreSelector, type SceneRuntimeStore } from "./sceneRuntimeStore";
import { isViewportChatMode, isViewportLookMode, type ViewportMode } from "./sceneControl";

type ViewportChromeProps = {
  viewportMode: ViewportMode;
  runtimeStore: SceneRuntimeStore;
  chatValue: string;
  imeSinkRef: MutableRefObject<HTMLInputElement | null>;
  focusSinkRef: MutableRefObject<HTMLButtonElement | null>;
  crosshairRef: MutableRefObject<HTMLDivElement | null>;
  chatComposerRef: MutableRefObject<ChatComposerHandle | null>;
  onChatValueChange: (value: string) => void;
  onViewportChatSend: () => void;
  onViewportChatCancel: () => void;
};

export const ViewportChrome = ({
  viewportMode,
  runtimeStore,
  chatValue,
  imeSinkRef,
  focusSinkRef,
  crosshairRef,
  chatComposerRef,
  onChatValueChange,
  onViewportChatSend,
  onViewportChatCancel,
}: ViewportChromeProps) => {
  const pointerSnapshot = useSceneRuntimeStoreSelector(
    runtimeStore,
    (snapshot) => snapshot.pointer,
  );
  const isChatOpen = isViewportChatMode(viewportMode);
  const showCrosshair =
    isViewportLookMode(viewportMode) &&
    !isChatOpen &&
    (pointerSnapshot.isLocked || pointerSnapshot.isDragLookActive);

  return (
    <>
      <input
        ref={imeSinkRef}
        className="room-viewport__ime-sink"
        tabIndex={-1}
        aria-hidden="true"
        autoComplete="off"
      />
      <button
        ref={focusSinkRef}
        type="button"
        className="room-viewport__focus-sink"
        tabIndex={-1}
        aria-hidden="true"
      />

      {showCrosshair ? (
        <div
          ref={crosshairRef}
          className="room-viewport__crosshair"
          aria-hidden="true"
        />
      ) : null}

      {isChatOpen ? (
        <div
          className="room-viewport__chat-overlay"
          onClick={(event) => {
            event.stopPropagation();
          }}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
        >
          <div className="room-viewport__chat-card">
            <p>消息会直接浮在休息室视口里，发送后立刻回到场景。</p>
            <ChatComposer
              ref={chatComposerRef}
              className="chat-input-row--viewport"
              value={chatValue}
              autoFocus
              showCancelButton
              onChange={onChatValueChange}
              onSend={onViewportChatSend}
              onCancel={onViewportChatCancel}
            />
          </div>
        </div>
      ) : null}

      {pointerSnapshot.promptVisible && !isChatOpen ? (
        <div className="room-viewport__pointer-hint" role="status">
          点击场景重新进入视角
        </div>
      ) : null}
    </>
  );
};
