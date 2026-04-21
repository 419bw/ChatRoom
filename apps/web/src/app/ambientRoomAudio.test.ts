import { describe, expect, test } from "vitest";

import {
  AMBIENT_AUDIO_STORAGE_KEY,
  loadAmbientAudioPreference,
  resolveShouldPlayAmbientAudio,
  saveAmbientAudioPreference,
} from "./ambientRoomAudio";

describe("ambientRoomAudio", () => {
  test("环境音偏好默认开启", () => {
    expect(loadAmbientAudioPreference()).toBe(true);
  });

  test("保存后会从 localStorage 恢复环境音偏好", () => {
    let savedValue = "";
    const storage = {
      getItem: (key: string) => (key === AMBIENT_AUDIO_STORAGE_KEY ? savedValue : null),
      setItem: (_key: string, value: string) => {
        savedValue = value;
      },
    };

    saveAmbientAudioPreference(false, storage);
    expect(loadAmbientAudioPreference(storage)).toBe(false);
  });

  test("保存环境音偏好写入失败时不会抛出异常", () => {
    expect(() =>
      saveAmbientAudioPreference(true, {
        setItem: () => {
          throw new DOMException("denied", "SecurityError");
        },
      }),
    ).not.toThrow();
  });

  test("只有入房、可见、已激活、非自动化且开启时才允许播放环境音", () => {
    expect(
      resolveShouldPlayAmbientAudio({
        enabled: true,
        hasJoinedRoom: true,
        hasUserActivation: true,
        isDocumentVisible: true,
        isAutomation: false,
        ambientLoopUrl: "/audio/warm-lounge-ambient.wav",
      }),
    ).toBe(true);

    expect(
      resolveShouldPlayAmbientAudio({
        enabled: true,
        hasJoinedRoom: false,
        hasUserActivation: true,
        isDocumentVisible: true,
        isAutomation: false,
        ambientLoopUrl: "/audio/warm-lounge-ambient.wav",
      }),
    ).toBe(false);

    expect(
      resolveShouldPlayAmbientAudio({
        enabled: true,
        hasJoinedRoom: true,
        hasUserActivation: true,
        isDocumentVisible: false,
        isAutomation: false,
        ambientLoopUrl: "/audio/warm-lounge-ambient.wav",
      }),
    ).toBe(false);

    expect(
      resolveShouldPlayAmbientAudio({
        enabled: true,
        hasJoinedRoom: true,
        hasUserActivation: true,
        isDocumentVisible: true,
        isAutomation: true,
        ambientLoopUrl: "/audio/warm-lounge-ambient.wav",
      }),
    ).toBe(false);
  });
});
