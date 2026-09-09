import { useState, useRef } from "react";
import { Volume2, Play, Upload, Check, Music, ChevronDown, ChevronUp } from "lucide-react";
import {
  BUILTIN_SOUNDS,
  getActiveSoundConfig,
  saveSoundConfig,
  playNotificationSound,
} from "../utils/soundPlayer";
import { showToast } from "../utils/toast";

export default function NotificationSoundPicker({ className = "", defaultExpanded = false }) {
  const [selectedSound, setSelectedSound] = useState(getActiveSoundConfig());
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const fileInputRef = useRef(null);

  const handleSelectBuiltin = (sound) => {
    setSelectedSound(sound);
    saveSoundConfig(sound);
    playNotificationSound(sound);
    showToast({
      title: "Sound Selected",
      message: `Updated alert sound to ${sound.name}`,
      variant: "success",
    });
  };

  const handlePlayPreview = (e) => {
    e.stopPropagation();
    setIsPlaying(true);
    playNotificationSound(selectedSound);
    setTimeout(() => setIsPlaying(false), 800);
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
      playNotificationSound(customConfig);

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
      {/* Header bar - Click to toggle hide/show */}
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
        className="flex cursor-pointer items-center justify-between p-4 sm:p-5 hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <Volume2 size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base">Notification Sound</h3>
            <p className="theme-muted text-xs">
              {selectedSound?.name || "Choose or upload alert sound"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

          <span className="p-1 text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] transition">
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </div>
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

