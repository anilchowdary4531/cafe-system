import { useState, useRef } from "react";
import { Volume2, Play, Upload, Check, Music } from "lucide-react";
import {
  BUILTIN_SOUNDS,
  getActiveSoundConfig,
  saveSoundConfig,
  playNotificationSound,
} from "../utils/soundPlayer";
import { showToast } from "../utils/toast";

export default function NotificationSoundPicker({ className = "" }) {
  const [selectedSound, setSelectedSound] = useState(getActiveSoundConfig());
  const [isPlaying, setIsPlaying] = useState(false);
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

  const handlePlayPreview = () => {
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
    <div className={`theme-panel rounded-3xl border border-white/10 p-6 space-y-5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
            <Volume2 size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white/90 text-base">Notification Sound</h3>
            <p className="theme-muted text-xs">
              Choose or upload custom alert sound (.mp3, .wav, .ogg)
            </p>
          </div>
        </div>

        <button
          onClick={handlePlayPreview}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition ${
            isPlaying ? "bg-amber-500 text-white scale-95" : "theme-soft-button"
          }`}
        >
          <Play size={14} className={isPlaying ? "animate-pulse" : ""} />
          {isPlaying ? "Playing..." : "Test Sound"}
        </button>
      </div>

      {/* Preset Sound Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {BUILTIN_SOUNDS.map((sound) => {
          const isSelected = selectedSound?.id === sound.id;
          return (
            <button
              key={sound.id}
              onClick={() => handleSelectBuiltin(sound)}
              className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                isSelected
                  ? "border-amber-500/50 bg-amber-500/10 text-white"
                  : "border-white/5 bg-white/[0.02] text-white/70 hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Music size={16} className={isSelected ? "text-amber-400" : "text-white/40"} />
                <span className="text-sm font-semibold">{sound.name}</span>
              </div>
              {isSelected && <Check size={16} className="text-amber-400" />}
            </button>
          );
        })}
      </div>

      {/* Custom Sound Upload Button */}
      <div className="pt-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/mp3,audio/wav,audio/ogg,audio/mpeg,audio/*,.mp3,.wav,.ogg"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer items-center justify-between rounded-2xl border border-dashed p-4 transition ${
            selectedSound?.type === "custom"
              ? "border-amber-500/50 bg-amber-500/10 text-white"
              : "border-white/20 bg-white/[0.02] text-white/70 hover:border-amber-500/40 hover:bg-white/[0.05]"
          }`}
        >
          <div className="flex items-center gap-3">
            <Upload size={18} className="text-amber-400" />
            <div>
              <p className="text-sm font-bold">
                {selectedSound?.type === "custom" ? selectedSound.name : "Upload Custom Sound File"}
              </p>
              <p className="theme-muted text-[11px]">
                Supports .mp3, .wav, .ogg audio files
              </p>
            </div>
          </div>
          {selectedSound?.type === "custom" ? (
            <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold text-amber-400">
              Active Custom
            </span>
          ) : (
            <span className="theme-button rounded-xl px-3 py-1.5 text-xs font-semibold">
              Browse
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
