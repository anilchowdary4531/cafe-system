import { useThemeStore } from "../store/themeStore";

export default function ThemePreviewCard({ id, name, preview }) {
    const { theme, setTheme } = useThemeStore();

    return (
        <div
            onClick={() => setTheme(id)}
            className={`cursor-pointer border p-3 rounded ${
                theme === id ? "border-orange-500" : ""
            }`}
        >
            <div className={`h-20 ${preview.bg}`} />
            <p className="mt-2 capitalize">{name}</p>
        </div>
    );
}