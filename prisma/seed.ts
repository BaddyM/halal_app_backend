// prisma/seed.ts
import { PrismaClient, ProductCategory, UserRole } from '@prisma/client';
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

type PortalProduct = {
    id: string;
    title: string;
    classLevel: string;
    type: 'Workbook' | 'Exam' | 'Holiday Package';
    subject: string;
    price: number;
    description: string;
    featured: boolean;
};

const TYPE_TO_CATEGORY: Record<PortalProduct['type'], ProductCategory> = {
    Workbook: ProductCategory.workbooks,
    Exam: ProductCategory.exams,
    'Holiday Package': ProductCategory.holiday_packages,
};

const TYPE_TO_IMAGE: Record<PortalProduct['type'], string> = {
    Workbook: '/uploads/website/seed-workbook.jpg',
    Exam: '/uploads/website/seed-exam.jpg',
    'Holiday Package': '/uploads/website/seed-holiday.jpg',
};

const portalProducts: PortalProduct[] = [
    { id: 'bc-abc', title: 'ABC Picture Workbook', classLevel: 'Baby Class', type: 'Workbook', subject: 'Literacy', price: 12000, description: 'Bright illustrated alphabet workbook to build early letter recognition.', featured: true },
    { id: 'bc-numbers', title: 'Counting 1-20 Workbook', classLevel: 'Baby Class', type: 'Workbook', subject: 'Numeracy', price: 12000, description: 'Hands-on counting practice with colorful objects.', featured: false },
    { id: 'mc-shapes', title: 'Shapes & Colours Activity Book', classLevel: 'Middle Class', type: 'Workbook', subject: 'Activities', price: 13000, description: 'Fun activities exploring shapes, colours and patterns.', featured: false },
    { id: 'tc-reading', title: 'Top Class Reading Reader', classLevel: 'Top Class', type: 'Workbook', subject: 'Literacy', price: 14000, description: 'Sight words and short sentences for emerging readers.', featured: true },
    { id: 'tc-holiday', title: 'Top Class Holiday Fun Pack', classLevel: 'Top Class', type: 'Holiday Package', subject: 'All-round', price: 25000, description: 'Six weeks of guided holiday activities, stickers and rewards.', featured: false },
    { id: 'p1-eng', title: 'P1 English Workbook', classLevel: 'P1', type: 'Workbook', subject: 'English', price: 18000, description: 'Aligned to the Ugandan thematic curriculum for P1 learners.', featured: false },
    { id: 'p1-math', title: 'P1 MTC Workbook', classLevel: 'P1', type: 'Workbook', subject: 'Mathematics', price: 18000, description: 'Number work, addition and basic problem solving.', featured: false },
    { id: 'p2-exam', title: 'P2 End of Term Exams Set', classLevel: 'P2', type: 'Exam', subject: 'All Subjects', price: 15000, description: 'Termly exams with marking guides, ready to print.', featured: false },
    { id: 'p3-sst', title: 'P3 Social Studies Workbook', classLevel: 'P3', type: 'Workbook', subject: 'SST', price: 19000, description: 'Map work, communities and our environment.', featured: false },
    { id: 'p3-holiday', title: 'P3 Holiday Package', classLevel: 'P3', type: 'Holiday Package', subject: 'All Subjects', price: 22000, description: 'Daily activities across English, MTC, SST and Science.', featured: true },
    { id: 'p4-sci', title: 'P4 Science Workbook', classLevel: 'P4', type: 'Workbook', subject: 'Science', price: 22000, description: 'Topical exercises with diagrams and revision questions.', featured: false },
    { id: 'p4-exam', title: 'P4 Beginning of Term Exams', classLevel: 'P4', type: 'Exam', subject: 'All Subjects', price: 18000, description: 'BOT exam papers with answer keys.', featured: false },
    { id: 'p5-math', title: 'P5 MTC Workbook', classLevel: 'P5', type: 'Workbook', subject: 'Mathematics', price: 24000, description: 'Fractions, decimals, geometry and word problems.', featured: false },
    { id: 'p5-eng', title: 'P5 English Workbook', classLevel: 'P5', type: 'Workbook', subject: 'English', price: 24000, description: 'Comprehension, composition and grammar drills.', featured: true },
    { id: 'p5-holiday', title: 'P5 Holiday Mega Pack', classLevel: 'P5', type: 'Holiday Package', subject: 'All Subjects', price: 30000, description: 'Comprehensive 4-subject holiday revision pack.', featured: false },
    { id: 'p6-sci', title: 'P6 Science Workbook', classLevel: 'P6', type: 'Workbook', subject: 'Science', price: 26000, description: 'Full coverage of the P6 syllabus with experiments.', featured: false },
    { id: 'p6-sst', title: 'P6 SST Workbook', classLevel: 'P6', type: 'Workbook', subject: 'SST', price: 26000, description: 'Maps, history, government and economics simplified.', featured: false },
    { id: 'p6-exam', title: 'P6 End of Term Exams', classLevel: 'P6', type: 'Exam', subject: 'All Subjects', price: 20000, description: 'Standard EOT exams with comprehensive marking guides.', featured: false },
    { id: 'p7-math', title: 'P7 MTC PLE Revision', classLevel: 'P7', type: 'Workbook', subject: 'Mathematics', price: 30000, description: 'PLE-focused revision questions and past paper drills.', featured: true },
    { id: 'p7-eng', title: 'P7 English PLE Revision', classLevel: 'P7', type: 'Workbook', subject: 'English', price: 30000, description: 'Comprehension and composition mastery for PLE.', featured: false },
    { id: 'p7-sci', title: 'P7 Science PLE Revision', classLevel: 'P7', type: 'Workbook', subject: 'Science', price: 30000, description: 'Topical and mixed PLE-style questions.', featured: false },
    { id: 'p7-sst', title: 'P7 SST PLE Revision', classLevel: 'P7', type: 'Workbook', subject: 'SST', price: 30000, description: 'Targeted SST revision for PLE candidates.', featured: false },
    { id: 'p7-mock', title: 'P7 Mock Exams Bundle', classLevel: 'P7', type: 'Exam', subject: 'All Subjects', price: 35000, description: 'Four mock exam sets simulating real PLE conditions.', featured: true },
    { id: 'p7-holiday', title: 'P7 Holiday Intensive Package', classLevel: 'P7', type: 'Holiday Package', subject: 'All Subjects', price: 45000, description: 'Daily timetable, exercises and parent guide for PLE prep.', featured: true },
];

async function seedAdmin() {
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'arnoldhenry958@gmail.com';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || '@Bekhan12!';
    const hashed = await bcrypt.hash(adminPassword, 10);

    const branch = await prisma.branch.upsert({
        where: { name: 'Main' },
        update: {},
        create: {
            name: 'Intersoft Main Branch',
            contact: '0200909858',
            address: 'Nasser Road, Opposite Roko - Entebbe Road, Kampala',
            isMainBranch: true,
        },
    });
    console.log('Ensured main branch exists:', branch.name);

    const user = await prisma.user.upsert({
        where: { email: adminEmail },
        update: { name: 'Admin', password: hashed, role: UserRole.admin, isActive: true },
        create: {
            name: 'Admin',
            email: adminEmail,
            password: hashed,
            role: UserRole.admin,
            branchId: branch.id,
            isActive: true,
        },
    });
    console.log('Seed admin user:', user.email);
}

async function seedProducts() {
    for (const p of portalProducts) {
        await prisma.product.upsert({
            where: { slug: p.id },
            update: {
                name: p.title,
                description: p.description,
                image: TYPE_TO_IMAGE[p.type],
                featured: p.featured,
                isPublished: true,
                category: TYPE_TO_CATEGORY[p.type],
                price: p.price,
                classLevel: p.classLevel,
                subject: p.subject,
            },
            create: {
                slug: p.id,
                name: p.title,
                description: p.description,
                image: TYPE_TO_IMAGE[p.type],
                featured: p.featured,
                isPublished: true,
                category: TYPE_TO_CATEGORY[p.type],
                price: p.price,
                costPrice: 0,
                totalStock: 0,
                classLevel: p.classLevel,
                subject: p.subject,
            },
        });
    }
    console.log(`Seeded ${portalProducts.length} products.`);
}

async function seedBlog() {
    const posts = [
        {
            slug: 'early-literacy-baby-class',
            title: 'Early Literacy: Setting Up Baby Class Learners for Success',
            excerpt: "Practical, screen-free activities parents can use at home to build letter recognition and a love for reading.",
            cover: '/uploads/website/seed-blog-1.jpg',
            date: new Date('2025-04-12'),
            readMinutes: 5,
            body: [
                "The first three years of school shape a child's relationship with learning. At Baby Class level, the goal is not to push children to read fluently but to help them recognise that letters carry meaning.",
                "Start with the child's name. Children are intrinsically motivated to identify the letters that make up their own name. Practise tracing it, spotting it on packaging, and singing it.",
                "Read together every single day. Even ten minutes of shared reading builds vocabulary faster than any worksheet. Choose stories with rich pictures and ask your child to predict what happens next.",
                "Use our ABC Picture Workbook alongside everyday play. Worksheets are most powerful when they reinforce something the child has already encountered in real life.",
            ].join('\n\n'),
        },
        {
            slug: 'primary-math-confidence',
            title: 'Building Math Confidence from P1 to P5',
            excerpt: 'Why daily short practice beats weekend marathons, and how to use workbooks without burning your child out.',
            cover: '/uploads/website/seed-blog-2.jpg',
            date: new Date('2025-03-28'),
            readMinutes: 6,
            body: [
                'Maths anxiety usually starts around P3 when concepts become more abstract. The fix is consistency, not intensity.',
                'Aim for 15-20 focused minutes a day rather than long weekend sessions. Short, regular practice helps the brain consolidate skills.',
                'Always start with a problem your child can solve. Confidence first, challenge second. Our P1-P5 workbooks are deliberately structured this way.',
                'Celebrate effort over speed. A child who stays with a hard problem for ten minutes is learning more than one who answers ten easy questions in two minutes.',
            ].join('\n\n'),
        },
        {
            slug: 'holiday-without-regression',
            title: 'How to Use the Holidays Without Academic Regression',
            excerpt: 'A simple weekly rhythm that keeps your child sharp without turning the holidays into another term.',
            cover: '/uploads/website/seed-blog-3.jpg',
            date: new Date('2025-03-10'),
            readMinutes: 4,
            body: [
                "Children should rest during the holidays. They should also keep their brains lightly engaged so they don't lose two weeks of progress when school resumes.",
                'We recommend a 3-2-2 rhythm: 3 days of light academic work, 2 days of practical learning (cooking, building, gardening), and 2 days of pure play.',
                "Our Holiday Packages are designed for this rhythm. Each day's task takes 30-45 minutes and ends with a small reward sticker.",
                'Most importantly, talk to your child about what they did each day. Reflection turns activity into actual learning.',
            ].join('\n\n'),
        },
        {
            slug: 'ple-prep-for-parents',
            title: "PLE Preparation: A Parent's Calm Guide",
            excerpt: 'How to support your P7 candidate without adding pressure that hurts performance.',
            cover: '/uploads/website/seed-blog-2.jpg',
            date: new Date('2025-02-22'),
            readMinutes: 7,
            body: [
                'P7 is intense, but the children who perform best are usually the ones whose parents stayed calm.',
                'Set up a predictable revision routine. Same time, same place, same length. Predictability conserves the mental energy needed for actual studying.',
                'Use mock exams strategically. Three full mocks under timed conditions teach more than ten untimed practice sets.',
                'Sleep is non-negotiable. A well-rested brain recalls 30-40% more on exam day than a tired one.',
            ].join('\n\n'),
        },
    ];

    for (const p of posts) {
        await prisma.blogPost.upsert({
            where: { slug: p.slug },
            update: { title: p.title, excerpt: p.excerpt, body: p.body, cover: p.cover, date: p.date, readMinutes: p.readMinutes, isPublished: true, author: 'Jubra Editorial' },
            create: { ...p, author: 'Jubra Editorial', isPublished: true },
        });
    }
    console.log(`Seeded ${posts.length} blog posts.`);
}

async function seedTestimonials() {
    const items = [
        { name: 'Sarah N.', role: 'Parent, P5 & P3', quote: 'The workbooks are so well organised. My children actually look forward to homework now.', sortOrder: 1 },
        { name: 'James O.', role: 'Parent, P7 candidate', quote: 'The PLE revision pack made a real difference. The mock exams were spot on.', sortOrder: 2 },
        { name: 'Aisha K.', role: 'Parent, Top Class', quote: 'Beautiful, age-appropriate materials. Delivery was fast and the quality is excellent.', sortOrder: 3 },
    ];
    const existing = await prisma.testimonial.count();
    if (existing === 0) {
        await prisma.testimonial.createMany({ data: items.map((i) => ({ ...i, isPublished: true })) });
        console.log(`Seeded ${items.length} testimonials.`);
    } else {
        console.log(`Testimonials already exist (${existing}), skipping seed.`);
    }
}

async function seedFaqs() {
    const items = [
        { question: 'Which classes do you cover?', answer: 'We publish materials for Baby Class, Middle Class, Top Class, and Primary One through Primary Seven.', sortOrder: 1 },
        { question: 'How do I place an order?', answer: "Add items to your cart and tap 'Checkout on WhatsApp'. We'll confirm your order, delivery address, and payment options on WhatsApp.", sortOrder: 2 },
        { question: 'What payment methods do you accept?', answer: 'Mobile Money (MTN & Airtel), bank transfer, and cash on delivery within Kampala. We share details when we confirm your order.', sortOrder: 3 },
        { question: 'Do you deliver outside Kampala?', answer: 'Yes — we deliver country-wide via partner couriers. Delivery fees depend on location and are confirmed on WhatsApp.', sortOrder: 4 },
        { question: 'How long does delivery take?', answer: 'Within Kampala: 1-2 working days. Up-country: 2-5 working days.', sortOrder: 5 },
        { question: 'Are your materials curriculum aligned?', answer: 'Yes. Every workbook and exam follows the Ugandan thematic curriculum (pre-primary) or the primary syllabus, and is reviewed by practising teachers.', sortOrder: 6 },
        { question: 'Do you offer school bulk orders?', answer: 'Absolutely. Contact us for bulk pricing and custom branding options for your school.', sortOrder: 7 },
        { question: 'Can I return or exchange a product?', answer: "If a product arrives damaged or doesn't match what you ordered, contact us within 7 days and we'll arrange a replacement.", sortOrder: 8 },
    ];
    const existing = await prisma.faq.count();
    if (existing === 0) {
        await prisma.faq.createMany({ data: items.map((i) => ({ ...i, isPublished: true })) });
        console.log(`Seeded ${items.length} FAQs.`);
    } else {
        console.log(`FAQs already exist (${existing}), skipping seed.`);
    }
}

async function seedOtherServices() {
    const existing = await prisma.otherService.count();
    if (existing > 0) {
        console.log(`Other services already exist (${existing}), skipping.`);
        return;
    }
    await prisma.otherService.createMany({
        data: [
            { icon: 'Printer', title: 'Printing', description: 'Quality printing for school materials, custom workbooks and bulk orders.', sortOrder: 1, isPublished: true },
            { icon: 'PencilLine', title: 'General Stationery', description: 'Notebooks, pens, files and everything else your classroom needs.', sortOrder: 2, isPublished: true },
            { icon: 'Truck', title: 'Deliveries', description: 'Country-wide delivery via partner couriers; same-day within Kampala.', sortOrder: 3, isPublished: true },
        ],
    });
    console.log('Seeded 3 other services.');
}

async function seedCompany() {
    const valuesExist = await prisma.companyValue.count();
    if (valuesExist === 0) {
        await prisma.companyValue.createMany({
            data: [
                { icon: 'Target', title: 'Curriculum-first', description: 'Every resource maps directly to the Ugandan thematic & primary curriculum.', sortOrder: 1, isPublished: true },
                { icon: 'Heart', title: 'Child-centred', description: 'We design for joy, confidence and gradual mastery — not rote.', sortOrder: 2, isPublished: true },
                { icon: 'Users', title: 'Teacher-built', description: 'Created and reviewed by classroom teachers with years of experience.', sortOrder: 3, isPublished: true },
                { icon: 'Award', title: 'Quality first', description: "Premium printing, durable bindings, and content we'd give our own kids.", sortOrder: 4, isPublished: true },
            ],
        });
        console.log('Seeded 4 company values.');
    } else {
        console.log(`Company values already exist (${valuesExist}), skipping.`);
    }

    const statsExist = await prisma.companyStat.count();
    if (statsExist === 0) {
        await prisma.companyStat.createMany({
            data: [
                { value: '10+', label: 'Class levels covered', sortOrder: 1, isPublished: true },
                { value: '500+', label: 'Orders delivered', sortOrder: 2, isPublished: true },
                { value: '20+', label: 'Subjects & topics', sortOrder: 3, isPublished: true },
            ],
        });
        console.log('Seeded 3 company stats.');
    } else {
        console.log(`Company stats already exist (${statsExist}), skipping.`);
    }
}

async function seedSiteSettings() {
    const defaults: Record<string, string> = {
        siteName: 'Jubra Educational Consults',
        shortName: 'Jubra',
        tagline: 'Quality learning materials from Baby Class to Primary Seven',
        description: 'Jubra Educational Consults supplies workbooks, exams and holiday packages for learners from Baby Class to Primary Seven across Uganda.',
        whatsappNumber: '256700000000',
        phoneDisplay: '+256 700 000 000',
        email: 'info@jubraeducation.com',
        address: 'Plot 12, Education Avenue, Kampala, Uganda',
        facebook: 'https://facebook.com',
        twitter: 'https://twitter.com',
        instagram: 'https://instagram.com',
        currency: 'UGX',
        heroHeadline: 'Helping every Ugandan child love learning',
        heroSubheadline: 'Curriculum-aligned workbooks, exams and holiday packages from Baby Class to Primary Seven.',
    };
    for (const [key, value] of Object.entries(defaults)) {
        await prisma.siteSetting.upsert({
            where: { key },
            update: {},
            create: { key, value },
        });
    }
    console.log(`Seeded ${Object.keys(defaults).length} site settings.`);
}

async function main() {
    await seedAdmin();
    await seedProducts();
    await seedBlog();
    await seedTestimonials();
    await seedFaqs();
    await seedCompany();
    await seedOtherServices();
    await seedSiteSettings();
    console.log('All seeds completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
