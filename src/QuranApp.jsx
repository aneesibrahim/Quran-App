import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search, ChevronLeft, Play, Pause, SkipBack, SkipForward,
  Bookmark, BookmarkCheck, Copy, Check, Moon, Sun,
  Loader2, BookOpen, AlertCircle, Clock, Compass, MapPin,
  ChevronDown, Droplets, Info, Volume2, Bell, BellOff,
  Target, Flame, Sparkles, Smartphone, X,
  Share2, StickyNote, Tag, Download, GraduationCap, Type,
  Home, Shield, Users, Utensils, Star, MoreHorizontal,
  VolumeX, RotateCcw, ChevronUp, Repeat, Infinity as InfinityIcon,
  ChevronRight, CalendarDays, Heart, Briefcase, Sunrise, Eye, EyeOff,
} from 'lucide-react';

/**
 * Copyright (c) 2026 Aneesnambiyatheyil. All rights reserved.
 *
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
const DEFAULT_RECITER = 'ar.alafasy';

const LS_TRANSLATION_LANG = 'quran_reader_translation_lang_v1';
const DEFAULT_TRANSLATION = 'ml';
const TRANSLATION_OPTIONS = {
  ml: { edition: 'ml.abdulhameed', label: 'Malayalam', dir: 'ltr', fontClass: 'font-malayalam' },
  hi: { edition: 'hi.hindi', label: 'Hindi', dir: 'ltr', fontClass: 'font-hindi' },
  ur: { edition: 'ur.jalandhry', label: 'Urdu', dir: 'rtl', fontClass: 'font-urdu' },
  en: { edition: 'en.sahih', label: 'English', dir: 'ltr', fontClass: '' },
};
// Canvas text rendering (the verse-card image export) needs actual CSS
// font-family strings rather than the Tailwind classes above.
const CANVAS_FONT_BY_LANG = {
  ml: '"Noto Sans Malayalam", sans-serif',
  hi: '"Noto Sans Devanagari", sans-serif',
  ur: '"Noto Nastaliq Urdu", serif',
  en: 'Inter, sans-serif',
};

function buildEditions(reciter, translationEdition) {
  return `quran-uthmani,${translationEdition || TRANSLATION_OPTIONS[DEFAULT_TRANSLATION].edition},en.transliteration,${reciter || DEFAULT_RECITER}`;
}
function buildTextEditions(translationEdition) {
  return `quran-uthmani,${translationEdition || TRANSLATION_OPTIONS[DEFAULT_TRANSLATION].edition},en.transliteration`;
}

const ADHAN_API = 'https://api.aladhan.com/v1';
// No fixed calculation method: when `method` is omitted, the Aladhan API picks the
// authority closest to the coordinates (e.g. Gulf/Umm al-Qura region, Karachi, ISNA...).
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
const LS_SHOW_TRANSLATION = 'quran_reader_show_translation_v1';
const LS_SHOW_TRANSLIT = 'quran_reader_show_transliteration_v1';

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
const LS_HIJRI_ADJUST = 'quran_reader_hijri_adjust_v1';

// Real dua recordings. Put files in public/audio/duas/ named after each dua id
// (e.g. home-enter.mp3, sleep-before.mp3) and they are used automatically.
// A dua can also set its own `audio` URL. Set to '' to disable file lookup.
const DUA_AUDIO_BASE = '/audio/duas/';

const DUA_CATEGORIES = [
  { key: 'home', label: 'Home & Daily Life', icon: Home, color: 'sky' },
  { key: 'sleep', label: 'Sleep & Waking', icon: Moon, color: 'indigo' },
  { key: 'eating', label: 'Eating & Drinking', icon: Utensils, color: 'amber' },
  { key: 'travel', label: 'Travel', icon: Compass, color: 'cyan' },
  { key: 'protection', label: 'Protection & Comfort', icon: Shield, color: 'rose' },
  { key: 'social', label: 'Social & Wellbeing', icon: Users, color: 'emerald' },
  { key: 'sihr', label: 'Sihr & Evil Eye', icon: Shield, color: 'violet' },
  { key: 'peace', label: 'Peace & Contentment', icon: Sparkles, color: 'teal' },
  { key: 'family', label: 'Family & Marriage', icon: Heart, color: 'pink' },
  { key: 'work', label: 'Work & Provision', icon: Briefcase, color: 'orange' },
  { key: 'akhirah', label: 'Hereafter & Forgiveness', icon: Sunrise, color: 'slate' },
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
  /* ===== Protection from Sihr (sorcery) & the evil eye ===== */
  {
    id: 'sihr-ayatul-kursi',
    category: 'sihr',
    title: 'Ayat al-Kursi (protection)',
    occasion: 'Sihr, evil eye, evil whispers — after every prayer & before sleep',
    arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ',
    translit: "Allahu la ilaha illa huwa al-Hayyul-Qayyum. La ta'khudhuhu sinatun wa la nawm. Lahu ma fis-samawati wa ma fil-ard. Man dhal-ladhi yashfa'u 'indahu illa bi-idhnih. Ya'lamu ma bayna aydihim wa ma khalfahum. Wa la yuhituna bishay'in min 'ilmihi illa bima sha'. Wasi'a kursiyyuhus-samawati wal-ard. Wa la ya'uduhu hifzuhuma. Wa huwal-'Aliyyul-'Azim.",
    translation: 'Allah: there is no god but Him, the Ever-Living, the Sustainer of all. Neither drowsiness nor sleep overtakes Him. To Him belongs all that is in the heavens and on the earth. Who can intercede with Him except by His permission? He knows what is before them and what is behind them, and they encompass nothing of His knowledge except what He wills. His Throne extends over the heavens and the earth, and protecting them does not weary Him. He is the Most High, the Most Great.',
    note: "Qur'an 2:255. The Prophet ﷺ taught that whoever recites it before sleeping will have a protector from Allah through the night (Sahih al-Bukhari). Reciting it after each obligatory prayer is also recommended.",
  },
  {
    id: 'sihr-three-quls',
    category: 'sihr',
    title: 'Al-Ikhlas, Al-Falaq & An-Nas',
    occasion: 'Protection from sihr, envy and evil — morning, evening & before sleep',
    arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ ۝ قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ مِنْ شَرِّ مَا خَلَقَ ۝ وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝ وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ ۝ قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ ۝ إِلَٰهِ النَّاسِ ۝ مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝ مِنَ الْجِنَّةِ وَالنَّاسِ',
    translit: "Qul huwa Allahu ahad. Allahus-samad. Lam yalid wa lam yulad. Wa lam yakun lahu kufuwan ahad. // Qul a'udhu bi Rabbil-falaq. Min sharri ma khalaq. Wa min sharri ghasiqin idha waqab. Wa min sharrin-naffathati fil-'uqad. Wa min sharri hasidin idha hasad. // Qul a'udhu bi Rabbin-nas. Malikin-nas. Ilahin-nas. Min sharril-waswasil-khannas. Alladhi yuwaswisu fi sudurin-nas. Minal-jinnati wan-nas.",
    translation: 'Say: He is Allah, the One; Allah, the Eternal Refuge; He neither begets nor is born, and none is comparable to Him. // Say: I seek refuge in the Lord of daybreak, from the evil of what He created, from the evil of darkness when it settles, from the evil of those who blow on knots (sorcery), and from the evil of the envious when they envy. // Say: I seek refuge in the Lord of mankind, the King of mankind, the God of mankind, from the evil of the whisperer who withdraws, who whispers into people\'s hearts, from among jinn and mankind.',
    note: 'Recite each three times in the morning and evening (Abu Dawud, at-Tirmidhi). Before sleep, the Prophet ﷺ would recite them, blow lightly into his cupped hands and wipe over his body (Sahih al-Bukhari). The Prophet ﷺ also said that eating seven ajwa dates in the morning protects from poison and sihr that day (Bukhari, Muslim).',
  },
  {
    id: 'sihr-perfect-words',
    category: 'sihr',
    title: "Refuge in Allah's perfect words",
    occasion: 'Against harm, whenever you stop at a place or travel',
    arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
    translit: "A'udhu bikalimatillahit-tammati min sharri ma khalaq",
    translation: 'I seek refuge in the perfect words of Allah from the evil of everything He has created.',
    note: 'Sahih Muslim: whoever says this when stopping at a place will not be harmed by anything until he leaves it.',
  },
  {
    id: 'sihr-nothing-harms',
    category: 'sihr',
    title: 'Nothing harms with His name',
    occasion: 'Say 3 times, morning and evening',
    arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
    translit: "Bismillahilladhi la yadurru ma'asmihi shay'un fil-ardi wa la fis-sama'i wa huwas-Sami'ul-'Alim",
    translation: 'In the name of Allah, with whose name nothing on earth or in heaven can cause harm; He is the All-Hearing, the All-Knowing.',
    note: 'Abu Dawud and at-Tirmidhi: whoever says it three times in the morning and three times in the evening will not be struck by sudden harm.',
  },
  {
    id: 'sihr-ruqyah-eye',
    category: 'sihr',
    title: 'Ruqyah against the evil eye & envy',
    occasion: 'Recited over a person who is harmed, ill or affected by an evil eye',
    arabic: 'بِاسْمِ اللَّهِ أَرْقِيكَ، مِنْ كُلِّ شَيْءٍ يُؤْذِيكَ، مِنْ شَرِّ كُلِّ نَفْسٍ أَوْ عَيْنِ حَاسِدٍ، اللَّهُ يَشْفِيكَ، بِاسْمِ اللَّهِ أَرْقِيكَ',
    translit: "Bismillahi arqika, min kulli shay'in yu'dhika, min sharri kulli nafsin aw 'ayni hasidin, Allahu yashfik, bismillahi arqik",
    translation: 'In the name of Allah I recite over you, from everything that harms you, from the evil of every soul and every envious eye. May Allah heal you. In the name of Allah I recite over you.',
    note: "Sahih Muslim: the ruqyah of Jibril for the Prophet ﷺ.",
  },
  {
    id: 'sihr-quran-yunus',
    category: 'sihr',
    title: 'Verses against sorcery (Yunus 10:81-82)',
    occasion: "Commonly recited by scholars in ruqyah for sihr",
    arabic: 'مَا جِئْتُمْ بِهِ السِّحْرُ ۖ إِنَّ اللَّهَ سَيُبْطِلُهُ ۖ إِنَّ اللَّهَ لَا يُصْلِحُ عَمَلَ الْمُفْسِدِينَ ۝ وَيُحِقُّ اللَّهُ الْحَقَّ بِكَلِمَاتِهِ وَلَوْ كَرِهَ الْمُجْرِمُونَ',
    translit: "Ma ji'tum bihis-sihr, innallaha sayubtiluh, innallaha la yuslihu 'amalal-mufsidin. Wa yuhiqqullahul-haqqa bikalimatihi wa law karihal-mujrimun",
    translation: 'What you have brought is sorcery; Allah will surely make it come to nothing. Allah does not set right the work of those who spread corruption. And Allah establishes the truth by His words, even if the wrongdoers dislike it.',
    note: "Qur'an 10:81-82. Scholars recite these verses in ruqyah against sorcery, which is a practice rather than a specific hadith. If you believe you are affected, rely on daily adhkar and Qur'an, seek a trustworthy knowledgeable person, and never go to fortune-tellers or sorcerers, which Islam forbids.",
  },

  /* ===== Peace, anxiety & contentment ===== */
  {
    id: 'peace-worry-grief',
    category: 'peace',
    title: 'Against worry, grief and debt',
    occasion: 'When anxious, sad, overwhelmed or in debt',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْبُخْلِ وَالْجُبْنِ، وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ',
    translit: "Allahumma inni a'udhu bika minal-hammi wal-hazan, wal-'ajzi wal-kasal, wal-bukhli wal-jubn, wa dala'id-dayni wa ghalabatir-rijal",
    translation: 'O Allah, I seek refuge in You from worry and grief, from helplessness and laziness, from miserliness and cowardice, from the burden of debt and from being overpowered by people.',
    note: 'Sahih al-Bukhari. A favourite dua of the Prophet ﷺ.',
  },
  {
    id: 'peace-anxiety-quran',
    category: 'peace',
    title: "Dua for removing anxiety and sorrow",
    occasion: 'When the heart is heavy',
    arabic: 'اللَّهُمَّ إِنِّي عَبْدُكَ، ابْنُ عَبْدِكَ، ابْنُ أَمَتِكَ، نَاصِيَتِي بِيَدِكَ، مَاضٍ فِيَّ حُكْمُكَ، عَدْلٌ فِيَّ قَضَاؤُكَ، أَسْأَلُكَ بِكُلِّ اسْمٍ هُوَ لَكَ، سَمَّيْتَ بِهِ نَفْسَكَ، أَوْ أَنْزَلْتَهُ فِي كِتَابِكَ، أَوْ عَلَّمْتَهُ أَحَدًا مِنْ خَلْقِكَ، أَوِ اسْتَأْثَرْتَ بِهِ فِي عِلْمِ الْغَيْبِ عِنْدَكَ، أَنْ تَجْعَلَ الْقُرْآنَ رَبِيعَ قَلْبِي، وَنُورَ صَدْرِي، وَجَلَاءَ حُزْنِي، وَذَهَابَ هَمِّي',
    translit: "Allahumma inni 'abduka, ibnu 'abdika, ibnu amatika, nasiyati biyadika, madin fiyya hukmuka, 'adlun fiyya qada'uk. As'aluka bikulli ismin huwa laka, sammayta bihi nafsaka, aw anzaltahu fi kitabika, aw 'allamtahu ahadan min khalqika, awistatharta bihi fi 'ilmil-ghaybi 'indaka, an taj'alal-Qur'ana rabi'a qalbi, wa nura sadri, wa jala'a huzni, wa dhahaba hammi",
    translation: "O Allah, I am Your servant, son of Your servant, son of Your maidservant; my forelock is in Your hand, Your command over me is carried out, and Your decree about me is just. I ask You by every name that is Yours, by which You named Yourself, or revealed in Your Book, or taught to any of Your creation, or kept to Yourself in the knowledge of the unseen: make the Qur'an the spring of my heart, the light of my chest, the remover of my sorrow and the departure of my worry.",
    note: 'Musnad Ahmad. The Prophet ﷺ said that whoever says it, Allah will remove his worry and grief and replace it with joy.',
  },
  {
    id: 'peace-ya-hayyu',
    category: 'peace',
    title: 'Ya Hayyu ya Qayyum',
    occasion: 'For help, ease and setting your affairs right',
    arabic: 'يَا حَيُّ يَا قَيُّومُ، بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ',
    translit: "Ya Hayyu ya Qayyum, birahmatika astaghith, aslih li sha'ni kullahu, wa la takilni ila nafsi tarfata 'ayn",
    translation: 'O Ever-Living, O Sustainer of all, I seek help through Your mercy. Set all my affairs right, and do not leave me to myself even for the blink of an eye.',
    note: "Reported by al-Hakim and others; the Prophet ﷺ taught it to his daughter Fatimah to say morning and evening.",
  },
  {
    id: 'peace-steadfast-heart',
    category: 'peace',
    title: 'Steadfast heart',
    occasion: 'For a heart that stays firm in faith',
    arabic: 'يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَى دِينِكَ',
    translit: "Ya muqallibal-qulub, thabbit qalbi 'ala dinik",
    translation: 'O Turner of hearts, keep my heart firm upon Your religion.',
    note: 'At-Tirmidhi. The Prophet ﷺ made this dua very often.',
  },
  {
    id: 'peace-hasbiyallah',
    category: 'peace',
    title: 'Allah is sufficient for me',
    occasion: 'Trust and calm in worry, morning & evening',
    arabic: 'حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ ۖ عَلَيْهِ تَوَكَّلْتُ ۖ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
    translit: "Hasbiyallahu la ilaha illa huwa, 'alayhi tawakkaltu wa huwa Rabbul-'Arshil-'Azim",
    translation: 'Allah is enough for me; there is no god but Him. In Him I place my trust, and He is the Lord of the Mighty Throne.',
    note: "Qur'an 9:129. A report in Abu Dawud mentions saying it seven times morning and evening; scholars differ on how strong that report is, but the verse itself is Qur'an.",
  },
  {
    id: 'peace-contentment',
    category: 'peace',
    title: 'Guidance, piety, chastity & contentment',
    occasion: 'A short dua for a calm, content life',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى',
    translit: "Allahumma inni as'alukal-huda wat-tuqa wal-'afafa wal-ghina",
    translation: 'O Allah, I ask You for guidance, piety, chastity and self-sufficiency.',
    note: 'Sahih Muslim.',
  },

  /* ===== Family, marriage & children ===== */
  {
    id: 'family-spouses-offspring',
    category: 'family',
    title: 'Comfort in spouse and children',
    occasion: 'For a happy home and a righteous family',
    arabic: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا',
    translit: "Rabbana hab lana min azwajina wa dhurriyyatina qurrata a'yunin waj'alna lil-muttaqina imama",
    translation: 'Our Lord, grant us from our spouses and our offspring comfort to our eyes, and make us a leader for the righteous.',
    note: "Qur'an 25:74, from the description of the servants of the Most Merciful.",
  },
  {
    id: 'family-harmony-hearts',
    category: 'family',
    title: 'Unity of hearts and peace at home',
    occasion: 'Harmony between husband and wife, and within the family',
    arabic: 'اللَّهُمَّ أَلِّفْ بَيْنَ قُلُوبِنَا، وَأَصْلِحْ ذَاتَ بَيْنِنَا، وَاهْدِنَا سُبُلَ السَّلَامِ، وَنَجِّنَا مِنَ الظُّلُمَاتِ إِلَى النُّورِ، وَجَنِّبْنَا الْفَوَاحِشَ مَا ظَهَرَ مِنْهَا وَمَا بَطَنَ، وَبَارِكْ لَنَا فِي أَسْمَاعِنَا وَأَبْصَارِنَا وَقُلُوبِنَا وَأَزْوَاجِنَا وَذُرِّيَّاتِنَا، وَتُبْ عَلَيْنَا إِنَّكَ أَنْتَ التَّوَّابُ الرَّحِيمُ، وَاجْعَلْنَا شَاكِرِينَ لِنِعْمَتِكَ، مُثْنِينَ بِهَا، قَابِلِينَ لَهَا، وَأَتِمَّهَا عَلَيْنَا',
    translit: "Allahumma allif bayna qulubina, wa aslih dhata baynina, wahdina subulas-salam, wa najjina minaz-zulumati ilan-nur, wa jannibnal-fawahisha ma zahara minha wa ma batan, wa barik lana fi asma'ina wa absarina wa qulubina wa azwajina wa dhurriyyatina, wa tub 'alayna innaka antat-Tawwabur-Rahim, waj'alna shakirina li ni'matika, muthnina biha, qabilina laha, wa atimmaha 'alayna",
    translation: 'O Allah, join our hearts together and set right what is between us. Guide us to the paths of peace, bring us out of darkness into light, and keep us away from indecency, open and hidden. Bless our hearing, our sight, our hearts, our spouses and our children. Accept our repentance, for You are the Accepting of repentance, the Merciful. Make us grateful for Your blessings, praising You for them and accepting them, and complete them for us.',
    note: "Reported by Abu Dawud, taught by the Prophet ﷺ as a dua within the tashahhud. There is no single dua that guarantees a marriage will be fixed; the Sunnah combines duas like this with patience, good character, kind speech and forgiveness.",
  },
  {
    id: 'family-newlywed',
    category: 'family',
    title: 'For a newly married couple',
    occasion: 'Said to a bride and groom',
    arabic: 'بَارَكَ اللَّهُ لَكَ، وَبَارَكَ عَلَيْكَ، وَجَمَعَ بَيْنَكُمَا فِي خَيْرٍ',
    translit: "Barakallahu laka, wa baraka 'alayka, wa jama'a baynakuma fi khayr",
    translation: 'May Allah bless you, shower blessings upon you, and unite you both in goodness.',
    note: 'Abu Dawud and at-Tirmidhi.',
  },
  {
    id: 'family-wedding-night',
    category: 'family',
    title: "Husband's dua for his wife",
    occasion: 'At the start of married life; hold her forehead and say',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَهَا وَخَيْرَ مَا جَبَلْتَهَا عَلَيْهِ، وَأَعُوذُ بِكَ مِنْ شَرِّهَا وَشَرِّ مَا جَبَلْتَهَا عَلَيْهِ',
    translit: "Allahumma inni as'aluka khayraha wa khayra ma jabaltaha 'alayh, wa a'udhu bika min sharriha wa sharri ma jabaltaha 'alayh",
    translation: 'O Allah, I ask You for her goodness and the good in the nature You have given her, and I seek refuge in You from her harm and from the harm in the nature You have given her.',
    note: 'Abu Dawud and Ibn Majah. The Prophet ﷺ advised to say this, along with asking for blessing, when a man marries.',
  },
  {
    id: 'family-before-intimacy',
    category: 'family',
    title: 'Before marital intimacy',
    occasion: 'Husband and wife, for protection of any child',
    arabic: 'بِسْمِ اللَّهِ، اللَّهُمَّ جَنِّبْنَا الشَّيْطَانَ وَجَنِّبِ الشَّيْطَانَ مَا رَزَقْتَنَا',
    translit: "Bismillah, Allahumma jannibnash-shaytana wa jannibish-shaytana ma razaqtana",
    translation: 'In the name of Allah. O Allah, keep Satan away from us, and keep Satan away from what You grant us.',
    note: "Sahih al-Bukhari and Sahih Muslim: if a child is decreed from it, Satan will not harm that child.",
  },
  {
    id: 'family-righteous-children',
    category: 'family',
    title: 'For righteous children',
    occasion: 'Asking Allah for good offspring',
    arabic: 'رَبِّ هَبْ لِي مِنْ لَدُنْكَ ذُرِّيَّةً طَيِّبَةً ۖ إِنَّكَ سَمِيعُ الدُّعَاءِ',
    translit: "Rabbi hab li min ladunka dhurriyyatan tayyibah, innaka Sami'ud-du'a",
    translation: 'My Lord, grant me from Yourself good offspring. You are the Hearer of prayer.',
    note: "Qur'an 3:38, the dua of Prophet Zakariyya (peace be upon him). Also: \"Rabbi la tadharni fardan wa Anta khayrul-warithin\" (21:89), \"My Lord, do not leave me alone, and You are the best of inheritors.\"",
  },
  {
    id: 'family-grateful-children',
    category: 'family',
    title: 'Gratitude, parents and children',
    occasion: 'Thanking Allah and asking goodness for your children',
    arabic: 'رَبِّ أَوْزِعْنِي أَنْ أَشْكُرَ نِعْمَتَكَ الَّتِي أَنْعَمْتَ عَلَيَّ وَعَلَىٰ وَالِدَيَّ وَأَنْ أَعْمَلَ صَالِحًا تَرْضَاهُ وَأَصْلِحْ لِي فِي ذُرِّيَّتِي ۖ إِنِّي تُبْتُ إِلَيْكَ وَإِنِّي مِنَ الْمُسْلِمِينَ',
    translit: "Rabbi awzi'ni an ashkura ni'matakal-lati an'amta 'alayya wa 'ala walidayya wa an a'mala salihan tardahu wa aslih li fi dhurriyyati, inni tubtu ilayka wa inni minal-muslimin",
    translation: 'My Lord, inspire me to be thankful for Your favour which You have bestowed on me and on my parents, and to do righteous deeds that please You. Make my offspring righteous for me. I turn to You in repentance, and I am among those who submit.',
    note: "Qur'an 46:15.",
  },
  {
    id: 'family-ibrahim-prayer',
    category: 'family',
    title: "Ibrahim's dua for his family",
    occasion: 'Steadfast prayer for you and your descendants, forgiveness for all',
    arabic: 'رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ وَمِنْ ذُرِّيَّتِي ۚ رَبَّنَا وَتَقَبَّلْ دُعَاءِ ۝ رَبَّنَا اغْفِرْ لِي وَلِوَالِدَيَّ وَلِلْمُؤْمِنِينَ يَوْمَ يَقُومُ الْحِسَابُ',
    translit: "Rabbij-'alni muqimas-salati wa min dhurriyyati, Rabbana wa taqabbal du'a. Rabbanagh-fir li wa liwalidayya wa lil-mu'minina yawma yaqumul-hisab",
    translation: 'My Lord, make me an establisher of prayer, and from my descendants too. Our Lord, accept my prayer. Our Lord, forgive me, my parents and the believers on the Day when the reckoning is established.',
    note: "Qur'an 14:40-41.",
  },
  {
    id: 'family-protect-children',
    category: 'family',
    title: 'Protecting children from harm & the evil eye',
    occasion: 'Recited over your children',
    arabic: 'أُعِيذُكُمَا بِكَلِمَاتِ اللَّهِ التَّامَّةِ مِنْ كُلِّ شَيْطَانٍ وَهَامَّةٍ، وَمِنْ كُلِّ عَيْنٍ لَامَّةٍ',
    translit: "U'idhukuma bikalimatillahit-tammati min kulli shaytanin wa hammah, wa min kulli 'aynin lammah",
    translation: 'I place you both under the protection of the perfect words of Allah, from every devil and every harmful creature, and from every evil eye.',
    note: 'Sahih al-Bukhari: the Prophet ﷺ used to seek protection for Al-Hasan and Al-Husayn with these words. For one child, say "u\'idhuka".',
  },
  {
    id: 'family-bereavement',
    category: 'family',
    title: 'When a loved one passes away',
    occasion: 'On hearing of a death or any calamity',
    arabic: 'إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ، اللَّهُمَّ أْجُرْنِي فِي مُصِيبَتِي وَأَخْلِفْ لِي خَيْرًا مِنْهَا',
    translit: "Inna lillahi wa inna ilayhi raji'un. Allahumma'jurni fi musibati wakhlif li khayran minha",
    translation: 'We belong to Allah and to Him we return. O Allah, reward me in my affliction and give me something better in its place.',
    note: 'Sahih Muslim (Umm Salamah). Her husband Abu Salamah had died; Allah later gave her the Prophet ﷺ as a husband.',
  },
  {
    id: 'family-funeral-dua',
    category: 'family',
    title: 'For a deceased relative',
    occasion: "Funeral prayer, or when remembering a family member who has died",
    arabic: 'اللَّهُمَّ اغْفِرْ لَهُ وَارْحَمْهُ، وَعَافِهِ وَاعْفُ عَنْهُ، وَأَكْرِمْ نُزُلَهُ وَوَسِّعْ مُدْخَلَهُ، وَاغْسِلْهُ بِالْمَاءِ وَالثَّلْجِ وَالْبَرَدِ، وَنَقِّهِ مِنَ الْخَطَايَا كَمَا نَقَّيْتَ الثَّوْبَ الْأَبْيَضَ مِنَ الدَّنَسِ، وَأَبْدِلْهُ دَارًا خَيْرًا مِنْ دَارِهِ، وَأَهْلًا خَيْرًا مِنْ أَهْلِهِ، وَزَوْجًا خَيْرًا مِنْ زَوْجِهِ، وَأَدْخِلْهُ الْجَنَّةَ، وَأَعِذْهُ مِنْ عَذَابِ الْقَبْرِ وَعَذَابِ النَّارِ',
    translit: "Allahummaghfir lahu warhamhu, wa 'afihi wa'fu 'anhu, wa akrim nuzulahu wa wassi' mudkhalahu, waghsilhu bil-ma'i wath-thalji wal-barad, wa naqqihi minal-khataya kama naqqaytath-thawbal-abyada minad-danas, wa abdilhu daran khayran min darihi, wa ahlan khayran min ahlihi, wa zawjan khayran min zawjihi, wa adkhilhul-jannah, wa a'idhhu min 'adhabil-qabri wa 'adhabin-nar",
    translation: 'O Allah, forgive him and have mercy on him, grant him well-being and pardon him. Honour his place of rest and make his entrance wide. Wash him with water, snow and hail, and cleanse him of sins as a white garment is cleansed of dirt. Give him a better home than his home, a better family than his family and a better spouse than his spouse. Admit him to Paradise and protect him from the punishment of the grave and of the Fire.',
    note: 'Sahih Muslim. For a woman say "lahā" and "warhamhā" in place of "lahu"; for several people say "lahum".',
  },
  {
    id: 'family-visit-graves',
    category: 'family',
    title: 'Visiting the graves',
    occasion: 'When visiting family members in the cemetery',
    arabic: 'السَّلَامُ عَلَيْكُمْ أَهْلَ الدِّيَارِ مِنَ الْمُؤْمِنِينَ وَالْمُسْلِمِينَ، وَإِنَّا إِنْ شَاءَ اللَّهُ بِكُمْ لَاحِقُونَ، نَسْأَلُ اللَّهَ لَنَا وَلَكُمُ الْعَافِيَةَ',
    translit: "As-salamu 'alaykum ahlad-diyari minal-mu'minina wal-muslimin, wa inna insha'Allahu bikum lahiqun, nas'alullaha lana wa lakumul-'afiyah",
    translation: 'Peace be upon you, people of this abode, believers and Muslims. We will, God willing, join you. We ask Allah for well-being for us and for you.',
    note: 'Sahih Muslim.',
  },

  /* ===== Work, provision & seeking a job ===== */
  {
    id: 'work-halal-provision',
    category: 'work',
    title: 'Halal provision & independence',
    occasion: 'For halal income, debts and needs',
    arabic: 'اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ، وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ',
    translit: "Allahummak-fini bihalalika 'an haramik, wa aghnini bifadlika 'amman siwak",
    translation: 'O Allah, make Your lawful provision enough for me so that I need nothing unlawful, and enrich me by Your bounty so that I need no one but You.',
    note: "At-Tirmidhi: 'Ali (may Allah be pleased with him) taught this to a man struggling with debt, saying the Prophet ﷺ had taught him that Allah would settle even a mountain of debt for whoever says it.",
  },
  {
    id: 'work-job-rizq',
    category: 'work',
    title: 'Beneficial knowledge, good provision, accepted deeds',
    occasion: 'Seeking a job and a blessed income, after Fajr prayer',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا',
    translit: "Allahumma inni as'aluka 'ilman nafi'an, wa rizqan tayyiban, wa 'amalan mutaqabbalan",
    translation: 'O Allah, I ask You for beneficial knowledge, good and lawful provision, and deeds that are accepted.',
    note: 'Ibn Majah: the Prophet ﷺ said it after the Fajr prayer. Pair dua with effort (applying, learning, preparing). No dua guarantees a specific job, but asking while striving is the Sunnah.',
  },
  {
    id: 'work-musa-need',
    category: 'work',
    title: 'When in need of any good',
    occasion: "Asking for a job, help or provision when you have nothing",
    arabic: 'رَبِّ إِنِّي لِمَا أَنْزَلْتَ إِلَيَّ مِنْ خَيْرٍ فَقِيرٌ',
    translit: "Rabbi inni lima anzalta ilayya min khayrin faqir",
    translation: 'My Lord, I am truly in need of whatever good You send down to me.',
    note: "Qur'an 28:24. The dua of Prophet Musa (peace be upon him), alone and without means after leaving Egypt. Allah soon gave him shelter, work and a family.",
  },
  {
    id: 'work-istikhara',
    category: 'work',
    title: 'Istikhara (seeking guidance)',
    occasion: 'Choosing a job, a marriage proposal or any big decision',
    arabic: 'اللَّهُمَّ إِنِّي أَسْتَخِيرُكَ بِعِلْمِكَ، وَأَسْتَقْدِرُكَ بِقُدْرَتِكَ، وَأَسْأَلُكَ مِنْ فَضْلِكَ الْعَظِيمِ، فَإِنَّكَ تَقْدِرُ وَلَا أَقْدِرُ، وَتَعْلَمُ وَلَا أَعْلَمُ، وَأَنْتَ عَلَّامُ الْغُيُوبِ. اللَّهُمَّ إِنْ كُنْتَ تَعْلَمُ أَنَّ هَذَا الْأَمْرَ خَيْرٌ لِي فِي دِينِي وَمَعَاشِي وَعَاقِبَةِ أَمْرِي، فَاقْدُرْهُ لِي وَيَسِّرْهُ لِي ثُمَّ بَارِكْ لِي فِيهِ، وَإِنْ كُنْتَ تَعْلَمُ أَنَّ هَذَا الْأَمْرَ شَرٌّ لِي فِي دِينِي وَمَعَاشِي وَعَاقِبَةِ أَمْرِي، فَاصْرِفْهُ عَنِّي وَاصْرِفْنِي عَنْهُ، وَاقْدُرْ لِيَ الْخَيْرَ حَيْثُ كَانَ ثُمَّ أَرْضِنِي بِهِ',
    translit: "Allahumma inni astakhiruka bi'ilmika, wa astaqdiruka biqudratika, wa as'aluka min fadlikal-'azim, fa innaka taqdiru wa la aqdir, wa ta'lamu wa la a'lam, wa Anta 'Allamul-ghuyub. Allahumma in kunta ta'lamu anna hadhal-amra khayrun li fi dini wa ma'ashi wa 'aqibati amri, faqdurhu li wa yassirhu li thumma barik li fih. Wa in kunta ta'lamu anna hadhal-amra sharrun li fi dini wa ma'ashi wa 'aqibati amri, fasrifhu 'anni wasrifni 'anhu, waqdur liyal-khayra haythu kana thumma ardini bih",
    translation: 'O Allah, I seek Your guidance through Your knowledge and Your power, and I ask You of Your great bounty. You are able and I am not; You know and I do not; You are the Knower of the unseen. O Allah, if You know this matter is good for my religion, my livelihood and the outcome of my affairs, then decree it for me, make it easy for me, and bless it for me. And if You know it is bad for my religion, my livelihood and the outcome of my affairs, then turn it away from me and turn me away from it, and decree for me the good wherever it may be, and make me content with it.',
    note: "Sahih al-Bukhari. Pray two voluntary rak'ahs, then make this dua, naming your matter where it says \"hadhal-amra\" (this matter).",
  },
  {
    id: 'work-ease',
    category: 'work',
    title: 'Making hard things easy',
    occasion: 'Before an interview, exam or difficult task',
    arabic: 'اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا، وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا',
    translit: "Allahumma la sahla illa ma ja'altahu sahla, wa Anta taj'alul-hazna idha shi'ta sahla",
    translation: 'O Allah, nothing is easy except what You make easy, and You make the difficult easy if You wish.',
    note: "Reported by Ibn Hibban and Ibn as-Sunni (graded authentic by several scholars).",
  },
  {
    id: 'work-open-chest',
    category: 'work',
    title: 'Confidence and clear speech',
    occasion: 'Before an interview, meeting or presentation',
    arabic: 'رَبِّ اشْرَحْ لِي صَدْرِي ۝ وَيَسِّرْ لِي أَمْرِي ۝ وَاحْلُلْ عُقْدَةً مِنْ لِسَانِي ۝ يَفْقَهُوا قَوْلِي',
    translit: "Rabbish-rah li sadri, wa yassir li amri, wahlul 'uqdatan min lisani, yafqahu qawli",
    translation: 'My Lord, expand my chest for me, ease my task for me, untie the knot in my tongue so that they may understand my speech.',
    note: "Qur'an 20:25-28. The dua of Prophet Musa (peace be upon him) before facing Pharaoh.",
  },

  /* ===== The Hereafter (Akhirah) & forgiveness ===== */
  {
    id: 'akhirah-hasanah',
    category: 'akhirah',
    title: 'Good in this world and the next',
    occasion: 'The most frequent dua of the Prophet ﷺ',
    arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    translit: "Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina 'adhaban-nar",
    translation: 'Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.',
    note: "Qur'an 2:201. Sahih al-Bukhari and Sahih Muslim report it as the Prophet's most frequent dua.",
  },
  {
    id: 'akhirah-sayyidul-istighfar',
    category: 'akhirah',
    title: 'Sayyid al-Istighfar (master of forgiveness)',
    occasion: 'Morning and evening',
    arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَىٰ عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
    translit: "Allahumma Anta Rabbi la ilaha illa Ant, khalaqtani wa ana 'abduk, wa ana 'ala 'ahdika wa wa'dika mastata't, a'udhu bika min sharri ma sana't, abu'u laka bini'matika 'alayya, wa abu'u bidhanbi faghfir li, fa innahu la yaghfirudh-dhunuba illa Ant",
    translation: 'O Allah, You are my Lord; there is no god but You. You created me and I am Your servant, and I keep Your covenant and promise as best I can. I seek refuge in You from the evil of what I have done. I acknowledge Your favour upon me and I acknowledge my sin, so forgive me, for none forgives sins but You.',
    note: 'Sahih al-Bukhari: whoever says it with firm faith in the daytime and dies before evening is among the people of Paradise, and likewise at night.',
  },
  {
    id: 'akhirah-forgive-repent',
    category: 'akhirah',
    title: 'Forgive me and accept my repentance',
    occasion: 'Seeking forgiveness any time',
    arabic: 'رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ، إِنَّكَ أَنْتَ التَّوَّابُ الرَّحِيمُ',
    translit: "Rabbigh-fir li wa tub 'alayya, innaka Antat-Tawwabur-Rahim",
    translation: 'My Lord, forgive me and accept my repentance; You are the Accepting of repentance, the Merciful.',
    note: 'Abu Dawud and at-Tirmidhi: the Companions counted the Prophet ﷺ saying this a hundred times in a single sitting.',
  },
  {
    id: 'akhirah-pardon',
    category: 'akhirah',
    title: 'Pardon (Laylat al-Qadr)',
    occasion: 'Especially in the last ten nights of Ramadan',
    arabic: 'اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي',
    translit: "Allahumma innaka 'afuwwun tuhibbul-'afwa fa'fu 'anni",
    translation: 'O Allah, You are Most Pardoning and love to pardon, so pardon me.',
    note: "At-Tirmidhi and Ibn Majah: the dua the Prophet ﷺ taught 'A'ishah to say if she found Laylat al-Qadr.",
  },
  {
    id: 'akhirah-jannah',
    category: 'akhirah',
    title: 'Asking for Paradise, refuge from the Fire',
    occasion: 'Any time, especially in prayer',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْجَنَّةَ وَمَا قَرَّبَ إِلَيْهَا مِنْ قَوْلٍ أَوْ عَمَلٍ، وَأَعُوذُ بِكَ مِنَ النَّارِ وَمَا قَرَّبَ إِلَيْهَا مِنْ قَوْلٍ أَوْ عَمَلٍ',
    translit: "Allahumma inni as'alukal-jannata wa ma qarraba ilayha min qawlin aw 'amal, wa a'udhu bika minan-nari wa ma qarraba ilayha min qawlin aw 'amal",
    translation: 'O Allah, I ask You for Paradise and for every word and deed that brings me closer to it, and I seek refuge in You from the Fire and every word and deed that brings me closer to it.',
    note: 'Ibn Majah.',
  },
  {
    id: 'akhirah-grave-hell',
    category: 'akhirah',
    title: 'Refuge from the punishment of the grave & Hellfire',
    occasion: 'Before the salam in the final sitting of every prayer',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عَذَابِ جَهَنَّمَ، وَمِنْ عَذَابِ الْقَبْرِ، وَمِنْ فِتْنَةِ الْمَحْيَا وَالْمَمَاتِ، وَمِنْ شَرِّ فِتْنَةِ الْمَسِيحِ الدَّجَّالِ',
    translit: "Allahumma inni a'udhu bika min 'adhabi jahannam, wa min 'adhabil-qabr, wa min fitnatil-mahya wal-mamat, wa min sharri fitnatil-Masihid-Dajjal",
    translation: 'O Allah, I seek refuge in You from the punishment of Hell, from the punishment of the grave, from the trials of life and death, and from the evil of the trial of the False Messiah.',
    note: 'Sahih Muslim: the Prophet ﷺ commanded seeking refuge in these four things at the end of the tashahhud.',
  },
  {
    id: 'akhirah-easy-reckoning',
    category: 'akhirah',
    title: 'An easy reckoning',
    occasion: 'Asking for mercy on the Day of Judgement',
    arabic: 'اللَّهُمَّ حَاسِبْنِي حِسَابًا يَسِيرًا',
    translit: "Allahumma hasibni hisaban yasira",
    translation: 'O Allah, take me to account with an easy reckoning.',
    note: "Musnad Ahmad and al-Hakim ('A'ishah): the Prophet ﷺ made this dua in some of his prayers.",
  },
  {
    id: 'akhirah-steadfast-iman',
    category: 'akhirah',
    title: 'Do not let our hearts deviate',
    occasion: 'Staying guided until the end',
    arabic: 'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَدُنْكَ رَحْمَةً ۚ إِنَّكَ أَنْتَ الْوَهَّابُ',
    translit: "Rabbana la tuzigh qulubana ba'da idh hadaytana wa hab lana min ladunka rahmah, innaka Antal-Wahhab",
    translation: 'Our Lord, do not let our hearts deviate after You have guided us, and grant us mercy from Yourself. You are the Bestower.',
    note: "Qur'an 3:8.",
  },
  {
    id: 'akhirah-die-righteous',
    category: 'akhirah',
    title: 'Forgive our sins, let us die among the righteous',
    occasion: 'Asking for a good ending',
    arabic: 'رَبَّنَا فَاغْفِرْ لَنَا ذُنُوبَنَا وَكَفِّرْ عَنَّا سَيِّئَاتِنَا وَتَوَفَّنَا مَعَ الْأَبْرَارِ',
    translit: "Rabbana faghfir lana dhunubana wa kaffir 'anna sayyi'atina wa tawaffana ma'al-abrar",
    translation: 'Our Lord, forgive our sins, erase our bad deeds, and let us die among the righteous.',
    note: "Qur'an 3:193.",
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

// The Azan recording played at prayer times. Add a file you have the rights to
// use to your project's `public/` folder as `adhan.mp3` (or change this path,
// e.g. '/adhan.ogg'). A CC0 (public domain) option: search Wikimedia Commons
// for "Beautiful adhan.ogg" — listen to it first, then save it as public/adhan.ogg
// and set this to '/adhan.ogg'. If the file is missing, the app plays a short
// chime instead, so reminders never fail silently.
const ADHAN_AUDIO_URL = '/adhan.mp3';
const LS_REMINDERS_FIRED = 'quran_reader_prayer_fired_v1';
const LS_COMPASS_FLIP = 'quran_reader_compass_flip_v1';

const COPYRIGHT_OWNER = 'Aneesnambiyatheyil';
const COPYRIGHT_YEAR = 2026; // year of first publication — update if you want a range, e.g. '2026–2027'
const REMINDER_PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const REMINDER_GRACE_MIN = 2; // still fire if the tab was throttled/asleep for up to this long

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

// A curated set of well-established reciters known for complete, reliably
// maintained per-ayah audio on the Islamic Network CDN — rather than the
// full list from the API (70+ editions), which includes many with gaps or
// inconsistent coverage that caused the audio issues reported earlier.
const TRUSTED_RECITERS = [
  'ar.alafasy',
  'ar.husary',
  'ar.minshawi',
  'ar.abdulbasitmurattal',
  'ar.abdurrahmaansudais',
  'ar.shaatree',
  'ar.hudhaify',
  'ar.mahermuaiqly',
  'ar.ahmedajamy',
  'ar.saoodshuraym',
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

// Current date (YYYY-MM-DD) and minutes-since-midnight in a given IANA
// timezone. Prayer times from the API are in the *prayer location's* local
// time, which is not necessarily the device's timezone.
function zonedNow(tz) {
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', tz ? { ...opts, timeZone: tz } : opts).formatToParts(new Date());
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', opts).formatToParts(new Date());
  }
  const g = (type) => parts.find((p) => p.type === type)?.value || '0';
  return { date: `${g('year')}-${g('month')}-${g('day')}`, minutes: (parseInt(g('hour'), 10) % 24) * 60 + parseInt(g('minute'), 10) };
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

// Compass heading (degrees clockwise from north) of the direction the user is facing,
// from W3C device orientation angles. Uses the full rotation, so it stays correct
// whether the phone is flat or held upright / tilted.
function headingFromOrientation(alpha, beta, gamma) {
  const r = Math.PI / 180;
  const cA = Math.cos(alpha * r), sA = Math.sin(alpha * r);
  const cB = Math.cos(beta * r), sB = Math.sin(beta * r);
  const cG = Math.cos(gamma * r), sG = Math.sin(gamma * r);
  // Direction the back of the device points (earth frame: east, north, up)
  const backE = -(cA * sG + sA * sB * cG);
  const backN = cA * sB * cG - sA * sG;
  // Direction the top edge points
  const topE = -sA * cB;
  const topN = cA * cB;
  // Phone roughly flat: the back points at the ground, so use the top edge.
  // Otherwise (held upright / tilted) use the direction the back faces.
  const flat = Math.abs(cB * cG) > 0.75;
  const e = flat ? topE : backE;
  const n = flat ? topN : backN;
  if (Math.abs(e) < 1e-6 && Math.abs(n) < 1e-6) return null;
  return ((Math.atan2(e, n) * 180) / Math.PI + 360) % 360;
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
  const [section, setSection] = useState('quran'); // 'quran' | 'prayer' | 'duas' | 'worship' | 'hijri' | 'progress' | 'learn'
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // ---------------- Prayer reminders (app-level so they keep running on every tab) ----------------
  const [prayerLocation, setPrayerLocation] = useState(() => loadJSON(LS_PRAYER_LOCATION, null)); // {lat, lon, label}
  const [remindersOn, setRemindersOn] = useState(() => loadJSON(LS_REMINDERS, false));
  const [azanPlaying, setAzanPlaying] = useState(false);
  const [adhanReady, setAdhanReady] = useState(false); // true once the Azan file has loaded
  const [extraRem, setExtraRem] = useState(() => ({ ...DEFAULT_EXTRA_REM, ...loadJSON(LS_EXTRA_REM, {}) }));
  const [worshipTab, setWorshipTab] = useState('tasbih');
  const [mobileMore, setMobileMore] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(
    () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
  );
  useEffect(() => {
    localStorage.setItem(LS_EXTRA_REM, JSON.stringify(extraRem));
  }, [extraRem]);

  // Turning an extra reminder on also asks for notification permission (from a tap, as browsers require).
  const setExtra = async (key, val) => {
    if (val && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission().catch(() => {});
    }
    setExtraRem((p) => ({ ...p, [key]: val }));
  };

  // PWA: make sure the manifest/icons are linked, register the service worker (built app only,
  // so development never serves stale files), and catch the browser's install prompt.
  useEffect(() => {
    const head = document.head;
    if (!head.querySelector('link[rel="manifest"]')) {
      const l = document.createElement('link');
      l.rel = 'manifest';
      l.href = '/manifest.webmanifest';
      head.appendChild(l);
    }
    if (!head.querySelector('meta[name="theme-color"]')) {
      const m = document.createElement('meta');
      m.name = 'theme-color';
      m.content = '#667C68';
      head.appendChild(m);
    }
    if (!head.querySelector('link[rel="apple-touch-icon"]')) {
      const l = document.createElement('link');
      l.rel = 'apple-touch-icon';
      l.href = '/apple-touch-icon.png';
      head.appendChild(l);
    }
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try {
      await installPrompt.userChoice;
    } catch {
      // dismissed
    }
    setInstallPrompt(null);
  };
  const adhanAudioRef = useRef(null);

  useEffect(() => {
    if (prayerLocation) localStorage.setItem(LS_PRAYER_LOCATION, JSON.stringify(prayerLocation));
  }, [prayerLocation]);
  useEffect(() => {
    localStorage.setItem(LS_REMINDERS, JSON.stringify(remindersOn));
  }, [remindersOn]);

  // If location permission was already granted, quietly re-check position when the
  // app opens or returns to the foreground, so prayer times follow you when you
  // travel. A city you searched for manually is never overwritten.
  useEffect(() => {
    if (!navigator.geolocation || !navigator.permissions?.query) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const st = await navigator.permissions.query({ name: 'geolocation' });
        if (st.state !== 'granted') return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            const { latitude: lat, longitude: lon } = pos.coords;
            setPrayerLocation((prev) => {
              if (prev && prev.label !== 'Current location') return prev;
              if (prev && haversineKm(prev.lat, prev.lon, lat, lon) < 10) return prev;
              return { lat, lon, label: 'Current location' };
            });
          },
          () => {},
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
        );
      } catch {
        // Permissions API unsupported for geolocation — the manual button still works.
      }
    };
    refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const playAdhanCue = useCallback(() => {
    const a = adhanAudioRef.current;
    if (ADHAN_AUDIO_URL && a) {
      a.muted = false;
      a.currentTime = 0;
      a.play().catch(() => playReminderChime());
    } else {
      playReminderChime();
    }
  }, []);

  const stopAzan = useCallback(() => {
    const a = adhanAudioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    setAzanPlaying(false);
  }, []);

  // Runs from a tap, so the browser lets us "unlock" audio now and play it
  // later at prayer time (browsers otherwise block sound nobody asked for).
  const toggleReminders = async () => {
    if (!remindersOn) {
      const a = adhanAudioRef.current;
      if (a) {
        a.muted = true;
        a.play()
          .then(() => {
            a.pause();
            a.currentTime = 0;
            a.muted = false;
          })
          .catch(() => {
            a.muted = false;
          });
      }
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission().catch(() => {});
      }
    }
    setRemindersOn((v) => !v);
  };

  // Clock check every 5 s instead of one long timeout per prayer: survives
  // background-tab throttling and sleep, and rolls over to the next day by itself.
  // Extra reminders (Duha, Tahajjud, Friday Al-Kahf, suhoor, iftar, Sunnah-fast eve) read from
  // refs so toggling one never restarts the loop.
  const extraRemRef = useRef(extraRem);
  extraRemRef.current = extraRem;
  const remindersOnRef = useRef(remindersOn);
  remindersOnRef.current = remindersOn;
  const engineActive = remindersOn || Object.values(extraRem).some(Boolean);

  useEffect(() => {
    if (!engineActive || !prayerLocation) return undefined;
    let cancelled = false;
    let cfg = null; // { tz, date, times }
    let fetching = false;
    let lastFetchAt = 0;
    const fired = new Set(loadJSON(LS_REMINDERS_FIRED, []));

    const load = () => {
      fetching = true;
      lastFetchAt = Date.now();
      const ts = Math.floor(Date.now() / 1000);
      fetch(`${ADHAN_API}/timings/${ts}?latitude=${prayerLocation.lat}&longitude=${prayerLocation.lon}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          if (cancelled) return;
          const times = {};
          Object.keys(data.data.timings).forEach((k) => {
            times[k] = String(data.data.timings[k]).split(' ')[0];
          });
          const [dd, mm, yyyy] = String(data.data.date?.gregorian?.date || '').split('-');
          cfg = { tz: data.data.meta?.timezone, times, date: yyyy ? `${yyyy}-${mm}-${dd}` : null };
        })
        .catch(() => {})
        .finally(() => {
          fetching = false;
        });
    };

    const fire = (id, title, body, withAzan) => {
      if (fired.has(id)) return;
      fired.add(id);
      localStorage.setItem(LS_REMINDERS_FIRED, JSON.stringify([...fired].slice(-60)));
      if (withAzan) playAdhanCue();
      else playReminderChime();
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, { body, tag: id });
        } catch {
          // Notification constructor can throw in some contexts — ignore.
        }
      }
    };

    const tick = () => {
      const { date, minutes } = zonedNow(cfg?.tz);
      if ((!cfg || cfg.date !== date) && !fetching && Date.now() - lastFetchAt > 60000) load();
      if (!cfg || cfg.date !== date) return;
      const due = (target) => target != null && minutes - target >= 0 && minutes - target <= REMINDER_GRACE_MIN;

      if (remindersOnRef.current) {
        REMINDER_PRAYERS.forEach((key) => {
          if (due(timeToMin(cfg.times[key]))) fire(`${date}-${key}`, `${key} — time for prayer`, 'It is time for Salah.', true);
        });
      }

      const ex = extraRemRef.current;
      if (Object.values(ex).some(Boolean)) {
        const x = computeExtraTimes(cfg.times);
        const day = parseKey(date);
        const adjust = getHijriAdjust();
        const hj = HIJRI_FMT ? toHijri(day, adjust) : null;
        if (ex.duha && due(timeToMin(x.duhaStart))) fire(`${date}-Duha`, 'Duha prayer time', 'The time for Salat ad-Duha has begun.');
        if (ex.tahajjud && due(timeToMin(x.lastThirdThisMorning)))
          fire(`${date}-Tahajjud`, 'Last third of the night', 'A blessed time for Tahajjud and dua.');
        if (ex.kahf && day.getDay() === 5 && due(timeToMin(x.duhaStart)))
          fire(`${date}-Kahf`, "Jumu'ah: Surah Al-Kahf", 'It is Friday. Read Surah Al-Kahf.');
        if (hj && hj.m === 9) {
          const fajr = timeToMin(cfg.times.Fajr);
          const maghrib = timeToMin(cfg.times.Maghrib);
          if (ex.suhoor && fajr != null && due(fajr - 45)) fire(`${date}-Suhoor`, 'Suhoor', 'Fajr is in 45 minutes. Eat suhoor and make your intention.');
          if (ex.iftar && maghrib != null && due(maghrib - 10)) fire(`${date}-Iftar`, 'Iftar soon', 'Maghrib is in 10 minutes.');
        }
        if (ex.sunnahFast && due(timeToMin(cfg.times.Isha))) {
          const tomorrow = parseKey(addDaysKey(date, 1));
          const info = sunnahFastInfo(tomorrow, HIJRI_FMT ? toHijri(tomorrow, adjust) : null);
          if (info) fire(`${date}-FastEve`, 'Sunnah fast tomorrow', `${info.label}. Make your intention and eat suhoor.`);
        }
      }
    };

    tick();
    const iv = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [engineActive, prayerLocation, playAdhanCue]);

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

  const [translationLang, setTranslationLang] = useState(() => {
    const v = localStorage.getItem(LS_TRANSLATION_LANG);
    return v && TRANSLATION_OPTIONS[v] ? v : DEFAULT_TRANSLATION;
  });

  useEffect(() => {
    localStorage.setItem(LS_TRANSLATION_LANG, translationLang);
  }, [translationLang]);

  useEffect(() => {
    localStorage.setItem(LS_RECITER, reciter);
  }, [reciter]);

  useEffect(() => {
    fetch(`${API_BASE}/edition/format/audio`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        const all = data.data || [];
        // Only offer the curated, reliably-working reciters — matched
        // against the live API response so names/identifiers stay accurate,
        // ordered to match TRUSTED_RECITERS (most familiar first).
        const trusted = TRUSTED_RECITERS.map((id) => all.find((e) => e.identifier === id)).filter(Boolean);
        setReciterList(trusted.length ? trusted : all.filter((e) => e.language === 'ar'));
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
    // Light (the warm cream/glass look) is the default first-visit experience.
    // Auto and Dark both remain one tap away via the theme button — this just
    // stops new visitors from landing on dark mode at night before they've
    // even seen the intended look.
    return v === 'dark' || v === 'light' || v === 'auto' ? v : 'light';
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
  // Reading focus: hide the translation and/or transliteration under each ayah.
  const [showTranslation, setShowTranslation] = useState(() => loadJSON(LS_SHOW_TRANSLATION, true));
  const [showTransliteration, setShowTransliteration] = useState(() => loadJSON(LS_SHOW_TRANSLIT, true));
  useEffect(() => {
    localStorage.setItem(LS_SHOW_TRANSLATION, JSON.stringify(showTranslation));
  }, [showTranslation]);
  useEffect(() => {
    localStorage.setItem(LS_SHOW_TRANSLIT, JSON.stringify(showTransliteration));
  }, [showTransliteration]);

  const [shareAyah, setShareAyah] = useState(null); // { ayah, surahMeta } while the verse-card modal is open
  const [verseActionsFor, setVerseActionsFor] = useState(null); // ayah currently showing the Verse Actions sheet, or null

  // ---------------- Audio ----------------
  const [currentAyahIdx, setCurrentAyahIdx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioWarning, setAudioWarning] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [playerHidden, setPlayerHidden] = useState(false);

  // ---------------- Multi-ayah selection & loop/repeat (memorization aid) ----------------
  const [selectMode, setSelectMode] = useState(false); // tapping an ayah sets range start/end instead of playing it
  const [rangeStart, setRangeStart] = useState(null); // numberInSurah
  const [rangeEnd, setRangeEnd] = useState(null); // numberInSurah, null while only the start is picked
  const [loopTarget, setLoopTarget] = useState(3); // desired repeat count; Infinity for "loop forever"
  const [loopRemaining, setLoopRemaining] = useState(0); // >0 while a loop is actively playing; 0 = not looping

  // Bismillah is recited before every surah except Al-Fatihah (where it is
  // ayah 1) and At-Tawbah (which has none). Fetched per reciter so the voice matches.
  const [bismillahUrl, setBismillahUrl] = useState('');
  const [bismillahActive, setBismillahActive] = useState(false); // for the player label
  const bismillahPlayingRef = useRef(false);
  const skipBismillahRef = useRef(false); // true when landing on ayah 1 via prev / reciter switch

  const audioRef = useRef(null);
  const ayahRefs = useRef({});
  const requestIdRef = useRef(0);
  const pendingJumpRef = useRef(null);
  const resumeRef = useRef(null); // { numberInSurah, wasPlaying } captured just before a reciter switch
  const reciterSwitchRef = useRef(false); // true = the next fetchAyahs call is a reciter-only refresh

  // ---------------- Fonts (Amiri for Arabic, Noto Sans Malayalam) ----------------
  useEffect(() => {
    const id = 'quran-app-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Amiri:wght@400;700&family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Malayalam:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap';
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

  // ---------------- Fetch: Bismillah audio for the chosen reciter ----------------
  useEffect(() => {
    let cancelled = false;
    setBismillahUrl('');
    fetch(`${API_BASE}/ayah/1/${reciter}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        const d = data?.data;
        setBismillahUrl(d?.audio || d?.audioSecondary?.[0] || '');
      })
      .catch(() => {
        if (!cancelled) setBismillahUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [reciter]);

  // ---------------- Fetch: Ayahs for a Surah ----------------
  const fetchAyahs = useCallback(
    (num, opts = {}) => {
      const { preserveList = false } = opts;
      const myId = ++requestIdRef.current;
      setAyahsLoading(true);
      setAyahsError(null);
      if (!preserveList) {
        setAyahs([]);
        setSurahMeta(null);
        setCurrentAyahIdx(-1);
        setIsPlaying(false);
      }

      fetch(`${API_BASE}/surah/${num}/editions/${buildEditions(reciter, TRANSLATION_OPTIONS[translationLang].edition)}`)
        .then((r) => {
          if (!r.ok) throw new Error('Could not load this Surah. Please try again.');
          return r.json();
        })
        .then((data) => {
          if (myId !== requestIdRef.current) return;
          const [arabicEd, translationEd, translitEd, audioEd] = data.data;
          const merged = arabicEd.ayahs.map((a, i) => {
            const audioEntry = audioEd.ayahs[i];
            // Some editions leave the primary `audio` field empty for certain
            // ayahs even though a working URL exists elsewhere — fall back to
            // audioSecondary, the alternate mirror the API itself provides.
            // (A previous version of this also guessed a CDN URL with a
            // hardcoded bitrate, but not every reciter is actually hosted at
            // that bitrate — for those it 404'd on literally every ayah,
            // which combined with auto-skip-on-error caused a runaway
            // cascade through the whole surah. Only trust URLs the API
            // actually hands back.)
            const audioUrl = audioEntry?.audio || audioEntry?.audioSecondary?.[0] || '';
            return {
              globalNumber: a.number,
              numberInSurah: a.numberInSurah,
              arabic: a.text,
              translation: translationEd.ayahs[i]?.text || '',
              transliteration: translitEd.ayahs[i]?.text || '',
              audioUrl,
            };
          });
          setAyahs(merged);
          setSurahMeta({
            number: arabicEd.number,
            name: arabicEd.name,
            englishName: arabicEd.englishName,
            englishNameTranslation: arabicEd.englishNameTranslation,
            revelationType: arabicEd.revelationType,
            numberOfAyahs: arabicEd.numberOfAyahs,
          });

          // A reciter switch mid-playback: put the same ayah back up in the
          // new voice instead of losing your place.
          if (resumeRef.current) {
            const { numberInSurah, wasPlaying } = resumeRef.current;
            resumeRef.current = null;
            const idx = merged.findIndex((a) => a.numberInSurah === numberInSurah);
            if (idx >= 0) {
              skipBismillahRef.current = true; // resuming, not starting fresh
              setCurrentAyahIdx(idx);
              setIsPlaying(wasPlaying);
            }
          }
        })
        .catch((err) => {
          if (myId !== requestIdRef.current) return;
          setAyahsError(err.message || 'Something went wrong.');
        })
        .finally(() => {
          if (myId === requestIdRef.current) setAyahsLoading(false);
        });
    },
    [reciter, translationLang]
  );

  useEffect(() => {
    if (selectedSurah) {
      fetchAyahs(selectedSurah, { preserveList: reciterSwitchRef.current });
      reciterSwitchRef.current = false;
    }
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
  const currentAyah = currentAyahIdx >= 0 ? ayahs[currentAyahIdx] : null;
  const currentAudioUrl = currentAyah?.audioUrl || '';
  const audioFailStreakRef = useRef(0);
  const MAX_AUTO_SKIP_STREAK = 2; // stop auto-advancing after this many failures in a row

  const registerAudioFailure = () => {
    audioFailStreakRef.current += 1;
    if (audioFailStreakRef.current > MAX_AUTO_SKIP_STREAK) {
      // Several ayahs in a row have no working audio for this reciter —
      // stop instead of racing silently through the rest of the surah.
      audioFailStreakRef.current = 0;
      setIsPlaying(false);
      setAudioWarning(
        `Several ayahs in a row have no audio available for this reciter. Try a different reciter, or continue reading without audio.`
      );
      return;
    }
    if (isPlaying) handleNext();
  };

  useEffect(() => {
    if (!currentAyah || !audioRef.current) return;

    if (!currentAudioUrl) {
      // This reciter has no recording for this ayah.
      registerAudioFailure();
      return;
    }

    const skipBism = skipBismillahRef.current;
    skipBismillahRef.current = false;
    const needsBismillah =
      isPlaying &&
      !skipBism &&
      loopRemaining === 0 &&
      currentAyahIdx === 0 &&
      currentAyah.numberInSurah === 1 &&
      surahMeta &&
      surahMeta.number !== 1 &&
      surahMeta.number !== 9 &&
      !!bismillahUrl;

    if (needsBismillah) {
      // Recite the Bismillah first; handleEnded then moves on to ayah 1.
      bismillahPlayingRef.current = true;
      setBismillahActive(true);
      audioRef.current.src = bismillahUrl;
      audioRef.current.play().catch(() => {
        bismillahPlayingRef.current = false;
        setBismillahActive(false);
        setIsPlaying(false);
      });
    } else {
      bismillahPlayingRef.current = false;
      setBismillahActive(false);
      if (audioRef.current.src !== currentAudioUrl) {
        audioRef.current.src = currentAudioUrl;
      }
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
    }

    if (surahMeta) {
      setLastRead({
        surahNumber: surahMeta.number,
        surahName: surahMeta.englishName,
        numberInSurah: currentAyah.numberInSurah,
      });
    }

    ayahRefs.current[currentAyah.globalNumber]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAyahIdx, currentAudioUrl]);

  // Replays whatever ayah is current from the start. Needed because setting the
  // same ayah index again does not re-run the audio effect — this is why a
  // single-ayah loop used to stall after the first play.
  const restartCurrentAudio = () => {
    const a = audioRef.current;
    if (!a || !currentAudioUrl) return;
    bismillahPlayingRef.current = false;
    setBismillahActive(false);
    if (a.src !== currentAudioUrl) a.src = currentAudioUrl;
    a.currentTime = 0;
    a.play().catch(() => setIsPlaying(false));
  };

  const handleAudioError = () => {
    if (bismillahPlayingRef.current) {
      // Bismillah recording failed — skip it and go straight to the ayah.
      bismillahPlayingRef.current = false;
      setBismillahActive(false);
      setBismillahUrl('');
      if (audioRef.current && currentAudioUrl) {
        audioRef.current.src = currentAudioUrl;
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
      return;
    }
    // A specific recording failed to load/play (missing file, network blip,
    // etc.) — try skipping ahead, but the streak counter stops it from
    // cascading unchecked if the whole reciter is broken.
    registerAudioFailure();
  };

  const handleAudioPlaying = () => {
    // Confirms this ayah's audio actually started — clear the failure streak
    // and any warning from earlier skips.
    audioFailStreakRef.current = 0;
    setAudioWarning(null);
  };

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
    audioFailStreakRef.current = 0;
    setAudioWarning(null);
    setLoopRemaining(0); // manual selection overrides an active loop
    if (idx === currentAyahIdx) {
      // Same ayah again: the index won't change, so restart it directly.
      setIsPlaying(true);
      restartCurrentAudio();
      return;
    }
    setCurrentAyahIdx(idx);
    setIsPlaying(true);
  };

  const handleNext = () => {
    setLoopRemaining(0);
    if (currentAyahIdx < ayahs.length - 1) {
      setCurrentAyahIdx((i) => i + 1);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const handlePrev = () => {
    setLoopRemaining(0);
    if (currentAyahIdx > 0) {
      skipBismillahRef.current = true; // stepping back to ayah 1 shouldn't re-recite Bismillah
      setCurrentAyahIdx((i) => i - 1);
      setIsPlaying(true);
    }
  };

  // Ayah tap handler while in selection mode: first tap sets the range
  // start, second tap sets the end (order-independent — tapping an earlier
  // ayah second just becomes the new start). Tapping while a full range is
  // already set starts a fresh selection.
  const handleAyahSelectTap = (ayah) => {
    if (rangeStart === null || rangeEnd !== null) {
      setRangeStart(ayah.numberInSurah);
      setRangeEnd(null);
    } else {
      setRangeStart(Math.min(rangeStart, ayah.numberInSurah));
      setRangeEnd(Math.max(rangeStart, ayah.numberInSurah));
    }
  };

  const clearSelection = () => {
    setRangeStart(null);
    setRangeEnd(null);
    setSelectMode(false);
  };

  const startLoop = () => {
    if (rangeStart === null) return;
    const startIdx = ayahs.findIndex((a) => a.numberInSurah === rangeStart);
    if (startIdx < 0) return;
    audioFailStreakRef.current = 0;
    setAudioWarning(null);
    setSelectMode(false);
    setLoopRemaining(loopTarget === Infinity ? Infinity : loopTarget);
    setIsPlaying(true);
    if (startIdx === currentAyahIdx) {
      restartCurrentAudio(); // e.g. single ayah that is already loaded
    } else {
      setCurrentAyahIdx(startIdx);
    }
  };

  const stopLoop = () => {
    setLoopRemaining(0);
  };

  const handleEnded = () => {
    if (bismillahPlayingRef.current) {
      // Bismillah finished — now the surah's first ayah.
      bismillahPlayingRef.current = false;
      setBismillahActive(false);
      if (audioRef.current && currentAudioUrl) {
        audioRef.current.src = currentAudioUrl;
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
      return;
    }
    if (loopRemaining > 0 && rangeStart !== null) {
      const rangeEndValue = rangeEnd ?? rangeStart;
      const finishedAyah = ayahs[currentAyahIdx];
      if (finishedAyah && finishedAyah.numberInSurah === rangeEndValue) {
        // Reached the end of the selected range — loop back to the start,
        // or stop if this was the last repetition.
        const nextRemaining = loopRemaining === Infinity ? Infinity : loopRemaining - 1;
        if (nextRemaining <= 0) {
          setLoopRemaining(0);
          setIsPlaying(false);
          return;
        }
        const startIdx = ayahs.findIndex((a) => a.numberInSurah === rangeStart);
        setLoopRemaining(nextRemaining);
        setIsPlaying(true);
        if (startIdx < 0 || startIdx === currentAyahIdx) {
          restartCurrentAudio(); // single-ayah loop: same index, so restart directly
        } else {
          setCurrentAyahIdx(startIdx);
        }
        return;
      }
      // Still inside the range — continue to the next ayah normally.
      if (currentAyahIdx < ayahs.length - 1) {
        setCurrentAyahIdx((i) => i + 1);
        setIsPlaying(true);
      }
      return;
    }
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

  const toggleMute = () => {
    if (!audioRef.current) return;
    const next = !audioRef.current.muted;
    audioRef.current.muted = next;
    setIsMuted(next);
  };

  const resetPlayback = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.muted = false;
    audioRef.current.volume = 1;
    setIsMuted(false);
    setProgress(0);
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
    audioFailStreakRef.current = 0;
    setAudioWarning(null);
    setSelectMode(false);
    setRangeStart(null);
    setRangeEnd(null);
    setLoopRemaining(0);
    if (jumpToAyah) pendingJumpRef.current = jumpToAyah;
    setSelectedSurah(num);
    setSection('quran');
    setMobileView('reader');
    setShowBookmarksPanel(false);
  };

  const changeTranslation = (code) => {
    if (code === translationLang) return;
    // Reuses the same resume mechanism built for reciter switching: the
    // Arabic text and audio don't change, only the translation column, so
    // there's no reason to lose playback position or interrupt audio.
    if (currentAyahIdx >= 0 && ayahs[currentAyahIdx]) {
      resumeRef.current = {
        numberInSurah: ayahs[currentAyahIdx].numberInSurah,
        wasPlaying: isPlaying,
      };
      reciterSwitchRef.current = true;
    }
    setTranslationLang(code);
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
  // Design tokens ("Neumorphic Tactile", Version 3): one soft base colour for page AND surfaces; depth comes
  // only from a light shadow (top-left) and a dark shadow (bottom-right). Raised = interactive/solid,
  // inset = pressed, selected or an input well. Sage stays the single accent. Every screen reads these tokens.
  const t = isDark
    ? {
        appBg: 'bg-[#2B302C]',
        headerBg: 'bg-[#2B302C]/95 backdrop-blur-xl border-transparent shadow-[0_6px_18px_rgba(0,0,0,0.35)]',
        sidebarBg: 'bg-[#2B302C] border-transparent',
        cardBg: 'bg-[#2B302C] border border-transparent shadow-[8px_8px_18px_rgba(0,0,0,0.5),-8px_-8px_18px_rgba(255,255,255,0.045)] transition-[box-shadow,background-color] duration-200',
        cardActive: 'bg-[#2B302C] border border-transparent shadow-[inset_5px_5px_11px_rgba(0,0,0,0.55),inset_-5px_-5px_11px_rgba(255,255,255,0.05)] ring-1 ring-[#8FAE86]/25',
        text: 'text-[#E9ECE7]',
        textMuted: 'text-[#A6ADA5]',
        textFaint: 'text-[#7B827C]',
        inputBg: 'bg-[#2B302C] border-transparent shadow-[inset_3px_3px_7px_rgba(0,0,0,0.5),inset_-3px_-3px_7px_rgba(255,255,255,0.045)] text-[#E9ECE7] placeholder-[#7B827C]',
        accent: 'text-[#9DBB93]',
        accentBg: 'bg-[#587160] hover:bg-[#617C69] shadow-[4px_4px_10px_rgba(0,0,0,0.5),-3px_-3px_8px_rgba(255,255,255,0.05)] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(150,185,155,0.18)]',
        divider: 'border-white/10',
        playerBg: 'bg-[#2B302C] border-transparent shadow-[8px_8px_20px_rgba(0,0,0,0.55),-8px_-8px_20px_rgba(255,255,255,0.045)]',
        chipMeccan: 'bg-[#2B302C] text-amber-300 border border-transparent shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.045)]',
        chipMedinan: 'bg-[#2B302C] text-[#9DBB93] border border-transparent shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.045)]',
        hoverSoft: 'hover:bg-white/[0.04] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.5),inset_-3px_-3px_7px_rgba(255,255,255,0.045)]',
        glassPanel: 'bg-[#2B302C] border border-transparent shadow-[8px_8px_20px_rgba(0,0,0,0.55),-8px_-8px_20px_rgba(255,255,255,0.045)]',
        iconBtn: 'bg-[#2B302C] border border-transparent shadow-[4px_4px_9px_rgba(0,0,0,0.5),-4px_-4px_9px_rgba(255,255,255,0.045)] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.55),inset_-3px_-3px_7px_rgba(255,255,255,0.045)] transition-[box-shadow,background-color] duration-200',
        btn: 'bg-[#2B302C] border border-transparent shadow-[4px_4px_9px_rgba(0,0,0,0.5),-4px_-4px_9px_rgba(255,255,255,0.045)] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.55),inset_-3px_-3px_7px_rgba(255,255,255,0.045)] transition-[box-shadow,background-color] duration-200',
        btnLg: 'bg-[#2B302C] border border-transparent shadow-[12px_12px_26px_rgba(0,0,0,0.6),-12px_-12px_26px_rgba(255,255,255,0.05)] active:shadow-[inset_8px_8px_18px_rgba(0,0,0,0.6),inset_-8px_-8px_18px_rgba(255,255,255,0.05)] transition-[box-shadow] duration-200',
        heroBg: 'bg-gradient-to-br from-[#4A6350] to-[#33463A] text-white border border-transparent shadow-[8px_8px_18px_rgba(0,0,0,0.5),-8px_-8px_18px_rgba(255,255,255,0.045)]',
        sheetBg: 'bg-[#2B302C] border border-transparent shadow-[14px_14px_34px_rgba(0,0,0,0.65),-10px_-10px_26px_rgba(255,255,255,0.05)]',
        pillTrack: 'bg-[#2B302C] border border-transparent shadow-[inset_3px_3px_7px_rgba(0,0,0,0.5),inset_-3px_-3px_7px_rgba(255,255,255,0.045)]',
        pillActive: 'bg-[#2B302C] text-[#9DBB93] shadow-[3px_3px_7px_rgba(0,0,0,0.5),-3px_-3px_7px_rgba(255,255,255,0.05)]',
        pillPressed: 'bg-[#2B302C] text-[#9DBB93] shadow-[inset_3px_3px_7px_rgba(0,0,0,0.55),inset_-3px_-3px_7px_rgba(255,255,255,0.045)]',
      }
    : {
        appBg: 'bg-[#E8E5DC]',
        headerBg: 'bg-[#E8E5DC]/95 backdrop-blur-xl border-transparent shadow-[0_6px_16px_rgba(166,160,141,0.35)]',
        sidebarBg: 'bg-[#E8E5DC] border-transparent',
        cardBg: 'bg-[#E8E5DC] border border-transparent shadow-[8px_8px_18px_rgba(166,160,141,0.5),-8px_-8px_18px_rgba(255,255,255,0.95)] transition-[box-shadow,background-color] duration-200',
        cardActive: 'bg-[#E8E5DC] border border-transparent shadow-[inset_5px_5px_11px_rgba(166,160,141,0.55),inset_-5px_-5px_11px_rgba(255,255,255,0.95)] ring-1 ring-[#667C68]/20',
        text: 'text-[#2B312C]',
        textMuted: 'text-[#5E655F]',
        textFaint: 'text-[#858B82]',
        inputBg: 'bg-[#E8E5DC] border-transparent shadow-[inset_3px_3px_7px_rgba(166,160,141,0.55),inset_-3px_-3px_7px_rgba(255,255,255,0.95)] text-[#2B312C] placeholder-[#858B82]',
        accent: 'text-[#3F5544]',
        accentBg: 'bg-[#5A7160] hover:bg-[#516755] shadow-[4px_4px_10px_rgba(63,85,68,0.38),-3px_-3px_8px_rgba(255,255,255,0.85)] active:shadow-[inset_3px_3px_7px_rgba(35,52,40,0.5),inset_-2px_-2px_5px_rgba(120,150,125,0.4)]',
        divider: 'border-[#B9B5A6]/45',
        playerBg: 'bg-[#E8E5DC] border-transparent shadow-[8px_8px_20px_rgba(166,160,141,0.55),-8px_-8px_20px_rgba(255,255,255,0.95)]',
        chipMeccan: 'bg-[#E8E5DC] text-[#8A6A2E] border border-transparent shadow-[inset_2px_2px_5px_rgba(166,160,141,0.55),inset_-2px_-2px_5px_rgba(255,255,255,0.95)]',
        chipMedinan: 'bg-[#E8E5DC] text-[#3F5544] border border-transparent shadow-[inset_2px_2px_5px_rgba(166,160,141,0.55),inset_-2px_-2px_5px_rgba(255,255,255,0.95)]',
        hoverSoft: 'hover:bg-[#667C68]/[0.06] active:shadow-[inset_3px_3px_7px_rgba(166,160,141,0.5),inset_-3px_-3px_7px_rgba(255,255,255,0.9)]',
        glassPanel: 'bg-[#E8E5DC] border border-transparent shadow-[8px_8px_20px_rgba(166,160,141,0.55),-8px_-8px_20px_rgba(255,255,255,0.95)]',
        iconBtn: 'bg-[#E8E5DC] border border-transparent shadow-[4px_4px_9px_rgba(166,160,141,0.55),-4px_-4px_9px_rgba(255,255,255,0.95)] active:shadow-[inset_3px_3px_7px_rgba(166,160,141,0.55),inset_-3px_-3px_7px_rgba(255,255,255,0.95)] transition-[box-shadow,background-color] duration-200',
        btn: 'bg-[#E8E5DC] border border-transparent shadow-[4px_4px_9px_rgba(166,160,141,0.55),-4px_-4px_9px_rgba(255,255,255,0.95)] active:shadow-[inset_3px_3px_7px_rgba(166,160,141,0.55),inset_-3px_-3px_7px_rgba(255,255,255,0.95)] transition-[box-shadow,background-color] duration-200',
        btnLg: 'bg-[#E8E5DC] border border-transparent shadow-[12px_12px_26px_rgba(166,160,141,0.6),-12px_-12px_26px_rgba(255,255,255,0.98)] active:shadow-[inset_8px_8px_18px_rgba(166,160,141,0.6),inset_-8px_-8px_18px_rgba(255,255,255,0.98)] transition-[box-shadow] duration-200',
        heroBg: 'bg-gradient-to-br from-[#62796A] to-[#46604C] text-white border border-transparent shadow-[8px_8px_18px_rgba(166,160,141,0.55),-8px_-8px_18px_rgba(255,255,255,0.95)]',
        sheetBg: 'bg-[#E8E5DC] border border-transparent shadow-[14px_14px_34px_rgba(120,115,98,0.45),-10px_-10px_28px_rgba(255,255,255,0.9)]',
        pillTrack: 'bg-[#E8E5DC] border border-transparent shadow-[inset_3px_3px_7px_rgba(166,160,141,0.55),inset_-3px_-3px_7px_rgba(255,255,255,0.95)]',
        pillActive: 'bg-[#E8E5DC] text-[#3F5544] shadow-[3px_3px_7px_rgba(166,160,141,0.55),-3px_-3px_7px_rgba(255,255,255,0.95)]',
        pillPressed: 'bg-[#E8E5DC] text-[#3F5544] shadow-[inset_3px_3px_7px_rgba(166,160,141,0.55),inset_-3px_-3px_7px_rgba(255,255,255,0.95)]',
      };

  return (
    <div className={`min-h-screen ${t.appBg} ${t.text}`} style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        .font-arabic { font-family: 'Noto Naskh Arabic', 'Amiri', 'Traditional Arabic', serif; }
        /* Motion scale: micro 180ms / standard 300ms / sanctuary 600ms */
        :root { --motion-micro: 180ms; --motion-standard: 300ms; --motion-sanctuary: 600ms; --ease-serene: cubic-bezier(0.2, 0.7, 0.2, 1); }
        .transition, .transition-all, .transition-colors, .transition-transform, .transition-opacity, .transition-shadow {
          transition-duration: var(--motion-micro);
          transition-timing-function: var(--ease-serene);
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
        }
        button:focus-visible, a:focus-visible, input:focus-visible, [role="switch"]:focus-visible { outline: 2px solid #667C68; outline-offset: 2px; }
        ::selection { background: rgba(102, 124, 104, 0.28); }
        .font-malayalam { font-family: 'Noto Sans Malayalam', sans-serif; }
        .font-hindi { font-family: 'Noto Sans Devanagari', sans-serif; }
        .font-urdu { font-family: 'Noto Nastaliq Urdu', serif; }
        input[type="range"] { -webkit-appearance: none; background: transparent; }
        input[type="range"]::-webkit-slider-runnable-track {
          height: 4px; border-radius: 9999px;
          background: ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(102,128,107,0.15)'};
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; margin-top: -5px;
          width: 14px; height: 14px; border-radius: 9999px; background: #667C68;
          box-shadow: 0 0 0 3px rgba(102,128,107,0.2);
        }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(102,128,107,0.18)'}; border-radius: 9999px; }
        @keyframes sheetSlideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes backdropFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .sheet-enter { animation: sheetSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1); }
        .backdrop-enter { animation: backdropFadeIn 0.2s ease-out; }
      `}</style>

      {/* ---------------- Header ---------------- */}
      <header className={`sticky top-0 z-30 backdrop-blur border-b ${t.headerBg}`}>
        <div className="flex items-center gap-3 px-3 sm:px-4 py-3 max-w-7xl mx-auto">
          {section === 'quran' && mobileView === 'reader' && (
            <button
              onClick={() => setMobileView('list')}
              className={`md:hidden p-2 -ml-1 rounded-full ${t.iconBtn}`}
              aria-label="Back to Surah list"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          <div className={`items-center gap-2 shrink-0 ${section === 'quran' ? 'hidden md:flex' : 'flex'}`}>
            <div
              className={`w-10 h-10 rounded-2xl ${t.heroBg} flex items-center justify-center font-arabic text-xl`}
            >
              ق
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="font-semibold">Al-Qur'an</div>
              <div className={`text-xs ${t.textMuted}`}>Arabic · Translation · Transliteration</div>
            </div>
          </div>

          <div className={`hidden md:flex items-center gap-1 rounded-2xl ${t.pillTrack} p-1 shrink-0`}>
            <button
              onClick={() => setSection('quran')}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                section === 'quran' ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
              }`}
              title="Qur'an"
            >
              <BookOpen size={14} />
              <span className="hidden sm:inline">Qur'an</span>
            </button>
            <button
              onClick={() => setSection('prayer')}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                section === 'prayer' ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
              }`}
              title="Prayer"
            >
              <Clock size={14} />
              <span className="hidden sm:inline">Prayer</span>
            </button>
            <button
              onClick={() => setSection('duas')}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                section === 'duas' ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
              }`}
              title="Duas"
            >
              <Sparkles size={14} />
              <span className="hidden sm:inline">Duas</span>
            </button>
            <button
              onClick={() => setSection('worship')}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                section === 'worship' ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
              }`}
              title="Ibadah: tasbih, adhkar, prayer tracker, Ramadan"
            >
              <Heart size={14} />
              <span className="hidden sm:inline">Ibadah</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowMoreMenu((v) => !v)}
                className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                  section === 'progress' || section === 'learn' || section === 'hijri'
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
                        setSection('hijri');
                        setShowMoreMenu(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left ${t.hoverSoft} ${
                        section === 'hijri' ? t.accent : ''
                      }`}
                    >
                      <CalendarDays size={15} /> Hijri Calendar
                    </button>
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
            <>
              {mobileView === 'reader' && surahMeta && (
                <div className="flex-1 min-w-0 text-center md:hidden">
                  <span className="text-sm font-semibold truncate block leading-tight">{surahMeta.englishName}</span>
                  <span className={`text-[11px] truncate block leading-tight ${t.textMuted}`}>
                    {surahMeta.numberOfAyahs} Ayahs<span className="hidden min-[420px]:inline"> · {surahMeta.revelationType}</span>
                  </span>
                </div>
              )}
              <div
                className={`relative max-w-md mx-auto ${
                  mobileView === 'reader' ? 'hidden md:flex md:flex-1' : 'flex-1'
                }`}
              >
                <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none ${t.textFaint}`} />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowBookmarksPanel(false);
                    setMobileView('list');
                  }}
                  placeholder="Search Surah…"
                  className={`w-full pl-10 pr-3 py-2.5 rounded-2xl border text-sm outline-none focus:ring-2 focus:ring-[#667C68]/40 ${t.inputBg}`}
                />
              </div>
            </>
          ) : (
            <div className="flex-1" />
          )}

          {section === 'quran' && (
            <button
              onClick={() => setShowTranslation((v) => !v)}
              className={`p-2 rounded-xl ${t.iconBtn} flex items-center gap-1.5`}
              title={showTranslation ? 'Hide translation (Arabic-focused reading)' : 'Show translation'}
              aria-label={showTranslation ? 'Hide translation' : 'Show translation'}
              aria-pressed={!showTranslation}
            >
              {showTranslation ? <Eye size={18} /> : <EyeOff size={18} className={t.accent} />}
              <span className={`hidden sm:inline text-[10px] font-medium ${showTranslation ? '' : t.accent}`}>
                {showTranslation ? 'TRANSLATION' : 'HIDDEN'}
              </span>
            </button>
          )}

          {section === 'quran' && (
            <button
              onClick={() => {
                setShowBookmarksPanel((v) => !(v && panelTab === 'bookmarks'));
                setPanelTab('bookmarks');
                setMobileView('list');
              }}
              className={`relative p-2 rounded-xl ${t.iconBtn}`}
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
              className={`relative p-2 rounded-xl ${t.iconBtn}`}
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
            className={`p-2 rounded-xl ${t.iconBtn} flex items-center gap-1.5`}
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
                          className={`px-2.5 py-1 rounded-xl text-xs font-medium transition ${
                            panelTab === 'bookmarks' ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
                          }`}
                        >
                          Bookmarks
                        </button>
                        <button
                          onClick={() => setPanelTab('notes')}
                          className={`px-2.5 py-1 rounded-xl text-xs font-medium transition ${
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
                    {lastRead && (() => {
                      const total = surahList.find((x) => x.number === lastRead.surahNumber)?.numberOfAyahs;
                      const pct = total ? Math.min(100, Math.round((lastRead.numberInSurah / total) * 100)) : null;
                      return (
                        <button
                          onClick={() => selectSurah(lastRead.surahNumber, lastRead.numberInSurah)}
                          className={`w-full text-left p-4 mb-4 rounded-[28px] flex flex-col gap-3 transition ${t.heroBg}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">Continue Reading</span>
                            <BookOpen size={16} className="opacity-70" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs opacity-90 truncate">
                              {lastRead.surahName} · Ayah {lastRead.numberInSurah}
                            </div>
                            {pct !== null && (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="h-1.5 flex-1 rounded-full bg-white/20 overflow-hidden">
                                  <div className="h-full rounded-full bg-white/80" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[11px] opacity-80 tabular-nums">{pct}%</span>
                              </div>
                            )}
                          </div>
                          <span className="self-start inline-flex items-center gap-1.5 text-xs font-medium px-4 py-1.5 rounded-full bg-white/20 border border-white/25">
                            Continue <ChevronRight size={13} />
                          </span>
                        </button>
                      );
                    })()}

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

                    <p className={`text-[11px] text-center mb-2 ${t.textFaint}`}>
                      © {COPYRIGHT_YEAR} {COPYRIGHT_OWNER}. All rights reserved.
                    </p>

                    <div className="space-y-1.5">
                      {filteredSurahs.map((s) => (
                        <button
                          key={s.number}
                          onClick={() => selectSurah(s.number)}
                          className={`w-full text-left p-3.5 rounded-2xl border transition ${
                            selectedSurah === s.number ? t.cardActive : t.cardBg
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl ${t.iconBtn} flex items-center justify-center text-xs font-semibold shrink-0 ${t.accent}`}
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
                    <CopyrightNotice t={t} />
                  </>
                )}
              </div>
            </aside>

            {/* ---------------- Main reader ---------------- */}
            <main
              className={`flex-1 min-w-0 ${ayahs.length ? 'pb-32' : ''} ${
                mobileView === 'list' ? 'hidden md:block' : 'block'
              }`}
            >
              <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto">
                {!selectedSurah && (
                  <div className="flex flex-col items-center justify-center text-center py-24">
                    <div
                      className={`w-16 h-16 rounded-[28px] ${t.heroBg} flex items-center justify-center font-arabic text-3xl mb-4`}
                    >
                      ق
                    </div>
                    <h2 className="text-xl font-semibold mb-1">Welcome</h2>
                    <p className={`text-sm ${t.textMuted} max-w-sm`}>
                      Select a Surah from the list to begin reading, with Arabic script,
                      transliteration, and translation (Malayalam, Hindi, or Urdu) side by side.
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
                    <div className={`text-sm ${t.textMuted} mb-4`}>{surahMeta.englishNameTranslation}</div>
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      {[
                        ['Translation', showTranslation, setShowTranslation],
                        ['Transliteration', showTransliteration, setShowTransliteration],
                      ].map(([label, on, setOn]) => (
                        <button
                          key={label}
                          onClick={() => setOn((v) => !v)}
                          aria-pressed={on}
                          className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium border transition ${
                            on ? `${t.pillPressed} ${t.text}` : `${t.btn} ${t.textFaint} line-through`
                          }`}
                        >
                          {on ? <Eye size={12} /> : <EyeOff size={12} />}
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className={`flex items-center justify-center gap-1.5 ${showTranslation ? '' : 'hidden'}`}>
                      {Object.entries(TRANSLATION_OPTIONS).map(([code, opt]) => (
                        <button
                          key={code}
                          onClick={() => changeTranslation(code)}
                          className={`px-3 py-1 rounded-full text-[11px] font-medium border transition ${
                            translationLang === code
                              ? `${t.accentBg} text-white border-transparent`
                              : `${t.btn} ${t.textMuted}`
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedSurah && surahMeta && !ayahsLoading && ayahs.length > 0 && (
                  <div className="mb-6">
                    {loopRemaining > 0 ? (
                      <div className={`flex items-center justify-between gap-3 rounded-3xl border px-4 py-3 ${t.cardActive}`}>
                        <div className="flex items-center gap-2 text-sm min-w-0">
                          <Repeat size={16} className={`${t.accent} shrink-0`} />
                          <span className="truncate">
                            Looping Ayah {rangeEnd === null || rangeEnd === rangeStart ? rangeStart : `${rangeStart}–${rangeEnd}`} ·{' '}
                            {loopRemaining === Infinity
                              ? 'repeating forever'
                              : `${loopRemaining} repeat${loopRemaining === 1 ? '' : 's'} left`}
                          </span>
                        </div>
                        <button
                          onClick={stopLoop}
                          className={`text-xs px-3 py-1.5 rounded-full border shrink-0 ${t.divider} ${t.hoverSoft}`}
                        >
                          Stop
                        </button>
                      </div>
                    ) : selectMode ? (
                      <div className={`rounded-3xl border px-4 py-3 ${t.cardBg}`}>
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-sm font-medium">
                            {rangeStart === null
                              ? 'Tap an ayah to start your selection'
                              : rangeEnd === null
                              ? `Ayah ${rangeStart} selected — loop just this one, or tap another ayah for a range`
                              : rangeEnd === rangeStart
                              ? `Ayah ${rangeStart} selected`
                              : `Ayah ${rangeStart}–${rangeEnd} selected`}
                          </span>
                          <button onClick={clearSelection} className={`text-xs ${t.textMuted} hover:underline shrink-0`}>
                            Cancel
                          </button>
                        </div>
                        {rangeStart !== null && (
                          <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${t.textMuted}`}>Repeat</span>
                              <div className={`flex items-center gap-1 rounded-full border ${t.divider} p-0.5`}>
                                <button
                                  onClick={() => setLoopTarget((v) => (v === Infinity ? 10 : Math.max(1, v - 1)))}
                                  className={`w-6 h-6 rounded-full ${t.hoverSoft}`}
                                  aria-label="Fewer repeats"
                                >
                                  −
                                </button>
                                <span className="w-8 text-center text-sm tabular-nums">
                                  {loopTarget === Infinity ? '∞' : loopTarget}
                                </span>
                                <button
                                  onClick={() => setLoopTarget((v) => (v === Infinity ? Infinity : v + 1))}
                                  className={`w-6 h-6 rounded-full ${t.hoverSoft}`}
                                  aria-label="More repeats"
                                >
                                  +
                                </button>
                              </div>
                              <button
                                onClick={() => setLoopTarget((v) => (v === Infinity ? 3 : Infinity))}
                                className={`p-1.5 rounded-full ${
                                  loopTarget === Infinity ? `${t.accentBg} text-white` : `${t.hoverSoft} ${t.textFaint}`
                                }`}
                                title="Repeat forever"
                                aria-label="Repeat forever"
                              >
                                <InfinityIcon size={14} />
                              </button>
                            </div>
                            <button
                              onClick={startLoop}
                              className={`text-xs px-4 py-1.5 rounded-full ${t.accentBg} text-white`}
                            >
                              {rangeEnd === null || rangeEnd === rangeStart ? `Loop Ayah ${rangeStart}` : 'Start Loop'}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <button
                          onClick={() => setSelectMode(true)}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${t.btn} ${t.textMuted}`}
                        >
                          <Repeat size={13} />
                          Loop an ayah or range for memorization
                        </button>
                      </div>
                    )}
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
                    const isInRange =
                      rangeStart !== null &&
                      ayah.numberInSurah >= rangeStart &&
                      ayah.numberInSurah <= (rangeEnd ?? rangeStart);
                    const note = notes[key];
                    const isEditingNote = openNoteFor === ayah.globalNumber;
                    return (
                      <div
                        key={ayah.globalNumber}
                        ref={(el) => {
                          ayahRefs.current[ayah.globalNumber] = el;
                        }}
                        data-global-number={ayah.globalNumber}
                        className={`relative rounded-[28px] border p-5 sm:p-6 transition ${
                          isInRange
                            ? 'border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30'
                            : isActive
                            ? t.cardActive
                            : t.cardBg
                        }`}
                      >
                        {selectMode && (
                          <button
                            onClick={() => handleAyahSelectTap(ayah)}
                            className="absolute inset-0 z-10 rounded-3xl"
                            aria-label={`Select ayah ${ayah.numberInSurah}`}
                          />
                        )}
                        <div className="flex items-center justify-between mb-4">
                          <button
                            onClick={() => playAyah(idx)}
                            className={`flex items-center gap-2 text-xs font-medium ${t.accent}`}
                            aria-label={`Play ayah ${ayah.numberInSurah}`}
                          >
                            <span
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                                isActive
                                  ? `${t.accentBg} text-white shadow-sm`
                                  : `${t.iconBtn} ${t.textMuted}`
                              }`}
                            >
                              {ayah.numberInSurah}
                            </span>
                            {isActive && isPlaying ? <Pause size={14} /> : <Play size={14} className={isActive ? '' : t.textFaint} />}
                          </button>

                          <button
                            onClick={() => setVerseActionsFor({ ayah, idx })}
                            className={`p-2 rounded-full ${t.hoverSoft} ${
                              isBookmarked || note ? t.accent : isActive ? t.textMuted : t.textFaint
                            }`}
                            title="Verse actions"
                            aria-label="Verse actions"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </div>

                        <p
                          className={`font-arabic text-right leading-[2.4] mb-5 ${
                            beginnerMode ? 'text-5xl leading-[2.6]' : 'text-3xl'
                          }`}
                          dir="rtl"
                        >
                          {ayah.arabic}
                        </p>

                        {showTransliteration && (
                          <p
                            className={`italic ${t.textMuted} mb-2 leading-relaxed ${
                              beginnerMode ? 'text-base' : 'text-sm'
                            }`}
                          >
                            {ayah.transliteration}
                          </p>
                        )}
                        {showTranslation && (
                          <p
                            dir={TRANSLATION_OPTIONS[translationLang].dir}
                            className={`${TRANSLATION_OPTIONS[translationLang].fontClass} leading-relaxed ${t.textMuted} ${
                              beginnerMode ? 'text-lg' : 'text-[15px]'
                            }`}
                          >
                            {ayah.translation}
                          </p>
                        )}

                        {isActive && !selectMode && (
                          <div className="mt-5 flex justify-center">
                            <div className={`inline-flex items-center gap-1 p-1 rounded-full ${t.iconBtn}`}>
                              <button
                                onClick={() => (isPlaying ? handlePlayPause() : playAyah(idx))}
                                className={`w-9 h-9 rounded-full flex items-center justify-center ${t.accentBg} text-white shadow-sm`}
                                aria-label={isPlaying ? 'Pause this ayah' : 'Play this ayah'}
                              >
                                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                              </button>
                              <button
                                onClick={() => toggleBookmark(ayah)}
                                className={`w-9 h-9 rounded-full flex items-center justify-center ${t.hoverSoft} ${isBookmarked ? t.accent : t.textMuted}`}
                                aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this ayah'}
                              >
                                {isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                              </button>
                              <button
                                onClick={() => setShareAyah({ ayah, surahMeta })}
                                className={`w-9 h-9 rounded-full flex items-center justify-center ${t.hoverSoft} ${t.textMuted}`}
                                aria-label="Share this ayah"
                              >
                                <Share2 size={16} />
                              </button>
                            </div>
                          </div>
                        )}

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
                                      : `${t.btn} ${t.textMuted}`
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
                                className={`text-xs px-3 py-1.5 rounded-lg ${t.btn}`}
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

          {/* ---------------- Sticky audio controller (floating glass dock) ---------------- */}
          {ayahs.length > 0 && (
            <div className="fixed bottom-0 inset-x-0 z-40 px-3 sm:px-4 pb-3 sm:pb-4 pointer-events-none">
              {playerHidden ? (
                <div className="max-w-3xl mx-auto flex justify-end pointer-events-none">
                  <button
                    onClick={() => setPlayerHidden(false)}
                    className={`pointer-events-auto flex items-center gap-2 pl-3 pr-4 py-2 rounded-full ${t.glassPanel}`}
                    style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
                    aria-label="Show player"
                  >
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center ${t.accentBg} text-white`}>
                      {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </span>
                    <span className="text-xs font-medium max-w-[10rem] truncate">
                      {surahMeta?.englishName}
                      {currentAyahIdx >= 0 ? ` · ${ayahs[currentAyahIdx]?.numberInSurah}` : ''}
                    </span>
                    <ChevronUp size={14} className={t.textMuted} />
                  </button>
                </div>
              ) : (
                <div
                  className={`max-w-3xl mx-auto rounded-[28px] border pointer-events-auto ${t.playerBg}`}
                  style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                >
                  {audioWarning && (
                    <div className="px-4 pt-3">
                      <div className="flex items-start gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-3xl px-3 py-2">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <span className="flex-1">{audioWarning}</span>
                        <button onClick={() => setAudioWarning(null)} className="shrink-0" aria-label="Dismiss">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="px-4 pt-2.5 flex justify-end">
                    <button
                      onClick={() => setPlayerHidden(true)}
                      className={`p-1 rounded-full ${t.hoverSoft} ${t.textFaint}`}
                      aria-label="Hide player"
                      title="Hide player"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                  <div className="px-4 pb-3">
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
                          {currentAyahIdx >= 0
                            ? bismillahActive
                              ? ' · Bismillah'
                              : ` · Ayah ${ayahs[currentAyahIdx]?.numberInSurah}`
                            : ''}
                        </div>
                        <button
                          onClick={() => setShowReciterPicker((v) => !v)}
                          className={`flex items-center gap-1 min-w-0 max-w-full text-xs ${t.textMuted} hover:underline`}
                        >
                          <span className="truncate">
                            Reciter:{' '}
                            {reciterList.find((r) => r.identifier === reciter)?.englishName || 'Mishary Rashid Alafasy'}
                          </span>
                          <ChevronDown size={11} className={`shrink-0 transition-transform ${showReciterPicker ? 'rotate-180' : ''}`} />
                        </button>
                        {showReciterPicker && (
                          <div
                            className={`absolute bottom-full left-0 mb-2 w-64 max-h-72 overflow-y-auto rounded-3xl border shadow-lg z-50 ${t.glassPanel}`}
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
                                    if (r.identifier === reciter) {
                                      setShowReciterPicker(false);
                                      return;
                                    }
                                    audioFailStreakRef.current = 0;
                                    setAudioWarning(null);
                                    if (currentAyahIdx >= 0 && ayahs[currentAyahIdx]) {
                                      resumeRef.current = {
                                        numberInSurah: ayahs[currentAyahIdx].numberInSurah,
                                        wasPlaying: isPlaying,
                                      };
                                      reciterSwitchRef.current = true;
                                    }
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
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={resetPlayback}
                          className={`p-1.5 rounded-full ${t.hoverSoft} ${t.textFaint}`}
                          aria-label="Reset playback and volume"
                          title="Reset playback & volume"
                        >
                          <RotateCcw size={15} />
                        </button>
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
                          className={`p-3.5 rounded-full ${t.accentBg} text-white shadow-[0_6px_16px_rgba(63,85,68,0.35)]`}
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
                        <button
                          onClick={toggleMute}
                          className={`p-1.5 rounded-full ${t.hoverSoft} ${isMuted ? t.accent : t.textFaint}`}
                          aria-label={isMuted ? 'Unmute' : 'Mute'}
                          title={isMuted ? 'Unmute' : 'Mute'}
                        >
                          {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <audio
            ref={audioRef}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleTimeUpdate}
            onEnded={handleEnded}
            onError={handleAudioError}
            onPlaying={handleAudioPlaying}
            className="hidden"
          />
        </>
      ) : section === 'prayer' ? (
        <PrayerSection
          t={t}
          isDark={isDark}
          location={prayerLocation}
          setLocation={setPrayerLocation}
          remindersOn={remindersOn}
          toggleReminders={toggleReminders}
          playAdhanCue={playAdhanCue}
          stopAzan={stopAzan}
          azanPlaying={azanPlaying}
          adhanReady={adhanReady}
          extraRem={extraRem}
          setExtra={setExtra}
          openSurah={(n) => selectSurah(n)}
        />
      ) : section === 'duas' ? (
        <DuasSection t={t} isDark={isDark} />
      ) : section === 'worship' ? (
        <WorshipSection
          t={t}
          tab={worshipTab}
          setTab={setWorshipTab}
          location={prayerLocation}
          extraRem={extraRem}
          setExtra={setExtra}
          offline={{ installPrompt, onInstall: handleInstall, installed, ayahs, surahMeta, reciter, translationLang }}
        />
      ) : section === 'hijri' ? (
        <HijriCalendarSection t={t} isDark={isDark} />
      ) : section === 'progress' ? (
        <ProgressSection
          t={t}
          readingStats={readingStats}
          khatmah={khatmah}
          setKhatmah={setKhatmah}
          khatmahStats={khatmahStats}
          translationLang={translationLang}
          onOpenAyah={(surahNum, ayahNum) => selectSurah(surahNum, ayahNum)}
          openWorship={(tab) => {
            setWorshipTab(tab);
            setSection('worship');
          }}
        />
      ) : (
        <LearnSection t={t} beginnerMode={beginnerMode} setBeginnerMode={setBeginnerMode} />
      )}

      {section !== 'quran' && <CopyrightNotice t={t} />}

      {shareAyah && (
        <VerseCardModal
          ayah={shareAyah.ayah}
          surahMeta={shareAyah.surahMeta}
          isDark={isDark}
          translationLang={translationLang}
          onClose={() => setShareAyah(null)}
        />
      )}

      {verseActionsFor && (
        <VerseActionsSheet
          ayah={verseActionsFor.ayah}
          idx={verseActionsFor.idx}
          surahMeta={surahMeta}
          isBookmarked={!!bookmarks[`${surahMeta?.number}:${verseActionsFor.ayah.numberInSurah}`]}
          note={notes[`${surahMeta?.number}:${verseActionsFor.ayah.numberInSurah}`]}
          t={t}
          onClose={() => setVerseActionsFor(null)}
          onCopy={() => {
            copyAyah(verseActionsFor.ayah);
            setVerseActionsFor(null);
          }}
          onToggleBookmark={() => {
            toggleBookmark(verseActionsFor.ayah);
            setVerseActionsFor(null);
          }}
          onOpenNote={() => {
            openNoteEditor(verseActionsFor.ayah);
            setVerseActionsFor(null);
          }}
          onShare={() => {
            setShareAyah({ ayah: verseActionsFor.ayah, surahMeta });
            setVerseActionsFor(null);
          }}
          onPlay={() => {
            playAyah(verseActionsFor.idx);
            setVerseActionsFor(null);
          }}
        />
      )}

      {/* Floating glass bottom nav — mobile only, hidden specifically during the
          reading screen itself (matches the reference), and lifted above the
          docked audio player when both would otherwise occupy the bottom edge
          — it's never fully hidden just because a surah is loaded, so there's
          always a way back to Prayer/Duas/Progress/Learn. */}
      {!(section === 'quran' && mobileView === 'reader') && (
        <div
          className={`md:hidden fixed inset-x-0 z-30 px-4 pointer-events-none transition-[bottom] ${
            section === 'quran' && ayahs.length > 0 ? 'bottom-24' : 'bottom-0'
          }`}
          style={{
            paddingBottom:
              section === 'quran' && ayahs.length > 0 ? '0px' : 'max(0.75rem, env(safe-area-inset-bottom))',
          }}
        >
          <div className={`pointer-events-auto relative max-w-md mx-auto flex items-center justify-around rounded-[28px] p-1.5 ${t.glassPanel}`}>
            {[
              { key: 'quran', label: "Qur'an", icon: BookOpen },
              { key: 'prayer', label: 'Prayer', icon: Clock },
              { key: 'worship', label: 'Ibadah', icon: Heart },
              { key: 'duas', label: 'Duas', icon: Sparkles },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => {
                  setSection(key);
                  setMobileMore(false);
                }}
                className={`flex flex-col items-center gap-0.5 px-3.5 py-1.5 rounded-2xl transition ${
                  section === key ? `${t.pillPressed} font-semibold` : t.textMuted
                }`}
                aria-label={label}
              >
                <Icon size={18} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            ))}
            <button
              onClick={() => setMobileMore((v) => !v)}
              className={`flex flex-col items-center gap-0.5 px-3.5 py-1.5 rounded-2xl transition ${
                ['hijri', 'progress', 'learn'].includes(section) ? `${t.pillPressed} font-semibold` : t.textMuted
              }`}
              aria-label="More sections"
              aria-expanded={mobileMore}
            >
              <MoreHorizontal size={18} />
              <span className="text-[10px] font-medium">More</span>
            </button>
            {mobileMore && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMobileMore(false)} />
                <div className={`absolute bottom-full right-0 mb-2 w-44 rounded-xl border shadow-lg z-50 overflow-hidden ${t.cardBg} ${t.headerBg}`}>
                  {[
                    { key: 'hijri', label: 'Hijri Calendar', icon: CalendarDays },
                    { key: 'progress', label: 'Progress', icon: Target },
                    { key: 'learn', label: 'Learn', icon: GraduationCap },
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSection(key);
                        setMobileMore(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left ${t.hoverSoft} ${section === key ? t.accent : ''}`}
                    >
                      <Icon size={15} /> {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {ADHAN_AUDIO_URL && (
        <audio
          ref={adhanAudioRef}
          src={ADHAN_AUDIO_URL}
          preload="auto"
          className="hidden"
          onCanPlay={() => setAdhanReady(true)}
          onError={() => setAdhanReady(false)}
          onPlaying={(e) => {
            if (!e.currentTarget.muted) setAzanPlaying(true);
          }}
          onPause={() => setAzanPlaying(false)}
          onEnded={() => setAzanPlaying(false)}
        />
      )}
      {azanPlaying && (
        <div className="fixed top-3 inset-x-0 z-[60] flex justify-center px-4 pointer-events-none">
          <div className={`pointer-events-auto flex items-center gap-3 rounded-full pl-4 pr-2 py-2 ${t.glassPanel}`}>
            <Volume2 size={16} className={t.accent} />
            <span className="text-sm">Azan playing</span>
            <button onClick={stopAzan} className={`text-xs px-3 py-1.5 rounded-full ${t.accentBg} text-white`}>
              Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== Prayer (Namaz) section ==================== */

function PrayerSection({ t, isDark, location, setLocation, remindersOn, toggleReminders, playAdhanCue, stopAzan, azanPlaying, adhanReady, extraRem, setExtra, openSurah }) {
  const [tab, setTab] = useState('timings'); // 'timings' | 'qibla' | 'guide'

  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState(null);
  const [cityInput, setCityInput] = useState('');
  const [countryInput, setCountryInput] = useState('');

  const [timings, setTimings] = useState(null);
  const [hijri, setHijri] = useState(null);
  const [methodInfo, setMethodInfo] = useState(null); // { name, tz }
  const extraTimes = useMemo(() => computeExtraTimes(timings), [timings]);
  const isFriday = parseKey(zonedNow(methodInfo?.tz).date).getDay() === 5;
  const [timingsLoading, setTimingsLoading] = useState(false);
  const [timingsError, setTimingsError] = useState(null);

  const [compassOn, setCompassOn] = useState(false);
  const [heading, setHeading] = useState(null);
  const [compassSupported, setCompassSupported] = useState(true);
  const [compassFlip, setCompassFlip] = useState(() => loadJSON(LS_COMPASS_FLIP, false)); // manual 180° correction
  const isMobileDevice =
    typeof navigator !== 'undefined' &&
    (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1); // iPadOS reports as a Mac

  const [expandedGuide, setExpandedGuide] = useState('wudu'); // 'wudu' | 'salah' | null


  const [now, setNow] = useState(Date.now());

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
    setMethodInfo({ name: data.data.meta?.method?.name || null, tz: data.data.meta?.timezone || null });
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

  // First visit with no saved location: ask for it automatically (the browser
  // shows its own permission prompt) instead of waiting for a button tap.
  const autoDetectTriedRef = useRef(false);
  useEffect(() => {
    if (!location && !autoDetectTriedRef.current) {
      autoDetectTriedRef.current = true;
      detectLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchCity = (e) => {
    e.preventDefault();
    if (!cityInput.trim()) return;
    setLocLoading(true);
    setLocError(null);
    fetch(
      `${ADHAN_API}/timingsByCity?city=${encodeURIComponent(cityInput.trim())}&country=${encodeURIComponent(
        countryInput.trim() || ''
      )}`
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
    fetch(`${ADHAN_API}/timings/${ts}?latitude=${location.lat}&longitude=${location.lon}`)
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

  // Live device compass.
  // iOS gives a ready-made heading (webkitCompassHeading). On Android/others we
  // use the absolute orientation event and work out the heading from all three
  // angles, so it stays right when the phone is tilted or held upright (the old
  // `360 - alpha` shortcut is only valid flat and could come out 180° off).
  // Relative (non-absolute) events are ignored — they aren't real compass readings.
  useEffect(() => {
    if (!compassOn) return;
    let gotReading = false;
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
        gotReading = true;
        applyHeading(e.webkitCompassHeading);
      } else if (e.absolute === true && typeof e.alpha === 'number' && typeof e.beta === 'number' && typeof e.gamma === 'number') {
        const h = headingFromOrientation(e.alpha, e.beta, e.gamma);
        if (h !== null) {
          gotReading = true;
          applyHeading(h);
        }
      }
    };

    window.addEventListener('deviceorientationabsolute', handler, true);
    window.addEventListener('deviceorientation', handler, true);

    const supportTimer = setTimeout(() => {
      if (!gotReading) setCompassSupported(false);
    }, 2500);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handler, true);
      window.removeEventListener('deviceorientation', handler, true);
      clearTimeout(supportTimer);
    };
  }, [compassOn]);

  useEffect(() => {
    localStorage.setItem(LS_COMPASS_FLIP, JSON.stringify(compassFlip));
  }, [compassFlip]);

  // Heading after the optional manual flip, and how far the Qibla is from it.
  const effHeading = heading == null ? null : (heading + (compassFlip ? 180 : 0)) % 360;
  const qiblaDiff = qibla != null && effHeading != null ? ((qibla - effHeading + 540) % 360) - 180 : null; // + = turn right
  const facingQibla = qiblaDiff != null && Math.abs(qiblaDiff) <= 5;
  useEffect(() => {
    if (facingQibla && typeof navigator.vibrate === 'function') navigator.vibrate(40);
  }, [facingQibla]);

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
        <div className={`rounded-3xl border p-4 mb-6 ${t.cardBg}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin size={16} className={t.accent} />
              <span className="text-sm truncate">
                {location
                  ? location.label || `${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}`
                  : locLoading
                  ? 'Detecting your location…'
                  : 'No location set'}
                {location && methodInfo?.tz && <span className={`text-xs ${t.textMuted}`}> · {methodInfo.tz}</span>}
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
            <button type="submit" className={`text-xs px-3 py-1.5 rounded-lg ${t.btn}`}>
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
              {locError
                ? "We couldn't detect your location. Tap Use My Location, or search for your city above."
                : "Set your location above to see today's prayer timings."}
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
                <div className={`rounded-3xl border p-5 mb-4 text-center ${t.cardActive}`}>
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
                  ? `${adhanReady ? 'The Azan' : 'A chime'} will play, with a notification if allowed, at every prayer time — on any screen of the app. The app must stay open in a browser tab; it cannot ring when the browser is closed or the device is asleep.`
                  : `Plays ${adhanReady ? 'the Azan' : 'a chime'} and shows a notification at each prayer time while the app stays open in a browser tab.`}
              </p>
              {isFriday && (
                <div className={`rounded-2xl border px-4 py-3 mt-4 flex items-center justify-between gap-3 ${t.cardActive}`}>
                  <div>
                    <div className="text-sm font-semibold">Jumu'ah Mubarak</div>
                    <div className={`text-xs ${t.textMuted}`}>It is recommended to read Surah Al-Kahf on Friday.</div>
                  </div>
                  <button onClick={() => openSurah(18)} className={`shrink-0 text-xs px-3 py-2 rounded-lg ${t.accentBg} text-white`}>
                    Open Al-Kahf
                  </button>
                </div>
              )}

              <div className={`rounded-2xl border mt-4 px-4 py-4 ${t.cardBg}`}>
                <h3 className="text-sm font-semibold mb-3">More times</h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>Duha (forenoon prayer)</span>
                    <span className="tabular-nums font-medium">
                      {extraTimes.duhaStart ? `${to12h(extraTimes.duhaStart)} – ${to12h(extraTimes.duhaEnd)}` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Last third of the night (Tahajjud)</span>
                    <span className="tabular-nums font-medium">{extraTimes.lastThirdTonight ? to12h(extraTimes.lastThirdTonight) : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Islamic midnight</span>
                    <span className="tabular-nums font-medium">{extraTimes.midnight ? to12h(extraTimes.midnight) : '—'}</span>
                  </div>
                </div>
                <p className={`text-[11px] mt-3 leading-relaxed ${t.textFaint}`}>
                  Duha is approximate: from about 15 minutes after sunrise until about 10 minutes before Dhuhr. The last
                  third of the night starts at the time shown tonight and lasts until Fajr.
                </p>
                <div className="mt-3 space-y-2">
                  <SwitchRow t={t} label="Duha reminder" hint="When Duha time begins" on={extraRem.duha} onChange={(v) => setExtra('duha', v)} />
                  <SwitchRow
                    t={t}
                    label="Tahajjud reminder"
                    hint="At the start of the last third of the night"
                    on={extraRem.tahajjud}
                    onChange={(v) => setExtra('tahajjud', v)}
                  />
                  <SwitchRow
                    t={t}
                    label="Friday: Surah Al-Kahf reminder"
                    hint="Friday morning, at Duha time"
                    on={extraRem.kahf}
                    onChange={(v) => setExtra('kahf', v)}
                  />
                </div>
              </div>

              <p className={`text-xs ${t.textMuted} mt-3 text-center`}>
                {methodInfo?.name
                  ? `Method: ${methodInfo.name}, chosen automatically for your location.`
                  : 'Calculation method chosen automatically for your location.'}{' '}
                Times may differ slightly from your local mosque's schedule.
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
                    transform: `rotate(${compassOn && effHeading != null ? -effHeading : 0}deg)`,
                    transition: 'transform 0.2s linear',
                  }}
                >
                  <circle cx="100" cy="100" r="95" fill="none" stroke={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(102,128,107,0.2)'} strokeWidth="2" />
                  <text x="100" y="20" textAnchor="middle" fontSize="14" fill={isDark ? '#A8A69C' : '#6B6A63'}>
                    N
                  </text>
                  <text x="100" y="190" textAnchor="middle" fontSize="14" fill={isDark ? '#A8A69C' : '#6B6A63'}>
                    S
                  </text>
                  <text x="15" y="105" textAnchor="middle" fontSize="14" fill={isDark ? '#A8A69C' : '#6B6A63'}>
                    W
                  </text>
                  <text x="185" y="105" textAnchor="middle" fontSize="14" fill={isDark ? '#A8A69C' : '#6B6A63'}>
                    E
                  </text>
                  <g transform={`rotate(${qibla} 100 100)`}>
                    <line x1="100" y1="100" x2="100" y2="25" stroke="#667C68" strokeWidth="4" strokeLinecap="round" />
                    <polygon points="100,15 92,32 108,32" fill="#667C68" />
                  </g>
                  <circle cx="100" cy="100" r="5" fill={isDark ? '#F3F1EA' : '#2B2A27'} />
                </svg>
              </div>
              <div className="text-center mb-4">
                <div className="text-2xl font-semibold mb-1">Qibla: {Math.round(qibla)}° from North</div>
                {compassOn && effHeading != null && (
                  <div className={`text-sm mb-1 ${facingQibla ? 'text-emerald-500 font-medium' : t.textMuted}`}>
                    {facingQibla
                      ? '✓ You are facing the Qibla'
                      : `Turn ${Math.round(Math.abs(qiblaDiff))}° ${qiblaDiff > 0 ? 'right' : 'left'}`}
                    <span className={`block text-xs ${t.textFaint}`}>You are facing {Math.round(effHeading)}°</span>
                  </div>
                )}
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
                <div className="flex flex-col items-center gap-2 max-w-xs">
                  <p className={`text-xs ${t.textMuted} text-center`}>
                    Hold your phone in portrait, away from metal, magnets and cases with magnetic clasps. The green
                    arrow points to the Qibla as you turn. If it drifts, wave your phone in a figure-8 to recalibrate.
                  </p>
                  <p className={`text-xs ${t.textFaint} text-center`}>
                    Check: the "You are facing" number should match your phone's own compass app (small differences
                    are normal). If it is 180° off, use the button below.
                  </p>
                  <button
                    onClick={() => setCompassFlip((v) => !v)}
                    className={`text-xs px-3 py-1.5 rounded-lg ${t.btn} ${
                      compassFlip ? t.accent : ''
                    }`}
                  >
                    {compassFlip ? 'Reversed: ON (tap to undo)' : 'Compass reversed? Flip 180°'}
                  </button>
                </div>
              )}
              {!compassSupported && (
                <p className="text-xs text-red-500 mt-2 text-center max-w-xs">
                  {isMobileDevice
                    ? "Live compass isn't available: it needs a magnetometer, a secure (HTTPS) page and permission. Allow motion/orientation access, or use the bearing above with your phone's compass app."
                    : "Laptops and desktops normally have no compass sensor, so a live compass can't work there. Open this page on your phone, or use the bearing above (Qibla direction in degrees from North) with any compass."}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ---------------- Azan tab ---------------- */}
      {tab === 'azan' && (
        <div className="space-y-4">
          <div className={`rounded-3xl border p-4 ${t.cardBg}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Volume2 size={16} className={t.accent} />
                <span className="text-sm">Play</span>
              </div>
              <button
                onClick={() => (azanPlaying ? stopAzan() : playAdhanCue())}
                className={`text-xs px-4 py-2 rounded-lg ${t.accentBg} text-white`}
              >
                {azanPlaying ? 'Stop Azan' : adhanReady ? 'Play Azan' : 'Play reminder chime'}
              </button>
            </div>
            {!adhanReady && (
              <p className={`text-xs ${t.textMuted} mt-2 leading-relaxed`}>
                There's no well-documented free public API for Adhan <em>audio</em> the way there is for Quran
                recitation, so no recording is bundled. No Azan file was found, so a short chime plays instead. Add
                a recording you have the rights to use as <code>public/adhan.mp3</code> (or change{' '}
                <code>ADHAN_AUDIO_URL</code> near the top of this file) and both this button and the prayer-time
                reminders will play it.
              </p>
            )}
          </div>

          <div className={`rounded-3xl border ${t.cardBg} p-4`}>
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

          <div className={`rounded-3xl border ${t.cardBg} overflow-hidden`}>
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

          <div className={`rounded-3xl border ${t.cardBg} overflow-hidden`}>
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

function ProgressSection({ t, readingStats, khatmah, setKhatmah, khatmahStats, translationLang, onOpenAyah, openWorship }) {
  const [customDate, setCustomDate] = useState('');
  // Worship summary, read from what the Worship tab saved on this device.
  const worship = useMemo(() => {
    const today = dateKey();
    const pl = { log: {}, extra: {}, madeUp: {}, ...loadJSON(LS_PRAYER_LOG, {}) };
    const ad = loadJSON(LS_ADHKAR, {});
    const ts = loadJSON(LS_TASBIH, {});
    return {
      prayedToday: dayCount(pl.log, today),
      streak: currentPrayerStreak(pl.log, today),
      best: bestPrayerStreak(pl.log),
      qada: Object.values(pendingQada(pl.log, pl.extra, pl.madeUp)).reduce((a, b) => a + b, 0),
      morning: streakFromKeys(ad.done?.morning || [], today),
      evening: streakFromKeys(ad.done?.evening || [], today),
      dhikr: Object.values(ts.totals?.[today] || {}).reduce((a, b) => a + b, 0),
    };
  }, []);
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
    const translationEdition = TRANSLATION_OPTIONS[translationLang]?.edition || TRANSLATION_OPTIONS[DEFAULT_TRANSLATION].edition;
    setAyahOfDayLoading(true);
    setAyahOfDayError(null);
    fetch(`${API_BASE}/ayah/${globalNumber}/editions/${buildTextEditions(translationEdition)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Could not load today's Ayah.");
        return r.json();
      })
      .then((data) => {
        const [arabicEd, translationEd, translitEd] = data.data;
        setAyahOfDay({
          arabic: arabicEd.text,
          translation: translationEd.text,
          transliteration: translitEd.text,
          surahName: arabicEd.surah.englishName,
          surahNumber: arabicEd.surah.number,
          numberInSurah: arabicEd.numberInSurah,
        });
      })
      .catch((err) => setAyahOfDayError(err.message || 'Something went wrong.'))
      .finally(() => setAyahOfDayLoading(false));
  }, [translationLang]);

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
        <div className={`rounded-3xl border p-4 text-center ${t.cardBg}`}>
          <div className={`text-2xl font-semibold ${t.accent}`}>{readingStats.streak}</div>
          <div className={`text-xs ${t.textMuted} flex items-center justify-center gap-1 mt-1`}>
            <Flame size={12} /> Day streak
          </div>
        </div>
        <div className={`rounded-3xl border p-4 text-center ${t.cardBg}`}>
          <div className="text-2xl font-semibold">{readingStats.totalRead.toLocaleString()}</div>
          <div className={`text-xs ${t.textMuted} mt-1`}>Ayahs read</div>
        </div>
        <div className={`rounded-3xl border p-4 text-center ${t.cardBg}`}>
          <div className="text-2xl font-semibold">{readingStats.percent.toFixed(1)}%</div>
          <div className={`text-xs ${t.textMuted} mt-1`}>of the Qur'an</div>
        </div>
      </div>

      {/* Prayer & worship summary */}
      <div className={`rounded-3xl border px-4 py-4 ${t.cardBg}`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Prayer & worship</h2>
          <button onClick={() => openWorship('prayers')} className={`text-xs ${t.accent} hover:underline`}>
            Open tracker
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xl font-semibold">{worship.prayedToday}/5</div>
            <div className={`text-[11px] ${t.textMuted}`}>Prayed today</div>
          </div>
          <div>
            <div className={`text-xl font-semibold ${t.accent}`}>{worship.streak}</div>
            <div className={`text-[11px] ${t.textMuted}`}>Prayer streak (best {worship.best})</div>
          </div>
          <div>
            <div className={`text-xl font-semibold ${worship.qada ? 'text-amber-500' : ''}`}>{worship.qada}</div>
            <div className={`text-[11px] ${t.textMuted}`}>Qada owed</div>
          </div>
          <div>
            <div className="text-xl font-semibold">{worship.morning}</div>
            <div className={`text-[11px] ${t.textMuted}`}>Morning adhkar streak</div>
          </div>
          <div>
            <div className="text-xl font-semibold">{worship.evening}</div>
            <div className={`text-[11px] ${t.textMuted}`}>Evening adhkar streak</div>
          </div>
          <div>
            <div className="text-xl font-semibold">{worship.dhikr.toLocaleString()}</div>
            <div className={`text-[11px] ${t.textMuted}`}>Dhikr today</div>
          </div>
        </div>
      </div>

      {/* Weekly activity chart */}
      <div className={`rounded-3xl border p-4 ${t.cardBg}`}>
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
      <div className={`rounded-3xl border p-4 ${t.cardBg}`}>
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
                  className={`text-xs px-3 py-1.5 rounded-lg ${t.btn}`}
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
                  className={`text-xs px-3 py-1.5 rounded-lg ${t.btn}`}
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
                  className={`w-full text-xs px-3 py-1.5 rounded-lg ${t.btn}`}
                >
                  Cancel plan
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Ayah of the Day */}
      <div className={`rounded-3xl border p-4 ${t.cardBg}`}>
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
            <p
              dir={TRANSLATION_OPTIONS[translationLang]?.dir || 'ltr'}
              className={`${TRANSLATION_OPTIONS[translationLang]?.fontClass || 'font-malayalam'} text-base mb-3`}
            >
              {ayahOfDay.translation}
            </p>
            <div className="flex items-center justify-between">
              <span className={`text-xs ${t.textMuted}`}>
                {ayahOfDay.surahName} · {ayahOfDay.surahNumber}:{ayahOfDay.numberInSurah}
              </span>
              <button
                onClick={() => onOpenAyah(ayahOfDay.surahNumber, ayahOfDay.numberInSurah)}
                className={`text-xs px-3 py-1.5 rounded-lg ${t.btn}`}
              >
                Read in context
              </button>
            </div>
          </>
        )}
      </div>

      {/* Home-screen note (honest about what's and isn't possible) */}
      {!dismissedWidgetNote && (
        <div className={`rounded-3xl border p-4 ${t.cardBg} relative`}>
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

/* A glass bottom sheet consolidating an ayah's actions into one contextual
   panel, rather than scattering separate icon buttons across the card. */
function VerseActionsSheet({ ayah, idx, surahMeta, isBookmarked, note, t, onClose, onCopy, onToggleBookmark, onOpenNote, onShare, onPlay }) {
  const actions = [
    { icon: Play, label: 'Play this Ayah', onClick: onPlay },
    { icon: Copy, label: 'Copy Text', onClick: onCopy },
    { icon: isBookmarked ? BookmarkCheck : Bookmark, label: isBookmarked ? 'Remove Bookmark' : 'Bookmark this Ayah', onClick: onToggleBookmark },
    { icon: StickyNote, label: note ? 'Edit Note' : 'Add Note', onClick: onOpenNote },
    { icon: Share2, label: 'Share as Image', onClick: onShare },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <div className="absolute inset-0 bg-[#232A24]/35 backdrop-blur-sm backdrop-enter" onClick={onClose} />
      <div className={`relative w-full max-w-sm rounded-[28px] overflow-hidden sheet-enter ${t.sheetBg}`}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="min-w-0">
            <h3 className={`text-sm font-semibold ${t.text}`}>Verse Actions</h3>
            <p className={`text-xs ${t.textMuted} truncate`}>
              {surahMeta?.englishName} · Ayah {ayah.numberInSurah}
            </p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full shrink-0 ${t.iconBtn} ${t.textMuted}`} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="px-3">
          {actions.map(({ icon: Icon, label, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className={`w-full flex items-center gap-3 px-2 py-3.5 text-sm text-left border-b last:border-b-0 transition ${t.divider} ${t.hoverSoft} ${t.text}`}
            >
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.iconBtn} ${t.accent}`}>
                <Icon size={16} />
              </span>
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className={`mx-4 mb-4 mt-2 w-[calc(100%-2rem)] text-center text-sm font-medium py-3 rounded-full transition ${t.iconBtn} ${t.text}`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function VerseCardModal({ ayah, surahMeta, isDark, translationLang, onClose }) {
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

      const translationFontFamily = CANVAS_FONT_BY_LANG[translationLang] || CANVAS_FONT_BY_LANG[DEFAULT_TRANSLATION];
      const translationDir = TRANSLATION_OPTIONS[translationLang]?.dir || 'ltr';

      const translationFit = fitText(
        ctx,
        ayah.translation,
        translationFontFamily,
        '500',
        maxWidth,
        h * 0.16,
        w * 0.032,
        w * 0.02,
        1.5
      );
      ctx.font = `500 ${translationFit.size}px ${translationFontFamily}`;
      ctx.fillStyle = theme.text;
      ctx.direction = translationDir;
      translationFit.lines.forEach((line) => {
        y += translationFit.lineHeight;
        ctx.fillText(line, w / 2, y);
      });
      ctx.direction = 'ltr';

      ctx.font = `600 ${w * 0.024}px Inter, sans-serif`;
      ctx.fillStyle = theme.accent;
      ctx.fillText("☾ Al-Qur'an", w / 2, h * 0.94);
    };

    if (document.fonts) {
      Promise.all([
        document.fonts.load('700 64px Amiri'),
        document.fonts.load(`500 32px ${CANVAS_FONT_BY_LANG[translationLang] || CANVAS_FONT_BY_LANG[DEFAULT_TRANSLATION]}`),
        document.fonts.load('600 24px Inter'),
      ])
        .catch(() => {})
        .then(() => document.fonts.ready)
        .then(draw)
        .catch(draw);
    } else {
      draw();
    }
  }, [template, themeIdx, ayah, surahMeta, translationLang]);

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
      <div className={`rounded-3xl border p-4 flex items-center justify-between gap-3 ${t.cardBg}`}>
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
            <div key={l.letter} className={`rounded-3xl border p-4 text-center ${t.cardBg}`}>
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
                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition ${
                  quizPool === 'letters' ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
                }`}
              >
                Letters
              </button>
              <button
                onClick={() => setQuizPool('harakat')}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition ${
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

          <div className={`rounded-3xl border p-8 text-center ${t.cardBg}`}>
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

/* ==================== Worship helpers (pure logic) ==================== */

const FIVE_PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// Local calendar date as YYYY-MM-DD (never UTC, so "today" is right at night).
function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
function addDaysKey(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
function timeToMin(hhmm) {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
}
function minToTime(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// Extra times derived from the timings we already fetch.
//  Duha: from ~15 min after sunrise until ~10 min before Dhuhr (approximate).
//  Last third: the night runs Maghrib -> Fajr; the last third starts at Fajr - night/3.
//   `lastThirdThisMorning` is the one that ends at today's Fajr (used for reminders);
//   `lastThirdTonight` is the API's value when present (shown to the user).
function computeExtraTimes(times) {
  if (!times) return {};
  const sunrise = timeToMin(times.Sunrise);
  const dhuhr = timeToMin(times.Dhuhr);
  const fajr = timeToMin(times.Fajr);
  const maghrib = timeToMin(times.Maghrib);
  const out = {};
  if (sunrise != null && dhuhr != null) {
    out.duhaStart = minToTime(sunrise + 15);
    out.duhaEnd = minToTime(dhuhr - 10);
  }
  if (fajr != null && maghrib != null) {
    const night = fajr + 1440 - maghrib;
    out.lastThirdThisMorning = minToTime(fajr - night / 3);
    out.lastThirdComputed = minToTime(maghrib + (2 * night) / 3);
  }
  out.lastThirdTonight = times.Lastthird || out.lastThirdComputed || null;
  out.midnight = times.Midnight || (fajr != null && maghrib != null ? minToTime(maghrib + (fajr + 1440 - maghrib) / 2) : null);
  return out;
}

// ---------- Prayer tracker ----------
// log[date][prayer] = 'p' (prayed) | 'm' (missed)
function dayCount(log, key) {
  return FIVE_PRAYERS.filter((p) => log[key]?.[p] === 'p').length;
}
function currentPrayerStreak(log, todayKey) {
  const full = (k) => dayCount(log, k) === 5;
  let k = full(todayKey) ? todayKey : addDaysKey(todayKey, -1); // today may still be in progress
  let n = 0;
  while (full(k) && n < 3650) {
    n++;
    k = addDaysKey(k, -1);
  }
  return n;
}
function bestPrayerStreak(log) {
  const keys = Object.keys(log).filter((k) => dayCount(log, k) === 5).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  keys.forEach((k) => {
    run = prev && addDaysKey(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  });
  return best;
}
// Pending qada per prayer = missed (logged) + owed (added by hand) - made up.
function pendingQada(log, extra = {}, madeUp = {}) {
  const out = {};
  FIVE_PRAYERS.forEach((p) => {
    const missed = Object.values(log).filter((day) => day?.[p] === 'm').length;
    out[p] = Math.max(0, missed + (extra[p] || 0) - (madeUp[p] || 0));
  });
  return out;
}

// ---------- Streak for a set of date keys (adhkar) ----------
function streakFromKeys(keys, todayKey) {
  const set = new Set(keys);
  let k = set.has(todayKey) ? todayKey : addDaysKey(todayKey, -1);
  let n = 0;
  while (set.has(k) && n < 3650) {
    n++;
    k = addDaysKey(k, -1);
  }
  return n;
}

// ---------- Sunnah fasting days ----------
// `hijri` = { m, d } for that date (or null if the browser lacks the Islamic calendar).
function sunnahFastInfo(date, hijri) {
  if (hijri) {
    const { m, d } = hijri;
    if (m === 9) return null; // Ramadan: obligatory, not a "sunnah" day
    if (m === 10 && d === 1) return null; // Eid al-Fitr: fasting is forbidden
    if (m === 12 && d >= 10 && d <= 13) return null; // Eid al-Adha + Tashreeq: forbidden
    if (m === 12 && d === 9) return { label: 'Day of Arafah', kind: 'arafah' };
    if (m === 1 && d === 10) return { label: 'Ashura (10 Muharram)', kind: 'ashura' };
    if (m === 1 && d === 9) return { label: "Tasu'a (9 Muharram), fast with Ashura", kind: 'ashura' };
    if (d >= 13 && d <= 15) return { label: 'White Day (Ayyam al-Bid)', kind: 'white' };
  }
  const wd = date.getDay();
  if (wd === 1) return { label: 'Monday', kind: 'weekly' };
  if (wd === 4) return { label: 'Thursday', kind: 'weekly' };
  return null;
}

// "HH:MM:SS" countdown text
function fmtCountdown(sec) {
  const s = Math.max(0, Math.floor(sec));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/* ==================== Worship hub: Tasbih, Adhkar, Prayer tracker, Ramadan, Offline ==================== */

const LS_TASBIH = 'quran_reader_tasbih_v1';
const LS_ADHKAR = 'quran_reader_adhkar_v1';
const LS_PRAYER_LOG = 'quran_reader_prayer_log_v1';
const LS_FAST_LOG = 'quran_reader_fast_log_v1';
const LS_TARAWEEH = 'quran_reader_taraweeh_v1';
const LS_EXTRA_REM = 'quran_reader_extra_reminders_v1';
const API_CACHE_NAME = 'quran-api-v1'; // must match public/sw.js
const AUDIO_CACHE_NAME = 'quran-audio-v1'; // must match public/sw.js
const DEFAULT_EXTRA_REM = { duha: false, tahajjud: false, kahf: false, suhoor: false, iftar: false, sunnahFast: false };

function getHijriAdjust() {
  const v = parseInt(localStorage.getItem(LS_HIJRI_ADJUST), 10);
  return [-1, 0, 1].includes(v) ? v : 0;
}

function usePersisted(key, initial) {
  const [value, setValue] = useState(() => loadJSON(key, initial));
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or blocked — keep working in memory
    }
  }, [key, value]);
  return [value, setValue];
}

function useTick(ms) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}

// Seconds since midnight in a given IANA timezone (prayer times are in the prayer location's time).
function zonedClock(tz) {
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' };
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', tz ? { ...opts, timeZone: tz } : opts).formatToParts(new Date());
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', opts).formatToParts(new Date());
  }
  const g = (type) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
  const pad = (n) => String(n).padStart(2, '0');
  return { date: `${g('year')}-${pad(g('month'))}-${pad(g('day'))}`, seconds: (g('hour') % 24) * 3600 + g('minute') * 60 + g('second') };
}

// Today's timings for a saved location, refreshed when the date changes there.
function useTodayTimings(location) {
  const [state, setState] = useState({ times: null, tz: null, date: null, error: false });
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    if (!location) return undefined;
    let cancelled = false;
    const load = () => {
      const ts = Math.floor(Date.now() / 1000);
      fetch(`${ADHAN_API}/timings/${ts}?latitude=${location.lat}&longitude=${location.lon}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          if (cancelled) return;
          const times = {};
          Object.keys(data.data.timings).forEach((k) => {
            times[k] = String(data.data.timings[k]).split(' ')[0];
          });
          const [dd, mm, yyyy] = String(data.data.date?.gregorian?.date || '').split('-');
          setState({ times, tz: data.data.meta?.timezone || null, date: yyyy ? `${yyyy}-${mm}-${dd}` : null, error: false });
        })
        .catch(() => {
          if (!cancelled) setState((s) => ({ ...s, error: true }));
        });
    };
    load();
    const iv = setInterval(() => {
      const cur = stateRef.current;
      if (cur.date && zonedClock(cur.tz).date !== cur.date) load();
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [location?.lat, location?.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

function vibrationSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

// Most phones can't produce a pulse shorter than ~20-30 ms (it is simply not felt), so single
// pulses are floored at 30 ms. Returns false when the browser has no vibration support at all
// (iPhone/iPad Safari and most laptops).
function buzz(pattern) {
  if (!vibrationSupported()) return false;
  try {
    return navigator.vibrate(Array.isArray(pattern) ? pattern : Math.max(30, pattern));
  } catch {
    return false;
  }
}

function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// iPhone/iPad have no Vibration API, but Safari 17.4+ plays a light haptic tick when a hidden
// "switch" checkbox is toggled by a tap. This is an unofficial trick that Apple does not document,
// so treat it as best effort. All iOS browsers use Apple's engine, so Chrome on iOS behaves the same.
let hapticLabel = null;
function iosHaptic() {
  try {
    if (!hapticLabel) {
      const label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.display = 'none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      label.appendChild(input);
      document.head.appendChild(label);
      hapticLabel = label;
    }
    hapticLabel.click(); // must run inside a tap handler
    return true;
  } catch {
    return false;
  }
}

// True when we can try some kind of haptic on this device.
function hapticAvailable() {
  return vibrationSupported() || isIOSDevice();
}

// One entry point for tap feedback: real vibration where supported, the iOS trick otherwise.
function hapticFeedback(kind) {
  if (vibrationSupported()) return buzz(kind === 'round' ? [150, 80, 150] : 35);
  if (isIOSDevice()) {
    const ok = iosHaptic();
    if (kind === 'round') setTimeout(iosHaptic, 110); // second tick; may be ignored by iOS outside a tap
    return ok;
  }
  return false;
}

// A very short, quiet tick for devices that cannot vibrate (or when the phone is on silent-vibrate).
let tickCtx = null;
function playTick(double = false) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    tickCtx = tickCtx || new AC();
    if (tickCtx.state === 'suspended') tickCtx.resume();
    const beep = (at, freq) => {
      const o = tickCtx.createOscillator();
      const g = tickCtx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.2, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
      o.connect(g);
      g.connect(tickCtx.destination);
      o.start(at);
      o.stop(at + 0.08);
    };
    const now = tickCtx.currentTime;
    beep(now, double ? 1100 : 820);
    if (double) beep(now + 0.11, 1320);
  } catch {
    // audio not available — silently skip
  }
}

/* ---------------- Tasbih ---------------- */

const TASBIH_PRESETS = [
  { id: 'subhanallah', arabic: 'سُبْحَانَ اللَّهِ', translit: 'SubhanAllah', meaning: 'Glory be to Allah', target: 33 },
  { id: 'alhamdulillah', arabic: 'الْحَمْدُ لِلَّهِ', translit: 'Alhamdulillah', meaning: 'All praise is for Allah', target: 33 },
  { id: 'allahu-akbar', arabic: 'اللَّهُ أَكْبَرُ', translit: 'Allahu Akbar', meaning: 'Allah is the Greatest', target: 34 },
  { id: 'la-ilaha', arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ', translit: 'La ilaha illallah', meaning: 'There is no god but Allah', target: 100 },
  { id: 'astaghfirullah', arabic: 'أَسْتَغْفِرُ اللَّهَ', translit: 'Astaghfirullah', meaning: 'I seek forgiveness from Allah', target: 100 },
  { id: 'salawat', arabic: 'اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ', translit: 'Allahumma salli ala Muhammad', meaning: 'O Allah, send blessings upon Muhammad ﷺ', target: 100 },
  { id: 'hawqala', arabic: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', translit: 'La hawla wa la quwwata illa billah', meaning: 'There is no might or power except with Allah', target: 100 },
];
const TASBIH_GUIDED = [
  { id: 'subhanallah', target: 33 },
  { id: 'alhamdulillah', target: 33 },
  { id: 'allahu-akbar', target: 34 },
];
const TASBIH_DEFAULT = { preset: 'subhanallah', count: 0, target: 33, vibrate: true, sound: false, guided: false, step: 0, totals: {}, allTime: {} };

function TasbihPanel({ t }) {
  const [saved, setSaved] = usePersisted(LS_TASBIH, TASBIH_DEFAULT);
  const st = { ...TASBIH_DEFAULT, ...saved };
  const [flash, setFlash] = useState(false);
  const [vibMsg, setVibMsg] = useState('');
  const PRESET_TARGETS = [33, 99, 100];
  const isCustom = !st.guided && st.target > 0 && !PRESET_TARGETS.includes(st.target);
  const [customOpen, setCustomOpen] = useState(false);
  const [customVal, setCustomVal] = useState(() => (st.target > 0 && !PRESET_TARGETS.includes(st.target) ? String(st.target) : ''));
  const preset = TASBIH_PRESETS.find((p) => p.id === st.preset) || TASBIH_PRESETS[0];
  const today = dateKey();
  const todayTotal = Object.values(st.totals[today] || {}).reduce((a, b) => a + b, 0);
  const finished = st.guided && st.step >= 3;
  const R = 88;
  const C = 2 * Math.PI * R;
  const progress = st.target > 0 ? Math.min(1, st.count / st.target) : 0;

  // Feedback on every tap: vibration and/or a soft tick; the end of a round gets a stronger cue.
  const feedback = (kind) => {
    if (st.vibrate) hapticFeedback(kind);
    if (st.sound) playTick(kind === 'round');
  };

  const testVibration = () => {
    if (vibrationSupported()) {
      buzz([200, 100, 200]);
      setVibMsg("A vibration was sent. If you felt nothing, check your phone's vibration / touch-feedback settings and that battery saver is off.");
    } else if (isIOSDevice()) {
      iosHaptic();
      setVibMsg("Tried Apple's light haptic tap. You should feel a small tick on iOS 17.4 or newer. If not, check Settings > Sounds & Haptics > System Haptics, turn off Low Power Mode, or use Sound instead.");
    } else {
      setVibMsg("This device has no vibration (most laptops and desktops don't). Turn on Sound for tap feedback.");
    }
  };

  const tap = () => {
    if (finished) return;
    const totals = { ...st.totals, [today]: { ...(st.totals[today] || {}), [st.preset]: (st.totals[today]?.[st.preset] || 0) + 1 } };
    const keep = Object.keys(totals).sort().slice(-60); // keep two months of history
    const prunedTotals = {};
    keep.forEach((k) => {
      prunedTotals[k] = totals[k];
    });
    const allTime = { ...st.allTime, [st.preset]: (st.allTime[st.preset] || 0) + 1 };
    let next = { ...st, count: st.count + 1, totals: prunedTotals, allTime };
    if (st.target > 0 && next.count >= st.target) {
      feedback('round');
      setFlash(true);
      setTimeout(() => setFlash(false), 900);
      if (st.guided && st.step < 2) {
        const g = TASBIH_GUIDED[st.step + 1];
        next = { ...next, preset: g.id, target: g.target, count: 0, step: st.step + 1 };
      } else if (st.guided) {
        next = { ...next, count: 0, step: 3 };
      } else {
        next = { ...next, count: 0 };
      }
    } else {
      feedback('tap');
    }
    setSaved(next);
  };

  const choosePreset = (p) =>
    setSaved({ ...st, preset: p.id, target: p.target, count: 0, guided: false, step: 0 });
  const setTarget = (n) => setSaved({ ...st, target: n, count: 0 });
  const applyCustom = () => {
    const n = parseInt(customVal, 10);
    if (!n || n < 1) return;
    const clamped = Math.min(n, 100000);
    setCustomVal(String(clamped));
    setTarget(clamped);
  };
  const startGuided = () => setSaved({ ...st, guided: true, step: 0, preset: 'subhanallah', target: 33, count: 0 });
  const stopGuided = () => setSaved({ ...st, guided: false, step: 0, count: 0 });
  // Undo also takes the tap back out of today's and the all-time totals, so the stats stay honest.
  const undo = () => {
    if (st.count <= 0) return;
    const dayTotals = { ...(st.totals[today] || {}) };
    if (dayTotals[st.preset] > 0) dayTotals[st.preset] -= 1;
    const allTime = { ...st.allTime, [st.preset]: Math.max(0, (st.allTime[st.preset] || 0) - 1) };
    setSaved({ ...st, count: st.count - 1, totals: { ...st.totals, [today]: dayTotals }, allTime });
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pt-2 pb-4 -mx-3 px-3">
        {TASBIH_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => choosePreset(p)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              st.preset === p.id && !st.guided ? `${t.accentBg} text-white border-transparent` : `${t.btn} ${t.textMuted}`
            }`}
          >
            {p.translit}
          </button>
        ))}
      </div>

      <div className={`rounded-3xl border px-4 py-6 flex flex-col items-center ${t.cardBg}`}>
        {st.guided && (
          <div className={`text-xs mb-3 ${t.textMuted}`}>
            After-prayer tasbih · {finished ? 'complete' : `step ${st.step + 1} of 3`}
          </div>
        )}
        <div className="font-arabic text-3xl mb-1" dir="rtl">
          {preset.arabic}
        </div>
        <div className={`text-xs mb-5 ${t.textMuted}`}>{preset.meaning}</div>

        <button
          onClick={tap}
          disabled={finished}
          className={`relative w-56 h-56 rounded-full select-none touch-manipulation ${t.btnLg}`}
          aria-label={`Count ${preset.translit}`}
        >
          <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="100" cy="100" r={R} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="8" />
            <circle
              cx="100" cy="100" r={R} fill="none" stroke="#667C68" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 0.15s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {finished ? (
              <span className="text-lg font-semibold text-emerald-500">✓ Complete</span>
            ) : (
              <>
                <span className="text-6xl font-semibold tabular-nums">{st.count}</span>
                <span className={`text-sm mt-1 ${t.textMuted}`}>{st.target > 0 ? `of ${st.target}` : 'no limit'}</span>
              </>
            )}
          </div>
        </button>
        <div className={`h-5 mt-3 text-sm text-emerald-500 transition-opacity ${flash ? 'opacity-100' : 'opacity-0'}`}>
          {flash ? 'Round complete — keep going' : ''}
        </div>

        {finished && (
          <button onClick={startGuided} className={`mt-2 text-xs px-4 py-2 rounded-lg ${t.accentBg} text-white`}>
            Start again
          </button>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          <button onClick={undo} className={`text-xs px-3 py-1.5 rounded-lg ${t.btn}`}>
            Undo
          </button>
          <button
            onClick={() => setSaved({ ...st, count: 0 })}
            className={`text-xs px-3 py-1.5 rounded-lg ${t.btn}`}
          >
            Reset
          </button>
          <button
            onClick={() => setSaved({ ...st, vibrate: !st.vibrate })}
            className={`text-xs px-3 py-1.5 rounded-lg ${t.btn} ${st.vibrate ? t.accent : t.textFaint}`}
          >
            Vibration {st.vibrate ? 'on' : 'off'}
          </button>
          <button
            onClick={() => {
              const next = !st.sound;
              setSaved({ ...st, sound: next });
              if (next) playTick(); // also unlocks audio on iPhone, which needs a tap first
            }}
            className={`text-xs px-3 py-1.5 rounded-lg ${t.btn} ${st.sound ? t.accent : t.textFaint}`}
          >
            Sound {st.sound ? 'on' : 'off'}
          </button>
          <button onClick={testVibration} className={`text-xs px-3 py-1.5 rounded-lg ${t.btn}`}>
            Test vibration
          </button>
        </div>
        {(vibMsg || !vibrationSupported()) && (
          <p className={`text-[11px] text-center max-w-xs mt-2 leading-snug ${t.textMuted}`}>
            {vibMsg ||
              (isIOSDevice()
                ? "iPhone/iPad: using Apple's light haptic tap (works on iOS 17.4 or newer, not guaranteed). Turn on Sound if you feel nothing."
                : 'This device has no vibration (most laptops and desktops). Turn on Sound for tap feedback.')}
          </p>
        )}

        {!st.guided && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className={`text-xs ${t.textMuted} mr-1`}>Target</span>
              {[33, 99, 100, 0].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setCustomOpen(false);
                    setTarget(n);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] border ${
                    st.target === n ? `${t.accentBg} text-white border-transparent` : `${t.btn} ${t.textMuted}`
                  }`}
                >
                  {n === 0 ? '∞' : n}
                </button>
              ))}
              <button
                onClick={() => setCustomOpen(true)}
                className={`px-2.5 py-1 rounded-full text-[11px] border ${
                  isCustom || customOpen ? `${t.accentBg} text-white border-transparent` : `${t.btn} ${t.textMuted}`
                }`}
              >
                Custom{isCustom ? ` (${st.target})` : ''}
              </button>
            </div>
            {(customOpen || isCustom) && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="100000"
                  value={customVal}
                  onChange={(e) => setCustomVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyCustom();
                  }}
                  placeholder="e.g. 7"
                  aria-label="Custom count"
                  className={`w-24 text-center text-sm px-3 py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-emerald-600/50 ${t.inputBg}`}
                />
                <button onClick={applyCustom} className={`text-xs px-3 py-1.5 rounded-lg ${t.accentBg} text-white`}>
                  Set
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`rounded-3xl border px-4 py-4 ${t.cardBg}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">After-prayer tasbih</h3>
            <p className={`text-xs mt-1 leading-relaxed ${t.textMuted}`}>
              SubhanAllah ×33, Alhamdulillah ×33, Allahu Akbar ×34. The counter moves to the next one by itself
              (Sahih Muslim).
            </p>
          </div>
          <button
            onClick={st.guided ? stopGuided : startGuided}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-lg ${st.guided ? `${t.btn}` : `${t.accentBg} text-white`}`}
          >
            {st.guided ? 'Stop' : 'Start'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-3xl border p-4 text-center ${t.cardBg}`}>
          <div className={`text-2xl font-semibold ${t.accent}`}>{todayTotal.toLocaleString()}</div>
          <div className={`text-xs mt-1 ${t.textMuted}`}>Dhikr today</div>
        </div>
        <div className={`rounded-3xl border p-4 text-center ${t.cardBg}`}>
          <div className="text-2xl font-semibold">{(st.allTime[st.preset] || 0).toLocaleString()}</div>
          <div className={`text-xs mt-1 ${t.textMuted}`}>All-time · {preset.translit}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Adhkar ---------------- */

// Items marked `ref` reuse the Arabic/transliteration/translation from the DUAS list (single source of truth).
const ADHKAR = [
  { id: 'kursi', sessions: ['morning', 'evening', 'after'], ref: 'sihr-ayatul-kursi', count: 1, source: "Qur'an 2:255. After every obligatory prayer: an-Nasa'i (Amal al-Yawm wal-Laylah)." },
  { id: 'quls', sessions: ['morning', 'evening'], ref: 'sihr-three-quls', count: 3, source: 'Abu Dawud, at-Tirmidhi: three times each, morning and evening.' },
  { id: 'quls-after', sessions: ['after'], ref: 'sihr-three-quls', count: 1, source: 'Abu Dawud: after every prayer (three times each after Fajr and Maghrib).' },
  { id: 'asbahna', sessions: ['morning'], count: 1, source: 'Sahih Muslim.',
    arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ',
    translit: "Asbahna wa asbahal-mulku lillah, walhamdu lillah, la ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa 'ala kulli shay'in qadir. Rabbi as'aluka khayra ma fi hadhal-yawmi wa khayra ma ba'dah, wa a'udhu bika min sharri ma fi hadhal-yawmi wa sharri ma ba'dah. Rabbi a'udhu bika minal-kasali wa su'il-kibar. Rabbi a'udhu bika min 'adhabin fin-nari wa 'adhabin fil-qabr.",
    translation: 'We have reached the morning and the dominion belongs to Allah, and all praise is for Allah. None has the right to be worshipped but Allah alone, with no partner; His is the dominion and the praise, and He is able to do all things. My Lord, I ask You for the good of this day and the good of what follows it, and I seek refuge in You from the evil of this day and the evil of what follows it. My Lord, I seek refuge in You from laziness and the misery of old age. My Lord, I seek refuge in You from punishment in the Fire and punishment in the grave.' },
  { id: 'amsayna', sessions: ['evening'], count: 1, source: 'Sahih Muslim.',
    arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ',
    translit: "Amsayna wa amsal-mulku lillah, walhamdu lillah, la ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa 'ala kulli shay'in qadir. Rabbi as'aluka khayra ma fi hadhihil-laylah wa khayra ma ba'daha, wa a'udhu bika min sharri ma fi hadhihil-laylah wa sharri ma ba'daha. Rabbi a'udhu bika minal-kasali wa su'il-kibar. Rabbi a'udhu bika min 'adhabin fin-nari wa 'adhabin fil-qabr.",
    translation: 'We have reached the evening and the dominion belongs to Allah, and all praise is for Allah. None has the right to be worshipped but Allah alone, with no partner; His is the dominion and the praise, and He is able to do all things. My Lord, I ask You for the good of this night and the good of what follows it, and I seek refuge in You from the evil of this night and the evil of what follows it. My Lord, I seek refuge in You from laziness and the misery of old age. My Lord, I seek refuge in You from punishment in the Fire and punishment in the grave.' },
  { id: 'bika-asbahna', sessions: ['morning'], count: 1, source: 'at-Tirmidhi.',
    arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ',
    translit: "Allahumma bika asbahna, wa bika amsayna, wa bika nahya, wa bika namutu, wa ilaykan-nushur",
    translation: 'O Allah, by You we reach the morning and by You we reach the evening; by You we live and by You we die, and to You is the resurrection.' },
  { id: 'bika-amsayna', sessions: ['evening'], count: 1, source: 'at-Tirmidhi.',
    arabic: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ',
    translit: "Allahumma bika amsayna, wa bika asbahna, wa bika nahya, wa bika namutu, wa ilaykal-masir",
    translation: 'O Allah, by You we reach the evening and by You we reach the morning; by You we live and by You we die, and to You is the final return.' },
  { id: 'sayyid', sessions: ['morning', 'evening'], ref: 'akhirah-sayyidul-istighfar', count: 1, source: 'Sahih al-Bukhari.' },
  { id: 'nothing-harms', sessions: ['morning', 'evening'], ref: 'sihr-nothing-harms', count: 3, source: 'Abu Dawud, at-Tirmidhi.' },
  { id: 'radiytu', sessions: ['morning', 'evening'], count: 3, source: 'Abu Dawud, at-Tirmidhi, Ahmad.',
    arabic: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ نَبِيًّا',
    translit: "Raditu billahi Rabban, wa bil-Islami dinan, wa bi-Muhammadin nabiyyan",
    translation: 'I am pleased with Allah as my Lord, with Islam as my religion, and with Muhammad ﷺ as my Prophet.' },
  { id: 'afini', sessions: ['morning', 'evening'], count: 3, source: 'Abu Dawud.',
    arabic: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لَا إِلَٰهَ إِلَّا أَنْتَ',
    translit: "Allahumma 'afini fi badani, Allahumma 'afini fi sam'i, Allahumma 'afini fi basari, la ilaha illa Ant",
    translation: 'O Allah, grant me health in my body. O Allah, grant me health in my hearing. O Allah, grant me health in my sight. There is no god but You.' },
  { id: 'tahlil-10', sessions: ['morning', 'evening'], count: 10, source: 'Reported by Abu Dawud and an-Nasa\'i for ten times; saying it 100 times in a day is reported in Bukhari and Muslim.',
    arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
    translit: "La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamd, wa huwa 'ala kulli shay'in qadir",
    translation: 'None has the right to be worshipped but Allah alone, with no partner. His is the dominion and His is the praise, and He is able to do all things.' },
  { id: 'subhanallah-bihamdihi', sessions: ['morning', 'evening'], count: 100, source: 'Sahih Muslim: whoever says it 100 times morning and evening.',
    arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    translit: 'Subhanallahi wa bihamdih',
    translation: 'Glory be to Allah and praise be to Him.' },
  { id: 'istighfar-100', sessions: ['morning', 'evening'], count: 100, source: 'Sahih Muslim: the Prophet ﷺ sought forgiveness 100 times a day. Do as many as you can.',
    arabic: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ',
    translit: "Astaghfirullaha wa atubu ilayh",
    translation: "I seek Allah's forgiveness and turn to Him in repentance." },

  // ----- After prayer -----
  { id: 'astaghfirullah-3', sessions: ['after'], count: 3, source: 'Sahih Muslim.',
    arabic: 'أَسْتَغْفِرُ اللَّهَ',
    translit: 'Astaghfirullah',
    translation: 'I seek forgiveness from Allah.' },
  { id: 'antas-salam', sessions: ['after'], count: 1, source: 'Sahih Muslim.',
    arabic: 'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ',
    translit: "Allahumma Antas-Salam, wa minkas-salam, tabarakta ya Dhal-Jalali wal-Ikram",
    translation: 'O Allah, You are Peace and from You comes peace. Blessed are You, O Possessor of majesty and honour.' },
  { id: 'after-subhanallah', sessions: ['after'], count: 33, source: 'Sahih Muslim.',
    arabic: 'سُبْحَانَ اللَّهِ', translit: 'SubhanAllah', translation: 'Glory be to Allah.' },
  { id: 'after-alhamdulillah', sessions: ['after'], count: 33, source: 'Sahih Muslim.',
    arabic: 'الْحَمْدُ لِلَّهِ', translit: 'Alhamdulillah', translation: 'All praise is for Allah.' },
  { id: 'after-allahu-akbar', sessions: ['after'], count: 34, source: 'Sahih Muslim (33, 33, 34).',
    arabic: 'اللَّهُ أَكْبَرُ', translit: 'Allahu Akbar', translation: 'Allah is the Greatest.' },
  { id: 'la-mani', sessions: ['after'], count: 1, source: 'Sahih al-Bukhari and Sahih Muslim.',
    arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ، اللَّهُمَّ لَا مَانِعَ لِمَا أَعْطَيْتَ، وَلَا مُعْطِيَ لِمَا مَنَعْتَ، وَلَا يَنْفَعُ ذَا الْجَدِّ مِنْكَ الْجَدُّ',
    translit: "La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamd, wa huwa 'ala kulli shay'in qadir. Allahumma la mani'a lima a'tayta, wa la mu'tiya lima mana'ta, wa la yanfa'u dhal-jaddi minkal-jadd",
    translation: 'None has the right to be worshipped but Allah alone, with no partner. His is the dominion and the praise, and He is able to do all things. O Allah, none can withhold what You give, none can give what You withhold, and the might of the mighty cannot benefit them against You.' },
  { id: 'a-inni', sessions: ['after'], count: 1, source: "Abu Dawud, an-Nasa'i: the Prophet ﷺ told Mu'adh to say it after every prayer.",
    arabic: 'اللَّهُمَّ أَعِنِّي عَلَىٰ ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ',
    translit: "Allahumma a'inni 'ala dhikrika wa shukrika wa husni 'ibadatik",
    translation: 'O Allah, help me to remember You, to thank You, and to worship You well.' },
];
const ADHKAR_SESSIONS = [
  { key: 'morning', label: 'Morning', hint: 'After Fajr until sunrise is best; valid until Dhuhr' },
  { key: 'evening', label: 'Evening', hint: 'After Asr until Maghrib is best' },
  { key: 'after', label: 'After prayer', hint: 'After each obligatory prayer' },
];

function AdhkarPanel({ t }) {
  const [store, setStore] = usePersisted(LS_ADHKAR, { date: dateKey(), progress: {}, done: {} });
  const today = dateKey();
  // A new day starts with fresh counters (streak history is kept).
  const cur = store.date === today ? store : { ...store, date: today, progress: {} };
  const [session, setSession] = useState(() => (new Date().getHours() < 12 ? 'morning' : 'evening'));
  const [open, setOpen] = useState({});

  const items = ADHKAR.filter((i) => i.sessions.includes(session));
  const progress = cur.progress[session] || {};
  const totalCount = items.length;
  const doneCount = items.filter((i) => (progress[i.id] || 0) >= i.count).length;
  const allDone = totalCount > 0 && doneCount === totalCount;
  const doneKeys = cur.done?.[session] || [];

  useEffect(() => {
    if (allDone && !doneKeys.includes(today)) {
      setStore({ ...cur, done: { ...cur.done, [session]: [...doneKeys, today].slice(-120) } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, session]);

  const setCount = (id, n) =>
    setStore({ ...cur, progress: { ...cur.progress, [session]: { ...progress, [id]: n } } });
  const tapItem = (item) => {
    const n = progress[item.id] || 0;
    if (n >= item.count) return;
    buzz(n + 1 >= item.count ? [70, 50, 70] : 30);
    setCount(item.id, n + 1);
  };
  const resetSession = () => setStore({ ...cur, progress: { ...cur.progress, [session]: {} } });

  const streak = streakFromKeys(doneKeys, today);

  return (
    <div className="space-y-4">
      <div className={`inline-flex rounded-full p-0.5 ${t.pillTrack}`}>
        {ADHKAR_SESSIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSession(s.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition ${
              session === s.key ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className={`rounded-3xl border px-4 py-4 ${allDone ? t.cardActive : t.cardBg}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">
              {allDone ? '✓ All done. May Allah accept it.' : `${doneCount} of ${totalCount} done`}
            </div>
            <div className={`text-xs mt-0.5 ${t.textMuted}`}>{ADHKAR_SESSIONS.find((s) => s.key === session)?.hint}</div>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-lg font-semibold ${t.accent}`}>{streak}</div>
            <div className={`text-[10px] ${t.textMuted}`}>day streak</div>
          </div>
        </div>
        <div className={`h-1.5 rounded-full mt-3 overflow-hidden ${t.divider} border`}>
          <div className={`h-full ${t.accentBg}`} style={{ width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%`, transition: 'width 0.2s' }} />
        </div>
      </div>

      {items.map((item) => {
        const base = item.ref ? DUAS.find((d) => d.id === item.ref) : null;
        const arabic = item.arabic || base?.arabic || '';
        const translit = item.translit || base?.translit || '';
        const translation = item.translation || base?.translation || '';
        const n = progress[item.id] || 0;
        const complete = n >= item.count;
        const isOpen = !!open[item.id];
        return (
          <div key={item.id} className={`rounded-3xl border px-4 py-4 ${complete ? t.cardActive : t.cardBg}`}>
            <p className="font-arabic text-2xl leading-[2.2] text-right" dir="rtl">
              {arabic}
            </p>
            {isOpen && (
              <div className="mt-3 space-y-2">
                <p className={`text-xs italic leading-relaxed ${t.textMuted}`}>{translit}</p>
                <p className="text-sm leading-relaxed">{translation}</p>
                <p className={`text-[11px] ${t.textFaint}`}>{item.source}</p>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 mt-3">
              <button onClick={() => setOpen({ ...open, [item.id]: !isOpen })} className={`text-xs ${t.textMuted} underline-offset-2 hover:underline`}>
                {isOpen ? 'Hide meaning' : 'Show meaning'}
              </button>
              <div className="flex items-center gap-2">
                {item.count > 1 && !complete && (
                  <button onClick={() => setCount(item.id, item.count)} className={`text-[11px] ${t.textFaint} hover:underline`}>
                    Mark done
                  </button>
                )}
                {n > 0 && (
                  <button onClick={() => setCount(item.id, 0)} className={`text-[11px] ${t.textFaint} hover:underline`}>
                    Reset
                  </button>
                )}
                <button
                  onClick={() => tapItem(item)}
                  disabled={complete}
                  className={`min-w-[84px] px-4 py-2 rounded-full text-sm font-semibold tabular-nums touch-manipulation ${
                    complete ? 'bg-emerald-600/20 text-emerald-500' : `${t.accentBg} text-white active:scale-95`
                  }`}
                  aria-label={`Count, ${n} of ${item.count}`}
                >
                  {complete ? '✓' : `${n} / ${item.count}`}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex justify-center">
        <button onClick={resetSession} className={`text-xs px-3 py-1.5 rounded-lg ${t.btn}`}>
          Reset this list
        </button>
      </div>
      <p className={`text-[11px] text-center leading-relaxed ${t.textFaint}`}>
        Sources are named on each card. Please have a knowledgeable person proofread the Arabic.
      </p>
    </div>
  );
}

function SwitchRow({ t, label, hint, on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className={`w-full flex items-center justify-between gap-3 text-left px-4 py-3 rounded-2xl border ${t.cardBg}`}
    >
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className={`block text-xs mt-0.5 leading-snug ${t.textMuted}`}>{hint}</span>}
      </span>
      <span className={`shrink-0 w-11 h-6 rounded-full relative transition ${on ? t.accentBg : t.pillTrack}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-[1px_2px_4px_rgba(0,0,0,0.3)] transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

/* ---------------- Prayer tracker ---------------- */

const TRACKER_PRAYERS = [
  { key: 'Fajr', ar: 'الفجر' },
  { key: 'Dhuhr', ar: 'الظهر' },
  { key: 'Asr', ar: 'العصر' },
  { key: 'Maghrib', ar: 'المغرب' },
  { key: 'Isha', ar: 'العشاء' },
];

function PrayerTrackerPanel({ t }) {
  const [saved, setSaved] = usePersisted(LS_PRAYER_LOG, { log: {}, extra: {}, madeUp: {} });
  const data = { log: {}, extra: {}, madeUp: {}, ...saved };
  const today = dateKey();
  const [offset, setOffset] = useState(0); // 0 = today, -1 = yesterday ...
  const key = addDaysKey(today, offset);
  const dayLog = data.log[key] || {};

  const setPrayerState = (prayer, state) => {
    const day = { ...dayLog };
    if (state) day[prayer] = state;
    else delete day[prayer];
    const log = { ...data.log };
    if (Object.keys(day).length) log[key] = day;
    else delete log[key];
    setSaved({ ...data, log });
  };
  const cycle = (prayer) => {
    const cur = dayLog[prayer];
    setPrayerState(prayer, cur === 'p' ? 'm' : cur === 'm' ? null : 'p');
    buzz(10);
  };
  const markAll = () => {
    const day = {};
    FIVE_PRAYERS.forEach((p) => {
      day[p] = 'p';
    });
    setSaved({ ...data, log: { ...data.log, [key]: day } });
    buzz([30, 30, 30]);
  };

  const streak = currentPrayerStreak(data.log, today);
  const best = bestPrayerStreak(data.log);
  const pending = pendingQada(data.log, data.extra, data.madeUp);
  const pendingTotal = Object.values(pending).reduce((a, b) => a + b, 0);
  const countToday = dayCount(data.log, key);

  const grid = Array.from({ length: 28 }, (_, i) => addDaysKey(today, i - 27));
  const dayLabel =
    offset === 0
      ? 'Today'
      : offset === -1
      ? 'Yesterday'
      : parseKey(key).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const addMadeUp = (p) => setSaved({ ...data, madeUp: { ...data.madeUp, [p]: (data.madeUp[p] || 0) + 1 } });
  const addOwed = (p) => setSaved({ ...data, extra: { ...data.extra, [p]: (data.extra[p] || 0) + 1 } });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-3xl border p-4 text-center ${t.cardBg}`}>
          <div className={`text-2xl font-semibold ${t.accent}`}>{streak}</div>
          <div className={`text-xs mt-1 ${t.textMuted}`}>Day streak</div>
        </div>
        <div className={`rounded-3xl border p-4 text-center ${t.cardBg}`}>
          <div className="text-2xl font-semibold">{best}</div>
          <div className={`text-xs mt-1 ${t.textMuted}`}>Best streak</div>
        </div>
        <div className={`rounded-3xl border p-4 text-center ${t.cardBg}`}>
          <div className={`text-2xl font-semibold ${pendingTotal ? 'text-amber-500' : ''}`}>{pendingTotal}</div>
          <div className={`text-xs mt-1 ${t.textMuted}`}>Qada owed</div>
        </div>
      </div>

      <div className={`rounded-3xl border px-4 py-4 ${t.cardBg}`}>
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setOffset((o) => Math.max(-13, o - 1))}
            disabled={offset <= -13}
            className={`p-2 rounded-full ${t.hoverSoft} disabled:opacity-30`}
            aria-label="Previous day"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <div className="text-sm font-semibold">{dayLabel}</div>
            <div className={`text-xs ${t.textMuted}`}>{countToday} of 5 prayed</div>
          </div>
          <button
            onClick={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={offset >= 0}
            className={`p-2 rounded-full ${t.hoverSoft} disabled:opacity-30`}
            aria-label="Next day"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {TRACKER_PRAYERS.map((p) => {
            const s = dayLog[p.key];
            return (
              <button
                key={p.key}
                onClick={() => cycle(p.key)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition ${
                  s === 'p' ? t.cardActive : s === 'm' ? 'border-red-500/40 bg-red-500/5' : `${t.divider} ${t.hoverSoft}`
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="font-arabic text-lg w-14 text-right" dir="rtl">{p.ar}</span>
                  <span className="text-sm">{p.key}</span>
                </span>
                <span
                  className={`text-xs font-medium px-3 py-1 rounded-full ${
                    s === 'p' ? 'bg-emerald-600/20 text-emerald-500' : s === 'm' ? 'bg-red-500/15 text-red-500' : `${t.textFaint}`
                  }`}
                >
                  {s === 'p' ? '✓ Prayed' : s === 'm' ? 'Missed' : 'Tap to log'}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className={`text-[11px] ${t.textFaint}`}>Tap once for prayed, twice for missed, three times to clear.</p>
          <button onClick={markAll} className={`text-xs px-3 py-1.5 rounded-lg ${t.btn}`}>
            All prayed
          </button>
        </div>
      </div>

      <div className={`rounded-3xl border px-4 py-4 ${t.cardBg}`}>
        <h3 className="text-sm font-semibold mb-3">Last 4 weeks</h3>
        <div className="grid grid-cols-7 gap-1.5">
          {grid.map((k) => {
            const n = dayCount(data.log, k);
            const missed = FIVE_PRAYERS.some((p) => data.log[k]?.[p] === 'm');
            return (
              <div
                key={k}
                title={`${k}: ${n}/5`}
                className={`aspect-square rounded-lg flex items-center justify-center text-[10px] ${
                  n === 0 ? `border ${t.divider} ${t.textFaint}` : `${t.accentBg} text-white`
                } ${k === today ? 'ring-2 ring-offset-1 ring-emerald-500/60' : ''}`}
                style={n > 0 && n < 5 ? { opacity: 0.35 + n * 0.13 } : undefined}
              >
                {missed && n === 0 ? '·' : n > 0 ? n : ''}
              </div>
            );
          })}
        </div>
        <p className={`text-[11px] mt-2 ${t.textFaint}`}>Number = prayers logged that day. Solid = all five.</p>
      </div>

      <div className={`rounded-3xl border px-4 py-4 ${t.cardBg}`}>
        <h3 className="text-sm font-semibold mb-1">Qada (make-up prayers)</h3>
        <p className={`text-xs mb-3 leading-relaxed ${t.textMuted}`}>
          A prayer you log as missed is added here. Tap "Made up" each time you pray one as qada. Use + to add prayers
          you owe from the past.
        </p>
        <div className="space-y-2">
          {TRACKER_PRAYERS.map((p) => (
            <div key={p.key} className="flex items-center justify-between gap-2">
              <span className="text-sm w-20">{p.key}</span>
              <span className={`text-lg font-semibold tabular-nums w-12 text-center ${pending[p.key] ? 'text-amber-500' : t.textFaint}`}>
                {pending[p.key]}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => addMadeUp(p.key)}
                  disabled={!pending[p.key]}
                  className={`text-xs px-3 py-1.5 rounded-lg ${t.btn} disabled:opacity-30`}
                >
                  Made up
                </button>
                <button
                  onClick={() => addOwed(p.key)}
                  className={`text-xs w-8 py-1.5 rounded-lg ${t.btn}`}
                  aria-label={`Add one owed ${p.key}`}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Ramadan mode ---------------- */

function RamadanPanel({ t, location, extraRem, setExtra }) {
  const adjust = getHijriAdjust();
  useTick(1000); // re-render every second for the countdown
  const { times, tz, error: timesError } = useTodayTimings(location);
  const [fastSaved, setFastSaved] = usePersisted(LS_FAST_LOG, { days: {}, madeUp: 0 });
  const [twSaved, setTwSaved] = usePersisted(LS_TARAWEEH, { rakaat: 8, done: {} });
  const F = { days: {}, madeUp: 0, ...fastSaved };
  const TW = { rakaat: 8, done: {}, ...twSaved };

  const today = new Date();
  const todayKey = dateKey(today);
  const hj = HIJRI_FMT ? toHijri(today, adjust) : null;

  const ramadan = useMemo(() => {
    if (!HIJRI_FMT || !hj) return null;
    if (hj.m === 9) {
      const first = firstOfHijriMonth(today, adjust);
      return { active: true, first, len: hijriMonthLength(first, adjust), year: hj.y };
    }
    for (let i = 1; i <= 400; i++) {
      const d = hjAddDays(today, i);
      const h = toHijri(d, adjust);
      if (h.m === 9 && h.d === 1) return { active: false, first: d, len: hijriMonthLength(d, adjust), year: h.y, inDays: i };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey, adjust]);

  const sunnah = useMemo(() => {
    const out = [];
    if (!HIJRI_FMT) return out;
    for (let i = 0; i < 70 && out.length < 8; i++) {
      const d = hjAddDays(today, i);
      const h = toHijri(d, adjust);
      const info = sunnahFastInfo(d, h);
      if (info) out.push({ date: d, key: dateKey(d), info, h, i });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey, adjust]);

  if (!HIJRI_FMT || !hj) {
    return <p className={`text-sm text-center py-10 ${t.textMuted}`}>This browser does not support the Islamic calendar.</p>;
  }

  const clock = zonedClock(tz);
  let countdown = null;
  if (times && timeToMin(times.Fajr) != null && timeToMin(times.Maghrib) != null) {
    const fajr = timeToMin(times.Fajr) * 60;
    const maghrib = timeToMin(times.Maghrib) * 60;
    const s = clock.seconds;
    if (s < fajr) countdown = { label: 'Suhoor ends (Fajr) in', left: fajr - s };
    else if (s < maghrib) countdown = { label: 'Iftar (Maghrib) in', left: maghrib - s };
    else countdown = { label: 'Next suhoor ends in', left: fajr + 86400 - s };
  }

  const cycleFast = (key) => {
    const cur = F.days[key];
    const days = { ...F.days };
    if (cur === 'f') days[key] = 'm';
    else if (cur === 'm') delete days[key];
    else days[key] = 'f';
    setFastSaved({ ...F, days });
    buzz(10);
  };
  const toggleSunnahFast = (key) => {
    const days = { ...F.days };
    if (days[key] === 'f') delete days[key];
    else days[key] = 'f';
    setFastSaved({ ...F, days });
  };

  const ramadanDates = ramadan ? Array.from({ length: ramadan.len }, (_, i) => hjAddDays(ramadan.first, i)) : [];
  const fastedCount = ramadanDates.filter((d) => F.days[dateKey(d)] === 'f').length;
  const missedAll = Object.values(F.days).filter((v) => v === 'm').length;
  const qadaPending = Math.max(0, missedAll - F.madeUp);

  const night = ramadan?.active ? hj.d : 1;
  const twKey = ramadan ? `${ramadan.year}-${night}` : '';
  const pagesPerRakah = 20 / TW.rakaat; // one juz is 20 pages of the standard Madinah mushaf
  const pardon = DUAS.find((d) => d.id === 'akhirah-pardon');

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className={`rounded-3xl border px-5 py-5 text-center ${t.cardActive}`}>
        {ramadan?.active ? (
          <>
            <div className="text-xs uppercase tracking-wider mb-1">Ramadan {hj.y}</div>
            <div className="text-2xl font-semibold">Day {hj.d} of {ramadan.len}</div>
          </>
        ) : (
          <>
            <div className="text-xs uppercase tracking-wider mb-1">Ramadan {ramadan?.year}</div>
            <div className="text-2xl font-semibold">
              {ramadan ? `Begins in about ${ramadan.inDays} days` : 'Not found'}
            </div>
            {ramadan && (
              <div className={`text-xs mt-1 ${t.textMuted}`}>
                {ramadan.first.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Countdown */}
      <div className={`rounded-3xl border px-4 py-5 text-center ${t.cardBg}`}>
        {!location ? (
          <p className={`text-sm ${t.textMuted}`}>Set your location in the Prayer tab to see suhoor and iftar times.</p>
        ) : !times ? (
          <p className={`text-sm ${t.textMuted}`}>{timesError ? 'Could not load today\'s times.' : 'Loading times…'}</p>
        ) : (
          <>
            <div className={`text-xs ${t.textMuted}`}>{countdown.label}</div>
            <div className="text-4xl font-semibold tabular-nums my-2">{fmtCountdown(countdown.left)}</div>
            <div className="flex justify-center gap-6 text-sm">
              <div>
                <div className={`text-[11px] ${t.textMuted}`}>Suhoor ends</div>
                <div className="font-semibold tabular-nums">{to12h(times.Fajr)}</div>
              </div>
              <div>
                <div className={`text-[11px] ${t.textMuted}`}>Iftar</div>
                <div className="font-semibold tabular-nums">{to12h(times.Maghrib)}</div>
              </div>
            </div>
          </>
        )}
      </div>

      <SwitchRow
        t={t}
        label="Suhoor reminder"
        hint="45 minutes before Fajr, during Ramadan"
        on={extraRem.suhoor}
        onChange={(v) => setExtra('suhoor', v)}
      />
      <SwitchRow
        t={t}
        label="Iftar reminder"
        hint="10 minutes before Maghrib, during Ramadan"
        on={extraRem.iftar}
        onChange={(v) => setExtra('iftar', v)}
      />
      <p className={`text-[11px] px-1 ${t.textFaint}`}>
        Reminders need the app open in a browser tab, and the Prayer tab location set.
      </p>

      {/* Fasting tracker */}
      {ramadan && (
        <div className={`rounded-3xl border px-4 py-4 ${t.cardBg}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Fasting tracker</h3>
            <span className={`text-xs ${t.textMuted}`}>{fastedCount} fasted</span>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
            {ramadanDates.map((d, i) => {
              const k = dateKey(d);
              const s = F.days[k];
              const future = k > todayKey;
              return (
                <button
                  key={k}
                  disabled={future}
                  onClick={() => cycleFast(k)}
                  aria-label={`Day ${i + 1}`}
                  className={`aspect-square rounded-xl border text-xs flex flex-col items-center justify-center transition ${
                    s === 'f'
                      ? 'bg-emerald-600/25 border-emerald-500/50 text-emerald-500'
                      : s === 'm'
                      ? 'bg-red-500/15 border-red-500/40 text-red-500'
                      : `${t.divider} ${future ? 'opacity-40' : t.hoverSoft}`
                  } ${k === todayKey ? 'ring-2 ring-emerald-500/60' : ''}`}
                >
                  <span className="font-semibold leading-none">{i + 1}</span>
                  <span className="text-[9px] leading-none mt-0.5">{s === 'f' ? '✓' : s === 'm' ? '✗' : d.getDate()}</span>
                </button>
              );
            })}
          </div>
          <p className={`text-[11px] mt-2 ${t.textFaint}`}>Tap: fasted ✓ → missed ✗ → clear. Missed days become qada fasts.</p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-current/10">
            <div>
              <div className="text-sm">Qada fasts owed</div>
              <div className={`text-xl font-semibold ${qadaPending ? 'text-amber-500' : ''}`}>{qadaPending}</div>
            </div>
            <button
              disabled={!qadaPending}
              onClick={() => setFastSaved({ ...F, madeUp: F.madeUp + 1 })}
              className={`text-xs px-3 py-2 rounded-lg ${t.btn} disabled:opacity-30`}
            >
              I made up one fast
            </button>
          </div>
        </div>
      )}

      {/* Taraweeh */}
      <div className={`rounded-3xl border px-4 py-4 ${t.cardBg}`}>
        <h3 className="text-sm font-semibold mb-1">Taraweeh planner</h3>
        <div className="flex items-center gap-1.5 mb-3">
          <span className={`text-xs ${t.textMuted} mr-1`}>Rak'ahs</span>
          {[8, 20].map((n) => (
            <button
              key={n}
              onClick={() => setTwSaved({ ...TW, rakaat: n })}
              className={`px-3 py-1 rounded-full text-xs border ${
                TW.rakaat === n ? `${t.accentBg} text-white border-transparent` : `${t.btn} ${t.textMuted}`
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className={`rounded-2xl border px-4 py-3 ${t.divider}`}>
          <div className="text-xs mb-0.5 text-center">{ramadan?.active ? `Night ${night}` : 'Plan for night 1'}</div>
          <div className="text-lg font-semibold text-center">Juz {Math.min(night, 30)}</div>
          <p className={`text-xs text-center mt-1 leading-relaxed ${t.textMuted}`}>
            One juz a night completes the Qur'an in Taraweeh. At {TW.rakaat} rak'ahs that is about{' '}
            {Number.isInteger(pagesPerRakah) ? pagesPerRakah : pagesPerRakah.toFixed(1)} page
            {pagesPerRakah === 1 ? '' : 's'} per rak'ah (a juz is 20 pages).
          </p>
          {ramadan?.active && (
            <button
              onClick={() => setTwSaved({ ...TW, done: { ...TW.done, [twKey]: !TW.done[twKey] } })}
              className={`mt-3 w-full text-xs px-3 py-2 rounded-lg ${TW.done[twKey] ? 'bg-emerald-600/20 text-emerald-500' : `${t.accentBg} text-white`}`}
            >
              {TW.done[twKey] ? '✓ Tonight completed' : 'Mark tonight complete'}
            </button>
          )}
        </div>
        {ramadan && (
          <div className="flex flex-wrap gap-1 mt-3">
            {Array.from({ length: Math.min(30, ramadan.len) }, (_, i) => (
              <span
                key={i}
                title={`Night ${i + 1}`}
                className={`w-2.5 h-2.5 rounded-full ${TW.done[`${ramadan.year}-${i + 1}`] ? 'bg-emerald-500' : `border ${t.divider}`}`}
              />
            ))}
          </div>
        )}
        <p className={`text-[11px] mt-2 ${t.textFaint}`}>
          This is a simple pacing guide. Follow the imam's recitation and your local practice.
        </p>
      </div>

      {/* Last ten nights */}
      {ramadan?.active && hj.d >= 19 && (
        <div className={`rounded-3xl border px-4 py-4 ${t.cardBg}`}>
          <h3 className="text-sm font-semibold mb-1">The last ten nights</h3>
          <p className={`text-xs leading-relaxed mb-3 ${t.textMuted}`}>
            Seek Laylat al-Qadr in the odd nights of the last ten (Bukhari and Muslim). Nights below are Ramadan{' '}
            {[21, 23, 25, 27, 29].join(', ')}.
          </p>
          {pardon && (
            <div className={`rounded-2xl border px-3 py-3 ${t.divider}`}>
              <p className="font-arabic text-xl text-right leading-[2]" dir="rtl">{pardon.arabic}</p>
              <p className={`text-xs italic mt-2 ${t.textMuted}`}>{pardon.translit}</p>
              <p className="text-sm mt-1">{pardon.translation}</p>
            </div>
          )}
        </div>
      )}

      {/* Sunnah fasts */}
      <div className={`rounded-3xl border px-4 py-4 ${t.cardBg}`}>
        <h3 className="text-sm font-semibold mb-1">Sunnah fasts coming up</h3>
        <p className={`text-xs mb-3 leading-relaxed ${t.textMuted}`}>
          Mondays and Thursdays, the White Days (13, 14, 15 of each Hijri month), Arafah and Ashura.
          Six days of Shawwal after Eid are also recommended (Sahih Muslim).
        </p>
        <div className="space-y-2">
          {sunnah.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm truncate">{s.info.label}</div>
                <div className={`text-xs ${t.textMuted}`}>
                  {s.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {s.h.d}{' '}
                  {HIJRI_MONTHS[s.h.m - 1].en}
                  {s.i === 0 ? ' · today' : s.i === 1 ? ' · tomorrow' : ''}
                </div>
              </div>
              <button
                onClick={() => toggleSunnahFast(s.key)}
                disabled={s.key > todayKey}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-lg border ${
                  F.days[s.key] === 'f' ? 'bg-emerald-600/20 text-emerald-500 border-transparent' : `${t.divider} ${t.hoverSoft}`
                } disabled:opacity-30`}
              >
                {F.days[s.key] === 'f' ? '✓ Fasted' : 'I fasted'}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <SwitchRow
            t={t}
            label="Remind me the evening before"
            hint="At Isha, the night before a Sunnah fast"
            on={extraRem.sunnahFast}
            onChange={(v) => setExtra('sunnahFast', v)}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Install & offline ---------------- */

function formatBytes(n) {
  if (!n) return '0 MB';
  const mb = n / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

function OfflinePanel({ t, installPrompt, onInstall, installed, ayahs, surahMeta, reciter, translationLang }) {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [usage, setUsage] = useState(null);
  const [job, setJob] = useState(null); // { kind, done, total, failed, finished, error }

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const refreshUsage = async () => {
    try {
      const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
      let api = 0;
      let audio = 0;
      if ('caches' in window) {
        api = (await (await caches.open(API_CACHE_NAME)).keys()).length;
        audio = (await (await caches.open(AUDIO_CACHE_NAME)).keys()).length;
      }
      setUsage({ used: est?.usage || 0, quota: est?.quota || 0, api, audio });
    } catch {
      setUsage(null);
    }
  };
  useEffect(() => {
    refreshUsage();
  }, []);

  const saveText = async () => {
    if (!('caches' in window)) {
      setJob({ kind: 'text', error: 'Offline storage is not available here (it needs HTTPS or localhost).' });
      return;
    }
    const cache = await caches.open(API_CACHE_NAME);
    const edition = TRANSLATION_OPTIONS[translationLang].edition;
    const urls = [`${API_BASE}/surah`];
    for (let n = 1; n <= 114; n++) urls.push(`${API_BASE}/surah/${n}/editions/${buildEditions(reciter, edition)}`);
    let done = 0;
    let failed = 0;
    let next = 0;
    setJob({ kind: 'text', done: 0, total: urls.length });
    const worker = async () => {
      while (next < urls.length) {
        const u = urls[next++];
        try {
          if (!(await cache.match(u))) {
            const r = await fetch(u);
            if (r.ok) await cache.put(u, r);
            else failed++;
          }
        } catch {
          failed++;
        }
        done++;
        setJob({ kind: 'text', done, total: urls.length });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setJob({ kind: 'text', done, total: urls.length, failed, finished: true });
    refreshUsage();
  };

  const saveAudio = async () => {
    const urls = ayahs.map((a) => a.audioUrl).filter(Boolean);
    if (!urls.length) return;
    if (!('caches' in window)) {
      setJob({ kind: 'audio', error: 'Offline storage is not available here (it needs HTTPS or localhost).' });
      return;
    }
    const cache = await caches.open(AUDIO_CACHE_NAME);
    let done = 0;
    let failed = 0;
    let next = 0;
    setJob({ kind: 'audio', done: 0, total: urls.length });
    const worker = async () => {
      while (next < urls.length) {
        const u = urls[next++];
        try {
          if (!(await cache.match(u))) {
            const r = await fetch(u, { mode: 'cors' });
            if (r.ok && r.status === 200) await cache.put(u, r);
            else failed++;
          }
        } catch {
          failed++; // most likely the audio server does not allow this site to save its files
        }
        done++;
        setJob({ kind: 'audio', done, total: urls.length });
      }
    };
    await Promise.all([worker(), worker()]);
    setJob({ kind: 'audio', done, total: urls.length, failed, finished: true });
    refreshUsage();
  };

  const clearAll = async () => {
    if (!('caches' in window)) return;
    await caches.delete(API_CACHE_NAME);
    await caches.delete(AUDIO_CACHE_NAME);
    setJob(null);
    refreshUsage();
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const swSupported = 'serviceWorker' in navigator;
  const swActive = swSupported && !!navigator.serviceWorker.controller;
  const isProd = !!import.meta.env.PROD;
  const busy = job && !job.finished && !job.error;

  return (
    <div className="space-y-4">
      <div className={`rounded-3xl border px-4 py-4 ${t.cardBg}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Install the app</h3>
            <p className={`text-xs mt-1 leading-relaxed ${t.textMuted}`}>
              {installed
                ? 'Installed. You are using it as an app.'
                : installPrompt
                ? 'Add it to your home screen or desktop so it opens like a normal app.'
                : isIOS
                ? 'On iPhone or iPad: tap the Share button, then "Add to Home Screen".'
                : 'Use your browser menu: "Install app" (Chrome, Edge) or "Add to Home Screen" (mobile).'}
            </p>
          </div>
          {installPrompt && !installed && (
            <button onClick={onInstall} className={`shrink-0 text-xs px-4 py-2 rounded-lg ${t.accentBg} text-white`}>
              Install
            </button>
          )}
        </div>
      </div>

      <div className={`rounded-3xl border px-4 py-4 ${t.cardBg}`}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold">Offline use</h3>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${online ? 'bg-emerald-600/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
            {online ? 'Online' : 'Offline'}
          </span>
        </div>
        <p className={`text-xs leading-relaxed ${t.textMuted}`}>
          {!swSupported
            ? 'This browser does not support offline apps.'
            : swActive
            ? 'Offline support is on. The app opens without internet, and any surah you read or listen to is kept.'
            : isProd
            ? 'Offline support will switch on after you reload once.'
            : 'Offline support only runs in the built version of the app: run "npm run build" and then "npm run preview".'}
        </p>

        <div className="space-y-2 mt-4">
          <button
            onClick={saveText}
            disabled={busy}
            className={`w-full text-sm px-4 py-2.5 rounded-xl ${t.btn} disabled:opacity-50`}
          >
            Save the whole Qur'an text for offline
          </button>
          <button
            onClick={saveAudio}
            disabled={busy || !ayahs.length}
            className={`w-full text-sm px-4 py-2.5 rounded-xl ${t.btn} disabled:opacity-50`}
          >
            {ayahs.length && surahMeta
              ? `Save audio of ${surahMeta.englishName} (${ayahs.length} ayahs)`
              : 'Open a surah first to save its audio'}
          </button>
        </div>

        {job && (
          <div className="mt-3">
            {job.error ? (
              <p className="text-xs text-red-500">{job.error}</p>
            ) : (
              <>
                <div className={`h-1.5 rounded-full overflow-hidden border ${t.divider}`}>
                  <div className={`h-full ${t.accentBg}`} style={{ width: `${(job.done / job.total) * 100}%`, transition: 'width 0.2s' }} />
                </div>
                <p className={`text-xs mt-1.5 ${t.textMuted}`}>
                  {job.finished
                    ? job.failed
                      ? `Finished. ${job.total - job.failed} saved, ${job.failed} could not be saved${
                          job.kind === 'audio' ? ' (the audio server may not allow saving)' : ''
                        }.`
                      : 'All saved. ✓'
                    : `Saving… ${job.done} of ${job.total}`}
                </p>
              </>
            )}
          </div>
        )}

        <p className={`text-[11px] mt-3 leading-relaxed ${t.textFaint}`}>
          Text is saved for your current reciter and translation language; if you change either, save again. Audio is
          saved for the current reciter only.
        </p>
      </div>

      <div className={`rounded-3xl border px-4 py-4 ${t.cardBg}`}>
        <h3 className="text-sm font-semibold mb-2">Storage</h3>
        {usage ? (
          <>
            <p className={`text-xs ${t.textMuted}`}>
              {usage.api} saved text pages · {usage.audio} saved audio files · app total {formatBytes(usage.used)}
              {usage.quota ? ` of ${formatBytes(usage.quota)} available` : ''}
            </p>
            <button onClick={clearAll} className={`mt-3 text-xs px-3 py-1.5 rounded-lg ${t.btn}`}>
              Clear saved Qur'an text and audio
            </button>
          </>
        ) : (
          <p className={`text-xs ${t.textMuted}`}>Storage details are not available in this browser.</p>
        )}
        <p className={`text-[11px] mt-3 ${t.textFaint}`}>
          Your tasbih counts, adhkar, prayer log and settings stay on this device only, and are not uploaded anywhere.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Worship hub ---------------- */

const WORSHIP_TABS = [
  { key: 'tasbih', label: 'Tasbih' },
  { key: 'adhkar', label: 'Adhkar' },
  { key: 'prayers', label: 'Prayers' },
  { key: 'ramadan', label: 'Ramadan' },
  { key: 'app', label: 'App' },
];

function WorshipSection({ t, tab, setTab, location, extraRem, setExtra, offline }) {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 pb-16">
      <div className="flex gap-2 overflow-x-auto pt-2 pb-5 mb-1 -mx-3 px-3">
        {WORSHIP_TABS.map((x) => (
          <button
            key={x.key}
            onClick={() => setTab(x.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition ${
              tab === x.key ? `${t.accentBg} text-white border-transparent` : `${t.btn} ${t.textMuted}`
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {tab === 'tasbih' && <TasbihPanel t={t} />}
      {tab === 'adhkar' && <AdhkarPanel t={t} />}
      {tab === 'prayers' && <PrayerTrackerPanel t={t} />}
      {tab === 'ramadan' && <RamadanPanel t={t} location={location} extraRem={extraRem} setExtra={setExtra} />}
      {tab === 'app' && <OfflinePanel t={t} {...offline} />}
    </div>
  );
}


/* ==================== Copyright notice ==================== */

function CopyrightNotice({ t }) {
  return (
    <footer className={`max-w-3xl mx-auto px-4 md:px-8 pt-2 pb-28 text-center text-[11px] leading-relaxed ${t.textFaint}`}>
      <p>
        © {COPYRIGHT_YEAR} {COPYRIGHT_OWNER}. All rights reserved.
      </p>
      <p className="mt-1">
        Quran text, translations and recitation audio are provided by Al Quran Cloud (Islamic Network) and remain
        the property of their respective owners. Prayer times by Aladhan.
      </p>
    </footer>
  );
}

/* ==================== Dua audio ==================== */

// Only one dua plays at a time — starting another stops whichever is active.
let stopActiveDuaAudio = null;

// Plays a dua. If the dua object has an `audio` URL (a real recording you are
// licensed to use), that is played. Otherwise the browser's built-in Arabic
// text-to-speech voice reads the Arabic text, so every dua has working audio
// with no files to host. Voice quality depends on the device.
function DuaAudioButton({ dua, t, onMessage }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'playing'
  const audioElRef = useRef(null);

  const stop = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.onerror = null;
      audioElRef.current.pause();
      audioElRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    setStatus('idle');
  }, []);

  // Stop on unmount (e.g. collapsing the card or switching sections).
  useEffect(
    () => () => {
      if (stopActiveDuaAudio === stop) stopActiveDuaAudio = null;
      if (audioElRef.current) {
        audioElRef.current.onerror = null;
        audioElRef.current.pause();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    },
    [stop]
  );

  const speak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onMessage('No recording found and this browser has no text-to-speech.');
      return;
    }
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    const arabicVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('ar'));
    if (voices.length > 0 && !arabicVoice) {
      onMessage(
        'No Arabic voice on this device. Try Microsoft Edge (it includes free Arabic voices), or add Arabic under Windows Settings › Time & language › Speech. Or add a recording for this dua.'
      );
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(dua.arabic);
    u.lang = arabicVoice?.lang || 'ar-SA';
    if (arabicVoice) u.voice = arabicVoice;
    u.rate = 0.8; // slower, easier to follow
    u.onend = () => setStatus('idle');
    u.onerror = () => setStatus('idle');
    synth.speak(u);
    setStatus('playing');
  };

  const play = () => {
    if (status === 'playing') {
      stop();
      return;
    }
    onMessage('');
    if (stopActiveDuaAudio && stopActiveDuaAudio !== stop) stopActiveDuaAudio();
    stopActiveDuaAudio = stop;

    // 1) A real recording, if one exists; otherwise 2) text-to-speech.
    const url = dua.audio || (DUA_AUDIO_BASE ? `${DUA_AUDIO_BASE}${dua.id}.mp3` : '');
    if (!url) {
      speak();
      return;
    }
    const el = new Audio(url);
    audioElRef.current = el;
    let fellBack = false;
    const fallBack = () => {
      if (fellBack) return;
      fellBack = true;
      audioElRef.current = null;
      setStatus('idle');
      speak();
    };
    el.onended = () => setStatus('idle');
    el.onerror = fallBack; // file missing / undecodable
    el.play().then(() => setStatus('playing')).catch(fallBack);
  };

  return (
    <button
      onClick={play}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ${t.btn}`}
      aria-label={status === 'playing' ? 'Stop dua audio' : 'Play dua audio'}
    >
      {status === 'playing' ? <Pause size={13} /> : <Volume2 size={13} />}
      {status === 'playing' ? 'Stop' : 'Listen'}
    </button>
  );
}

/* ==================== Hijri (Islamic) calendar ==================== */

const HIJRI_MONTHS = [
  { en: 'Muharram', ar: 'مُحَرَّم' },
  { en: 'Safar', ar: 'صَفَر' },
  { en: "Rabi' al-Awwal", ar: 'رَبِيع الأَوَّل' },
  { en: "Rabi' al-Thani", ar: 'رَبِيع الآخِر' },
  { en: 'Jumada al-Ula', ar: 'جُمَادَى الأُولَى' },
  { en: 'Jumada al-Thani', ar: 'جُمَادَى الآخِرَة' },
  { en: 'Rajab', ar: 'رَجَب' },
  { en: "Sha'ban", ar: 'شَعْبَان' },
  { en: 'Ramadan', ar: 'رَمَضَان' },
  { en: 'Shawwal', ar: 'شَوَّال' },
  { en: "Dhu al-Qi'dah", ar: 'ذُو القَعْدَة' },
  { en: 'Dhu al-Hijjah', ar: 'ذُو الحِجَّة' },
];
const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Umm al-Qura is the official Saudi calendar; fall back to the tabular
// "civil" Islamic calendar if the browser lacks it.
const HIJRI_CAL = (() => {
  for (const cal of ['islamic-umalqura', 'islamic-civil']) {
    try {
      if (new Intl.DateTimeFormat(`en-u-ca-${cal}`).resolvedOptions().calendar === cal) return cal;
    } catch (e) {
      /* try the next one */
    }
  }
  return null;
})();
const HIJRI_FMT = HIJRI_CAL
  ? new Intl.DateTimeFormat(`en-u-ca-${HIJRI_CAL}`, { day: 'numeric', month: 'numeric', year: 'numeric' })
  : null;

// Dates are pinned to noon so DST changes can never shift the day.
function hjDate(y, m, d) {
  return new Date(y, m, d, 12);
}
function hjAddDays(date, n) {
  return hjDate(date.getFullYear(), date.getMonth(), date.getDate() + n);
}
function toHijri(date, adjust = 0) {
  const parts = HIJRI_FMT.formatToParts(hjAddDays(date, adjust));
  const get = (type) => parseInt(parts.find((p) => p.type === type)?.value, 10);
  return { y: get('year'), m: get('month'), d: get('day') };
}
function firstOfHijriMonth(date, adjust = 0) {
  const { d } = toHijri(date, adjust);
  return hjAddDays(date, -(d - 1));
}
function hijriMonthLength(first, adjust = 0) {
  return toHijri(hjAddDays(first, 29), adjust).d === 1 ? 29 : 30;
}
function toArabicDigits(n) {
  return String(n).replace(/\d/g, (c) => '٠١٢٣٤٥٦٧٨٩'[c]);
}

// kind: 'major' = holiday / key date, 'minor' = recommended-worship day
function hijriEventsFor(m, d) {
  const ev = [];
  if (m === 1 && d === 1) ev.push({ label: 'Islamic New Year', kind: 'major' });
  if (m === 1 && d === 10) ev.push({ label: 'Day of Ashura', kind: 'major' });
  if (m === 7 && d === 27) ev.push({ label: "Isra' and Mi'raj (traditionally 27 Rajab)", kind: 'major' });
  if (m === 9 && d === 1) ev.push({ label: 'Ramadan begins', kind: 'major' });
  if (m === 9 && [21, 23, 25, 27, 29].includes(d))
    ev.push({ label: `Odd night of the last 10 (${d}) — Laylat al-Qadr is sought`, kind: 'major' });
  if (m === 10 && d === 1) ev.push({ label: 'Eid al-Fitr', kind: 'major' });
  if (m === 12 && d >= 1 && d <= 8) ev.push({ label: 'First 10 days of Dhu al-Hijjah', kind: 'minor' });
  if (m === 12 && d === 9) ev.push({ label: 'Day of Arafah', kind: 'major' });
  if (m === 12 && d === 10) ev.push({ label: 'Eid al-Adha', kind: 'major' });
  if (m === 12 && d >= 11 && d <= 13) ev.push({ label: 'Days of Tashreeq', kind: 'minor' });
  if (d >= 13 && d <= 15) ev.push({ label: 'White Days (Ayyam al-Bid)', kind: 'minor' });
  return ev;
}

function HijriCalendarSection({ t, isDark }) {
  const [adjust, setAdjust] = useState(() => {
    const v = parseInt(localStorage.getItem(LS_HIJRI_ADJUST), 10);
    return [-1, 0, 1].includes(v) ? v : 0;
  });
  const [monthStart, setMonthStart] = useState(() => firstOfHijriMonth(new Date(), adjust));
  const [selected, setSelected] = useState(null); // Date

  useEffect(() => {
    localStorage.setItem(LS_HIJRI_ADJUST, String(adjust));
    setMonthStart(firstOfHijriMonth(new Date(), adjust));
    setSelected(null);
  }, [adjust]);

  const today = useMemo(() => new Date(), []);
  const todayHijri = useMemo(() => (HIJRI_FMT ? toHijri(today, adjust) : null), [today, adjust]);

  const month = useMemo(() => {
    if (!HIJRI_FMT) return null;
    const h = toHijri(monthStart, adjust);
    const length = hijriMonthLength(monthStart, adjust);
    const cells = [];
    for (let i = 0; i < monthStart.getDay(); i++) cells.push(null);
    for (let i = 0; i < length; i++) cells.push(hjAddDays(monthStart, i));
    return { h, length, cells, last: hjAddDays(monthStart, length - 1) };
  }, [monthStart, adjust]);

  // Next occurrences of the major dates over the coming year.
  const upcoming = useMemo(() => {
    if (!HIJRI_FMT) return [];
    const out = [];
    const seen = new Set();
    for (let i = 0; i < 400 && out.length < 6; i++) {
      const date = hjAddDays(today, i);
      const h = toHijri(date, adjust);
      hijriEventsFor(h.m, h.d)
        .filter((e) => e.kind === 'major' && !e.label.startsWith('Odd night'))
        .forEach((e) => {
          const key = `${e.label}-${h.y}`;
          if (seen.has(key)) return;
          seen.add(key);
          out.push({ ...e, date, h, inDays: i });
        });
    }
    return out;
  }, [today, adjust]);

  const goMonth = (dir) => {
    setSelected(null);
    if (dir > 0) setMonthStart(hjAddDays(monthStart, month.length));
    else {
      const prevLast = hjAddDays(monthStart, -1);
      setMonthStart(firstOfHijriMonth(prevLast, adjust));
    }
  };

  const fmtGreg = (d, opts) => d.toLocaleDateString('en-GB', opts);
  const isSameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (!HIJRI_FMT) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-10 text-center">
        <AlertCircle className="mx-auto mb-2 text-red-500" size={24} />
        <p className={`text-sm ${t.textMuted}`}>
          This browser does not support the Islamic calendar. Please update your browser to see Hijri dates.
        </p>
      </div>
    );
  }

  const todayMonthName = HIJRI_MONTHS[todayHijri.m - 1];
  const selectedInfo = selected ? { h: toHijri(selected, adjust), date: selected } : null;
  const selectedEvents = selectedInfo ? hijriEventsFor(selectedInfo.h.m, selectedInfo.h.d) : [];
  const monthName = HIJRI_MONTHS[month.h.m - 1];

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 pb-28">
      {/* Today */}
      <div className={`rounded-3xl border px-5 py-6 mb-5 text-center ${t.cardActive}`}>
        <div className={`text-xs uppercase tracking-wider mb-2 ${t.textMuted}`}>Today</div>
        <div className="font-arabic text-3xl mb-1" dir="rtl">
          {WEEKDAYS_AR[today.getDay()]}، {toArabicDigits(todayHijri.d)} {todayMonthName.ar} {toArabicDigits(todayHijri.y)} هـ
        </div>
        <div className="text-lg font-semibold">
          {todayHijri.d} {todayMonthName.en} {todayHijri.y} AH
        </div>
        <div className={`text-sm mt-1 ${t.textMuted}`}>
          {fmtGreg(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        {hijriEventsFor(todayHijri.m, todayHijri.d).map((e) => (
          <div key={e.label} className={`text-xs mt-2 ${t.accent}`}>
            ✦ {e.label}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className={`rounded-3xl border p-4 mb-5 ${t.cardBg}`}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => goMonth(-1)} className={`p-2 rounded-full ${t.hoverSoft}`} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <div className="text-base font-semibold">
              {monthName.en} {month.h.y} AH
            </div>
            <div className="font-arabic text-lg leading-tight" dir="rtl">
              {monthName.ar} {toArabicDigits(month.h.y)}
            </div>
            <div className={`text-[11px] ${t.textFaint}`}>
              {fmtGreg(monthStart, { day: 'numeric', month: 'short' })} – {fmtGreg(month.last, { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <button onClick={() => goMonth(1)} className={`p-2 rounded-full ${t.hoverSoft}`} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS_EN.map((w, i) => (
            <div key={w} className={`text-center text-[11px] py-1 ${i === 5 ? t.accent : t.textFaint}`}>
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {month.cells.map((date, i) => {
            if (!date) return <div key={`b${i}`} />;
            const h = toHijri(date, adjust);
            const ev = hijriEventsFor(h.m, h.d);
            const hasMajor = ev.some((e) => e.kind === 'major');
            const hasMinor = ev.some((e) => e.kind === 'minor');
            const isToday = isSameDay(date, today);
            const isSel = isSameDay(date, selected);
            return (
              <button
                key={i}
                onClick={() => setSelected(date)}
                className={`relative aspect-square rounded-xl flex flex-col items-center justify-center border transition ${
                  isToday
                    ? `${t.accentBg} text-white border-transparent`
                    : isSel
                    ? `${t.cardActive}`
                    : `border-transparent ${t.hoverSoft}`
                }`}
                aria-label={`${h.d} ${HIJRI_MONTHS[h.m - 1].en}`}
              >
                <span className="text-sm font-semibold leading-none">{h.d}</span>
                <span className={`text-[9px] mt-0.5 leading-none ${isToday ? 'text-white/80' : t.textFaint}`}>
                  {date.getDate()}
                </span>
                {(hasMajor || hasMinor) && (
                  <span
                    className={`absolute bottom-1 w-1 h-1 rounded-full ${
                      hasMajor ? 'bg-amber-500' : isToday ? 'bg-white/70' : 'bg-emerald-500/70'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className={`flex items-center gap-4 mt-3 text-[11px] ${t.textMuted}`}>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Key date</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" /> Recommended day</span>
          <span className="ml-auto">Big number = Hijri, small = Gregorian</span>
        </div>

        <div className="flex justify-center mt-3">
          <button
            onClick={() => {
              setMonthStart(firstOfHijriMonth(new Date(), adjust));
              setSelected(null);
            }}
            className={`text-xs px-3 py-1.5 rounded-full ${t.btn}`}
          >
            Jump to today
          </button>
        </div>
      </div>

      {/* Selected day */}
      {selectedInfo && (
        <div className={`rounded-3xl border px-4 py-4 mb-5 ${t.cardBg}`}>
          <div className="text-sm font-semibold">
            {selectedInfo.h.d} {HIJRI_MONTHS[selectedInfo.h.m - 1].en} {selectedInfo.h.y} AH
          </div>
          <div className={`text-xs ${t.textMuted} mb-2`}>
            {fmtGreg(selectedInfo.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          {selectedEvents.length === 0 ? (
            <p className={`text-xs ${t.textFaint}`}>No special dates on this day.</p>
          ) : (
            selectedEvents.map((e) => (
              <p key={e.label} className="text-sm">
                <span className={e.kind === 'major' ? 'text-amber-500' : 'text-emerald-500'}>✦</span> {e.label}
              </p>
            ))
          )}
        </div>
      )}

      {/* Upcoming */}
      <div className={`rounded-3xl border px-4 py-4 mb-5 ${t.cardBg}`}>
        <h2 className="text-sm font-semibold mb-3">Upcoming</h2>
        <div className="space-y-2.5">
          {upcoming.map((e) => (
            <div key={`${e.label}-${e.h.y}`} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm truncate">{e.label}</div>
                <div className={`text-xs ${t.textMuted}`}>
                  {e.h.d} {HIJRI_MONTHS[e.h.m - 1].en} {e.h.y} · {fmtGreg(e.date, { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <span className={`text-xs shrink-0 ${t.accent}`}>
                {e.inDays === 0 ? 'Today' : e.inDays === 1 ? 'Tomorrow' : `in ${e.inDays} days`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Adjustment */}
      <div className={`rounded-3xl border px-4 py-4 ${t.cardBg}`}>
        <h2 className="text-sm font-semibold mb-1">Adjust for local moon sighting</h2>
        <p className={`text-xs mb-3 leading-relaxed ${t.textMuted}`}>
          Dates use the {HIJRI_CAL === 'islamic-umalqura' ? 'Umm al-Qura' : 'tabular Islamic'} calendar. Your local
          community may start a month a day earlier or later, so you can shift every date by one day. Islamic days begin
          at sunset, so the "night of" a date starts the evening before.
        </p>
        <div className={`inline-flex items-center gap-1 rounded-full border ${t.divider} p-0.5`}>
          {[-1, 0, 1].map((v) => (
            <button
              key={v}
              onClick={() => setAdjust(v)}
              className={`px-3.5 py-1 rounded-full text-xs ${adjust === v ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`}`}
            >
              {v === 0 ? 'No shift' : v > 0 ? '+1 day' : '−1 day'}
            </button>
          ))}
        </div>
      </div>
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
  violet: {
    dark: 'bg-violet-950/40 text-violet-400 border border-violet-900/50',
    light: 'bg-violet-50 text-violet-700 border border-violet-200',
  },
  teal: {
    dark: 'bg-teal-950/40 text-teal-400 border border-teal-900/50',
    light: 'bg-teal-50 text-teal-700 border border-teal-200',
  },
  pink: {
    dark: 'bg-pink-950/40 text-pink-400 border border-pink-900/50',
    light: 'bg-pink-50 text-pink-700 border border-pink-200',
  },
  orange: {
    dark: 'bg-orange-950/40 text-orange-400 border border-orange-900/50',
    light: 'bg-orange-50 text-orange-700 border border-orange-200',
  },
  slate: {
    dark: 'bg-slate-950/40 text-slate-400 border border-slate-900/50',
    light: 'bg-slate-50 text-slate-700 border border-slate-200',
  },
};

function DuasSection({ t, isDark }) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [audioMsg, setAudioMsg] = useState({ id: null, text: '' });
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
        d.translation.toLowerCase().includes(q) ||
        (d.note || '').toLowerCase().includes(q)
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
        <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none ${t.textFaint}`} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by occasion or keyword…"
          className={`w-full pl-10 pr-3 py-2.5 rounded-2xl border text-sm outline-none focus:ring-2 focus:ring-[#667C68]/40 ${t.inputBg}`}
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
        <button
          onClick={() => setActiveCategory('all')}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
            activeCategory === 'all' ? `${t.accentBg} text-white border-transparent` : `${t.btn} ${t.textMuted}`
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
                  : `${t.btn} ${t.textMuted}`
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
            showFavoritesOnly ? 'bg-amber-500 text-white border-transparent' : `${t.btn} ${t.textMuted}`
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
              <div key={dua.id} className={`rounded-3xl border overflow-hidden transition ${t.cardBg}`}>
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
                    <div className="flex items-start gap-2 flex-wrap">
                      <DuaAudioButton dua={dua} t={t} onMessage={(text) => setAudioMsg({ id: dua.id, text })} />
                      <button
                        onClick={() => copyDua(dua)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ${t.btn}`}
                      >
                        {copiedId === dua.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        {copiedId === dua.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    {audioMsg.id === dua.id && audioMsg.text && (
                      <p className="text-xs text-red-500 mt-2 leading-snug">{audioMsg.text}</p>
                    )}
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
