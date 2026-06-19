import { useThemeStore } from "../store/themeStore";

const options = [
    "luxury",
    "indian",
    "minimal",
    "organic",
    "royal",
    "rustic",
    "enterprise",
    "mono",
];

export default function ThemeSelector() {
    const { theme, setTheme } = useThemeStore();

    return (
        <div className="flex gap-2 flex-wrap">
            {options.map((t) => (
                <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-3 py-2 rounded ${
                        theme === t ? "bg-orange-500 text-white" : "bg-gray-200"
                    }`}
                >
                    {t}
                </button>
            ))}
        </div>
    );
}