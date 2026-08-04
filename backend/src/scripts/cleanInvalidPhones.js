import { PrismaClient } from "@prisma/client";
import { isValidPhone } from "../services/phoneService.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting DB cleanup for invalid phone numbers...");

  const customerAccounts = await prisma.customerAccount.findMany({
    where: {
      phone: { not: null },
    },
  });

  console.log(`Found ${customerAccounts.length} customer accounts with phone numbers set.`);

  let updatedCount = 0;
  for (const acc of customerAccounts) {
    if (!acc.phone || !isValidPhone(acc.phone)) {
      console.log(`Clearing invalid phone for account ID ${acc.id} (${acc.email || acc.name}): "${acc.phone}" -> null`);
      await prisma.customerAccount.update({
        where: { id: acc.id },
        data: { phone: null },
      });
      updatedCount++;
    }
  }

  console.log(`Cleanup finished! Updated ${updatedCount} customer accounts.`);
}

main()
  .catch((e) => {
    console.error("Error during phone cleanup:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
