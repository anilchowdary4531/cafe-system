import ThemeSelector from "../components/ThemeSelector";
import ThemePreviewCard from "../components/ThemePreviewCard.jsx";

export default function SettingsPage() {
    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Theme Settings</h1>
            <ThemeSelector />
        </div>
    );
}