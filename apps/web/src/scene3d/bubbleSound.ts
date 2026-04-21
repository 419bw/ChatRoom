export const BUBBLE_SOUND_THROTTLE_MS = 140;

type BubbleSoundControllerOptions = {
  now?: () => number;
  play: () => boolean;
  throttleMs?: number;
};

type BubbleAudioGlobal = typeof globalThis & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

let sharedAudioContext: AudioContext | null = null;

const getBubbleAudioContext = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const audioWindow = globalThis as BubbleAudioGlobal;
  const AudioContextCtor =
    audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  sharedAudioContext ??= new AudioContextCtor();
  return sharedAudioContext;
};

const playBubbleSynth = () => {
  const context = getBubbleAudioContext();
  if (!context || context.state !== "running") {
    return false;
  }

  const startAt = context.currentTime + 0.005;
  const durationSeconds = 0.1;
  const popPitch = 560 + Math.random() * 40;
  const clickPitch = 1180 + Math.random() * 120;
  const masterGain = context.createGain();
  masterGain.gain.setValueAtTime(0.0001, startAt);
  masterGain.gain.exponentialRampToValueAtTime(
    0.085 + Math.random() * 0.01,
    startAt + 0.012,
  );
  masterGain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSeconds);
  masterGain.connect(context.destination);

  const popOscillator = context.createOscillator();
  popOscillator.type = "triangle";
  popOscillator.frequency.setValueAtTime(popPitch, startAt);
  popOscillator.frequency.exponentialRampToValueAtTime(
    popPitch * 0.76,
    startAt + durationSeconds,
  );
  popOscillator.connect(masterGain);

  const clickOscillator = context.createOscillator();
  clickOscillator.type = "sine";
  clickOscillator.frequency.setValueAtTime(clickPitch, startAt);
  const clickGain = context.createGain();
  clickGain.gain.setValueAtTime(0.0001, startAt);
  clickGain.gain.exponentialRampToValueAtTime(0.05, startAt + 0.004);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.026);
  clickOscillator.connect(clickGain);
  clickGain.connect(masterGain);

  popOscillator.start(startAt);
  clickOscillator.start(startAt);
  popOscillator.stop(startAt + durationSeconds);
  clickOscillator.stop(startAt + 0.03);
  return true;
};

export const createBubbleSoundController = ({
  now = () => Date.now(),
  play,
  throttleMs = BUBBLE_SOUND_THROTTLE_MS,
}: BubbleSoundControllerOptions) => {
  let lastPlayedAt = Number.NEGATIVE_INFINITY;

  return {
    trigger() {
      const current = now();
      if (current - lastPlayedAt < throttleMs) {
        return false;
      }

      if (!play()) {
        return false;
      }

      lastPlayedAt = current;
      return true;
    },
    reset() {
      lastPlayedAt = Number.NEGATIVE_INFINITY;
    },
  };
};

const sharedBubbleSoundController = createBubbleSoundController({
  now: () => Date.now(),
  play: () => playBubbleSynth(),
});

export const unlockBubbleSound = () => {
  const context = getBubbleAudioContext();
  if (!context) {
    return false;
  }

  if (context.state === "suspended") {
    void context.resume().catch(() => undefined);
  }

  return true;
};

export const playBubbleSound = () => sharedBubbleSoundController.trigger();
