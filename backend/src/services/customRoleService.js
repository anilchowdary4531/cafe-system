/**
 * Custom Role Service
 * Allows restaurant owners to create and manage custom staff roles with tailored module permissions.
 */

export const getCustomRoles = async ({ prisma, restaurantId } = {}) => {
    const rid = Number(restaurantId);
    if (!rid) throw new Error("restaurant_id_required");

    return await prisma.customRole.findMany({
        where: { restaurantId: rid },
        orderBy: { createdAt: "desc" },
    });
};

export const createCustomRole = async ({ prisma, restaurantId, name, description = "", access = {} } = {}) => {
    const rid = Number(restaurantId);
    if (!rid || !name) throw new Error("Role name and restaurant ID are required");

    return await prisma.customRole.create({
        data: {
            restaurantId: rid,
            name: String(name).trim(),
            description: description ? String(description).trim() : null,
            access: access && typeof access === "object" ? access : {},
        },
    });
};

export const updateCustomRole = async ({ prisma, restaurantId, roleId, name, description, access } = {}) => {
    const rid = Number(restaurantId);
    const rId = Number(roleId);
    if (!rid || !rId) throw new Error("Invalid parameters");

    return await prisma.customRole.update({
        where: { id: rId, restaurantId: rid },
        data: {
            ...(name ? { name: String(name).trim() } : {}),
            ...(description !== undefined ? { description: String(description).trim() } : {}),
            ...(access && typeof access === "object" ? { access } : {}),
        },
    });
};

export const deleteCustomRole = async ({ prisma, restaurantId, roleId } = {}) => {
    const rid = Number(restaurantId);
    const rId = Number(roleId);
    if (!rid || !rId) throw new Error("Invalid parameters");

    return await prisma.customRole.delete({
        where: { id: rId, restaurantId: rid },
    });
};
