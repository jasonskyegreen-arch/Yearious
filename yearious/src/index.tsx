// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { ALL_EVENTS as RAW_EVENTS } from "../events.js";

// ===================== Yearious — full app =====================
// Flip reveal with 0.20s stagger, confetti after reveal, cursor-delete-in-place (no shifting)

const ONLY_DIGITS = /[0-9]/;
const EVENTS = RAW_EVENTS.filter((event) => event && event.category && event.year && event.event);
const isValidGuess = (s, target) => s.length === target.length && /^[0-9]+$/.test(s);
const CATEGORY_TOTALS = EVENTS.reduce((totals, event) => {
  totals[event.category] = (totals[event.category] || 0) + 1;
  return totals;
}, {});

function getEventKey(event) {
  return `${event.category}::${event.year}::${event.event}`;
}

// Score per digit. Classic: green exact, yellow too low, orange too high.
// Expert: green exact, red incorrect.
function scoreGuess(guess, target, mode = "classic") {
  return guess.split("").map((d, i) => {
    const td = target[i];
    if (d === td) return "green";
    if (mode === "expert") return "wrong";
    if (+d < +td) return "low";   // shown as yellow
    if (+d > +td) return "high";  // shown as orange
    return "empty";
  });
}

// ===================== UI: Tile with flip reveal =====================
function Tile({ ch, status, isActive, onClick, theme, revealed = false, revealDelay = 0, isExpert = false }) {
  const sizeCls = "w-14 h-14 sm:w-14 sm:h-14";
  const base = `relative ${sizeCls} rounded-xl sm:rounded-2xl select-none transition-all`;
  const isLight = theme === "light";

  // Colors - Expert mode uses gold for correct, black for wrong
  const neutralBg = isLight ? "#e5e7eb" : "#18181b"; // zinc-200 / zinc-900
  const neutralText = isLight ? "#111827" : "#ffffff";
  const borderColor = isLight ? "#d1d5db" : "#3f3f46"; // zinc-300 / zinc-700
  
  const colorMap = isExpert
    ? { green: "#f59e0b", low: "#f59e0b", high: "#f59e0b", wrong: "#0a0a0a", empty: neutralBg } // amber-500 for correct, black for wrong
    : { green: "#22c55e", low: "#facc15", high: "#f97316", wrong: "#ef4444", empty: neutralBg };
  const targetBg = colorMap[status] || neutralBg;
  const revealText = isExpert
    ? (status === "green" ? "#000000" : status === "wrong" ? "#fbbf24" : "#111827") // black text on gold, gold text on black
    : (status === "low" ? "#111827" : "#ffffff");

  return (
    <div onClick={onClick} className={`${base} shadow-sm`} style={{ perspective: 800 }}>
      {isActive && (
        <motion.div
          layoutId="selector"
          className={`absolute inset-0 rounded-xl sm:rounded-2xl pointer-events-none ${
            isLight ? "bg-zinc-300/40 ring-2 ring-zinc-400/60" : "bg-white/10 ring-2 ring-white/30"
          }`}
        />
      )}
      {/* Flip wrapper */}
      <motion.div
        className="absolute inset-0 rounded-xl sm:rounded-2xl"
        initial={{ rotateX: 0 }}
        animate={{ rotateX: revealed ? 180 : 0 }}
        transition={{ delay: revealDelay, duration: 0.8, ease: "easeInOut" }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front face (neutral before reveal) */}
        <div
          className="absolute inset-0 rounded-xl sm:rounded-2xl border flex items-center justify-center font-extrabold text-lg sm:text-xl"
          style={{ backfaceVisibility: "hidden", background: neutralBg, color: neutralText, borderColor }}
        >
          {ch || "\u00A0"}
        </div>
        {/* Back face (colored after reveal) */}
        <div
          className="absolute inset-0 rounded-xl sm:rounded-2xl border flex items-center justify-center font-extrabold text-lg sm:text-xl"
          style={{
            transform: "rotateX(180deg)",
            backfaceVisibility: "hidden",
            background: targetBg,
            color: revealText,
            borderColor,
          }}
        >
          {ch || "\u00A0"}
        </div>
      </motion.div>
    </div>
  );
}

// Row that can reveal instantly or in a staggered way after submit
function GuessRow({ guess, pattern, length, activeIndex, setActiveIndex, active, theme, revealMode, isExpert }) {
  const slots = Array.from({ length }, (_, i) => guess[i] ?? "");
  const revealed = !!pattern;
  return (
    <div className="my-1 sm:my-1.5 flex justify-center gap-2 sm:gap-2">
      {slots.map((ch, i) => (
        <Tile
          key={i + "-" + (pattern ? pattern[i] : "p") + "-" + (ch || "_")}
          ch={ch}
          status={pattern ? pattern[i] : "empty"}
          isActive={active && i === activeIndex}
          onClick={() => active && setActiveIndex(i)}
          theme={theme}
          revealed={revealed}
          revealDelay={revealed ? (revealMode === "stagger" ? i * 0.2 : 0) : 0}
          isExpert={isExpert}
        />
      ))}
    </div>
  );
}

function MobileKeyboard({ onDigit, onBackspace, onEnter, theme }) {
  const keys = useMemo(() => [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["⌫", "0", "↵"]], []);
  const baseBtn = theme === "light" ? "bg-transparent border border-zinc-300 hover:bg-black/5 text-zinc-900" : "bg-white/5 border border-white/10 hover:bg-white/10 text-white";
  return (
    <div className="mt-4 sm:mt-4 grid grid-cols-3 gap-2 sm:gap-2 max-w-[320px] mx-auto">
      {keys.flat().map((k, idx) => (
        <button
          key={idx}
          onClick={() => { if (k === "⌫") onBackspace(); else if (k === "↵") onEnter(); else onDigit(k); }}
          className={`py-4 sm:py-3 rounded-xl sm:rounded-xl font-semibold text-xl sm:text-lg active:scale-95 ${baseBtn}`}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

function ModeToggle({ mode, setMode, isLight }) {
  const isExpert = mode === "expert";
  return (
    <div className={`relative inline-flex rounded-full p-0.5 shrink-0 ${
      isLight 
        ? (isExpert ? "bg-amber-100" : "bg-zinc-200")
        : (isExpert ? "bg-amber-950/50" : "bg-zinc-800")
    }`}>
      <motion.div
        className={`absolute top-0.5 bottom-0.5 rounded-full ${
          mode === "classic" 
            ? "bg-emerald-500" 
            : "bg-gradient-to-r from-amber-500 to-yellow-400"
        }`}
        initial={false}
        animate={{ left: mode === "classic" ? "2px" : "50%", width: "calc(50% - 2px)" }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
      />
      <button
        onClick={() => setMode("classic")}
        className={`relative z-10 px-4 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-bold rounded-full transition-colors ${
          mode === "classic" ? "text-white" : isLight ? "text-zinc-600" : "text-zinc-400"
        }`}
      >
        Classic
      </button>
      <button
        onClick={() => setMode("expert")}
        className={`relative z-10 px-4 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-bold rounded-full transition-colors ${
          mode === "expert" ? "text-black" : isLight ? "text-zinc-600" : "text-zinc-400"
        }`}
      >
        Expert
      </button>
    </div>
  );
}

function CategoryGridModal({ category, events, solvedKeys, onClose, onPick, theme, isExpert }) {
  const isLight = theme === "light";
  const shellClass = isLight
    ? (isExpert ? "bg-amber-50 text-zinc-900 border-amber-300" : "bg-white text-zinc-900 border-zinc-200")
    : (isExpert ? "bg-[#141210] text-zinc-100 border-amber-700/40" : "bg-zinc-900 text-zinc-100 border-zinc-700");
  const tileBase = isLight
    ? (isExpert ? "bg-white hover:bg-amber-50 border-amber-200" : "bg-zinc-50 hover:bg-emerald-50 border-zinc-200")
    : (isExpert ? "bg-amber-950/20 hover:bg-amber-900/30 border-amber-800/30" : "bg-zinc-800/50 hover:bg-emerald-900/30 border-zinc-700");
  const solvedClass = isExpert
    ? "bg-gradient-to-br from-amber-500 to-yellow-400 text-black border-amber-400 shadow-lg shadow-amber-500/30 font-semibold"
    : "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/25";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center">
      <div className={`w-full max-w-5xl rounded-3xl border shadow-2xl ${shellClass}`} style={{ maxHeight: "88vh" }}>
        <div className="flex items-center justify-between gap-4 border-b border-inherit px-5 py-4">
          <div>
            <h2 className="text-xl font-extrabold capitalize">{category}</h2>
            <div className={`text-xs mt-0.5 ${isExpert ? "text-amber-500" : "text-emerald-500"}`}>
              {isExpert ? "Expert Mode" : "Classic Mode"}
            </div>
          </div>
          <button onClick={onClose} className={`px-3 py-2 rounded-xl ${tileBase} border text-sm font-semibold`}>
            Close
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: "calc(88vh - 74px)" }}>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-3">
            {events.map((event, index) => {
              const solved = solvedKeys.has(getEventKey(event));
              return (
                <button
                  key={getEventKey(event)}
                  onClick={() => onPick(event)}
                  title={event.event}
                  className={`group relative rounded-2xl border px-2 py-3 text-left transition-all ${solved ? solvedClass : tileBase}`}
                >
                  <div className="text-[11px] font-bold opacity-70">#{index + 1}</div>
                  <div className="mt-2 line-clamp-3 text-xs font-semibold leading-tight">
                    {event.event}
                  </div>
                  <div className={`mt-3 text-[11px] ${solved ? "opacity-90" : "opacity-50 group-hover:opacity-80"}`}>
                    {solved ? "Solved" : "Try me"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Yearious() {
  // ====== Category selection ======
  const categories = ["music", "movies", "tech", "sports", "history", "inventions", "math", "animals", "architecture", "people"];
  const [selectedCats, setSelectedCats] = useState(categories);

  // ====== Game Mode (moved up for storage key dependency) ======
  const [gameMode, setGameMode] = useState(() => (typeof localStorage !== "undefined" ? localStorage.getItem("yg_mode") || "classic" : "classic"));

  // ====== Category wins - separate for each mode ======
  const initCategoryWins = () => categories.reduce((acc, category) => { acc[category] = []; return acc; }, {});
  const [classicWins, setClassicWins] = useState(initCategoryWins);
  const [expertWins, setExpertWins] = useState(initCategoryWins);
  const categoryWins = gameMode === "classic" ? classicWins : expertWins;
  const setCategoryWins = gameMode === "classic" ? setClassicWins : setExpertWins;

  // ====== Streaks - separate for each mode ======
  const [classicStreak, setClassicStreak] = useState(0);
  const [classicBest, setClassicBest] = useState(0);
  const [expertStreak, setExpertStreak] = useState(0);
  const [expertBest, setExpertBest] = useState(0);
  const currentStreak = gameMode === "classic" ? classicStreak : expertStreak;
  const bestStreak = gameMode === "classic" ? classicBest : expertBest;
  const setCurrentStreak = gameMode === "classic" ? setClassicStreak : setExpertStreak;
  const setBestStreak = gameMode === "classic" ? setClassicBest : setExpertBest;

  // ====== Game state ======
  const [puzzle, setPuzzle] = useState(null); // {year,event,info,category}
  const [inputArr, setInputArr] = useState([]); // array of digits/empties, fixed length = year len
  const [cursor, setCursor] = useState(0);
  const [guesses, setGuesses] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [status, setStatus] = useState("playing"); // playing | won | lost
  const [message, setMessage] = useState("");
  const [revealInfo, setRevealInfo] = useState("");
  const [revealing, setRevealing] = useState(false); // true while the latest row is flipping

  // ====== Modals ======
  const [showHowTo, setShowHowTo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [gridCategory, setGridCategory] = useState(null);

  // ====== Stats - separate for each mode ======
  const initStats = () => ({ gamesPlayed: 0, wins: 0, guessDistribution: [0, 0, 0, 0] });
  const [classicStats, setClassicStats] = useState(initStats);
  const [expertStats, setExpertStats] = useState(initStats);
  const stats = gameMode === "classic" ? classicStats : expertStats;
  const setStats = gameMode === "classic" ? setClassicStats : setExpertStats;

  // Load stats from localStorage
  useEffect(() => {
    try {
      const cStats = localStorage.getItem("yg_stats_classic");
      const eStats = localStorage.getItem("yg_stats_expert");
      if (cStats) setClassicStats(JSON.parse(cStats));
      if (eStats) setExpertStats(JSON.parse(eStats));
    } catch {}
  }, []);

  const persistStats = (newStats, mode) => {
    try { localStorage.setItem(`yg_stats_${mode}`, JSON.stringify(newStats)); } catch {}
  };

  // ====== Theme ======
  const [theme, setTheme] = useState(() => (typeof localStorage !== "undefined" ? localStorage.getItem("yg_theme") || "dark" : "dark"));
  const [systemPrefersLight, setSystemPrefersLight] = useState(false);
  useEffect(() => { try { localStorage.setItem("yg_theme", theme); } catch {} }, [theme]);
  useEffect(() => { try { localStorage.setItem("yg_mode", gameMode); } catch {} }, [gameMode]);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: light)");
    const syncTheme = () => setSystemPrefersLight(media?.matches ?? false);
    syncTheme();
    media?.addEventListener?.("change", syncTheme);
    return () => media?.removeEventListener?.("change", syncTheme);
  }, []);
  const isLight = theme === "light" || (theme === "auto" && systemPrefersLight);
  const isExpert = gameMode === "expert";

  // Mode-specific theme colors
  // Classic: Subtle emerald green theme
  // Expert: Luxury gold/amber theme - prestigious and elite
  const bgClass = isLight
    ? isExpert
      ? "bg-gradient-to-b from-[#faf8f0] to-[#f5f0e6] text-zinc-900"
      : "bg-[#f8faf9] text-zinc-900"
    : isExpert
      ? "bg-[#0c0a08] text-zinc-100"
      : "bg-[#0a0d0c] text-zinc-100";
  const cardClass = isLight
    ? isExpert
      ? "bg-white rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 border-2 border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
      : "bg-white rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 border border-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
    : isExpert
      ? "bg-gradient-to-b from-[#1a1610] to-[#141210] rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 border border-amber-500/40 shadow-[0_0_25px_rgba(245,158,11,0.25)]"
      : "bg-[#141816] rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 border border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.2)]";
  const ghostBtn = isLight
    ? isExpert
      ? "bg-transparent border border-amber-400 hover:bg-amber-50 text-amber-800"
      : "bg-transparent border border-zinc-300 hover:bg-emerald-50 text-zinc-700"
    : isExpert
      ? "bg-transparent border border-amber-600/50 hover:bg-amber-500/10 hover:border-amber-500/70 text-amber-200"
      : "bg-transparent border border-zinc-700 hover:bg-emerald-500/10 hover:border-emerald-500/50 text-zinc-300";
  const primaryBtn = isExpert
    ? "bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-bold shadow-lg shadow-amber-500/30"
    : "bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/25";
  const pillSelected = isLight
    ? isExpert
      ? "bg-amber-50 border-2 border-amber-500 text-amber-900 shadow-sm"
      : "bg-emerald-50 border-2 border-emerald-500 text-emerald-900 shadow-sm"
    : isExpert
      ? "bg-amber-950/40 border-2 border-amber-500/70 text-amber-100 shadow-sm shadow-amber-500/10"
      : "bg-emerald-950/30 border-2 border-emerald-500/50 text-emerald-200 shadow-sm";
  const pillUnselected = isLight
    ? isExpert
      ? "bg-white border-2 border-dashed border-amber-200 text-amber-500 hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50"
      : "bg-white border-2 border-dashed border-zinc-300 text-zinc-500 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50"
    : isExpert
      ? "bg-[#12100c] border-2 border-dashed border-amber-900/50 text-amber-600 hover:border-amber-600/60 hover:text-amber-400 hover:bg-amber-950/20"
      : "bg-[#0e1210] border-2 border-dashed border-zinc-700 text-zinc-500 hover:border-emerald-500/50 hover:text-emerald-300 hover:bg-emerald-950/20";

  // ====== Mobile detection ======
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mqCoarse = window.matchMedia?.("(pointer: coarse)");
    const mqHoverNone = window.matchMedia?.("(hover: none)");
    const mqAnyHover = window.matchMedia?.("(any-hover: hover)");
    const mqAnyFine = window.matchMedia?.("(any-pointer: fine)");
    const mqNarrow = window.matchMedia?.("(max-width: 900px)");

    const syncMobile = () => {
      const ua = navigator.userAgent || "";
      const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const uaDesktopOs = /Windows NT|Macintosh|X11|Linux x86_64/i.test(ua);
      const hintMobile = typeof navigator.userAgentData?.mobile === "boolean" ? navigator.userAgentData.mobile : false;
      const coarsePointer = mqCoarse?.matches ?? false;
      const hoverNone = mqHoverNone?.matches ?? false;
      const anyHover = mqAnyHover?.matches ?? false;
      const anyFine = mqAnyFine?.matches ?? false;
      const narrowViewport = mqNarrow?.matches ?? false;
      const touchPoints = navigator.maxTouchPoints || 0;
      const likelyMobile = hintMobile || uaMobile || (coarsePointer && hoverNone && touchPoints > 0 && narrowViewport);
      const desktopLikeInput = anyHover || anyFine;
      const forceDesktop = (uaDesktopOs && !uaMobile) || desktopLikeInput;
      setIsMobile(likelyMobile && !forceDesktop);
    };

    syncMobile();
    mqCoarse?.addEventListener?.("change", syncMobile);
    mqHoverNone?.addEventListener?.("change", syncMobile);
    mqAnyHover?.addEventListener?.("change", syncMobile);
    mqAnyFine?.addEventListener?.("change", syncMobile);
    mqNarrow?.addEventListener?.("change", syncMobile);
    window.addEventListener("resize", syncMobile);

    return () => {
      mqCoarse?.removeEventListener?.("change", syncMobile);
      mqHoverNone?.removeEventListener?.("change", syncMobile);
      mqAnyHover?.removeEventListener?.("change", syncMobile);
      mqAnyFine?.removeEventListener?.("change", syncMobile);
      mqNarrow?.removeEventListener?.("change", syncMobile);
      window.removeEventListener("resize", syncMobile);
    };
  }, []);

  // ====== Load streaks and wins for both modes ======
  useEffect(() => {
    try {
      // Load classic mode data
      const classicC = parseInt(localStorage.getItem("yg_currentStreak_classic") || "0", 10);
      const classicB = parseInt(localStorage.getItem("yg_bestStreak_classic") || "0", 10);
      const classicSavedWins = JSON.parse(localStorage.getItem("yg_categoryWins_classic") || "{}");
      if (!Number.isNaN(classicC)) setClassicStreak(classicC);
      if (!Number.isNaN(classicB)) setClassicBest(classicB);
      setClassicWins(categories.reduce((acc, category) => {
        acc[category] = Array.isArray(classicSavedWins[category]) ? classicSavedWins[category] : [];
        return acc;
      }, {}));

      // Load expert mode data
      const expertC = parseInt(localStorage.getItem("yg_currentStreak_expert") || "0", 10);
      const expertB = parseInt(localStorage.getItem("yg_bestStreak_expert") || "0", 10);
      const expertSavedWins = JSON.parse(localStorage.getItem("yg_categoryWins_expert") || "{}");
      if (!Number.isNaN(expertC)) setExpertStreak(expertC);
      if (!Number.isNaN(expertB)) setExpertBest(expertB);
      setExpertWins(categories.reduce((acc, category) => {
        acc[category] = Array.isArray(expertSavedWins[category]) ? expertSavedWins[category] : [];
        return acc;
      }, {}));
    } catch {}
  }, []);

  function persistStreaks(c, b) {
    const mode = gameMode;
    try {
      localStorage.setItem(`yg_currentStreak_${mode}`, String(c));
      localStorage.setItem(`yg_bestStreak_${mode}`, String(b));
    } catch {}
  }
  function persistCategoryWins(nextWins) {
    const mode = gameMode;
    try { localStorage.setItem(`yg_categoryWins_${mode}`, JSON.stringify(nextWins)); } catch {}
  }

  // ====== Pool + random pick ======
  const pool = selectedCats.length ? EVENTS.filter((e) => selectedCats.includes(e.category)) : [];
  const categoryEvents = useMemo(
    () => categories.reduce((acc, category) => {
      acc[category] = EVENTS.filter((event) => event.category === category);
      return acc;
    }, {}),
    [categories]
  );
  function pickRandom() {
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)] || null;
  }

  // Init puzzle
  useEffect(() => { setPuzzle(pickRandom()); }, []);

  // Reset input array when puzzle changes
  useEffect(() => {
    if (puzzle) {
      setInputArr(Array(puzzle.year.length).fill(""));
      setCursor(0);
    }
  }, [puzzle]);

  // When categories change, reset the game with a new event and clear board
  useEffect(() => {
    newEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCats]);

  // ====== Desktop typing ======
  useEffect(() => {
    if (isMobile) return;
    function onKeyDown(e) {
      if (status !== "playing" || !puzzle || revealing) return;
      const k = e.key;
      const tag = (e.target?.tagName || "").toLowerCase();
      const isEd = e.target?.isContentEditable || ["input","textarea","select"].includes(tag);
      if (isEd) return;
      if (k === "Enter") { e.preventDefault(); trySubmit(); return; }
      if (k === "Backspace") { e.preventDefault(); backspace(); return; }
      if (k === "ArrowLeft") { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); return; }
      if (k === "ArrowRight") { e.preventDefault(); setCursor(c => Math.min((puzzle?.year?.length || 4) - 1, c + 1)); return; }
      if (ONLY_DIGITS.test(k)) { e.preventDefault(); insertDigit(k); return; }
    }
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile, status, puzzle, revealing, cursor, inputArr]);

  const len = puzzle?.year?.length ?? 4;
  const inputStr = (inputArr || []).map(ch => ch || "").join(""); // for validation/submit (no spaces)
  const inputDisplayStr = (inputArr || []).map(ch => (ch === "" ? " " : ch)).join(""); // keep visual gaps for active row

  // ====== Input ops (no shifting) ======
  function insertDigit(d) {
    setInputArr(arr => {
      const next = [...arr];
      next[cursor] = d;
      setCursor(Math.min(cursor + 1, len - 1));
      return next;
    });
  }
  function backspace() {
    // Delete at the selector first; if already empty, delete to the left and move left
    setInputArr(prev => {
      const next = [...prev];
      if (next[cursor]) {
        // Current slot has a digit: clear it, stay on this slot
        next[cursor] = "";
        return next;
      }
      // Current is empty: a second press deletes left and moves left
      if (cursor > 0) {
        if (next[cursor - 1]) next[cursor - 1] = "";
        setCursor(cursor - 1);
      }
      return next;
    });
  }

  // ====== Submit ======
  function trySubmit() {
    if (revealing) return; // ignore while revealing
    if (inputStr.length !== len) { setMessage(`Enter a ${len}-digit year.`); return; }
    if (!isValidGuess(inputStr, puzzle.year)) { setMessage(`Enter a ${len}-digit year.`); return; }

    const pat = scoreGuess(inputStr, puzzle.year, gameMode);
    const newGuesses = [...guesses, inputStr];
    const correct = inputStr === puzzle.year;

    setGuesses(newGuesses);
    setPatterns(prev => [...prev, pat]);
    setInputArr(Array(len).fill(""));
    setCursor(0);
    setRevealing(true);

    // Total reveal time = flip duration (0.8s) + stagger (0.2s * (len-1))
    const totalMs = Math.round((0.8 + 0.2 * (len - 1)) * 1000) + 100;

    setTimeout(() => {
      setRevealing(false);
      if (correct) {
        const nextCurrent = currentStreak + 1;
        const nextBest = Math.max(bestStreak, nextCurrent);
        const eventKey = getEventKey(puzzle);
        setCurrentStreak(nextCurrent);
        setBestStreak(nextBest);
        persistStreaks(nextCurrent, nextBest);
        setCategoryWins(prev => {
          const existing = prev[puzzle.category] || [];
          if (existing.includes(eventKey)) return prev;
          const nextWins = { ...prev, [puzzle.category]: [...existing, eventKey] };
          persistCategoryWins(nextWins);
          return nextWins;
        });
        // Update stats
        const guessNum = newGuesses.length - 1; // 0-indexed
        const newDist = [...stats.guessDistribution];
        newDist[guessNum]++;
        const newStats = { gamesPlayed: stats.gamesPlayed + 1, wins: stats.wins + 1, guessDistribution: newDist };
        setStats(newStats);
        persistStats(newStats, gameMode);
        setStatus("won");
        setMessage("Correct!");
        setRevealInfo(`${puzzle.year}: ${puzzle.info}`);
        confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });
      } else if (newGuesses.length >= 4) {
        if (currentStreak !== 0) { setCurrentStreak(0); persistStreaks(0, bestStreak); }
        // Update stats for loss
        const newStats = { ...stats, gamesPlayed: stats.gamesPlayed + 1 };
        setStats(newStats);
        persistStats(newStats, gameMode);
        setStatus("lost");
        setMessage("Out of tries.");
        setRevealInfo(`It was ${puzzle.year}: ${puzzle.info}`);
      } else {
        setMessage("");
      }
    }, totalMs);
  }

  // ====== Controls ======
  function newEvent() {
    setPuzzle(pickRandom());
    setGuesses([]);
    setPatterns([]);
    setStatus("playing");
    setMessage("");
    setRevealInfo("");
    setRevealing(false);
  }
  function chooseSpecificEvent(event) {
    setPuzzle(event);
    setGuesses([]);
    setPatterns([]);
    setStatus("playing");
    setMessage("");
    setRevealInfo("");
    setRevealing(false);
    setGridCategory(null);
  }
  function toggleCategory(cat) { setSelectedCats(prev => (prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])); }

  // Handle mode switch - reset game if already guessed or finished, otherwise keep same puzzle
  function handleModeSwitch(newMode) {
    if (newMode === gameMode) return;
    setGameMode(newMode);
    // If user has submitted at least one guess or game is over, start fresh
    if (guesses.length > 0 || status !== "playing") {
      // Reset game state but don't pick new puzzle yet (will happen after mode change)
      setGuesses([]);
      setPatterns([]);
      setStatus("playing");
      setMessage("");
      setRevealInfo("");
      setRevealing(false);
      // Pick a new puzzle (need to do it here since pickRandom uses current state)
      setPuzzle(pickRandom());
    }
    // If no guesses submitted yet, keep the same puzzle
  }

  return (
    <div
      className={`min-h-screen ${bgClass} flex items-start md:items-center justify-center p-3 sm:p-4`}
      style={{ minHeight: "100vh" }}
    >
      <div className="w-full max-w-4xl" style={{ width: "100%", maxWidth: "48rem" }}>
        {/* Header Row 1: Title + Streak/Best labels */}
        <div className="flex items-end justify-between gap-2 mb-1">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight md:text-5xl">Yearious</h1>
          <div className="flex items-center gap-6 sm:gap-8">
            <div className="text-center">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.12em] opacity-55">Streak</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.12em] opacity-55">Best</div>
            </div>
          </div>
        </div>

        {/* Header Row 2: Mode Toggle + Streak numbers */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <ModeToggle mode={gameMode} setMode={handleModeSwitch} isLight={isLight} />
          <div className="flex items-center gap-6 sm:gap-8">
            <div className={`text-4xl sm:text-5xl md:text-5xl font-extrabold leading-none ${isExpert ? "text-amber-400" : ""}`}>{currentStreak}</div>
            <div className={`text-4xl sm:text-5xl md:text-5xl font-extrabold leading-none ${isExpert ? "text-amber-400" : ""}`}>{bestStreak}</div>
          </div>
        </div>

        {/* Divider line */}
        <div className={`h-px mb-4 ${isExpert ? (isLight ? "bg-amber-300" : "bg-amber-700/50") : (isLight ? "bg-zinc-200" : "bg-zinc-700")}`} />

        {/* Action buttons row */}
        <div className="mb-4 md:mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHowTo(true)} className={`rounded-xl sm:rounded-2xl px-4 sm:px-4 py-2.5 sm:py-2.5 ${ghostBtn} text-sm sm:text-sm font-semibold`} title="How to play">How To Play</button>
            <button onClick={() => setShowSettings(true)} className={`rounded-xl sm:rounded-2xl px-4 sm:px-4 py-2.5 sm:py-2.5 ${ghostBtn} text-sm sm:text-sm font-semibold`} title="Settings">Settings</button>
          </div>
          <button onClick={newEvent} className={`rounded-xl sm:rounded-2xl px-5 sm:px-5 py-2.5 sm:py-2.5 ${primaryBtn} text-sm sm:text-sm font-semibold ${isExpert ? "" : "shadow-lg shadow-emerald-900/20"}`}>New Event</button>
        </div>

        {/* Category selector */}
        <div className="mb-4 md:mb-4">
          <div className="grid grid-cols-5 gap-2 sm:gap-2 md:flex md:flex-wrap md:gap-2">
            {categories.map((cat) => (
              <div
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`${selectedCats.includes(cat) ? pillSelected : pillUnselected} min-w-0 w-full rounded-xl sm:rounded-2xl px-1.5 sm:px-3 py-2 sm:py-2 text-[11px] sm:text-sm font-semibold shadow-sm md:w-auto md:min-w-[96px] cursor-pointer`}
              >
                <div className="truncate capitalize text-center md:text-left">{cat}</div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setGridCategory(cat);
                  }}
                  className={`mt-1 sm:mt-1 w-full md:w-auto inline-flex justify-center md:justify-start rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-xs transition-all ${isLight ? "bg-zinc-900/10 hover:bg-zinc-900/15" : "bg-white/10 hover:bg-white/15"}`}
                  title={cat}
                >
                  <span className="opacity-80">{(categoryWins[cat] || []).length}/{CATEGORY_TOTALS[cat] || 100}</span>
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 sm:mt-2 flex gap-2 sm:gap-2">
            <button onClick={() => setSelectedCats(categories)} className={`flex-1 md:flex-none rounded-xl sm:rounded-2xl px-3 py-2.5 sm:py-2 ${ghostBtn} font-semibold text-sm sm:text-sm`}>All</button>
            <button onClick={() => setSelectedCats([])} className={`flex-1 md:flex-none rounded-xl sm:rounded-2xl px-3 py-2.5 sm:py-2 ${ghostBtn} font-semibold text-sm sm:text-sm`}>Clear</button>
          </div>
        </div>

        {/* Game panel */}
        <motion.div
          key={gameMode}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cardClass}
        >
          {!puzzle ? (
            <div className="py-6 sm:py-8 text-center">
              <div className="mb-3 sm:mb-3 text-2xl sm:text-3xl font-bold">Select categories</div>
              <div className="text-lg sm:text-lg opacity-70">Choose one or more categories above to start playing.</div>
            </div>
          ) : (
            <>
          <div className="mb-4 sm:mb-5 text-center text-xl sm:text-2xl font-semibold leading-snug">{puzzle.event}</div>

          <AnimatePresence>
            {message && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mb-2 text-center text-sm opacity-80">{message}</motion.div>
            )}
          </AnimatePresence>

          {/* Board (4 rows) */}
          <div className="my-5 sm:my-8">
            {Array.from({ length: 4 }, (_, row) => {
              const isActiveRow = row === guesses.length && status === "playing" && !revealing;
              const hasPattern = !!patterns[row];
              const revealMode = hasPattern && row === guesses.length - 1 ? "stagger" : hasPattern ? "instant" : "none";
              const activeGuessStr = inputDisplayStr; // preserve visual gaps on active row
              return (
                <div key={row} className="flex justify-center">
                  <GuessRow
                    guess={guesses[row] ?? (isActiveRow ? activeGuessStr : "")}
                    pattern={patterns[row]}
                    length={len}
                    activeIndex={isActiveRow ? cursor : -1}
                    setActiveIndex={(i) => { if (isActiveRow) setCursor(i); }}
                    active={isActiveRow}
                    theme={theme}
                    revealMode={revealMode}
                    isExpert={isExpert}
                  />
                </div>
              );
            })}
          </div>

          {isMobile && status === "playing" && (
            <MobileKeyboard onDigit={insertDigit} onBackspace={backspace} onEnter={trySubmit} theme={theme} />
          )}

          {revealInfo && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 sm:mt-4 rounded-xl border p-3 text-center text-sm" style={{ background: isLight ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.05)", borderColor: isLight ? "#e5e7eb" : "rgba(255,255,255,0.1)" }}>
              {revealInfo}
            </motion.div>
          )}

          {(status === "won" || status === "lost") && (
            <div className="flex justify-center mt-3 sm:mt-4">
              <button onClick={newEvent} className={`px-3 sm:px-4 py-2 rounded-xl ${ghostBtn} text-sm transition-all`}>Play Another</button>
            </div>
          )}
            </>
          )}
        </motion.div>
      </div>

      {/* How To Play (modal) */}
      {showHowTo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md rounded-2xl p-5 border ${
            isExpert 
              ? (isLight ? "bg-amber-50 border-amber-300 text-zinc-900" : "bg-[#141210] border-amber-700/50 text-zinc-100")
              : (isLight ? "bg-white border-zinc-200 text-zinc-900" : "bg-zinc-900 border-zinc-700 text-zinc-100")
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">How to Play</h2>
              <button onClick={() => setShowHowTo(false)} className={`px-2 py-1 rounded-lg ${
                isExpert
                  ? (isLight ? "bg-amber-200 hover:bg-amber-300 text-amber-900" : "bg-amber-900/50 hover:bg-amber-800/50 text-amber-200")
                  : (isLight ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-700" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300")
              }`}>✕</button>
            </div>
            <ul className="list-disc ml-5 space-y-2 text-sm opacity-90">
              <li>Guess the year of the event. You have <strong>4 guesses</strong>.</li>
              <li>Type digits directly into the tiles (desktop) or use the keypad (mobile).</li>
              {gameMode === "classic" ? (
                <>
                  <li><span className="text-green-500 font-semibold">Green</span> = exact digit</li>
                  <li><span className="text-yellow-400 font-semibold">Yellow</span> = digit is too low</li>
                  <li><span className="text-orange-500 font-semibold">Orange</span> = digit is too high</li>
                </>
              ) : (
                <>
                  <li><span className="text-amber-400 font-semibold">Gold</span> = exact digit</li>
                  <li><span className={`font-semibold ${isLight ? "text-zinc-900" : "text-zinc-300"}`}>Black</span> = incorrect digit</li>
                  <li className="opacity-70 italic">No hints about whether you're too high or too low!</li>
                </>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Settings */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className={`w-full max-w-md rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 shadow-2xl ${isLight ? "bg-white text-zinc-900" : "bg-[#1f1f23] text-zinc-100 border border-[#34343c]"}`}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl sm:text-3xl font-bold">Settings</h2>
              <button onClick={() => setShowSettings(false)} className={`rounded-xl px-2.5 py-1.5 text-sm ${isLight ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200" : "bg-white/10 text-zinc-100 hover:bg-white/20"}`}>✕</button>
            </div>

            {/* Progress section */}
            <div className={`mb-5 rounded-xl p-4 ${isLight ? "bg-zinc-50" : "bg-zinc-800/50"}`}>
              <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-3">Progress</div>
              <div className="grid grid-cols-2 gap-4">
                {/* Classic */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <div className="text-sm font-semibold">Classic</div>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <div>
                      <div className="text-2xl font-extrabold leading-none">{classicStreak}</div>
                      <div className="text-[10px] opacity-50 uppercase">streak</div>
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold leading-none opacity-50">{classicBest}</div>
                      <div className="text-[10px] opacity-50 uppercase">best</div>
                    </div>
                  </div>
                </div>
                {/* Expert */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400" />
                    <div className="text-sm font-semibold">Expert</div>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <div>
                      <div className="text-2xl font-extrabold leading-none">{expertStreak}</div>
                      <div className="text-[10px] opacity-50 uppercase">streak</div>
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold leading-none opacity-50">{expertBest}</div>
                      <div className="text-[10px] opacity-50 uppercase">best</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Theme section */}
            <div className={`mb-5 rounded-xl p-4 ${isLight ? "bg-zinc-50" : "bg-zinc-800/50"}`}>
              <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-3">Theme</div>
              <div className="flex gap-2">
                <button onClick={() => setTheme("auto")} className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${theme === "auto" ? "border-emerald-600 bg-emerald-600 text-white" : isLight ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100" : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>Auto</button>
                <button onClick={() => setTheme("light")} className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${theme === "light" ? "border-emerald-600 bg-emerald-600 text-white" : isLight ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100" : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>Light</button>
                <button onClick={() => setTheme("dark")} className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${theme === "dark" ? "border-emerald-600 bg-emerald-600 text-white" : isLight ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100" : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>Dark</button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowSettings(false); setShowStats(true); }}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
              >
                View Stats
              </button>
              <button
                onClick={() => {
                  if (gameMode === "classic") {
                    setClassicStreak(0);
                    try { localStorage.setItem("yg_currentStreak_classic", "0"); } catch {}
                  } else {
                    setExpertStreak(0);
                    try { localStorage.setItem("yg_currentStreak_expert", "0"); } catch {}
                  }
                }}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-all"
              >
                Clear {gameMode} streak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {showStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className={`w-full max-w-lg rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 shadow-2xl ${isLight ? "bg-white text-zinc-900" : "bg-[#1f1f23] text-zinc-100 border border-[#34343c]"}`}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl sm:text-3xl font-bold">Statistics</h2>
              <button onClick={() => setShowStats(false)} className={`rounded-xl px-2.5 py-1.5 text-sm ${isLight ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200" : "bg-white/10 text-zinc-100 hover:bg-white/20"}`}>✕</button>
            </div>

            {/* Mode tabs */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => handleModeSwitch("classic")}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${gameMode === "classic" ? "bg-emerald-500 text-white" : isLight ? "bg-zinc-100 text-zinc-600" : "bg-zinc-800 text-zinc-400"}`}
              >
                Classic
              </button>
              <button
                onClick={() => handleModeSwitch("expert")}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${gameMode === "expert" ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black" : isLight ? "bg-zinc-100 text-zinc-600" : "bg-zinc-800 text-zinc-400"}`}
              >
                Expert
              </button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="text-center">
                <div className={`text-2xl sm:text-3xl font-extrabold ${isExpert ? "text-amber-400" : ""}`}>{stats.gamesPlayed}</div>
                <div className="text-[10px] sm:text-xs opacity-60 uppercase">Played</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl sm:text-3xl font-extrabold ${isExpert ? "text-amber-400" : ""}`}>{stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0}</div>
                <div className="text-[10px] sm:text-xs opacity-60 uppercase">Win %</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl sm:text-3xl font-extrabold ${isExpert ? "text-amber-400" : ""}`}>{currentStreak}</div>
                <div className="text-[10px] sm:text-xs opacity-60 uppercase">Streak</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl sm:text-3xl font-extrabold ${isExpert ? "text-amber-400" : ""}`}>{bestStreak}</div>
                <div className="text-[10px] sm:text-xs opacity-60 uppercase">Best</div>
              </div>
            </div>

            {/* Guess distribution */}
            <div className="mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-3">Guess Distribution</div>
              <div className="space-y-2">
                {stats.guessDistribution.map((count, idx) => {
                  const maxCount = Math.max(...stats.guessDistribution, 1);
                  const pct = (count / maxCount) * 100;
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-4 text-sm font-semibold opacity-70">{idx + 1}</div>
                      <div className="flex-1 h-6 rounded overflow-hidden" style={{ background: isLight ? "#e5e7eb" : "#27272a" }}>
                        <div
                          className={`h-full flex items-center justify-end px-2 text-xs font-bold transition-all ${isExpert ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black" : "bg-emerald-500 text-white"}`}
                          style={{ width: `${Math.max(pct, count > 0 ? 12 : 0)}%`, minWidth: count > 0 ? "24px" : "0" }}
                        >
                          {count > 0 && count}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {gridCategory && (
        <CategoryGridModal
          category={gridCategory}
          events={categoryEvents[gridCategory] || []}
          solvedKeys={new Set(categoryWins[gridCategory] || [])}
          onClose={() => setGridCategory(null)}
          onPick={chooseSpecificEvent}
          theme={theme}
          isExpert={isExpert}
        />
      )}
    </div>
  );
}

export default function App() {
  return <Yearious />;
}


