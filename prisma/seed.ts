// prisma/seed.ts
import {
  PrismaClient,
  Gender,
  PrayerFrequency,
  IslamicSect,
  HijabPreference,
  MarriageTimeline,
  ChildrenPreference,
  LocationPreference,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type Seed = {
  email: string;
  name: string;
  profession: string;
  city: string;
  country: string;
  age: number;
  bio: string;
  imageUrl: string;
  gender: Gender;
  prayer: PrayerFrequency;
  sect: IslamicSect;
  hijab: HijabPreference;
  ethnicity: string;
  timeline: MarriageTimeline;
  childrenPref: ChildrenPreference;
  locationPref: LocationPreference;
  values: string[];
  interests: string[];
  verified: boolean;
};

const seeds: Seed[] = [
  {
    email: 'nour@example.com',
    name: 'Nour Al-Rashid',
    profession: 'Software Engineer',
    city: 'Kampala',
    country: 'Uganda',
    age: 26,
    bio: 'Seeking a righteous partner who values deen, family, and lifelong growth together.',
    imageUrl:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&h=1200&fit=crop',
    gender: 'female',
    prayer: 'fiveTimes',
    sect: 'sunni',
    hijab: 'hijab',
    ethnicity: 'Arab',
    timeline: 'withinYear',
    childrenPref: 'noWantThem',
    locationPref: 'sameCountry',
    values: ['Strong deen', 'Family first', 'Community service'],
    interests: ['Practising', 'Hijabi', 'Quran Teacher'],
    verified: true,
  },
  {
    email: 'aisha@example.com',
    name: 'Aisha Karimi',
    profession: 'Doctor',
    city: 'Nairobi',
    country: 'Kenya',
    age: 24,
    bio: 'Balancing medical service with spiritual growth. Looking for someone who understands both.',
    imageUrl:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&h=1200&fit=crop',
    gender: 'female',
    prayer: 'fiveTimes',
    sect: 'sunni',
    hijab: 'hijab',
    ethnicity: 'African',
    timeline: 'oneToTwoYears',
    childrenPref: 'noOpenToIt',
    locationPref: 'countryOrAbroad',
    values: ['Strong deen', 'Career ambition', 'Travel & adventure'],
    interests: ['Hafiza', 'Family-oriented', 'Traveller'],
    verified: true,
  },
  {
    email: 'fatima@example.com',
    name: 'Fatima Hassan',
    profession: 'Architect',
    city: 'Dar es Salaam',
    country: 'Tanzania',
    age: 28,
    bio: 'Designing spaces that inspire. Seeking a partner who values creativity and taqwa.',
    imageUrl:
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&h=1200&fit=crop',
    gender: 'female',
    prayer: 'mostPrayers',
    sect: 'sunni',
    hijab: 'niqab',
    ethnicity: 'African',
    timeline: 'openTimeline',
    childrenPref: 'noOpenToIt',
    locationPref: 'anywhere',
    values: ['Community service', 'Education', 'Strong deen'],
    interests: ['Niqabi', 'Creative', 'Multilingual'],
    verified: false,
  },
  {
    email: 'zara@example.com',
    name: 'Zara Malik',
    profession: 'Journalist',
    city: 'Kigali',
    country: 'Rwanda',
    age: 25,
    bio: 'Telling stories that matter. Hoping to find someone who shares my passion for truth and faith.',
    imageUrl:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800&h=1200&fit=crop',
    gender: 'female',
    prayer: 'fiveTimes',
    sect: 'sunni',
    hijab: 'hijab',
    ethnicity: 'African',
    timeline: 'withinYear',
    childrenPref: 'noWantThem',
    locationPref: 'sameCountry',
    values: ['Strong deen', 'Family first', 'Career ambition'],
    interests: ['Practising', 'Sports', 'Foodie'],
    verified: true,
  },
  {
    email: 'maryam@example.com',
    name: 'Maryam Ahmed',
    profession: 'Teacher',
    city: 'Mombasa',
    country: 'Kenya',
    age: 27,
    bio: 'Educating the next generation with love and deen.',
    imageUrl:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&h=1200&fit=crop',
    gender: 'female',
    prayer: 'fiveTimes',
    sect: 'sunni',
    hijab: 'hijab',
    ethnicity: 'African',
    timeline: 'asap',
    childrenPref: 'noWantThem',
    locationPref: 'sameCountry',
    values: ['Education', 'Family first', 'Strong deen'],
    interests: ['Education', 'Quran', 'Family'],
    verified: true,
  },
  {
    email: 'khadija@example.com',
    name: 'Khadija Omar',
    profession: 'Nurse',
    city: 'Addis Ababa',
    country: 'Ethiopia',
    age: 23,
    bio: 'Caring for others is my passion, guided by faith.',
    imageUrl:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&h=1200&fit=crop',
    gender: 'female',
    prayer: 'mostPrayers',
    sect: 'sunni',
    hijab: 'hijab',
    ethnicity: 'African',
    timeline: 'oneToTwoYears',
    childrenPref: 'noOpenToIt',
    locationPref: 'sameCountry',
    values: ['Community service', 'Family first', 'Simple, quiet life'],
    interests: ['Healthcare', 'Helping others', 'Reading'],
    verified: false,
  },
  {
    email: 'yusuf@example.com',
    name: 'Yusuf Ibrahim',
    profession: 'Civil Engineer',
    city: 'Kampala',
    country: 'Uganda',
    age: 29,
    bio: 'Builder by trade, seeker of barakah in everything I do.',
    imageUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=1200&fit=crop',
    gender: 'male',
    prayer: 'fiveTimes',
    sect: 'sunni',
    hijab: 'notApplicable',
    ethnicity: 'African',
    timeline: 'withinYear',
    childrenPref: 'noWantThem',
    locationPref: 'sameCountry',
    values: ['Strong deen', 'Family first', 'Career ambition'],
    interests: ['Practising', 'Sports', 'Engineering'],
    verified: true,
  },
  {
    email: 'ahmed@example.com',
    name: 'Ahmed Faruq',
    profession: 'Entrepreneur',
    city: 'Nairobi',
    country: 'Kenya',
    age: 32,
    bio: 'Building businesses with halal principles. Looking for a partner in deen and dunya.',
    imageUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&h=1200&fit=crop',
    gender: 'male',
    prayer: 'fiveTimes',
    sect: 'sunni',
    hijab: 'notApplicable',
    ethnicity: 'Arab',
    timeline: 'asap',
    childrenPref: 'noWantThem',
    locationPref: 'countryOrAbroad',
    values: ['Strong deen', 'Career ambition', 'Family first'],
    interests: ['Practising', 'Business', 'Travel'],
    verified: true,
  },
];

const ONBOARDING_TEMPLATE: Array<{
  questionId: string;
  answer: string | string[];
}> = [
  { questionId: 'gender', answer: 'Sister (Female)' },
  { questionId: 'age_range', answer: '25–29' },
  { questionId: 'prayer', answer: '5 times daily (Alhamdulillah)' },
  { questionId: 'sect', answer: 'Sunni' },
  { questionId: 'hijab', answer: 'I wear hijab (Sister)' },
  { questionId: 'marriage_timeline', answer: 'Within 1 year' },
  { questionId: 'ethnicity', answer: 'African' },
  { questionId: 'children', answer: 'No children, want them' },
  {
    questionId: 'values',
    answer: ['Strong deen', 'Family first', 'Education'],
  },
  { questionId: 'location_pref', answer: 'Same country' },
];

async function seedDemoUser() {
  const email = 'arnoldhenry958@gmail.com';
  const password = '@Bekhan12';
  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { isEmailVerified: true, name: 'Demo User' },
    create: {
      email,
      password: hashed,
      role: 'admin',
      name: 'Arnold Henry',
      isEmailVerified: true,
      profile: {
        create: {
          gender: 'male',
          dateOfBirth: new Date(1998, 7, 24),
          city: 'Kampala',
          country: 'Uganda',
          profession: 'Product Manager',
          bio: 'Looking for a righteous companion to share life with.',
          prayerFrequency: 'fiveTimes',
          sect: 'sunni',
          hijabPreference: 'notApplicable',
          ethnicity: 'African',
          maritalTimeline: 'withinYear',
          childrenPref: 'noWantThem',
          locationPref: 'sameCountry',
          values: ['Strong deen', 'Family first', 'Education'] as any,
          interests: ['Practising', 'Family-oriented'] as any,
          isVerified: true,
          isComplete: true,
        },
      },
    },
  });

  console.log(`Seeded demo user: ${email} / ${password}`);
  return user;
}

async function seedProfile(seed: Seed) {
  const hashed = await bcrypt.hash('halal1234', 10);
  const dob = new Date(new Date().getFullYear() - seed.age, 0, 1);

  const user = await prisma.user.upsert({
    where: { email: seed.email },
    update: {
      name: seed.name,
      isEmailVerified: true,
      lastSeenAt: new Date(),
    },
    create: {
      email: seed.email,
      password: hashed,
      name: seed.name,
      isEmailVerified: true,
      lastSeenAt: new Date(),
    },
  });

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {
      gender: seed.gender,
      dateOfBirth: dob,
      city: seed.city,
      country: seed.country,
      profession: seed.profession,
      bio: seed.bio,
      primaryImageUrl: seed.imageUrl,
      prayerFrequency: seed.prayer,
      sect: seed.sect,
      hijabPreference: seed.hijab,
      ethnicity: seed.ethnicity,
      maritalTimeline: seed.timeline,
      childrenPref: seed.childrenPref,
      locationPref: seed.locationPref,
      values: seed.values as any,
      interests: seed.interests as any,
      isVerified: seed.verified,
      isComplete: true,
    },
    create: {
      userId: user.id,
      gender: seed.gender,
      dateOfBirth: dob,
      city: seed.city,
      country: seed.country,
      profession: seed.profession,
      bio: seed.bio,
      primaryImageUrl: seed.imageUrl,
      prayerFrequency: seed.prayer,
      sect: seed.sect,
      hijabPreference: seed.hijab,
      ethnicity: seed.ethnicity,
      maritalTimeline: seed.timeline,
      childrenPref: seed.childrenPref,
      locationPref: seed.locationPref,
      values: seed.values as any,
      interests: seed.interests as any,
      isVerified: seed.verified,
      isComplete: true,
    },
  });

  // Seed onboarding answers for realism
  for (const ans of ONBOARDING_TEMPLATE) {
    await prisma.onboardingAnswer.upsert({
      where: {
        userId_questionId: { userId: user.id, questionId: ans.questionId },
      },
      update: { answer: ans.answer as any },
      create: {
        userId: user.id,
        questionId: ans.questionId,
        answer: ans.answer as any,
      },
    });
  }

  console.log(`Seeded ${seed.name}`);
}

async function seedConversations() {
  const demo = await prisma.user.findUnique({
    where: { email: 'arnoldhenry958@gmail.com' },
  });
  if (!demo) return;

  const partnerEmails = [
    'nour@example.com',
    'aisha@example.com',
    'fatima@example.com',
  ];
  const partners = await prisma.user.findMany({
    where: { email: { in: partnerEmails } },
  });

  const sampleThreads: Record<
    string,
    Array<{ from: 'me' | 'them'; text: string }>
  > = {
    'nour@example.com': [
      { from: 'them', text: 'Assalamu alaikum! How are you?' },
      {
        from: 'me',
        text: "Wa alaikum assalam! Alhamdulillah, I'm well. Thank you for asking 🌙",
      },
      {
        from: 'them',
        text: 'I wanted to ask about your experience with volunteering at the masjid.',
      },
      {
        from: 'me',
        text: "It's been such a blessing! I've learned so much and met amazing people.",
      },
      { from: 'them', text: 'JazakAllah khair for the advice! 🌙' },
    ],
    'aisha@example.com': [
      {
        from: 'them',
        text: 'Salam! Loved your profile, especially the volunteering bit.',
      },
      {
        from: 'me',
        text: 'JazakAllah khair! How is medical school treating you?',
      },
      {
        from: 'them',
        text: 'Would you like to continue this conversation over video?',
      },
    ],
    'fatima@example.com': [
      {
        from: 'me',
        text: 'Hi Fatima, your architecture work looks beautiful, mashallah.',
      },
      { from: 'them', text: 'InshaAllah, let me check my schedule.' },
    ],
  };

  for (const partner of partners) {
    const [a, b] =
      demo.id < partner.id ? [demo.id, partner.id] : [partner.id, demo.id];

    // Schema invariant: a conversation can only exist between two users who
    // have matched, and a match requires a mutual (both-direction) like.
    // Seed both likes + the match so chat.service's match-gate is satisfied.
    for (const [from, to] of [
      [demo.id, partner.id],
      [partner.id, demo.id],
    ]) {
      await prisma.like.upsert({
        where: { fromUserId_toUserId: { fromUserId: from, toUserId: to } },
        update: { type: 'like' },
        create: { fromUserId: from, toUserId: to, type: 'like' },
      });
    }
    await prisma.match.upsert({
      where: { userAId_userBId: { userAId: a, userBId: b } },
      update: {},
      create: { userAId: a, userBId: b },
    });

    const conv = await prisma.conversation.upsert({
      where: { userAId_userBId: { userAId: a, userBId: b } },
      update: {},
      create: { userAId: a, userBId: b },
    });

    const existing = await prisma.message.count({
      where: { conversationId: conv.id },
    });
    if (existing > 0) continue;

    const thread = sampleThreads[partner.email] ?? [];
    const baseTime = Date.now() - thread.length * 4 * 60 * 1000;
    for (let i = 0; i < thread.length; i++) {
      const m = thread[i];
      const isLast = i === thread.length - 1;
      const senderId = m.from === 'me' ? demo.id : partner.id;
      // Last incoming message stays unread; outgoing always counted as read.
      const readAt =
        m.from === 'me' || !isLast
          ? new Date(baseTime + i * 4 * 60 * 1000 + 30_000)
          : null;
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          senderId,
          text: m.text,
          createdAt: new Date(baseTime + i * 4 * 60 * 1000),
          readAt,
        },
      });
    }

    const lastTime = new Date(baseTime + (thread.length - 1) * 4 * 60 * 1000);
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: lastTime },
    });
    console.log(`  💬 seeded ${thread.length} messages with ${partner.name}`);
  }
}

// Seed a few profiles who have already liked Demo. The moment Demo
// right-swipes them, a match forms — so the celebrate-and-chat flow is
// testable without standing up a second device.
async function seedIncomingLikesToDemo() {
  const demo = await prisma.user.findUnique({
    where: { email: 'arnoldhenry958@gmail.com' },
  });
  if (!demo) return;

  // Skip anyone Demo already chats with (those matches exist via the
  // conversation seed) so the carousel/match modal demo is clean.
  const fromEmails = [
    'zara@example.com',
    'maryam@example.com',
    'khadija@example.com',
  ];
  const partners = await prisma.user.findMany({
    where: { email: { in: fromEmails } },
  });

  for (const p of partners) {
    // Skip if a like already exists in either direction (idempotent seed).
    const existing = await prisma.like.findFirst({
      where: {
        OR: [
          { fromUserId: p.id, toUserId: demo.id },
          { fromUserId: demo.id, toUserId: p.id },
        ],
      },
    });
    if (existing) continue;
    await prisma.like.create({
      data: { fromUserId: p.id, toUserId: demo.id, type: 'like' },
    });
    console.log(`  💜 ${p.name} now likes Demo — swipe right to match`);
  }
}

async function main() {
  await seedDemoUser();
  //   for (const s of seeds) await seedProfile(s);
  //   await seedConversations();
  //   await seedIncomingLikesToDemo();
  console.log(
    `\n✅ Seed complete. Demo login: arnoldhenry958@gmail.com / demo1234\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
