import prisma from "../prisma.js";
import { calculateFinalPrice } from "./supplierProductService.js";

const DEFAULT_CATEGORIES = [
    { name: "Food ingredients", slug: "food-ingredients", imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80", priority: 100 },
    { name: "Beverages", slug: "beverages", imageUrl: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=300&q=80", priority: 90 },
    { name: "Fresh produce", slug: "fresh-produce", imageUrl: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=300&q=80", priority: 80 },
    { name: "Meat, poultry, and seafood", slug: "meat-poultry-seafood", imageUrl: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=300&q=80", priority: 70 },
    { name: "Dairy and eggs", slug: "dairy-and-eggs", imageUrl: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=300&q=80", priority: 60 },
    { name: "Dry goods and groceries", slug: "dry-goods-groceries", imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=80", priority: 50 },
    { name: "Bakery supplies", slug: "bakery-supplies", imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80", priority: 40 },
    { name: "Spices and condiments", slug: "spices-and-condiments", imageUrl: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=300&q=80", priority: 30 },
    { name: "Packaging materials", slug: "packaging-materials", imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=300&q=80", priority: 20 },
    { name: "Utensils and kitchenware", slug: "utensils-kitchenware", imageUrl: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=300&q=80", priority: 10 },
];

const DEFAULT_PRODUCTS = [
    {
        name: "Fresh Chicken Breast (Boneless)",
        categorySlug: "meat-poultry-seafood",
        description: "Farm-fresh antibiotic-free boneless chicken breast, cleaned and tenderized for kitchen prep.",
        unit: "KG",
        moq: 5,
        basePrice: 240,
        taxPercent: 5.0,
        discountType: "PERCENTAGE",
        discountValue: 10,
        initialStock: 250,
        imageUrl: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=800&q=80",
    },
    {
        name: "Premium Basmati Rice (Royal Long Grain - 25kg Bag)",
        categorySlug: "dry-goods-groceries",
        description: "Aged long grain aromatic Basmati rice ideal for biryanis and fried rice.",
        unit: "BAG",
        moq: 2,
        basePrice: 1850,
        taxPercent: 5.0,
        discountType: "FIXED",
        discountValue: 150,
        initialStock: 80,
        imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    },
    {
        name: "Farm Fresh Tomatoes (A-Grade Red)",
        categorySlug: "fresh-produce",
        description: "Ripe, firm red tomatoes sourced daily from regional partner farms.",
        unit: "KG",
        moq: 10,
        basePrice: 35,
        taxPercent: 0.0,
        discountType: "PERCENTAGE",
        discountValue: 5,
        initialStock: 500,
        imageUrl: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80",
    },
    {
        name: "Mineral Water Bottles (24 x 1 Litre Case)",
        categorySlug: "beverages",
        description: "Sealed 1L purified mineral water bottles for restaurant dine-in and catering.",
        unit: "CASE",
        moq: 5,
        basePrice: 280,
        taxPercent: 12.0,
        discountType: "PERCENTAGE",
        discountValue: 8,
        initialStock: 120,
        imageUrl: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=800&q=80",
    },
    {
        name: "Fresh Malai Paneer (Block - 1kg)",
        categorySlug: "dairy-and-eggs",
        description: "Soft, creamy high-protein cottage cheese block made from 100% pure cow milk.",
        unit: "KG",
        moq: 3,
        basePrice: 320,
        taxPercent: 5.0,
        discountType: "PERCENTAGE",
        discountValue: 12,
        initialStock: 150,
        imageUrl: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80",
    },
    {
        name: "Refined Sunflower Cooking Oil (15 Litre Tin)",
        categorySlug: "dry-goods-groceries",
        description: "Clear, light cooking oil with high smoke point for deep frying and daily kitchen use.",
        unit: "TIN",
        moq: 1,
        basePrice: 1980,
        taxPercent: 5.0,
        discountType: "FIXED",
        discountValue: 100,
        initialStock: 60,
        imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80",
    },
    {
        name: "Takeaway Food Containers (3-Compartment - 100 Pcs)",
        categorySlug: "packaging-materials",
        description: "Microwave-safe leakproof meal delivery box containers for restaurant parcel orders.",
        unit: "PACK",
        moq: 2,
        basePrice: 650,
        taxPercent: 18.0,
        discountType: "PERCENTAGE",
        discountValue: 15,
        initialStock: 200,
        imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80",
    },
    {
        name: "Pure Red Chilli Powder (1kg Pack)",
        categorySlug: "spices-and-condiments",
        description: "Vibrant red Guntur chilli powder ground from premium sun-dried chillies.",
        unit: "KG",
        moq: 2,
        basePrice: 290,
        taxPercent: 5.0,
        discountType: "PERCENTAGE",
        discountValue: 10,
        initialStock: 100,
        imageUrl: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80",
    },
];

export async function ensureSupplyMarketplaceSeeded() {
    try {
        const existingCount = await prisma.supplyProduct.count({ where: { isDeleted: false } });
        if (existingCount > 0) {
            return { seeded: false, count: existingCount };
        }

        console.log("[SupplyMarketplaceSeeder] Seeding initial verified supply categories and products...");

        // 1. Ensure Verified Active Supplier exists
        let supplier = await prisma.supplier.findFirst({
            where: { isVerified: true, status: "ACTIVE" },
        });

        if (!supplier) {
            supplier = await prisma.supplier.create({
                data: {
                    email: "verified_supplier@tiffzy.com",
                    phone: "9876543210",
                    passwordHash: "$2b$10$NZ9CtTdfwRRUjhfnuFpuL.G9DF.9tokGGXiB/Ii4J0WULG4qxFOjW",
                    status: "ACTIVE",
                    isVerified: true,
                    profile: {
                        create: {
                            businessName: "Tiffzy Prime Wholesalers & Distributors",
                            contactName: "Rajesh Kumar",
                            rating: 4.9,
                        },
                    },
                    addresses: {
                        create: {
                            addressLine: "Plot 42, Central Wholesale Supply Market",
                            city: "Hyderabad",
                            state: "Telangana",
                            pincode: "500001",
                        },
                    },
                },
            });
        }

        // 2. Ensure Categories exist
        const categoryMap = new Map();
        for (const cat of DEFAULT_CATEGORIES) {
            const createdCat = await prisma.supplyCategory.upsert({
                where: { slug: cat.slug },
                update: { name: cat.name, imageUrl: cat.imageUrl, priority: cat.priority },
                create: { name: cat.name, slug: cat.slug, imageUrl: cat.imageUrl, priority: cat.priority, isActive: true },
            });
            categoryMap.set(cat.slug, createdCat.id);
        }

        // 3. Create Products
        let createdCount = 0;
        for (const prodData of DEFAULT_PRODUCTS) {
            const catId = categoryMap.get(prodData.categorySlug) || null;
            const slug = `${prodData.categorySlug}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

            const pricing = calculateFinalPrice(
                prodData.basePrice,
                prodData.taxPercent,
                prodData.discountType,
                prodData.discountValue
            );

            await prisma.$transaction(async (tx) => {
                const product = await tx.supplyProduct.create({
                    data: {
                        supplierId: supplier.id,
                        categoryId: catId,
                        name: prodData.name,
                        slug,
                        description: prodData.description,
                        unit: prodData.unit,
                        moq: prodData.moq,
                        availability: true,
                        status: "APPROVED",
                    },
                });

                await tx.supplyPrice.create({
                    data: {
                        productId: product.id,
                        basePrice: pricing.basePrice,
                        taxPercent: pricing.taxPercent,
                        isActive: true,
                    },
                });

                if (prodData.discountType && prodData.discountValue > 0) {
                    await tx.supplyDiscount.create({
                        data: {
                            productId: product.id,
                            type: prodData.discountType,
                            value: prodData.discountValue,
                            isActive: true,
                        },
                    });
                }

                await tx.supplyInventory.create({
                    data: {
                        productId: product.id,
                        totalStock: prodData.initialStock,
                        reservedStock: 0,
                        availableStock: prodData.initialStock,
                        lowStockAlert: 10,
                    },
                });

                if (prodData.imageUrl) {
                    await tx.supplyProductImage.create({
                        data: {
                            productId: product.id,
                            imageUrl: prodData.imageUrl,
                            priority: 0,
                            isPrimary: true,
                        },
                    });
                }
            });

            createdCount++;
        }

        console.log(`[SupplyMarketplaceSeeder] Successfully seeded ${createdCount} verified supply products!`);
        return { seeded: true, count: createdCount };
    } catch (err) {
        console.error("[SupplyMarketplaceSeeder] Error seeding products:", err);
        return { seeded: false, error: err.message };
    }
}
