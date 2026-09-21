import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search, ChevronLeft, Play, Pause, SkipBack, SkipForward,
  Bookmark, BookmarkCheck, Copy, Check, Moon, Sun,
  Loader2, BookOpen, AlertCircle, Clock, Compass, MapPin,
  ChevronDown, Droplets, Info, Volume2, Bell, BellOff,
  Target, Flame, Sparkles, Smartphone, X,
  Share2, StickyNote, Tag, Download, GraduationCap, Type,
  Home, Shield, Users, Utensils, Star, MoreHorizontal,
} from 'lucide-react';

/**
 * Single-file Quran reader + Prayer (Namaz) companion.
 *
 * Data sources (both from the Islamic Network's free public APIs):
 *  - https://api.alquran.cloud/v1  → Quran text, translation, transliteration, audio
 *      - quran-uthmani      -> Uthmani Arabic script
 *      - ml.abdulhameed     -> Malayalam translation (Cheriyamundam Abdul Hameed & Kunhi Mohammed)
 *      - en.transliteration -> Romanized transliteration (pronunciation aid)
 *      - ar.alafasy         -> Audio recitation, Mishary Rashid Alafasy
 *  - https://api.aladhan.com/v1 → Prayer timings & Qibla direction, from geolocation or a searched city
 *
 * Note: the Quran API does not publish a dedicated Malayalam-script
 * transliteration edition, only an English/Roman one, so a single
 * `en.transliteration` line is shown as the pronunciation aid, alongside
 * the full Malayalam translation.
 */

const API_BASE = 'https://api.alquran.cloud/v1';
const TEXT_EDITIONS = 'quran-uthmani,ml.abdulhameed,en.transliteration';
const DEFAULT_RECITER = 'ar.alafasy';
function buildEditions(reciter) {
  return `${TEXT_EDITIONS},${reciter || DEFAULT_RECITER}`;
}

const ADHAN_API = 'https://api.aladhan.com/v1';
const PRAYER_METHOD = 2; // Islamic Society of North America (ISNA); change if a different convention is preferred
const KAABA = { lat: 21.4225, lon: 39.8262 };

const LS_BOOKMARKS = 'quran_reader_bookmarks_v1';
const LS_LAST_READ = 'quran_reader_last_read_v1';
const LS_THEME = 'quran_reader_theme_v1';
const LS_PRAYER_LOCATION = 'quran_reader_prayer_location_v1';
const LS_REMINDERS = 'quran_reader_prayer_reminders_v1';
const LS_READ_LOG = 'quran_reader_read_log_v1';
const LS_KHATMAH = 'quran_reader_khatmah_v1';
const LS_RECITER = 'quran_reader_reciter_v1';
const LS_NOTES = 'quran_reader_notes_v1';
const LS_BEGINNER_MODE = 'quran_reader_beginner_mode_v1';

const QUICK_TAGS = ['Comfort', 'Duas from Quran', 'Guidance', 'Reflection', 'Gratitude', 'Patience'];

const ARABIC_ALPHABET = [
  { letter: 'ا', name: 'Alif', translit: 'A' },
  { letter: 'ب', name: 'Ba', translit: 'B' },
  { letter: 'ت', name: 'Ta', translit: 'T' },
  { letter: 'ث', name: 'Tha', translit: 'Th' },
  { letter: 'ج', name: 'Jeem', translit: 'J' },
  { letter: 'ح', name: 'Hha', translit: 'H·' },
  { letter: 'خ', name: 'Kha', translit: 'Kh' },
  { letter: 'د', name: 'Dal', translit: 'D' },
  { letter: 'ذ', name: 'Dhal', translit: 'Dh' },
  { letter: 'ر', name: 'Ra', translit: 'R' },
  { letter: 'ز', name: 'Zay', translit: 'Z' },
  { letter: 'س', name: 'Seen', translit: 'S' },
  { letter: 'ش', name: 'Sheen', translit: 'Sh' },
  { letter: 'ص', name: 'Sad', translit: 'S·' },
  { letter: 'ض', name: 'Dad', translit: 'D·' },
  { letter: 'ط', name: 'Ta·', translit: 'T·' },
  { letter: 'ظ', name: 'Dha·', translit: 'Dh·' },
  { letter: 'ع', name: 'Ayn', translit: "'" },
  { letter: 'غ', name: 'Ghayn', translit: 'Gh' },
  { letter: 'ف', name: 'Fa', translit: 'F' },
  { letter: 'ق', name: 'Qaf', translit: 'Q' },
  { letter: 'ك', name: 'Kaf', translit: 'K' },
  { letter: 'ل', name: 'Lam', translit: 'L' },
  { letter: 'م', name: 'Meem', translit: 'M' },
  { letter: 'ن', name: 'Noon', translit: 'N' },
  { letter: 'ه', name: 'Ha', translit: 'H' },
  { letter: 'و', name: 'Waw', translit: 'W' },
  { letter: 'ي', name: 'Ya', translit: 'Y' },
];

const HARAKAT = [
  { mark: 'بَ', name: 'Fatha', sound: 'Short "a"', translit: 'Ba' },
  { mark: 'بِ', name: 'Kasra', sound: 'Short "i"', translit: 'Bi' },
  { mark: 'بُ', name: 'Damma', sound: 'Short "u"', translit: 'Bu' },
  { mark: 'بْ', name: 'Sukoon', sound: 'No vowel — a stop', translit: 'B' },
  { mark: 'بّ', name: 'Shadda', sound: 'Doubled consonant', translit: 'bb' },
  { mark: 'بً', name: 'Tanween Fath', sound: '"an" sound, often at a sentence end', translit: 'Ban' },
  { mark: 'بٍ', name: 'Tanween Kasr', sound: '"in" sound', translit: 'Bin' },
  { mark: 'بٌ', name: 'Tanween Damm', sound: '"un" sound', translit: 'Bun' },
];

const LS_DUA_FAVORITES = 'quran_reader_dua_favorites_v1';

const DUA_CATEGORIES = [
  { key: 'home', label: 'Home & Daily Life', icon: Home, color: 'sky' },
  { key: 'sleep', label: 'Sleep & Waking', icon: Moon, color: 'indigo' },
  { key: 'eating', label: 'Eating & Drinking', icon: Utensils, color: 'amber' },
  { key: 'travel', label: 'Travel', icon: Compass, color: 'cyan' },
  { key: 'protection', label: 'Protection & Comfort', icon: Shield, color: 'rose' },
  { key: 'social', label: 'Social & Wellbeing', icon: Users, color: 'emerald' },
];

// A general collection of everyday duas following common practice, drawn
// from widely published sources (e.g. Hisnul Muslim / "Fortress of the
// Muslim"). Exact wording can vary slightly between narrations and
// collections — treat this as a reliable everyday reference rather than an
// exhaustive scholarly text.
const DUAS = [
  {
    id: 'home-enter',
    category: 'home',
    title: 'Entering the home',
    occasion: 'Said when stepping into your house',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ الْمَوْلِجِ وَخَيْرَ الْمَخْرَجِ، بِسْمِ اللَّهِ وَلَجْنَا وَبِسْمِ اللَّهِ خَرَجْنَا وَعَلَى اللَّهِ رَبِّنَا تَوَكَّلْنَا',
    translit: "Allahumma inni as'aluka khayral-mawliji wa khayral-makhraji, bismillahi walajna wa bismillahi kharajna wa 'ala Allahi Rabbina tawakkalna",
    translation: 'O Allah, I ask You for the best entrance and the best exit; in the name of Allah we enter and in the name of Allah we leave, and upon Allah, our Lord, we place our trust.',
  },
  {
    id: 'home-leave',
    category: 'home',
    title: 'Leaving the home',
    occasion: 'Said when stepping out the door',
    arabic: 'بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    translit: "Bismillahi tawakkaltu 'alallahi, wa la hawla wa la quwwata illa billah",
    translation: 'In the name of Allah, I place my trust in Allah; there is no power and no strength except with Allah.',
  },
  {
    id: 'home-bathroom-enter',
    category: 'home',
    title: 'Entering the bathroom',
    occasion: 'Said before entering',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبُثِ وَالْخَبَائِثِ',
    translit: "Allahumma inni a'udhu bika minal-khubthi wal-khaba'ith",
    translation: 'O Allah, I seek refuge in You from male and female unclean spirits.',
  },
  {
    id: 'home-bathroom-leave',
    category: 'home',
    title: 'Leaving the bathroom',
    occasion: 'Said after leaving',
    arabic: 'غُفْرَانَكَ',
    translit: 'Ghufranak',
    translation: 'I seek Your forgiveness.',
  },
  {
    id: 'sleep-before',
    category: 'sleep',
    title: 'Before sleeping',
    occasion: 'Said lying down to sleep',
    arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    translit: 'Bismika Allahumma amutu wa ahya',
    translation: 'In Your name, O Allah, I die and I live.',
  },
  {
    id: 'sleep-waking',
    category: 'sleep',
    title: 'Upon waking up',
    occasion: 'Said right after waking',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
    translit: "Alhamdu lillahil-ladhi ahyana ba'da ma amatana wa ilayhin-nushur",
    translation: 'Praise be to Allah who gave us life after having taken it from us, and unto Him is the resurrection.',
  },
  {
    id: 'eating-before',
    category: 'eating',
    title: 'Before eating',
    occasion: 'Said before starting a meal',
    arabic: 'بِسْمِ اللَّهِ',
    translit: 'Bismillah',
    translation: 'In the name of Allah.',
    note: 'If you forget to say it at the start, "Bismillahi awwalahu wa akhirahu" ("In the name of Allah at its start and its end") is said upon remembering.',
  },
  {
    id: 'eating-after',
    category: 'eating',
    title: 'After eating',
    occasion: 'Said once finished',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ',
    translit: 'Alhamdu lillahil-ladhi at-amani hadha wa razaqanihi min ghayri hawlin minni wa la quwwah',
    translation: 'Praise be to Allah who fed me this and provided it for me without any power or might on my part.',
  },
  {
    id: 'travel-start',
    category: 'travel',
    title: 'Starting a journey',
    occasion: 'Said when setting off, e.g. boarding a vehicle',
    arabic: 'اللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ، سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ',
    translit: 'Allahu Akbar, Allahu Akbar, Allahu Akbar. Subhanal-ladhi sakhkhara lana hadha wa ma kunna lahu muqrinin, wa inna ila Rabbina lamunqalibun',
    translation: 'Allah is the Greatest (×3). Glory to Him who has placed this at our service, for we ourselves could not have done so, and to our Lord we will surely return.',
    note: "Drawn from Qur'an 43:13–14.",
  },
  {
    id: 'travel-return',
    category: 'travel',
    title: 'Returning from a journey',
    occasion: "Said on the way home, added to the travel dua",
    arabic: 'آيِبُونَ تَائِبُونَ عَابِدُونَ لِرَبِّنَا حَامِدُونَ',
    translit: "Ayibuna ta'ibuna 'abiduna li-Rabbina hamidun",
    translation: 'We return, repentant, worshipping, and praising our Lord.',
  },
  {
    id: 'protection-distress',
    category: 'protection',
    title: 'In times of distress',
    occasion: 'Known as the dua of Prophet Yunus (Jonah)',
    arabic: 'لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ',
    translit: 'La ilaha illa anta subhanaka inni kuntu minaz-zalimin',
    translation: 'There is no god but You, glory be to You; indeed I was among the wrongdoers.',
    note: "From Qur'an 21:87.",
  },
  {
    id: 'protection-daily',
    category: 'protection',
    title: 'For protection, morning & evening',
    occasion: 'Recited three times, morning and evening',
    arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
    translit: "Bismillahil-ladhi la yadurru ma'asmihi shay'un fil-ardi wa la fis-sama'i wa Huwas-Sami'ul-'Alim",
    translation: 'In the name of Allah, with whose name nothing on earth or in the heavens can cause harm, and He is the All-Hearing, All-Knowing.',
  },
  {
    id: 'protection-fear',
    category: 'protection',
    title: 'In fear or danger',
    occasion: 'Said when facing a frightening situation',
    arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ',
    translit: "Hasbunallahu wa ni'mal-Wakil",
    translation: 'Allah is sufficient for us, and He is the best Disposer of affairs.',
    note: "From Qur'an 3:173.",
  },
  {
    id: 'social-parents',
    category: 'social',
    title: 'For parents',
    occasion: 'A short dua for one\u2019s mother and father',
    arabic: 'رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا',
    translit: 'Rabbi-rhamhuma kama rabbayani saghira',
    translation: 'My Lord, have mercy upon them as they raised me when I was small.',
    note: "From Qur'an 17:24.",
  },
  {
    id: 'social-sneeze',
    category: 'social',
    title: 'Sneezing',
    occasion: 'An exchange between the person who sneezes and those who hear it',
    arabic: 'الْحَمْدُ لِلَّهِ — يَرْحَمُكَ اللَّهُ — يَهْدِيكُمُ اللَّهُ وَيُصْلِحُ بَالَكُمْ',
    translit: 'Alhamdulillah — Yarhamukallah — Yahdikumullahu wa yuslihu balakum',
    translation: 'The sneezer says "Praise be to Allah." Those who hear reply "May Allah have mercy on you." The sneezer then responds, "May Allah guide you and set your affairs right."',
  },
  {
    id: 'social-sick',
    category: 'social',
    title: 'Visiting someone sick',
    occasion: 'Said to comfort them',
    arabic: 'لَا بَأْسَ، طَهُورٌ إِنْ شَاءَ اللَّهُ',
    translit: 'La ba-sa, tahurun in sha Allah',
    translation: 'No harm — it will be a purification, if Allah wills.',
  },
  {
    id: 'social-pleasing',
    category: 'social',
    title: 'Seeing something pleasing',
    occasion: 'Said upon good news or a pleasant sight',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي بِنِعْمَتِهِ تَتِمُّ الصَّالِحَاتُ',
    translit: "Alhamdu lillahil-ladhi bini'matihi tatimmus-salihat",
    translation: 'Praise be to Allah, by whose grace good things are completed.',
  },
  {
    id: 'social-displeasing',
    category: 'social',
    title: 'Seeing something troubling',
    occasion: 'Said upon hearing unwelcome news',
    arabic: 'الْحَمْدُ لِلَّهِ عَلَى كُلِّ حَالٍ',
    translit: "Alhamdu lillahi 'ala kulli hal",
    translation: 'Praise be to Allah in every circumstance.',
  },
];
// (completion) pacing and overall reading progress percentage.
const TOTAL_AYAHS = 6236;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateKey, days) {
  const d = new Date(dateKey);
  d.setDate(d.getDate() + days);
  return d;
}

// Optional: point this at an Adhan (call to prayer) recording you have the
// rights to use — e.g. a file you add to your project's `public/` folder
// (then set this to '/adhan.mp3') or a URL you trust. There is no reliable,
// well-documented free public API for Adhan *audio* the way there is for
// Quran recitation, so none is bundled by default. Leave this blank and the
// app will play a short generated reminder chime instead, and always show
// the full Azan text below.
const ADHAN_AUDIO_URL = '';

const AZAN_LINES = [
  { arabic: 'اللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ', translit: 'Allahu Akbar, Allahu Akbar', translation: 'Allah is the Greatest, Allah is the Greatest', repeat: 2 },
  { arabic: 'أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا اللَّهُ', translit: 'Ash-hadu al-la ilaha illallah', translation: 'I bear witness that there is no god but Allah', repeat: 2 },
  { arabic: 'أَشْهَدُ أَنَّ مُحَمَّدًا رَسُولُ اللَّهِ', translit: 'Ash-hadu anna Muhammadar-Rasulullah', translation: 'I bear witness that Muhammad is the Messenger of Allah', repeat: 2 },
  { arabic: 'حَيَّ عَلَى الصَّلَاةِ', translit: "Hayya 'alas-Salah", translation: 'Come to prayer', repeat: 2 },
  { arabic: 'حَيَّ عَلَى الْفَلَاحِ', translit: "Hayya 'alal-Falah", translation: 'Come to success', repeat: 2 },
  {
    arabic: 'الصَّلَاةُ خَيْرٌ مِنَ النَّوْمِ',
    translit: 'As-salatu khayrun minan-nawm',
    translation: 'Prayer is better than sleep',
    repeat: 2,
    fajrOnly: true,
    note: 'Added only in the Fajr (dawn) Azan, after "Come to success".',
  },
  { arabic: 'اللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ', translit: 'Allahu Akbar, Allahu Akbar', translation: 'Allah is the Greatest, Allah is the Greatest', repeat: 1 },
  { arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ', translit: 'La ilaha illallah', translation: 'There is no god but Allah', repeat: 1 },
];

const WUDU_STEPS = [
  { title: 'Intention (Niyyah)', text: 'Silently intend in your heart to perform wudu for the purpose of prayer.' },
  { title: 'Say Bismillah', arabic: 'بِسْمِ اللَّهِ', translit: 'Bismillah', text: 'Begin by saying "In the name of Allah."' },
  { title: 'Wash hands', text: 'Wash both hands up to the wrists, three times, making sure water reaches between the fingers.' },
  { title: 'Rinse mouth', text: 'Take water into the mouth and rinse thoroughly, three times.' },
  { title: 'Rinse nose', text: 'Sniff water into the nostrils and blow it out gently, three times.' },
  { title: 'Wash face', text: 'Wash the entire face from the hairline to the chin, and ear to ear, three times.' },
  { title: 'Wash arms', text: 'Wash the right arm up to and including the elbow three times, then the left arm the same way.' },
  { title: 'Wipe head', text: 'Wipe the head once with wet hands, front to back.' },
  { title: 'Wipe ears', text: 'Wipe the inside and outside of both ears with wet fingers.' },
  { title: 'Wash feet', text: 'Wash the right foot up to and including the ankle three times, then the left foot the same way.' },
  {
    title: 'Dua after Wudu',
    arabic: 'أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
    translit: "Ashhadu an la ilaha illallahu wahdahu la sharika lah, wa ashhadu anna Muhammadan 'abduhu wa rasuluh",
    text: '"I bear witness that there is no god but Allah alone, without partner, and I bear witness that Muhammad is His servant and messenger."',
  },
];

const SALAH_STEPS = [
  { title: '1. Intention (Niyyah)', note: 'Silently intend which prayer you are performing. No fixed wording is required.' },
  {
    title: '2. Takbiratul Ihram (Opening)',
    arabic: 'اللَّهُ أَكْبَرُ',
    translit: 'Allahu Akbar',
    translation: 'Allah is the Greatest',
    note: 'Raise both hands to your ears or shoulders and say this, entering the state of prayer.',
  },
  {
    title: '3. Opening dua (Istiftah)',
    arabic:
      'وَجَّهْتُ وَجْهِيَ لِلَّذِي فَطَرَ السَّمَاوَاتِ وَالْأَرْضَ حَنِيفًا وَمَا أَنَا مِنَ الْمُشْرِكِينَ، إِنَّ صَلَاتِي وَنُسُكِي وَمَحْيَايَ وَمَمَاتِي لِلَّهِ رَبِّ الْعَالَمِينَ، لَا شَرِيكَ لَهُ وَبِذَلِكَ أُمِرْتُ وَأَنَا مِنَ الْمُسْلِمِينَ',
    translit:
      "Wajjahtu wajhiya lilladhi fataras-samawati wal-arda hanifan wa ma ana minal-mushrikin. Inna salati wa nusuki wa mahyaya wa mamati lillahi Rabbil-'alamin, la sharika lahu wa bidhalika umirtu wa ana minal-muslimin",
    translation:
      "I have turned my face toward He who created the heavens and the earth, inclining toward truth, and I am not of those who associate partners with Him. Indeed, my prayer, my rites of worship, my living and my dying are for Allah, Lord of the worlds. He has no partner; this I have been commanded, and I am of those who submit to Him",
    note: "Recited silently, just after the opening Takbir, before Al-Fatiha (drawn from Qur'an 6:79 and 6:162–163). A shorter alternative, \"Subhanaka Allahumma wa bihamdika, wa tabarakasmuka, wa ta'ala jadduka, wa la ilaha ghairuk\" (\"Glory is to You, O Allah, and praise; blessed is Your name, exalted is Your majesty, and there is no god besides You\"), is also widely used — which one is customary varies by region and school of thought.",
  },
  {
    title: '4. Standing recitation',
    note: "Recite Surah Al-Fatiha, followed by another short surah or passage, in the first two rakahs. You can read Al-Fatiha any time in the Qur'an tab above.",
  },
  {
    title: '5. Ruku (Bowing)',
    arabic: 'سُبْحَانَ رَبِّيَ الْعَظِيمِ',
    translit: 'Subhana Rabbiyal-Adheem',
    translation: 'Glory is to my Lord, the Most Great',
    note: 'Bow with your back straight and hands on your knees, repeating this three times.',
  },
  {
    title: '6. Rising from Ruku',
    arabic: 'سَمِعَ اللَّهُ لِمَنْ حَمِدَهُ ۚ رَبَّنَا وَلَكَ الْحَمْدُ حَمْدًا كَثِيرًا طَيِّبًا مُبَارَكًا فِيهِ',
    translit: 'Sami Allahu liman hamidah · Rabbana wa lakal-hamdu hamdan kathiran tayyiban mubarakan feeh',
    translation: 'Allah hears whoever praises Him · Our Lord, to You belongs praise — abundant, good, and blessed praise',
    note: 'Stand up straight before moving into prostration. The shorter "Rabbana wa lakal-hamd" is also commonly used.',
  },
  {
    title: '7. Sujud (Prostration)',
    arabic: 'سُبْحَانَ رَبِّيَ الْأَعْلَى',
    translit: "Subhana Rabbiyal-A'la",
    translation: 'Glory is to my Lord, the Most High',
    note: 'Prostrate with forehead, nose, palms, knees and toes touching the ground, repeating this three times. Performed twice each rakah, with a brief sitting in between.',
  },
  {
    title: '8. Sitting between prostrations',
    arabic: 'رَبِّ اغْفِرْ لِي وَارْحَمْنِي وَاجْبُرْنِي وَارْفَعْنِي وَارْزُقْنِي وَاهْدِنِي وَعَافِنِي وَاعْفُ عَنِّي',
    translit: "Rabbighfir li, warhamni, wajburni, warfa'ni, warzuqni, wahdini, wa 'afini, wa'fu 'anni",
    translation: 'My Lord, forgive me, have mercy on me, mend my affairs, raise my rank, grant me provision, guide me, grant me wellbeing, and pardon me',
    note: 'A shorter "Rabbighfir li" (My Lord, forgive me) is also commonly used here.',
  },
  {
    title: '9. Tashahhud (Sitting)',
    arabic:
      'التَّحِيَّاتُ لِلَّهِ وَالصَّلَوَاتُ وَالطَّيِّبَاتُ، السَّلَامُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ، السَّلَامُ عَلَيْنَا وَعَلَى عِبَادِ اللَّهِ الصَّالِحِينَ، أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا اللَّهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
    translit:
      "At-tahiyyatu lillahi was-salawatu wat-tayyibat, as-salamu 'alayka ayyuhan-nabiyyu wa rahmatullahi wa barakatuh, as-salamu 'alayna wa 'ala 'ibadillahis-salihin, ash-hadu al-la ilaha illallah wa ash-hadu anna Muhammadan 'abduhu wa rasuluh",
    translation:
      'All greetings, prayers and good things are due to Allah. Peace be upon you, O Prophet, and the mercy of Allah and His blessings. Peace be upon us and upon the righteous servants of Allah. I bear witness that there is no god but Allah, and I bear witness that Muhammad is His servant and messenger',
    note: 'Recited while sitting after two rakahs, and again at the end of the prayer.',
  },
  {
    title: '10. Durood Ibrahim (Salawat)',
    arabic:
      'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ. اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ',
    translit:
      'Allahumma salli \u2018ala Muhammadin wa \u2018ala aali Muhammad, kama sallayta \u2018ala Ibrahima wa \u2018ala aali Ibrahim, innaka Hamidum-Majid. Allahumma barik \u2018ala Muhammadin wa \u2018ala aali Muhammad, kama barakta \u2018ala Ibrahima wa \u2018ala aali Ibrahim, innaka Hamidum-Majid',
    translation:
      'O Allah, send blessings upon Muhammad and the family of Muhammad, as You sent blessings upon Ibrahim and the family of Ibrahim; indeed You are Praiseworthy, Glorious. O Allah, bless Muhammad and the family of Muhammad, as You blessed Ibrahim and the family of Ibrahim; indeed You are Praiseworthy, Glorious',
    note: 'Recited in the final Tashahhud, after the testimony of faith, before ending the prayer.',
  },
  {
    title: '11. Dua before Salam (optional)',
    arabic:
      'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عَذَابِ جَهَنَّمَ، وَمِنْ عَذَابِ الْقَبْرِ، وَمِنْ فِتْنَةِ الْمَحْيَا وَالْمَمَاتِ، وَمِنْ شَرِّ فِتْنَةِ الْمَسِيحِ الدَّجَّالِ',
    translit:
      "Allahumma inni a'udhu bika min 'adhabi jahannam, wa min 'adhabil-qabr, wa min fitnatil-mahya wal-mamat, wa min sharri fitnatil-masihid-dajjal",
    translation:
      'O Allah, I seek refuge in You from the punishment of Hell, from the punishment of the grave, from the trials of life and death, and from the evil of the trial of the False Messiah',
    note: 'A well-known optional addition after the final Tashahhud and Durood, before Taslim.',
  },
  {
    title: '12. Taslim (Ending)',
    arabic: 'السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ',
    translit: 'Assalamu alaikum wa rahmatullah',
    translation: 'Peace and the mercy of Allah be upon you',
    note: 'Turn your head to the right, then to the left, saying this each time, to conclude the prayer.',
  },
];

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function formatTime(sec) {
  if (!sec || Number.isNaN(sec) || !Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function to12h(timeStr) {
  if (!timeStr) return '--:--';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${suffix}`;
}

function playReminderChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [784, 659, 523];
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.35;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  } catch {
    // Web Audio unsupported/blocked — silently skip the chime, the text/notification still show.
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function QuranApp() {
  // ---------------- App section ----------------
  const [section, setSection] = useState('quran'); // 'quran' | 'prayer' | 'duas' | 'progress' | 'learn'
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // ---------------- Surah list ----------------
  const [surahList, setSurahList] = useState([]);
  const [surahListLoading, setSurahListLoading] = useState(true);
  const [surahListError, setSurahListError] = useState(null);

  // ---------------- Reader ----------------
  const [selectedSurah, setSelectedSurah] = useState(null);
  const [surahMeta, setSurahMeta] = useState(null);
  const [ayahs, setAyahs] = useState([]);
  const [ayahsLoading, setAyahsLoading] = useState(false);
  const [ayahsError, setAyahsError] = useState(null);

  const [reciter, setReciter] = useState(() => localStorage.getItem(LS_RECITER) || DEFAULT_RECITER);
  const [reciterList, setReciterList] = useState([]);
  const [reciterListLoading, setReciterListLoading] = useState(true);
  const [showReciterPicker, setShowReciterPicker] = useState(false);

  useEffect(() => {
    localStorage.setItem(LS_RECITER, reciter);
  }, [reciter]);

  useEffect(() => {
    fetch(`${API_BASE}/edition/format/audio`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        const arabic = (data.data || []).filter((e) => e.language === 'ar');
        arabic.sort((a, b) => a.englishName.localeCompare(b.englishName));
        setReciterList(arabic);
      })
      .catch(() => setReciterList([]))
      .finally(() => setReciterListLoading(false));
  }, []);

  // ---------------- UI ----------------
  const [query, setQuery] = useState('');
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'reader'
  const [showBookmarksPanel, setShowBookmarksPanel] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [themeMode, setThemeMode] = useState(() => {
    const v = localStorage.getItem(LS_THEME);
    return v === 'dark' || v === 'light' || v === 'auto' ? v : 'auto';
  });
  // In 'auto' mode, dark mode follows the device's own clock (a simple
  // 6pm–6am rule) rather than a fixed default, and re-checks every minute so
  // it flips over automatically without needing a page reload.
  const [autoIsDark, setAutoIsDark] = useState(() => {
    const h = new Date().getHours();
    return h >= 18 || h < 6;
  });
  const isDark = themeMode === 'auto' ? autoIsDark : themeMode === 'dark';
  const cycleTheme = () => setThemeMode((m) => (m === 'auto' ? 'dark' : m === 'dark' ? 'light' : 'auto'));

  // ---------------- Persisted state ----------------
  const [bookmarks, setBookmarks] = useState(() => loadJSON(LS_BOOKMARKS, {}));
  const [lastRead, setLastRead] = useState(() => loadJSON(LS_LAST_READ, null));

  // { visited: { [globalAyahNumber]: 'YYYY-MM-DD' } } — every ayah is recorded
  // once, on the date it was first seen. This drives Khatmah progress and the
  // habit-streak dashboard, without needing a "mark as read" button: it's
  // updated passively as ayahs scroll into view (see the IntersectionObserver
  // effect below) and whenever one is played.
  const [readLog, setReadLog] = useState(() => loadJSON(LS_READ_LOG, { visited: {} }));
  const [khatmah, setKhatmah] = useState(() => loadJSON(LS_KHATMAH, null)); // { targetDate, createdAt, startCount }

  // { "surah:ayah": { text: string, tags: string[] } }
  const [notes, setNotes] = useState(() => loadJSON(LS_NOTES, {}));
  const [openNoteFor, setOpenNoteFor] = useState(null); // ayah globalNumber currently being edited, or null
  const [noteDraft, setNoteDraft] = useState({ text: '', tags: [] });

  const [beginnerMode, setBeginnerMode] = useState(() => loadJSON(LS_BEGINNER_MODE, false));

  const [shareAyah, setShareAyah] = useState(null); // { ayah, surahMeta } while the verse-card modal is open

  // ---------------- Audio ----------------
  const [currentAyahIdx, setCurrentAyahIdx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef(null);
  const ayahRefs = useRef({});
  const requestIdRef = useRef(0);
  const pendingJumpRef = useRef(null);

  // ---------------- Fonts (Amiri for Arabic, Noto Sans Malayalam) ----------------
  useEffect(() => {
    const id = 'quran-app-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Malayalam:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_THEME, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (themeMode !== 'auto') return;
    const check = () => {
      const h = new Date().getHours();
      setAutoIsDark(h >= 18 || h < 6);
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [themeMode]);

  // ---------------- Fetch: Surah list ----------------
  const fetchSurahList = useCallback(() => {
    setSurahListLoading(true);
    setSurahListError(null);
    fetch(`${API_BASE}/surah`)
      .then((r) => {
        if (!r.ok) throw new Error('Could not load the Surah list.');
        return r.json();
      })
      .then((data) => setSurahList(data.data || []))
      .catch((err) => setSurahListError(err.message || 'Something went wrong.'))
      .finally(() => setSurahListLoading(false));
  }, []);

  useEffect(() => {
    fetchSurahList();
  }, [fetchSurahList]);

  // ---------------- Fetch: Ayahs for a Surah ----------------
  const fetchAyahs = useCallback(
    (num) => {
      const myId = ++requestIdRef.current;
      setAyahsLoading(true);
      setAyahsError(null);
      setAyahs([]);
      setSurahMeta(null);
      setCurrentAyahIdx(-1);
      setIsPlaying(false);

      fetch(`${API_BASE}/surah/${num}/editions/${buildEditions(reciter)}`)
        .then((r) => {
          if (!r.ok) throw new Error('Could not load this Surah. Please try again.');
          return r.json();
        })
        .then((data) => {
          if (myId !== requestIdRef.current) return;
          const [arabicEd, malayalamEd, translitEd, audioEd] = data.data;
          const merged = arabicEd.ayahs.map((a, i) => ({
            globalNumber: a.number,
            numberInSurah: a.numberInSurah,
            arabic: a.text,
            translation: malayalamEd.ayahs[i]?.text || '',
            transliteration: translitEd.ayahs[i]?.text || '',
            audioUrl: audioEd.ayahs[i]?.audio || '',
          }));
          setAyahs(merged);
          setSurahMeta({
            number: arabicEd.number,
            name: arabicEd.name,
            englishName: arabicEd.englishName,
            englishNameTranslation: arabicEd.englishNameTranslation,
            revelationType: arabicEd.revelationType,
            numberOfAyahs: arabicEd.numberOfAyahs,
          });
        })
        .catch((err) => {
          if (myId !== requestIdRef.current) return;
          setAyahsError(err.message || 'Something went wrong.');
        })
        .finally(() => {
          if (myId === requestIdRef.current) setAyahsLoading(false);
        });
    },
    [reciter]
  );

  useEffect(() => {
    if (selectedSurah) fetchAyahs(selectedSurah);
  }, [selectedSurah, fetchAyahs]);

  // ---------------- Persistence ----------------
  useEffect(() => {
    localStorage.setItem(LS_BOOKMARKS, JSON.stringify(bookmarks));
  }, [bookmarks]);

  const markAyahRead = useCallback((globalNumber) => {
    setReadLog((prev) => {
      if (prev.visited[globalNumber]) return prev; // already counted — skip the write
      return { visited: { ...prev.visited, [globalNumber]: todayKey() } };
    });
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_READ_LOG, JSON.stringify(readLog));
  }, [readLog]);

  useEffect(() => {
    if (khatmah) localStorage.setItem(LS_KHATMAH, JSON.stringify(khatmah));
    else localStorage.removeItem(LS_KHATMAH);
  }, [khatmah]);

  useEffect(() => {
    localStorage.setItem(LS_NOTES, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(LS_BEGINNER_MODE, JSON.stringify(beginnerMode));
  }, [beginnerMode]);

  const noteKey = (surahNum, numberInSurah) => `${surahNum}:${numberInSurah}`;

  const openNoteEditor = (ayah) => {
    const key = noteKey(surahMeta.number, ayah.numberInSurah);
    const existing = notes[key];
    setNoteDraft({ text: existing?.text || '', tags: existing?.tags || [] });
    setOpenNoteFor(ayah.globalNumber);
  };

  const saveNote = (ayah) => {
    const key = noteKey(surahMeta.number, ayah.numberInSurah);
    setNotes((prev) => {
      const next = { ...prev };
      if (!noteDraft.text.trim() && noteDraft.tags.length === 0) {
        delete next[key];
      } else {
        next[key] = {
          text: noteDraft.text.trim(),
          tags: noteDraft.tags,
          surahNumber: surahMeta.number,
          surahName: surahMeta.englishName,
          numberInSurah: ayah.numberInSurah,
        };
      }
      return next;
    });
    setOpenNoteFor(null);
  };

  const deleteNote = (ayah) => {
    const key = noteKey(surahMeta.number, ayah.numberInSurah);
    setNotes((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setOpenNoteFor(null);
  };

  const toggleDraftTag = (tag) => {
    setNoteDraft((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  };

  // Passively record which ayahs have actually been read: whenever an ayah
  // card is more than half visible on screen for a moment, it's logged. This
  // needs no "mark as read" button and naturally follows normal scrolling —
  // playing an ayah's audio also scrolls it into view, so listening counts too.
  useEffect(() => {
    if (!ayahs.length) return;
    const seen = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const gNum = Number(entry.target.dataset.globalNumber);
            if (gNum && !seen.has(gNum)) {
              seen.add(gNum);
              markAyahRead(gNum);
            }
          }
        });
      },
      { threshold: [0.5] }
    );
    Object.values(ayahRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ayahs, markAyahRead]);

  const readingStats = useMemo(() => {
    const visited = readLog.visited || {};
    const totalRead = Object.keys(visited).length;
    const byDate = {};
    Object.values(visited).forEach((date) => {
      byDate[date] = (byDate[date] || 0) + 1;
    });
    let streak = 0;
    let cursor = todayKey();
    while (byDate[cursor] > 0) {
      streak += 1;
      cursor = addDays(cursor, -1).toISOString().slice(0, 10);
    }
    const last7 = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = addDays(todayKey(), -i);
      const key = d.toISOString().slice(0, 10);
      last7.push({ date: key, count: byDate[key] || 0, label: d.toLocaleDateString(undefined, { weekday: 'short' }) });
    }
    return {
      totalRead,
      byDate,
      streak,
      last7,
      percent: Math.min(100, (totalRead / TOTAL_AYAHS) * 100),
    };
  }, [readLog]);

  const khatmahStats = useMemo(() => {
    if (!khatmah) return null;
    const today = todayKey();
    const daysTotal = Math.max(1, Math.round((new Date(khatmah.targetDate) - new Date(khatmah.createdAt)) / 86400000));
    const daysLeft = Math.max(0, Math.ceil((new Date(khatmah.targetDate) - new Date(today)) / 86400000));
    const ayahsRemaining = Math.max(0, TOTAL_AYAHS - readingStats.totalRead);
    const dailyTarget = daysLeft > 0 ? Math.ceil(ayahsRemaining / daysLeft) : ayahsRemaining;
    const daysElapsed = Math.max(0, daysTotal - daysLeft);
    const expectedByNow = khatmah.startCount + ((TOTAL_AYAHS - khatmah.startCount) * daysElapsed) / daysTotal;
    const readToday = readingStats.byDate[today] || 0;
    return {
      daysLeft,
      daysTotal,
      dailyTarget,
      ayahsRemaining,
      readToday,
      onPace: readingStats.totalRead >= expectedByNow,
      behindBy: Math.max(0, Math.round(expectedByNow - readingStats.totalRead)),
      completed: readingStats.totalRead >= TOTAL_AYAHS,
      overdue: daysLeft <= 0 && readingStats.totalRead < TOTAL_AYAHS,
    };
  }, [khatmah, readingStats]);

  // Jump to a specific ayah once its Surah has finished loading (from bookmarks / last read)
  useEffect(() => {
    if (!ayahsLoading && ayahs.length && pendingJumpRef.current) {
      const target = pendingJumpRef.current;
      pendingJumpRef.current = null;
      const idx = ayahs.findIndex((a) => a.numberInSurah === target);
      if (idx >= 0) {
        setTimeout(() => {
          ayahRefs.current[ayahs[idx].globalNumber]?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 150);
      }
    }
  }, [ayahsLoading, ayahs]);

  useEffect(() => {
    if (lastRead) localStorage.setItem(LS_LAST_READ, JSON.stringify(lastRead));
  }, [lastRead]);

  // ---------------- Audio playback ----------------
  useEffect(() => {
    if (currentAyahIdx < 0 || !ayahs[currentAyahIdx] || !audioRef.current) return;
    const ayah = ayahs[currentAyahIdx];

    audioRef.current.src = ayah.audioUrl;
    if (isPlaying) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    }

    if (surahMeta) {
      setLastRead({
        surahNumber: surahMeta.number,
        surahName: surahMeta.englishName,
        numberInSurah: ayah.numberInSurah,
      });
    }

    ayahRefs.current[ayah.globalNumber]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAyahIdx]);

  const handlePlayPause = () => {
    if (currentAyahIdx < 0) {
      if (ayahs.length) {
        setCurrentAyahIdx(0);
        setIsPlaying(true);
      }
      return;
    }
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      audioRef.current?.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const playAyah = (idx) => {
    setCurrentAyahIdx(idx);
    setIsPlaying(true);
  };

  const handleNext = () => {
    if (currentAyahIdx < ayahs.length - 1) {
      setCurrentAyahIdx((i) => i + 1);
      setIsPlaying(true);
    }
  };

  const handlePrev = () => {
    if (currentAyahIdx > 0) {
      setCurrentAyahIdx((i) => i - 1);
      setIsPlaying(true);
    }
  };

  const handleEnded = () => {
    if (currentAyahIdx < ayahs.length - 1) {
      setCurrentAyahIdx((i) => i + 1);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e) => {
    const val = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setProgress(val);
    }
  };

  // ---------------- Bookmarks / copy ----------------
  const toggleBookmark = (ayah) => {
    if (!surahMeta) return;
    const key = `${surahMeta.number}:${ayah.numberInSurah}`;
    setBookmarks((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = {
          surahNumber: surahMeta.number,
          surahName: surahMeta.englishName,
          numberInSurah: ayah.numberInSurah,
          arabic: ayah.arabic,
          translation: ayah.translation,
        };
      }
      return next;
    });
  };

  const copyAyah = (ayah) => {
    if (!surahMeta) return;
    const key = `${surahMeta.number}:${ayah.numberInSurah}`;
    const text = `${ayah.arabic}\n\n${ayah.translation}\n\n— ${surahMeta.englishName} (${surahMeta.number}:${ayah.numberInSurah})`;
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1800);
      })
      .catch(() => {});
  };

  const selectSurah = (num, jumpToAyah) => {
    if (jumpToAyah) pendingJumpRef.current = jumpToAyah;
    setSelectedSurah(num);
    setSection('quran');
    setMobileView('reader');
    setShowBookmarksPanel(false);
  };

  const filteredSurahs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return surahList;
    return surahList.filter(
      (s) =>
        String(s.number).includes(q) ||
        s.englishName?.toLowerCase().includes(q) ||
        s.englishNameTranslation?.toLowerCase().includes(q) ||
        s.name?.includes(query.trim())
    );
  }, [surahList, query]);

  const bookmarkList = useMemo(
    () => Object.entries(bookmarks).map(([key, v]) => ({ key, ...v })),
    [bookmarks]
  );

  const notesList = useMemo(
    () => Object.entries(notes).map(([key, v]) => ({ key, ...v })),
    [notes]
  );

  const [panelTab, setPanelTab] = useState('bookmarks'); // 'bookmarks' | 'notes'

  // ---------------- Theme tokens ----------------
  const t = isDark
    ? {
        appBg: 'bg-slate-950',
        headerBg: 'bg-slate-950/90 border-slate-800',
        sidebarBg: 'bg-slate-900/40 border-slate-800',
        cardBg: 'bg-slate-900/50 border-slate-800 hover:border-emerald-800',
        cardActive: 'border-emerald-600 bg-emerald-950/30 ring-1 ring-emerald-700/40',
        text: 'text-slate-100',
        textMuted: 'text-slate-400',
        textFaint: 'text-slate-500',
        inputBg: 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500',
        accent: 'text-emerald-400',
        accentBg: 'bg-emerald-700 hover:bg-emerald-600',
        divider: 'border-slate-800',
        playerBg: 'bg-slate-950/95 border-slate-800',
        chipMeccan: 'bg-amber-950/40 text-amber-400 border border-amber-900/50',
        chipMedinan: 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50',
        hoverSoft: 'hover:bg-emerald-500/10',
      }
    : {
        appBg: 'bg-stone-50',
        headerBg: 'bg-white/90 border-stone-200',
        sidebarBg: 'bg-white border-stone-200',
        cardBg: 'bg-white border-stone-200 hover:border-emerald-300',
        cardActive: 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-300',
        text: 'text-stone-900',
        textMuted: 'text-stone-500',
        textFaint: 'text-stone-400',
        inputBg: 'bg-stone-100 border-stone-300 text-stone-900 placeholder-stone-400',
        accent: 'text-emerald-700',
        accentBg: 'bg-emerald-700 hover:bg-emerald-800',
        divider: 'border-stone-200',
        playerBg: 'bg-white/95 border-stone-200',
        chipMeccan: 'bg-amber-50 text-amber-700 border border-amber-200',
        chipMedinan: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        hoverSoft: 'hover:bg-emerald-500/10',
      };

  return (
    <div className={`min-h-screen ${t.appBg} ${t.text}`} style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        .font-arabic { font-family: 'Amiri', 'Traditional Arabic', serif; }
        .font-malayalam { font-family: 'Noto Sans Malayalam', sans-serif; }
        input[type="range"] { -webkit-appearance: none; background: transparent; }
        input[type="range"]::-webkit-slider-runnable-track {
          height: 4px; border-radius: 9999px;
          background: ${isDark ? '#1e293b' : '#e7e5e4'};
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; margin-top: -5px;
          width: 14px; height: 14px; border-radius: 9999px; background: #10b981;
          box-shadow: 0 0 0 3px ${isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)'};
        }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${isDark ? '#1e293b' : '#d6d3d1'}; border-radius: 9999px; }
      `}</style>

      {/* ---------------- Header ---------------- */}
      <header className={`sticky top-0 z-30 backdrop-blur border-b ${t.headerBg}`}>
        <div className="flex items-center gap-3 px-3 sm:px-4 py-3 max-w-7xl mx-auto">
          {section === 'quran' && mobileView === 'reader' && (
            <button
              onClick={() => setMobileView('list')}
              className={`md:hidden p-2 -ml-1 rounded-lg ${t.hoverSoft}`}
              aria-label="Back to Surah list"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`w-9 h-9 rounded-lg ${t.accentBg} flex items-center justify-center text-white font-arabic text-lg`}
            >
              ق
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="font-semibold">Al-Qur'an</div>
              <div className={`text-xs ${t.textMuted}`}>Arabic · Malayalam · Transliteration</div>
            </div>
          </div>

          <div className={`flex items-center gap-1 rounded-lg border ${t.divider} p-1 shrink-0`}>
            <button
              onClick={() => setSection('quran')}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition ${
                section === 'quran' ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
              }`}
              title="Qur'an"
            >
              <BookOpen size={14} />
              <span className="hidden sm:inline">Qur'an</span>
            </button>
            <button
              onClick={() => setSection('prayer')}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition ${
                section === 'prayer' ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
              }`}
              title="Prayer"
            >
              <Clock size={14} />
              <span className="hidden sm:inline">Prayer</span>
            </button>
            <button
              onClick={() => setSection('duas')}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition ${
                section === 'duas' ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
              }`}
              title="Duas"
            >
              <Sparkles size={14} />
              <span className="hidden sm:inline">Duas</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowMoreMenu((v) => !v)}
                className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  section === 'progress' || section === 'learn'
                    ? `${t.accentBg} text-white`
                    : `${t.textMuted} ${t.hoverSoft}`
                }`}
                title="More"
                aria-label="More sections"
              >
                <MoreHorizontal size={14} />
              </button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                  <div
                    className={`absolute top-full right-0 mt-2 w-44 rounded-xl border shadow-lg z-50 overflow-hidden ${t.cardBg} ${t.headerBg}`}
                  >
                    <button
                      onClick={() => {
                        setSection('progress');
                        setShowMoreMenu(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left ${t.hoverSoft} ${
                        section === 'progress' ? t.accent : ''
                      }`}
                    >
                      <Target size={15} /> Progress
                    </button>
                    <button
                      onClick={() => {
                        setSection('learn');
                        setShowMoreMenu(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left ${t.hoverSoft} ${
                        section === 'learn' ? t.accent : ''
                      }`}
                    >
                      <GraduationCap size={15} /> Learn
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {section === 'quran' ? (
            <div className="flex-1 relative max-w-md mx-auto">
              <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textFaint}`} />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowBookmarksPanel(false);
                  setMobileView('list');
                }}
                placeholder="Search Surah by name or number…"
                className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-emerald-600/50 ${t.inputBg}`}
              />
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {section === 'quran' && (
            <button
              onClick={() => {
                setShowBookmarksPanel((v) => !(v && panelTab === 'bookmarks'));
                setPanelTab('bookmarks');
                setMobileView('list');
              }}
              className={`relative p-2 rounded-lg border ${t.divider} ${t.hoverSoft}`}
              title="Bookmarks"
              aria-label="Bookmarks"
            >
              <Bookmark size={18} className={showBookmarksPanel && panelTab === 'bookmarks' ? t.accent : ''} />
              {bookmarkList.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-[10px] leading-none bg-emerald-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
                  {bookmarkList.length}
                </span>
              )}
            </button>
          )}

          {section === 'quran' && (
            <button
              onClick={() => {
                setShowBookmarksPanel((v) => !(v && panelTab === 'notes'));
                setPanelTab('notes');
                setMobileView('list');
              }}
              className={`relative p-2 rounded-lg border ${t.divider} ${t.hoverSoft}`}
              title="Notes"
              aria-label="Notes"
            >
              <StickyNote size={18} className={showBookmarksPanel && panelTab === 'notes' ? t.accent : ''} />
              {notesList.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-[10px] leading-none bg-emerald-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
                  {notesList.length}
                </span>
              )}
            </button>
          )}

          <button
            onClick={cycleTheme}
            className={`p-2 rounded-lg border ${t.divider} ${t.hoverSoft} flex items-center gap-1.5`}
            title={
              themeMode === 'auto'
                ? 'Theme: Automatic (follows device time, 6pm–6am is dark) — click for Dark'
                : themeMode === 'dark'
                ? 'Theme: Dark — click for Light'
                : 'Theme: Light — click for Automatic'
            }
            aria-label="Cycle theme: automatic, dark, light"
          >
            {themeMode === 'auto' ? <Clock size={18} /> : isDark ? <Sun size={18} /> : <Moon size={18} />}
            {themeMode === 'auto' && <span className="hidden sm:inline text-[10px] font-medium">AUTO</span>}
          </button>
        </div>
      </header>

      {section === 'quran' ? (
        <>
          <div className="max-w-7xl mx-auto flex">
            {/* ---------------- Sidebar ---------------- */}
            <aside
              className={`w-full md:w-80 lg:w-96 border-r ${t.sidebarBg} shrink-0 ${
                mobileView === 'reader' ? 'hidden md:block' : 'block'
              }`}
            >
              <div className="overflow-y-auto p-3" style={{ maxHeight: 'calc(100vh - 57px)' }}>
                {showBookmarksPanel ? (
                  <>
                    <div className="flex items-center justify-between px-1 pb-3">
                      <div className={`flex items-center gap-1 rounded-lg border ${t.divider} p-1`}>
                        <button
                          onClick={() => setPanelTab('bookmarks')}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                            panelTab === 'bookmarks' ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
                          }`}
                        >
                          Bookmarks
                        </button>
                        <button
                          onClick={() => setPanelTab('notes')}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                            panelTab === 'notes' ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
                          }`}
                        >
                          Notes
                        </button>
                      </div>
                      <button
                        onClick={() => setShowBookmarksPanel(false)}
                        className={`text-xs ${t.textMuted} hover:underline`}
                      >
                        Close
                      </button>
                    </div>
                    {panelTab === 'bookmarks' ? (
                      bookmarkList.length === 0 ? (
                        <p className={`text-sm ${t.textMuted} px-1`}>
                          No bookmarks yet. Tap the bookmark icon on any ayah to save it here.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {bookmarkList.map((b) => (
                            <button
                              key={b.key}
                              onClick={() => selectSurah(b.surahNumber, b.numberInSurah)}
                              className={`w-full text-left p-3 rounded-xl border transition ${t.cardBg}`}
                            >
                              <div className={`text-xs ${t.accent} font-medium mb-1.5`}>
                                {b.surahName} · Ayah {b.numberInSurah}
                              </div>
                              <div className="font-arabic text-right text-lg leading-relaxed truncate" dir="rtl">
                                {b.arabic}
                              </div>
                            </button>
                          ))}
                        </div>
                      )
                    ) : notesList.length === 0 ? (
                      <p className={`text-sm ${t.textMuted} px-1`}>
                        No notes yet. Tap the note icon on any ayah to add a personal reflection or tag.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {notesList.map((n) => (
                          <button
                            key={n.key}
                            onClick={() => selectSurah(n.surahNumber, n.numberInSurah)}
                            className={`w-full text-left p-3 rounded-xl border transition ${t.cardBg}`}
                          >
                            <div className={`text-xs ${t.accent} font-medium mb-1.5`}>
                              {n.surahName} · Ayah {n.numberInSurah}
                            </div>
                            {n.text && <p className="text-sm mb-1.5 line-clamp-2">{n.text}</p>}
                            {n.tags?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {n.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.chipMedinan}`}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {lastRead && (
                      <button
                        onClick={() => selectSurah(lastRead.surahNumber, lastRead.numberInSurah)}
                        className={`w-full text-left p-3 mb-3 rounded-xl border flex items-center gap-3 ${t.cardBg}`}
                      >
                        <div
                          className={`w-9 h-9 rounded-full ${t.accentBg} text-white flex items-center justify-center shrink-0`}
                        >
                          <BookOpen size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium">Continue reading</div>
                          <div className={`text-xs ${t.textMuted} truncate`}>
                            {lastRead.surahName} · Ayah {lastRead.numberInSurah}
                          </div>
                        </div>
                      </button>
                    )}

                    {surahListLoading && (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="animate-spin" size={26} />
                      </div>
                    )}

                    {surahListError && (
                      <div className="text-center py-16 px-4">
                        <AlertCircle className="mx-auto mb-2 text-red-500" size={24} />
                        <p className={`text-sm ${t.textMuted} mb-3`}>{surahListError}</p>
                        <button
                          onClick={fetchSurahList}
                          className={`text-xs px-3 py-1.5 rounded-lg ${t.accentBg} text-white`}
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      {filteredSurahs.map((s) => (
                        <button
                          key={s.number}
                          onClick={() => selectSurah(s.number)}
                          className={`w-full text-left p-3 rounded-xl border transition ${
                            selectedSurah === s.number ? t.cardActive : t.cardBg
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg border ${t.divider} flex items-center justify-center text-xs font-semibold shrink-0 ${t.accent}`}
                            >
                              {s.number}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="font-medium text-sm truncate">{s.englishName}</span>
                                <span className="font-arabic text-lg shrink-0" dir="rtl">
                                  {s.name}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-0.5">
                                <span className={`text-xs ${t.textMuted} truncate`}>
                                  {s.englishNameTranslation}
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                                    s.revelationType === 'Meccan' ? t.chipMeccan : t.chipMedinan
                                  }`}
                                >
                                  {s.revelationType}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                      {!surahListLoading && !surahListError && filteredSurahs.length === 0 && (
                        <p className={`text-sm ${t.textMuted} text-center py-10`}>
                          No Surah matches "{query}".
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </aside>

            {/* ---------------- Main reader ---------------- */}
            <main
              className={`flex-1 min-w-0 ${ayahs.length ? 'pb-28' : ''} ${
                mobileView === 'list' ? 'hidden md:block' : 'block'
              }`}
            >
              <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto">
                {!selectedSurah && (
                  <div className="flex flex-col items-center justify-center text-center py-24">
                    <div
                      className={`w-16 h-16 rounded-2xl ${t.accentBg} text-white flex items-center justify-center font-arabic text-3xl mb-4`}
                    >
                      ق
                    </div>
                    <h2 className="text-xl font-semibold mb-1">Welcome</h2>
                    <p className={`text-sm ${t.textMuted} max-w-sm`}>
                      Select a Surah from the list to begin reading, with Arabic script,
                      transliteration, and Malayalam translation side by side.
                    </p>
                  </div>
                )}

                {selectedSurah && surahMeta && !ayahsLoading && (
                  <div className="mb-8 text-center">
                    <div className={`text-xs uppercase tracking-wide ${t.textMuted} mb-2`}>
                      {surahMeta.revelationType} · {surahMeta.numberOfAyahs} Ayahs
                    </div>
                    <h1 className="font-arabic text-4xl mb-1" dir="rtl">
                      {surahMeta.name}
                    </h1>
                    <div className="text-lg font-semibold">{surahMeta.englishName}</div>
                    <div className={`text-sm ${t.textMuted}`}>{surahMeta.englishNameTranslation}</div>
                  </div>
                )}

                {ayahsLoading && (
                  <div className="flex items-center justify-center py-24">
                    <Loader2 className="animate-spin" size={28} />
                  </div>
                )}

                {ayahsError && (
                  <div className="text-center py-16">
                    <AlertCircle className="mx-auto mb-2 text-red-500" size={24} />
                    <p className={`text-sm ${t.textMuted} mb-3`}>{ayahsError}</p>
                    <button
                      onClick={() => fetchAyahs(selectedSurah)}
                      className={`text-xs px-3 py-1.5 rounded-lg ${t.accentBg} text-white`}
                    >
                      Retry
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  {ayahs.map((ayah, idx) => {
                    const key = surahMeta ? `${surahMeta.number}:${ayah.numberInSurah}` : '';
                    const isBookmarked = !!bookmarks[key];
                    const isActive = idx === currentAyahIdx;
                    const note = notes[key];
                    const isEditingNote = openNoteFor === ayah.globalNumber;
                    return (
                      <div
                        key={ayah.globalNumber}
                        ref={(el) => {
                          ayahRefs.current[ayah.globalNumber] = el;
                        }}
                        data-global-number={ayah.globalNumber}
                        className={`rounded-2xl border p-5 transition ${isActive ? t.cardActive : t.cardBg}`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <button
                            onClick={() => playAyah(idx)}
                            className={`flex items-center gap-2 text-xs font-medium ${t.accent}`}
                            aria-label={`Play ayah ${ayah.numberInSurah}`}
                          >
                            <span
                              className={`w-7 h-7 rounded-full border ${t.divider} flex items-center justify-center text-[11px]`}
                            >
                              {ayah.numberInSurah}
                            </span>
                            {isActive && isPlaying ? <Pause size={14} /> : <Play size={14} />}
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setShareAyah({ ayah, surahMeta })}
                              className={`p-2 rounded-lg ${t.hoverSoft} ${t.textMuted}`}
                              title="Share as image"
                              aria-label="Share ayah as image"
                            >
                              <Share2 size={16} />
                            </button>
                            <button
                              onClick={() => (isEditingNote ? setOpenNoteFor(null) : openNoteEditor(ayah))}
                              className={`p-2 rounded-lg ${t.hoverSoft} ${note ? t.accent : t.textMuted}`}
                              title="Note & tags"
                              aria-label="Add note or tags"
                            >
                              <StickyNote size={16} />
                            </button>
                            <button
                              onClick={() => copyAyah(ayah)}
                              className={`p-2 rounded-lg ${t.hoverSoft} ${t.textMuted}`}
                              title="Copy ayah"
                              aria-label="Copy ayah"
                            >
                              {copiedKey === key ? (
                                <Check size={16} className="text-emerald-500" />
                              ) : (
                                <Copy size={16} />
                              )}
                            </button>
                            <button
                              onClick={() => toggleBookmark(ayah)}
                              className={`p-2 rounded-lg ${t.hoverSoft} ${
                                isBookmarked ? t.accent : t.textMuted
                              }`}
                              title="Bookmark ayah"
                              aria-label="Bookmark ayah"
                            >
                              {isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                            </button>
                          </div>
                        </div>

                        <p
                          className={`font-arabic text-right leading-[2.3] mb-5 ${
                            beginnerMode ? 'text-5xl leading-[2.6]' : 'text-3xl'
                          }`}
                          dir="rtl"
                        >
                          {ayah.arabic}
                        </p>

                        <p
                          className={`italic ${t.textMuted} mb-2 leading-relaxed ${
                            beginnerMode ? 'text-base' : 'text-sm'
                          }`}
                        >
                          {ayah.transliteration}
                        </p>
                        <p
                          className={`font-malayalam leading-relaxed ${t.text} ${
                            beginnerMode ? 'text-lg' : 'text-base'
                          }`}
                        >
                          {ayah.translation}
                        </p>

                        {note && !isEditingNote && (
                          <div className={`mt-4 pt-4 border-t ${t.divider}`}>
                            {note.text && <p className={`text-sm ${t.text} mb-2 whitespace-pre-wrap`}>{note.text}</p>}
                            {note.tags?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {note.tags.map((tag) => (
                                  <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.chipMedinan}`}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {isEditingNote && (
                          <div className={`mt-4 pt-4 border-t ${t.divider}`}>
                            <textarea
                              value={noteDraft.text}
                              onChange={(e) => setNoteDraft((p) => ({ ...p, text: e.target.value }))}
                              placeholder="Your reflection (Tadabbur)…"
                              rows={3}
                              className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-emerald-600/50 resize-none ${t.inputBg}`}
                            />
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {QUICK_TAGS.map((tag) => (
                                <button
                                  key={tag}
                                  onClick={() => toggleDraftTag(tag)}
                                  className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border ${
                                    noteDraft.tags.includes(tag)
                                      ? `${t.accentBg} text-white border-transparent`
                                      : `${t.divider} ${t.textMuted} ${t.hoverSoft}`
                                  }`}
                                >
                                  <Tag size={10} />
                                  {tag}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                              <button
                                onClick={() => saveNote(ayah)}
                                className={`text-xs px-3 py-1.5 rounded-lg ${t.accentBg} text-white`}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setOpenNoteFor(null)}
                                className={`text-xs px-3 py-1.5 rounded-lg border ${t.divider} ${t.hoverSoft}`}
                              >
                                Cancel
                              </button>
                              {note && (
                                <button
                                  onClick={() => deleteNote(ayah)}
                                  className="text-xs px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10 ml-auto"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </main>
          </div>

          {/* ---------------- Sticky audio controller ---------------- */}
          {ayahs.length > 0 && (
            <div className={`fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur ${t.playerBg}`}>
              <div className="max-w-3xl mx-auto px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs ${t.textMuted} w-9 tabular-nums`}>{formatTime(progress)}</span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    value={Math.min(progress, duration || 0)}
                    onChange={handleSeek}
                    className="flex-1 h-1"
                  />
                  <span className={`text-xs ${t.textMuted} w-9 tabular-nums text-right`}>
                    {formatTime(duration)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 relative">
                    <div className="text-sm font-medium truncate">
                      {surahMeta?.englishName}
                      {currentAyahIdx >= 0 ? ` · Ayah ${ayahs[currentAyahIdx]?.numberInSurah}` : ''}
                    </div>
                    <button
                      onClick={() => setShowReciterPicker((v) => !v)}
                      className={`flex items-center gap-1 text-xs ${t.textMuted} truncate hover:underline`}
                    >
                      Reciter:{' '}
                      {reciterList.find((r) => r.identifier === reciter)?.englishName || 'Mishary Rashid Alafasy'}
                      <ChevronDown size={11} className={`shrink-0 transition-transform ${showReciterPicker ? 'rotate-180' : ''}`} />
                    </button>
                    {showReciterPicker && (
                      <div
                        className={`absolute bottom-full left-0 mb-2 w-64 max-h-72 overflow-y-auto rounded-xl border shadow-lg z-50 ${t.cardBg} ${t.headerBg}`}
                      >
                        {reciterListLoading ? (
                          <div className="p-4 flex justify-center">
                            <Loader2 className="animate-spin" size={18} />
                          </div>
                        ) : reciterList.length === 0 ? (
                          <p className={`p-3 text-xs ${t.textMuted}`}>Could not load the reciter list.</p>
                        ) : (
                          reciterList.map((r) => (
                            <button
                              key={r.identifier}
                              onClick={() => {
                                setReciter(r.identifier);
                                setShowReciterPicker(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm ${t.hoverSoft} ${
                                r.identifier === reciter ? `${t.accent} font-medium` : ''
                              }`}
                            >
                              {r.englishName}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={handlePrev}
                      disabled={currentAyahIdx <= 0}
                      className={`p-2 rounded-full disabled:opacity-30 ${t.hoverSoft}`}
                      aria-label="Previous ayah"
                    >
                      <SkipBack size={18} />
                    </button>
                    <button
                      onClick={handlePlayPause}
                      className={`p-3 rounded-full ${t.accentBg} text-white`}
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button
                      onClick={handleNext}
                      disabled={currentAyahIdx >= ayahs.length - 1}
                      className={`p-2 rounded-full disabled:opacity-30 ${t.hoverSoft}`}
                      aria-label="Next ayah"
                    >
                      <SkipForward size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <audio
            ref={audioRef}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleTimeUpdate}
            onEnded={handleEnded}
            className="hidden"
          />
        </>
      ) : section === 'prayer' ? (
        <PrayerSection t={t} isDark={isDark} />
      ) : section === 'duas' ? (
        <DuasSection t={t} isDark={isDark} />
      ) : section === 'progress' ? (
        <ProgressSection
          t={t}
          readingStats={readingStats}
          khatmah={khatmah}
          setKhatmah={setKhatmah}
          khatmahStats={khatmahStats}
          onOpenAyah={(surahNum, ayahNum) => selectSurah(surahNum, ayahNum)}
        />
      ) : (
        <LearnSection t={t} beginnerMode={beginnerMode} setBeginnerMode={setBeginnerMode} />
      )}

      {shareAyah && (
        <VerseCardModal
          ayah={shareAyah.ayah}
          surahMeta={shareAyah.surahMeta}
          isDark={isDark}
          onClose={() => setShareAyah(null)}
        />
      )}
    </div>
  );
}

/* ==================== Prayer (Namaz) section ==================== */

function PrayerSection({ t, isDark }) {
  const [tab, setTab] = useState('timings'); // 'timings' | 'qibla' | 'guide'

  const [location, setLocation] = useState(() => loadJSON(LS_PRAYER_LOCATION, null)); // {lat, lon, label}
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState(null);
  const [cityInput, setCityInput] = useState('');
  const [countryInput, setCountryInput] = useState('');

  const [timings, setTimings] = useState(null);
  const [hijri, setHijri] = useState(null);
  const [timingsLoading, setTimingsLoading] = useState(false);
  const [timingsError, setTimingsError] = useState(null);

  const [compassOn, setCompassOn] = useState(false);
  const [heading, setHeading] = useState(null);
  const [compassSupported, setCompassSupported] = useState(true);

  const [expandedGuide, setExpandedGuide] = useState('wudu'); // 'wudu' | 'salah' | null

  const [remindersOn, setRemindersOn] = useState(() => loadJSON(LS_REMINDERS, false));
  const adhanAudioRef = useRef(null);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (location) localStorage.setItem(LS_PRAYER_LOCATION, JSON.stringify(location));
  }, [location]);

  useEffect(() => {
    localStorage.setItem(LS_REMINDERS, JSON.stringify(remindersOn));
  }, [remindersOn]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const applyTimings = (data) => {
    const raw = data.data.timings;
    const clean = {};
    Object.keys(raw).forEach((k) => {
      clean[k] = String(raw[k]).split(' ')[0];
    });
    setTimings(clean);
    setHijri(data.data.date?.hijri || null);
  };

  const detectLocation = () => {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError('Your browser does not support location detection. Search by city instead.');
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: 'Current location',
        });
        setLocLoading(false);
      },
      (err) => {
        setLocError(err.message || 'Could not detect your location. Search by city instead.');
        setLocLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const searchCity = (e) => {
    e.preventDefault();
    if (!cityInput.trim()) return;
    setLocLoading(true);
    setLocError(null);
    fetch(
      `${ADHAN_API}/timingsByCity?city=${encodeURIComponent(cityInput.trim())}&country=${encodeURIComponent(
        countryInput.trim() || ''
      )}&method=${PRAYER_METHOD}`
    )
      .then((r) => {
        if (!r.ok) throw new Error('City not found. Check the spelling and try again.');
        return r.json();
      })
      .then((data) => {
        setLocation({
          lat: data.data.meta.latitude,
          lon: data.data.meta.longitude,
          label: [cityInput.trim(), countryInput.trim()].filter(Boolean).join(', '),
        });
        applyTimings(data);
      })
      .catch((err) => setLocError(err.message || 'Something went wrong.'))
      .finally(() => setLocLoading(false));
  };

  // Fetch timings whenever the location changes
  useEffect(() => {
    if (!location) return;
    setTimingsLoading(true);
    setTimingsError(null);
    const ts = Math.floor(Date.now() / 1000);
    fetch(`${ADHAN_API}/timings/${ts}?latitude=${location.lat}&longitude=${location.lon}&method=${PRAYER_METHOD}`)
      .then((r) => {
        if (!r.ok) throw new Error('Could not load prayer timings.');
        return r.json();
      })
      .then((data) => applyTimings(data))
      .catch((err) => setTimingsError(err.message || 'Something went wrong.'))
      .finally(() => setTimingsLoading(false));
  }, [location]);

  // Qibla is calculated locally with the standard great-circle bearing formula
  // rather than trusted to the Aladhan API's /qibla endpoint — that endpoint
  // was returning a mirrored bearing for some locations (e.g. India), putting
  // the arrow in the NE quadrant instead of the correct NW one. This formula
  // is verified against known reference bearings (Mumbai 280°, Kuala Lumpur
  // 292.5°, New York 58.5°) so it can be trusted directly.
  const qibla = useMemo(() => {
    if (!location) return null;
    const phi1 = (location.lat * Math.PI) / 180;
    const phi2 = (KAABA.lat * Math.PI) / 180;
    const dLambda = ((KAABA.lon - location.lon) * Math.PI) / 180;
    const y = Math.sin(dLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
    const theta = (Math.atan2(y, x) * 180) / Math.PI;
    return (theta + 360) % 360;
  }, [location]);

  const playAdhanCue = useCallback(() => {
    if (ADHAN_AUDIO_URL && adhanAudioRef.current) {
      adhanAudioRef.current.currentTime = 0;
      adhanAudioRef.current.play().catch(() => playReminderChime());
    } else {
      playReminderChime();
    }
  }, []);

  const toggleReminders = async () => {
    if (!remindersOn && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission().catch(() => {});
    }
    setRemindersOn((v) => !v);
  };

  // Schedule a one-shot alert (sound + system notification, if permitted) for
  // each of today's remaining prayer times whenever timings load or reminders
  // are turned on. Re-runs (and reschedules) if the page is left open past
  // midnight, since `timings` gets refetched for the new day elsewhere.
  useEffect(() => {
    if (!timings || !remindersOn) return;
    const today = new Date();
    const timers = [];
    ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach((key) => {
      const [h, m] = (timings[key] || '').split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return;
      const d = new Date(today);
      d.setHours(h, m, 0, 0);
      const msUntil = d.getTime() - Date.now();
      if (msUntil > 0 && msUntil < 24 * 60 * 60 * 1000) {
        const id = setTimeout(() => {
          playAdhanCue();
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`${key} — time for prayer`, { body: 'It is time for Salah.' });
            } catch {
              // Notification constructor can throw in some contexts (e.g. service-worker-only origins) — ignore.
            }
          }
        }, msUntil);
        timers.push(id);
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [timings, remindersOn, playAdhanCue]);

  // Live device compass.
  // Only trust *true* absolute headings — iOS's webkitCompassHeading, or a
  // deviceorientation(absolute) event with e.absolute === true. A plain
  // deviceorientation event with absolute:false is relative to wherever the
  // phone happened to be pointed when the page loaded, not real north — using
  // it was the main cause of the compass feeling wrong. Readings are also
  // smoothed (shortest-path) to stop the needle jittering.
  useEffect(() => {
    if (!compassOn) return;
    let gotAbsoluteReading = false;
    let smoothed = null;

    const applyHeading = (raw) => {
      const clean = ((raw % 360) + 360) % 360;
      if (smoothed === null) {
        smoothed = clean;
      } else {
        let delta = clean - smoothed;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        smoothed = (smoothed + delta * 0.25 + 360) % 360;
      }
      setHeading(smoothed);
    };

    const handler = (e) => {
      if (typeof e.webkitCompassHeading === 'number') {
        gotAbsoluteReading = true;
        applyHeading(e.webkitCompassHeading);
      } else if (e.absolute === true && typeof e.alpha === 'number') {
        gotAbsoluteReading = true;
        applyHeading(360 - e.alpha);
      }
      // Non-absolute events are ignored entirely — they aren't true compass headings.
    };

    window.addEventListener('deviceorientationabsolute', handler, true);
    window.addEventListener('deviceorientation', handler, true);

    const supportTimer = setTimeout(() => {
      if (!gotAbsoluteReading) setCompassSupported(false);
    }, 2500);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handler, true);
      window.removeEventListener('deviceorientation', handler, true);
      clearTimeout(supportTimer);
    };
  }, [compassOn]);

  const enableCompass = async () => {
    setCompassSupported(true);
    setHeading(null);
    try {
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') {
          setCompassSupported(false);
          return;
        }
      }
      setCompassOn(true);
    } catch {
      setCompassSupported(false);
    }
  };

  const prayerOrder = useMemo(
    () => [
      { key: 'Fajr', label: 'Fajr', arabic: 'الفجر' },
      { key: 'Sunrise', label: 'Sunrise', arabic: 'الشروق', minor: true },
      { key: 'Dhuhr', label: 'Dhuhr', arabic: 'الظهر' },
      { key: 'Asr', label: 'Asr', arabic: 'العصر' },
      { key: 'Maghrib', label: 'Maghrib', arabic: 'المغرب' },
      { key: 'Isha', label: 'Isha', arabic: 'العشاء' },
    ],
    []
  );

  const nextPrayer = useMemo(() => {
    if (!timings) return null;
    const today = new Date();
    const prayerOnly = prayerOrder
      .filter((p) => !p.minor)
      .map((p) => {
        const [h, m] = (timings[p.key] || '00:00').split(':').map(Number);
        const d = new Date(today);
        d.setHours(h, m, 0, 0);
        return { ...p, date: d };
      });
    let next = prayerOnly.find((p) => p.date.getTime() > now);
    let tomorrow = false;
    if (!next) {
      next = { ...prayerOnly[0], date: new Date(prayerOnly[0].date.getTime() + 24 * 60 * 60 * 1000) };
      tomorrow = true;
    }
    const diffMs = next.date.getTime() - now;
    const h = Math.max(0, Math.floor(diffMs / 3600000));
    const m = Math.max(0, Math.floor((diffMs % 3600000) / 60000));
    return { ...next, tomorrow, hoursLeft: h, minutesLeft: m };
  }, [timings, now, prayerOrder]);

  const distanceToKaaba = useMemo(() => {
    if (!location) return null;
    return haversineKm(location.lat, location.lon, KAABA.lat, KAABA.lon);
  }, [location]);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 pb-16">
      {/* Sub-tabs */}
      <div className={`flex items-center gap-1 rounded-xl border ${t.divider} p-1 mb-6 w-fit`}>
        {[
          { key: 'timings', label: 'Timings', icon: Clock },
          { key: 'qibla', label: 'Qibla', icon: Compass },
          { key: 'azan', label: 'Azan', icon: Volume2 },
          { key: 'guide', label: 'How to Pray', icon: Info },
        ].map(({ key, label, icon: Ic }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === key ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
            }`}
          >
            <Ic size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Location control, shared by Timings & Qibla */}
      {tab !== 'guide' && (
        <div className={`rounded-2xl border p-4 mb-6 ${t.cardBg}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin size={16} className={t.accent} />
              <span className="text-sm truncate">
                {location
                  ? location.label || `${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}`
                  : 'No location set'}
              </span>
            </div>
            <button
              onClick={detectLocation}
              disabled={locLoading}
              className={`text-xs px-3 py-1.5 rounded-lg ${t.accentBg} text-white disabled:opacity-60 shrink-0`}
            >
              {locLoading ? 'Detecting…' : 'Use My Location'}
            </button>
          </div>
          <form onSubmit={searchCity} className="flex items-center gap-2 mt-3 flex-wrap">
            <input
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="City"
              className={`flex-1 min-w-[120px] px-3 py-1.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-emerald-600/50 ${t.inputBg}`}
            />
            <input
              value={countryInput}
              onChange={(e) => setCountryInput(e.target.value)}
              placeholder="Country"
              className={`flex-1 min-w-[120px] px-3 py-1.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-emerald-600/50 ${t.inputBg}`}
            />
            <button type="submit" className={`text-xs px-3 py-1.5 rounded-lg border ${t.divider} ${t.hoverSoft}`}>
              Search
            </button>
          </form>
          {locError && <p className="text-xs text-red-500 mt-2">{locError}</p>}
        </div>
      )}

      {/* ---------------- Timings tab ---------------- */}
      {tab === 'timings' && (
        <>
          {!location && !locLoading && (
            <p className={`text-sm ${t.textMuted} text-center py-10`}>
              Set your location above to see today's prayer timings.
            </p>
          )}
          {timingsLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin" size={26} />
            </div>
          )}
          {timingsError && (
            <div className="text-center py-10">
              <AlertCircle className="mx-auto mb-2 text-red-500" size={22} />
              <p className={`text-sm ${t.textMuted}`}>{timingsError}</p>
            </div>
          )}
          {timings && !timingsLoading && (
            <>
              {hijri && (
                <div className={`text-center text-sm ${t.textMuted} mb-4`}>
                  {hijri.day} {hijri.month?.en} {hijri.year} AH
                </div>
              )}
              {nextPrayer && (
                <div className={`rounded-2xl border p-5 mb-4 text-center ${t.cardActive}`}>
                  <div className={`text-xs uppercase tracking-wide ${t.textMuted} mb-1`}>
                    {nextPrayer.tomorrow ? 'Next (tomorrow)' : 'Next prayer'}
                  </div>
                  <div className="text-2xl font-semibold mb-1">{nextPrayer.label}</div>
                  <div className={`text-sm ${t.accent}`}>
                    in {nextPrayer.hoursLeft}h {nextPrayer.minutesLeft}m
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {prayerOrder.map((p) => (
                  <div
                    key={p.key}
                    className={`rounded-xl border p-4 text-center ${
                      nextPrayer && !nextPrayer.tomorrow && nextPrayer.key === p.key ? t.cardActive : t.cardBg
                    }`}
                  >
                    <div className="font-arabic text-lg mb-1" dir="rtl">
                      {p.arabic}
                    </div>
                    <div className={`text-xs ${t.textMuted} mb-1`}>{p.label}</div>
                    <div className="text-lg font-semibold tabular-nums">{to12h(timings[p.key])}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={toggleReminders}
                className={`w-full flex items-center justify-center gap-2 text-sm px-4 py-2.5 rounded-xl border mt-4 ${
                  remindersOn ? `${t.accentBg} text-white border-transparent` : `${t.cardBg}`
                }`}
              >
                {remindersOn ? <Bell size={16} /> : <BellOff size={16} />}
                {remindersOn ? 'Prayer reminders on' : 'Turn on prayer reminders'}
              </button>
              <p className={`text-xs ${t.textMuted} mt-2 text-center`}>
                {remindersOn
                  ? "A chime and (if allowed) a notification will play at each remaining prayer time today, while this page stays open."
                  : "Plays a chime and shows a notification at each prayer time, while this page stays open."}
              </p>
              <p className={`text-xs ${t.textMuted} mt-3 text-center`}>
                Calculated using the ISNA convention. Times may differ slightly from your local mosque's schedule.
              </p>
            </>
          )}
        </>
      )}

      {/* ---------------- Qibla tab ---------------- */}
      {tab === 'qibla' && (
        <>
          {!location && !locLoading && (
            <p className={`text-sm ${t.textMuted} text-center py-10`}>
              Set your location above to find the Qibla direction.
            </p>
          )}
          {qibla != null && (
            <div className="flex flex-col items-center py-4">
              <div className="relative w-64 h-64 mb-6">
                <svg
                  viewBox="0 0 200 200"
                  className="w-full h-full"
                  style={{
                    transform: `rotate(${compassOn && heading != null ? -heading : 0}deg)`,
                    transition: 'transform 0.2s linear',
                  }}
                >
                  <circle cx="100" cy="100" r="95" fill="none" stroke={isDark ? '#1e293b' : '#e7e5e4'} strokeWidth="2" />
                  <text x="100" y="20" textAnchor="middle" fontSize="14" fill={isDark ? '#64748b' : '#78716c'}>
                    N
                  </text>
                  <text x="100" y="190" textAnchor="middle" fontSize="14" fill={isDark ? '#64748b' : '#78716c'}>
                    S
                  </text>
                  <text x="15" y="105" textAnchor="middle" fontSize="14" fill={isDark ? '#64748b' : '#78716c'}>
                    W
                  </text>
                  <text x="185" y="105" textAnchor="middle" fontSize="14" fill={isDark ? '#64748b' : '#78716c'}>
                    E
                  </text>
                  <g style={{ transform: `rotate(${qibla}deg)`, transformOrigin: '100px 100px' }}>
                    <line x1="100" y1="100" x2="100" y2="25" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
                    <polygon points="100,15 92,32 108,32" fill="#10b981" />
                  </g>
                  <circle cx="100" cy="100" r="5" fill={isDark ? '#e2e8f0' : '#1c1917'} />
                </svg>
              </div>
              <div className="text-center mb-4">
                <div className="text-2xl font-semibold mb-1">{Math.round(qibla)}° from North</div>
                {distanceToKaaba && (
                  <div className={`text-sm ${t.textMuted}`}>
                    ~{Math.round(distanceToKaaba).toLocaleString()} km to the Kaaba
                  </div>
                )}
              </div>
              {!compassOn ? (
                <button onClick={enableCompass} className={`text-sm px-4 py-2 rounded-lg ${t.accentBg} text-white`}>
                  Enable Live Compass
                </button>
              ) : (
                <p className={`text-xs ${t.textMuted} text-center max-w-xs`}>
                  Hold your phone flat, away from metal or magnets. The green arrow points toward the Qibla as
                  you turn. If it feels off, wave your phone in a figure-8 a few times to recalibrate the
                  magnetometer.
                </p>
              )}
              {!compassSupported && (
                <p className="text-xs text-red-500 mt-2 text-center max-w-xs">
                  Live compass isn't available on this device or browser (it needs a magnetometer, HTTPS, and
                  permission). Point the top of your screen North and use the number above instead.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ---------------- Azan tab ---------------- */}
      {tab === 'azan' && (
        <div className="space-y-4">
          <div className={`rounded-2xl border p-4 ${t.cardBg}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Volume2 size={16} className={t.accent} />
                <span className="text-sm">Play</span>
              </div>
              <button
                onClick={() => playAdhanCue()}
                className={`text-xs px-4 py-2 rounded-lg ${t.accentBg} text-white`}
              >
                {ADHAN_AUDIO_URL ? 'Play Azan' : 'Play reminder chime'}
              </button>
            </div>
            {!ADHAN_AUDIO_URL && (
              <p className={`text-xs ${t.textMuted} mt-2 leading-relaxed`}>
                There's no well-documented free public API for Adhan <em>audio</em> the way there is for Quran
                recitation, so no recording is bundled here — this plays a short generated chime instead. If you
                have an Adhan recording you're licensed to use, set <code>ADHAN_AUDIO_URL</code> near the top of
                this file (e.g. to <code>/adhan.mp3</code> after adding the file to your project's{' '}
                <code>public/</code> folder) and this button — plus prayer-time reminders — will play it instead.
              </p>
            )}
          </div>

          <div className={`rounded-2xl border ${t.cardBg} p-4`}>
            <h3 className="text-sm font-semibold mb-3">The Call to Prayer (Azan)</h3>
            <div className="space-y-3">
              {AZAN_LINES.map((line, i) => (
                <div key={i} className={`pb-3 ${i < AZAN_LINES.length - 1 ? `border-b ${t.divider}` : ''}`}>
                  <p className="font-arabic text-xl leading-relaxed mb-1" dir="rtl">
                    {line.arabic}
                    {line.repeat > 1 && <span className={`text-sm font-sans ${t.textMuted}`}> (×{line.repeat})</span>}
                  </p>
                  <p className={`text-sm italic ${t.textMuted} mb-1`}>{line.translit}</p>
                  <p className="text-sm">{line.translation}</p>
                  {line.note && <p className={`text-xs ${t.textMuted} mt-1`}>{line.note}</p>}
                </div>
              ))}
            </div>
          </div>

          {ADHAN_AUDIO_URL && <audio ref={adhanAudioRef} src={ADHAN_AUDIO_URL} preload="none" className="hidden" />}
        </div>
      )}

      {/* ---------------- Guide tab ---------------- */}
      {tab === 'guide' && (
        <div className="space-y-4">
          <p className={`text-xs ${t.textMuted} leading-relaxed`}>
            This is a general guide to Wudu (ablution) and Salah (the ritual prayer) following common practice.
            Small details, such as exact hand placement or additional recitations, vary between schools of
            thought (madhabs) — check with a local scholar or imam for guidance specific to your tradition.
          </p>

          <div className={`rounded-2xl border ${t.cardBg} overflow-hidden`}>
            <button
              onClick={() => setExpandedGuide((v) => (v === 'wudu' ? null : 'wudu'))}
              className="w-full flex items-center justify-between p-4"
            >
              <span className="flex items-center gap-2 font-semibold text-sm">
                <Droplets size={16} className={t.accent} />
                Wudu (Ablution)
              </span>
              <ChevronDown size={16} className={`transition-transform ${expandedGuide === 'wudu' ? 'rotate-180' : ''}`} />
            </button>
            {expandedGuide === 'wudu' && (
              <div className={`px-4 pb-4 space-y-3 border-t ${t.divider}`}>
                {WUDU_STEPS.map((s, i) => (
                  <div key={i} className="pt-3 flex gap-3">
                    <div
                      className={`w-6 h-6 rounded-full border ${t.divider} flex items-center justify-center text-[11px] shrink-0 ${t.accent}`}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{s.title}</div>
                      {s.arabic && (
                        <div className="font-arabic text-base mt-0.5" dir="rtl">
                          {s.arabic} <span className={`font-sans text-xs ${t.textMuted}`}>— {s.translit}</span>
                        </div>
                      )}
                      <p className={`text-xs ${t.textMuted} mt-0.5 leading-relaxed`}>{s.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`rounded-2xl border ${t.cardBg} overflow-hidden`}>
            <button
              onClick={() => setExpandedGuide((v) => (v === 'salah' ? null : 'salah'))}
              className="w-full flex items-center justify-between p-4"
            >
              <span className="flex items-center gap-2 font-semibold text-sm">
                <BookOpen size={16} className={t.accent} />
                Salah (The Prayer)
              </span>
              <ChevronDown size={16} className={`transition-transform ${expandedGuide === 'salah' ? 'rotate-180' : ''}`} />
            </button>
            {expandedGuide === 'salah' && (
              <div className={`px-4 pb-4 space-y-4 border-t ${t.divider}`}>
                {SALAH_STEPS.map((s, i) => (
                  <div key={i} className="pt-3">
                    <div className="text-sm font-semibold mb-1">{s.title}</div>
                    {s.arabic && (
                      <p className="font-arabic text-xl leading-relaxed mb-1" dir="rtl">
                        {s.arabic}
                      </p>
                    )}
                    {s.translit && <p className={`text-sm italic ${t.textMuted} mb-1`}>{s.translit}</p>}
                    {s.translation && <p className="text-sm mb-1">{s.translation}</p>}
                    {s.note && <p className={`text-xs ${t.textMuted} leading-relaxed`}>{s.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== Progress: Khatmah planner & habit dashboard ==================== */

const KHATMAH_PRESETS = [
  { label: 'Ramadan (30 days)', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
];

function ProgressSection({ t, readingStats, khatmah, setKhatmah, khatmahStats, onOpenAyah }) {
  const [customDate, setCustomDate] = useState('');
  const [dismissedWidgetNote, setDismissedWidgetNote] = useState(false);

  const [ayahOfDay, setAyahOfDay] = useState(null);
  const [ayahOfDayLoading, setAyahOfDayLoading] = useState(true);
  const [ayahOfDayError, setAyahOfDayError] = useState(null);

  // Deterministic pick: same ayah all day for everyone, changes daily.
  useEffect(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    const globalNumber = (dayOfYear % TOTAL_AYAHS) + 1;
    setAyahOfDayLoading(true);
    setAyahOfDayError(null);
    fetch(`${API_BASE}/ayah/${globalNumber}/editions/${TEXT_EDITIONS}`)
      .then((r) => {
        if (!r.ok) throw new Error("Could not load today's Ayah.");
        return r.json();
      })
      .then((data) => {
        const [arabicEd, malayalamEd, translitEd] = data.data;
        setAyahOfDay({
          arabic: arabicEd.text,
          translation: malayalamEd.text,
          transliteration: translitEd.text,
          surahName: arabicEd.surah.englishName,
          surahNumber: arabicEd.surah.number,
          numberInSurah: arabicEd.numberInSurah,
        });
      })
      .catch((err) => setAyahOfDayError(err.message || 'Something went wrong.'))
      .finally(() => setAyahOfDayLoading(false));
  }, []);

  const startPlan = (days) => {
    const created = todayKey();
    const target = addDays(created, days).toISOString().slice(0, 10);
    setKhatmah({ createdAt: created, targetDate: target, startCount: readingStats.totalRead });
  };

  const startCustomPlan = (e) => {
    e.preventDefault();
    if (!customDate) return;
    setKhatmah({ createdAt: todayKey(), targetDate: customDate, startCount: readingStats.totalRead });
  };

  const maxWeekCount = Math.max(1, ...readingStats.last7.map((d) => d.count));

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 pb-16 space-y-5">
      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-2xl border p-4 text-center ${t.cardBg}`}>
          <div className={`text-2xl font-semibold ${t.accent}`}>{readingStats.streak}</div>
          <div className={`text-xs ${t.textMuted} flex items-center justify-center gap-1 mt-1`}>
            <Flame size={12} /> Day streak
          </div>
        </div>
        <div className={`rounded-2xl border p-4 text-center ${t.cardBg}`}>
          <div className="text-2xl font-semibold">{readingStats.totalRead.toLocaleString()}</div>
          <div className={`text-xs ${t.textMuted} mt-1`}>Ayahs read</div>
        </div>
        <div className={`rounded-2xl border p-4 text-center ${t.cardBg}`}>
          <div className="text-2xl font-semibold">{readingStats.percent.toFixed(1)}%</div>
          <div className={`text-xs ${t.textMuted} mt-1`}>of the Qur'an</div>
        </div>
      </div>

      {/* Weekly activity chart */}
      <div className={`rounded-2xl border p-4 ${t.cardBg}`}>
        <h3 className="text-sm font-semibold mb-3">This week</h3>
        <div className="flex items-end justify-between gap-2 h-28">
          {readingStats.last7.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex-1 flex items-end">
                <div
                  className={`w-full rounded-t-md ${d.count > 0 ? t.accentBg : `${t.divider} border`}`}
                  style={{ height: `${Math.max(4, (d.count / maxWeekCount) * 100)}%` }}
                  title={`${d.count} ayahs`}
                />
              </div>
              <span className={`text-[10px] ${t.textMuted}`}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Khatmah planner */}
      <div className={`rounded-2xl border p-4 ${t.cardBg}`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Target size={16} className={t.accent} />
          Khatmah Planner
        </h3>

        {!khatmah ? (
          <>
            <p className={`text-xs ${t.textMuted} mb-3 leading-relaxed`}>
              Set a target completion date and get a daily reading target calculated automatically from where
              you already are in the Qur'an.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {KHATMAH_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => startPlan(p.days)}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${t.divider} ${t.hoverSoft}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <form onSubmit={startCustomPlan} className="flex items-center gap-2">
              <input
                type="date"
                value={customDate}
                min={todayKey()}
                onChange={(e) => setCustomDate(e.target.value)}
                className={`flex-1 px-3 py-1.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-emerald-600/50 ${t.inputBg}`}
              />
              <button type="submit" className={`text-xs px-3 py-1.5 rounded-lg ${t.accentBg} text-white shrink-0`}>
                Set custom date
              </button>
            </form>
          </>
        ) : (
          <>
            {khatmahStats.completed ? (
              <div className="text-center py-4">
                <div className="text-3xl mb-2">🎉</div>
                <div className="text-lg font-semibold mb-1">Khatmah complete!</div>
                <p className={`text-sm ${t.textMuted} mb-3`}>
                  You've read every ayah in the Qur'an at least once. May it be accepted.
                </p>
                <button
                  onClick={() => setKhatmah(null)}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${t.divider} ${t.hoverSoft}`}
                >
                  Start a new plan
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className={t.textMuted}>
                    Target: {new Date(khatmah.targetDate).toLocaleDateString()}
                  </span>
                  <span className={t.textMuted}>{khatmahStats.daysLeft} days left</span>
                </div>
                <div className={`w-full h-2 rounded-full ${t.divider} border mb-3 overflow-hidden`}>
                  <div
                    className={`h-full ${t.accentBg}`}
                    style={{ width: `${Math.min(100, readingStats.percent)}%` }}
                  />
                </div>
                <div
                  className={`rounded-xl border p-3 mb-3 text-center ${
                    khatmahStats.overdue ? 'border-red-500/40 bg-red-500/10' : t.cardActive
                  }`}
                >
                  {khatmahStats.overdue ? (
                    <p className="text-sm">
                      Target date has passed with {khatmahStats.ayahsRemaining.toLocaleString()} ayahs left. You
                      can set a new target date below.
                    </p>
                  ) : (
                    <>
                      <div className="text-xl font-semibold mb-0.5">{khatmahStats.dailyTarget} ayahs / day</div>
                      <div className={`text-xs ${t.textMuted}`}>
                        {khatmahStats.readToday} read today ·{' '}
                        {khatmahStats.onPace
                          ? 'on pace 🎯'
                          : `${khatmahStats.behindBy} behind pace`}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setKhatmah(null)}
                  className={`w-full text-xs px-3 py-1.5 rounded-lg border ${t.divider} ${t.hoverSoft}`}
                >
                  Cancel plan
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Ayah of the Day */}
      <div className={`rounded-2xl border p-4 ${t.cardBg}`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Sparkles size={16} className={t.accent} />
          Ayah of the Day
        </h3>
        {ayahOfDayLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin" size={22} />
          </div>
        )}
        {ayahOfDayError && <p className={`text-sm ${t.textMuted}`}>{ayahOfDayError}</p>}
        {ayahOfDay && !ayahOfDayLoading && (
          <>
            <p className="font-arabic text-right text-2xl leading-relaxed mb-3" dir="rtl">
              {ayahOfDay.arabic}
            </p>
            <p className={`text-sm italic ${t.textMuted} mb-2`}>{ayahOfDay.transliteration}</p>
            <p className="font-malayalam text-base mb-3">{ayahOfDay.translation}</p>
            <div className="flex items-center justify-between">
              <span className={`text-xs ${t.textMuted}`}>
                {ayahOfDay.surahName} · {ayahOfDay.surahNumber}:{ayahOfDay.numberInSurah}
              </span>
              <button
                onClick={() => onOpenAyah(ayahOfDay.surahNumber, ayahOfDay.numberInSurah)}
                className={`text-xs px-3 py-1.5 rounded-lg border ${t.divider} ${t.hoverSoft}`}
              >
                Read in context
              </button>
            </div>
          </>
        )}
      </div>

      {/* Home-screen note (honest about what's and isn't possible) */}
      {!dismissedWidgetNote && (
        <div className={`rounded-2xl border p-4 ${t.cardBg} relative`}>
          <button
            onClick={() => setDismissedWidgetNote(true)}
            className={`absolute top-3 right-3 p-1 rounded ${t.hoverSoft} ${t.textMuted}`}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
          <h3 className="flex items-center gap-2 text-sm font-semibold mb-2 pr-6">
            <Smartphone size={16} className={t.accent} />
            About home screen widgets
          </h3>
          <p className={`text-xs ${t.textMuted} leading-relaxed`}>
            A live, interactive OS widget (the kind that sits on your home screen showing the Ayah of the Day
            or a prayer countdown without opening the app) needs native code — iOS WidgetKit or an Android App
            Widget — which is a separate project from this web app. What this page <em>can</em> do: from your
            phone's browser menu, choose "Add to Home Screen" to get an app icon that opens straight to this
            dashboard — the Ayah of the Day and next-prayer countdown are both one tap away from there.
          </p>
        </div>
      )}
    </div>
  );
}

/* ==================== Verse Card export (canvas-based image generator) ==================== */

const CARD_THEMES = [
  { name: 'Emerald Night', bg: ['#022c22', '#064e3b'], text: '#f8fafc', muted: '#a7f3d0', accent: '#34d399' },
  { name: 'Parchment Gold', bg: ['#fdf6e3', '#f3e2b8'], text: '#3b2f1e', muted: '#7a6a4a', accent: '#92400e' },
  { name: 'Midnight Blue', bg: ['#0c1a3d', '#1e3a8a'], text: '#f8fafc', muted: '#c7d7fb', accent: '#93c5fd' },
];

function wrapTextGeneric(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function fitText(ctx, text, fontFamily, weight, maxWidth, maxHeight, startSize, minSize, lineHeightRatio = 1.4) {
  let size = startSize;
  let lines = [text];
  let lineHeight = size * lineHeightRatio;
  while (size >= minSize) {
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    lines = wrapTextGeneric(ctx, text, maxWidth);
    lineHeight = size * lineHeightRatio;
    if (lines.length * lineHeight <= maxHeight) break;
    size -= 2;
  }
  return { size, lines, lineHeight };
}

function VerseCardModal({ ayah, surahMeta, onClose }) {
  const [template, setTemplate] = useState('square'); // 'square' | 'story'
  const [themeIdx, setThemeIdx] = useState(0);
  const canvasRef = useRef(null);
  const shareSupported = typeof navigator !== 'undefined' && !!navigator.share;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = 1080;
    const h = template === 'square' ? 1080 : 1920;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const theme = CARD_THEMES[themeIdx];

    const draw = () => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, theme.bg[0]);
      grad.addColorStop(1, theme.bg[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = theme.accent;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9);
      ctx.globalAlpha = 1;

      const pad = w * 0.12;
      const maxWidth = w - pad * 2;
      let y = h * 0.16;

      ctx.font = `600 ${w * 0.026}px Inter, sans-serif`;
      ctx.fillStyle = theme.muted;
      ctx.textAlign = 'center';
      ctx.direction = 'ltr';
      ctx.fillText(`${surahMeta.englishName} · ${surahMeta.number}:${ayah.numberInSurah}`, w / 2, y);
      y += h * 0.06;

      const arabicFit = fitText(ctx, ayah.arabic, 'Amiri, serif', '700', maxWidth, h * 0.36, w * 0.075, w * 0.032, 1.55);
      ctx.font = `700 ${arabicFit.size}px Amiri, serif`;
      ctx.fillStyle = theme.text;
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      arabicFit.lines.forEach((line) => {
        y += arabicFit.lineHeight;
        ctx.fillText(line, w / 2, y);
      });
      y += h * 0.05;

      const translitFit = fitText(
        ctx,
        ayah.transliteration,
        'Inter, sans-serif',
        '400 italic',
        maxWidth,
        h * 0.09,
        w * 0.028,
        w * 0.018,
        1.4
      );
      ctx.font = `italic 400 ${translitFit.size}px Inter, sans-serif`;
      ctx.fillStyle = theme.muted;
      ctx.direction = 'ltr';
      translitFit.lines.forEach((line) => {
        y += translitFit.lineHeight;
        ctx.fillText(line, w / 2, y);
      });
      y += h * 0.04;

      const translationFit = fitText(
        ctx,
        ayah.translation,
        '"Noto Sans Malayalam", sans-serif',
        '500',
        maxWidth,
        h * 0.16,
        w * 0.032,
        w * 0.02,
        1.5
      );
      ctx.font = `500 ${translationFit.size}px "Noto Sans Malayalam", sans-serif`;
      ctx.fillStyle = theme.text;
      translationFit.lines.forEach((line) => {
        y += translationFit.lineHeight;
        ctx.fillText(line, w / 2, y);
      });

      ctx.font = `600 ${w * 0.024}px Inter, sans-serif`;
      ctx.fillStyle = theme.accent;
      ctx.fillText("☾ Al-Qur'an", w / 2, h * 0.94);
    };

    if (document.fonts) {
      Promise.all([
        document.fonts.load('700 64px Amiri'),
        document.fonts.load('500 32px "Noto Sans Malayalam"'),
        document.fonts.load('600 24px Inter'),
      ])
        .catch(() => {})
        .then(() => document.fonts.ready)
        .then(draw)
        .catch(draw);
    } else {
      draw();
    }
  }, [template, themeIdx, ayah, surahMeta]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${surahMeta.englishName}-${ayah.numberInSurah}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const handleShare = () => {
    const canvas = canvasRef.current;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `${surahMeta.englishName}-${ayah.numberInSurah}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${surahMeta.englishName} ${ayah.numberInSurah}` });
        } catch {
          // user cancelled the share sheet
        }
      }
    }, 'image/png');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="flex flex-col md:flex-row gap-4 max-w-3xl w-full max-h-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex-1 flex items-center justify-center min-h-0">
          <canvas
            ref={canvasRef}
            className="rounded-xl shadow-2xl max-h-[70vh] md:max-h-[80vh] w-auto"
            style={{ aspectRatio: template === 'square' ? '1 / 1' : '9 / 16' }}
          />
        </div>
        <div className="w-full md:w-64 bg-slate-900 rounded-xl p-4 text-white space-y-4 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Share as Image</h3>
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-800" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1.5">Format</div>
            <div className="flex gap-2">
              <button
                onClick={() => setTemplate('square')}
                className={`flex-1 text-xs px-3 py-2 rounded-lg border ${
                  template === 'square' ? 'bg-emerald-700 border-transparent' : 'border-slate-700 hover:bg-slate-800'
                }`}
              >
                Square
              </button>
              <button
                onClick={() => setTemplate('story')}
                className={`flex-1 text-xs px-3 py-2 rounded-lg border ${
                  template === 'story' ? 'bg-emerald-700 border-transparent' : 'border-slate-700 hover:bg-slate-800'
                }`}
              >
                Story
              </button>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1.5">Theme</div>
            <div className="flex gap-2">
              {CARD_THEMES.map((th, i) => (
                <button
                  key={th.name}
                  onClick={() => setThemeIdx(i)}
                  title={th.name}
                  style={{ background: `linear-gradient(135deg, ${th.bg[0]}, ${th.bg[1]})` }}
                  className={`w-9 h-9 rounded-full border-2 ${themeIdx === i ? 'border-white' : 'border-transparent'}`}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 text-sm px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600"
            >
              <Download size={16} /> Download PNG
            </button>
            {shareSupported && (
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 text-sm px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-800"
              >
                <Share2 size={16} /> Share
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==================== Learn: alphabet, harakat, and a practice quiz ==================== */

function buildQuizQuestion(pool, prevPrompt) {
  let item;
  do {
    item = pool[Math.floor(Math.random() * pool.length)];
  } while (pool.length > 1 && item.prompt === prevPrompt);
  const distractors = pool
    .filter((p) => p.answer !== item.answer)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((p) => p.answer);
  const options = [...distractors, item.answer].sort(() => Math.random() - 0.5);
  return { prompt: item.prompt, answer: item.answer, options };
}

function LearnSection({ t, beginnerMode, setBeginnerMode }) {
  const [tab, setTab] = useState('alphabet'); // 'alphabet' | 'harakat' | 'quiz'
  const [quizPool, setQuizPool] = useState('letters'); // 'letters' | 'harakat'
  const [question, setQuestion] = useState(() =>
    buildQuizQuestion(ARABIC_ALPHABET.map((l) => ({ prompt: l.letter, answer: l.translit })))
  );
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const pool = useMemo(
    () =>
      quizPool === 'letters'
        ? ARABIC_ALPHABET.map((l) => ({ prompt: l.letter, answer: l.translit }))
        : HARAKAT.map((h) => ({ prompt: h.mark, answer: h.translit })),
    [quizPool]
  );

  const nextQuestion = useCallback(() => {
    setQuestion((prev) => buildQuizQuestion(pool, prev.prompt));
    setSelected(null);
  }, [pool]);

  useEffect(() => {
    nextQuestion();
    setScore({ correct: 0, total: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizPool]);

  const answer = (opt) => {
    if (selected) return;
    setSelected(opt);
    setScore((s) => ({ correct: s.correct + (opt === question.answer ? 1 : 0), total: s.total + 1 }));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 pb-16 space-y-5">
      <div className={`rounded-2xl border p-4 flex items-center justify-between gap-3 ${t.cardBg}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Type size={16} className={`${t.accent} shrink-0`} />
          <div className="min-w-0">
            <div className="text-sm font-medium">Beginner Mode</div>
            <div className={`text-xs ${t.textMuted} truncate`}>Larger Arabic text throughout the Qur'an reader</div>
          </div>
        </div>
        <button
          onClick={() => setBeginnerMode((v) => !v)}
          className={`relative w-11 h-6 rounded-full transition shrink-0 ${beginnerMode ? t.accentBg : t.divider + ' border'}`}
          aria-label="Toggle beginner mode"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              beginnerMode ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      <div className={`flex items-center gap-1 rounded-xl border ${t.divider} p-1 w-fit`}>
        {[
          { key: 'alphabet', label: 'Alphabet' },
          { key: 'harakat', label: 'Vowel Marks' },
          { key: 'quiz', label: 'Quiz' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setTab(s.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === s.key ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {tab === 'alphabet' && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {ARABIC_ALPHABET.map((l) => (
            <div key={l.letter} className={`rounded-2xl border p-4 text-center ${t.cardBg}`}>
              <div className="font-arabic text-4xl mb-2" dir="rtl">
                {l.letter}
              </div>
              <div className="text-sm font-medium">{l.name}</div>
              <div className={`text-xs ${t.textMuted}`}>{l.translit}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'harakat' && (
        <div className="space-y-2">
          <p className={`text-xs ${t.textMuted} leading-relaxed mb-2`}>
            Harakat are the small marks placed above or below a letter that show its short vowel sound — essential
            for reading the Qur'an correctly. Shown here on the letter ب (Ba) as an example.
          </p>
          {HARAKAT.map((h) => (
            <div key={h.name} className={`rounded-xl border p-3 flex items-center gap-4 ${t.cardBg}`}>
              <div className="font-arabic text-3xl w-14 text-center shrink-0" dir="rtl">
                {h.mark}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {h.name} <span className={`text-xs ${t.textMuted}`}>({h.translit})</span>
                </div>
                <div className={`text-xs ${t.textMuted}`}>{h.sound}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'quiz' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className={`flex items-center gap-1 rounded-lg border ${t.divider} p-1`}>
              <button
                onClick={() => setQuizPool('letters')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  quizPool === 'letters' ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
                }`}
              >
                Letters
              </button>
              <button
                onClick={() => setQuizPool('harakat')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  quizPool === 'harakat' ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
                }`}
              >
                Vowel Marks
              </button>
            </div>
            <div className={`text-xs ${t.textMuted}`}>
              Score: {score.correct}/{score.total}
            </div>
          </div>

          <div className={`rounded-2xl border p-8 text-center ${t.cardBg}`}>
            <div className={`text-xs ${t.textMuted} mb-3`}>What is the transliteration of:</div>
            <div className="font-arabic text-6xl mb-2" dir="rtl">
              {question.prompt}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {question.options.map((opt) => {
              const isCorrect = opt === question.answer;
              const isPicked = opt === selected;
              let style = t.cardBg;
              if (selected) {
                if (isCorrect) style = 'border-emerald-500 bg-emerald-500/10';
                else if (isPicked) style = 'border-red-500 bg-red-500/10';
              }
              return (
                <button
                  key={opt}
                  onClick={() => answer(opt)}
                  disabled={!!selected}
                  className={`rounded-xl border p-4 text-lg font-medium transition ${style}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {selected && (
            <button onClick={nextQuestion} className={`w-full text-sm px-4 py-2.5 rounded-xl ${t.accentBg} text-white`}>
              Next question
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ==================== Duas: everyday occasion-based supplications ==================== */

// Full literal Tailwind class strings per category color — constructing these
// dynamically (e.g. `bg-${color}-950/40`) would prevent Tailwind's JIT
// scanner from finding and including them in the build, so each is spelled
// out explicitly here instead.
const DUA_COLOR_STYLES = {
  sky: {
    dark: 'bg-sky-950/40 text-sky-400 border border-sky-900/50',
    light: 'bg-sky-50 text-sky-700 border border-sky-200',
  },
  indigo: {
    dark: 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/50',
    light: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  },
  amber: {
    dark: 'bg-amber-950/40 text-amber-400 border border-amber-900/50',
    light: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  cyan: {
    dark: 'bg-cyan-950/40 text-cyan-400 border border-cyan-900/50',
    light: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  },
  rose: {
    dark: 'bg-rose-950/40 text-rose-400 border border-rose-900/50',
    light: 'bg-rose-50 text-rose-700 border border-rose-200',
  },
  emerald: {
    dark: 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50',
    light: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
};

function DuasSection({ t, isDark }) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [favorites, setFavorites] = useState(() => loadJSON(LS_DUA_FAVORITES, {}));

  useEffect(() => {
    localStorage.setItem(LS_DUA_FAVORITES, JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const copyDua = (dua) => {
    const text = `${dua.arabic}\n\n${dua.translation}\n\n— ${dua.title}`;
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopiedId(dua.id);
        setTimeout(() => setCopiedId((id) => (id === dua.id ? null : id)), 1800);
      })
      .catch(() => {});
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DUAS.filter((d) => {
      if (showFavoritesOnly && !favorites[d.id]) return false;
      if (activeCategory !== 'all' && d.category !== activeCategory) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.occasion.toLowerCase().includes(q) ||
        d.translation.toLowerCase().includes(q)
      );
    });
  }, [query, activeCategory, showFavoritesOnly, favorites]);

  const favoriteCount = Object.keys(favorites).length;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 pb-16">
      <div className="text-center mb-6">
        <h1 className="text-xl font-semibold mb-1">Everyday Duas</h1>
        <p className={`text-sm ${t.textMuted} max-w-md mx-auto`}>
          Short supplications for daily moments — entering the home, before sleep, setting off on a journey, and
          more.
        </p>
      </div>

      <div className="relative mb-4">
        <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textFaint}`} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by occasion or keyword…"
          className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-600/50 ${t.inputBg}`}
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
        <button
          onClick={() => setActiveCategory('all')}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
            activeCategory === 'all' ? `${t.accentBg} text-white border-transparent` : `${t.divider} ${t.textMuted} ${t.hoverSoft}`
          }`}
        >
          All
        </button>
        {DUA_CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              onClick={() => setActiveCategory(c.key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                activeCategory === c.key
                  ? `${t.accentBg} text-white border-transparent`
                  : `${t.divider} ${t.textMuted} ${t.hoverSoft}`
              }`}
            >
              <Icon size={12} />
              {c.label}
            </button>
          );
        })}
        <button
          onClick={() => setShowFavoritesOnly((v) => !v)}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
            showFavoritesOnly ? 'bg-amber-500 text-white border-transparent' : `${t.divider} ${t.textMuted} ${t.hoverSoft}`
          }`}
        >
          <Star size={12} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
          Favorites{favoriteCount > 0 ? ` (${favoriteCount})` : ''}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className={`text-sm ${t.textMuted}`}>
            {showFavoritesOnly
              ? "You haven't starred any duas yet — tap the star on one to save it here."
              : 'No duas match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((dua) => {
            const cat = DUA_CATEGORIES.find((c) => c.key === dua.category);
            const Icon = cat.icon;
            const isOpen = expanded === dua.id;
            const isFav = !!favorites[dua.id];
            const badgeClass = DUA_COLOR_STYLES[cat.color][isDark ? 'dark' : 'light'];
            return (
              <div key={dua.id} className={`rounded-2xl border overflow-hidden transition ${t.cardBg}`}>
                <button
                  onClick={() => setExpanded((v) => (v === dua.id ? null : dua.id))}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${badgeClass}`}>
                    <Icon size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{dua.title}</div>
                    <div className={`text-xs ${t.textMuted} truncate`}>{dua.occasion}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(dua.id);
                    }}
                    className={`p-1.5 rounded-lg shrink-0 ${t.hoverSoft}`}
                    aria-label="Toggle favorite"
                  >
                    <Star size={16} fill={isFav ? '#f59e0b' : 'none'} className={isFav ? 'text-amber-500' : t.textMuted} />
                  </button>
                  <ChevronDown size={16} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${t.textMuted}`} />
                </button>
                {isOpen && (
                  <div className={`px-4 pb-4 pt-1 border-t ${t.divider}`}>
                    <p className="font-arabic text-right text-2xl leading-relaxed mb-3" dir="rtl">
                      {dua.arabic}
                    </p>
                    <p className={`text-sm italic ${t.textMuted} mb-2 leading-relaxed`}>{dua.translit}</p>
                    <p className={`text-sm mb-2 leading-relaxed ${t.text}`}>{dua.translation}</p>
                    {dua.note && <p className={`text-xs ${t.textMuted} mb-3 leading-relaxed`}>{dua.note}</p>}
                    <button
                      onClick={() => copyDua(dua)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${t.divider} ${t.hoverSoft}`}
                    >
                      {copiedId === dua.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      {copiedId === dua.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
