import { prisma } from '../config/prisma.js';

export async function getMenu(req, reply) {
    const restaurantId = Number(req.params.restaurantId);
    const items = await prisma.menuItem.findMany({
        where: { restaurantId },
        orderBy: { id: 'desc' },
    });
    return items;
}

export async function createMenuItem(req, reply) {
    const restaurantId = Number(req.params.restaurantId);
    const { name, description, category, image, price, isAvailable } = req.body || {};

    if (!name || !category || price === undefined) {
        return reply.code(400).send({ message: 'Missing required fields' });
    }

    const item = await prisma.menuItem.create({
        data: {
            restaurantId,
            name,
            description: description || '',
            category,
            image: image || '',
            price: Number(price),
            isAvailable: isAvailable ?? true,
        },
    });

    return item;
}

export async function updateMenuItem(req, reply) {
    const menuId = Number(req.params.menuId);
    const data = req.body || {};

    const updated = await prisma.menuItem.update({
        where: { id: menuId },
        data: {
            ...data,
            price: data.price !== undefined ? Number(data.price) : undefined,
        },
    });

    return updated;
}

export async function deleteMenuItem(req, reply) {
    const menuId = Number(req.params.menuId);

    await prisma.menuItem.delete({ where: { id: menuId } });

    return { message: 'Menu item deleted' };
}

export async function toggleAvailability(req, reply) {
    const menuId = Number(req.params.menuId);
    const { isAvailable } = req.body || {};

    const updated = await prisma.menuItem.update({
        where: { id: menuId },
        data: { isAvailable: Boolean(isAvailable) },
    });

    return updated;
}