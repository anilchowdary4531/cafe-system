import ThemePreviewCard from "../components/ThemePreviewCard";
import { themePreview } from "../styles/themePreview";

export default function SettingsPage() {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Theme Settings</h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {Object.entries(themePreview).map(([key, preview]) => (
                    <ThemePreviewCard
                        key={key}
                        id={key}
                        name={key}
                        preview={preview}
                    />
                ))}
            </div>
        </div>
    );
}