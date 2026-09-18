import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search, ChevronLeft, Play, Pause, SkipBack, SkipForward,
  Bookmark, BookmarkCheck, Copy, Check, Moon, Sun,
  Loader2, BookOpen, AlertCircle, Clock, Compass, MapPin,
  ChevronDown, Droplets, Info,
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
const EDITIONS = 'quran-uthmani,ml.abdulhameed,en.transliteration,ar.alafasy';

const ADHAN_API = 'https://api.aladhan.com/v1';
const PRAYER_METHOD = 2; // Islamic Society of North America (ISNA); change if a different convention is preferred
const KAABA = { lat: 21.4225, lon: 39.8262 };

const LS_BOOKMARKS = 'quran_reader_bookmarks_v1';
const LS_LAST_READ = 'quran_reader_last_read_v1';
const LS_THEME = 'quran_reader_theme_v1';
const LS_PRAYER_LOCATION = 'quran_reader_prayer_location_v1';

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
    title: '3. Standing recitation',
    note: "Recite Surah Al-Fatiha, followed by another short surah or passage in the first two rakahs. You can read Al-Fatiha any time in the Qur'an tab above.",
  },
  {
    title: '4. Ruku (Bowing)',
    arabic: 'سُبْحَانَ رَبِّيَ الْعَظِيمِ',
    translit: 'Subhana Rabbiyal-Adheem',
    translation: 'Glory is to my Lord, the Most Great',
    note: 'Bow with your back straight and hands on your knees, repeating this three times.',
  },
  {
    title: '5. Rising from Ruku',
    arabic: 'سَمِعَ اللَّهُ لِمَنْ حَمِدَهُ ۚ رَبَّنَا وَلَكَ الْحَمْدُ',
    translit: 'Sami Allahu liman hamidah · Rabbana wa lakal-hamd',
    translation: 'Allah hears whoever praises Him · Our Lord, praise be to You',
    note: 'Stand up straight before moving into prostration.',
  },
  {
    title: '6. Sujud (Prostration)',
    arabic: 'سُبْحَانَ رَبِّيَ الْأَعْلَى',
    translit: "Subhana Rabbiyal-A'la",
    translation: 'Glory is to my Lord, the Most High',
    note: 'Prostrate with forehead, nose, palms, knees and toes touching the ground, repeating this three times. Performed twice each rakah, with a brief sitting in between.',
  },
  {
    title: '7. Sitting between prostrations',
    arabic: 'رَبِّ اغْفِرْ لِي',
    translit: 'Rabbighfir li',
    translation: 'My Lord, forgive me',
    note: 'Sit briefly on the left foot before the second prostration.',
  },
  {
    title: '8. Tashahhud (Sitting)',
    arabic: 'التَّحِيَّاتُ لِلَّهِ وَالصَّلَوَاتُ وَالطَّيِّبَاتُ...',
    translit: 'At-tahiyyatu lillahi was-salawatu wat-tayyibat...',
    translation: 'All greetings, prayers and good things are for Allah...',
    note: 'Recited while sitting after two rakahs, and again at the end of the prayer, followed by blessings upon the Prophet (Salawat).',
  },
  {
    title: '9. Taslim (Ending)',
    arabic: 'السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ',
    translit: 'Assalamu alaikum wa rahmatullah',
    translation: 'Peace and the mercy of Allah be upon you',
    note: 'Turn your head to the right, then to the left, saying this each time to conclude the prayer.',
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
  const [section, setSection] = useState('quran'); // 'quran' | 'prayer'

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

  // ---------------- UI ----------------
  const [query, setQuery] = useState('');
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'reader'
  const [showBookmarksPanel, setShowBookmarksPanel] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [isDark, setIsDark] = useState(() => {
    const v = localStorage.getItem(LS_THEME);
    return v ? v === 'dark' : true;
  });

  // ---------------- Persisted state ----------------
  const [bookmarks, setBookmarks] = useState(() => loadJSON(LS_BOOKMARKS, {}));
  const [lastRead, setLastRead] = useState(() => loadJSON(LS_LAST_READ, null));

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
    localStorage.setItem(LS_THEME, isDark ? 'dark' : 'light');
  }, [isDark]);

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
  const fetchAyahs = useCallback((num) => {
    const myId = ++requestIdRef.current;
    setAyahsLoading(true);
    setAyahsError(null);
    setAyahs([]);
    setSurahMeta(null);
    setCurrentAyahIdx(-1);
    setIsPlaying(false);

    fetch(`${API_BASE}/surah/${num}/editions/${EDITIONS}`)
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
  }, []);

  useEffect(() => {
    if (selectedSurah) fetchAyahs(selectedSurah);
  }, [selectedSurah, fetchAyahs]);

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

  // ---------------- Persistence ----------------
  useEffect(() => {
    localStorage.setItem(LS_BOOKMARKS, JSON.stringify(bookmarks));
  }, [bookmarks]);

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
              className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition ${
                section === 'quran' ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
              }`}
            >
              Qur'an
            </button>
            <button
              onClick={() => setSection('prayer')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition ${
                section === 'prayer' ? `${t.accentBg} text-white` : `${t.textMuted} ${t.hoverSoft}`
              }`}
            >
              Prayer
            </button>
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
                setShowBookmarksPanel((v) => !v);
                setMobileView('list');
              }}
              className={`relative p-2 rounded-lg border ${t.divider} ${t.hoverSoft}`}
              title="Bookmarks"
              aria-label="Bookmarks"
            >
              <Bookmark size={18} className={showBookmarksPanel ? t.accent : ''} />
              {bookmarkList.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-[10px] leading-none bg-emerald-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
                  {bookmarkList.length}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setIsDark((d) => !d)}
            className={`p-2 rounded-lg border ${t.divider} ${t.hoverSoft}`}
            title="Toggle theme"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
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
                      <h3 className="text-sm font-semibold">Bookmarked Ayahs</h3>
                      <button
                        onClick={() => setShowBookmarksPanel(false)}
                        className={`text-xs ${t.textMuted} hover:underline`}
                      >
                        Close
                      </button>
                    </div>
                    {bookmarkList.length === 0 ? (
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
                    return (
                      <div
                        key={ayah.globalNumber}
                        ref={(el) => {
                          ayahRefs.current[ayah.globalNumber] = el;
                        }}
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

                        <p className="font-arabic text-right text-3xl leading-[2.3] mb-5" dir="rtl">
                          {ayah.arabic}
                        </p>

                        <p className={`text-sm italic ${t.textMuted} mb-2 leading-relaxed`}>
                          {ayah.transliteration}
                        </p>
                        <p className={`font-malayalam text-base leading-relaxed ${t.text}`}>
                          {ayah.translation}
                        </p>
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
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {surahMeta?.englishName}
                      {currentAyahIdx >= 0 ? ` · Ayah ${ayahs[currentAyahIdx]?.numberInSurah}` : ''}
                    </div>
                    <div className={`text-xs ${t.textMuted} truncate`}>Reciter: Mishary Rashid Alafasy</div>
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
      ) : (
        <PrayerSection t={t} isDark={isDark} />
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

  const [qibla, setQibla] = useState(null);
  const [qiblaLoading, setQiblaLoading] = useState(false);
  const [qiblaError, setQiblaError] = useState(null);

  const [compassOn, setCompassOn] = useState(false);
  const [heading, setHeading] = useState(null);
  const [compassSupported, setCompassSupported] = useState(true);

  const [expandedGuide, setExpandedGuide] = useState('wudu'); // 'wudu' | 'salah' | null

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (location) localStorage.setItem(LS_PRAYER_LOCATION, JSON.stringify(location));
  }, [location]);

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

  // Fetch Qibla whenever the location changes
  useEffect(() => {
    if (!location) return;
    setQiblaLoading(true);
    setQiblaError(null);
    fetch(`${ADHAN_API}/qibla/${location.lat}/${location.lon}`)
      .then((r) => {
        if (!r.ok) throw new Error('Could not calculate the Qibla direction.');
        return r.json();
      })
      .then((data) => setQibla(data.data.direction))
      .catch((err) => setQiblaError(err.message || 'Something went wrong.'))
      .finally(() => setQiblaLoading(false));
  }, [location]);

  // Live device compass
  useEffect(() => {
    if (!compassOn) return;
    const handler = (e) => {
      let h = null;
      if (typeof e.webkitCompassHeading === 'number') {
        h = e.webkitCompassHeading;
      } else if (typeof e.alpha === 'number') {
        h = 360 - e.alpha;
      }
      if (h !== null) setHeading(h);
    };
    window.addEventListener('deviceorientationabsolute', handler, true);
    window.addEventListener('deviceorientation', handler, true);
    return () => {
      window.removeEventListener('deviceorientationabsolute', handler, true);
      window.removeEventListener('deviceorientation', handler, true);
    };
  }, [compassOn]);

  const enableCompass = async () => {
    setCompassSupported(true);
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
              <p className={`text-xs ${t.textMuted} mt-4 text-center`}>
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
          {qiblaLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin" size={26} />
            </div>
          )}
          {qiblaError && (
            <div className="text-center py-10">
              <AlertCircle className="mx-auto mb-2 text-red-500" size={22} />
              <p className={`text-sm ${t.textMuted}`}>{qiblaError}</p>
            </div>
          )}
          {qibla != null && !qiblaLoading && (
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
                  Hold your phone flat. The green arrow points toward the Qibla as you turn.
                </p>
              )}
              {!compassSupported && (
                <p className="text-xs text-red-500 mt-2 text-center max-w-xs">
                  Live compass isn't available on this device or browser. Point the top of your screen North and
                  use the number above instead.
                </p>
              )}
            </div>
          )}
        </>
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
