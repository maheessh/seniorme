import { hash } from "bcryptjs";
import { prisma } from "../src/index";

async function main() {
  const email = process.env.APP_USER_EMAIL;
  const password = process.env.APP_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "APP_USER_EMAIL and APP_USER_PASSWORD must be set in .env before seeding the single app user.",
    );
  }

  const passwordHash = await hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  console.log(`Seeded user: ${user.email}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
