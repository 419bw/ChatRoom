import { avatarCosmetics, type AvatarCosmetic } from "@chat/protocol";
import { useRef } from "react";

import { avatarLabels } from "./avatarLabels";

type JoinOverlayProps = {
  nickname: string;
  avatar: AvatarCosmetic;
  statusText: string;
  errorMessage?: string | null;
  busy: boolean;
  onNicknameChange: (value: string) => void;
  onAvatarChange: (value: AvatarCosmetic) => void;
  onSubmit: () => void;
};

export const JoinOverlay = ({
  nickname,
  avatar,
  statusText,
  errorMessage = null,
  busy,
  onNicknameChange,
  onAvatarChange,
  onSubmit,
}: JoinOverlayProps) => {
  const isComposingRef = useRef(false);

  return (
    <div className="join-overlay">
      <div className="join-card">
        <span className="eyebrow">Warm Lounge · 3D</span>
        <h1>暖光会客室</h1>
        <p>
          选一个名字和基础形象就能进入休息室；入房后默认进入空间视角，
          <code>Enter</code>
          可直接聊天。
        </p>

        {errorMessage ? (
          <div className="join-issue join-issue--error" role="alert">
            <strong>进入房间失败</strong>
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <label className="field">
          <span>游客昵称</span>
          <input
            value={nickname}
            maxLength={16}
            placeholder="例如：阿青"
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            onChange={(event) => onNicknameChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !busy &&
                !isComposingRef.current &&
                !event.nativeEvent.isComposing
              ) {
                onSubmit();
              }
            }}
          />
        </label>

        <div className="field">
          <span>基础外观</span>
          <div className="avatar-grid">
            {avatarCosmetics.map((cosmetic) => (
              <button
                key={cosmetic}
                className={cosmetic === avatar ? "avatar-swatch active" : "avatar-swatch"}
                data-cosmetic={cosmetic}
                onClick={() => onAvatarChange(cosmetic)}
                type="button"
              >
                <span />
                {avatarLabels[cosmetic]}
              </button>
            ))}
          </div>
        </div>

        <div className="join-footer">
          <span>{statusText}</span>
          <button onClick={onSubmit} disabled={busy || !nickname.trim()}>
            {busy ? "连接中..." : errorMessage ? "重新进入" : "进入房间"}
          </button>
        </div>
      </div>
    </div>
  );
};
