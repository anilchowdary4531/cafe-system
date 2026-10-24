const normalizeText = (value) =>
    String(value || "")
        .trim()
        .toUpperCase()
        .replace(/[\s_-]+/g, " ");

export const inferRoleFromDesignation = (designation) => {
    const text = normalizeText(designation);
    if (!text) return null;

    if (text.includes("STEWARD")) {
        return "STEWARD";
    }

    if (text.includes("CLEANER")) {
        return "CLEANER";
    }

    if (text.includes("SWIPER")) {
        return "SWIPER";
    }

    if (text.includes("CASHIER")) {
        return "CASHIER";
    }

    if (text.includes("SERVER") || text.includes("WAITER")) {
        return "WAITER";
    }

    if (text.includes("CHEF")) {
        return "CHEF";
    }

    if (text.includes("MANAGER")) {
        return "MANAGER";
    }

    if (text.includes("OWNER")) {
        return "OWNER";
    }

    if (text.includes("SUPER ADMIN")) {
        return "SUPER_ADMIN";
    }

    return null;
};

export const resolveEffectiveStaffRole = (role, designation) => {
    const normalizedRole = String(role || "").trim().toUpperCase();
    if (normalizedRole === "SUPER_ADMIN") return "SUPER_ADMIN";
    if (normalizedRole && normalizedRole !== "STAFF") return normalizedRole;

    return inferRoleFromDesignation(designation) || normalizedRole || "STAFF";
};

export const isSeniorChef = (role, designation) => {
    const r = String(role || "").trim().toUpperCase();
    if (r === "OWNER" || r === "MANAGER" || r === "SUPER_ADMIN") return true;
    const d = String(designation || "").trim().toUpperCase();
    return d.includes("SENIOR") || d.includes("HEAD") || d.includes("EXECUTIVE") || d.includes("LEAD") || d.includes("SOUS") || d.includes("MASTER");
};

export const getStaffRedirectPath = (role, designation, userId) => {
    const normalizedRole = resolveEffectiveStaffRole(role, designation);
    const senior = isSeniorChef(role, designation);

    if (normalizedRole === "SUPER_ADMIN") {
        return "/super-admin";
    }
    if (normalizedRole === "ADMIN") {
        return "/admin";
    }
    if (normalizedRole === "OWNER") {
        return "/owner";
    }
    if (normalizedRole === "CHEF") {
        if (senior) return "/kitchen";
        return userId ? `/kitchen/chef/${userId}` : "/kitchen";
    }
    if (normalizedRole === "WAITER") {
        return "/server";
    }
    if (normalizedRole === "STEWARD") {
        return "/staff/steward";
    }
    if (normalizedRole === "CASHIER") {
        return "/staff/cashier";
    }
    if (normalizedRole === "CLEANER") {
        return "/staff/cleaner";
    }
    if (normalizedRole === "SWIPER") {
        return "/staff/swiper";
    }
    if (normalizedRole === "MANAGER") {
        return "/owner";
    }
    if (normalizedRole === "STAFF" || (role && String(role).toUpperCase() !== "CUSTOMER")) {
        return "/staff/workspace";
    }
    return "/";
};

export const getChefStationPath = (user) => {
    if (!user) return "/kitchen";
    if (isSeniorChef(user.role, user.designation)) {
        return "/kitchen";
    }
    const chefId = user.id || user.userId;
    return chefId ? `/kitchen/chef/${chefId}` : "/kitchen";
};

export const getRedirectPath = getStaffRedirectPath;



