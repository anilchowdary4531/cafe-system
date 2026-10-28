import { useState, useRef } from "react";
import { Volume2, VolumeX, Play, Upload, Check, Music, ChevronDown, ChevronUp, Vibrate, Smartphone } from "lucide-react";
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
  VIBRATION_PATTERNS,
  getVibrationPattern,
  setVibrationPattern,
  isVibrationSupported,
} from "../utils/soundPlayer";
import { showToast } from "../utils/toast";

export default function NotificationSoundPicker({ className = "", defaultExpanded = false, defaultVibrationExpanded = false }) {
  const [selectedSound, setSelectedSound] = useState(getActiveSoundConfig());
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [vibrationOn, setVibrationOn] = useState(isVibrationEnabled());
  const [selectedPattern, setSelectedPattern] = useState(getVibrationPattern());
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVibrating, setIsVibrating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isVibrationExpanded, setIsVibrationExpanded] = useState(defaultVibrationExpanded);
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
      triggerNotificationVibration(null, { force: true });
    }
    showToast({
      title: nextVal ? "Notification Vibration Enabled" : "Notification Vibration Disabled",
      message: nextVal ? "Device will vibrate for Tiffzy notifications" : "Notification vibration is turned off",
      variant: nextVal ? "success" : "info",
    });
  };

  const handleSelectPattern = (patternKey) => {
    setSelectedPattern(patternKey);
    setVibrationPattern(patternKey);
    const chosen = VIBRATION_PATTERNS[patternKey];
    if (vibrationOn) {
      triggerNotificationVibration(chosen?.pattern, { force: true });
    }
    showToast({
      title: "Vibration Pattern Updated",
      message: `Set vibration pattern to ${chosen?.name || patternKey}`,
      variant: "success",
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
    playNotificationSound(selectedSound, { forceSound: true, skipVibrate: true });
    setTimeout(() => setIsPlaying(false), 800);
  };

  const handleTestVibration = (e) => {
    e.stopPropagation();
    setIsVibrating(true);
    triggerNotificationVibration(null, { force: true });
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
    <div className={`space-y-3 ${className}`}>
      {/* SECTION 1: Notification Sound */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#18181b] shadow-sm overflow-hidden transition-all duration-200">
        <div className="p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
              soundOn ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20" : "bg-slate-100 dark:bg-zinc-800 text-slate-400"
            }`}>
              {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </div>
              <div
                role="button"
                tabIndex={0}
                data-testid="notification-sound-header-control"
                onClick={() => setIsExpanded((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsExpanded((prev) => !prev);
                  }
                }}
                className="cursor-pointer select-none group"
                aria-expanded={isExpanded}
                aria-controls="notification-sound-customization-content"
                aria-label="Notification Sound options"
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 group-hover:text-orange-500 transition-colors">Notification Sound</h3>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    soundOn ? "bg-orange-500/15 text-orange-600 dark:text-orange-400" : "bg-slate-100 dark:bg-zinc-800 text-slate-400"
                  }`}>
                    {soundOn ? "ON" : "OFF"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400" data-testid="current-notification-sound">
                  {soundOn ? selectedSound?.name || "Choose or upload alert sound" : "Sound alerts disabled"}
                </p>
              </div>
          </div>

          <div className="flex items-center gap-2">
            {soundOn && (
              <button
                type="button"
                onClick={handlePlayPreview}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-sm border ${
                  isPlaying
                    ? "bg-orange-500 text-white border-orange-500 scale-95"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:border-orange-500/50 hover:text-orange-600"
                }`}
                title="Test Sound"
                aria-label="Test notification sound"
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
                soundOn ? "bg-orange-500" : "bg-slate-300 dark:bg-zinc-700"
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

        {/* Tone Selector Expander */}
        <button
          type="button"
          data-testid="customize-sound-control"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex w-full cursor-pointer items-center justify-between px-4 sm:px-5 py-2.5 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/40 hover:bg-slate-100/60 dark:hover:bg-zinc-800/60 transition text-xs font-semibold text-slate-600 dark:text-slate-400"
          aria-expanded={isExpanded}
          aria-controls="notification-sound-customization-content"
          aria-label={`Customize Sound Tone (${selectedSound?.name || "Standard"})`}
        >
          <span className="flex items-center gap-2">
            <Music size={14} className="text-orange-500" />
            Customize Sound Tone ({selectedSound?.name || "Standard"})
          </span>
          <span className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>

        {/* Expandable Sound Selector Details */}
        {isExpanded && (
          <div id="notification-sound-customization-content" data-testid="notification-sound-customization-content" className="border-t border-slate-100 dark:border-zinc-800 p-4 sm:p-5 space-y-3.5 bg-slate-50/20 dark:bg-zinc-900/20">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select an alert tone below or upload your own custom sound file (.mp3, .wav, .ogg):
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {BUILTIN_SOUNDS.map((sound) => {
                const isSelected = selectedSound?.id === sound.id;
                return (
                  <button
                    key={sound.id}
                    type="button"
                    onClick={() => handleSelectBuiltin(sound)}
                    className={`flex items-center justify-between rounded-xl border p-3 text-left transition shadow-sm ${
                      isSelected
                        ? "border-orange-500 bg-orange-500/10 text-orange-950 dark:text-orange-200 font-bold"
                        : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-300 hover:border-orange-500/40 hover:bg-orange-500/5 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Music size={15} className={isSelected ? "text-orange-500 shrink-0" : "opacity-40 shrink-0"} />
                      <span className="text-xs sm:text-sm truncate">{sound.name}</span>
                    </div>
                    {isSelected && <Check size={16} className="text-orange-500 font-bold shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-1">
              <input
                ref={fileInputRef}
                id="notification-sound-file-upload"
                name="notificationSoundFileUpload"
                aria-label="Upload custom alert sound"
                type="file"
                accept="audio/mp3,audio/wav,audio/ogg,audio/mpeg,audio/*,.mp3,.wav,.ogg"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`flex w-full cursor-pointer items-center justify-between rounded-xl border border-dashed p-3.5 transition shadow-sm ${
                  selectedSound?.type === "custom"
                    ? "border-orange-500 bg-orange-500/10 text-orange-950 dark:text-orange-200 font-bold"
                    : "border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-300 hover:border-orange-500/50 hover:bg-orange-500/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Upload size={18} className="text-orange-500 shrink-0" />
                  <div>
                    <p className="text-xs sm:text-sm font-bold">
                      {selectedSound?.type === "custom" ? selectedSound.name : "Upload Custom Sound File"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Supports .mp3, .wav, .ogg audio files
                    </p>
                  </div>
                </div>
                {selectedSound?.type === "custom" ? (
                  <span className="rounded-full bg-orange-500/20 px-3 py-1 text-[11px] font-bold text-orange-600 dark:text-orange-400 shrink-0">
                    Active Custom
                  </span>
                ) : (
                  <span className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                    Browse
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Notification Vibration (Independent Section Immediately Below) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#18181b] shadow-sm overflow-hidden transition-all duration-200">
        <div className="p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
              vibrationOn ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20" : "bg-slate-100 dark:bg-zinc-800 text-slate-400"
            }`}>
              <Vibrate size={20} className={isVibrating ? "animate-bounce" : ""} />
            </div>
            <div
              role="button"
              tabIndex={0}
              data-testid="notification-vibration-header-control"
              onClick={() => setIsVibrationExpanded((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsVibrationExpanded((prev) => !prev);
                }
              }}
              className="cursor-pointer select-none group"
              aria-expanded={isVibrationExpanded}
              aria-controls="notification-vibration-customization-content"
              aria-label="Notification Vibration options"
            >
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 group-hover:text-orange-500 transition-colors flex items-center gap-1.5">
                  Notification Vibration
                  <span className="sr-only">Vibration</span>
                </h3>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  vibrationOn ? "bg-orange-500/15 text-orange-600 dark:text-orange-400" : "bg-slate-100 dark:bg-zinc-800 text-slate-400"
                }`}>
                  {vibrationOn ? "ON" : "OFF"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Control vibration for Tiffzy notifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {vibrationOn && (
              <button
                type="button"
                onClick={handleTestVibration}
                className={`flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-orange-500/50 hover:text-orange-600 transition shadow-sm ${
                  isVibrating ? "border-orange-500 text-orange-500 scale-95" : ""
                }`}
                title="Test Vibration"
                aria-label="Test notification vibration"
              >
                <Vibrate size={13} className={isVibrating ? "animate-spin text-orange-500" : ""} />
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
                vibrationOn ? "bg-orange-500" : "bg-slate-300 dark:bg-zinc-700"
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

        {/* Vibration Pattern Expander */}
        <button
          type="button"
          data-testid="customize-vibration-control"
          onClick={() => setIsVibrationExpanded((prev) => !prev)}
          className="flex w-full cursor-pointer items-center justify-between px-4 sm:px-5 py-2.5 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/40 hover:bg-slate-100/60 dark:hover:bg-zinc-800/60 transition text-xs font-semibold text-slate-600 dark:text-slate-400"
          aria-expanded={isVibrationExpanded}
          aria-controls="notification-vibration-customization-content"
          aria-label={`Customize Vibration Pattern (${VIBRATION_PATTERNS[selectedPattern]?.name || "Default"})`}
        >
          <span className="flex items-center gap-2">
            <Vibrate size={14} className="text-orange-500" />
            Customize Vibration Pattern ({VIBRATION_PATTERNS[selectedPattern]?.name || "Default"})
          </span>
          <span className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
            {isVibrationExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>

        {/* Expandable Vibration Details */}
        {isVibrationExpanded && (
          <div
            id="notification-vibration-customization-content"
            data-testid="notification-vibration-customization-content"
            className="border-t border-slate-100 dark:border-zinc-800 p-4 sm:p-5 space-y-3.5 bg-slate-50/20 dark:bg-zinc-900/20"
          >
            {/* Optional Vibration Pattern Selector */}
            {vibrationOn && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Vibration Pattern</h4>
                  <span className="text-[11px] text-slate-400 font-medium">Choose haptic feel</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.values(VIBRATION_PATTERNS).map((item) => {
                    const isSelected = selectedPattern === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectPattern(item.id)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition shadow-sm ${
                          isSelected
                            ? "border-orange-500 bg-orange-500/10 text-orange-950 dark:text-orange-200 font-bold"
                            : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-300 hover:border-orange-500/40 hover:bg-orange-500/5 font-medium"
                        }`}
                      >
                        <span className="text-xs">{item.name}</span>
                        {isSelected && <Check size={14} className="text-orange-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Device/Browser capability note */}
            <div className="pt-1 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Smartphone size={13} className="shrink-0 opacity-70" />
              <span>
                {isVibrationSupported()
                  ? "Vibration supported on this device. Triggers on real-time alerts."
                  : "Vibration is active for Android and supported mobile browsers."}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
