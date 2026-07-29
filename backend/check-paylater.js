import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const customerAccounts = await prisma.customerAccount.findMany();
  const customers = await prisma.customer.findMany();
  
  console.log("Customer Accounts:");
  console.log(JSON.stringify(customerAccounts, null, 2));
  
  console.log("Customers:");
  console.log(JSON.stringify(customers, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
