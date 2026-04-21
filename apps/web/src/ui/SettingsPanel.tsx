import { avatarCosmetics, type AvatarCosmetic } from "@chat/protocol";

import { avatarLabels } from "./avatarLabels";

type SettingsPanelProps = {
  currentAvatar: AvatarCosmetic;
  disabled?: boolean;
  ambientAudioEnabled?: boolean;
  onChangeAvatar: (avatar: AvatarCosmetic) => void;
  onChangeAmbientAudioEnabled?: (enabled: boolean) => void;
};

export const SettingsPanel = ({
  currentAvatar,
  disabled,
  ambientAudioEnabled,
  onChangeAvatar,
  onChangeAmbientAudioEnabled,
}: SettingsPanelProps) => (
  <div className="settings-panel">
    <div className="settings-actions">
      {avatarCosmetics.map((avatar) => (
        <button
          key={avatar}
          type="button"
          className={avatar === currentAvatar ? "mini-avatar active" : "mini-avatar"}
          data-cosmetic={avatar}
          disabled={disabled}
          onClick={() => onChangeAvatar(avatar)}
        >
          {avatarLabels[avatar]}
        </button>
      ))}
    </div>

    {typeof ambientAudioEnabled === "boolean" && onChangeAmbientAudioEnabled ? (
      <section className="settings-audio-card">
        <div className="settings-audio-card__copy">
          <strong>环境音</strong>
          <span>入房并完成一次交互后开始播放，可随时关闭。</span>
        </div>
        <button
          type="button"
          className={ambientAudioEnabled ? "settings-audio-toggle is-active" : "settings-audio-toggle"}
          onClick={() => onChangeAmbientAudioEnabled(!ambientAudioEnabled)}
        >
          {ambientAudioEnabled ? "已开启" : "已关闭"}
        </button>
      </section>
    ) : null}
  </div>
);
