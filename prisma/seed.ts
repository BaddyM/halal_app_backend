// prisma/seed.ts
import { OrderType, PrismaClient, Role, StockCategory } from '@prisma/client';
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

interface Order {
    customer: string,
    table: string,
    itemId: string,
    orderType: OrderType,
    userId: string,
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
            name: "Arnold Henry",
            email: "arnoldhenry958@gmail.com",
            password: "baddy",
            role: "ADMIN"
        },
        {
            name: "Thecla",
            email: "thecla@gmail.com",
            password: "123",
            role: "ADMIN"
        },
        // {
        //     name: "Joseph",
        //     email: "joseph@gmail.com",
        //     password: "123",
        //     role: "PARKING"
        // },
        // {
        //     name: "Macqline",
        //     email: "mackline@gmail.com",
        //     password: "123",
        //     role: "KITCHEN"
        // }
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

    //Orders
    // const orders: Order[] = [
    //     {
    //         customer: "Mark",
    //         table: "1",
    //         itemId: "f4fdf681-3c6d-436e-931e-7f30cce50bdb",
    //         orderType: "KITCHEN",
    //         userId: "e705ed16-3d75-40ca-9bcb-47bb1196e12f",
    //     },
    //     {
    //         customer: "George",
    //         table: "5",
    //         itemId: "Soda",
    //         orderType: "BAR",
    //         userId: "e705ed16-3d75-40ca-9bcb-47bb1196e12f",
    //     },
    //     {
    //         customer: "Ruth",
    //         table: "2",
    //         itemId: "Matooke and Beans",
    //         orderType: "KITCHEN",
    //         userId: "e705ed16-3d75-40ca-9bcb-47bb1196e12f",
    //     },
    // ];

    // for (let i = 0; i < orders.length; i++) {
    //     await prisma.order.create({
    //         data: {
    //             customer: orders[i].customer,
    //             table: orders[i].table,
    //             itemId: orders[i].itemId,
    //             orderType: orders[i].orderType,
    //             userId: orders[i].userId,
    //         }
    //     });
    // }

    console.log('Seed completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
