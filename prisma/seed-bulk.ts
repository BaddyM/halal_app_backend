// prisma/seed-bulk.ts
//
// Generates ~200 varied, realistic user profiles for discovery/testing.
// Idempotent: re-running upserts by email, so it won't create duplicates.
//
// Run with:  npx ts-node prisma/seed-bulk.ts
//   optional: COUNT=200 npx ts-node prisma/seed-bulk.ts
//
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

const COUNT = Number(process.env.COUNT ?? 200);

// ── data pools ────────────────────────────────────────────────
const maleFirst = [
  'Yusuf', 'Ibrahim', 'Ahmed', 'Omar', 'Bilal', 'Hamza', 'Khalid', 'Idris',
  'Zayd', 'Tariq', 'Anas', 'Saad', 'Faisal', 'Imran', 'Adam', 'Musa', 'Harun',
  'Salman', 'Rashid', 'Nasir', 'Junaid', 'Suleiman', 'Yahya', 'Ismail', 'Qasim',
  'Dawud', 'Talha', 'Usman', 'Ali', 'Mahmoud',
];
const femaleFirst = [
  'Aisha', 'Fatima', 'Maryam', 'Khadija', 'Zaynab', 'Hafsa', 'Asma', 'Sumaya',
  'Ruqayya', 'Safiya', 'Amina', 'Nour', 'Layla', 'Hana', 'Sara', 'Yasmin',
  'Iman', 'Rahma', 'Sana', 'Huda', 'Mariam', 'Zara', 'Halima', 'Naima',
  'Sakina', 'Bushra', 'Aaliyah', 'Salma', 'Dunia', 'Rania',
];
const lastNames = [
  'Al-Rashid', 'Hassan', 'Ibrahim', 'Karimi', 'Malik', 'Ahmed', 'Omar', 'Faruq',
  'Abdullah', 'Yusuf', 'Khan', 'Said', 'Noor', 'Aziz', 'Rahman', 'Saleh',
  'Jamal', 'Mansour', 'Bashir', 'Hamid', 'Osei', 'Mwangi', 'Kamau', 'Ssentongo',
  'Diallo', 'Sow', 'Toure', 'Cisse', 'Begum', 'Siddiqui',
];
const professions = [
  'Software Engineer', 'Doctor', 'Teacher', 'Nurse', 'Architect', 'Accountant',
  'Civil Engineer', 'Pharmacist', 'Entrepreneur', 'Lawyer', 'Dentist',
  'Graphic Designer', 'Data Analyst', 'Lecturer', 'Journalist', 'Banker',
  'Marketing Manager', 'Product Manager', 'Researcher', 'Electrician',
  'Physiotherapist', 'Veterinarian', 'Chef', 'Translator', 'Project Manager',
];
const places: Array<{ city: string; country: string }> = [
  { city: 'Kampala', country: 'Uganda' },
  { city: 'Nairobi', country: 'Kenya' },
  { city: 'Mombasa', country: 'Kenya' },
  { city: 'Dar es Salaam', country: 'Tanzania' },
  { city: 'Zanzibar', country: 'Tanzania' },
  { city: 'Kigali', country: 'Rwanda' },
  { city: 'Addis Ababa', country: 'Ethiopia' },
  { city: 'Dubai', country: 'UAE' },
  { city: 'Istanbul', country: 'Turkey' },
  { city: 'Cairo', country: 'Egypt' },
  { city: 'Kuala Lumpur', country: 'Malaysia' },
  { city: 'Jakarta', country: 'Indonesia' },
  { city: 'London', country: 'United Kingdom' },
  { city: 'Toronto', country: 'Canada' },
  { city: 'Lagos', country: 'Nigeria' },
  { city: 'Casablanca', country: 'Morocco' },
];
const ethnicities = [
  'African', 'Arab', 'South Asian', 'Turkish', 'Malay', 'Persian',
  'Mixed', 'Somali', 'Indonesian',
];
const bios = [
  'Seeking a righteous partner who values deen, family, and lifelong growth together.',
  'Balancing career with spiritual growth. Looking for someone who understands both.',
  'Family-oriented and practising, hoping to build a home founded on taqwa.',
  'Lover of books, travel, and good conversation. Deen comes first, always.',
  'Trying my best on this journey of faith. Looking for a sincere companion.',
  'Quiet, kind, and ambitious. Seeking barakah in marriage and in life.',
  'Passionate about community service and lifelong learning, inshaAllah.',
  'Down to earth, faith-driven, and ready for the next chapter with the right person.',
  'I value honesty, patience, and a sense of humour. Deen and character matter most.',
  'Hoping to find a partner to grow closer to Allah with, side by side.',
];
const valuesPool = [
  'Strong deen', 'Family first', 'Community service', 'Education',
  'Career ambition', 'Travel & adventure', 'Simple, quiet life', 'Health & fitness',
];
const interestsPool = [
  'Practising', 'Family-oriented', 'Quran', 'Traveller', 'Foodie', 'Sports',
  'Reading', 'Creative', 'Multilingual', 'Helping others', 'Outdoors', 'Tech',
  'Volunteering', 'Calligraphy', 'Hiking',
];

const prayers: PrayerFrequency[] = [
  'fiveTimes', 'fiveTimes', 'fiveTimes', 'mostPrayers', 'mostPrayers',
  'jumuahOnly', 'workingOnIt', 'sometimes',
];
const sects: IslamicSect[] = ['sunni', 'sunni', 'sunni', 'shia', 'sufi', 'other'];
const timelines: MarriageTimeline[] = [
  'asap', 'withinYear', 'withinYear', 'oneToTwoYears', 'openTimeline',
];
const childrenPrefs: ChildrenPreference[] = [
  'noWantThem', 'noWantThem', 'noOpenToIt', 'haveWantMore', 'preferNotToSay',
];
const locationPrefs: LocationPreference[] = [
  'sameCity', 'sameCountry', 'sameCountry', 'countryOrAbroad', 'anywhere',
];
const femaleHijab: HijabPreference[] = ['hijab', 'hijab', 'hijab', 'niqab', 'preferNotToSay'];

// Deterministic pick: spreads choices across a pool using a stride so fields
// don't all correlate to the same index.
function pick<T>(pool: T[], i: number, stride = 1): T {
  return pool[(i * stride) % pool.length];
}
function pickSome<T>(pool: T[], i: number, n: number): T[] {
  const out: T[] = [];
  for (let k = 0; k < n; k++) out.push(pool[(i * 3 + k * 5) % pool.length]);
  return Array.from(new Set(out));
}

async function main() {
  console.log(`Seeding ${COUNT} profiles…`);
  const hashed = await bcrypt.hash('halal1234', 10);
  const thisYear = new Date().getFullYear();
  let created = 0;

  for (let i = 0; i < COUNT; i++) {
    const isMale = i % 2 === 0;
    const gender: Gender = isMale ? 'male' : 'female';
    const genderIndex = Math.floor(i / 2); // 0..(COUNT/2-1)
    const first = pick(isMale ? maleFirst : femaleFirst, genderIndex, 1);
    const last = pick(lastNames, i, 7);
    const name = `${first} ${last}`;
    const email = `bulk${i + 1}@halaltest.com`;

    const age = 20 + (i % 21); // 20..40
    const dob = new Date(thisYear - age, (i * 7) % 12, ((i * 13) % 27) + 1);
    const place = pick(places, i, 3);
    const portraitNum = genderIndex % 100; // randomuser has 0..99 per gender
    const imageUrl = `https://randomuser.me/api/portraits/${
      isMale ? 'men' : 'women'
    }/${portraitNum}.jpg`;

    const profileData = {
      gender,
      dateOfBirth: dob,
      city: place.city,
      country: place.country,
      profession: pick(professions, i, 5),
      bio: pick(bios, i, 3),
      primaryImageUrl: imageUrl,
      prayerFrequency: pick(prayers, i, 1),
      sect: pick(sects, i, 1),
      hijabPreference: (isMale ? 'notApplicable' : pick(femaleHijab, genderIndex, 1)) as HijabPreference,
      ethnicity: pick(ethnicities, i, 2),
      maritalTimeline: pick(timelines, i, 1),
      childrenPref: pick(childrenPrefs, i, 1),
      locationPref: pick(locationPrefs, i, 1),
      values: pickSome(valuesPool, i, 3) as any,
      interests: pickSome(interestsPool, i, 4) as any,
      isVerified: i % 3 === 0,
      isComplete: true,
    };

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, isEmailVerified: true, lastSeenAt: new Date() },
      create: { email, password: hashed, name, isEmailVerified: true, lastSeenAt: new Date() },
    });

    await prisma.profile.upsert({
      where: { userId: user.id },
      update: profileData,
      create: { userId: user.id, ...profileData },
    });

    created++;
    if (created % 25 === 0) console.log(`  …${created}/${COUNT}`);
  }

  console.log(`\n✅ Seeded ${created} profiles. Login password for all: halal1234`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
