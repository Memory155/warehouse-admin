import { PrismaClient, Role, UserStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  const adminUsername = "admin";
  const adminPlainPassword = "Admin@123456";
  const passwordHash = await bcrypt.hash(adminPlainPassword, 10);

  await prisma.user.upsert({
    where: { username: adminUsername },
    update: {
      passwordHash,
      role: Role.SUPER_ADMIN,
      canManageUsers: true,
      status: UserStatus.ACTIVE,
    },
    create: {
      username: adminUsername,
      passwordHash,
      role: Role.SUPER_ADMIN,
      canManageUsers: true,
      status: UserStatus.ACTIVE,
    },
  });

  const categories = [
    { name: "客房用品", sort: 10 },
    { name: "清洁用品", sort: 20 },
    { name: "餐饮物料", sort: 30 },
    { name: "布草用品", sort: 40 },
    { name: "一次性用品", sort: 50 },
    { name: "维修耗材", sort: 60 },
    { name: "办公用品", sort: 70 },
    { name: "其他", sort: 80 },
  ];

  for (const item of categories) {
    await prisma.category.upsert({
      where: { name: item.name },
      update: {
        sort: item.sort,
        isActive: true,
      },
      create: {
        name: item.name,
        sort: item.sort,
        isActive: true,
      },
    });
  }

  console.log("Seed completed.");
  console.log(`Admin username: ${adminUsername}`);
  console.log(`Admin password: ${adminPlainPassword}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
