export const allowRoles = (...roles) => async (req, reply) => {
    if (!roles.includes(req.user.role)) {
        return reply.code(403).send({ message: 'Forbidden' });
    }
};