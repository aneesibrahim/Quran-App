import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search, ChevronLeft, Play, Pause, SkipBack, SkipForward,
  Bookmark, BookmarkCheck, Copy, Check, Moon, Sun,
  Loader2, BookOpen, AlertCircle,
} from 'lucide-react';

/**
 * Single-file Quran reader.
 *
 * Data source: Al Quran Cloud REST API (https://alquran.cloud/api)
 *  - quran-uthmani      → Uthmani Arabic script
 *  - ml.abdulhameed     → Malayalam translation (Cheriyamundam Abdul Hameed & Kunhi Mohammed)
 *  - en.transliteration → Romanized transliteration (pronunciation aid)
 *  - ar.alafasy         → Audio recitation, Mishary Rashid Alafasy
 *
 * Note: the public API does not publish a dedicated Malayalam-script
 * transliteration edition, only an English/Roman one — so a single
 * `en.transliteration` line is shown as the pronunciation aid, alongside
 * the full Malayalam translation.
 */

const API_BASE = 'https://api.alquran.cloud/v1';
const EDITIONS = 'quran-uthmani,ml.abdulhameed,en.transliteration,ar.alafasy';

const LS_BOOKMARKS = 'quran_reader_bookmarks_v1';
const LS_LAST_READ = 'quran_reader_last_read_v1';
const LS_THEME = 'quran_reader_theme_v1';

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

export default function QuranApp() {
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
          {mobileView === 'reader' && (
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
                      No Surah matches “{query}”.
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
    </div>
  );
}
