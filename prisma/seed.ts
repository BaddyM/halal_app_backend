// prisma/seed.ts
import { PrismaClient, Role, StockCategory } from '@prisma/client';
const bcrypt = require("bcryptjs")
const prisma = new PrismaClient();

interface Stock {
    item: string,
    category: StockCategory,
    qty: number,
    unit_price: number,
}

interface User {
    name: string,
    email: string,
    password: string,
    role: Role,
}

async function main() {
    //Stock
    const stock: Stock[] = [
        {
            item: "Onions",
            category: "PRODUCE",
            qty: 3,
            unit_price: 5000
        },
        {
            item: "Beer",
            category: "DRINKS",
            qty: 30,
            unit_price: 10000
        },
        {
            item: "Carrots",
            category: "PRODUCE",
            qty: 12,
            unit_price: 3500
        },
    ]

    // for (let i = 0; i < stock.length; i++) {
    //     await prisma.stock.create({
    //         data: {
    //             userId: "e705ed16-3d75-40ca-9bcb-47bb1196e12f",
    //             item: stock[i].item,
    //             category: stock[i].category,
    //             qty: stock[i].qty,
    //             UnitPrice: stock[i].unit_price,
    //         }
    //     });
    // }

    //Users
    const users: User[] = [
        {
            name: "George",
            email: "george@gmail.com",
            password: "123",
            role: "BAR"
        },
        {
            name: "Clair",
            email: "clair@gmail.com",
            password: "123",
            role: "SAUNA"
        },
        {
            name: "Joseph",
            email: "joseph@gmail.com",
            password: "123",
            role: "PARKING"
        },
        {
            name: "Macqline",
            email: "mackline@gmail.com",
            password: "123",
            role: "KITCHEN"
        }
    ];

    for (let i = 0; i < users.length; i++) {
        let password = await bcrypt.hash(users[i].password, 10);
        await prisma.user.create({
            data: {
                name: users[i].name,
                email: users[i].email,
                password: password,
                role: users[i].role,
            }
        });
    }

    console.log('Seed completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
