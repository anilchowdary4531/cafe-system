import { useState, useRef } from "react";
import { Volume2, VolumeX, Play, Upload, Check, Music, ChevronDown, ChevronUp, Vibrate } from "lucide-react";
import {
  BUILTIN_SOUNDS,
  getActiveSoundConfig,
  saveSoundConfig,
  playNotificationSound,
  isSoundEnabled,
  setSoundEnabled,
  isVibrationEnabled,
  setVibrationEnabled,
  triggerNotificationVibration,
} from "../utils/soundPlayer";
import { showToast } from "../utils/toast";

export default function NotificationSoundPicker({ className = "", defaultExpanded = false }) {
  const [selectedSound, setSelectedSound] = useState(getActiveSoundConfig());
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [vibrationOn, setVibrationOn] = useState(isVibrationEnabled());
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVibrating, setIsVibrating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const fileInputRef = useRef(null);

  const handleToggleSound = (e) => {
    e?.stopPropagation();
    const nextVal = !soundOn;
    setSoundOn(nextVal);
    setSoundEnabled(nextVal);
    showToast({
      title: nextVal ? "Notification Sound Enabled" : "Notification Sound Muted",
      message: nextVal ? "Notification alerts will play sound" : "Notification alerts will be silent",
      variant: nextVal ? "success" : "info",
    });
  };

  const handleToggleVibration = (e) => {
    e?.stopPropagation();
    const nextVal = !vibrationOn;
    setVibrationOn(nextVal);
    setVibrationEnabled(nextVal);
    if (nextVal) {
      triggerNotificationVibration([150, 50, 150]);
    }
    showToast({
      title: nextVal ? "Vibration Enabled" : "Vibration Disabled",
      message: nextVal ? "Device will vibrate on notification alerts" : "Device vibration is turned off",
      variant: nextVal ? "success" : "info",
    });
  };

  const handleSelectBuiltin = (sound) => {
    setSelectedSound(sound);
    saveSoundConfig(sound);
    playNotificationSound(sound, { forceSound: true, skipVibrate: true });
    showToast({
      title: "Sound Selected",
      message: `Updated alert sound to ${sound.name}`,
      variant: "success",
    });
  };

  const handlePlayPreview = (e) => {
    e.stopPropagation();
    setIsPlaying(true);
    // Preview respects user's sound and vibration settings or previews sound if enabled
    playNotificationSound(selectedSound, { forceSound: true, skipVibrate: true });
    setTimeout(() => setIsPlaying(false), 800);
  };

  const handleTestVibration = (e) => {
    e.stopPropagation();
    setIsVibrating(true);
    triggerNotificationVibration([200, 100, 200]);
    setTimeout(() => setIsVibrating(false), 500);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name)) {
      showToast({
        title: "Invalid File Format",
        message: "Please select an audio file (.mp3, .wav, .ogg)",
        variant: "error",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const audioData = event.target?.result;
      const customConfig = {
        id: `custom_${Date.now()}`,
        name: file.name,
        type: "custom",
        audioData,
      };

      setSelectedSound(customConfig);
      saveSoundConfig(customConfig);
      playNotificationSound(customConfig, { forceSound: true, skipVibrate: true });

      showToast({
        title: "Custom Sound Uploaded",
        message: `Saved "${file.name}" as your custom alert sound`,
        variant: "success",
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`theme-panel rounded-3xl border border-[var(--app-border)] bg-[#171410] dark:bg-[#15151a] overflow-hidden transition-all duration-300 ${className}`}>
      {/* Sound Settings Header / Master Toggle */}
      <div className="p-4 sm:p-5 border-b border-[var(--app-border)] space-y-3">
        {/* Row 1: Notification Sound ON/OFF */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition ${
              soundOn ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-white/10 text-white/50"
            }`}>
              {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base">Notification Sound</h3>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  soundOn ? "bg-amber-500/15 text-amber-500" : "bg-white/10 text-[color:var(--app-muted)]"
                }`}>
                  {soundOn ? "ON" : "OFF"}
                </span>
              </div>
              <p className="theme-muted text-xs">
                {soundOn ? selectedSound?.name || "Choose or upload alert sound" : "Sound alerts disabled"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {soundOn && (
              <button
                type="button"
                onClick={handlePlayPreview}
                className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-bold transition shadow-sm ${
                  isPlaying
                    ? "bg-amber-500 text-white scale-95"
                    : "theme-button"
                }`}
                title="Test Sound"
              >
                <Play size={13} className={isPlaying ? "animate-pulse" : ""} />
                {isPlaying ? "Playing..." : "Test"}
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleSound}
              aria-label="Toggle notification sound"
              aria-checked={soundOn}
              role="switch"
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                soundOn ? "bg-amber-500" : "bg-white/20"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  soundOn ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Row 2: Vibration ON/OFF */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--app-border)]/50">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition ${
              vibrationOn ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-white/10 text-white/50"
            }`}>
              <Vibrate size={20} className={isVibrating ? "animate-bounce" : ""} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base">Vibration</h3>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  vibrationOn ? "bg-amber-500/15 text-amber-500" : "bg-white/10 text-[color:var(--app-muted)]"
                }`}>
                  {vibrationOn ? "ON" : "OFF"}
                </span>
              </div>
              <p className="theme-muted text-xs">
                {vibrationOn ? "Device will vibrate on alerts" : "Vibration alerts disabled"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {vibrationOn && (
              <button
                type="button"
                onClick={handleTestVibration}
                className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-bold transition shadow-sm ${
                  isVibrating
                    ? "bg-amber-500 text-white scale-95"
                    : "theme-button"
                }`}
                title="Test Vibration"
              >
                <Vibrate size={13} className={isVibrating ? "animate-spin" : ""} />
                {isVibrating ? "Vibrating..." : "Test"}
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleVibration}
              aria-label="Toggle notification vibration"
              aria-checked={vibrationOn}
              role="switch"
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                vibrationOn ? "bg-amber-500" : "bg-white/20"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  vibrationOn ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Expand/Collapse tone selector */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded((prev) => !prev);
          }
        }}
        className="flex cursor-pointer items-center justify-between px-4 sm:px-5 py-3 hover:bg-white/5 transition text-xs font-semibold theme-muted"
      >
        <span className="flex items-center gap-2">
          <Music size={14} className="text-amber-500" />
          Customize Sound Tone ({selectedSound?.name || "Standard"})
        </span>
        <span className="p-1 text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] transition">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </div>

      {/* Expandable Sound Selector Details */}
      {isExpanded && (
        <div className="border-t border-[var(--app-border)] p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
          <p className="theme-muted text-xs">
            Select an alert tone below or upload your own custom sound file (.mp3, .wav, .ogg):
          </p>

          {/* Sound Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BUILTIN_SOUNDS.map((sound) => {
              const isSelected = selectedSound?.id === sound.id;
              return (
                <button
                  key={sound.id}
                  type="button"
                  onClick={() => handleSelectBuiltin(sound)}
                  className={`flex items-center justify-between rounded-2xl border p-3.5 text-left transition shadow-sm ${
                    isSelected
                      ? "border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-200 font-bold"
                      : "border-[var(--app-border)] bg-[var(--app-surface-2)] text-[var(--app-text)] hover:border-amber-500/50 hover:bg-amber-500/5 font-semibold"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Music size={15} className={isSelected ? "text-amber-500 shrink-0" : "opacity-50 shrink-0"} />
                    <span className="text-xs sm:text-sm truncate">{sound.name}</span>
                  </div>
                  {isSelected && <Check size={16} className="text-amber-500 font-bold shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>

          {/* Custom Sound Upload Button */}
          <div className="pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mp3,audio/wav,audio/ogg,audio/mpeg,audio/*,.mp3,.wav,.ogg"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`flex cursor-pointer items-center justify-between rounded-2xl border border-dashed p-3.5 transition shadow-sm ${
                selectedSound?.type === "custom"
                  ? "border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-200 font-bold"
                  : "border-[var(--app-border)] bg-[var(--app-surface-2)] text-[var(--app-text)] hover:border-amber-500/50 hover:bg-amber-500/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <Upload size={18} className="text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs sm:text-sm font-bold">
                    {selectedSound?.type === "custom" ? selectedSound.name : "Upload Custom Sound File"}
                  </p>
                  <p className="theme-muted text-[11px]">
                    Supports .mp3, .wav, .ogg audio files
                  </p>
                </div>
              </div>
              {selectedSound?.type === "custom" ? (
                <span className="rounded-full bg-amber-500/20 px-3 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                  Active Custom
                </span>
              ) : (
                <span className="theme-button rounded-xl px-3 py-1.5 text-xs font-semibold shrink-0">
                  Browse
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

