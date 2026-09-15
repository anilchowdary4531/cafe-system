import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Testing Tobacco Query ===");

  // 1. Check all restaurants in DB
  const rawRestaurants = await prisma.$queryRawUnsafe(`SELECT id, name, is_active, tobacco_approved FROM "restaurants";`);
  console.log("All Restaurants in DB:", rawRestaurants);

  // 2. Check Prisma findMany for restaurants
  const prismaRestaurants = await prisma.restaurant.findMany({
    select: { id: true, name: true, isActive: true, tobaccoApproved: true },
  });
  console.log("Prisma Restaurants:", prismaRestaurants);

  // 3. Check items for tobaccoApproved restaurants
  const isTobaccoTerm = (s = "") => /cigarette|tobacco|marlboro|gold flake|classic|cigar|pan|hookah/i.test(s);

  const rawItems = await prisma.menuItem.findMany({
    where: {
      isAvailable: true,
      restaurant: {
        isActive: true,
      },
    },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          state: true,
          logoUrl: true,
          isActive: true,
          tobaccoApproved: true,
        },
      },
    },
  });

  console.log(`Found ${rawItems.length} total available items across active restaurants.`);
  
  const rawTobaccoList = await prisma.$queryRawUnsafe(`SELECT id, tobacco_approved FROM "restaurants";`);
  const rawMap = {};
  if (Array.isArray(rawTobaccoList)) {
    rawTobaccoList.forEach((r) => {
      rawMap[r.id] = Boolean(r.tobacco_approved);
    });
  }
  console.log("Raw Tobacco Map:", rawMap);

  const filtered = rawItems.filter((item) => {
    const isAppr = item.restaurant?.tobaccoApproved === true || rawMap[item.restaurant?.id] === true;
    if (!item.restaurant || !item.restaurant.isActive || !isAppr) {
      return false;
    }
    return isTobaccoTerm(item.name) || isTobaccoTerm(item.category) || isTobaccoTerm(item.description);
  });

  console.log(`Filtered Tobacco Items Count: ${filtered.length}`);
  console.table(filtered.map(i => ({ id: i.id, name: i.name, category: i.category, rest: i.restaurant?.name, appr: i.restaurant?.tobaccoApproved, rawAppr: rawMap[i.restaurant?.id] })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
