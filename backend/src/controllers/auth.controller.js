import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';

export async function login(req, reply) {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !password) {
        return reply.code(400).send({ message: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { restaurant: true, staffAccess: true }
    });

    if (!user) return reply.code(401).send({ message: 'Invalid email' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return reply.code(401).send({ message: 'Invalid password' });

    if (user.isActive === false) {
        return reply.code(403).send({ message: 'Account disabled' });
    }

    const token = req.server.jwt.sign({
        id: user.id,
        role: user.role,
        restaurantId: user.restaurantId || null,
    });

    return {
        message: 'Login success',
        token,
        user,
    };
}

export async function me(req, reply) {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { restaurant: true }
    });
    return { user };
}