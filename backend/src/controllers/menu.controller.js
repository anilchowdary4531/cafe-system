import { prisma } from '../config/prisma.js';
import { resolveMenuPricing } from '../services/menuPricingService.js';

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
    const { name, description, category, image, price, originalPrice, discountPercent, isAvailable } = req.body || {};

    if (!name || !category || (price === undefined && originalPrice === undefined)) {
        return reply.code(400).send({ message: 'Missing required fields' });
    }

    const pricing = resolveMenuPricing({ price, originalPrice, discountPercent });

    const item = await prisma.menuItem.create({
        data: {
            restaurantId,
            name,
            description: description || '',
            category,
            image: image || '',
            price: pricing.price,
            originalPrice: pricing.originalPrice,
            discountPercent: pricing.discountPercent,
            isAvailable: isAvailable ?? true,
        },
    });

    return item;
}

export async function updateMenuItem(req, reply) {
    const menuId = Number(req.params.menuId);
    const data = req.body || {};
    const existing = await prisma.menuItem.findUnique({ where: { id: menuId } });
    if (!existing) {
        return reply.code(404).send({ message: 'Menu item not found' });
    }

    const pricing = resolveMenuPricing(data, existing);

    const updated = await prisma.menuItem.update({
        where: { id: menuId },
        data: {
            ...data,
            price: pricing.price,
            originalPrice: pricing.originalPrice,
            discountPercent: pricing.discountPercent,
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
