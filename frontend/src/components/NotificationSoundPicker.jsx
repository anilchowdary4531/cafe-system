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
    <div className={`space-y-3.5 w-full ${className}`}>
      {/* SECTION 1: Notification Sound */}
      <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 overflow-hidden transition-all duration-200">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
              soundOn ? "bg-orange-500/15 text-orange-400 border border-orange-500/30" : "bg-neutral-800/80 text-neutral-400 border border-neutral-700/50"
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
              className="cursor-pointer select-none group min-w-0"
              aria-expanded={isExpanded}
              aria-controls="notification-sound-customization-content"
              aria-label="Notification Sound options"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-orange-400 transition-colors">Notification Sound</h3>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  soundOn ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "bg-neutral-800 text-neutral-400 border border-neutral-700/50"
                }`}>
                  {soundOn ? "ON" : "OFF"}
                </span>
              </div>
              <p className="text-xs text-neutral-400 truncate mt-0.5" data-testid="current-notification-sound">
                {soundOn ? selectedSound?.name || "Choose or upload alert sound" : "Sound alerts disabled"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {soundOn && (
              <button
                type="button"
                onClick={handlePlayPreview}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-sm border ${
                  isPlaying
                    ? "bg-orange-500 text-white border-orange-500 scale-95"
                    : "border-neutral-700/80 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 hover:text-white"
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
                soundOn ? "bg-orange-500" : "bg-neutral-700"
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
          className="flex w-full cursor-pointer items-center justify-between px-4 sm:px-5 py-2.5 border-t border-neutral-800/70 bg-neutral-950/30 hover:bg-neutral-800/40 transition text-xs font-semibold text-neutral-300"
          aria-expanded={isExpanded}
          aria-controls="notification-sound-customization-content"
          aria-label={`Customize Sound Tone (${selectedSound?.name || "Standard"})`}
        >
          <span className="flex items-center gap-2">
            <Music size={14} className="text-orange-400" />
            <span>Customize Sound Tone ({selectedSound?.name || "Standard"})</span>
          </span>
          <span className="p-1 text-neutral-400 hover:text-white transition">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>

        {/* Expandable Sound Selector Details */}
        {isExpanded && (
          <div id="notification-sound-customization-content" data-testid="notification-sound-customization-content" className="border-t border-neutral-800/70 p-4 sm:p-5 space-y-3.5 bg-neutral-950/40">
            <p className="text-xs text-neutral-400">
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
                        ? "border-orange-500/80 bg-orange-500/15 text-white font-bold"
                        : "border-neutral-800/90 bg-neutral-900/80 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800/90 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Music size={15} className={isSelected ? "text-orange-400 shrink-0" : "text-neutral-500 shrink-0"} />
                      <span className="text-xs sm:text-sm truncate">{sound.name}</span>
                    </div>
                    {isSelected && <Check size={16} className="text-orange-400 font-bold shrink-0 ml-1" />}
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
                    ? "border-orange-500/80 bg-orange-500/15 text-white font-bold"
                    : "border-neutral-700/80 hover:border-orange-500/60 bg-neutral-900/60 text-neutral-300 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Upload size={18} className="text-orange-400 shrink-0" />
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-white">
                      {selectedSound?.type === "custom" ? selectedSound.name : "Upload Custom Sound File"}
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Supports .mp3, .wav, .ogg audio files
                    </p>
                  </div>
                </div>
                {selectedSound?.type === "custom" ? (
                  <span className="rounded-full bg-orange-500/20 px-3 py-1 text-[11px] font-bold text-orange-400 border border-orange-500/30 shrink-0">
                    Active Custom
                  </span>
                ) : (
                  <span className="rounded-lg border border-neutral-700/80 bg-neutral-800/80 px-3 py-1.5 text-xs font-semibold text-neutral-200 shrink-0">
                    Browse
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Notification Vibration (Independent Section Immediately Below) */}
      <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 overflow-hidden transition-all duration-200">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
              vibrationOn ? "bg-orange-500/15 text-orange-400 border border-orange-500/30" : "bg-neutral-800/80 text-neutral-400 border border-neutral-700/50"
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
              className="cursor-pointer select-none group min-w-0"
              aria-expanded={isVibrationExpanded}
              aria-controls="notification-vibration-customization-content"
              aria-label="Notification Vibration options"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-orange-400 transition-colors flex items-center gap-1.5">
                  Notification Vibration
                  <span className="sr-only">Vibration</span>
                </h3>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  vibrationOn ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "bg-neutral-800 text-neutral-400 border border-neutral-700/50"
                }`}>
                  {vibrationOn ? "ON" : "OFF"}
                </span>
              </div>
              <p className="text-xs text-neutral-400 truncate mt-0.5">
                Control vibration for Tiffzy notifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {vibrationOn && (
              <button
                type="button"
                onClick={handleTestVibration}
                className={`flex items-center gap-1.5 rounded-xl border border-neutral-700/80 bg-neutral-800/80 px-3 py-1.5 text-xs font-bold text-neutral-200 hover:text-white transition shadow-sm ${
                  isVibrating ? "border-orange-500 text-orange-400 scale-95" : ""
                }`}
                title="Test Vibration"
                aria-label="Test notification vibration"
              >
                <Vibrate size={13} className={isVibrating ? "animate-spin text-orange-400" : ""} />
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
                vibrationOn ? "bg-orange-500" : "bg-neutral-700"
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
          className="flex w-full cursor-pointer items-center justify-between px-4 sm:px-5 py-2.5 border-t border-neutral-800/70 bg-neutral-950/30 hover:bg-neutral-800/40 transition text-xs font-semibold text-neutral-300"
          aria-expanded={isVibrationExpanded}
          aria-controls="notification-vibration-customization-content"
          aria-label={`Customize Vibration Pattern (${VIBRATION_PATTERNS[selectedPattern]?.name || "Default"})`}
        >
          <span className="flex items-center gap-2">
            <Vibrate size={14} className="text-orange-400" />
            <span>Customize Vibration Pattern ({VIBRATION_PATTERNS[selectedPattern]?.name || "Default"})</span>
          </span>
          <span className="p-1 text-neutral-400 hover:text-white transition">
            {isVibrationExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>

        {/* Expandable Vibration Details */}
        {isVibrationExpanded && (
          <div
            id="notification-vibration-customization-content"
            data-testid="notification-vibration-customization-content"
            className="border-t border-neutral-800/70 p-4 sm:p-5 space-y-3.5 bg-neutral-950/40"
          >
            {/* Optional Vibration Pattern Selector */}
            {vibrationOn && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-neutral-200">Vibration Pattern</h4>
                  <span className="text-[11px] text-neutral-400 font-medium">Choose haptic feel</span>
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
                            ? "border-orange-500/80 bg-orange-500/15 text-white font-bold"
                            : "border-neutral-800/90 bg-neutral-900/80 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800/90 font-medium"
                        }`}
                      >
                        <span className="text-xs">{item.name}</span>
                        {isSelected && <Check size={14} className="text-orange-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Device/Browser capability note */}
            <div className="pt-1 text-[11px] text-neutral-400 flex items-center gap-1.5">
              <Smartphone size={13} className="shrink-0 text-neutral-500" />
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
