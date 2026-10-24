import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import NotificationSoundPicker from "../components/NotificationSoundPicker";
import OwnerNotifications from "../pages/admin/OwnerNotifications";
import {
  isSoundEnabled,
  setSoundEnabled,
  isVibrationEnabled,
  setVibrationEnabled,
  playNotificationSound,
  triggerNotificationVibration,
  resetSoundAndVibrationState,
  getVibrationPattern,
  setVibrationPattern,
  isVibrationSupported,
  VIBRATION_PATTERNS,
} from "../utils/soundPlayer";

describe("Notification Sound & Vibration Independence, Patterns, and Controls", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSoundAndVibrationState();
    vi.restoreAllMocks();
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  });

  // A. Vibration toggle is visible
  it("A. Vibration toggle and section are visible in NotificationSoundPicker", () => {
    render(<NotificationSoundPicker />);
    expect(screen.getByText("Notification Sound")).toBeDefined();
    expect(screen.getByText("Notification Vibration")).toBeDefined();
    expect(screen.getByText("Control vibration for Tiffzy notifications")).toBeDefined();
    expect(screen.getByLabelText("Toggle notification vibration")).toBeDefined();
  });

  // B. Default vibration state is correct
  it("B. Default vibration state is enabled (true)", () => {
    expect(isSoundEnabled()).toBe(true);
    expect(isVibrationEnabled()).toBe(true);
    expect(getVibrationPattern()).toBe("default");
  });

  // C. Turning vibration OFF persists
  it("C. Turning vibration OFF persists in localStorage", () => {
    setVibrationEnabled(false);
    expect(isVibrationEnabled()).toBe(false);
    expect(localStorage.getItem("notification_vibration_enabled")).toBe("false");
    expect(isSoundEnabled()).toBe(true); // Sound untouched
  });

  // D. Turning vibration ON persists
  it("D. Turning vibration ON persists in localStorage", () => {
    setVibrationEnabled(false);
    expect(isVibrationEnabled()).toBe(false);
    setVibrationEnabled(true);
    expect(isVibrationEnabled()).toBe(true);
    expect(localStorage.getItem("notification_vibration_enabled")).toBe("true");
  });

  // E. Sound ON + vibration ON
  it("E. respects Sound ON + Vibration ON (plays sound & vibrates)", () => {
    setSoundEnabled(true);
    setVibrationEnabled(true);

    const mockVibrate = vi.fn().mockReturnValue(true);
    global.navigator.vibrate = mockVibrate;
    const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, "play");

    playNotificationSound();

    expect(mockVibrate).toHaveBeenCalledTimes(1);
    expect(playSpy).toHaveBeenCalled();
  });

  // F. Sound ON + vibration OFF
  it("F. respects Sound ON + Vibration OFF (plays sound only, no vibration)", () => {
    setSoundEnabled(true);
    setVibrationEnabled(false);

    const mockVibrate = vi.fn().mockReturnValue(true);
    global.navigator.vibrate = mockVibrate;
    const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, "play");

    playNotificationSound();

    expect(mockVibrate).not.toHaveBeenCalled();
    expect(playSpy).toHaveBeenCalled();
  });

  // G. Sound OFF + vibration ON
  it("G. respects Sound OFF + Vibration ON (vibrates only, no sound)", () => {
    setSoundEnabled(false);
    setVibrationEnabled(true);

    const mockVibrate = vi.fn().mockReturnValue(true);
    global.navigator.vibrate = mockVibrate;
    const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, "play");

    playNotificationSound();

    expect(mockVibrate).toHaveBeenCalledTimes(1);
    expect(playSpy).not.toHaveBeenCalled();
  });

  // H. Sound OFF + vibration OFF
  it("H. respects Sound OFF + Vibration OFF (completely silent)", () => {
    setSoundEnabled(false);
    setVibrationEnabled(false);

    const mockVibrate = vi.fn().mockReturnValue(true);
    global.navigator.vibrate = mockVibrate;
    const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, "play");

    playNotificationSound();

    expect(mockVibrate).not.toHaveBeenCalled();
    expect(playSpy).not.toHaveBeenCalled();
  });

  // I. Vibration patterns support (Default, Short, Double, Strong)
  it("supports vibration patterns selection and persistence", () => {
    expect(VIBRATION_PATTERNS.default.pattern).toEqual([200, 100, 200]);
    expect(VIBRATION_PATTERNS.short.pattern).toEqual([100]);
    expect(VIBRATION_PATTERNS.double.pattern).toEqual([100, 75, 100]);
    expect(VIBRATION_PATTERNS.strong.pattern).toEqual([400, 100, 400]);

    setVibrationPattern("short");
    expect(getVibrationPattern()).toBe("short");
    expect(localStorage.getItem("notification_vibration_pattern")).toBe("short");

    const mockVibrate = vi.fn().mockReturnValue(true);
    global.navigator.vibrate = mockVibrate;

    playNotificationSound();
    expect(mockVibrate).toHaveBeenCalledWith([100]);
  });

  // L. No duplicate vibration within throttle window
  it("L. prevents duplicate vibration within 200ms deduplication window", () => {
    const mockVibrate = vi.fn().mockReturnValue(true);
    global.navigator.vibrate = mockVibrate;

    triggerNotificationVibration();
    triggerNotificationVibration(); // immediately triggered again

    expect(mockVibrate).toHaveBeenCalledTimes(1);
  });

  // M. Unsupported browser/device vibration does not crash the app
  it("M. Unsupported browser/device vibration does not crash the app", () => {
    // Scenario 1: navigator.vibrate is undefined
    const originalVibrate = global.navigator.vibrate;
    delete global.navigator.vibrate;
    expect(isVibrationSupported()).toBe(false);
    expect(() => triggerNotificationVibration()).not.toThrow();
    expect(triggerNotificationVibration()).toBe(false);

    // Scenario 2: navigator.vibrate throws an error
    global.navigator.vibrate = () => {
      throw new Error("SecurityError: vibrate not allowed in iframe");
    };
    resetSoundAndVibrationState();
    expect(() => triggerNotificationVibration()).not.toThrow();
    expect(triggerNotificationVibration()).toBe(false);

    // Restore
    global.navigator.vibrate = originalVibrate;
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

  it("allows selecting vibration pattern via UI buttons", () => {
    render(<NotificationSoundPicker />);

    expect(screen.getByText("Vibration Pattern")).toBeDefined();
    const shortBtn = screen.getByText("Short");
    fireEvent.click(shortBtn);

    expect(getVibrationPattern()).toBe("short");
  });

  it("OwnerNotifications page visibly contains Notification Sound and Notification Vibration controls", () => {
    render(
      <BrowserRouter>
        <OwnerNotifications />
      </BrowserRouter>
    );

    expect(screen.getByText("Notifications Log")).toBeDefined();
    expect(screen.getByText("Notification Sound")).toBeDefined();
    expect(screen.getByText("Notification Vibration")).toBeDefined();
    expect(screen.getByText("Control vibration for Tiffzy notifications")).toBeDefined();
  });

  describe("Notification Sound Accordion Collapse/Expand Behaviors", () => {
    it("1. customization section is collapsed on initial render while header remains visible", () => {
      render(<NotificationSoundPicker />);

      // Header elements are visible
      expect(screen.getByText("Notification Sound")).toBeDefined();
      expect(screen.getByRole("switch", { name: "Toggle notification sound" })).toBeDefined();
      expect(screen.getByTitle("Test Sound")).toBeDefined();
      expect(screen.getByTestId("customize-sound-control")).toBeDefined();

      // Customization content is NOT rendered / hidden by default
      expect(screen.queryByTestId("notification-sound-customization-content")).toBeNull();
      expect(screen.queryByText("Upload Custom Sound File")).toBeNull();
      expect(screen.queryByText("Pop Premium Chime")).toBeNull();
    });

    it("2. current sound remains visible in the header when collapsed", () => {
      render(<NotificationSoundPicker />);

      const currentSoundElement = screen.getByTestId("current-notification-sound");
      expect(currentSoundElement).toBeDefined();
      expect(currentSoundElement.textContent).toContain("6 Tiffzy Notification Sound");
      expect(screen.getByText(/Customize Sound Tone \(6 Tiffzy Notification Sound\)/i)).toBeDefined();
    });

    it("3. clicking the expand control reveals sound options and custom sound upload", () => {
      render(<NotificationSoundPicker />);

      // Initially collapsed
      expect(screen.queryByTestId("notification-sound-customization-content")).toBeNull();

      // Click the expand control
      const expandBtn = screen.getByTestId("customize-sound-control");
      fireEvent.click(expandBtn);

      // Now options are revealed
      expect(screen.getByTestId("notification-sound-customization-content")).toBeDefined();
      expect(screen.getByText("Upload Custom Sound File")).toBeDefined();
      expect(screen.getByText("Pop Premium Chime")).toBeDefined();
      expect(screen.getByText("Bright Bell")).toBeDefined();
    });

    it("4. clicking again collapses the sound options", () => {
      render(<NotificationSoundPicker />);

      const expandBtn = screen.getByTestId("customize-sound-control");

      // Expand
      fireEvent.click(expandBtn);
      expect(screen.getByTestId("notification-sound-customization-content")).toBeDefined();

      // Collapse
      fireEvent.click(expandBtn);
      expect(screen.queryByTestId("notification-sound-customization-content")).toBeNull();
      expect(screen.queryByText("Upload Custom Sound File")).toBeNull();
      expect(screen.queryByText("Pop Premium Chime")).toBeNull();
    });

    it("clicking the header control also expands and collapses the section", () => {
      render(<NotificationSoundPicker />);

      const headerControl = screen.getByTestId("notification-sound-header-control");

      // Expand via header
      fireEvent.click(headerControl);
      expect(screen.getByTestId("notification-sound-customization-content")).toBeDefined();

      // Collapse via header
      fireEvent.click(headerControl);
      expect(screen.queryByTestId("notification-sound-customization-content")).toBeNull();
    });

    it("5. selected sound is unchanged when toggling accordion and preserved when reopening", () => {
      const { unmount } = render(<NotificationSoundPicker />);

      const expandBtn = screen.getByTestId("customize-sound-control");
      fireEvent.click(expandBtn);

      // Select a different sound: "Bright Bell"
      const brightBellBtn = screen.getByText("Bright Bell");
      fireEvent.click(brightBellBtn);

      // Verify header updated
      expect(screen.getByTestId("current-notification-sound").textContent).toBe("Bright Bell");
      expect(screen.getByText(/Customize Sound Tone \(Bright Bell\)/i)).toBeDefined();

      // Collapse section
      fireEvent.click(expandBtn);
      expect(screen.queryByTestId("notification-sound-customization-content")).toBeNull();

      // Verify selected sound remains "Bright Bell" when collapsed
      expect(screen.getByTestId("current-notification-sound").textContent).toBe("Bright Bell");
      expect(screen.getByText(/Customize Sound Tone \(Bright Bell\)/i)).toBeDefined();

      // Unmount to simulate leaving the page
      unmount();

      // Reopen page by mounting again
      render(<NotificationSoundPicker />);

      // Customization section is collapsed by default on reopen
      expect(screen.queryByTestId("notification-sound-customization-content")).toBeNull();

      // Existing selected sound ("Bright Bell") is preserved on reopen
      expect(screen.getByTestId("current-notification-sound").textContent).toBe("Bright Bell");
      expect(screen.getByText(/Customize Sound Tone \(Bright Bell\)/i)).toBeDefined();
    });

    it("OwnerNotifications page integrates collapsed sound customization by default", () => {
      render(
        <BrowserRouter>
          <OwnerNotifications />
        </BrowserRouter>
      );

      // Header is visible
      expect(screen.getByText("Notification Sound")).toBeDefined();
      expect(screen.getByTestId("current-notification-sound")).toBeDefined();
      expect(screen.getByTitle("Test Sound")).toBeDefined();

      // Accordion customization details are collapsed by default on the page
      expect(screen.queryByTestId("notification-sound-customization-content")).toBeNull();
      expect(screen.queryByText("Upload Custom Sound File")).toBeNull();

      // Expand via accordion control
      fireEvent.click(screen.getByTestId("customize-sound-control"));
      expect(screen.getByTestId("notification-sound-customization-content")).toBeDefined();
      expect(screen.getByText("Upload Custom Sound File")).toBeDefined();

      // Collapse again
      fireEvent.click(screen.getByTestId("customize-sound-control"));
      expect(screen.queryByTestId("notification-sound-customization-content")).toBeNull();
    });
  });
});
