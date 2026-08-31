const SOUND_STORAGE_KEY = "tiffzy_notification_sound";

export const BUILTIN_SOUNDS = [
  { id: "chime", name: "Pop Premium Ding", type: "builtin", freq: 880 },
  { id: "bright", name: "Bright Bell", type: "builtin", freq: 1046.5 },
  { id: "luxury", name: "Luxury Sparkle", type: "builtin", freq: 1318.5 },
  { id: "gentle", name: "Gentle Alert", type: "builtin", freq: 659.25 },
];

/**
 * Play synthesized chime tone using Web Audio API
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

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
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
 * Get active notification sound config from LocalStorage
 */
export const getActiveSoundConfig = () => {
  try {
    const saved = localStorage.getItem(SOUND_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return BUILTIN_SOUNDS[0];
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

  const builtin = BUILTIN_SOUNDS.find((s) => s.id === config.id) || BUILTIN_SOUNDS[0];
  playSynthesizedChime(builtin.freq);
};
