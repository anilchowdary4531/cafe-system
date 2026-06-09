const normalizeText = (value) =>
    String(value || "")
        .trim()
        .toUpperCase()
        .replace(/[\s_-]+/g, " ");

export const inferRoleFromDesignation = (designation) => {
    const text = normalizeText(designation);
    if (!text) return null;

    if (text.includes("SERVER") || text.includes("WAITER") || text.includes("STEWARD")) {
        return "WAITER";
    }

    if (text.includes("CHEF")) {
        return "CHEF";
    }

    if (text.includes("MANAGER")) {
        return "MANAGER";
    }

    if (text.includes("CASHIER")) {
        return "CASHIER";
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
