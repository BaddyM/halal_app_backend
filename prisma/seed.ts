// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const bcrypt = require("bcryptjs")
const prisma = new PrismaClient();

async function main() {
    console.log('Seed completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
