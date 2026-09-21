import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "jekkaramesh788@gmail.com";
  const rawPassword = "nanda@000";

  console.log(`=== Checking SuperAdmin User: ${email} ===`);

  let user = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
    },
  });

  if (!user) {
    console.log(`User ${email} NOT found in database. Creating SUPER_ADMIN user...`);
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    user = await prisma.user.create({
      data: {
        name: "Jekka Ramesh",
        email: email.toLowerCase(),
        password: hashedPassword,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
    console.log(`✅ Created Super Admin user successfully: ID=${user.id}, email=${user.email}, role=${user.role}`);
  } else {
    console.log(`Found User: ID=${user.id}, Name="${user.name}", Role="${user.role}", isActive=${user.isActive}`);
    
    // Check password
    const isPasswordValid = await bcrypt.compare(rawPassword, user.password);
    console.log(`Password "${rawPassword}" valid?`, isPasswordValid);

    const updateData = {};
    if (!isPasswordValid) {
      console.log(`Updating password for ${email} to "${rawPassword}"...`);
      updateData.password = await bcrypt.hash(rawPassword, 10);
    }
    if (user.role !== "SUPER_ADMIN") {
      console.log(`Updating role for ${email} to SUPER_ADMIN...`);
      updateData.role = "SUPER_ADMIN";
    }
    if (user.isActive !== true) {
      console.log(`Activating user account for ${email}...`);
      updateData.isActive = true;
    }

    if (Object.keys(updateData).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
      console.log(`✅ Updated Super Admin user: ID=${user.id}, Role=${user.role}, Password reset to "${rawPassword}".`);
    } else {
      console.log(`✅ Super Admin credentials for ${email} are active and valid!`);
    }
  }

  // Double check login verification
  const checkPass = await bcrypt.compare(rawPassword, user.password);
  console.log(`Final Verification: Email=${user.email}, Role=${user.role}, Password Match=${checkPass}`);
}

main()
  .catch((e) => {
    console.error("Error checking SuperAdmin credentials:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
