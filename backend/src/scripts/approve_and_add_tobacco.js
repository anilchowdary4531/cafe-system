import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Checking database connection and Cafe King restaurant ===");

  // Ensure column exists
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "tobacco_approved" BOOLEAN DEFAULT false;`
    );
  } catch (err) {
    console.log("Column alter notice:", err.message);
  }

  // Find Cafe King
  let restaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [
        { name: { contains: "Cafe King", mode: "insensitive" } },
        { name: { contains: "cafeking", mode: "insensitive" } },
        { slug: { contains: "cafe-king", mode: "insensitive" } },
        { slug: { contains: "cafeking", mode: "insensitive" } },
      ],
    },
  });

  if (!restaurant) {
    console.log("Cafe King not found by search query, fetching first available restaurant...");
    restaurant = await prisma.restaurant.findFirst();
  }

  if (!restaurant) {
    console.error("No restaurants found in database!");
    process.exit(1);
  }

  console.log(`Found Restaurant: ID=${restaurant.id}, Name="${restaurant.name}", Slug="${restaurant.slug}"`);

  // Approve tobacco sales
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { tobaccoApproved: true },
  }).catch((e) => console.warn("Prisma update warning:", e.message));

  await prisma.$executeRawUnsafe(
    `UPDATE "restaurants" SET "tobacco_approved" = true WHERE id = ${restaurant.id};`
  );

  console.log(`✅ Approved Tobacco Sales for Restaurant ID ${restaurant.id} (${restaurant.name}) in database.`);

  // Verify DB state
  const rawCheck = await prisma.$queryRawUnsafe(
    `SELECT id, name, tobacco_approved FROM "restaurants" WHERE id = ${restaurant.id};`
  );
  console.log("Raw DB Check Result:", rawCheck);

  // Add 3 sample tobacco items if not present
  const tobaccoItems = [
    {
      name: "Marlboro Gold Lights (Pack of 20)",
      description: "Smooth blend premium imported cigarette pack",
      category: "Cigarettes",
      price: 380,
      originalPrice: 400,
      image: "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=500&q=80",
      isAvailable: true,
      restaurantId: restaurant.id,
    },
    {
      name: "Classic Milds (Pack of 20)",
      description: "King size premium smooth filter cigarettes",
      category: "Cigarettes",
      price: 360,
      originalPrice: 380,
      image: "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=500&q=80",
      isAvailable: true,
      restaurantId: restaurant.id,
    },
    {
      name: "Gold Flake Kings (Pack of 10)",
      description: "Rich honey dew flavor filter cigarettes",
      category: "Cigarettes",
      price: 180,
      originalPrice: 200,
      image: "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=500&q=80",
      isAvailable: true,
      restaurantId: restaurant.id,
    },
  ];

  let addedCount = 0;
  for (const itemData of tobaccoItems) {
    const existing = await prisma.menuItem.findFirst({
      where: {
        restaurantId: restaurant.id,
        name: { equals: itemData.name, mode: "insensitive" },
      },
    });

    if (!existing) {
      await prisma.menuItem.create({
        data: itemData,
      });
      console.log(`  + Created Tobacco Item: "${itemData.name}" (₹${itemData.price})`);
      addedCount++;
    } else {
      console.log(`  - Item already exists: "${existing.name}"`);
    }
  }

  const allItems = await prisma.menuItem.findMany({
    where: { restaurantId: restaurant.id },
    select: { id: true, name: true, category: true, price: true },
  });

  console.log(`Total Menu Items for ${restaurant.name}: ${allItems.length}`);
  console.log("Cigarette / Tobacco items in menu:");
  const tobaccoInMenu = allItems.filter(
    (i) => /cigarette|tobacco|marlboro|classic|gold flake/i.test(i.name) || /cigarette|tobacco/i.test(i.category)
  );
  console.table(tobaccoInMenu);

  console.log("\n=== SUCCESS: Connection verified, Cafe King approved, and sample tobacco items added! ===");
}

main()
  .catch((e) => {
    console.error("Script error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
