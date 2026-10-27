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

export default function NotificationSoundPicker({ className = "", defaultExpanded = false }) {
  const [selectedSound, setSelectedSound] = useState(getActiveSoundConfig());
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [vibrationOn, setVibrationOn] = useState(isVibrationEnabled());
  const [selectedPattern, setSelectedPattern] = useState(getVibrationPattern());
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVibrating, setIsVibrating] = useState(false);
  const [isSoundExpanded, setIsSoundExpanded] = useState(defaultExpanded);
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
      <div className="rounded-xl border border-[#E7E5E4] bg-white shadow-xs overflow-hidden transition-all duration-200">
        <div className="p-3 sm:p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
              soundOn ? "bg-[#FFF7ED] text-[#EA580C] border border-[#F97316]/30" : "bg-[#F5F5F4] text-[#78716C]"
            }`}>
              {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3
                  onClick={() => setIsSoundExpanded((prev) => !prev)}
                  className="font-bold text-sm text-[#171717] cursor-pointer hover:text-[#EA580C] transition"
                >
                  Notification Sound
                </h3>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  soundOn ? "bg-[#FFF7ED] text-[#EA580C] border border-[#F97316]/30" : "bg-[#F5F5F4] text-[#78716C]"
                }`}>
                  {soundOn ? "ON" : "OFF"}
                </span>
              </div>
              <p className="text-xs text-[#57534E] truncate">
                {soundOn ? selectedSound?.name || "Standard alert sound" : "Sound alerts disabled"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {soundOn && (
              <button
                type="button"
                onClick={handlePlayPreview}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition border shadow-xs cursor-pointer ${
                  isPlaying
                    ? "bg-[#F97316] text-white border-[#F97316] scale-95"
                    : "border-[#E7E5E4] bg-white text-[#57534E] hover:border-[#F97316]/50 hover:text-[#EA580C]"
                }`}
                title="Test Sound"
              >
                <Play size={12} className={isPlaying ? "animate-pulse" : ""} />
                <span>{isPlaying ? "Playing..." : "Test"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleSound}
              aria-label="Toggle notification sound"
              aria-checked={soundOn}
              role="switch"
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                soundOn ? "bg-[#F97316]" : "bg-[#D6D3D1]"
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

        {/* Tone Selector Expander Row */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsSoundExpanded((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsSoundExpanded((prev) => !prev);
            }
          }}
          className="flex cursor-pointer items-center justify-between px-3 sm:px-4 py-2 border-t border-[#E7E5E4] bg-[#FFF7ED]/30 hover:bg-[#FFF7ED]/70 transition text-xs font-semibold text-[#57534E]"
        >
          <span className="flex items-center gap-2 truncate">
            <Music size={14} className="text-[#F97316] shrink-0" />
            <span>Customize Sound Tone ({selectedSound?.name || "Standard"})</span>
          </span>
          <span className="p-0.5 text-[#78716C] hover:text-[#171717] transition shrink-0">
            {isSoundExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>

        {/* Expandable Sound Selector Details */}
        {isSoundExpanded && (
          <div className="border-t border-[#E7E5E4] p-3 sm:p-4 space-y-3 bg-[#FFF7ED]/10">
            <p className="text-xs text-[#57534E]">
              Select an alert tone below or upload your own custom sound file (.mp3, .wav, .ogg):
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {BUILTIN_SOUNDS.map((sound) => {
                const isSelected = selectedSound?.id === sound.id;
                return (
                  <button
                    key={sound.id}
                    type="button"
                    onClick={() => handleSelectBuiltin(sound)}
                    className={`flex items-center justify-between rounded-xl border p-2.5 text-left transition shadow-xs cursor-pointer ${
                      isSelected
                        ? "border-[#F97316] bg-[#FFF7ED] text-[#EA580C] font-bold"
                        : "border-[#E7E5E4] bg-white text-[#171717] hover:border-[#F97316]/40 hover:bg-[#FFF7ED]/30 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Music size={14} className={isSelected ? "text-[#F97316] shrink-0" : "text-[#78716C] shrink-0"} />
                      <span className="text-xs truncate">{sound.name}</span>
                    </div>
                    {isSelected && <Check size={14} className="text-[#EA580C] font-bold shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>

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
                className={`flex cursor-pointer items-center justify-between rounded-xl border border-dashed p-3 transition shadow-xs ${
                  selectedSound?.type === "custom"
                    ? "border-[#F97316] bg-[#FFF7ED] text-[#EA580C] font-bold"
                    : "border-[#D6D3D1] bg-white text-[#57534E] hover:border-[#F97316]/50 hover:bg-[#FFF7ED]/30"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Upload size={16} className="text-[#F97316] shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[#171717]">
                      {selectedSound?.type === "custom" ? selectedSound.name : "Upload Custom Sound File"}
                    </p>
                    <p className="text-[11px] text-[#78716C]">
                      Supports .mp3, .wav, .ogg audio files
                    </p>
                  </div>
                </div>
                {selectedSound?.type === "custom" ? (
                  <span className="rounded-full bg-[#FFF7ED] border border-[#F97316]/30 px-2.5 py-0.5 text-[10px] font-bold text-[#EA580C] shrink-0">
                    Active Custom
                  </span>
                ) : (
                  <span className="rounded-lg border border-[#E7E5E4] bg-white px-2.5 py-1 text-xs font-semibold text-[#57534E] shrink-0">
                    Browse
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Notification Vibration */}
      <div className="rounded-xl border border-[#E7E5E4] bg-white shadow-xs overflow-hidden transition-all duration-200">
        <div className="p-3 sm:p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
              vibrationOn ? "bg-[#FFF7ED] text-[#EA580C] border border-[#F97316]/30" : "bg-[#F5F5F4] text-[#78716C]"
            }`}>
              <Vibrate size={18} className={isVibrating ? "animate-bounce" : ""} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#171717] flex items-center gap-1.5">
                  Notification Vibration
                  <span className="sr-only">Vibration</span>
                </h3>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  vibrationOn ? "bg-[#FFF7ED] text-[#EA580C] border border-[#F97316]/30" : "bg-[#F5F5F4] text-[#78716C]"
                }`}>
                  {vibrationOn ? "ON" : "OFF"}
                </span>
              </div>
              <p className="text-xs text-[#57534E] truncate">
                Control vibration for Tiffzy notifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {vibrationOn && (
              <button
                type="button"
                onClick={handleTestVibration}
                className={`flex items-center gap-1.5 rounded-lg border border-[#E7E5E4] bg-white px-2.5 py-1.5 text-xs font-bold text-[#57534E] hover:border-[#F97316]/50 hover:text-[#EA580C] transition shadow-xs cursor-pointer ${
                  isVibrating ? "border-[#F97316] text-[#EA580C] scale-95" : ""
                }`}
                title="Test Vibration"
              >
                <Vibrate size={12} className={isVibrating ? "animate-spin text-[#F97316]" : ""} />
                <span>{isVibrating ? "Vibrating..." : "Test"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleVibration}
              aria-label="Toggle notification vibration"
              aria-checked={vibrationOn}
              role="switch"
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                vibrationOn ? "bg-[#F97316]" : "bg-[#D6D3D1]"
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

        {/* Vibration Pattern Selector */}
        {vibrationOn && (
          <div className="p-3 sm:p-4 border-t border-[#E7E5E4] bg-[#FFF7ED]/10 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#171717]">Vibration Pattern</h4>
              <span className="text-[11px] text-[#78716C] font-medium">Choose haptic feel</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.values(VIBRATION_PATTERNS).map((item) => {
                const isSelected = selectedPattern === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectPattern(item.id)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition shadow-xs cursor-pointer ${
                      isSelected
                        ? "border-[#F97316] bg-[#FFF7ED] text-[#EA580C] font-bold"
                        : "border-[#E7E5E4] bg-white text-[#171717] hover:border-[#F97316]/40 hover:bg-[#FFF7ED]/30 font-medium"
                    }`}
                  >
                    <span className="text-xs">{item.name}</span>
                    {isSelected && <Check size={14} className="text-[#EA580C] shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Device capability note */}
            <div className="pt-2 text-[11px] text-[#78716C] flex items-center gap-1.5">
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
