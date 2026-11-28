import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  RotateCcw,
  BookmarkPlus,
  LineChart,
  Copy,
  Check,
  ArrowRight,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
  Compass,
  Layers,
  Table as TableIcon,
  Cpu,
  Loader2,
} from 'lucide-react';
import {
  evaluateExpression,
  solveQuadratic,
  convertBase,
  decomposeFloat32,
  formatNaturalPreview,
  compute1VarStats,
  generateValueTable,
  solveLinear2x2,
  solveLinear3x3,
  type AngleMode,
  type OutputFormat,
  type Stats1VarResult,
  type TableRow,
} from '../engine/mathEngine';
import { useCloudSync } from '../context/CloudSyncContext';

interface HistoryEntry {
  id: string;
  expr: string;
  result: string;
  numericValue: number | null;
}

export type CalcesMode = 'COMP' | 'CMPLX' | 'STAT' | 'BASE-N' | 'EQN' | 'MATRIX' | 'TABLE' | 'VECTOR';

interface CalculatorViewProps {
  onSendToGraph: (expr: string) => void;
  externalExpr?: string;
}

const SCIENTIFIC_CONSTANTS = [
  { symbol: 'c', name: 'Speed of light', value: '299792458', unit: 'm/s' },
  { symbol: 'h', name: 'Planck constant', value: '6.62607015e-34', unit: 'J·s' },
  { symbol: 'G', name: 'Gravitational constant', value: '6.67430e-11', unit: 'm³/kg·s²' },
  { symbol: 'e_q', name: 'Elementary charge', value: '1.60217663e-19', unit: 'C' },
  { symbol: 'N_A', name: 'Avogadro number', value: '6.02214076e23', unit: 'mol⁻¹' },
  { symbol: 'k_B', name: 'Boltzmann constant', value: '1.380649e-23', unit: 'J/K' },
  { symbol: 'R', name: 'Ideal gas constant', value: '8.3144626', unit: 'J/mol·K' },
  { symbol: 'g_0', name: 'Standard gravity', value: '9.80665', unit: 'm/s²' },
];

export function CalculatorView({ onSendToGraph, externalExpr }: CalculatorViewProps) {
  const { formulas, saveFormula, isLoadingFormulas, isSavingFormula, syncError, clearSyncError } = useCloudSync();

  // Core expression & cursor state
  const [expr, setExpr] = useState(externalExpr || 'sin(pi/4)^2 + cos(pi/4)^2');
  const [cursorPos, setCursorPos] = useState<number>(expr.length);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Calces states: Mode, Shift, Alpha, STO/RCL
  const [calcesMode, setCalcesMode] = useState<CalcesMode>('COMP');
  const [shiftActive, setShiftActive] = useState(false);
  const [alphaActive, setAlphaActive] = useState(false);
  const [stoActive, setStoActive] = useState(false);
  const [rclActive, setRclActive] = useState(false);
  const [hypActive, setHypActive] = useState(false);

  // Setup / Mode Modal Dialogs
  const [modeModalOpen, setModeModalOpen] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [hypModalOpen, setHypModalOpen] = useState(false);
  const [tapeDrawerOpen, setTapeDrawerOpen] = useState(false);

  // Calculator Settings
  const [angleMode, setAngleMode] = useState<AngleMode>('rad');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('auto');
  const [ans, setAns] = useState<number>(1);
  const [memoryM, setMemoryM] = useState<number>(0);
  const [variables, setVariables] = useState<Record<string, number>>({
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    F: 0,
    X: 0,
    Y: 0,
    M: 0,
  });

  // History & Notification
  const [history, setHistory] = useState<HistoryEntry[]>([
    { id: 'h1', expr: 'det([[3, 1], [2, 4]])', result: '10', numericValue: 10 },
    { id: 'h2', expr: 'integral(x^2, 0, 3)', result: '9', numericValue: 9 },
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [copied, setCopied] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Dedicated Mode States
  // STAT mode
  const [statInput, setStatInput] = useState('12, 15, 18, 22, 25, 30, 34');
  const [statResult, setStatResult] = useState<Stats1VarResult | null>(null);

  // TABLE mode
  const [tableExpr, setTableExpr] = useState('x^2 - 3*x + 2');
  const [tableStart, setTableStart] = useState(-3);
  const [tableEnd, setTableEnd] = useState(3);
  const [tableStep, setTableStep] = useState(1);
  const [tableRows, setTableRows] = useState<TableRow[]>([]);

  // EQN mode
  const [eqnType, setEqnType] = useState<'quad' | 'sim2' | 'sim3'>('quad');
  const [quadA, setQuadA] = useState('1');
  const [quadB, setQuadB] = useState('-5');
  const [quadC, setQuadC] = useState('6');
  const [sim2Params, setSim2Params] = useState({ a1: '2', b1: '1', c1: '5', a2: '1', b2: '-1', c2: '1' });

  // BASE-N mode
  const [baseInput, setBaseInput] = useState('255');
  const [baseFrom, setBaseFrom] = useState<2 | 8 | 10 | 16>(10);
  const [floatInput, setFloatInput] = useState('-6.5');

  // Gesture tracking for touch display
  const gestureStartRef = useRef<{ x: number; y: number } | null>(null);

  // Keep variables in sync with M
  useEffect(() => {
    setVariables((prev) => ({ ...prev, M: memoryM }));
  }, [memoryM]);

  // Live evaluation
  const liveEval = evaluateExpression(expr, angleMode, outputFormat, ans, variables);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 2000);
  };

  // Cursor-aware token insertion
  const insertToken = useCallback(
    (token: string) => {
      setExpr((prev) => {
        const left = prev.slice(0, cursorPos);
        const right = prev.slice(cursorPos);
        return left + token + right;
      });
      setCursorPos((prev) => prev + token.length);
      setShiftActive(false);
      setAlphaActive(false);
      setHypActive(false);
    },
    [cursorPos]
  );

  const handleBackspace = useCallback(() => {
    if (cursorPos === 0 || expr.length === 0) return;
    setExpr((prev) => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos));
    setCursorPos((prev) => Math.max(0, prev - 1));
  }, [cursorPos, expr.length]);

  const handleAllClear = useCallback(() => {
    setExpr('');
    setCursorPos(0);
    setShiftActive(false);
    setAlphaActive(false);
    setStoActive(false);
    setRclActive(false);
  }, []);

  const moveCursor = useCallback(
    (direction: 'left' | 'right') => {
      setCursorPos((prev) => {
        if (direction === 'left') return Math.max(0, prev - 1);
        return Math.min(expr.length, prev + 1);
      });
    },
    [expr.length]
  );

  const navigateHistory = useCallback(
    (direction: 'up' | 'down') => {
      if (history.length === 0) return;
      if (direction === 'up') {
        const nextIdx = Math.min(history.length - 1, historyIndex + 1);
        setHistoryIndex(nextIdx);
        setExpr(history[nextIdx].expr);
        setCursorPos(history[nextIdx].expr.length);
      } else {
        const nextIdx = Math.max(-1, historyIndex - 1);
        setHistoryIndex(nextIdx);
        if (nextIdx === -1) {
          setExpr('');
          setCursorPos(0);
        } else {
          setExpr(history[nextIdx].expr);
          setCursorPos(history[nextIdx].expr.length);
        }
      }
    },
    [history, historyIndex]
  );

  const handleCommit = useCallback(() => {
    if (!expr.trim()) return;
    const res = evaluateExpression(expr, angleMode, outputFormat, ans, variables);
    if (res.ok) {
      if (res.numericValue !== null) setAns(res.numericValue);
      setHistory((prev) => [
        {
          id: `hist_${Date.now()}`,
          expr,
          result: res.formatted,
          numericValue: res.numericValue,
        },
        ...prev.slice(0, 30),
      ]);
      setHistoryIndex(-1);
    }
  }, [expr, angleMode, outputFormat, ans, variables]);

  // Handle variable memory storage (STO) or recall (RCL)
  const handleVariableKey = useCallback(
    (varName: string) => {
      if (stoActive) {
        const val = liveEval.numericValue ?? ans;
        setVariables((prev) => ({ ...prev, [varName]: val }));
        if (varName === 'M') setMemoryM(val);
        setStoActive(false);
        showStatus(`Ans → ${varName} (${val})`);
        return true;
      }
      if (rclActive) {
        const val = variables[varName] ?? 0;
        insertToken(String(val));
        setRclActive(false);
        showStatus(`RCL ${varName} = ${val}`);
        return true;
      }
      if (alphaActive) {
        insertToken(varName);
        setAlphaActive(false);
        return true;
      }
      return false;
    },
    [stoActive, rclActive, alphaActive, liveEval.numericValue, ans, variables, insertToken]
  );

  // Toggle S<=>D Fraction to Decimal standard
  const toggleStandardDecimal = useCallback(() => {
    if (outputFormat === 'fraction') setOutputFormat('decimal');
    else if (outputFormat === 'decimal') setOutputFormat('fraction');
    else setOutputFormat('fraction');
  }, [outputFormat]);

  // Mode button handler
  const handleModePress = () => {
    if (shiftActive) {
      setShiftActive(false);
      setSetupModalOpen(true);
    } else {
      setModeModalOpen(true);
    }
  };

  // Synchronize cursor selection with real input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.setSelectionRange(cursorPos, cursorPos);
    }
  }, [cursorPos]);

  // Execute Stat
  const handleRunStat = () => {
    const nums = statInput
      .split(/[,;\s]+/)
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isFinite(x));
    const res = compute1VarStats(nums);
    setStatResult(res);
  };

  // Execute Table
  const handleRunTable = () => {
    const rows = generateValueTable(tableExpr, tableStart, tableEnd, tableStep, angleMode);
    setTableRows(rows);
  };

  // Render scientific key
  const renderKey = (
    normalLabel: string,
    normalToken: string | (() => void),
    shiftLabel?: string,
    shiftToken?: string | (() => void),
    alphaLabel?: string,
    alphaToken?: string | (() => void),
    extraClass?: string
  ) => {
    const isShifted = shiftActive && shiftLabel;
    const isAlpha = alphaActive && alphaLabel;

    const handleClick = () => {
      // Check if alpha variable was clicked
      if (alphaLabel && ['A', 'B', 'C', 'D', 'E', 'F', 'X', 'Y', 'M'].includes(alphaLabel)) {
        if (handleVariableKey(alphaLabel)) return;
      }

      if (isShifted) {
        if (typeof shiftToken === 'function') shiftToken();
        else if (shiftToken) insertToken(shiftToken);
        setShiftActive(false);
      } else if (isAlpha) {
        if (typeof alphaToken === 'function') alphaToken();
        else if (alphaToken) insertToken(alphaToken);
        setAlphaActive(false);
      } else {
        if (typeof normalToken === 'function') normalToken();
        else if (normalToken) insertToken(normalToken);
      }
    };

    return (
      <button
        type="button"
        onClick={handleClick}
        className={`relative flex flex-col items-center justify-center p-1 rounded-lg border transition-all active:scale-[0.96] select-none min-h-[46px] md:min-h-[50px] ${
          extraClass || 'bg-[#121824] hover:bg-[#1A2333] border-[#1F2B3E] text-slate-100'
        }`}
      >
        {/* Top Shift (amber) and Alpha (magenta) legends */}
        <div className="w-full flex justify-between px-1 text-[10px] leading-none mb-0.5 pointer-events-none">
          <span
            className={`font-mono truncate ${
              isShifted ? 'text-amber-300 font-bold scale-110' : 'text-amber-500/80'
            }`}
          >
            {shiftLabel || ''}
          </span>
          <span
            className={`font-mono truncate ${
              isAlpha ? 'text-pink-300 font-bold scale-110' : 'text-pink-500/80'
            }`}
          >
            {alphaLabel || ''}
          </span>
        </div>
        {/* Primary Face Legend */}
        <span
          className={`font-mono text-xs md:text-sm leading-tight ${
            isShifted ? 'text-amber-300' : isAlpha ? 'text-pink-300' : 'text-white'
          }`}
        >
          {isShifted ? shiftLabel : isAlpha ? alphaLabel : normalLabel}
        </span>
      </button>
    );
  };

  const quadSol = solveQuadratic(Number(quadA) || 0, Number(quadB) || 0, Number(quadC) || 0);
  const sim2Sol = solveLinear2x2(
    Number(sim2Params.a1) || 0,
    Number(sim2Params.b1) || 0,
    Number(sim2Params.c1) || 0,
    Number(sim2Params.a2) || 0,
    Number(sim2Params.b2) || 0,
    Number(sim2Params.c2) || 0
  );
  const baseConverted = convertBase(baseInput, baseFrom);
  const f32 = decomposeFloat32(Number(floatInput) || 0);

  return (
    <div className="h-full flex flex-col lg:flex-row gap-3 p-2 md:p-4 max-w-[1440px] mx-auto w-full overflow-y-auto lg:overflow-hidden">
      {/* Primary Calces Scientific Chassis */}
      <div className="flex-1 flex flex-col gap-2.5 min-w-0">
        {/* Calces Natural Textbook LCD Display */}
        <section
          aria-label="Calces Natural Display"
          onPointerDown={(e) => {
            gestureStartRef.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            if (!gestureStartRef.current) return;
            const dx = e.clientX - gestureStartRef.current.x;
            const dy = e.clientY - gestureStartRef.current.y;
            gestureStartRef.current = null;
            if (dx < -48 && Math.abs(dy) < 40) handleBackspace();
            else if (dy > 48 && Math.abs(dx) < 50) setTapeDrawerOpen((v) => !v);
          }}
          className="bg-[#0C111A] border-2 border-[#1E293B] rounded-2xl p-3 md:p-4 flex flex-col gap-2 shadow-inner"
        >
          {/* Top Calces Status Indicators Bar */}
          <div className="flex items-center justify-between text-[11px] font-mono border-b border-[#182333] pb-1.5 px-0.5 select-none">
            <div className="flex items-center gap-2">
              <span
                className={`px-1.5 py-0.2 rounded font-bold transition-colors ${
                  shiftActive ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-700'
                }`}
              >
                S
              </span>
              <span
                className={`px-1.5 py-0.2 rounded font-bold transition-colors ${
                  alphaActive ? 'bg-pink-500 text-slate-950 shadow-sm' : 'text-slate-700'
                }`}
              >
                A
              </span>
              <span
                className={`px-1.5 py-0.2 rounded font-bold transition-colors ${
                  memoryM !== 0 ? 'bg-cyan-500 text-slate-950' : 'text-slate-700'
                }`}
              >
                M
              </span>
              <span
                className={`px-1 py-0.2 rounded text-[10px] ${
                  stoActive ? 'bg-amber-400 text-slate-950 font-bold' : rclActive ? 'bg-cyan-400 text-slate-950 font-bold' : 'hidden'
                }`}
              >
                {stoActive ? 'STO' : 'RCL'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-cyan-400 font-bold">[{calcesMode}]</span>
              <button
                type="button"
                onClick={() => setAngleMode((m) => (m === 'deg' ? 'rad' : m === 'rad' ? 'grad' : 'deg'))}
                className="hover:text-cyan-300 font-bold text-slate-400 uppercase"
              >
                [{angleMode}]
              </button>
              <span className="text-slate-500">Math▲</span>
            </div>
          </div>

          {/* Natural Formula Preview */}
          <div className="text-xs font-mono text-slate-400 min-h-[18px] truncate px-1">
            {formatNaturalPreview(expr) || '0'}
          </div>

          {/* Interactive Math Expression Line with Cursor */}
          <div className="flex items-center gap-2 px-1">
            <label htmlFor="calces-expr-input" className="sr-only">
              Mathematical expression
            </label>
            <input
              ref={inputRef}
              id="calces-expr-input"
              type="text"
              value={expr}
              onChange={(e) => {
                setExpr(e.target.value);
                setCursorPos(e.target.selectionStart || e.target.value.length);
              }}
              onClick={(e) => {
                setCursorPos((e.target as HTMLInputElement).selectionStart || 0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommit();
              }}
              placeholder="0"
              className="w-full bg-transparent text-2xl md:text-3xl font-mono text-white tracking-wide focus:outline-none"
            />
          </div>

          {/* Live Result & Quick S<=>D conversion */}
          <div className="pt-2 border-t border-[#182333] flex items-baseline justify-between gap-3 px-1">
            <div className="text-xs font-mono text-slate-400 truncate">
              {statusMessage || liveEval.secondary || 'Ans = ' + ans}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={toggleStandardDecimal}
                title="S<=>D Standard to Decimal fraction toggle"
                className="px-2 py-1 text-xs font-mono rounded bg-[#162130] text-cyan-300 hover:bg-[#1E2C40] border border-[#23334A]"
              >
                S⇔D
              </button>
              <button
                type="button"
                onClick={() => {
                  if (liveEval.formatted) {
                    navigator.clipboard?.writeText(liveEval.formatted).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  }
                }}
                className="flex items-center gap-1.5 text-right font-mono"
              >
                <span className="text-2xl md:text-3xl font-semibold text-cyan-300 tabular-nums">
                  {liveEval.formatted || '0'}
                </span>
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-600 hover:text-slate-300" />}
              </button>
            </div>
          </div>
        </section>

        {/* Calces Mode Specific View or Default Scientific Keypad */}
        {calcesMode === 'COMP' && (
          <div className="flex flex-col gap-2">
            {/* Top Function / Navigation Bar: SHIFT, ALPHA, REPLAY D-PAD, MODE, ON */}
            <div className="grid grid-cols-12 gap-1.5 items-center">
              {/* SHIFT Button (Amber) */}
              <button
                type="button"
                onClick={() => {
                  setShiftActive((v) => {
                    const next = !v;
                    if (next) setAlphaActive(false);
                    return next;
                  });
                }}
                className={`col-span-2 min-h-[44px] rounded-xl font-mono text-xs font-bold transition-all border ${
                  shiftActive
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md'
                    : 'bg-[#181F2C] hover:bg-[#20293A] text-amber-400 border-amber-500/40'
                }`}
              >
                SHIFT
              </button>

              {/* ALPHA Button (Pink/Magenta) */}
              <button
                type="button"
                onClick={() => {
                  setAlphaActive((v) => {
                    const next = !v;
                    if (next) setShiftActive(false);
                    return next;
                  });
                }}
                className={`col-span-2 min-h-[44px] rounded-xl font-mono text-xs font-bold transition-all border ${
                  alphaActive
                    ? 'bg-pink-500 text-slate-950 border-pink-400 shadow-md'
                    : 'bg-[#181F2C] hover:bg-[#20293A] text-pink-400 border-pink-500/40'
                }`}
              >
                ALPHA
              </button>

              {/* REPLAY Directional D-Pad Wheel */}
              <div className="col-span-4 bg-[#0F1622] border border-[#212E42] rounded-xl p-1 grid grid-cols-3 gap-0.5 items-center justify-items-center">
                <div />
                <button
                  type="button"
                  aria-label="History Up"
                  onClick={() => navigateHistory('up')}
                  className="p-1 hover:text-cyan-300 text-slate-400"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <div />
                <button
                  type="button"
                  aria-label="Cursor Left"
                  onClick={() => moveCursor('left')}
                  className="p-1 hover:text-cyan-300 text-slate-400"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[9px] font-mono font-bold text-slate-500">REPLAY</span>
                <button
                  type="button"
                  aria-label="Cursor Right"
                  onClick={() => moveCursor('right')}
                  className="p-1 hover:text-cyan-300 text-slate-400"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div />
                <button
                  type="button"
                  aria-label="History Down"
                  onClick={() => navigateHistory('down')}
                  className="p-1 hover:text-cyan-300 text-slate-400"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <div />
              </div>

              {/* MODE / SETUP Button */}
              <button
                type="button"
                onClick={handleModePress}
                className="col-span-2 min-h-[44px] rounded-xl bg-[#141C29] hover:bg-[#1E293B] border border-[#26354D] text-xs font-mono font-semibold text-slate-200 transition-colors flex flex-col items-center justify-center"
              >
                <span className="text-[9px] text-amber-400 font-bold leading-none">SETUP</span>
                <span>MODE</span>
              </button>

              {/* ON / AC Button */}
              <button
                type="button"
                onClick={handleAllClear}
                className="col-span-2 min-h-[44px] rounded-xl bg-[#1C1824] hover:bg-[#282133] border border-rose-500/40 text-xs font-mono font-bold text-rose-300 transition-colors"
              >
                ON
              </button>
            </div>

            {/* Scientific Function Key Matrix (Row 1-4) */}
            <div className="grid grid-cols-6 gap-1.5">
              {renderKey('CALC', () => handleCommit(), 'SOLVE', 'solve(', '=', '=')}
              {renderKey('∫dx', 'integral(', 'd/dx', 'd/dx(', ':', ':')}
              {renderKey('x⁻¹', '^(-1)', 'x!', 'fact(', 'A', () => handleVariableKey('A'))}
              {renderKey('log_b', 'logBase(', '∑(', 'sum(', 'B', () => handleVariableKey('B'))}
              {renderKey('■/□', '/', 'a b/c', '/', 'C', () => handleVariableKey('C'))}
              {renderKey('√■', 'sqrt(', '³√', 'cbrt(', 'D', () => handleVariableKey('D'))}

              {renderKey('x²', '^2', 'x³', '^3', 'E', () => handleVariableKey('E'))}
              {renderKey('x^■', '^', 'x√■', '^(1/', 'F', () => handleVariableKey('F'))}
              {renderKey('log', 'log10(', '10^x', '10^(', 'X', () => handleVariableKey('X'))}
              {renderKey('ln', 'ln(', 'e^x', 'exp(', 'Y', () => handleVariableKey('Y'))}
              {renderKey('(-)', '-', 'Fact', 'fact(', 'M', () => handleVariableKey('M'))}
              {renderKey('° \' "', ' deg', '←', ' rad', '∠', '∠')}

              {renderKey('hyp', () => setHypModalOpen(true), 'tanh⁻¹', 'atanh(', 'sinh', 'sinh(')}
              {renderKey('sin', 'sin(', 'sin⁻¹', 'asin(', 'D', () => handleVariableKey('D'))}
              {renderKey('cos', 'cos(', 'cos⁻¹', 'acos(', 'E', () => handleVariableKey('E'))}
              {renderKey('tan', 'tan(', 'tan⁻¹', 'atan(', 'F', () => handleVariableKey('F'))}
              {renderKey(
                'STO',
                () => {
                  setStoActive((v) => !v);
                  setRclActive(false);
                },
                'RCL',
                () => {
                  setRclActive((v) => !v);
                  setStoActive(false);
                },
                'CONST',
                () => insertToken('299792458')
              )}
              {renderKey('ENG', () => setOutputFormat('engineering'), '←', ' rad', 'i', 'i')}

              {renderKey('(', '(', 'Pol(', 'Pol(', 'X', () => handleVariableKey('X'))}
              {renderKey(')', ')', 'Rec(', 'Rec(', 'Y', () => handleVariableKey('Y'))}
              {renderKey('S⇔D', toggleStandardDecimal, 'a/b', toggleStandardDecimal, '≈', '≈')}
              {renderKey(
                'M+',
                () => {
                  const val = liveEval.numericValue ?? ans;
                  setMemoryM((m) => m + val);
                  showStatus(`M+ (${val}) → M = ${memoryM + val}`);
                },
                'M-',
                () => {
                  const val = liveEval.numericValue ?? ans;
                  setMemoryM((m) => m - val);
                  showStatus(`M- (${val}) → M = ${memoryM - val}`);
                },
                'M',
                () => handleVariableKey('M')
              )}
              {renderKey('DEL', handleBackspace, 'INS', () => {}, '', undefined, 'bg-[#22161A] text-rose-300 border-rose-900/50')}
              {renderKey('AC', handleAllClear, 'OFF', handleAllClear, '', undefined, 'bg-[#29171C] text-rose-300 border-rose-800/60 font-bold')}
            </div>

            {/* Numeric & Classic Operator Key Matrix (Rows 5-8) */}
            <div className="grid grid-cols-5 gap-1.5 pt-1">
              {renderKey('7', '7', 'CONST', '299792458', '', undefined, 'bg-[#101722] text-white font-bold text-base')}
              {renderKey('8', '8', 'CONV', () => {}, '', undefined, 'bg-[#101722] text-white font-bold text-base')}
              {renderKey('9', '9', 'RESET', handleAllClear, '', undefined, 'bg-[#101722] text-white font-bold text-base')}
              {renderKey('DEL', handleBackspace, 'INS', () => {}, '', undefined, 'bg-[#24171E] text-rose-300')}
              {renderKey('AC', handleAllClear, 'OFF', handleAllClear, '', undefined, 'bg-[#2B171E] text-rose-300 font-bold')}

              {renderKey('4', '4', 'MATRIX', () => setCalcesMode('MATRIX'), 'A', () => handleVariableKey('A'), 'bg-[#101722] text-white font-bold text-base')}
              {renderKey('5', '5', 'VECTOR', () => setCalcesMode('VECTOR'), 'B', () => handleVariableKey('B'), 'bg-[#101722] text-white font-bold text-base')}
              {renderKey('6', '6', 'STAT', () => setCalcesMode('STAT'), 'C', () => handleVariableKey('C'), 'bg-[#101722] text-white font-bold text-base')}
              {renderKey('×', '*', 'nPr', 'nPr(', 'GCD', 'gcd(', 'bg-[#162030] text-cyan-300 font-bold text-lg')}
              {renderKey('÷', '/', 'nCr', 'nCr(', 'LCM', 'lcm(', 'bg-[#162030] text-cyan-300 font-bold text-lg')}

              {renderKey('1', '1', 'STAT', () => setCalcesMode('STAT'), '', undefined, 'bg-[#101722] text-white font-bold text-base')}
              {renderKey('2', '2', 'CMPLX', () => setCalcesMode('CMPLX'), '', undefined, 'bg-[#101722] text-white font-bold text-base')}
              {renderKey('3', '3', 'BASE-N', () => setCalcesMode('BASE-N'), '', undefined, 'bg-[#101722] text-white font-bold text-base')}
              {renderKey('+', '+', 'Pol(', 'Pol(', 'mod', 'mod(', 'bg-[#162030] text-cyan-300 font-bold text-lg')}
              {renderKey('−', '-', 'Rec(', 'Rec(', 'abs', 'abs(', 'bg-[#162030] text-cyan-300 font-bold text-lg')}

              {renderKey('0', '0', 'Rnd', 'round(', '', undefined, 'bg-[#101722] text-white font-bold text-base')}
              {renderKey('.', '.', 'Ran#', 'Ran()', 'RanInt', 'RanInt(1, 10)', 'bg-[#101722] text-white font-bold text-base')}
              {renderKey('×10^x', '*10^', 'π', 'pi', 'e', 'e', 'bg-[#101722] text-cyan-300 font-semibold')}
              {renderKey('Ans', 'ans', 'PreAns', 'ans', '%', '%', 'bg-[#142030] text-cyan-300 font-bold')}
              {renderKey('=', handleCommit, '≈', handleCommit, 'SOLVE', handleCommit, 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xl border-cyan-400')}
            </div>
          </div>
        )}

        {/* Dedicated Calces Modes */}
        {calcesMode === 'STAT' && (
          <div className="bg-[#10151E] border border-[#1E2736] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">1-Variable Statistics Analyzer</h3>
              <button
                type="button"
                onClick={() => setCalcesMode('COMP')}
                className="text-xs text-cyan-400 hover:underline"
              >
                Back to COMP
              </button>
            </div>
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Data Values (comma separated)</span>
              <input
                type="text"
                value={statInput}
                onChange={(e) => setStatInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#090C11] border border-[#1E2736] font-mono text-sm text-white"
              />
            </label>
            <button
              type="button"
              onClick={handleRunStat}
              className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-xs font-semibold"
            >
              Compute Statistics
            </button>
            {statResult && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs pt-2 border-t border-[#1E2736]">
                <div className="bg-[#090C11] p-2 rounded border border-[#1E2736]">
                  <span className="text-slate-400">Sample Size n: </span>
                  <span className="text-cyan-300">{statResult.n}</span>
                </div>
                <div className="bg-[#090C11] p-2 rounded border border-[#1E2736]">
                  <span className="text-slate-400">Mean x̄: </span>
                  <span className="text-amber-300">{statResult.mean}</span>
                </div>
                <div className="bg-[#090C11] p-2 rounded border border-[#1E2736]">
                  <span className="text-slate-400">Std Dev σx: </span>
                  <span className="text-emerald-300">{statResult.sigma}</span>
                </div>
                <div className="bg-[#090C11] p-2 rounded border border-[#1E2736]">
                  <span className="text-slate-400">Sample s: </span>
                  <span className="text-cyan-300">{statResult.s}</span>
                </div>
                <div className="bg-[#090C11] p-2 rounded border border-[#1E2736]">
                  <span className="text-slate-400">Sum Σx: </span>
                  <span className="text-white">{statResult.sum}</span>
                </div>
                <div className="bg-[#090C11] p-2 rounded border border-[#1E2736]">
                  <span className="text-slate-400">Min / Max: </span>
                  <span className="text-white">{statResult.min} / {statResult.max}</span>
                </div>
                <div className="bg-[#090C11] p-2 rounded border border-[#1E2736]">
                  <span className="text-slate-400">Median Q2: </span>
                  <span className="text-cyan-300">{statResult.med}</span>
                </div>
                <div className="bg-[#090C11] p-2 rounded border border-[#1E2736]">
                  <span className="text-slate-400">IQR (Q3 - Q1): </span>
                  <span className="text-white">{(statResult.q3 - statResult.q1).toFixed(4)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {calcesMode === 'TABLE' && (
          <div className="bg-[#10151E] border border-[#1E2736] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Table Generator f(x)</h3>
              <button
                type="button"
                onClick={() => setCalcesMode('COMP')}
                className="text-xs text-cyan-400 hover:underline"
              >
                Back to COMP
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <label className="sm:col-span-2 space-y-1">
                <span className="text-slate-400">f(x) Expression</span>
                <input
                  type="text"
                  value={tableExpr}
                  onChange={(e) => setTableExpr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#090C11] border border-[#1E2736] font-mono text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">Start / End</span>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={tableStart}
                    onChange={(e) => setTableStart(Number(e.target.value))}
                    className="w-1/2 px-2 py-2 rounded bg-[#090C11] border border-[#1E2736] font-mono text-white"
                  />
                  <input
                    type="number"
                    value={tableEnd}
                    onChange={(e) => setTableEnd(Number(e.target.value))}
                    className="w-1/2 px-2 py-2 rounded bg-[#090C11] border border-[#1E2736] font-mono text-white"
                  />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">Step</span>
                <input
                  type="number"
                  step="0.5"
                  value={tableStep}
                  onChange={(e) => setTableStep(Number(e.target.value))}
                  className="w-full px-2 py-2 rounded bg-[#090C11] border border-[#1E2736] font-mono text-white"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRunTable}
                className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-xs font-semibold"
              >
                Generate Table
              </button>
              <button
                type="button"
                onClick={() => onSendToGraph(tableExpr)}
                className="px-4 py-2 rounded-lg bg-[#161E2B] text-slate-200 border border-[#263245] text-xs font-medium"
              >
                Send to Graph
              </button>
            </div>
            {tableRows.length > 0 && (
              <div className="max-h-[220px] overflow-y-auto border border-[#1E2736] rounded-lg">
                <table className="w-full text-xs font-mono text-center">
                  <thead className="bg-[#090C11] text-slate-400 border-b border-[#1E2736]">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">x</th>
                      <th className="py-2 px-3 text-cyan-300">f(x)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r, idx) => (
                      <tr key={idx} className="border-b border-[#161E2B] last:border-none">
                        <td className="py-1 px-3 text-slate-500">{idx + 1}</td>
                        <td className="py-1 px-3 text-white">{r.x}</td>
                        <td className="py-1 px-3 text-cyan-300 font-semibold">{r.y !== null ? r.y : r.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {calcesMode === 'EQN' && (
          <div className="bg-[#10151E] border border-[#1E2736] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Equation Solver</h3>
              <button
                type="button"
                onClick={() => setCalcesMode('COMP')}
                className="text-xs text-cyan-400 hover:underline"
              >
                Back to COMP
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEqnType('quad')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono ${
                  eqnType === 'quad' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-[#090C11] text-slate-400'
                }`}
              >
                ax² + bx + c = 0
              </button>
              <button
                type="button"
                onClick={() => setEqnType('sim2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono ${
                  eqnType === 'sim2' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-[#090C11] text-slate-400'
                }`}
              >
                2-Unknowns Linear
              </button>
            </div>
            {eqnType === 'quad' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { lbl: 'a', val: quadA, set: setQuadA },
                    { lbl: 'b', val: quadB, set: setQuadB },
                    { lbl: 'c', val: quadC, set: setQuadC },
                  ].map(({ lbl, val, set }) => (
                    <label key={lbl} className="space-y-1">
                      <span className="text-slate-400 font-mono">Coeff {lbl}</span>
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-[#090C11] border border-[#1E2736] font-mono text-white"
                      />
                    </label>
                  ))}
                </div>
                <div className="bg-[#090C11] p-3 rounded-lg border border-[#1E2736] font-mono text-xs grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400">Roots: </span>
                    <span className="text-cyan-300 font-bold">{quadSol.roots.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Vertex: </span>
                    <span className="text-amber-300">({quadSol.vertex[0].toFixed(3)}, {quadSol.vertex[1].toFixed(3)})</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-400 font-mono">
                  a₁X + b₁Y = c₁ <br />
                  a₂X + b₂Y = c₂
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  {Object.entries(sim2Params).map(([k, v]) => (
                    <label key={k} className="space-y-1">
                      <span className="text-slate-400 uppercase">{k}</span>
                      <input
                        type="number"
                        value={v}
                        onChange={(e) => setSim2Params((prev) => ({ ...prev, [k]: e.target.value }))}
                        className="w-full px-2 py-1.5 rounded bg-[#090C11] border border-[#1E2736] font-mono text-white"
                      />
                    </label>
                  ))}
                </div>
                <div className="bg-[#090C11] p-3 rounded border border-[#1E2736] font-mono text-xs">
                  <span className="text-slate-400">Solution: </span>
                  <span className="text-cyan-300 font-bold">
                    {typeof sim2Sol === 'string' ? sim2Sol : `X = ${sim2Sol.x}, Y = ${sim2Sol.y}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {calcesMode === 'BASE-N' && (
          <div className="bg-[#10151E] border border-[#1E2736] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Base-N Programmer</h3>
              <button
                type="button"
                onClick={() => setCalcesMode('COMP')}
                className="text-xs text-cyan-400 hover:underline"
              >
                Back to COMP
              </button>
            </div>
            <div className="flex gap-2">
              {([10, 16, 2, 8] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBaseFrom(b)}
                  className={`px-3 py-1 rounded text-xs font-mono font-bold ${
                    baseFrom === b ? 'bg-cyan-500 text-slate-950' : 'bg-[#090C11] text-slate-400'
                  }`}
                >
                  {b === 10 ? 'DEC' : b === 16 ? 'HEX' : b === 2 ? 'BIN' : 'OCT'}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={baseInput}
              onChange={(e) => setBaseInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#090C11] border border-[#1E2736] font-mono text-sm text-white"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              <div className="bg-[#090C11] p-2.5 rounded border border-[#1E2736]">
                <div className="text-slate-400">HEX</div>
                <div className="text-cyan-300 font-bold text-sm mt-0.5">{baseConverted.hex}</div>
              </div>
              <div className="bg-[#090C11] p-2.5 rounded border border-[#1E2736]">
                <div className="text-slate-400">DEC</div>
                <div className="text-white font-bold text-sm mt-0.5">{baseConverted.dec}</div>
              </div>
              <div className="bg-[#090C11] p-2.5 rounded border border-[#1E2736]">
                <div className="text-slate-400">OCT</div>
                <div className="text-amber-300 font-bold text-sm mt-0.5">{baseConverted.oct}</div>
              </div>
              <div className="bg-[#090C11] p-2.5 rounded border border-[#1E2736]">
                <div className="text-slate-400">BIN</div>
                <div className="text-emerald-300 font-bold text-sm mt-0.5 break-all">{baseConverted.bin}</div>
              </div>
            </div>
          </div>
        )}

        {(calcesMode === 'CMPLX' || calcesMode === 'MATRIX' || calcesMode === 'VECTOR') && (
          <div className="bg-[#10151E] border border-[#1E2736] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {calcesMode === 'CMPLX' ? 'Complex Number Arithmetic' : calcesMode === 'MATRIX' ? 'Matrix Calculator' : 'Vector Operations'}
              </h3>
              <button
                type="button"
                onClick={() => setCalcesMode('COMP')}
                className="text-xs text-cyan-400 hover:underline"
              >
                Back to COMP
              </button>
            </div>
            <p className="text-xs text-slate-400">
              {calcesMode === 'CMPLX'
                ? 'Type complex numbers using i (e.g. 3 + 4i or 5 ∠ 45°). Try: (2+3i)*(4-i), abs(3+4i), or arg(1+i).'
                : calcesMode === 'MATRIX'
                ? 'Matrices are evaluated directly using natural brackets. Try: det([[1, 2], [3, 4]]), inv([[1, 2], [3, 4]]), or [[1, 2], [3, 4]] * [[5], [6]].'
                : 'Vector dot and cross products: dot([1, 2, 3], [4, 5, 6]), cross([1, 0, 0], [0, 1, 0]), or norm([3, 4]).'}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {calcesMode === 'CMPLX' && (
                <>
                  <button
                    type="button"
                    onClick={() => insertToken('(3 + 4i) * (2 - i)')}
                    className="px-3 py-1.5 rounded bg-[#162030] text-cyan-300 text-xs font-mono"
                  >
                    (3+4i)*(2-i)
                  </button>
                  <button
                    type="button"
                    onClick={() => insertToken('5 ∠ 45 deg')}
                    className="px-3 py-1.5 rounded bg-[#162030] text-cyan-300 text-xs font-mono"
                  >
                    5 ∠ 45° Polar
                  </button>
                </>
              )}
              {calcesMode === 'MATRIX' && (
                <>
                  <button
                    type="button"
                    onClick={() => insertToken('det([[3, 1], [2, 4]])')}
                    className="px-3 py-1.5 rounded bg-[#162030] text-cyan-300 text-xs font-mono"
                  >
                    det([[3, 1], [2, 4]])
                  </button>
                  <button
                    type="button"
                    onClick={() => insertToken('inv([[1, 2], [3, 4]])')}
                    className="px-3 py-1.5 rounded bg-[#162030] text-cyan-300 text-xs font-mono"
                  >
                    inv(2x2)
                  </button>
                </>
              )}
              {calcesMode === 'VECTOR' && (
                <>
                  <button
                    type="button"
                    onClick={() => insertToken('cross([1, 0, 0], [0, 1, 0])')}
                    className="px-3 py-1.5 rounded bg-[#162030] text-cyan-300 text-xs font-mono"
                  >
                    cross(i, j)
                  </button>
                  <button
                    type="button"
                    onClick={() => insertToken('dot([1, 2, 3], [4, 5, 6])')}
                    className="px-3 py-1.5 rounded bg-[#162030] text-cyan-300 text-xs font-mono"
                  >
                    dot(u, v)
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Side Panel: Calculation Tape & Saved Formulas */}
      <aside
        className={`lg:w-[320px] shrink-0 bg-[#10151E] border border-[#1E2736] rounded-xl p-4 flex-col gap-4 overflow-y-auto ${
          tapeDrawerOpen ? 'flex' : 'hidden lg:flex'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Calculation Tape</h2>
          <button
            type="button"
            onClick={() => setHistory([])}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Clear
          </button>
        </div>

        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {history.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No calculations in tape yet.</p>
          ) : (
            history.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  setExpr(h.expr);
                  setCursorPos(h.expr.length);
                }}
                className="w-full text-left p-2.5 rounded-lg bg-[#090C11] hover:bg-[#151C28] border border-[#1E2736] transition-colors"
              >
                <div className="font-mono text-xs text-slate-400 truncate">{h.expr}</div>
                <div className="font-mono text-sm text-cyan-300 mt-0.5 text-right tabular-nums">= {h.result}</div>
              </button>
            ))
          )}
        </div>

        <div className="pt-3 border-t border-[#1E2736] space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Cloud Synced Formulas</h2>
            <button
              type="button"
              disabled={isSavingFormula || !expr.trim()}
              onClick={async () => {
                if (expr.trim() && !isSavingFormula) {
                  try {
                    await saveFormula({
                      expression: expr,
                      label: expr.slice(0, 32),
                      mode: 'calc',
                      color: '#22D3EE',
                    });
                    setSavedNotice(true);
                    setTimeout(() => setSavedNotice(false), 1400);
                  } catch {
                    // Handled by context
                  }
                }
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 btn-tactile disabled:opacity-50"
            >
              {isSavingFormula ? (
                <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
              ) : savedNotice ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <BookmarkPlus className="w-3 h-3 text-amber-400" />
              )}
              {isSavingFormula ? 'Saving...' : savedNotice ? 'Saved' : 'Save Current'}
            </button>
          </div>

          {/* Sync Error State Notice */}
          {syncError && (
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-[11px] text-amber-300">
              <span className="truncate pr-1">{syncError}</span>
              <button
                type="button"
                aria-label="Dismiss error"
                onClick={clearSyncError}
                className="text-amber-400 hover:text-amber-200 shrink-0"
              >
                ✕
              </button>
            </div>
          )}

          {/* 1. Loading State */}
          {isLoadingFormulas && (
            <div className="space-y-1.5 py-1">
              {[1, 2].map((n) => (
                <div key={n} className="animate-pulse p-2 rounded bg-[#090C11] border border-[#1E2736] space-y-1">
                  <div className="h-3 bg-[#1C2638] rounded w-2/3" />
                  <div className="h-2.5 bg-[#141C2B] rounded w-4/5" />
                </div>
              ))}
            </div>
          )}

          {/* 2. Empty State */}
          {!isLoadingFormulas && formulas.length === 0 && (
            <div className="p-3 text-center rounded bg-[#090C11] border border-[#1E2736] text-[11px] text-slate-500">
              No synced formulas stored yet. Tap Save Current to bookmark.
            </div>
          )}

          {/* 3 & 4. Success State */}
          {!isLoadingFormulas && formulas.length > 0 && (
            <div className="space-y-1.5">
              {formulas.slice(0, 5).map((f) => (
                <div
                  key={f.id}
                  className="p-2 rounded bg-[#090C11] border border-[#1E2736] flex items-center justify-between gap-2 hover:border-[#2D3A50] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpr(f.expression);
                      setCursorPos(f.expression.length);
                    }}
                    className="text-left min-w-0 flex-1"
                  >
                    <div className="text-xs text-slate-200 truncate">{f.label}</div>
                    <div className="text-[11px] font-mono text-slate-400 truncate">{f.expression}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendToGraph(f.expression)}
                    title="Send to Graph"
                    aria-label={`Send formula ${f.label} to Graph`}
                    className="p-1.5 text-slate-400 hover:text-cyan-300 transition-colors"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Calces MODE Selector Modal */}
      {modeModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0E141F] border border-[#182232] rounded-2xl p-4 sm:p-5 w-full max-w-sm max-w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto space-y-4 shadow-2xl specular-card">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                Calces Mode Selection
              </h3>
              <button
                type="button"
                aria-label="Close mode selection"
                onClick={() => setModeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white btn-tactile rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {(
                [
                  ['COMP', '1: COMP (General)'],
                  ['CMPLX', '2: CMPLX (Complex)'],
                  ['STAT', '3: STAT (Statistics)'],
                  ['BASE-N', '4: BASE-N (Binary/Hex)'],
                  ['EQN', '5: EQN (Equations)'],
                  ['MATRIX', '6: MATRIX (Matrices)'],
                  ['TABLE', '7: TABLE (Table of f(x))'],
                  ['VECTOR', '8: VECTOR (Vectors)'],
                ] as const
              ).map(([mId, label]) => (
                <button
                  key={mId}
                  type="button"
                  onClick={() => {
                    setCalcesMode(mId);
                    setModeModalOpen(false);
                  }}
                  className={`p-3 rounded-xl border text-left transition-colors btn-tactile ${
                    calcesMode === mId
                      ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                      : 'bg-[#05070B] hover:bg-[#151D2A] border-[#182232] text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Calces SETUP Modal (Shift + Mode) */}
      {setupModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0E141F] border border-[#182232] rounded-2xl p-4 sm:p-5 w-full max-w-sm max-w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto space-y-4 shadow-2xl specular-card">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-400" />
                Calces SETUP
              </h3>
              <button
                type="button"
                aria-label="Close setup modal"
                onClick={() => setSetupModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white btn-tactile rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block mb-1">Angle Unit</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['deg', 'rad', 'grad'] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAngleMode(a)}
                      className={`p-2 rounded-lg font-mono uppercase btn-tactile ${
                        angleMode === a ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-[#05070B] border border-[#182232] text-slate-300'
                      }`}
                    >
                      {a === 'deg' ? 'Degree (°)' : a === 'rad' ? 'Radian' : 'Gradian'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block mb-1">Result Format</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['auto', 'fraction', 'decimal', 'engineering'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setOutputFormat(fmt)}
                      className={`p-2 rounded-lg font-mono capitalize btn-tactile ${
                        outputFormat === fmt ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-[#05070B] border border-[#182232] text-slate-300'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calces Hyperbolic Functions Modal */}
      {hypModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0E141F] border border-[#182232] rounded-2xl p-4 sm:p-5 w-full max-w-sm max-w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto space-y-4 shadow-2xl specular-card">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Hyperbolic Functions (hyp)</h3>
              <button
                type="button"
                aria-label="Close hyperbolic functions"
                onClick={() => setHypModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white btn-tactile rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              {[
                ['sinh', 'sinh('],
                ['cosh', 'cosh('],
                ['tanh', 'tanh('],
                ['sinh⁻¹', 'asinh('],
                ['cosh⁻¹', 'acosh('],
                ['tanh⁻¹', 'atanh('],
              ].map(([lbl, fn]) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => {
                    insertToken(fn);
                    setHypModalOpen(false);
                  }}
                  className="p-3 rounded-xl bg-[#05070B] hover:bg-[#182333] border border-[#182232] text-cyan-300 font-bold text-center btn-tactile"
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
