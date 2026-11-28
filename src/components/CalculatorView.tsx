import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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

  // Debounced expression for live evaluation (keeps typing at 60fps)
  const [debouncedExpr, setDebouncedExpr] = useState(expr);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedExpr(expr), 90);
    return () => clearTimeout(t);
  }, [expr]);
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

  // Live evaluation (debounced to avoid re-parsing on every keystroke)
  const liveEval = useMemo(
    () => evaluateExpression(debouncedExpr, angleMode, outputFormat, ans, variables),
    [debouncedExpr, angleMode, outputFormat, ans, variables]
  );

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
        const val = evaluateExpression(expr, angleMode, outputFormat, ans, variables).numericValue ?? ans;
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
        data-armed={isShifted || isAlpha ? 'true' : undefined}
        aria-label={isShifted ? shiftLabel : isAlpha ? alphaLabel : normalLabel}
        className={`key ${extraClass || 'key-fn'} ${
          isShifted ? 'key-armed-amber' : isAlpha ? 'key-armed-violet' : ''
        }`}
      >
        <span className="key-legend key-legend-left">{shiftLabel || ''}</span>
        <span className="key-legend key-legend-right">{alphaLabel || ''}</span>
        <span className="key-face">{isShifted ? shiftLabel : isAlpha ? alphaLabel : normalLabel}</span>
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
    <div className="mx-auto flex h-full w-full max-w-[1640px] flex-col gap-3 overflow-y-auto p-3 lg:flex-row lg:overflow-hidden lg:p-5">
      {/* ---------------------------- Calculator ---------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:overflow-y-auto lg:pr-0.5">
        {/* Readout */}
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
          className="panel panel-raised sticky top-0 z-10 shrink-0 overflow-hidden lg:static"
        >
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[#23262E] px-3.5 py-2">
            <button
              type="button"
              onClick={() => setModeModalOpen(true)}
              className="chip chip-accent transition-colors hover:brightness-110"
            >
              {calcesMode}
            </button>
            <button
              type="button"
              onClick={() => setAngleMode((m) => (m === 'deg' ? 'rad' : m === 'rad' ? 'grad' : 'deg'))}
              title="Cycle angle unit"
              className="chip transition-colors hover:border-[#3B404B] hover:text-white"
            >
              {angleMode.toUpperCase()}
            </button>
            <button
              type="button"
              onClick={() => setSetupModalOpen(true)}
              className="chip transition-colors hover:border-[#3B404B] hover:text-white"
            >
              Math
            </button>

            <div className="ml-auto flex items-center gap-1">
              {[
                { key: 'S', on: shiftActive, tone: 'data-[on=true]:bg-[#E0A44B] data-[on=true]:text-black' },
                { key: 'A', on: alphaActive, tone: 'data-[on=true]:bg-[#A99CF5] data-[on=true]:text-black' },
                { key: 'M', on: memoryM !== 0, tone: 'data-[on=true]:bg-[#4C8DFF] data-[on=true]:text-white' },
              ].map((flag) => (
                <span
                  key={flag.key}
                  data-on={flag.on}
                  className={`grid h-[18px] w-[18px] place-items-center rounded-[5px] border border-[#2A2E37] font-mono text-[9px] font-semibold text-[#5D626C] ${flag.tone}`}
                >
                  {flag.key}
                </span>
              ))}
              {(stoActive || rclActive) && (
                <span className="ml-1 rounded-[5px] bg-[#E0A44B]/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#E0A44B]">
                  {stoActive ? 'STO' : 'RCL'}
                </span>
              )}
            </div>
          </div>

          <div className="px-3.5 pb-3 pt-3.5">
            <div className="h-4 truncate font-mono text-[10.5px] leading-4 text-[#6B7079]">
              {formatNaturalPreview(expr) || '0'}
            </div>
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
              spellCheck={false}
              autoComplete="off"
              className="mt-1 w-full bg-transparent font-mono text-[24px] font-medium leading-tight tracking-[-0.02em] text-[#ECEDEF] placeholder:text-[#3B404B] focus:outline-none md:text-[27px]"
            />

            <div className="mt-1.5 flex items-end justify-between gap-3 border-t border-[#23262E] pt-2.5">
              <span className="min-h-[16px] truncate font-mono text-[10.5px] text-[#6B7079]">
                {statusMessage || liveEval.secondary || `Ans = ${ans}`}
              </span>
              <div className="flex shrink-0 items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (liveEval.formatted) {
                      navigator.clipboard?.writeText(liveEval.formatted).catch(() => {});
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1200);
                    }
                  }}
                  title="Copy result"
                  className="group flex items-baseline gap-2"
                >
                  <span className="font-mono text-[18px] text-[#3B404B] md:text-[20px]">=</span>
                  <span className="font-mono text-[26px] font-medium tabular-nums tracking-[-0.03em] text-[#6BA2FF] md:text-[31px]">
                    {liveEval.formatted || '0'}
                  </span>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-[#3FBF8F]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-[#3B404B] transition-colors group-hover:text-[#9EA3AC]" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Keypad */}
        {calcesMode === 'COMP' && (
          <div className="panel shrink-0 p-2.5">
            {/* Controls */}
            <div className="mb-1.5 grid grid-cols-6 gap-1.5">
              <button
                type="button"
                aria-pressed={shiftActive}
                onClick={() => {
                  setShiftActive((v) => {
                    const next = !v;
                    if (next) setAlphaActive(false);
                    return next;
                  });
                }}
                className={`key h-10 min-h-0 ${shiftActive ? 'key-armed-amber' : 'key-fn'}`}
              >
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]">Shift</span>
              </button>
              <button
                type="button"
                aria-pressed={alphaActive}
                onClick={() => {
                  setAlphaActive((v) => {
                    const next = !v;
                    if (next) setShiftActive(false);
                    return next;
                  });
                }}
                className={`key h-10 min-h-0 ${alphaActive ? 'key-armed-violet' : 'key-fn'}`}
              >
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]">Alpha</span>
              </button>

              <div className="col-span-2 grid grid-cols-3 grid-rows-3 place-items-center rounded-[10px] border border-[#262A32] bg-[#0C0E11]">
                <span />
                <button
                  type="button"
                  aria-label="Previous entry"
                  onClick={() => navigateHistory('up')}
                  className="p-0.5 text-[#6B7079] transition-colors hover:text-[#ECEDEF]"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <span />
                <button
                  type="button"
                  aria-label="Cursor left"
                  onClick={() => moveCursor('left')}
                  className="p-0.5 text-[#6B7079] transition-colors hover:text-[#ECEDEF]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="font-mono text-[7.5px] tracking-[0.1em] text-[#5D626C]">REPLAY</span>
                <button
                  type="button"
                  aria-label="Cursor right"
                  onClick={() => moveCursor('right')}
                  className="p-0.5 text-[#6B7079] transition-colors hover:text-[#ECEDEF]"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <span />
                <button
                  type="button"
                  aria-label="Next entry"
                  onClick={() => navigateHistory('down')}
                  className="p-0.5 text-[#6B7079] transition-colors hover:text-[#ECEDEF]"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <span />
              </div>

              <button type="button" onClick={handleModePress} className="key key-fn h-10 min-h-0">
                <span className="key-legend key-legend-left">setup</span>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]">Mode</span>
              </button>
              <button
                type="button"
                onClick={handleAllClear}
                aria-label="Power on / all clear"
                className="key key-danger h-10 min-h-0"
              >
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]">On</span>
              </button>
            </div>

            {/* Scientific functions — one key per function */}
            <div className="grid grid-cols-6 gap-1.5">
              {renderKey('x²', '^2', 'x³', '^3', 'E', () => handleVariableKey('E'))}
              {renderKey('xʸ', '^', 'ʸ√', '^(1/', 'F', () => handleVariableKey('F'))}
              {renderKey('√', 'sqrt(', '∛', 'cbrt(', 'D', () => handleVariableKey('D'))}
              {renderKey('log', 'log10(', '10ˣ', '10^(', 'X', () => handleVariableKey('X'))}
              {renderKey('ln', 'ln(', 'eˣ', 'exp(', 'Y', () => handleVariableKey('Y'))}
              {renderKey('π', 'pi', 'e', 'e')}

              {renderKey('sin', 'sin(', 'sin⁻¹', 'asin(')}
              {renderKey('cos', 'cos(', 'cos⁻¹', 'acos(')}
              {renderKey('tan', 'tan(', 'tan⁻¹', 'atan(')}
              {renderKey('∫dx', 'integral(', 'd/dx', 'd/dx(')}
              {renderKey('Σ', 'sum(', 'logᵦ', 'logBase(', 'B', () => handleVariableKey('B'))}
              {renderKey('hyp', () => setHypModalOpen(true))}

              {renderKey('(', '(', 'Pol(', 'Pol(')}
              {renderKey(')', ')', 'Rec(', 'Rec(')}
              {renderKey('1/x', '^(-1)', 'x!', 'fact(', 'C', () => handleVariableKey('C'))}
              {renderKey('a/b', '/', undefined, undefined, 'A', () => handleVariableKey('A'))}
              {renderKey('S⇔D', toggleStandardDecimal)}
              {renderKey('∠', '∠', '°  ′  ″', ' deg', 'i', 'i')}

              {renderKey('STO', () => {
                setStoActive((v) => !v);
                setRclActive(false);
              })}
              {renderKey('RCL', () => {
                setRclActive((v) => !v);
                setStoActive(false);
              })}
              {renderKey('CONST', () => insertToken('299792458'), '×10ˣ', '*10^')}
              {renderKey(
                'M+',
                () => {
                  const val = evaluateExpression(expr, angleMode, outputFormat, ans, variables).numericValue ?? ans;
                  setMemoryM((m) => m + val);
                  showStatus(`M+ (${val}) → M = ${memoryM + val}`);
                },
                'M−',
                () => {
                  const val = evaluateExpression(expr, angleMode, outputFormat, ans, variables).numericValue ?? ans;
                  setMemoryM((m) => m - val);
                  showStatus(`M− (${val}) → M = ${memoryM - val}`);
                }
              )}
              {renderKey('%', '%', 'ENG', () => setOutputFormat('engineering'))}
              {renderKey('Rnd', 'round(', 'Ran#', 'Ran()', 'RanInt', 'RanInt(1, 10)')}
            </div>

            {/* Numeric block */}
            <div className="mt-1.5 grid grid-cols-6 gap-1.5">
              {renderKey('7', '7', undefined, undefined, undefined, undefined, 'key-fn font-semibold')}
              {renderKey('8', '8', undefined, undefined, undefined, undefined, 'key-fn font-semibold')}
              {renderKey('9', '9', undefined, undefined, undefined, undefined, 'key-fn font-semibold')}
              {renderKey('÷', '/', 'nCr', 'nCr(', 'LCM', 'lcm(', 'key-op')}
              {renderKey('×', '*', 'nPr', 'nPr(', 'GCD', 'gcd(', 'key-op')}
              {renderKey('DEL', handleBackspace, undefined, undefined, undefined, undefined, 'key-danger text-[11px] uppercase tracking-[0.08em]')}

              {renderKey('4', '4', 'MATRIX', () => setCalcesMode('MATRIX'), 'A', () => handleVariableKey('A'), 'key-fn font-semibold')}
              {renderKey('5', '5', 'VECTOR', () => setCalcesMode('VECTOR'), 'B', () => handleVariableKey('B'), 'key-fn font-semibold')}
              {renderKey('6', '6', 'STAT', () => setCalcesMode('STAT'), 'C', () => handleVariableKey('C'), 'key-fn font-semibold')}
              {renderKey('−', '-', undefined, undefined, 'abs', 'abs(', 'key-op')}
              {renderKey('+', '+', undefined, undefined, 'mod', 'mod(', 'key-op')}
              {renderKey('AC', handleAllClear, undefined, undefined, undefined, undefined, 'key-danger text-[11px] uppercase tracking-[0.08em]')}

              {renderKey('1', '1', 'EQN', () => setCalcesMode('EQN'), undefined, undefined, 'key-fn font-semibold')}
              {renderKey('2', '2', 'CMPLX', () => setCalcesMode('CMPLX'), undefined, undefined, 'key-fn font-semibold')}
              {renderKey('3', '3', 'BASE-N', () => setCalcesMode('BASE-N'), undefined, undefined, 'key-fn font-semibold')}
              {renderKey('0', '0', undefined, undefined, undefined, undefined, 'key-fn font-semibold')}
              {renderKey('.', '.', undefined, undefined, undefined, undefined, 'key-fn font-semibold')}
              {renderKey('Ans', 'ans', undefined, undefined, undefined, undefined, 'key-fn text-[12px]')}

              <button
                type="button"
                onClick={handleCommit}
                className="key key-primary col-span-6 h-11 min-h-0"
              >
                <span className="font-mono text-[13px] font-semibold tracking-[0.06em]">=</span>
              </button>
            </div>
          </div>
        )}

        {/* Dedicated Calces Modes */}
        {calcesMode === 'STAT' && (
          <div className="panel p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">1-Variable Statistics Analyzer</h3>
              <button
                type="button"
                onClick={() => setCalcesMode('COMP')}
                className="btn btn-ghost h-8 text-[11.5px]"
              >
                Back to COMP
              </button>
            </div>
            <label className="block space-y-1">
              <span className="text-xs text-zinc-400">Data Values (comma separated)</span>
              <input
                type="text"
                value={statInput}
                onChange={(e) => setStatInput(e.target.value)}
                className="field h-9"
              />
            </label>
            <button
              type="button"
              onClick={handleRunStat}
              className="btn btn-primary h-9"
            >
              Compute Statistics
            </button>
            {statResult && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs pt-2 border-t border-[#24272F]">
                <div className="panel-inset p-2">
                  <span className="text-zinc-400">Sample Size n: </span>
                  <span className="text-[#9CC0FF]">{statResult.n}</span>
                </div>
                <div className="panel-inset p-2">
                  <span className="text-zinc-400">Mean x̄: </span>
                  <span className="text-white">{statResult.mean}</span>
                </div>
                <div className="panel-inset p-2">
                  <span className="text-zinc-400">Std Dev σx: </span>
                  <span className="text-white">{statResult.sigma}</span>
                </div>
                <div className="panel-inset p-2">
                  <span className="text-zinc-400">Sample s: </span>
                  <span className="text-[#9CC0FF]">{statResult.s}</span>
                </div>
                <div className="panel-inset p-2">
                  <span className="text-zinc-400">Sum Σx: </span>
                  <span className="text-white">{statResult.sum}</span>
                </div>
                <div className="panel-inset p-2">
                  <span className="text-zinc-400">Min / Max: </span>
                  <span className="text-white">{statResult.min} / {statResult.max}</span>
                </div>
                <div className="panel-inset p-2">
                  <span className="text-zinc-400">Median Q2: </span>
                  <span className="text-[#9CC0FF]">{statResult.med}</span>
                </div>
                <div className="panel-inset p-2">
                  <span className="text-zinc-400">IQR (Q3 - Q1): </span>
                  <span className="text-white">{(statResult.q3 - statResult.q1).toFixed(4)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {calcesMode === 'TABLE' && (
          <div className="panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Table Generator f(x)</h3>
              <button
                type="button"
                onClick={() => setCalcesMode('COMP')}
                className="btn btn-ghost h-8 text-[11.5px]"
              >
                Back to COMP
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <label className="sm:col-span-2 space-y-1">
                <span className="text-zinc-400">f(x) Expression</span>
                <input
                  type="text"
                  value={tableExpr}
                  onChange={(e) => setTableExpr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0C0E11] border border-[#24272F] font-mono text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-zinc-400">Start / End</span>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={tableStart}
                    onChange={(e) => setTableStart(Number(e.target.value))}
                    className="field h-9 w-1/2"
                  />
                  <input
                    type="number"
                    value={tableEnd}
                    onChange={(e) => setTableEnd(Number(e.target.value))}
                    className="field h-9 w-1/2"
                  />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-zinc-400">Step</span>
                <input
                  type="number"
                  step="0.5"
                  value={tableStep}
                  onChange={(e) => setTableStep(Number(e.target.value))}
                  className="field h-9"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRunTable}
                className="btn btn-primary h-9"
              >
                Generate Table
              </button>
              <button
                type="button"
                onClick={() => onSendToGraph(tableExpr)}
                className="btn h-9"
              >
                Send to Graph
              </button>
            </div>
            {tableRows.length > 0 && (
              <div className="max-h-[220px] overflow-y-auto border border-[#24272F] rounded-lg">
                <table className="w-full text-xs font-mono text-center">
                  <thead className="bg-[#0C0E11] text-zinc-400 border-b border-[#24272F]">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">x</th>
                      <th className="py-2 px-3 text-[#9CC0FF]">f(x)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r, idx) => (
                      <tr key={idx} className="border-b border-[#1A1D24] last:border-none">
                        <td className="py-1 px-3 text-zinc-500">{idx + 1}</td>
                        <td className="py-1 px-3 text-white">{r.x}</td>
                        <td className="py-1 px-3 text-[#9CC0FF] font-semibold">{r.y !== null ? r.y : r.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {calcesMode === 'EQN' && (
          <div className="panel p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Equation Solver</h3>
              <button
                type="button"
                onClick={() => setCalcesMode('COMP')}
                className="btn btn-ghost h-8 text-[11.5px]"
              >
                Back to COMP
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEqnType('quad')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono ${
                  eqnType === 'quad' ? 'bg-[#4C8DFF] text-white font-bold' : 'bg-[#0C0E11] text-zinc-400'
                }`}
              >
                ax² + bx + c = 0
              </button>
              <button
                type="button"
                onClick={() => setEqnType('sim2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono ${
                  eqnType === 'sim2' ? 'bg-[#4C8DFF] text-white font-bold' : 'bg-[#0C0E11] text-zinc-400'
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
                      <span className="text-zinc-400 font-mono">Coeff {lbl}</span>
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        className="field h-9"
                      />
                    </label>
                  ))}
                </div>
                <div className="panel-inset p-3 font-mono text-xs grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-zinc-400">Roots: </span>
                    <span className="text-[#9CC0FF] font-bold">{quadSol.roots.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Vertex: </span>
                    <span className="text-white">({quadSol.vertex[0].toFixed(3)}, {quadSol.vertex[1].toFixed(3)})</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-zinc-400 font-mono">
                  a₁X + b₁Y = c₁ <br />
                  a₂X + b₂Y = c₂
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  {Object.entries(sim2Params).map(([k, v]) => (
                    <label key={k} className="space-y-1">
                      <span className="text-zinc-400 uppercase">{k}</span>
                      <input
                        type="number"
                        value={v}
                        onChange={(e) => setSim2Params((prev) => ({ ...prev, [k]: e.target.value }))}
                        className="field h-8"
                      />
                    </label>
                  ))}
                </div>
                <div className="panel-inset p-3 font-mono text-xs">
                  <span className="text-zinc-400">Solution: </span>
                  <span className="text-[#9CC0FF] font-bold">
                    {typeof sim2Sol === 'string' ? sim2Sol : `X = ${sim2Sol.x}, Y = ${sim2Sol.y}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {calcesMode === 'BASE-N' && (
          <div className="panel p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Base-N Programmer</h3>
              <button
                type="button"
                onClick={() => setCalcesMode('COMP')}
                className="btn btn-ghost h-8 text-[11.5px]"
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
                    baseFrom === b ? 'bg-[#4C8DFF] text-white' : 'bg-[#0C0E11] text-zinc-400'
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
              className="field h-9"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              <div className="panel-inset p-2.5">
                <div className="text-zinc-400">HEX</div>
                <div className="text-[#9CC0FF] font-bold text-sm mt-0.5">{baseConverted.hex}</div>
              </div>
              <div className="panel-inset p-2.5">
                <div className="text-zinc-400">DEC</div>
                <div className="text-white font-bold text-sm mt-0.5">{baseConverted.dec}</div>
              </div>
              <div className="panel-inset p-2.5">
                <div className="text-zinc-400">OCT</div>
                <div className="text-white font-bold text-sm mt-0.5">{baseConverted.oct}</div>
              </div>
              <div className="panel-inset p-2.5">
                <div className="text-zinc-400">BIN</div>
                <div className="text-white font-bold text-sm mt-0.5 break-all">{baseConverted.bin}</div>
              </div>
            </div>
          </div>
        )}

        {(calcesMode === 'CMPLX' || calcesMode === 'MATRIX' || calcesMode === 'VECTOR') && (
          <div className="panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {calcesMode === 'CMPLX' ? 'Complex Number Arithmetic' : calcesMode === 'MATRIX' ? 'Matrix Calculator' : 'Vector Operations'}
              </h3>
              <button
                type="button"
                onClick={() => setCalcesMode('COMP')}
                className="btn btn-ghost h-8 text-[11.5px]"
              >
                Back to COMP
              </button>
            </div>
            <p className="text-xs text-zinc-400">
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
                    className="px-3 py-1.5 rounded bg-[#1A1E26] text-[#9CC0FF] text-xs font-mono"
                  >
                    (3+4i)*(2-i)
                  </button>
                  <button
                    type="button"
                    onClick={() => insertToken('5 ∠ 45 deg')}
                    className="px-3 py-1.5 rounded bg-[#1A1E26] text-[#9CC0FF] text-xs font-mono"
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
                    className="px-3 py-1.5 rounded bg-[#1A1E26] text-[#9CC0FF] text-xs font-mono"
                  >
                    det([[3, 1], [2, 4]])
                  </button>
                  <button
                    type="button"
                    onClick={() => insertToken('inv([[1, 2], [3, 4]])')}
                    className="px-3 py-1.5 rounded bg-[#1A1E26] text-[#9CC0FF] text-xs font-mono"
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
                    className="px-3 py-1.5 rounded bg-[#1A1E26] text-[#9CC0FF] text-xs font-mono"
                  >
                    cross(i, j)
                  </button>
                  <button
                    type="button"
                    onClick={() => insertToken('dot([1, 2, 3], [4, 5, 6])')}
                    className="px-3 py-1.5 rounded bg-[#1A1E26] text-[#9CC0FF] text-xs font-mono"
                  >
                    dot(u, v)
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------ Sidebar ----------------------------- */}
      <aside
        className={`panel shrink-0 flex-col gap-4 overflow-y-auto p-4 lg:w-[300px] ${
          tapeDrawerOpen ? 'flex' : 'hidden lg:flex'
        }`}
      >
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-[12px] font-semibold tracking-[-0.01em] text-[#ECEDEF]">Tape</h2>
            <button
              type="button"
              onClick={() => setHistory([])}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-[#6B7079] transition-colors hover:bg-white/5 hover:text-[#ECEDEF]"
            >
              <RotateCcw className="h-3 w-3" /> Clear
            </button>
          </div>

          <div className="mt-2 max-h-[268px] space-y-1 overflow-y-auto pr-0.5">
            {history.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#2A2E37] py-6 text-center text-[11px] text-[#6B7079]">
                Evaluated expressions appear here.
              </p>
            ) : (
              history.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setExpr(h.expr);
                    setCursorPos(h.expr.length);
                  }}
                  className="group w-full rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-[#2A2E37] hover:bg-white/[0.03]"
                >
                  <div className="truncate font-mono text-[11px] text-[#9EA3AC]">{h.expr}</div>
                  <div className="mt-0.5 text-right font-mono text-[13px] tabular-nums text-[#6BA2FF]">
                    {h.result}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-[#23262E] pt-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[12px] font-semibold tracking-[-0.01em] text-[#ECEDEF]">Saved formulas</h2>
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
                      color: '#4C8DFF',
                    });
                    setSavedNotice(true);
                    setTimeout(() => setSavedNotice(false), 1400);
                  } catch {
                    // Handled by context
                  }
                }
              }}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[#9CC0FF] transition-colors hover:bg-[#4C8DFF]/10 disabled:opacity-40"
            >
              {isSavingFormula ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : savedNotice ? (
                <Check className="h-3 w-3 text-[#3FBF8F]" />
              ) : (
                <BookmarkPlus className="h-3 w-3" />
              )}
              {isSavingFormula ? 'Saving' : savedNotice ? 'Saved' : 'Save'}
            </button>
          </div>

          {syncError && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-[#E0A44B]/30 bg-[#E0A44B]/10 px-2 py-1.5 text-[10.5px] text-[#E0A44B]">
              <span className="truncate">{syncError}</span>
              <button
                type="button"
                aria-label="Dismiss error"
                onClick={clearSyncError}
                className="shrink-0 hover:text-[#F0C286]"
              >
                ✕
              </button>
            </div>
          )}

          {isLoadingFormulas && (
            <div className="mt-2 space-y-1.5">
              {[1, 2].map((n) => (
                <div key={n} className="animate-pulse space-y-1 rounded-lg border border-[#23262E] p-2">
                  <div className="h-2.5 w-2/3 rounded bg-[#262A33]" />
                  <div className="h-2 w-4/5 rounded bg-[#1E222A]" />
                </div>
              ))}
            </div>
          )}

          {!isLoadingFormulas && formulas.length === 0 && (
            <div className="mt-2 rounded-lg border border-dashed border-[#2A2E37] px-3 py-4 text-center text-[10.5px] leading-relaxed text-[#6B7079]">
              No saved formulas yet. Save the current expression to reuse it anywhere.
            </div>
          )}

          {!isLoadingFormulas && formulas.length > 0 && (
            <div className="mt-2 space-y-1">
              {formulas.slice(0, 5).map((f) => (
                <div
                  key={f.id}
                  className="group flex items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-[#2A2E37] hover:bg-white/[0.03]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpr(f.expression);
                      setCursorPos(f.expression.length);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-[11.5px] text-[#ECEDEF]">{f.label}</div>
                    <div className="truncate font-mono text-[10px] text-[#6B7079]">{f.expression}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendToGraph(f.expression)}
                    title="Send to Graph"
                    aria-label={`Send formula ${f.label} to Graph`}
                    className="rounded-md p-1 text-[#3B404B] transition-colors hover:bg-white/5 hover:text-[#6BA2FF]"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
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
          <div className="panel p-4 sm:p-5 w-full max-w-sm max-w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto space-y-4 shadow-2xl specular-card">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-400" />
                Calces Mode Selection
              </h3>
              <button
                type="button"
                aria-label="Close mode selection"
                onClick={() => setModeModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white btn-tactile rounded-lg"
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
                      ? 'bg-[#4C8DFF] text-white font-bold border-blue-400'
                      : 'bg-[#08090B] hover:bg-[#1A1D24] border-[#24272F] text-zinc-200'
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
          <div className="panel p-4 sm:p-5 w-full max-w-sm max-w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto space-y-4 shadow-2xl specular-card">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-400" />
                Calces SETUP
              </h3>
              <button
                type="button"
                aria-label="Close setup modal"
                onClick={() => setSetupModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white btn-tactile rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-zinc-400 font-semibold block mb-1">Angle Unit</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['deg', 'rad', 'grad'] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAngleMode(a)}
                      className={`p-2 rounded-lg font-mono uppercase btn-tactile ${
                        angleMode === a ? 'bg-amber-400 text-zinc-950 font-bold' : 'bg-[#08090B] border border-[#24272F] text-zinc-300'
                      }`}
                    >
                      {a === 'deg' ? 'Degree (°)' : a === 'rad' ? 'Radian' : 'Gradian'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-zinc-400 font-semibold block mb-1">Result Format</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['auto', 'fraction', 'decimal', 'engineering'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setOutputFormat(fmt)}
                      className={`p-2 rounded-lg font-mono capitalize btn-tactile ${
                        outputFormat === fmt ? 'bg-[#4C8DFF] text-white font-bold' : 'bg-[#08090B] border border-[#24272F] text-zinc-300'
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
          <div className="panel p-4 sm:p-5 w-full max-w-sm max-w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto space-y-4 shadow-2xl specular-card">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Hyperbolic Functions (hyp)</h3>
              <button
                type="button"
                aria-label="Close hyperbolic functions"
                onClick={() => setHypModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white btn-tactile rounded-lg"
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
                  className="p-3 rounded-xl bg-[#08090B] hover:bg-[#24272F] border border-[#24272F] text-[#9CC0FF] font-bold text-center btn-tactile"
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
