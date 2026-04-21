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
      <div className="join-card join-card-animated">
        <div className="join-header">
          <span className="eyebrow">Warm Lounge · Evening</span>
          <h1>暖光会客室</h1>
          <p>
            选一个名字和基础形象进入休息室。<br/>进房后可直接用 <code>Enter</code> 聊天。
          </p>
        </div>

        {errorMessage ? (
          <div className="join-issue join-issue--error" role="alert">
            <strong>连接受阻</strong>
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <label className="field hover-field">
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
                <div className="swatch-inner">
                  <span className="swatch-indicator" />
                  {avatarLabels[cosmetic]}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="join-footer">
          <span className="status-text">{statusText}</span>
          <button className="join-btn" onClick={onSubmit} disabled={busy || !nickname.trim()}>
            {busy ? "正在连接..." : errorMessage ? "重新尝试" : "开启体验"}
          </button>
        </div>
      </div>
    </div>
  );
};
