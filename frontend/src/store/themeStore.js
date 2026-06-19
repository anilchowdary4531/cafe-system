import { create } from "zustand";

export const useThemeStore = create((set) => ({
    theme: "luxury",

    setTheme: (theme) => set({ theme }),
}));