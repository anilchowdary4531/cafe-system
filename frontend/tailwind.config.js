export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                // LIGHT MODE
                primary: "#FC8019",
                bg: "#F6F3EF",
                card: "#FFFFFF",
                text: "#1F2937",
                muted: "#6B7280",
                border: "#E5E7EB",
                accent: "#16A34A",

                // DARK MODE
                "dark-primary": "#FF8A1F",
                "dark-bg": "#0F172A",
                "dark-card": "#1E293B",
                "dark-text": "#F8FAFC",
                "dark-muted": "#94A3B8",
                "dark-border": "#334155",
            },
        },
    },
    plugins: [],
};