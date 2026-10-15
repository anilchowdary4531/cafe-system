import { Link, NavLink } from "react-router-dom";
import { ArrowLeft, UserCircle2 } from "lucide-react";
import BrandLogo from "./BrandLogo";

export default function CustomerProfileHeader({
    title = "Customer",
    subtitle = "",
    phone = "",
    avatarDataUrl = "",
    isOverview = false,
    sectionLabel = "",
    backTo = "/profile/overview?scope=customer",
    children = null,
}) {
    const displayTitle = title || "Guest";
    const displaySubtitle = subtitle || phone || "";

    return (
        <header className="w-full space-y-2 pb-3 border-b border-[color:var(--app-border)]/35">
            {/* Top Brand & Header Row */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    {!isOverview && (
                        <NavLink
                            to={backTo}
                            reloadDocument
                            aria-label="Back to overview"
                            title="Back to overview"
                            className="inline-flex h-8 w-8 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-lg text-[color:var(--app-text)] hover:bg-orange-500/10 hover:text-[var(--app-primary)] transition-all cursor-pointer shrink-0"
                        >
                            <ArrowLeft size={18} />
                        </NavLink>
                    )}

                    {/* Clickable Tiffzy Brand navigating to Customer Home ("/") */}
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 group focus:outline-none shrink-0"
                        aria-label="Tiffzy"
                        title="Tiffzy"
                    >
                        <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center shrink-0">
                            <BrandLogo
                                className="theme-brand-logo h-full w-full object-contain group-hover:scale-105 transition-transform"
                                title="Tiffzy logo"
                            />
                        </div>
                        <span className="theme-brand-text text-xl sm:text-2xl font-bold tracking-tight text-[var(--app-primary)]">
                            Tiffzy
                        </span>
                    </Link>

                    {!isOverview && sectionLabel && (
                        <div className="flex items-center gap-2 pl-2.5 border-l border-[color:var(--app-border)]/50 min-w-0">
                            <h1 className="text-sm sm:text-base font-bold text-[color:var(--app-text)] truncate">
                                {sectionLabel}
                            </h1>
                        </div>
                    )}
                </div>

                {/* Right Area: Optional subcomponent action & compact profile badge for subpages */}
                <div className="flex items-center gap-3 shrink-0">
                    {children}

                    {!isOverview && (
                        <NavLink
                            to={backTo}
                            reloadDocument
                            className="flex items-center gap-2 rounded-full py-0.5 px-1.5 sm:px-2 hover:bg-orange-500/[0.08] transition-colors cursor-pointer text-xs"
                            title="Back to overview"
                        >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-500/10 text-[var(--app-primary)] border border-orange-500/20">
                                {avatarDataUrl ? (
                                    <img src={avatarDataUrl} alt="Profile avatar" className="h-full w-full object-cover" />
                                ) : (
                                    <UserCircle2 size={17} />
                                )}
                            </div>
                            <div className="hidden sm:block text-left leading-tight">
                                <p className="font-semibold text-[color:var(--app-text)] truncate max-w-[130px] text-xs">
                                    {displayTitle}
                                </p>
                                <p className="theme-muted text-[10px] truncate max-w-[130px]">
                                    {displaySubtitle}
                                </p>
                            </div>
                        </NavLink>
                    )}
                </div>
            </div>

            {/* Overview Page: Customer Profile Identity directly below Tiffzy Brand */}
            {isOverview && (
                <div className="flex items-center gap-3.5 pt-1.5">
                    <div className="flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-500/10 text-[var(--app-primary)] border border-orange-500/20">
                        {avatarDataUrl ? (
                            <img src={avatarDataUrl} alt="Profile avatar" className="h-full w-full object-cover" />
                        ) : (
                            <UserCircle2 size={30} />
                        )}
                    </div>
                    <div className="min-w-0">
                        <h1 className="truncate text-xl sm:text-2xl font-bold tracking-tight text-[color:var(--app-text)]">
                            {displayTitle}
                        </h1>
                        <p className="theme-muted mt-0.5 truncate text-xs sm:text-sm font-medium">
                            {displaySubtitle}
                        </p>
                    </div>
                </div>
            )}
        </header>
    );
}
