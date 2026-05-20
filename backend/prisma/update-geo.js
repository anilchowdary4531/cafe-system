import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

const prisma = new PrismaClient();
const seedData = JSON.parse(new TextDecoder().decode(await readFile(new URL("./seed-data.json", import.meta.url))));

const main = async () => {
  const restaurants = Array.isArray(seedData?.restaurants) ? seedData.restaurants : [];
  if (!restaurants.length) {
    console.log("No restaurants found in seed-data.json");
    return;
  }

  let updated = 0;

  for (const r of restaurants) {
    const slug = String(r?.slug || "").trim();
    const latitude = r?.latitude;
    const longitude = r?.longitude;
    if (!slug) continue;
    if (latitude === undefined && longitude === undefined) continue;

    const result = await prisma.restaurant.updateMany({
      where: { slug },
      data: {
        latitude: latitude === undefined ? undefined : Number(latitude),
        longitude: longitude === undefined ? undefined : Number(longitude),
      },
    });
    updated += Number(result.count || 0);
  }

  console.log(`Updated geo for ${updated} restaurant record(s).`);
};

main()
  .catch((err) => {
    console.error("Geo update failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

