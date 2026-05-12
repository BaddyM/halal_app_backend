// prisma/seed.ts
import { PrismaClient, UserRole } from '@prisma/client';
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'arnoldhenry958@gmail.com';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || '@Bekhan12!';

    const hashed = await bcrypt.hash(adminPassword, 10);

    const user = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            name: 'Admin',
            password: hashed,
            role: UserRole.admin,
            isActive: true,
        },
        create: {
            name: 'Admin',
            email: adminEmail,
            password: hashed,
            role: UserRole.admin,
            isActive: true,
        },
    });

    console.log('Seed completed. User:', user.email);
    console.log('Password used:', process.env.SEED_ADMIN_PASSWORD ? '(from SEED_ADMIN_PASSWORD)' : adminPassword);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
