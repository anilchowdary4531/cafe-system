import React, { useState } from "react";
import { Globe, Check, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export default function LanguageSelector({ variant = "button", className = "" }) {
  const { language, setLanguage, currentLanguageObj, languages, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (code) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <>
      {variant === "menu-item" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-black/5 dark:hover:bg-white/5 ${className}`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
              <Globe size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold">{t("appLanguage")}</p>
              <p className="text-xs theme-muted">
                {currentLanguageObj.flag} {currentLanguageObj.nativeName} ({currentLanguageObj.name})
              </p>
            </div>
          </div>
          <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold dark:bg-white/10">
            {currentLanguageObj.flag} {currentLanguageObj.code.toUpperCase()}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-xs font-semibold backdrop-blur-md shadow-sm transition hover:bg-white dark:border-white/15 dark:bg-slate-800/80 dark:hover:bg-slate-800 ${className}`}
          title={t("selectLanguage")}
        >
          <Globe size={14} className="theme-muted" />
          <span>{currentLanguageObj.flag} {currentLanguageObj.code.toUpperCase()}</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-xs rounded-2xl border border-black/10 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe size={18} className="theme-muted" />
                <h3 className="text-base font-bold">{t("selectLanguage")}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              {languages.map((lang) => {
                const isSelected = language === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelect(lang.code)}
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition ${
                      isSelected
                        ? "bg-orange-500/10 font-bold text-orange-600 dark:bg-orange-500/20 dark:text-orange-400"
                        : "hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{lang.flag}</span>
                      <div>
                        <p className="text-sm font-semibold">{lang.nativeName}</p>
                        <p className="text-xs theme-muted">{lang.name}</p>
                      </div>
                    </div>
                    {isSelected && <Check size={18} className="text-orange-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
