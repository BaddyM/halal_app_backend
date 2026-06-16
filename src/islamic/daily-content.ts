/// Curated rotating daily content. Picked deterministically by day-of-year so
/// every user sees the same card on a given day. Kept in code (not the DB) so
/// it ships without a seed step; can be moved to a table later if the dashboard
/// needs to edit it.

export interface DuaItem {
  arabic: string;
  transliteration: string;
  translation: string;
  reference: string;
}

export interface HadithItem {
  text: string;
  narrator: string;
  reference: string;
}

export const DUAS: DuaItem[] = [
  {
    arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    transliteration: 'Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan waqina adhaban-nar',
    translation: 'Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.',
    reference: "Qur'an 2:201",
  },
  {
    arabic: 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي',
    transliteration: 'Rabbi-shrah li sadri wa yassir li amri',
    translation: 'My Lord, expand for me my chest and ease for me my task.',
    reference: "Qur'an 20:25-26",
  },
  {
    arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ',
    transliteration: 'Hasbunallahu wa ni’mal-wakil',
    translation: 'Allah is sufficient for us, and He is the best disposer of affairs.',
    reference: "Qur'an 3:173",
  },
  {
    arabic: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ',
    transliteration: 'Rabbana hab lana min azwajina wa dhurriyyatina qurrata a’yun',
    translation: 'Our Lord, grant us from among our spouses and offspring comfort to our eyes.',
    reference: "Qur'an 25:74",
  },
  {
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى',
    transliteration: 'Allahumma inni as’aluka al-huda wat-tuqa wal-‘afafa wal-ghina',
    translation: 'O Allah, I ask You for guidance, piety, chastity and self-sufficiency.',
    reference: 'Sahih Muslim',
  },
  {
    arabic: 'رَبِّ زِدْنِي عِلْمًا',
    transliteration: 'Rabbi zidni ‘ilma',
    translation: 'My Lord, increase me in knowledge.',
    reference: "Qur'an 20:114",
  },
  {
    arabic: 'لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ',
    transliteration: 'La ilaha illa anta subhanaka inni kuntu minaz-zalimin',
    translation: 'There is no deity except You; exalted are You. Indeed, I have been of the wrongdoers.',
    reference: "Qur'an 21:87",
  },
];

export const HADITHS: HadithItem[] = [
  {
    text: 'When a man marries, he has fulfilled half of his religion, so let him fear Allah regarding the remaining half.',
    narrator: 'Anas ibn Malik',
    reference: 'Al-Bayhaqi',
  },
  {
    text: 'The best of you are those who are best to their wives, and I am the best of you to my wives.',
    narrator: 'Aisha (RA)',
    reference: 'Tirmidhi',
  },
  {
    text: 'The most complete of the believers in faith is the one with the best character.',
    narrator: 'Abu Hurairah',
    reference: 'Tirmidhi',
  },
  {
    text: 'Actions are but by intention, and every man shall have only that which he intended.',
    narrator: 'Umar ibn al-Khattab',
    reference: 'Bukhari & Muslim',
  },
  {
    text: 'None of you truly believes until he loves for his brother what he loves for himself.',
    narrator: 'Anas ibn Malik',
    reference: 'Bukhari & Muslim',
  },
  {
    text: 'A kind word is charity.',
    narrator: 'Abu Hurairah',
    reference: 'Bukhari & Muslim',
  },
  {
    text: 'Marry the loving and fertile, for I will boast of your great numbers before the nations.',
    narrator: "Ma'qil ibn Yasar",
    reference: 'Abu Dawud',
  },
];

export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start;
  return Math.floor(diff / 86400000);
}
