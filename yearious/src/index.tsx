// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { ALL_EVENTS as RAW_EVENTS } from "../events.js";
import { ALL_WHEREIOUS_EVENTS } from "../whereious-events.js";
import L from "leaflet";

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// ===================== Yearious — full app =====================
// Flip reveal with 0.20s stagger, confetti after reveal, cursor-delete-in-place (no shifting)

const ONLY_DIGITS = /[0-9]/;

// Deterministic shuffle — fixed seed means every player sees the same arbitrary order
function seededShuffle(arr, seed = 5381) {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const EVENTS = seededShuffle(RAW_EVENTS.filter((event) => event && event.category && event.year && event.event));
const isValidGuess = (s, target) => s.length === target.length && /^[0-9]+$/.test(s);
const CATEGORY_TOTALS = EVENTS.reduce((totals, event) => {
  totals[event.category] = (totals[event.category] || 0) + 1;
  return totals;
}, {});

function getEventKey(event) {
  return `${event.category}::${event.year}::${event.event}`;
}

// Score per digit. Classic: green exact, yellow too low, orange too high.
// Advanced: teal exact, light teal + dashed border = wrong position, gray = wrong.
// Expert: green exact, red incorrect.
function scoreGuess(guess, target, mode = "classic") {
  if (mode === "advanced") {
    const targetArr = target.split("");
    const result = new Array(guess.length);
    const used = new Array(target.length).fill(false);
    for (let i = 0; i < guess.length; i++) {
      if (guess[i] === target[i]) {
        result[i] = "green";
        used[i] = true;
      }
    }
    for (let i = 0; i < guess.length; i++) {
      if (result[i]) continue;
      const d = guess[i];
      const idx = targetArr.findIndex((t, j) => !used[j] && t === d);
      if (idx !== -1) {
        result[i] = "wrong_position";
        used[idx] = true;
      } else {
        result[i] = "wrong";
      }
    }
    return result;
  }
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
function Tile({ ch, status, isActive, onClick, theme, revealed = false, revealDelay = 0, isExpert = false, isAdvanced = false }) {
  const sizeCls = "w-14 h-14 sm:w-14 sm:h-14";
  const base = `relative ${sizeCls} rounded-xl sm:rounded-2xl select-none transition-all`;
  const isLight = theme === "light";

  // Expert: gold correct, black wrong. Advanced: teal = right, light teal + dashed = wrong position, gray = wrong. Classic: green/yellow/orange.
  // Advanced: empty guess squares on-theme (indigo/teal tint) instead of black
  const neutralBg = isAdvanced
    ? (isLight ? "#e0e7ff" : "#312e81")
    : (isLight ? "#e5e7eb" : "#18181b");
  const neutralText = isAdvanced
    ? (isLight ? "#3730a3" : "#c7d2fe")
    : (isLight ? "#111827" : "#ffffff");
  const borderColor = isAdvanced
    ? (isLight ? "#a5b4fc" : "#4f46e5")
    : (isLight ? "#d1d5db" : "#3f3f46");
  const tealCorrect = "#14b8a6";      // teal-500
  const tealWrongPosBg = isLight ? "#ccfbf1" : "#134e4a"; // teal-100 / teal-900
  const advancedWrong = "#374151";    // gray-700, softer than black

  const colorMap = isExpert
    ? { green: "#f59e0b", low: "#f59e0b", high: "#f59e0b", wrong: "#0a0a0a", wrong_position: "#0a0a0a", empty: neutralBg }
    : isAdvanced
      ? { green: tealCorrect, wrong_position: tealWrongPosBg, wrong: advancedWrong, low: neutralBg, high: neutralBg, empty: neutralBg }
      : { green: "#22c55e", low: "#facc15", high: "#f97316", wrong: "#ef4444", wrong_position: neutralBg, empty: neutralBg };
  const targetBg = colorMap[status] || neutralBg;
  const revealText = isExpert
    ? (status === "green" ? "#000000" : status === "wrong" ? "#fbbf24" : "#111827")
    : isAdvanced
      ? (status === "green" ? "#ffffff" : status === "wrong" ? "#9ca3af" : (isLight ? "#0f766e" : "#5eead4"))
      : (status === "low" ? "#111827" : "#ffffff");

  const isAdvancedWrongPos = isAdvanced && status === "wrong_position";
  const backBorder = isAdvancedWrongPos ? "2px dashed #0d9488" : undefined; // teal-600 dashed
  const backBorderColor = isAdvancedWrongPos ? "#0d9488" : borderColor;

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
      <motion.div
        className="absolute inset-0 rounded-xl sm:rounded-2xl"
        initial={{ rotateX: 0 }}
        animate={{ rotateX: revealed ? 180 : 0 }}
        transition={{ delay: revealDelay, duration: 0.8, ease: "easeInOut" }}
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          className="absolute inset-0 rounded-xl sm:rounded-2xl border flex items-center justify-center font-extrabold text-lg sm:text-xl"
          style={{ backfaceVisibility: "hidden", background: neutralBg, color: neutralText, borderColor }}
        >
          {ch || "\u00A0"}
        </div>
        <div
          className="absolute inset-0 rounded-xl sm:rounded-2xl flex items-center justify-center font-extrabold text-lg sm:text-xl"
          style={{
            transform: "rotateX(180deg)",
            backfaceVisibility: "hidden",
            background: targetBg,
            color: revealText,
            border: backBorder || `1px solid ${backBorderColor}`,
          }}
        >
          {ch || "\u00A0"}
        </div>
      </motion.div>
    </div>
  );
}

// Row that can reveal instantly or in a staggered way after submit
function GuessRow({ guess, pattern, length, activeIndex, setActiveIndex, active, theme, revealMode, isExpert, isAdvanced }) {
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
          isAdvanced={isAdvanced}
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
  const isAdvanced = mode === "advanced";
  const pillLeft = mode === "classic" ? "2px" : mode === "advanced" ? "calc(33.333% + 1px)" : "calc(66.666% + 1px)";
  // Pill color strictly from mode so it never shows orange in Classic/Advanced
  const pillColor = mode === "classic"
    ? "bg-emerald-400/80"
    : mode === "advanced"
      ? "bg-indigo-400/80"
      : "bg-amber-400/80";
  // Fainter track (bubble) around all game modes
  const trackClass = isLight
    ? (isExpert ? "bg-amber-100/70 border border-amber-200" : isAdvanced ? "bg-indigo-100/70 border border-indigo-200" : "bg-zinc-100 border border-zinc-300")
    : (isExpert ? "bg-amber-950/30 border border-amber-800/50" : isAdvanced ? "bg-indigo-950/40 border border-indigo-700/50" : "bg-zinc-800/60 border border-zinc-600");
  return (
    <div className={`relative inline-flex rounded-full p-0.5 shrink-0 ${trackClass} focus:outline-none focus-visible:outline-none`}>
      <motion.div
        key={mode}
        className={`absolute top-0.5 bottom-0.5 rounded-full ${pillColor}`}
        initial={false}
        animate={{ left: pillLeft, width: "calc(33.333% - 2px)" }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
      />
      <button
        onClick={() => setMode("classic")}
        className={`relative z-10 px-3 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-bold rounded-full transition-colors focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
          mode === "classic" ? "text-white" : isLight ? "text-zinc-600" : "text-zinc-400"
        }`}
      >
        Classic
      </button>
      <button
        onClick={() => setMode("advanced")}
        className={`relative z-10 px-3 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-bold rounded-full transition-colors focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
          mode === "advanced" ? "text-white" : isLight ? "text-zinc-600" : "text-zinc-400"
        }`}
      >
        Advanced
      </button>
      <button
        onClick={() => setMode("expert")}
        className={`relative z-10 px-3 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-bold rounded-full transition-colors focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
          mode === "expert" ? "text-black" : isLight ? "text-zinc-600" : "text-zinc-400"
        }`}
      >
        Expert
      </button>
    </div>
  );
}

function CategoryGridModal({ category, events, solvedKeys, onClose, onPick, theme, isExpert, isAdvanced }) {
  const isLight = theme === "light";
  const shellClass = isLight
    ? (isExpert ? "bg-amber-50 text-zinc-900 border-amber-300" : isAdvanced ? "bg-indigo-50 text-zinc-900 border-indigo-300" : "bg-white text-zinc-900 border-zinc-200")
    : (isExpert ? "bg-[#141210] text-zinc-100 border-amber-700/40" : isAdvanced ? "bg-[#1e1b4b] text-zinc-100 border-indigo-700/40" : "bg-zinc-900 text-zinc-100 border-zinc-700");
  const tileBase = isLight
    ? (isExpert ? "bg-white hover:bg-amber-50 border-amber-200" : isAdvanced ? "bg-white hover:bg-indigo-50 border-indigo-200" : "bg-zinc-50 hover:bg-emerald-50 border-zinc-200")
    : (isExpert ? "bg-amber-950/20 hover:bg-amber-900/30 border-amber-800/30" : isAdvanced ? "bg-indigo-950/20 hover:bg-indigo-900/30 border-indigo-800/30" : "bg-zinc-800/50 hover:bg-emerald-900/30 border-zinc-700");
  const solvedClass = isExpert
    ? "bg-gradient-to-br from-amber-500 to-yellow-400 text-black border-amber-400 shadow-lg shadow-amber-500/30 font-semibold"
    : isAdvanced
      ? "bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/30 font-semibold"
      : "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/25";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center">
      <div className={`w-full max-w-5xl rounded-3xl border shadow-2xl ${shellClass}`} style={{ maxHeight: "88vh" }}>
        <div className="flex items-center justify-between gap-4 border-b border-inherit px-5 py-4">
          <div>
            <h2 className="text-xl font-extrabold capitalize">{category}</h2>
            <div className={`text-xs mt-0.5 ${isExpert ? "text-amber-500" : isAdvanced ? "text-indigo-500" : "text-emerald-500"}`}>
              {isExpert ? "Expert Mode" : isAdvanced ? "Advanced Mode" : "Classic Mode"}
            </div>
          </div>
          <button onClick={onClose} className={`px-3 py-2 rounded-xl ${tileBase} border text-sm font-semibold`}>
            Close
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: "calc(88dvh - 74px)" }}>
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

// ===================== Tutorial Overlays =====================
function YeariousTutorial({ onClose, theme }) {
  const isLight = theme === "light";
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ${isLight ? "bg-white text-zinc-900" : "bg-zinc-900 text-zinc-100 border border-zinc-700"}`}>
        <div className={`px-5 py-4 ${isLight ? "bg-emerald-50 border-b border-emerald-200" : "bg-emerald-950/40 border-b border-emerald-800/40"}`}>
          <div className="text-2xl mb-1">📅</div>
          <h2 className="text-xl font-extrabold">Welcome to Yearious!</h2>
          <p className={`text-sm mt-1 ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>Guess the year of historical events in 4 tries.</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm font-semibold">Type a 4-digit year and press Enter. Each tile flips to show a hint:</p>
          <div className="flex gap-3 my-1">
            {[
              { d: "1", bg: "#22c55e", text: "#fff", hint: "Right digit, right place" },
              { d: "9", bg: "#facc15", text: "#111", hint: "Digit is too low" },
              { d: "8", bg: "#f97316", text: "#fff", hint: "Digit is too high" },
            ].map(({ d, bg, text, hint }) => (
              <div key={d} className="flex-1 text-center">
                <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center font-extrabold text-lg mb-1.5" style={{ background: bg, color: text }}>{d}</div>
                <span className={`text-[10px] font-medium leading-tight block ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>{hint}</span>
              </div>
            ))}
          </div>
          <div className={`rounded-xl p-3 text-xs ${isLight ? "bg-zinc-50 border border-zinc-200 text-zinc-700" : "bg-zinc-800/50 border border-zinc-700 text-zinc-300"}`}>
            Try <strong>Classic</strong> to start. Switch to <strong>Advanced</strong> or <strong>Expert</strong> for a bigger challenge — no high/low hints!
          </div>
        </div>
        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full rounded-xl py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base transition-all shadow-lg shadow-emerald-500/25 active:scale-95">
            Start Playing!
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function WhereiousTutorial({ onClose, theme }) {
  const isLight = theme === "light";
  const steps = [
    { icon: "📖", title: "Read the question", desc: "A historical event is shown at the top. Figure out where in the world it took place." },
    { icon: "📍", title: "Click the map", desc: "Click anywhere on the map to drop your pin. Click again to move it." },
    { icon: "✅", title: "Submit your guess", desc: "Press Enter or hit Submit to reveal how close you were. Up to 5,000 points per round!" },
  ];
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ${isLight ? "bg-white text-zinc-900" : "bg-[#14181f] text-zinc-100 border border-blue-500/10"}`}>
        <div className={`px-5 py-4 ${isLight ? "bg-blue-50 border-b border-blue-200" : "bg-blue-950/40 border-b border-blue-800/40"}`}>
          <div className="text-2xl mb-1">🌍</div>
          <h2 className="text-xl font-extrabold">Welcome to Whereious!</h2>
          <p className={`text-sm mt-1 ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>Guess where in the world historical events happened.</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {steps.map(({ icon, title, desc }) => (
            <div key={title} className="flex gap-3 items-start">
              <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
              <div>
                <div className="font-semibold text-sm">{title}</div>
                <div className={`text-xs mt-0.5 leading-relaxed ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>{desc}</div>
              </div>
            </div>
          ))}
          <div className={`rounded-xl p-3 text-xs mt-1 ${isLight ? "bg-blue-50 border border-blue-200 text-blue-800" : "bg-blue-950/30 border border-blue-700/30 text-blue-300"}`}>
            🏆 Score over 4,000 points to keep your streak alive!
          </div>
        </div>
        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full rounded-xl py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-base transition-all shadow-lg shadow-blue-500/25 active:scale-95">
            Let's Explore! 🗺️
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function Yearious({ onBack }) {
  // ====== Category selection ======
  const categories = ["music", "movies", "tech", "sports", "history", "inventions", "math", "animals", "architecture", "people"];
  const [selectedCats, setSelectedCats] = useState(() => {
    try {
      const raw = localStorage.getItem("yg_selectedCats");
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) && parsed.every((c) => categories.includes(c)) ? parsed : categories;
    } catch {
      return categories;
    }
  });

  // ====== Game Mode (moved up for storage key dependency) ======
  const [gameMode, setGameMode] = useState(() => (typeof localStorage !== "undefined" ? localStorage.getItem("yg_mode") || "classic" : "classic"));

  // ====== Category wins - separate for each mode ======
  const initCategoryWins = () => categories.reduce((acc, category) => { acc[category] = []; return acc; }, {});
  const [classicWins, setClassicWins] = useState(initCategoryWins);
  const [advancedWins, setAdvancedWins] = useState(initCategoryWins);
  const [expertWins, setExpertWins] = useState(initCategoryWins);
  const categoryWins = gameMode === "classic" ? classicWins : gameMode === "advanced" ? advancedWins : expertWins;
  const setCategoryWins = gameMode === "classic" ? setClassicWins : gameMode === "advanced" ? setAdvancedWins : setExpertWins;

  // ====== Streaks - separate for each mode ======
  const [classicStreak, setClassicStreak] = useState(0);
  const [classicBest, setClassicBest] = useState(0);
  const [advancedStreak, setAdvancedStreak] = useState(0);
  const [advancedBest, setAdvancedBest] = useState(0);
  const [expertStreak, setExpertStreak] = useState(0);
  const [expertBest, setExpertBest] = useState(0);
  const currentStreak = gameMode === "classic" ? classicStreak : gameMode === "advanced" ? advancedStreak : expertStreak;
  const bestStreak = gameMode === "classic" ? classicBest : gameMode === "advanced" ? advancedBest : expertBest;
  const setCurrentStreak = gameMode === "classic" ? setClassicStreak : gameMode === "advanced" ? setAdvancedStreak : setExpertStreak;
  const setBestStreak = gameMode === "classic" ? setClassicBest : gameMode === "advanced" ? setAdvancedBest : setExpertBest;

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

  // ====== Tutorial (first visit) ======
  const [showTutorial, setShowTutorial] = useState(() => {
    try { return !localStorage.getItem("yg_tutorialSeen"); } catch { return false; }
  });
  function dismissTutorial() {
    try { localStorage.setItem("yg_tutorialSeen", "1"); } catch {}
    setShowTutorial(false);
  }

  // ====== Modals ======
  const [showHowTo, setShowHowTo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gridCategory, setGridCategory] = useState(null);

  // ====== Stats - separate for each mode ======
  const initStats = () => ({ gamesPlayed: 0, wins: 0, guessDistribution: [0, 0, 0, 0] });
  const [classicStats, setClassicStats] = useState(initStats);
  const [advancedStats, setAdvancedStats] = useState(initStats);
  const [expertStats, setExpertStats] = useState(initStats);
  const stats = gameMode === "classic" ? classicStats : gameMode === "advanced" ? advancedStats : expertStats;
  const setStats = gameMode === "classic" ? setClassicStats : gameMode === "advanced" ? setAdvancedStats : setExpertStats;

  // Load stats from localStorage
  useEffect(() => {
    try {
      const cStats = localStorage.getItem("yg_stats_classic");
      const aStats = localStorage.getItem("yg_stats_advanced");
      const eStats = localStorage.getItem("yg_stats_expert");
      if (cStats) setClassicStats(JSON.parse(cStats));
      if (aStats) setAdvancedStats(JSON.parse(aStats));
      if (eStats) setExpertStats(JSON.parse(eStats));
    } catch {}
  }, []);

  const persistStats = (newStats, mode) => {
    try { localStorage.setItem(`yg_stats_${mode}`, JSON.stringify(newStats)); } catch {}
  };

  // ====== Theme ======
  const [theme, setTheme] = useState(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("yg_theme") || "dark" : "dark";
    return saved === "auto" ? "dark" : saved;
  });
  useEffect(() => { try { localStorage.setItem("yg_theme", theme); } catch {} }, [theme]);
  useEffect(() => { try { localStorage.setItem("yg_mode", gameMode); } catch {} }, [gameMode]);
  const isLight = theme === "light";
  const isExpert = gameMode === "expert";
  const isAdvanced = gameMode === "advanced";

  // Mode-specific theme colors: Classic = emerald, Advanced = indigo (purple), Expert = amber. Tile feedback colors unchanged (teal/gray).
  const bgClass = isLight
    ? isExpert
      ? "bg-gradient-to-b from-[#faf8f0] to-[#f5f0e6] text-zinc-900"
      : isAdvanced
        ? "bg-gradient-to-b from-[#eef2ff] to-[#e0e7ff] text-zinc-900"
        : "bg-gradient-to-b from-emerald-50 to-[#ecfdf5] text-zinc-900"
    : isExpert
      ? "bg-[#0c0a08] text-zinc-100"
      : isAdvanced
        ? "bg-[#1e1b4b] text-zinc-100"
        : "bg-gradient-to-b from-[#0c1410] to-[#061008] text-zinc-100";
  const cardClass = isLight
    ? isExpert
      ? "bg-white rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 border-2 border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
      : isAdvanced
        ? "bg-white rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 border-2 border-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
        : "bg-emerald-50/90 rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 border-2 border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
    : isExpert
      ? "bg-gradient-to-b from-[#1a1610] to-[#141210] rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 border border-amber-500/40 shadow-[0_0_25px_rgba(245,158,11,0.25)]"
      : isAdvanced
        ? "bg-gradient-to-b from-[#312e81] to-[#1e1b4b] rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 border border-indigo-500/40 shadow-[0_0_25px_rgba(99,102,241,0.25)]"
        : "bg-gradient-to-b from-[#0f1412] to-[#0a0f0d] rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 border-2 border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.35)]";
  const ghostBtn = isLight
    ? isExpert
      ? "bg-transparent border border-amber-400 hover:bg-amber-50 text-amber-800"
      : isAdvanced
        ? "bg-transparent border border-indigo-500 hover:bg-indigo-50 text-indigo-800"
        : "bg-transparent border border-zinc-300 hover:bg-emerald-50 text-zinc-700"
    : isExpert
      ? "bg-transparent border border-amber-600/50 hover:bg-amber-500/10 hover:border-amber-500/70 text-amber-200"
      : isAdvanced
        ? "bg-transparent border border-indigo-500/50 hover:bg-indigo-500/10 hover:border-indigo-400/70 text-indigo-200"
        : "bg-transparent border border-zinc-700 hover:bg-emerald-500/10 hover:border-emerald-500/50 text-zinc-300";
  const primaryBtn = isExpert
    ? "bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-bold shadow-lg shadow-amber-500/30"
    : isAdvanced
      ? "bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-500/25"
      : "bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/25";
  const pillSelected = isLight
    ? isExpert
      ? "bg-amber-50 border-2 border-amber-500 text-amber-900 shadow-sm"
      : isAdvanced
        ? "bg-indigo-50 border-2 border-indigo-500 text-indigo-900 shadow-sm"
        : "bg-emerald-50 border-2 border-emerald-500 text-emerald-900 shadow-sm"
    : isExpert
      ? "bg-amber-950/40 border-2 border-amber-500/70 text-amber-100 shadow-sm shadow-amber-500/10"
      : isAdvanced
        ? "bg-indigo-950/40 border-2 border-indigo-500/70 text-indigo-100 shadow-sm shadow-indigo-500/10"
        : "bg-emerald-950/30 border-2 border-emerald-500/50 text-emerald-200 shadow-sm";
  const pillUnselected = isLight
    ? isExpert
      ? "bg-white border-2 border-dashed border-amber-200 text-amber-500 hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50"
      : isAdvanced
        ? "bg-white border-2 border-dashed border-indigo-200 text-indigo-600 hover:border-indigo-400 hover:text-indigo-800 hover:bg-indigo-50"
        : "bg-white border-2 border-dashed border-zinc-300 text-zinc-500 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50"
    : isExpert
      ? "bg-[#12100c] border-2 border-dashed border-amber-900/50 text-amber-600 hover:border-amber-600/60 hover:text-amber-400 hover:bg-amber-950/20"
      : isAdvanced
        ? "bg-[#1e1b4b]/60 border-2 border-dashed border-indigo-700/50 text-indigo-400 hover:border-indigo-500/60 hover:text-indigo-300 hover:bg-indigo-950/20"
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

  // ====== Load streaks and wins for all modes ======
  useEffect(() => {
    try {
      const classicC = parseInt(localStorage.getItem("yg_currentStreak_classic") || "0", 10);
      const classicB = parseInt(localStorage.getItem("yg_bestStreak_classic") || "0", 10);
      const classicSavedWins = JSON.parse(localStorage.getItem("yg_categoryWins_classic") || "{}");
      if (!Number.isNaN(classicC)) setClassicStreak(classicC);
      if (!Number.isNaN(classicB)) setClassicBest(classicB);
      setClassicWins(categories.reduce((acc, category) => {
        acc[category] = Array.isArray(classicSavedWins[category]) ? classicSavedWins[category] : [];
        return acc;
      }, {}));

      const advancedC = parseInt(localStorage.getItem("yg_currentStreak_advanced") || "0", 10);
      const advancedB = parseInt(localStorage.getItem("yg_bestStreak_advanced") || "0", 10);
      const advancedSavedWins = JSON.parse(localStorage.getItem("yg_categoryWins_advanced") || "{}");
      if (!Number.isNaN(advancedC)) setAdvancedStreak(advancedC);
      if (!Number.isNaN(advancedB)) setAdvancedBest(advancedB);
      setAdvancedWins(categories.reduce((acc, category) => {
        acc[category] = Array.isArray(advancedSavedWins[category]) ? advancedSavedWins[category] : [];
        return acc;
      }, {}));

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

  // Persist selected categories
  useEffect(() => {
    try { localStorage.setItem("yg_selectedCats", JSON.stringify(selectedCats)); } catch {}
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
      style={{ minHeight: "100dvh" }}
    >
      <div className="w-full max-w-4xl" style={{ width: "100%", maxWidth: "48rem" }}>
        {/* Header Row 1: Back + Title + Streak/Best labels */}
        <div className="flex items-end justify-between gap-2 mb-1">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className={`p-2 rounded-xl transition-all ${isLight ? "hover:bg-zinc-200 text-zinc-600" : "hover:bg-white/10 text-zinc-400"}`}
              title="Back to Home"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight md:text-5xl">Yearious</h1>
          </div>
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
            <div className={`text-4xl sm:text-5xl md:text-5xl font-extrabold leading-none ${isExpert ? "text-amber-400" : isAdvanced ? "text-indigo-400" : ""}`}>{currentStreak}</div>
            <div className={`text-4xl sm:text-5xl md:text-5xl font-extrabold leading-none ${isExpert ? "text-amber-400" : isAdvanced ? "text-indigo-400" : ""}`}>{bestStreak}</div>
          </div>
        </div>

        {/* Divider line */}
        <div className={`h-px mb-4 ${isExpert ? (isLight ? "bg-amber-300" : "bg-amber-700/50") : isAdvanced ? (isLight ? "bg-indigo-300" : "bg-indigo-700/50") : (isLight ? "bg-zinc-200" : "bg-zinc-700")}`} />

        {/* Action buttons row */}
        <div className="mb-4 md:mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHowTo(true)} className={`rounded-xl sm:rounded-2xl px-4 sm:px-4 py-2.5 sm:py-2.5 ${ghostBtn} text-sm sm:text-sm font-semibold`} title="How to play">How To Play</button>
            <button onClick={() => setShowSettings(true)} className={`rounded-xl sm:rounded-2xl px-4 sm:px-4 py-2.5 sm:py-2.5 ${ghostBtn} text-sm sm:text-sm font-semibold`} title="Settings">Settings</button>
          </div>
          <button
            onClick={newEvent}
            className={`rounded-xl sm:rounded-2xl px-5 sm:px-5 py-2.5 sm:py-2.5 ${primaryBtn} text-sm sm:text-sm font-semibold focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${isExpert ? "" : isAdvanced ? "shadow-lg shadow-indigo-900/20" : "shadow-lg shadow-emerald-900/20"}`}
          >
            New Event
          </button>
        </div>

        {/* Category selector - horizontal scroll row when viewport is short (max-height: 768px) */}
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
              {selectedCats.length === 0 ? (
                <>
                  <div className="mb-3 sm:mb-3 text-2xl sm:text-3xl font-bold">No categories selected</div>
                  <div className="text-lg sm:text-lg opacity-70">Pick at least one category above to start playing.</div>
                </>
              ) : (
                <>
                  <div className="mb-3 sm:mb-3 text-2xl sm:text-3xl font-bold">Select categories</div>
                  <div className="text-lg sm:text-lg opacity-70">Choose one or more categories above to start playing.</div>
                </>
              )}
            </div>
          ) : (
            <>
          <div className="mb-1 text-center">
            <span className={`text-[10px] sm:text-xs uppercase tracking-wider font-semibold ${isLight ? "text-zinc-500" : "text-zinc-400"}`}>{puzzle.category}</span>
          </div>
          <div className="mb-4 sm:mb-5 text-center text-xl sm:text-2xl font-semibold leading-snug">When did {puzzle.event}?</div>

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
                    isAdvanced={isAdvanced}
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
          <div className={`w-full max-w-md rounded-2xl p-5 border-2 ${
            isExpert
              ? (isLight ? "bg-amber-50 border-amber-300 text-zinc-900" : "bg-[#141210] border-amber-600/60 text-zinc-100")
              : isAdvanced
                ? (isLight ? "bg-indigo-50 border-indigo-300 text-zinc-900" : "bg-[#1e1b4b] border-indigo-500/60 text-zinc-100")
                : (isLight ? "bg-white border-zinc-200 text-zinc-900" : "bg-zinc-900 border-zinc-600 text-zinc-100")
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">How to Play</h2>
              <button onClick={() => setShowHowTo(false)} className={`px-2 py-1 rounded-lg ${
                isExpert
                  ? (isLight ? "bg-amber-200 hover:bg-amber-300 text-amber-900" : "bg-amber-900/50 hover:bg-amber-800/50 text-amber-200")
                  : isAdvanced
                    ? (isLight ? "bg-indigo-200 hover:bg-indigo-300 text-indigo-900" : "bg-indigo-900/50 hover:bg-indigo-800/50 text-indigo-200")
                    : (isLight ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-700" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300")
              }`}>✕</button>
            </div>
            <ul className="list-disc ml-5 space-y-2 text-sm opacity-95">
              <li>Guess the <strong>year</strong> of the event. You have <strong>4 guesses</strong>.</li>
              <li>Type digits in the tiles (desktop) or use the keypad (mobile). Press <strong>Enter</strong> to submit.</li>
              <li className="pt-1 font-semibold">Tile colors depend on your mode:</li>
              {gameMode === "classic" && (
                <>
                  <li><span className="text-green-500 font-semibold">Green</span> = correct digit, right place</li>
                  <li><span className="text-yellow-400 font-semibold">Yellow</span> = digit too low</li>
                  <li><span className="text-orange-500 font-semibold">Orange</span> = digit too high</li>
                </>
              )}
              {gameMode === "advanced" && (
                <>
                  <li><span className="text-teal-500 font-semibold">Teal</span> = right digit, right place</li>
                  <li><span className="text-teal-600 font-semibold">Teal dashed border</span> = digit is in the year but in another position</li>
                  <li><span className={`font-semibold ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>Gray</span> = digit not in the year</li>
                </>
              )}
              {gameMode === "expert" && (
                <>
                  <li><span className="text-amber-400 font-semibold">Gold</span> = correct digit</li>
                  <li><span className={`font-semibold ${isLight ? "text-zinc-900" : "text-zinc-300"}`}>Black</span> = wrong digit (no high/low hints)</li>
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
              <h2 className="text-2xl font-bold">Settings</h2>
              <button onClick={() => setShowSettings(false)} className={`rounded-xl px-2.5 py-1.5 text-sm ${isLight ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200" : "bg-white/10 text-zinc-100 hover:bg-white/20"}`}>{"\u2715"}</button>
            </div>

            <div className={`mb-5 rounded-xl p-4 ${isLight ? "bg-zinc-50" : "bg-zinc-800/50"}`}>
              <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-3">Progress</div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Classic Streak</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{classicStreak}</span>
                    <button onClick={() => { setClassicStreak(0); try { localStorage.setItem("yg_currentStreak_classic", "0"); } catch {} }} className="rounded-lg px-2.5 py-1 text-xs bg-red-600 hover:bg-red-500 text-white">Clear</button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Advanced Streak</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{advancedStreak}</span>
                    <button onClick={() => { setAdvancedStreak(0); try { localStorage.setItem("yg_currentStreak_advanced", "0"); } catch {} }} className="rounded-lg px-2.5 py-1 text-xs bg-red-600 hover:bg-red-500 text-white">Clear</button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Expert Streak</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{expertStreak}</span>
                    <button onClick={() => { setExpertStreak(0); try { localStorage.setItem("yg_currentStreak_expert", "0"); } catch {} }} className="rounded-lg px-2.5 py-1 text-xs bg-red-600 hover:bg-red-500 text-white">Clear</button>
                  </div>
                </div>
              </div>
            </div>

            <div className={`mb-5 rounded-xl p-4 ${isLight ? "bg-zinc-50" : "bg-zinc-800/50"}`}>
              <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-3">Stats</div>
              <div className="flex gap-2 mb-3">
                <button onClick={() => handleModeSwitch("classic")} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${gameMode === "classic" ? "bg-emerald-600 text-white" : isLight ? "bg-zinc-100 text-zinc-700" : "bg-zinc-800 text-zinc-300"}`}>Classic</button>
                <button onClick={() => handleModeSwitch("advanced")} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${gameMode === "advanced" ? "bg-indigo-600 text-white" : isLight ? "bg-zinc-100 text-zinc-700" : "bg-zinc-800 text-zinc-300"}`}>Advanced</button>
                <button onClick={() => handleModeSwitch("expert")} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${gameMode === "expert" ? "bg-amber-500 text-black" : isLight ? "bg-zinc-100 text-zinc-700" : "bg-zinc-800 text-zinc-300"}`}>Expert</button>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3 text-center">
                <div>
                  <div className="text-xl font-extrabold">{stats.gamesPlayed}</div>
                  <div className="text-[10px] opacity-50 uppercase">Played</div>
                </div>
                <div>
                  <div className="text-xl font-extrabold">{stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0}%</div>
                  <div className="text-[10px] opacity-50 uppercase">Win %</div>
                </div>
                <div>
                  <div className="text-xl font-extrabold">{currentStreak}</div>
                  <div className="text-[10px] opacity-50 uppercase">Streak</div>
                </div>
                <div>
                  <div className="text-xl font-extrabold">{bestStreak}</div>
                  <div className="text-[10px] opacity-50 uppercase">Best</div>
                </div>
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-2">Guess Distribution</div>
              {stats.guessDistribution.map((count, i) => {
                const maxVal = Math.max(...stats.guessDistribution, 1);
                return (
                  <div key={i} className="flex items-center gap-2 mb-1.5">
                    <span className="w-4 text-xs font-bold text-right">{i + 1}</span>
                    <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: isLight ? "#e5e7eb" : "#27272a" }}>
                      <div className={`h-full rounded flex items-center justify-end pr-1.5 text-xs font-bold text-white ${isExpert ? "bg-amber-500" : isAdvanced ? "bg-indigo-600" : "bg-emerald-600"}`} style={{ width: `${Math.max((count / maxVal) * 100, count > 0 ? 8 : 0)}%`, minWidth: count > 0 ? "20px" : "0" }}>
                        {count > 0 && count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={`mb-5 rounded-xl p-4 ${isLight ? "bg-zinc-50" : "bg-zinc-800/50"}`}>
              <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-3">Theme</div>
              <div className="flex gap-2">
                <button onClick={() => setTheme("light")} className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${theme === "light" ? (isExpert ? "border-amber-500 bg-amber-500 text-black" : isAdvanced ? "border-indigo-500 bg-indigo-500 text-white" : "border-emerald-500 bg-emerald-500 text-white") : isLight ? "border-zinc-200 bg-white text-zinc-700" : "border-zinc-700 bg-zinc-800 text-zinc-300"}`}>Light</button>
                <button onClick={() => setTheme("dark")} className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${theme === "dark" ? (isExpert ? "border-amber-500 bg-amber-500 text-black" : isAdvanced ? "border-indigo-500 bg-indigo-500 text-white" : "border-emerald-500 bg-emerald-500 text-white") : isLight ? "border-zinc-200 bg-white text-zinc-700" : "border-zinc-700 bg-zinc-800 text-zinc-300"}`}>Dark</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Grid Modal */}
      {gridCategory && (
        <CategoryGridModal
          category={gridCategory}
          events={EVENTS.filter(e => e.category === gridCategory)}
          solvedKeys={new Set(Object.keys(categoryWins).flatMap(cat => categoryWins[cat]))}
          onClose={() => setGridCategory(null)}
          onPick={(event) => { setGridCategory(null); setPuzzle(event); setInputArr(Array(String(event.year).length).fill("")); setCursor(0); setGuesses([]); setPatterns([]); setStatus("playing"); setMessage(""); setRevealInfo(""); }}
          theme={theme}
          isExpert={isExpert}
          isAdvanced={isAdvanced}
        />
      )}

      {/* First-timer tutorial */}
      {showTutorial && <YeariousTutorial onClose={dismissTutorial} theme={theme} />}
    </div>
  );
}

// ===================== Whereious Grid Modal =====================
function WhereiousGridModal({ category, events, solvedData, onClose, onPick, theme }) {
  const isLight = theme === "light";
  const shellClass = isLight ? "bg-white text-zinc-900 border-zinc-200" : "bg-[#14181f] text-zinc-100 border-blue-500/10";
  const tileBase = isLight ? "bg-zinc-50 hover:bg-blue-50 border-zinc-200" : "bg-zinc-800/50 hover:bg-blue-900/30 border-zinc-700";
  const solvedClass = isLight ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-blue-500/20 text-blue-400 border-blue-500/30";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center">
      <div className={`w-full max-w-5xl rounded-3xl border shadow-2xl ${shellClass}`} style={{ maxHeight: "88vh" }}>
        <div className="flex items-center justify-between gap-4 border-b border-inherit px-5 py-4">
          <h2 className="text-xl font-extrabold capitalize">{category}</h2>
          <button onClick={onClose} className={`px-3 py-2 rounded-xl ${tileBase} border text-sm font-semibold`}>
            Close
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: "calc(88dvh - 74px)" }}>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-3">
            {events.map((ev, index) => {
              const key = `${ev.category}::${ev.question}`;
              const data = solvedData[key];
              const solved = !!data;
              const distance = data && typeof data === "object" && typeof data.distance === "number" ? data.distance : null;
              const score = data && typeof data === "object" && typeof data.score === "number" ? data.score : null;
              return (
                <button
                  key={key}
                  onClick={() => !solved && onPick(ev)}
                  disabled={solved}
                  title={ev.question}
                  className={`group relative rounded-2xl border px-2 py-3 text-left transition-all ${solved ? solvedClass : tileBase} ${solved ? "cursor-default" : "cursor-pointer"}`}
                >
                  <div className="text-[11px] font-bold opacity-70">#{index + 1}</div>
                  <div className="mt-2 line-clamp-3 text-xs font-semibold leading-tight">
                    {ev.question}
                  </div>
                  <div className={`mt-3 text-[11px] ${solved ? "opacity-90" : "opacity-50 group-hover:opacity-80"}`}>
                    {solved ? (
                      distance != null || score != null ? (
                        <span className="tabular-nums">
                          {distance != null && <span>{distance.toLocaleString()} km</span>}
                          {distance != null && score != null && " · "}
                          {score != null && <span>+{score.toLocaleString()} pts</span>}
                        </span>
                      ) : (
                        "Solved"
                      )
                    ) : (
                      "Try me"
                    )}
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

// ===================== Whereious - Location Guessing Game =====================
// ArcGIS World Street Map. Tiles wrap so the map fills the entire screen.
// Pins and line are placed on the same world copy by normalizing longitudes.

function WorldMap({ guess, onGuess, actualLocation, showAnswer, isLight, fullScreen }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);
  const showAnswerRef = useRef(showAnswer);
  const onGuessRef = useRef(onGuess);
  showAnswerRef.current = showAnswer;
  onGuessRef.current = onGuess;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      attributionControl: false,
      minZoom: 2,
      maxZoom: 18,
      zoomSnap: 1,
      zoomDelta: 1,
      worldCopyJump: true,
    });
    const initialZoom = typeof window !== "undefined" ? (window.innerWidth >= 1024 ? 4 : window.innerWidth >= 768 ? 3 : 2) : 2;
    map.setView([20, 0], initialZoom);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 18, maxNativeZoom: 18 }
    ).addTo(map);

    mapRef.current = map;
    map.on("click", (e) => {
      if (!showAnswerRef.current) {
        onGuessRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        try { localStorage.setItem("whereious_mapPromptSeen", "1"); } catch {}
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = [];
    };
  }, []);

  // Normalize lng to [-180, 180]
  function normLng(lng) {
    while (lng > 180) lng -= 360;
    while (lng < -180) lng += 360;
    return lng;
  }

  // Move answerLng to the same world copy as guessLng (closest copy within ±180°)
  function closestLng(guessLng, answerLng) {
    let diff = answerLng - guessLng;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return guessLng + diff;
  }

  // Update markers and polyline when guess/actualLocation/showAnswer change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layersRef.current.forEach((layer) => { map.removeLayer(layer); });
    layersRef.current = [];

    const guessIcon = L.divIcon({ className: "", html: '<div style="width:24px;height:24px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>', iconSize: [24, 24], iconAnchor: [12, 12] });
    const answerIcon = L.divIcon({ className: "", html: '<div style="width:24px;height:24px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>', iconSize: [24, 24], iconAnchor: [12, 12] });

    if (guess) {
      const gLng = normLng(guess.lng);
      const m = L.marker([guess.lat, gLng], { icon: guessIcon }).addTo(map);
      layersRef.current.push(m);
    }
    if (showAnswer && actualLocation) {
      if (guess) {
        const gLng = normLng(guess.lng);
        // Put the answer pin on the same world copy as the guess
        const aLng = closestLng(gLng, normLng(actualLocation.lng));
        const answerMarker = L.marker([actualLocation.lat, aLng], { icon: answerIcon }).addTo(map);
        layersRef.current.push(answerMarker);
        const line = L.polyline([[guess.lat, gLng], [actualLocation.lat, aLng]], { color: "#ef4444", weight: 2, dashArray: "8" }).addTo(map);
        layersRef.current.push(line);
        const bounds = L.latLngBounds([guess.lat, gLng], [actualLocation.lat, aLng]);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
      } else {
        const m = L.marker([actualLocation.lat, normLng(actualLocation.lng)], { icon: answerIcon }).addTo(map);
        layersRef.current.push(m);
      }
    }
  }, [guess, actualLocation, showAnswer]);

  return (
    <div
      ref={containerRef}
      className="whereious-single-map"
      style={{ width: "100%", height: fullScreen ? "100%" : "400px" }}
    />
  );
}

function Whereious({ onBack }) {
  const WEVENTS = ALL_WHEREIOUS_EVENTS.filter(e => e && e.category && e.question && e.lat !== undefined);
  const categories = [...new Set(WEVENTS.map(e => e.category))];
  const categoryEvents = {};
  categories.forEach(cat => { categoryEvents[cat] = WEVENTS.filter(e => e.category === cat); });
  const categoryTotals = {};
  categories.forEach(cat => { categoryTotals[cat] = categoryEvents[cat].length; });

  const [selectedCats, setSelectedCats] = useState(() => {
    try {
      const raw = localStorage.getItem("whereious_selectedCats");
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) && parsed.every((c) => categories.includes(c)) ? parsed : categories;
    } catch {
      return categories;
    }
  });
  const [puzzle, setPuzzle] = useState(null);
  const [guess, setGuess] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [lastScore, setLastScore] = useState(0);
  const [lastDistance, setLastDistance] = useState(0);
  const [streak, setStreak] = useState(() => { try { return parseInt(localStorage.getItem("whereious_streak") || "0"); } catch { return 0; } });
  const [bestStreak, setBestStreak] = useState(() => { try { return parseInt(localStorage.getItem("whereious_bestStreak") || "0"); } catch { return 0; } });
  const [recentDistances, setRecentDistances] = useState(() => { try { const d = JSON.parse(localStorage.getItem("whereious_recentDistances") || "[]"); return Array.isArray(d) ? d.slice(-100) : []; } catch { return []; } });
  const [gamesPlayed, setGamesPlayed] = useState(() => { try { return parseInt(localStorage.getItem("whereious_gamesPlayed") || "0"); } catch { return 0; } });
  const [solvedQuestions, setSolvedQuestions] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("whereious_solved") || "{}");
      const out = {};
      Object.keys(raw).forEach(k => { out[k] = raw[k] === true ? true : (raw[k] && typeof raw[k] === "object" ? raw[k] : true); });
      return out;
    } catch { return {}; }
  });

  useEffect(() => { try { localStorage.setItem("whereious_streak", String(streak)); } catch {} }, [streak]);
  useEffect(() => { try { localStorage.setItem("whereious_bestStreak", String(bestStreak)); } catch {} }, [bestStreak]);
  useEffect(() => { try { localStorage.setItem("whereious_recentDistances", JSON.stringify(recentDistances)); } catch {} }, [recentDistances]);
  useEffect(() => { try { localStorage.setItem("whereious_gamesPlayed", String(gamesPlayed)); } catch {} }, [gamesPlayed]);
  useEffect(() => { try { localStorage.setItem("whereious_solved", JSON.stringify(solvedQuestions)); } catch {} }, [solvedQuestions]);

  const [showSettings, setShowSettings] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [gridCategory, setGridCategory] = useState(null);
  const [statsTab, setStatsTab] = useState("questions"); // "questions" | "points"
  const [panelHeightPct, setPanelHeightPct] = useState(() => {
    try { const v = parseFloat(localStorage.getItem("whereious_panelHeightPct") || "42"); const n = Math.max(20, Math.min(60, Number.isFinite(v) ? v : 42)); return Math.round(n); } catch { return 42; }
  });
  useEffect(() => { try { localStorage.setItem("whereious_panelHeightPct", String(panelHeightPct)); } catch {} }, [panelHeightPct]);

  const [panelWidthPx, setPanelWidthPx] = useState(() => {
    try { const v = parseInt(localStorage.getItem("whereious_panelWidth") || "400", 10); const n = Math.max(280, Math.min(700, Number.isFinite(v) ? v : 400)); return n; } catch { return 400; }
  });
  useEffect(() => { try { localStorage.setItem("whereious_panelWidth", String(panelWidthPx)); } catch {} }, [panelWidthPx]);

  const [hasSubmittedBefore, setHasSubmittedBefore] = useState(() => {
    try { return localStorage.getItem("whereious_hasSubmittedBefore") === "1"; } catch { return false; }
  });

  const [showTutorial, setShowTutorial] = useState(() => {
    try { return !localStorage.getItem("whereious_tutorialSeen"); } catch { return false; }
  });
  function dismissTutorial() {
    try { localStorage.setItem("whereious_tutorialSeen", "1"); } catch {}
    setShowTutorial(false);
  }

  const [last10Answered, setLast10Answered] = useState(() => {
    try { const a = JSON.parse(localStorage.getItem("whereious_last10Answered") || "[]"); return Array.isArray(a) ? a.slice(0, 10) : []; } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem("whereious_last10Answered", JSON.stringify(last10Answered)); } catch {} }, [last10Answered]);
  useEffect(() => { try { localStorage.setItem("whereious_selectedCats", JSON.stringify(selectedCats)); } catch {} }, [selectedCats]);

  const panelDragRef = useRef(false);
  const panelWidthDragRef = useRef(false);
  const handlePanelDragStart = () => { panelDragRef.current = true; };
  const handlePanelDragMove = useCallback((clientY) => {
    if (!panelDragRef.current || typeof window === "undefined") return;
    const pct = (window.innerHeight - clientY) / window.innerHeight * 100;
    setPanelHeightPct(Math.max(20, Math.min(60, Math.round(pct))));
  }, []);
  const handlePanelDragEnd = useCallback(() => { panelDragRef.current = false; }, []);

  const handlePanelWidthDragMove = useCallback((clientX) => {
    if (!panelWidthDragRef.current || typeof window === "undefined") return;
    const width = window.innerWidth - clientX;
    setPanelWidthPx(Math.max(280, Math.min(700, Math.round(width))));
  }, []);
  const handlePanelWidthDragEnd = useCallback(() => { panelWidthDragRef.current = false; }, []);

  useEffect(() => {
    const onMove = (e) => handlePanelDragMove(e.touches ? e.touches[0].clientY : e.clientY);
    const onEnd = () => handlePanelDragEnd();
    if (typeof window === "undefined") return;
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    return () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
    };
  }, [handlePanelDragMove, handlePanelDragEnd]);

  useEffect(() => {
    const onMove = (e) => { if (e.clientX != null) handlePanelWidthDragMove(e.clientX); };
    const onEnd = () => handlePanelWidthDragEnd();
    if (typeof window === "undefined") return;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
    };
  }, [handlePanelWidthDragMove, handlePanelWidthDragEnd]);

  const [theme, setTheme] = useState(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("yg_theme") || "dark" : "dark";
    return saved === "auto" ? "dark" : saved;
  });
  useEffect(() => { try { localStorage.setItem("yg_theme", theme); } catch {} }, [theme]);
  const isLight = theme === "light";

  // ====== Enter key: submit guess or advance to next question ======
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Enter") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      if (e.target?.isContentEditable || ["input", "textarea", "select"].includes(tag)) return;
      if (showTutorial || showHowTo || showSettings || gridCategory) return;
      if (showAnswer) { newGame(); }
      else if (guess) { submitGuess(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showAnswer, guess, puzzle, showTutorial, showHowTo, showSettings, gridCategory]);

  const ghostBtn = isLight ? "bg-transparent border border-zinc-300 hover:bg-blue-50 text-zinc-700" : "bg-transparent border border-zinc-700 hover:bg-blue-900/20 text-zinc-300";
  const primaryBtn = "bg-blue-600 hover:bg-blue-500 text-white";
  const pillSelected = isLight ? "bg-blue-600 text-white" : "bg-blue-600 text-white";
  const pillUnselected = isLight ? "bg-zinc-100 text-zinc-600 hover:bg-zinc-200" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700";

  function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function calculateScore(distance) { return Math.max(0, Math.round(5000 * Math.exp(-distance / 2000))); }

  const toggleCategory = (cat) => setSelectedCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);

  const newGame = () => {
    const notInLast10 = (e) => !last10Answered.includes(`${e.category}::${e.question}`);
    const available = WEVENTS.filter(e => selectedCats.includes(e.category) && !solvedQuestions[`${e.category}::${e.question}`] && notInLast10(e));
    if (available.length === 0) {
      const all = WEVENTS.filter(e => selectedCats.includes(e.category) && notInLast10(e));
      if (all.length === 0) {
        const anyInCats = WEVENTS.filter(e => selectedCats.includes(e.category));
        if (anyInCats.length === 0) return;
        setPuzzle(anyInCats[Math.floor(Math.random() * anyInCats.length)]);
      } else {
        setPuzzle(all[Math.floor(Math.random() * all.length)]);
      }
    } else {
      setPuzzle(available[Math.floor(Math.random() * available.length)]);
    }
    setGuess(null);
    setShowAnswer(false);
    setLastScore(0);
    setLastDistance(0);
  };

  const submitGuess = () => {
    if (!guess || !puzzle) return;
    try { localStorage.setItem("whereious_hasSubmittedBefore", "1"); } catch {}
    setHasSubmittedBefore(true);
    const key = `${puzzle.category}::${puzzle.question}`;
    setLast10Answered(prev => [key, ...prev.filter(k => k !== key)].slice(0, 10));
    const dist = calculateDistance(guess.lat, guess.lng, puzzle.lat, puzzle.lng);
    const distKm = Math.round(dist);
    const score = calculateScore(dist);
    setLastDistance(distKm);
    setLastScore(score);
    setShowAnswer(true);
    setRecentDistances(prev => [...prev.slice(-99), distKm]);
    setGamesPlayed(prev => prev + 1);
    setSolvedQuestions(prev => ({ ...prev, [`${puzzle.category}::${puzzle.question}`]: { distance: distKm, score } }));
    if (score > 4000) {
      setStreak(prev => {
        const next = prev + 1;
        setBestStreak(b => Math.max(b, next));
        return next;
      });
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    } else {
      setStreak(0);
    }
  };

  const chooseSpecificEvent = (ev) => {
    setGridCategory(null);
    setPuzzle(ev);
    setGuess(null);
    setShowAnswer(false);
    setLastScore(0);
    setLastDistance(0);
  };

  useEffect(() => { if (selectedCats.length > 0 && !puzzle) newGame(); }, [selectedCats]);

  const solvedPerCategory = useMemo(() => {
    const counts = {};
    categories.forEach(cat => {
      counts[cat] = Object.keys(solvedQuestions).filter(key => key.startsWith(`${cat}::`)).length;
    });
    return counts;
  }, [solvedQuestions]);

  const distanceAverages = useMemo(() => {
    const d = recentDistances;
    const avg = (n) => d.length >= n ? Math.round(d.slice(-n).reduce((a, b) => a + b, 0) / n) : null;
    return { avg10: avg(10), avg20: avg(20), avg50: avg(50), avg100: avg(100) };
  }, [recentDistances]);

  const totalPointsAndDistance = useMemo(() => {
    let totalPoints = 0;
    let totalDistance = 0;
    let minDistance = null;
    Object.values(solvedQuestions).forEach((v) => {
      if (v && typeof v === "object" && typeof v.score === "number") totalPoints += v.score;
      if (v && typeof v === "object" && typeof v.distance === "number") {
        totalDistance += v.distance;
        minDistance = minDistance === null ? v.distance : Math.min(minDistance, v.distance);
      }
    });
    return { totalPoints, totalDistance, minDistance };
  }, [solvedQuestions]);

  const pointsAndDistanceByCategory = useMemo(() => {
    const byCat = {};
    categories.forEach(cat => { byCat[cat] = { points: 0, distance: 0 }; });
    Object.entries(solvedQuestions).forEach(([key, v]) => {
      if (!key.includes("::") || !v || typeof v !== "object") return;
      const cat = key.split("::")[0];
      if (!byCat[cat]) return;
      if (typeof v.score === "number") byCat[cat].points += v.score;
      if (typeof v.distance === "number") byCat[cat].distance += v.distance;
    });
    return byCat;
  }, [solvedQuestions, categories]);

  const submitLabel = guess ? "Submit" : (hasSubmittedBefore ? "Submit" : "Place your pin on the map");

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ ["--whereious-panel-width"]: `${panelWidthPx}px` }}>
      {/* Question bar: one row so Submit/Next stays on the right (mobile + desktop) */}
      <div
        className={`whereious-header-safe whereious-header-dynamic-right absolute top-0 left-0 right-0 z-20 flex flex-row items-center gap-2 sm:gap-3 lg:gap-4 xl:gap-6 2xl:gap-8 px-3 sm:px-5 py-2 sm:py-3 lg:py-4 lg:px-8 xl:px-10 2xl:px-12 min-h-0 lg:min-h-[96px] ${
          isLight ? "bg-white border-b border-zinc-200 text-zinc-900" : "bg-[#14181f] border-b border-zinc-700/50 text-zinc-100"
        } shadow-sm`}
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button onClick={onBack} className={`p-1.5 sm:p-2 -ml-1 rounded-xl transition-all touch-manipulation ${isLight ? "hover:bg-zinc-200 text-zinc-600 active:bg-zinc-300" : "hover:bg-white/10 text-zinc-400 active:bg-white/15"}`} title="Back to Home" aria-label="Back to Home">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className={`text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight xl:text-4xl truncate min-w-0 ${isLight ? "text-zinc-900" : "text-white"}`}>Whereious</h1>
        </div>
        {puzzle && (
          <div className={`flex flex-col lg:flex-row lg:items-center gap-0.5 sm:gap-1 lg:gap-4 xl:gap-6 min-w-0 flex-1 lg:border-l lg:pl-6 xl:pl-8 2xl:pl-10 pt-0.5 sm:pt-1 lg:pt-0 ${isLight ? "lg:border-zinc-200" : "lg:border-zinc-600"}`}>
            <span className={`flex-shrink-0 text-[10px] sm:text-xs uppercase tracking-wider font-semibold ${isLight ? "text-blue-600" : "text-blue-400"}`}>{puzzle.category}</span>
            <span className={`text-sm sm:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl font-semibold leading-snug min-w-0 ${isLight ? "text-zinc-800" : "text-zinc-100"}`}>{puzzle.question}</span>
          </div>
        )}
        {/* Submit / Next on the right - in bar on mobile, hidden in panel on desktop */}
        {puzzle && (
          <div className="flex-shrink-0 lg:hidden ml-auto">
            {!showAnswer ? (
              <button onClick={submitGuess} disabled={!guess}
                className={`rounded-xl px-4 py-2.5 min-h-[44px] text-sm font-semibold touch-manipulation whitespace-nowrap ${guess ? `${primaryBtn} shadow-lg shadow-blue-500/25` : isLight ? "bg-zinc-200 text-zinc-400 cursor-not-allowed" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}>
                {submitLabel}
              </button>
            ) : (
              <button onClick={newGame} className={`rounded-xl px-4 py-2.5 min-h-[44px] text-sm font-semibold touch-manipulation whitespace-nowrap ${primaryBtn} shadow-lg shadow-blue-500/25`}>
                Next
              </button>
            )}
          </div>
        )}
      </div>

      {/* Full-screen map */}
      <div className="absolute inset-0 z-0">
        <WorldMap
          guess={guess}
          onGuess={setGuess}
          actualLocation={puzzle && showAnswer ? { lat: puzzle.lat, lng: puzzle.lng } : null}
          showAnswer={showAnswer}
          isLight={isLight}
          fullScreen
        />
      </div>

      {/* Side panel - at bottom on mobile (drag handle to resize); right side from lg, resizable width on desktop */}
      <div
        className={`whereious-panel-safe whereious-panel-mobile whereious-panel-dynamic-width absolute z-10 bottom-0 left-0 right-0 lg:right-0 lg:top-0 lg:bottom-0 lg:left-auto flex flex-col ${
          isLight ? "bg-white/[0.97]" : "bg-[#0c1118]/[0.97]"
        } backdrop-blur-xl ${
          isLight ? "lg:border-l border-zinc-200/80" : "lg:border-l border-white/5"
        } shadow-[-8px_0_40px_rgba(0,0,0,0.3)] lg:max-h-full min-h-0`}
        style={{ ['--whereious-panel-dvh']: panelHeightPct }}
      >
        {/* Draggable handle - desktop: drag left edge to resize panel width (lg only) */}
        <div
          className="hidden lg:flex absolute left-0 top-0 bottom-0 w-2 -translate-x-1/2 cursor-ew-resize touch-none select-none z-10 items-center justify-center group"
          onMouseDown={() => { panelWidthDragRef.current = true; }}
          aria-label="Resize panel"
        >
          <div className={`w-1 h-12 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isLight ? "bg-zinc-400" : "bg-white/40"}`} />
        </div>
        {/* Draggable handle - mobile only: drag up/down to resize panel */}
        <div
          className="flex items-center justify-center py-2 lg:hidden border-b cursor-ns-resize touch-none select-none active:opacity-80"
          style={{ borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}
          onTouchStart={(e) => { e.preventDefault(); handlePanelDragStart(); }}
          onMouseDown={() => handlePanelDragStart()}
        >
          <div className={`w-12 h-1 rounded-full ${isLight ? "bg-zinc-300" : "bg-white/30"}`} aria-hidden />
        </div>
        <div className="whereious-panel-scroll whereious-panel-inner flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-5 pb-4 pt-3 sm:pt-4 lg:pt-5 overscroll-contain">

          {/* Streak + Best - compact on mobile */}
          <div className="flex items-center gap-4 sm:gap-6 lg:gap-8 mb-2 sm:mb-4">
            <div className="text-center flex-1 min-w-0">
              <div className={`text-[9px] sm:text-[10px] lg:text-[11px] uppercase tracking-[0.12em] font-medium ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>Streak</div>
              <div className={`text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-none tabular-nums ${isLight ? "text-amber-600" : "text-amber-400"}`}>{streak}</div>
            </div>
            <div className="text-center flex-1 min-w-0">
              <div className={`text-[9px] sm:text-[10px] lg:text-[11px] uppercase tracking-[0.12em] font-medium ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>Best</div>
              <div className={`text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-none tabular-nums ${isLight ? "text-amber-600" : "text-amber-400"}`}>{bestStreak}</div>
            </div>
          </div>

          {/* Averages (Played is in Settings) */}
          <div className={`rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 ${isLight ? "bg-zinc-100/80" : "bg-white/5"}`}>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 sm:gap-x-6 gap-y-1.5 sm:gap-y-2">
              {[
                ["avg10", distanceAverages.avg10],
                ["avg20", distanceAverages.avg20],
                ["avg50", distanceAverages.avg50],
                ["avg100", distanceAverages.avg100],
              ].map(([label, val]) => (
                <div key={label}>
                  <span className={`text-xs font-semibold ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>{label}</span>
                  <span className={`ml-2 font-bold tabular-nums ${isLight ? "text-zinc-800" : "text-zinc-200"}`}>{val != null ? `${val.toLocaleString()} km` : "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons - touch-friendly on mobile */}
          <div className="grid grid-cols-3 gap-2 sm:gap-2 mb-4">
            <button onClick={() => setShowHowTo(true)} className={`rounded-xl py-3 sm:py-2.5 min-h-[44px] sm:min-h-0 ${ghostBtn} text-xs font-semibold touch-manipulation`}>How To Play</button>
            <button onClick={() => setShowSettings(true)} className={`rounded-xl py-3 sm:py-2.5 min-h-[44px] sm:min-h-0 ${ghostBtn} text-xs font-semibold touch-manipulation`}>Settings</button>
            <button onClick={newGame} className={`rounded-xl py-3 sm:py-2.5 min-h-[44px] sm:min-h-0 ${primaryBtn} text-xs font-semibold touch-manipulation`}>New Question</button>
          </div>

          {/* Category selector - grid on all screen sizes */}
          <div className="mb-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-1.5">
              {categories.map((cat) => (
                <div key={cat} onClick={() => toggleCategory(cat)}
                  className={`${selectedCats.includes(cat) ? pillSelected : pillUnselected} rounded-lg px-2 py-3 sm:py-2 text-[11px] sm:text-[11px] font-semibold cursor-pointer text-center transition-all touch-manipulation min-h-[52px] sm:min-h-0 flex flex-col justify-center`}>
                  <div className="truncate capitalize">{cat}</div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setGridCategory(cat); }}
                    className={`mt-1 w-full inline-flex justify-center rounded-full px-1.5 py-0.5 text-[9px] ${isLight ? "bg-black/10 hover:bg-black/15" : "bg-white/10 hover:bg-white/15"}`}>
                    {solvedPerCategory[cat]}/{categoryTotals[cat]}
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setSelectedCats(categories)} className={`flex-1 rounded-lg py-3 sm:py-2 min-h-[44px] sm:min-h-0 ${ghostBtn} font-semibold text-xs touch-manipulation`}>All</button>
              <button onClick={() => setSelectedCats([])} className={`flex-1 rounded-lg py-3 sm:py-2 min-h-[44px] sm:min-h-0 ${ghostBtn} font-semibold text-xs touch-manipulation`}>Clear</button>
            </div>
          </div>

          <div className={`h-px mb-4 ${isLight ? "bg-zinc-200/70" : "bg-white/5"}`} />

          {/* Question */}
          {!puzzle ? (
            <div className="py-6 text-center">
              <div className="text-4xl mb-3">{"\uD83C\uDF0D"}</div>
              {selectedCats.length === 0 ? (
                <>
                  <div className={`text-lg font-bold ${isLight ? "text-amber-700" : "text-amber-400"}`}>No categories selected</div>
                  <div className={`text-sm mt-1 max-w-xs mx-auto ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>Tap at least one category above (Tech, History, Science, etc.) to start playing.</div>
                </>
              ) : (
                <>
                  <div className={`text-lg font-bold ${isLight ? "text-zinc-700" : "text-zinc-200"}`}>Select categories</div>
                  <div className={`text-sm mt-1 ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>Choose above to start exploring.</div>
                </>
              )}
            </div>
          ) : (
            <>
              <AnimatePresence>
                {showAnswer && (
                  <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`mb-4 rounded-2xl overflow-hidden ${isLight ? "border border-zinc-200" : "border border-white/5"}`}>
                    <div className={`p-4 ${lastScore >= 4000 ? (isLight ? "bg-emerald-50" : "bg-emerald-950/30") : lastScore >= 2000 ? (isLight ? "bg-amber-50" : "bg-amber-950/30") : (isLight ? "bg-red-50" : "bg-red-950/30")}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`text-xs font-medium ${isLight ? "text-zinc-500" : "text-zinc-400"}`}>Distance</div>
                          <div className={`text-xl font-extrabold tabular-nums ${isLight ? "text-zinc-900" : "text-zinc-100"}`}>{lastDistance.toLocaleString()} km</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xs font-medium ${isLight ? "text-zinc-500" : "text-zinc-400"}`}>Score</div>
                          <div className={`text-xl font-extrabold tabular-nums ${lastScore >= 4000 ? (isLight ? "text-emerald-700" : "text-emerald-400") : lastScore >= 2000 ? (isLight ? "text-amber-700" : "text-amber-400") : (isLight ? "text-red-700" : "text-red-400")}`}>+{lastScore.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                    <div className={`px-4 py-4 ${isLight ? "bg-zinc-50 border-t border-zinc-200" : "bg-zinc-900/50 border-t border-white/5"}`}>
                      <div className={`text-base leading-relaxed ${isLight ? "text-zinc-800" : "text-zinc-200"}`}>
                        <strong className={`block mb-1 ${isLight ? "text-zinc-900" : "text-white"}`}>{puzzle.answer}</strong>
                        <span className={isLight ? "text-zinc-700" : "text-zinc-300"}>{puzzle.info}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit / Next - in panel on desktop; mobile uses top bar */}
              <div className="hidden lg:block">
                {!showAnswer ? (
                  <button onClick={submitGuess} disabled={!guess}
                    className={`w-full rounded-xl py-3 min-h-[48px] text-sm font-semibold transition-all touch-manipulation ${guess ? `${primaryBtn} shadow-lg shadow-blue-500/25` : isLight ? "bg-zinc-200 text-zinc-400 cursor-not-allowed" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}>
                    {submitLabel}
                  </button>
                ) : (
                  <button onClick={newGame} className={`w-full rounded-xl py-3 min-h-[48px] ${primaryBtn} text-sm font-semibold shadow-lg shadow-blue-500/25 touch-manipulation`}>
                    Next Question {"\u2192"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* How To Play */}
      {showHowTo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-3 sm:p-4 z-50">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className={`w-full max-w-md max-h-[88dvh] flex flex-col rounded-2xl shadow-2xl ${isLight ? "bg-white text-zinc-900" : "bg-[#14181f] text-zinc-100 border border-blue-500/10"}`}>
            <div className="flex items-center justify-between p-4 sm:p-6 pb-0 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{"\uD83C\uDF0D"}</span>
                <h2 className="text-xl font-bold">How to Play</h2>
              </div>
              <button onClick={() => setShowHowTo(false)} className={`px-2.5 py-1.5 rounded-lg text-sm touch-manipulation ${isLight ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-700" : "bg-white/10 hover:bg-white/15 text-zinc-300"}`}>{"\u2715"}</button>
            </div>
            <div className="space-y-4 p-4 sm:p-6 overflow-y-auto overscroll-contain">
              {[
                ["1", "Select your categories: tap the category buttons (Tech, History, Science, etc.) to choose which topics you want. Selected ones stay highlighted. Use \"All\" to enable every category or \"Clear\" to deselect all, then tap the categories you want."],
                ["2", "Read the question and figure out where in the world the event happened."],
                ["3", "Click on the map to place your pin. Click again to move it."],
                ["4", "Hit Submit Guess to see how close you were."],
                ["5", "Earn up to 5,000 points \u2014 the closer your guess, the higher the score!"],
              ].map(([num, text]) => (
                <div key={num} className="flex gap-3 items-start">
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${isLight ? "bg-blue-100 text-blue-600" : "bg-blue-500/20 text-blue-400"}`}>{num}</div>
                  <p className={`text-sm pt-1 ${isLight ? "text-zinc-600" : "text-zinc-300"}`}>{text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Settings */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className={`w-full max-w-md max-h-[88dvh] flex flex-col rounded-2xl shadow-2xl ${isLight ? "bg-white text-zinc-900" : "bg-[#14181f] text-zinc-100 border border-white/5"}`}>
            <div className="flex items-center justify-between p-4 sm:p-6 pb-0 flex-shrink-0">
              <h2 className="text-xl font-bold">Settings</h2>
              <button onClick={() => setShowSettings(false)} className={`rounded-lg px-2.5 py-1.5 text-sm touch-manipulation ${isLight ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200" : "bg-white/10 text-zinc-300 hover:bg-white/15"}`}>{"\u2715"}</button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0">

            <div className={`mb-5 rounded-xl p-4 ${isLight ? "bg-zinc-50" : "bg-zinc-800/50"}`}>
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-50 mb-3">Statistics</div>
              <div className="grid grid-cols-3 gap-4 text-center mb-4">
                <div>
                  <div className="text-2xl font-extrabold text-amber-500">{streak}</div>
                  <div className="text-[10px] opacity-50 uppercase">Streak</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-amber-500">{bestStreak}</div>
                  <div className="text-[10px] opacity-50 uppercase">Best</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold">{gamesPlayed}</div>
                  <div className="text-[10px] opacity-50 uppercase">Played</div>
                </div>
              </div>
              <div className={`flex gap-1 p-1 rounded-lg mb-4 ${isLight ? "bg-zinc-200" : "bg-zinc-700/50"}`}>
                <button type="button" onClick={() => setStatsTab("questions")} className={`flex-1 min-w-0 rounded-md py-2 px-1 text-xs font-semibold transition-all truncate ${statsTab === "questions" ? (isLight ? "bg-white text-zinc-900 shadow" : "bg-zinc-600 text-white") : (isLight ? "text-zinc-600 hover:bg-zinc-100" : "text-zinc-400 hover:bg-zinc-700")}`}>
                  Questions
                </button>
                <button type="button" onClick={() => setStatsTab("points")} className={`flex-1 min-w-0 rounded-md py-2 px-1 text-xs font-semibold transition-all truncate ${statsTab === "points" ? (isLight ? "bg-white text-zinc-900 shadow" : "bg-zinc-600 text-white") : (isLight ? "text-zinc-600 hover:bg-zinc-100" : "text-zinc-400 hover:bg-zinc-700")}`}>
                  Points
                </button>
              </div>
              {statsTab === "questions" ? (
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-xs font-medium shrink-0">All</span>
                    <div className={`flex-1 h-5 rounded overflow-hidden ${isLight ? "bg-zinc-200" : "bg-zinc-700"}`}>
                      <div className={`h-full rounded ${isLight ? "bg-blue-500" : "bg-blue-500"}`} style={{ width: `${WEVENTS.length ? Math.min(100, (Object.keys(solvedQuestions).length / WEVENTS.length) * 100) : 0}%`, minWidth: Object.keys(solvedQuestions).length > 0 ? "4px" : 0 }} />
                    </div>
                    <span className="text-xs font-semibold tabular-nums w-16 text-right shrink-0">{Object.keys(solvedQuestions).length}/{WEVENTS.length}</span>
                  </div>
                  {categories.map((cat) => {
                    const count = solvedPerCategory[cat] || 0;
                    const total = categoryTotals[cat] || 1;
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={cat} className="flex items-center gap-2">
                        <span className="w-20 text-xs font-medium capitalize truncate shrink-0">{cat}</span>
                        <div className={`flex-1 h-5 rounded overflow-hidden ${isLight ? "bg-zinc-200" : "bg-zinc-700"}`} title={`${count} / ${total}`}>
                          <div className={`h-full rounded ${isLight ? "bg-blue-500" : "bg-blue-500"}`} style={{ width: `${pct}%`, minWidth: count > 0 ? "4px" : 0 }} />
                        </div>
                        <span className="text-xs font-semibold tabular-nums w-16 text-right shrink-0">{count}/{total}</span>
                      </div>
                    );
                  })}
                </div>
              ) : statsTab === "points" ? (
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-xs font-medium shrink-0">All</span>
                    <div className={`flex-1 h-5 rounded overflow-hidden ${isLight ? "bg-zinc-200" : "bg-zinc-700"}`}>
                      <div className="h-full rounded bg-emerald-500" style={{ width: `${WEVENTS.length ? Math.min(100, (totalPointsAndDistance.totalPoints / (5000 * WEVENTS.length)) * 100) : 0}%`, minWidth: totalPointsAndDistance.totalPoints > 0 ? "4px" : 0 }} />
                    </div>
                    <span className="text-xs font-semibold tabular-nums w-16 text-right shrink-0">{totalPointsAndDistance.totalPoints.toLocaleString()}</span>
                  </div>
                  {categories.map((cat) => {
                    const MAX_POINTS_PER_CAT = 5000 * 30;
                    const p = pointsAndDistanceByCategory[cat]?.points ?? 0;
                    const pct = Math.min(100, (p / MAX_POINTS_PER_CAT) * 100);
                    return (
                      <div key={cat} className="flex items-center gap-2">
                        <span className="w-20 text-xs font-medium capitalize truncate shrink-0">{cat}</span>
                        <div className={`flex-1 h-5 rounded overflow-hidden ${isLight ? "bg-zinc-200" : "bg-zinc-700"}`}>
                          <div className="h-full rounded bg-emerald-500" style={{ width: `${pct}%`, minWidth: p > 0 ? "4px" : 0 }} />
                        </div>
                        <span className="text-xs font-semibold tabular-nums w-16 text-right shrink-0">{p.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {totalPointsAndDistance.minDistance != null && (
                <div className="text-[10px] opacity-70 mb-2">Min distance (best single guess): <span className="font-bold tabular-nums">{totalPointsAndDistance.minDistance.toLocaleString()} km</span></div>
              )}
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-50 mb-2">Average distance (last N games, km)</div>
              <div className="flex flex-wrap gap-4">
                {[["avg10", distanceAverages.avg10], ["avg20", distanceAverages.avg20], ["avg50", distanceAverages.avg50], ["avg100", distanceAverages.avg100]].map(([label, val]) => (
                  <div key={label}>
                    <span className="text-[10px] opacity-50">{label}</span>
                    <span className="ml-2 font-bold tabular-nums">{val != null ? `${val.toLocaleString()} km` : "—"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`mb-5 rounded-xl p-4 ${isLight ? "bg-zinc-50" : "bg-zinc-800/50"}`}>
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-50 mb-3">Theme</div>
              <div className="flex gap-2">
                <button onClick={() => setTheme("light")} className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-all ${theme === "light" ? "border-blue-500 bg-blue-500 text-white" : isLight ? "border-zinc-200 bg-white text-zinc-700" : "border-zinc-700 bg-zinc-800 text-zinc-300"}`}>Light</button>
                <button onClick={() => setTheme("dark")} className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-all ${theme === "dark" ? "border-blue-500 bg-blue-500 text-white" : isLight ? "border-zinc-200 bg-white text-zinc-700" : "border-zinc-700 bg-zinc-800 text-zinc-300"}`}>Dark</button>
              </div>
            </div>

            <button onClick={() => { setStreak(0); setBestStreak(0); setGamesPlayed(0); setRecentDistances([]); setSolvedQuestions({}); try { localStorage.removeItem("whereious_streak"); localStorage.removeItem("whereious_bestStreak"); localStorage.removeItem("whereious_gamesPlayed"); localStorage.removeItem("whereious_recentDistances"); localStorage.removeItem("whereious_solved"); } catch {} }}
              className="w-full rounded-xl py-3 text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-all touch-manipulation">
              Reset All Stats
            </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Category Grid */}
      {gridCategory && (
        <WhereiousGridModal category={gridCategory} events={categoryEvents[gridCategory] || []} solvedData={solvedQuestions} onClose={() => setGridCategory(null)} onPick={chooseSpecificEvent} theme={theme} />
      )}

      {/* First-timer tutorial */}
      {showTutorial && <WhereiousTutorial onClose={dismissTutorial} theme={theme} />}
    </div>
  );
}

// ===================== Home Screen =====================
function HomeScreen({ onSelectGame, theme }) {
  const isLight = theme === "light";
  const bgClass = isLight 
    ? "bg-gradient-to-br from-slate-50 to-zinc-100" 
    : "bg-gradient-to-br from-[#0a0a0a] to-[#141414]";
  
  const games = [
    {
      id: "yearious",
      name: "Yearious",
      description: "Guess the year of historical events",
      icon: "📅",
      gradient: isLight 
        ? "from-emerald-400 to-teal-500" 
        : "from-emerald-600 to-teal-700",
      shadowColor: "rgba(16, 185, 129, 0.3)"
    },
    {
      id: "whereious",
      name: "Whereious",
      description: "Guess where historical events happened",
      icon: "🌍",
      gradient: isLight 
        ? "from-blue-400 to-sky-500" 
        : "from-blue-600 to-sky-700",
      shadowColor: "rgba(59, 130, 246, 0.3)"
    }
  ];

  return (
    <div className={`min-h-screen ${bgClass} flex flex-col items-center justify-center p-4 sm:p-6`}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 sm:mb-12"
      >
        <h1 className={`text-5xl sm:text-7xl font-black tracking-tight mb-2 ${isLight ? "text-zinc-900" : "text-white"}`}>
          Yearious
        </h1>
        <p className={`text-lg sm:text-xl ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>
          Choose your game
        </p>
      </motion.div>

      {/* Game Cards */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {games.map((game, index) => (
          <motion.button
            key={game.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => !game.disabled && onSelectGame(game.id)}
            disabled={game.disabled}
            className={`group relative overflow-hidden rounded-3xl p-6 sm:p-8 text-left transition-all duration-300 ${
              game.disabled 
                ? "opacity-50 cursor-not-allowed" 
                : "hover:scale-[1.02] hover:shadow-2xl cursor-pointer"
            }`}
            style={{ 
              boxShadow: game.disabled ? "none" : `0 20px 60px ${game.shadowColor}`,
            }}
          >
            {/* Gradient Background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${game.gradient} opacity-90`} />
            {/* Content */}
            <div className="relative z-10">
              <div className="text-5xl sm:text-6xl mb-4">{game.icon}</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                {game.name}
              </h2>
              <p className="text-white/80 text-sm sm:text-base">
                {game.description}
              </p>
              
              {!game.disabled && (
                <div className="mt-6 flex items-center gap-2 text-white font-semibold">
                  <span>Play Now</span>
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              )}
              
              {game.disabled && (
                <div className="mt-6 inline-block px-3 py-1 bg-white/20 rounded-full text-white text-sm font-medium">
                  Coming Soon
                </div>
              )}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Footer */}
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className={`mt-8 sm:mt-12 text-sm ${isLight ? "text-zinc-500" : "text-zinc-500"}`}
      >
        Learn something new!
      </motion.p>
    </div>
  );
}

// ===================== Main App with Navigation =====================
export default function App() {
  const [currentView, setCurrentView] = useState("home");
  const [theme, setTheme] = useState(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("yg_theme") || "dark" : "dark";
    return saved === "auto" ? "dark" : saved;
  });
  const resolvedTheme = theme;

  if (currentView === "home") {
    return (
      <HomeScreen 
        onSelectGame={(gameId) => setCurrentView(gameId)} 
        theme={resolvedTheme}
      />
    );
  }

  if (currentView === "yearious") {
    return <Yearious onBack={() => setCurrentView("home")} />;
  }

  if (currentView === "whereious") {
    return <Whereious onBack={() => setCurrentView("home")} />;
  }

  // Fallback to home
  return <HomeScreen onSelectGame={(gameId) => setCurrentView(gameId)} theme={resolvedTheme} />;
}


