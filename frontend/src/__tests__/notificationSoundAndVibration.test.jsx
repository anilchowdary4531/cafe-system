import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import NotificationSoundPicker from "../components/NotificationSoundPicker";
import {
  isSoundEnabled,
  setSoundEnabled,
  isVibrationEnabled,
  setVibrationEnabled,
  playNotificationSound,
  triggerNotificationVibration,
  resetSoundAndVibrationState,
} from "../utils/soundPlayer";

describe("Notification Sound & Vibration Independence and Controls", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSoundAndVibrationState();
    vi.restoreAllMocks();
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  });

  it("defaults sound and vibration to enabled (ON)", () => {
    expect(isSoundEnabled()).toBe(true);
    expect(isVibrationEnabled()).toBe(true);
  });

  it("persists sound and vibration preferences independently in localStorage", () => {
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    expect(isVibrationEnabled()).toBe(true); // Vibration unaffected

    setVibrationEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    expect(isVibrationEnabled()).toBe(false);

    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
    expect(isVibrationEnabled()).toBe(false); // Vibration still false
  });

  it("respects sound ON + vibration ON (TEST 1)", () => {
    setSoundEnabled(true);
    setVibrationEnabled(true);

    const mockVibrate = vi.fn().mockReturnValue(true);
    global.navigator.vibrate = mockVibrate;

    playNotificationSound();

    expect(mockVibrate).toHaveBeenCalledTimes(1);
  });

  it("respects sound ON + vibration OFF (TEST 2)", () => {
    setSoundEnabled(true);
    setVibrationEnabled(false);

    const mockVibrate = vi.fn().mockReturnValue(true);
    global.navigator.vibrate = mockVibrate;

    playNotificationSound();

    expect(mockVibrate).not.toHaveBeenCalled();
  });

  it("respects sound OFF + vibration ON (TEST 3)", () => {
    setSoundEnabled(false);
    setVibrationEnabled(true);

    const mockVibrate = vi.fn().mockReturnValue(true);
    global.navigator.vibrate = mockVibrate;

    playNotificationSound();

    // Vibration still fires even though sound is off
    expect(mockVibrate).toHaveBeenCalledTimes(1);
  });

  it("respects sound OFF + vibration OFF (TEST 4)", () => {
    setSoundEnabled(false);
    setVibrationEnabled(false);

    const mockVibrate = vi.fn().mockReturnValue(true);
    global.navigator.vibrate = mockVibrate;

    playNotificationSound();

    expect(mockVibrate).not.toHaveBeenCalled();
  });

  it("prevents double vibration within 200ms deduplication window", () => {
    const mockVibrate = vi.fn().mockReturnValue(true);
    global.navigator.vibrate = mockVibrate;

    triggerNotificationVibration();
    triggerNotificationVibration(); // immediately triggered again

    expect(mockVibrate).toHaveBeenCalledTimes(1);
  });

  it("renders NotificationSoundPicker with both Sound and Vibration toggles", () => {
    render(<NotificationSoundPicker />);

    expect(screen.getByText("Notification Sound")).toBeDefined();
    expect(screen.getByText("Vibration")).toBeDefined();

    const toggles = screen.getAllByRole("switch");
    expect(toggles.length).toBe(2);

    // Toggle sound
    fireEvent.click(toggles[0]);
    expect(isSoundEnabled()).toBe(false);

    // Toggle vibration
    fireEvent.click(toggles[1]);
    expect(isVibrationEnabled()).toBe(false);
  });
});
