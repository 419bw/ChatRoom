import { useEffect, useMemo, useRef, useState } from "react";

import { resolveRoomAudioAsset } from "../scene3d/assetManifest";
import type { RoomTheme } from "@chat/protocol";
import { safeStorageGetItem, safeStorageSetItem } from "./browserStorage";

export const AMBIENT_AUDIO_STORAGE_KEY = "ui:ambient-audio:v1";
const AMBIENT_AUDIO_TARGET_VOLUME = 0.22;
const AMBIENT_AUDIO_FADE_STEP = 0.04;
const AMBIENT_AUDIO_FADE_INTERVAL_MS = 80;

export const loadAmbientAudioPreference = (
  storage?: Pick<Storage, "getItem"> | undefined,
) => {
  const raw = safeStorageGetItem(storage, AMBIENT_AUDIO_STORAGE_KEY);
  if (raw === null) {
    return true;
  }

  return raw === "true";
};

export const saveAmbientAudioPreference = (
  enabled: boolean,
  storage?: Pick<Storage, "setItem"> | undefined,
) => {
  safeStorageSetItem(
    storage,
    AMBIENT_AUDIO_STORAGE_KEY,
    enabled ? "true" : "false",
  );
};

export const resolveShouldPlayAmbientAudio = (input: {
  enabled: boolean;
  hasJoinedRoom: boolean;
  hasUserActivation: boolean;
  isDocumentVisible: boolean;
  isAutomation?: boolean;
  ambientLoopUrl?: string;
}) =>
  Boolean(
    input.enabled &&
      input.hasJoinedRoom &&
      input.hasUserActivation &&
      input.isDocumentVisible &&
      !input.isAutomation &&
      input.ambientLoopUrl,
  );

const clearFadeInterval = (handle: number | null) => {
  if (handle === null || typeof window === "undefined") {
    return;
  }

  window.clearInterval(handle);
};

const safePauseAudio = (audio: HTMLAudioElement) => {
  if (
    typeof navigator !== "undefined" &&
    /jsdom/i.test(navigator.userAgent)
  ) {
    return;
  }

  try {
    audio.pause();
  } catch {
    // jsdom 不实现 pause，这里忽略即可。
  }
};

const safePlayAudio = (audio: HTMLAudioElement) => {
  if (
    typeof navigator !== "undefined" &&
    /jsdom/i.test(navigator.userAgent)
  ) {
    return;
  }

  try {
    const playResult = audio.play();
    if (playResult && typeof playResult === "object" && "catch" in playResult) {
      void playResult.catch(() => undefined);
    }
  } catch {
    // 某些浏览器策略或测试环境下会阻止播放，这里直接忽略。
  }
};

export const useAmbientRoomAudio = (input: {
  roomTheme: RoomTheme;
  enabled: boolean;
  hasJoinedRoom: boolean;
}) => {
  const audioUrl = useMemo(
    () => resolveRoomAudioAsset(input.roomTheme).ambientLoopUrl,
    [input.roomTheme],
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const [hasUserActivation, setHasUserActivation] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const markUserActivated = () => {
      setHasUserActivation(true);
    };

    window.addEventListener("pointerdown", markUserActivated, {
      passive: true,
    });
    window.addEventListener("keydown", markUserActivated);

    return () => {
      window.removeEventListener("pointerdown", markUserActivated);
      window.removeEventListener("keydown", markUserActivated);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    clearFadeInterval(fadeIntervalRef.current);
    fadeIntervalRef.current = null;

    if (typeof Audio === "undefined" || !audioUrl) {
      audioRef.current = null;
      return;
    }

    const audio = new Audio(audioUrl);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    audioRef.current = audio;

    return () => {
      clearFadeInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
      safePauseAudio(audio);
      audio.src = "";
      audioRef.current = null;
    };
  }, [audioUrl]);

  const shouldPlay = resolveShouldPlayAmbientAudio({
    enabled: input.enabled,
    hasJoinedRoom: input.hasJoinedRoom,
    hasUserActivation,
    isDocumentVisible,
    isAutomation:
      typeof navigator !== "undefined" ? Boolean(navigator.webdriver) : false,
    ambientLoopUrl: audioUrl,
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || typeof window === "undefined") {
      return;
    }

    clearFadeInterval(fadeIntervalRef.current);
    fadeIntervalRef.current = null;

    if (shouldPlay) {
      audio.loop = true;
      safePlayAudio(audio);

      fadeIntervalRef.current = window.setInterval(() => {
        audio.volume = Math.min(
          AMBIENT_AUDIO_TARGET_VOLUME,
          audio.volume + AMBIENT_AUDIO_FADE_STEP,
        );

        if (audio.volume >= AMBIENT_AUDIO_TARGET_VOLUME) {
          clearFadeInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
      }, AMBIENT_AUDIO_FADE_INTERVAL_MS);

      return () => {
        clearFadeInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      };
    }

    fadeIntervalRef.current = window.setInterval(() => {
      audio.volume = Math.max(0, audio.volume - AMBIENT_AUDIO_FADE_STEP);

      if (audio.volume <= 0.001) {
        safePauseAudio(audio);
        audio.currentTime = 0;
        clearFadeInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
    }, AMBIENT_AUDIO_FADE_INTERVAL_MS);

    return () => {
      clearFadeInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    };
  }, [shouldPlay]);

  return {
    hasUserActivation,
    isDocumentVisible,
    shouldPlay,
  };
};
