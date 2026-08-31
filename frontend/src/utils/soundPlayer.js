import sound1 from "../assets/sounds/tiffzy_notification_1.mp3";
import sound2 from "../assets/sounds/tiffzy_notification_2.mp3";
import sound3 from "../assets/sounds/tiffzy_notification_3.mp3";
import sound4 from "../assets/sounds/tiffzy_notification_4.mp3";
import sound5 from "../assets/sounds/tiffzy_notification_5.mp3";
import sound6 from "../assets/sounds/tiffzy_notification_6.mp3";

const SOUND_STORAGE_KEY = "tiffzy_notification_sound";

export const BUILTIN_SOUNDS = [
  { id: "tiffzy6", name: "6 Tiffzy Notification Sound", type: "file", src: sound6, isDefault: true },
  { id: "tiffzy1", name: "1 Tiffzy Notification Sound", type: "file", src: sound1 },
  { id: "tiffzy2", name: "2 Tiffzy Notification Sound", type: "file", src: sound2 },
  { id: "tiffzy3", name: "3 Tiffzy Notification Sound", type: "file", src: sound3 },
  { id: "tiffzy4", name: "4 Tiffzy Notification Sound", type: "file", src: sound4 },
  { id: "tiffzy5", name: "5 Tiffzy Notification Sound", type: "file", src: sound5 },
  { id: "chime", name: "Pop Premium Chime", type: "builtin", freq: 880 },
  { id: "bright", name: "Bright Bell", type: "builtin", freq: 1046.5 },
  { id: "luxury", name: "Luxury Sparkle", type: "builtin", freq: 1318.5 },
];

/**
 * Play synthesized chime tone using Web Audio API as fallback
 */
const playSynthesizedChime = (freq = 880) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Web Audio API playback blocked or unsupported
  }
};

/**
 * Get active notification sound config from LocalStorage (defaults to sound 6)
 */
export const getActiveSoundConfig = () => {
  try {
    const saved = localStorage.getItem(SOUND_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Re-hydrate src for file type sounds
      if (parsed.type === "file") {
        const found = BUILTIN_SOUNDS.find((s) => s.id === parsed.id);
        if (found) return found;
      }
      return parsed;
    }
  } catch {
    // ignore
  }
  return BUILTIN_SOUNDS[0]; // 6 Tiffzy Notification Sound by default
};

/**
 * Save notification sound config to LocalStorage
 */
export const saveSoundConfig = (soundConfig) => {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify(soundConfig));
  } catch {
    // ignore
  }
};

/**
 * Play current active notification sound
 */
export const playNotificationSound = (overrideConfig = null) => {
  const config = overrideConfig || getActiveSoundConfig();

  if (!config) return;

  // Custom base64 / blob uploaded audio
  if (config.type === "custom" && config.audioData) {
    try {
      const audio = new Audio(config.audioData);
      audio.play().catch(() => playSynthesizedChime(880));
      return;
    } catch {
      playSynthesizedChime(880);
      return;
    }
  }

  // File audio (Official Tiffzy MP3 sounds)
  if (config.type === "file" && config.src) {
    try {
      const audio = new Audio(config.src);
      audio.play().catch(() => playSynthesizedChime(880));
      return;
    } catch {
      playSynthesizedChime(880);
      return;
    }
  }

  // Synthesized audio fallback
  const builtin = BUILTIN_SOUNDS.find((s) => s.id === config.id) || BUILTIN_SOUNDS[0];
  if (builtin.src) {
    try {
      const audio = new Audio(builtin.src);
      audio.play().catch(() => playSynthesizedChime(builtin.freq || 880));
      return;
    } catch {
      playSynthesizedChime(builtin.freq || 880);
      return;
    }
  }

  playSynthesizedChime(builtin.freq || 880);
};
