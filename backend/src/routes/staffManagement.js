import { requireStaffJwt } from "../services/staffAuthService.js";
import {
    getStaffShifts,
    saveStaffShift,
    deleteStaffShift,
    publishStaffShifts,
    copyPreviousWeekShifts,
    requestShiftSwap,
    respondToShiftSwap,
} from "../services/staffScheduleService.js";
import {
    clockInStaff,
    clockOutStaff,
    getAttendanceLogs,
    requestAttendanceCorrection,
    reviewAttendanceCorrection,
} from "../services/staffAttendanceService.js";
import {
    getStaffTasks,
    createStaffTask,
    toggleTaskCompletion,
    deleteTask,
} from "../services/staffTaskService.js";
import {
    getCustomRoles,
    createCustomRole,
    updateCustomRole,
    deleteCustomRole,
} from "../services/customRoleService.js";

export default async function staffManagementRoutes(app, deps) {
    const { prisma, realtime, STAFF_ALLOWED_ROLES } = deps;

    const requireStaffActor = async (req, reply) => {
        const actor = await requireStaffJwt(req, reply, { prisma, allowedRoles: STAFF_ALLOWED_ROLES });
        if (!actor) return reply;
        req.staffActor = actor;
        return null;
    };

    // --- SHIFT SCHEDULING ROUTES ---
    app.get("/api/v1/owner/:restaurantId/schedules", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId || 0);
            const { startDate, endDate, userId, role, status } = req.query;
            const shifts = await getStaffShifts({ prisma, restaurantId, startDate, endDate, userId, role, status });
            return reply.send({ shifts });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    app.post("/api/v1/owner/:restaurantId/schedules", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId || 0);
            const shift = await saveStaffShift({ prisma, restaurantId, ...req.body });
            return reply.send({ shift, message: "Shift saved successfully." });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    app.delete("/api/v1/owner/:restaurantId/schedules/:shiftId", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId || 0);
            await deleteStaffShift({ prisma, restaurantId, shiftId: req.params.shiftId });
            return reply.send({ success: true, message: "Shift deleted." });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    app.post("/api/v1/owner/:restaurantId/schedules/publish", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId || 0);
            const result = await publishStaffShifts({ prisma, realtime, restaurantId, ...req.body });
            return reply.send({ ...result, message: `${result.count} shifts published successfully.` });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    app.post("/api/v1/owner/:restaurantId/schedules/copy-week", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId || 0);
            const result = await copyPreviousWeekShifts({ prisma, restaurantId, ...req.body });
            return reply.send({ ...result, message: `${result.count} shifts copied.` });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    // --- SHIFT SWAP ROUTES ---
    app.post("/api/v1/staff/shifts/:shiftId/swap", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.staffActor?.restaurantId || req.body?.restaurantId || 0);
            const requesterId = Number(req.staffActor?.userId || req.staffActor?.id || 0);
            const swap = await requestShiftSwap({
                prisma,
                realtime,
                restaurantId,
                shiftId: req.params.shiftId,
                requesterId,
                targetUserId: req.body?.targetUserId,
            });
            return reply.send({ swap, message: "Shift swap request sent to peer." });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    app.post("/api/v1/staff/shift-swaps/:swapId/respond", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.staffActor?.restaurantId || 0);
            const targetUserId = Number(req.staffActor?.userId || req.staffActor?.id || 0);
            const result = await respondToShiftSwap({
                prisma,
                realtime,
                restaurantId,
                swapId: req.params.swapId,
                targetUserId,
                accept: Boolean(req.body?.accept),
            });
            return reply.send({ result, message: req.body?.accept ? "Shift swap accepted and reassigned!" : "Shift swap rejected." });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    // --- ATTENDANCE & TIME CLOCK ROUTES ---
    app.post("/api/v1/staff/clock-in", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.staffActor?.restaurantId || req.body?.restaurantId || 0);
            const userId = Number(req.staffActor?.userId || req.staffActor?.id || 0);
            const record = await clockInStaff({
                prisma,
                restaurantId,
                userId,
                lat: req.body?.lat,
                lng: req.body?.lng,
            });
            return reply.send({ record, message: "Clock-in successful! Have a great shift." });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    app.post("/api/v1/staff/clock-out", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.staffActor?.restaurantId || req.body?.restaurantId || 0);
            const userId = Number(req.staffActor?.userId || req.staffActor?.id || 0);
            const record = await clockOutStaff({
                prisma,
                restaurantId,
                userId,
                lat: req.body?.lat,
                lng: req.body?.lng,
            });
            return reply.send({ record, message: "Clock-out successful! Shift completed." });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    app.get("/api/v1/owner/:restaurantId/attendance", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId || 0);
            const { startDate, endDate, userId, status } = req.query;
            const logs = await getAttendanceLogs({ prisma, restaurantId, startDate, endDate, userId, status });
            return reply.send({ logs });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    app.post("/api/v1/staff/attendance/correction", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const userId = Number(req.staffActor?.userId || req.staffActor?.id || 0);
            const correction = await requestAttendanceCorrection({ prisma, userId, ...req.body });
            return reply.send({ correction, message: "Attendance correction request submitted to manager." });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    app.put("/api/v1/owner/:restaurantId/attendance/correction/:correctionId", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const reviewerId = Number(req.staffActor?.userId || req.staffActor?.id || 0);
            const correction = await reviewAttendanceCorrection({
                prisma,
                correctionId: req.params.correctionId,
                reviewerId,
                approve: Boolean(req.body?.approve),
                reviewNotes: req.body?.reviewNotes,
            });
            return reply.send({ correction, message: `Correction request ${req.body?.approve ? "approved" : "rejected"}.` });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    // --- TASKS & CHECKLISTS ROUTES ---
    app.get("/api/v1/owner/:restaurantId/tasks", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId || 0);
            const tasks = await getStaffTasks({ prisma, restaurantId, ...req.query });
            return reply.send({ tasks });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    app.post("/api/v1/owner/:restaurantId/tasks", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId || 0);
            const task = await createStaffTask({ prisma, restaurantId, ...req.body });
            return reply.send({ task, message: "Task created successfully." });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    app.put("/api/v1/staff/tasks/:taskId/complete", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const userId = Number(req.staffActor?.userId || req.staffActor?.id || 0);
            const task = await toggleTaskCompletion({
                prisma,
                taskId: req.params.taskId,
                userId,
                isCompleted: req.body?.isCompleted,
            });
            return reply.send({ task });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    app.delete("/api/v1/owner/:restaurantId/tasks/:taskId", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId || 0);
            await deleteTask({ prisma, restaurantId, taskId: req.params.taskId });
            return reply.send({ success: true, message: "Task deleted." });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    // --- CUSTOM ROLES ROUTES ---
    app.get("/api/v1/owner/:restaurantId/custom-roles", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId || 0);
            const roles = await getCustomRoles({ prisma, restaurantId });
            return reply.send({ roles });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    app.post("/api/v1/owner/:restaurantId/custom-roles", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId || 0);
            const role = await createCustomRole({ prisma, restaurantId, ...req.body });
            return reply.send({ role, message: "Custom role created." });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    app.put("/api/v1/owner/:restaurantId/custom-roles/:roleId", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId || 0);
            const role = await updateCustomRole({ prisma, restaurantId, roleId: req.params.roleId, ...req.body });
            return reply.send({ role, message: "Custom role updated." });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });

    app.delete("/api/v1/owner/:restaurantId/custom-roles/:roleId", { preHandler: requireStaffActor }, async (req, reply) => {
        try {
            const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId || 0);
            await deleteCustomRole({ prisma, restaurantId, roleId: req.params.roleId });
            return reply.send({ success: true, message: "Custom role deleted." });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ message: err.message });
        }
    });
}
