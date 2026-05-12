// prisma/seed.ts
import { PrismaClient, UserRole } from '@prisma/client';
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'arnoldhenry958@gmail.com';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || '@Bekhan12!';

    const hashed = await bcrypt.hash(adminPassword, 10);

    const branch = await prisma.branch.upsert({
        where: { name: 'Main' },
        update: {},
        create: {
            name: 'Intersoft Main Branch',
            contact: "0200909858",
            address: "Nasser Road, Opposite Roko - Entebbe Road, Kampala",
            isMainBranch: true,
        },
    });

    console.log('Ensured main branch exists:', branch.name);

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
            branchId: branch.id,
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
