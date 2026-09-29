/**
 * Staff Task & Checklist Service
 * Manages recurring shift checklists (Opening, Mid-day, Closing) and ad-hoc staff tasks.
 */

export const getStaffTasks = async ({ prisma, restaurantId, category, assignedTo, roleTarget, isCompleted } = {}) => {
    const rid = Number(restaurantId);
    if (!rid) throw new Error("restaurant_id_required");

    const where = {
        restaurantId: rid,
        ...(category ? { category: String(category).toUpperCase() } : {}),
        ...(assignedTo ? { assignedTo: Number(assignedTo) } : {}),
        ...(roleTarget ? { roleTarget: String(roleTarget).toUpperCase() } : {}),
        ...(isCompleted !== undefined ? { isCompleted: Boolean(isCompleted) } : {}),
    };

    return await prisma.staffTask.findMany({
        where,
        include: {
            assignedUser: { select: { id: true, name: true, role: true } },
        },
        orderBy: [{ isCompleted: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });
};

export const createStaffTask = async ({
    prisma,
    restaurantId,
    title,
    description = "",
    category = "ADHOC",
    assignedTo = null,
    roleTarget = null,
    priority = "MEDIUM",
    dueDate = null,
} = {}) => {
    const rid = Number(restaurantId);
    if (!rid || !title) throw new Error("Title and restaurant ID are required");

    return await prisma.staffTask.create({
        data: {
            restaurantId: rid,
            title: String(title).trim(),
            description: description ? String(description).trim() : null,
            category: String(category).toUpperCase(),
            assignedTo: assignedTo ? Number(assignedTo) : null,
            roleTarget: roleTarget ? String(roleTarget).toUpperCase() : null,
            priority: String(priority).toUpperCase(),
            dueDate: dueDate ? new Date(dueDate) : null,
        },
        include: {
            assignedUser: { select: { id: true, name: true, role: true } },
        },
    });
};

export const toggleTaskCompletion = async ({ prisma, taskId, userId, isCompleted } = {}) => {
    const tid = Number(taskId);
    if (!tid) throw new Error("task_id_required");

    const completed = Boolean(isCompleted);

    return await prisma.staffTask.update({
        where: { id: tid },
        data: {
            isCompleted: completed,
            completedAt: completed ? new Date() : null,
            completedBy: completed && userId ? Number(userId) : null,
        },
        include: {
            assignedUser: { select: { id: true, name: true, role: true } },
        },
    });
};

export const deleteTask = async ({ prisma, restaurantId, taskId } = {}) => {
    const rid = Number(restaurantId);
    const tid = Number(taskId);
    if (!rid || !tid) throw new Error("Invalid parameters");

    return await prisma.staffTask.delete({
        where: { id: tid, restaurantId: rid },
    });
};
