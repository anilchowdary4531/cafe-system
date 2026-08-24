import React from "react";
import noConnectionImg from "../assets/no-connection.jpg";
import { RotateCcw, WifiOff } from "lucide-react";

export default function OfflineConnectionState({ message, onRetry, fullPage = false }) {
    const [isRetrying, setIsRetrying] = React.useState(false);

    const handleRetryClick = () => {
        setIsRetrying(true);
        if (onRetry) onRetry();
        setTimeout(() => setIsRetrying(false), 1200);
    };

    return (
        <div className={`flex flex-col items-center justify-center p-6 text-center ${fullPage ? "min-h-[70vh] w-full" : "my-8"}`}>
            <div className="theme-panel border theme-border rounded-3xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center animate-fade-in backdrop-blur-md">
                <div className="relative mb-6 overflow-hidden rounded-3xl border border-amber-500/20 shadow-xl max-w-[260px]">
                    <img 
                        src={noConnectionImg} 
                        alt="No Connection" 
                        className="w-full h-auto object-cover transform hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute top-3 right-3 bg-red-500/90 text-white p-2 rounded-full shadow-lg backdrop-blur-sm animate-pulse">
                        <WifiOff size={18} />
                    </div>
                </div>

                <h3 className="text-xl font-black text-white mb-2 tracking-tight">
                    Oops! Connection Lost
                </h3>
                
                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                    {message || "We're having trouble connecting to Tiffzy servers. Please check your internet connection and try again."}
                </p>

                <button
                    onClick={handleRetryClick}
                    disabled={isRetrying}
                    className="theme-button flex items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all w-full sm:w-auto"
                >
                    <RotateCcw size={18} className={`${isRetrying ? "animate-spin" : ""}`} />
                    {isRetrying ? "Reconnecting..." : "Retry Connection"}
                </button>
            </div>
        </div>
    );
}
