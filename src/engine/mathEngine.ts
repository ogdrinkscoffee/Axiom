import { create, all, type MathNode } from 'mathjs';

const math = create(all, {
  number: 'number',
  precision: 14,
});

export type AngleMode = 'rad' | 'deg' | 'grad';
export type OutputFormat = 'auto' | 'decimal' | 'fraction' | 'engineering' | 'polar';

export interface EvalResult {
  ok: boolean;
  formatted: string;
  numericValue: number | null;
  secondary?: string;
  error?: string;
}

export interface CompiledGraphFn {
  kind: 'cartesian' | 'polar' | 'parametric' | 'surface3d';
  eval2D?: (x: number, params: Record<string, number>) => number;
  evalParametric?: (t: number, params: Record<string, number>) => [number, number];
  eval3D?: (x: number, y: number, params: Record<string, number>) => number;
  error?: string;
}

function buildAngleScope(angleMode: AngleMode, extraScope: Record<string, unknown> = {}) {
  const toRad = angleMode === 'deg' ? Math.PI / 180 : angleMode === 'grad' ? Math.PI / 200 : 1;
  const fromRad = angleMode === 'deg' ? 180 / Math.PI : angleMode === 'grad' ? 200 / Math.PI : 1;

  return {
    ...extraScope,
    sin: (x: unknown) => (typeof x === 'number' ? Math.sin(x * toRad) : math.sin(x as number)),
    cos: (x: unknown) => (typeof x === 'number' ? Math.cos(x * toRad) : math.cos(x as number)),
    tan: (x: unknown) => (typeof x === 'number' ? Math.tan(x * toRad) : math.tan(x as number)),
    asin: (x: unknown) => (typeof x === 'number' ? Math.asin(x) * fromRad : math.asin(x as number)),
    acos: (x: unknown) => (typeof x === 'number' ? Math.acos(x) * fromRad : math.acos(x as number)),
    atan: (x: unknown) => (typeof x === 'number' ? Math.atan(x) * fromRad : math.atan(x as number)),
    sinh: (x: number) => Math.sinh(x),
    cosh: (x: number) => Math.cosh(x),
    tanh: (x: number) => Math.tanh(x),
    asinh: (x: number) => Math.asinh(x),
    acosh: (x: number) => Math.acosh(x),
    atanh: (x: number) => Math.atanh(x),
    ln: (x: number) => Math.log(x),
    log10: (x: number) => Math.log10(x),
    log2: (x: number) => Math.log2(x),
    logBase: (base: number, x: number) => Math.log(x) / Math.log(base),
    cbrt: (x: number) => Math.cbrt(x),
    deg: (x: number) => (x * 180) / Math.PI,
    rad: (x: number) => (x * Math.PI) / 180,
    grad: (x: number) => (x * 200) / Math.PI,
    fact: (n: number) => math.factorial(n),
    nCr: (n: number, r: number) => math.combinations(n, r),
    nPr: (n: number, r: number) => math.permutations(n, r),
    gcd: (a: number, b: number) => math.gcd(a, b),
    lcm: (a: number, b: number) => math.lcm(a, b),
    mod: (a: number, b: number) => ((a % b) + b) % b,
    Ran: () => Number((Math.random()).toFixed(3)),
    RanInt: (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a,
    Pol: (x: number, y: number) => {
      const r = Math.hypot(x, y);
      const theta = Math.atan2(y, x) * fromRad;
      return `r = ${formatNum(r)}, θ = ${formatNum(theta)}${angleMode === 'deg' ? '°' : angleMode === 'grad' ? ' grad' : ' rad'}`;
    },
    Rec: (r: number, theta: number) => {
      const rad = theta * toRad;
      return `X = ${formatNum(r * Math.cos(rad))}, Y = ${formatNum(r * Math.sin(rad))}`;
    },
  };
}

export function normalizeExpression(raw: string): string {
  return raw
    .trim()
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√\(/g, 'sqrt(')
    .replace(/√([a-zA-Z0-9_.]+)/g, 'sqrt($1)')
    .replace(/³√\(/g, 'cbrt(')
    .replace(/³√([a-zA-Z0-9_.]+)/g, 'cbrt($1)')
    .replace(/∠/g, ' polarAngle ')
    .replace(/Ans/gi, 'ans');
}

export function evaluateExpression(
  rawExpr: string,
  angleMode: AngleMode = 'rad',
  format: OutputFormat = 'auto',
  ansValue: number = 0,
  userVars: Record<string, number> = {}
): EvalResult {
  const trimmed = rawExpr.trim();
  if (!trimmed) {
    return { ok: true, formatted: '', numericValue: null };
  }

  try {
    const normalized = normalizeExpression(trimmed);

    // Handle derivative('...', 'x') or d/dx(...)
    const derivMatch = normalized.match(/^d\/dx\((.+)\)$/);
    if (derivMatch) {
      const node: MathNode = math.derivative(derivMatch[1], 'x');
      return {
        ok: true,
        formatted: node.toString(),
        numericValue: null,
        secondary: 'Symbolic derivative wrt x',
      };
    }

    // Handle integral(expr, a, b)
    const intMatch = normalized.match(/^integral\(([^,]+),([^,]+),([^)]+)\)$/);
    if (intMatch) {
      const a = Number(evaluateExpression(intMatch[2], angleMode, 'decimal', ansValue, userVars).numericValue);
      const b = Number(evaluateExpression(intMatch[3], angleMode, 'decimal', ansValue, userVars).numericValue);
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        return { ok: false, formatted: 'Error', numericValue: null, error: 'Invalid integral bounds' };
      }
      const val = numericalIntegral(intMatch[1], a, b, 200, angleMode);
      return {
        ok: true,
        formatted: formatScalar(val, format),
        numericValue: val,
        secondary: `Simpson quadrature [${a}, ${b}]`,
      };
    }

    const scope = buildAngleScope(angleMode, {
      ans: ansValue,
      ANS: ansValue,
      ...userVars,
    });

    const result = math.evaluate(normalized, scope);

    if (typeof result === 'function') {
      return { ok: true, formatted: 'Function defined', numericValue: null };
    }

    if (typeof result === 'number') {
      if (!Number.isFinite(result)) {
        return { ok: false, formatted: Number.isNaN(result) ? 'Undefined' : String(result), numericValue: null, error: 'Non-finite result' };
      }
      const clean = Math.abs(result) < 1e-13 ? 0 : result;
      let secondary: string | undefined;
      if (format === 'auto' && Math.abs(clean) > 0 && Math.abs(clean) < 1e6) {
        try {
          const frac = math.fraction(clean);
          const d = Number(frac.d);
          if (d <= 256 && d > 1) {
            secondary = `${Number(frac.s) * Number(frac.n)}/${d}`;
          }
        } catch {
          // ignore non-rational
        }
      }
      return {
        ok: true,
        formatted: formatScalar(clean, format),
        numericValue: clean,
        secondary,
      };
    }

    if (result && typeof result === 'object' && 're' in result && 'im' in result) {
      const c = result as { re: number; im: number };
      const r = Math.hypot(c.re, c.im);
      const theta = Math.atan2(c.im, c.re) * (angleMode === 'deg' ? 180 / Math.PI : 1);
      const unit = angleMode === 'deg' ? '°' : ' rad';
      if (format === 'polar') {
        return {
          ok: true,
          formatted: `${formatNum(r)} ∠ ${formatNum(theta)}${unit}`,
          numericValue: r,
          secondary: `${formatNum(c.re)} ${c.im >= 0 ? '+' : '-'} ${formatNum(Math.abs(c.im))}i`,
        };
      }
      const sign = c.im >= 0 ? '+' : '-';
      return {
        ok: true,
        formatted: `${formatNum(c.re)} ${sign} ${formatNum(Math.abs(c.im))}i`,
        numericValue: r,
        secondary: `${formatNum(r)} ∠ ${formatNum(theta)}${unit}`,
      };
    }

    return {
      ok: true,
      formatted: math.format(result, { precision: 8 }),
      numericValue: null,
    };
  } catch (err) {
    return {
      ok: false,
      formatted: 'Syntax error',
      numericValue: null,
      error: err instanceof Error ? err.message : 'Invalid expression',
    };
  }
}

export function formatNum(val: number): string {
  if (Math.abs(val) < 1e-12) return '0';
  if (Math.abs(val) >= 1e9 || (Math.abs(val) > 0 && Math.abs(val) < 1e-6)) {
    return val.toExponential(6);
  }
  return Number(val.toPrecision(10)).toString();
}

export function formatScalar(val: number, format: OutputFormat): string {
  if (Math.abs(val) < 1e-12) return '0';
  if (format === 'engineering') {
    const exp = Math.floor(Math.log10(Math.abs(val)) / 3) * 3;
    const mantissa = val / Math.pow(10, exp);
    return `${Number(mantissa.toPrecision(7))}e${exp >= 0 ? '+' : ''}${exp}`;
  }
  if (format === 'fraction') {
    try {
      const f = math.fraction(val);
      const d = Number(f.d);
      if (d <= 10000) {
        return d === 1 ? `${Number(f.s) * Number(f.n)}` : `${Number(f.s) * Number(f.n)}/${d}`;
      }
    } catch {
      // fallback
    }
  }
  return formatNum(val);
}

export function compileGraphExpression(
  rawExpr: string,
  angleMode: AngleMode = 'rad',
  is3D: boolean = false
): CompiledGraphFn {
  const cleaned = normalizeExpression(rawExpr);
  if (!cleaned) {
    return { kind: is3D ? 'surface3d' : 'cartesian', error: 'Empty expression' };
  }

  try {
    // Parametric: (exprX, exprY)
    if (!is3D && cleaned.startsWith('(') && cleaned.endsWith(')') && cleaned.includes(',')) {
      const inner = cleaned.slice(1, -1);
      const commaIdx = findTopLevelComma(inner);
      if (commaIdx !== -1) {
        const exprX = inner.slice(0, commaIdx).trim();
        const exprY = inner.slice(commaIdx + 1).trim();
        const cX = math.compile(exprX);
        const cY = math.compile(exprY);
        const baseScope = buildAngleScope(angleMode);
        return {
          kind: 'parametric',
          evalParametric: (t, params) => {
            const s = { ...baseScope, ...params, t };
            return [Number(cX.evaluate(s)), Number(cY.evaluate(s))];
          },
        };
      }
    }

    // Polar: r = f(theta)
    const polarMatch = cleaned.match(/^r\s*=\s*(.+)$/i);
    if (!is3D && polarMatch) {
      const compiled = math.compile(polarMatch[1]);
      const baseScope = buildAngleScope(angleMode);
      return {
        kind: 'polar',
        eval2D: (theta, params) => {
          const s = { ...baseScope, ...params, theta, t: theta };
          return Number(compiled.evaluate(s));
        },
      };
    }

    // Strip y = or z = prefix
    const rhs = cleaned.replace(/^[yz]\s*=\s*/i, '').replace(/^f\([^)]*\)\s*=\s*/i, '');
    const compiled = math.compile(rhs);
    const baseScope = buildAngleScope(angleMode);

    if (is3D) {
      return {
        kind: 'surface3d',
        eval3D: (x, y, params) => {
          const s = { ...baseScope, ...params, x, y };
          return Number(compiled.evaluate(s));
        },
      };
    }

    return {
      kind: 'cartesian',
      eval2D: (x, params) => {
        const s = { ...baseScope, ...params, x };
        return Number(compiled.evaluate(s));
      },
    };
  } catch (err) {
    return {
      kind: is3D ? 'surface3d' : 'cartesian',
      error: err instanceof Error ? err.message : 'Compile error',
    };
  }
}

function findTopLevelComma(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(' || s[i] === '[') depth++;
    else if (s[i] === ')' || s[i] === ']') depth--;
    else if (s[i] === ',' && depth === 0) return i;
  }
  return -1;
}

export function numericalDerivative(fn: (x: number) => number, x: number, h = 1e-4): number {
  const f1 = fn(x - 2 * h);
  const f2 = fn(x - h);
  const f3 = fn(x + h);
  const f4 = fn(x + 2 * h);
  return (f1 - 8 * f2 + 8 * f3 - f4) / (12 * h);
}

export function numericalIntegral(
  expr: string,
  a: number,
  b: number,
  n: number = 200,
  angleMode: AngleMode = 'rad'
): number {
  const compiled = compileGraphExpression(expr, angleMode, false);
  if (!compiled.eval2D) return NaN;
  const steps = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / steps;
  let sum = compiled.eval2D(a, {}) + compiled.eval2D(b, {});
  for (let i = 1; i < steps; i++) {
    const x = a + i * h;
    const y = compiled.eval2D(x, {});
    if (!Number.isFinite(y)) continue;
    sum += (i % 2 === 0 ? 2 : 4) * y;
  }
  return (h / 3) * sum;
}

export interface QuadraticSolution {
  discriminant: number;
  roots: string[];
  vertex: [number, number];
}

export function solveQuadratic(a: number, b: number, c: number): QuadraticSolution {
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) {
      return { discriminant: 0, roots: ['No unique root'], vertex: [0, c] };
    }
    const root = -c / b;
    return { discriminant: 0, roots: [formatNum(root)], vertex: [0, c] };
  }
  const disc = b * b - 4 * a * c;
  const vx = -b / (2 * a);
  const vy = a * vx * vx + b * vx + c;
  if (disc > 1e-12) {
    const sq = Math.sqrt(disc);
    return {
      discriminant: disc,
      roots: [formatNum((-b + sq) / (2 * a)), formatNum((-b - sq) / (2 * a))],
      vertex: [vx, vy],
    };
  }
  if (Math.abs(disc) <= 1e-12) {
    return { discriminant: 0, roots: [formatNum(vx)], vertex: [vx, vy] };
  }
  const real = formatNum(-b / (2 * a));
  const imag = formatNum(Math.sqrt(-disc) / (2 * a));
  return {
    discriminant: disc,
    roots: [`${real} + ${imag}i`, `${real} - ${imag}i`],
    vertex: [vx, vy],
  };
}

export function convertBase(value: string, fromBase: 2 | 8 | 10 | 16) {
  const cleaned = value.trim().replace(/^0[xob]/i, '');
  const parsed = parseInt(cleaned || '0', fromBase);
  if (Number.isNaN(parsed)) {
    return { valid: false, bin: '0', oct: '0', dec: '0', hex: '0' };
  }
  const u32 = parsed >>> 0;
  return {
    valid: true,
    bin: u32.toString(2),
    oct: u32.toString(8),
    dec: String(parsed),
    hex: u32.toString(16).toUpperCase(),
  };
}

export function decomposeFloat32(value: number) {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setFloat32(0, value, false);
  const uint = view.getUint32(0, false);
  const bits = uint.toString(2).padStart(32, '0');
  const signBit = bits[0];
  const exponentBits = bits.slice(1, 9);
  const mantissaBits = bits.slice(9);
  const biasedExponent = parseInt(exponentBits, 2);
  const actualExponent = biasedExponent === 0 ? -126 : biasedExponent - 127;
  return {
    signBit,
    exponentBits,
    mantissaBits,
    hex: '0x' + uint.toString(16).toUpperCase().padStart(8, '0'),
    biasedExponent,
    actualExponent,
    storedValue: view.getFloat32(0, false),
  };
}

export function formatNaturalPreview(expr: string): string {
  return expr
    .replace(/\*/g, ' · ')
    .replace(/\bpi\b/gi, 'π')
    .replace(/\btheta\b/gi, 'θ')
    .replace(/\bsqrt\(/g, '√(')
    .replace(/\bintegral\(/g, '∫(')
    .replace(/\bsum\(/g, '∑(')
    .replace(/\bd\/dx\(/g, 'd/dx(')
    .replace(/>=/g, '≥')
    .replace(/<=/g, '≤')
    .replace(/!=/g, '≠');
}

export interface Stats1VarResult {
  n: number;
  mean: number;
  sum: number;
  sumSq: number;
  sigma: number;
  s: number;
  min: number;
  q1: number;
  med: number;
  q3: number;
  max: number;
}

export function compute1VarStats(numbers: number[]): Stats1VarResult | null {
  const valid = numbers.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const n = valid.length;
  if (n === 0) return null;

  const sum = valid.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;
  const sumSq = valid.reduce((acc, v) => acc + v * v, 0);

  const variancePop = valid.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const sigma = Math.sqrt(variancePop);
  const s = n > 1 ? Math.sqrt(valid.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1)) : 0;

  const getPercentile = (p: number) => {
    const idx = (n - 1) * p;
    const base = Math.floor(idx);
    const rest = idx - base;
    return valid[base] + (valid[base + 1] !== undefined ? rest * (valid[base + 1] - valid[base]) : 0);
  };

  return {
    n,
    mean: Number(mean.toFixed(6)),
    sum: Number(sum.toFixed(6)),
    sumSq: Number(sumSq.toFixed(6)),
    sigma: Number(sigma.toFixed(6)),
    s: Number(s.toFixed(6)),
    min: valid[0],
    q1: Number(getPercentile(0.25).toFixed(6)),
    med: Number(getPercentile(0.5).toFixed(6)),
    q3: Number(getPercentile(0.75).toFixed(6)),
    max: valid[n - 1],
  };
}

export interface TableRow {
  x: number;
  y: number | null;
  error?: string;
}

export function generateValueTable(
  expr: string,
  start: number,
  end: number,
  step: number,
  angleMode: AngleMode = 'rad'
): TableRow[] {
  const rows: TableRow[] = [];
  const safeStep = Math.max(1e-6, Math.abs(step));
  const safeEnd = end >= start ? end : start;
  const maxSteps = 100;
  let curr = start;
  let count = 0;

  const compiled = compileGraphExpression(expr, angleMode, false);
  if (compiled.error || !compiled.eval2D) {
    return [{ x: start, y: null, error: compiled.error || 'Compile error' }];
  }

  while (curr <= safeEnd + 1e-9 && count < maxSteps) {
    const yVal = compiled.eval2D(curr, {});
    rows.push({
      x: Number(curr.toFixed(6)),
      y: Number.isFinite(yVal) ? Number(yVal.toFixed(6)) : null,
      error: Number.isFinite(yVal) ? undefined : 'Undefined',
    });
    curr += safeStep;
    count++;
  }
  return rows;
}

export function solveLinear2x2(
  a1: number, b1: number, c1: number,
  a2: number, b2: number, c2: number
): { x: number; y: number } | string {
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-12) return 'No unique solution';
  const x = (c1 * b2 - c2 * b1) / det;
  const y = (a1 * c2 - a2 * c1) / det;
  return { x: Number(x.toFixed(6)), y: Number(y.toFixed(6)) };
}

export function solveLinear3x3(
  a: number[], b: number[], c: number[], d: number[]
): { x: number; y: number; z: number } | string {
  try {
    const A = [
      [a[0], b[0], c[0]],
      [a[1], b[1], c[1]],
      [a[2], b[2], c[2]],
    ];
    const detA = Number(math.det(A));
    if (Math.abs(detA) < 1e-12) return 'No unique solution';
    const res = math.lusolve(A, d) as number[][];
    return {
      x: Number((res[0][0]).toFixed(6)),
      y: Number((res[1][0]).toFixed(6)),
      z: Number((res[2][0]).toFixed(6)),
    };
  } catch {
    return 'Error solving 3x3 system';
  }
}

