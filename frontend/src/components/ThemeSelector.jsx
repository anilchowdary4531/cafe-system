import { Palette } from "lucide-react";
import { useRestaurantTheme } from "../context/ThemeContext";

export default function ThemeSelector({ variant = "default" }) {
    const { activeTheme, themes, setThemeId } = useRestaurantTheme();
    const compact = variant === "compact";

    return (
        <label className={`theme-dropdown ${compact ? "theme-dropdown-compact" : ""}`}>
            <span className="theme-dropdown-label">
                <Palette size={15} />
                <span>{compact ? "Theme" : "UI Theme"}</span>
            </span>

            <select
                value={activeTheme.id}
                onChange={(event) => setThemeId(event.target.value)}
                aria-label="Select UI theme"
            >
                {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                        {theme.number}. {theme.name}
                    </option>
                ))}
            </select>

            <span
                className="theme-dropdown-swatch"
                style={{ backgroundColor: activeTheme.preview.primary }}
                aria-hidden="true"
            />
        </label>
    );
}
