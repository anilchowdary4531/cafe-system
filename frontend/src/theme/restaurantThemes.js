export const THEME_STORAGE_KEY = "suretra-ui-theme";

export const restaurantThemes = [
    {
        id: "premium-dark-luxury",
        number: 1,
        name: "Premium Dark Luxury",
        mood: "Elegant / Premium / Sophisticated",
        tone: "dark",
        preview: {
            bg: "#07090d",
            surface: "#15151a",
            panel: "#201a12",
            primary: "#f5b94e",
            accent: "#a97130",
            text: "#fff8e7",
            muted: "#b8ab91",
            chart: "#f5b94e",
        },
        swatches: ["#07090d", "#f5b94e", "#a97130", "#f8f5ed"],
    },
    {
        id: "warm-indian-premium",
        number: 2,
        name: "Warm Indian Premium",
        mood: "Authentic / Warm / Traditional",
        tone: "light",
        preview: {
            bg: "#fff4e4",
            surface: "#fffaf2",
            panel: "#5a260e",
            primary: "#f97316",
            accent: "#e0a125",
            text: "#2c160c",
            muted: "#7c5a45",
            chart: "#dc5f1e",
        },
        swatches: ["#5a260e", "#f97316", "#e0a125", "#fff4e4"],
    },
    {
        id: "modern-fast-conversion",
        number: 3,
        name: "Modern Fast Conversion",
        mood: "Bold / Energetic / High Conversion",
        tone: "dark",
        preview: {
            bg: "#22070a",
            surface: "#3a0c12",
            panel: "#7f0f1d",
            primary: "#ef233c",
            accent: "#ffb000",
            text: "#fff3f3",
            muted: "#f3b7bd",
            chart: "#ff3b4f",
        },
        swatches: ["#22070a", "#ef233c", "#ff6b00", "#ffb000"],
    },
    {
        id: "fine-dining-royal",
        number: 7,
        name: "Fine Dining Royal",
        mood: "Royal / Elegant / Fine Dining",
        tone: "dark",
        preview: {
            bg: "#07152b",
            surface: "#0c203d",
            panel: "#10284b",
            primary: "#d6a437",
            accent: "#1c4f88",
            text: "#f5efe0",
            muted: "#aebbd0",
            chart: "#d6a437",
        },
        swatches: ["#07152b", "#0d3b66", "#d6a437", "#f5efe0"],
    },
    {
        id: "rustic-indian-dhaba",
        number: 8,
        name: "Rustic Indian Dhaba",
        mood: "Rustic / Earthy / Desi Vibes",
        tone: "light",
        preview: {
            bg: "#fff2df",
            surface: "#fff8eb",
            panel: "#69310f",
            primary: "#c94b12",
            accent: "#b8902f",
            text: "#2a170d",
            muted: "#76533d",
            chart: "#c94b12",
        },
        swatches: ["#69310f", "#c94b12", "#b8902f", "#fff2df"],
    },
];

export const DEFAULT_RESTAURANT_THEME_ID = restaurantThemes[0].id;

export function getRestaurantTheme(themeId) {
    return restaurantThemes.find((theme) => theme.id === themeId) || restaurantThemes[0];
}

export function isRestaurantThemeId(themeId) {
    return restaurantThemes.some((theme) => theme.id === themeId);
}
