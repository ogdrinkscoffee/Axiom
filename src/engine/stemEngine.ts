// Pure STEM simulation solvers for Physics, Chemistry, Electrical Engineering, and Computer Science

// --- 1. PHYSICS ---
export interface ProjectileParams {
  v0: number;       // m/s
  angleDeg: number; // degrees
  gravity: number;  // m/s^2
  dragCoeff: number;// simplified linear/quadratic air resistance factor
  mass: number;     // kg
}

export interface ProjectilePoint {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ke: number;
  pe: number;
}

export function simulateProjectileTrajectory(
  params: ProjectileParams,
  dt: number = 0.02,
  maxSteps: number = 1200
): { points: ProjectilePoint[]; range: number; maxHeight: number; flightTime: number } {
  const rad = (params.angleDeg * Math.PI) / 180;
  let x = 0;
  let y = 0;
  let vx = params.v0 * Math.cos(rad);
  let vy = params.v0 * Math.sin(rad);
  let t = 0;
  let maxHeight = 0;
  const points: ProjectilePoint[] = [];

  for (let i = 0; i < maxSteps; i++) {
    const speed = Math.hypot(vx, vy);
    const ke = 0.5 * params.mass * speed * speed;
    const pe = params.mass * params.gravity * Math.max(0, y);
    points.push({ t, x, y, vx, vy, ke, pe });
    if (y > maxHeight) maxHeight = y;

    const dragFactor = (params.dragCoeff * speed) / Math.max(0.1, params.mass);
    const ax = -dragFactor * vx;
    const ay = -params.gravity - dragFactor * vy;

    vx += ax * dt;
    vy += ay * dt;
    const nextX = x + vx * dt;
    const nextY = y + vy * dt;
    t += dt;

    if (nextY <= 0 && i > 0) {
      const frac = y / Math.max(1e-9, y - nextY);
      const impactX = x + (nextX - x) * frac;
      const impactT = t - dt + dt * frac;
      points.push({
        t: impactT,
        x: impactX,
        y: 0,
        vx,
        vy,
        ke: 0.5 * params.mass * (vx * vx + vy * vy),
        pe: 0,
      });
      return { points, range: impactX, maxHeight, flightTime: impactT };
    }
    x = nextX;
    y = nextY;
  }

  return { points, range: x, maxHeight, flightTime: t };
}

export interface PointCharge {
  id: string;
  x: number;
  y: number;
  q: number; // microCoulombs
}

export function evaluateElectricField(charges: PointCharge[], px: number, py: number) {
  const ke = 8.98755; // scaled k * 1e-6 for visual clarity
  let ex = 0;
  let ey = 0;
  let potential = 0;

  for (const c of charges) {
    const dx = px - c.x;
    const dy = py - c.y;
    const r2 = dx * dx + dy * dy + 0.08; // softening core
    const r = Math.sqrt(r2);
    const mag = (ke * c.q) / r2;
    ex += mag * (dx / r);
    ey += mag * (dy / r);
    potential += (ke * c.q) / r;
  }

  return { ex, ey, magnitude: Math.hypot(ex, ey), potential };
}

// --- 2. CHEMISTRY ---
export interface AtomSpec {
  element: string;
  color: string;
  radius: number;
  position: [number, number, number];
}

export interface BondSpec {
  from: number;
  to: number;
  order: 1 | 2;
}

export interface MoleculePreset {
  id: string;
  formula: string;
  name: string;
  geometry: string;
  bondAngle: string;
  molarMass: number;
  atoms: AtomSpec[];
  bonds: BondSpec[];
}

export const MOLECULE_CATALOG: MoleculePreset[] = [
  {
    id: 'h2o',
    formula: 'H₂O',
    name: 'Water',
    geometry: 'Bent (VSEPR AX₂E₂)',
    bondAngle: '104.5°',
    molarMass: 18.015,
    atoms: [
      { element: 'O', color: '#EF4444', radius: 0.48, position: [0, 0.25, 0] },
      { element: 'H', color: '#E2E8F0', radius: 0.28, position: [-0.95, -0.45, 0] },
      { element: 'H', color: '#E2E8F0', radius: 0.28, position: [0.95, -0.45, 0] },
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 1 },
    ],
  },
  {
    id: 'ch4',
    formula: 'CH₄',
    name: 'Methane',
    geometry: 'Tetrahedral (AX₄)',
    bondAngle: '109.5°',
    molarMass: 16.043,
    atoms: [
      { element: 'C', color: '#475569', radius: 0.5, position: [0, 0, 0] },
      { element: 'H', color: '#E2E8F0', radius: 0.28, position: [0, 1.25, 0] },
      { element: 'H', color: '#E2E8F0', radius: 0.28, position: [1.18, -0.42, 0] },
      { element: 'H', color: '#E2E8F0', radius: 0.28, position: [-0.59, -0.42, 1.02] },
      { element: 'H', color: '#E2E8F0', radius: 0.28, position: [-0.59, -0.42, -1.02] },
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 },
      { from: 0, to: 4, order: 1 },
    ],
  },
  {
    id: 'co2',
    formula: 'CO₂',
    name: 'Carbon Dioxide',
    geometry: 'Linear (AX₂)',
    bondAngle: '180.0°',
    molarMass: 44.01,
    atoms: [
      { element: 'C', color: '#475569', radius: 0.5, position: [0, 0, 0] },
      { element: 'O', color: '#EF4444', radius: 0.45, position: [-1.35, 0, 0] },
      { element: 'O', color: '#EF4444', radius: 0.45, position: [1.35, 0, 0] },
    ],
    bonds: [
      { from: 0, to: 1, order: 2 },
      { from: 0, to: 2, order: 2 },
    ],
  },
  {
    id: 'c6h6',
    formula: 'C₆H₆',
    name: 'Benzene',
    geometry: 'Trigonal Planar Ring',
    bondAngle: '120.0°',
    molarMass: 78.114,
    atoms: [
      ...[0, 1, 2, 3, 4, 5].map((i) => ({
        element: 'C',
        color: '#475569',
        radius: 0.42,
        position: [1.35 * Math.cos((i * Math.PI) / 3), 0, 1.35 * Math.sin((i * Math.PI) / 3)] as [number, number, number],
      })),
      ...[0, 1, 2, 3, 4, 5].map((i) => ({
        element: 'H',
        color: '#E2E8F0',
        radius: 0.24,
        position: [2.25 * Math.cos((i * Math.PI) / 3), 0, 2.25 * Math.sin((i * Math.PI) / 3)] as [number, number, number],
      })),
    ],
    bonds: [
      { from: 0, to: 1, order: 2 },
      { from: 1, to: 2, order: 1 },
      { from: 2, to: 3, order: 2 },
      { from: 3, to: 4, order: 1 },
      { from: 4, to: 5, order: 2 },
      { from: 5, to: 0, order: 1 },
      { from: 0, to: 6, order: 1 },
      { from: 1, to: 7, order: 1 },
      { from: 2, to: 8, order: 1 },
      { from: 3, to: 9, order: 1 },
      { from: 4, to: 10, order: 1 },
      { from: 5, to: 11, order: 1 },
    ],
  },
  {
    id: 'sf6',
    formula: 'SF₆',
    name: 'Sulfur Hexafluoride',
    geometry: 'Octahedral (AX₆)',
    bondAngle: '90.0°',
    molarMass: 146.06,
    atoms: [
      { element: 'S', color: '#F59E0B', radius: 0.56, position: [0, 0, 0] },
      { element: 'F', color: '#10B981', radius: 0.34, position: [1.4, 0, 0] },
      { element: 'F', color: '#10B981', radius: 0.34, position: [-1.4, 0, 0] },
      { element: 'F', color: '#10B981', radius: 0.34, position: [0, 1.4, 0] },
      { element: 'F', color: '#10B981', radius: 0.34, position: [0, -1.4, 0] },
      { element: 'F', color: '#10B981', radius: 0.34, position: [0, 0, 1.4] },
      { element: 'F', color: '#10B981', radius: 0.34, position: [0, 0, -1.4] },
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 },
      { from: 0, to: 4, order: 1 },
      { from: 0, to: 5, order: 1 },
      { from: 0, to: 6, order: 1 },
    ],
  },
];

const ATOMIC_MASS: Record<string, number> = {
  H: 1.008, He: 4.0026, Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011, N: 14.007, O: 15.999,
  F: 18.998, Ne: 20.18, Na: 22.99, Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974, S: 32.06,
  Cl: 35.45, Ar: 39.948, K: 39.098, Ca: 40.078, Fe: 55.845, Cu: 63.546, Zn: 65.38, Br: 79.904,
  Ag: 107.87, I: 126.9, Au: 196.97,
};

export function computeMolarMass(formula: string): { mass: number; error?: string } {
  const cleaned = formula.trim();
  if (!cleaned) return { mass: 0, error: 'Empty formula' };

  const stack: number[] = [0];
  let i = 0;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (ch === '(' || ch === '[') {
      stack.push(0);
      i++;
    } else if (ch === ')' || ch === ']') {
      if (stack.length < 2) return { mass: 0, error: 'Mismatched parentheses' };
      i++;
      let numStr = '';
      while (i < cleaned.length && /\d/.test(cleaned[i])) {
        numStr += cleaned[i++];
      }
      const mult = numStr ? parseInt(numStr, 10) : 1;
      const top = stack.pop()!;
      stack[stack.length - 1] += top * mult;
    } else if (/[A-Z]/.test(ch)) {
      let sym = ch;
      i++;
      while (i < cleaned.length && /[a-z]/.test(cleaned[i])) {
        sym += cleaned[i++];
      }
      const atomic = ATOMIC_MASS[sym];
      if (!atomic) return { mass: 0, error: `Unknown element: ${sym}` };
      let numStr = '';
      while (i < cleaned.length && /\d/.test(cleaned[i])) {
        numStr += cleaned[i++];
      }
      const count = numStr ? parseInt(numStr, 10) : 1;
      stack[stack.length - 1] += atomic * count;
    } else {
      return { mass: 0, error: `Unexpected token '${ch}'` };
    }
  }
  if (stack.length !== 1) return { mass: 0, error: 'Unclosed parentheses' };
  return { mass: Number(stack[0].toFixed(4)) };
}

export function solveIdealGas(
  solveFor: 'P' | 'V' | 'n' | 'T',
  values: { P: number; V: number; n: number; T: number }
): number {
  const R = 0.082057366; // L·atm / (mol·K)
  switch (solveFor) {
    case 'P':
      return (values.n * R * values.T) / Math.max(1e-9, values.V);
    case 'V':
      return (values.n * R * values.T) / Math.max(1e-9, values.P);
    case 'n':
      return (values.P * values.V) / Math.max(1e-9, R * values.T);
    case 'T':
      return (values.P * values.V) / Math.max(1e-9, values.n * R);
  }
}

export function computePH(molarity: number, pKa: number, isStrongAcid: boolean) {
  const c = Math.max(1e-12, molarity);
  let hPlus = c;
  if (!isStrongAcid) {
    const ka = Math.pow(10, -pKa);
    // x^2 + Ka*x - Ka*c = 0
    hPlus = (-ka + Math.sqrt(ka * ka + 4 * ka * c)) / 2;
  }
  const ph = -Math.log10(Math.max(1e-14, hPlus));
  const poh = 14 - ph;
  return { ph, poh, hPlus, ohMinus: Math.pow(10, -poh) };
}

// --- 3. ELECTRICAL & ENGINEERING ---
export interface RLCAnalysis {
  xl: number;
  xc: number;
  zMag: number;
  phaseDeg: number;
  resonantHz: number;
  qFactor: number;
  currentA: number;
  realPowerW: number;
  apparentPowerVA: number;
}

export function analyzeRLC(
  resistanceOhm: number,
  inductanceMH: number,
  capacitanceUF: number,
  vRms: number,
  freqHz: number
): RLCAnalysis {
  const R = Math.max(0.01, resistanceOhm);
  const L = Math.max(1e-9, inductanceMH * 1e-3);
  const C = Math.max(1e-12, capacitanceUF * 1e-6);
  const omega = 2 * Math.PI * Math.max(0.1, freqHz);

  const xl = omega * L;
  const xc = 1 / (omega * C);
  const xNet = xl - xc;
  const zMag = Math.hypot(R, xNet);
  const phaseDeg = (Math.atan2(xNet, R) * 180) / Math.PI;
  const resonantHz = 1 / (2 * Math.PI * Math.sqrt(L * C));
  const qFactor = (1 / R) * Math.sqrt(L / C);
  const currentA = vRms / zMag;
  const realPowerW = currentA * currentA * R;
  const apparentPowerVA = vRms * currentA;

  return { xl, xc, zMag, phaseDeg, resonantHz, qFactor, currentA, realPowerW, apparentPowerVA };
}

export function analyzeBeamDeflection(params: {
  lengthM: number;
  loadN: number;
  widthMm: number;
  heightMm: number;
  E_GPa: number;
  support: 'cantilever' | 'simply-supported';
}) {
  const L = Math.max(0.05, params.lengthM);
  const F = params.loadN;
  const b = Math.max(1, params.widthMm) * 1e-3;
  const h = Math.max(1, params.heightMm) * 1e-3;
  const E = Math.max(1, params.E_GPa) * 1e9;
  const I = (b * Math.pow(h, 3)) / 12;

  const deflectionM =
    params.support === 'cantilever'
      ? (F * Math.pow(L, 3)) / (3 * E * I)
      : (F * Math.pow(L, 3)) / (48 * E * I);

  const maxMoment = params.support === 'cantilever' ? F * L : (F * L) / 4;
  const maxStressMPa = ((maxMoment * (h / 2)) / I) * 1e-6;

  return {
    momentOfInertiaCm4: I * 1e8,
    deflectionMm: deflectionM * 1000,
    maxStressMPa,
  };
}

// --- 4. COMPUTER SCIENCE ---
export interface TruthTableResult {
  variables: string[];
  rows: { inputs: Record<string, boolean>; output: boolean }[];
  error?: string;
}

export function evaluateBooleanExpression(rawExpr: string): TruthTableResult {
  const varsSet = new Set<string>();
  const tokens = rawExpr.toUpperCase().match(/\b[A-D]\b/g) || [];
  for (const t of tokens) varsSet.add(t);
  const variables = Array.from(varsSet).sort();
  if (variables.length === 0) {
    return { variables: [], rows: [], error: 'Use variables A, B, C, or D (e.g. (A AND B) OR NOT C)' };
  }

  // Convert boolean operators into safe JS evaluation on boolean variables
  let jsExpr = rawExpr
    .toUpperCase()
    .replace(/\bNAND\b/g, '/*NAND*/')
    .replace(/\bAND\b/g, '&&')
    .replace(/\bOR\b/g, '||')
    .replace(/\bXOR\b/g, '!==')
    .replace(/\bNOT\b/g, '!')
    .replace(/&/g, '&&')
    .replace(/\|/g, '||')
    .replace(/\^/g, '!==')
    .replace(/~/g, '!');

  // Clean double &&/|| if user wrote &&
  jsExpr = jsExpr.replace(/&&&&/g, '&&').replace(/\|\|\|\|/g, '||');

  if (!/^[A-D\s()!&|=!]+$/.test(jsExpr)) {
    return { variables, rows: [], error: 'Allowed: A-D, AND, OR, XOR, NOT, &, |, ^, !, ()' };
  }

  try {
    const fn = new Function(...variables, `return Boolean(${jsExpr});`) as (...args: boolean[]) => boolean;
    const count = 1 << variables.length;
    const rows: { inputs: Record<string, boolean>; output: boolean }[] = [];
    for (let mask = 0; mask < count; mask++) {
      const inputs: Record<string, boolean> = {};
      const args: boolean[] = [];
      for (let i = 0; i < variables.length; i++) {
        const bit = Boolean((mask >> (variables.length - 1 - i)) & 1);
        inputs[variables[i]] = bit;
        args.push(bit);
      }
      rows.push({ inputs, output: fn(...args) });
    }
    return { variables, rows };
  } catch {
    return { variables, rows: [], error: 'Invalid boolean syntax' };
  }
}

export interface GridCoord {
  r: number;
  c: number;
}

export function runPathfinding(
  walls: boolean[][],
  start: GridCoord,
  end: GridCoord,
  algorithm: 'astar' | 'dijkstra' | 'bfs'
): { visited: GridCoord[]; path: GridCoord[] } {
  const rows = walls.length;
  const cols = walls[0]?.length || 0;
  if (rows === 0 || cols === 0) return { visited: [], path: [] };

  const key = (r: number, c: number) => `${r},${c}`;
  const dist = new Map<string, number>();
  const prev = new Map<string, GridCoord | null>();
  const visited: GridCoord[] = [];
  const closed = new Set<string>();

  const startKey = key(start.r, start.c);
  dist.set(startKey, 0);
  prev.set(startKey, null);

  const open: { r: number; c: number; f: number }[] = [{ r: start.r, c: start.c, f: 0 }];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (open.length > 0) {
    if (algorithm !== 'bfs') {
      open.sort((a, b) => a.f - b.f);
    }
    const curr = open.shift()!;
    const ck = key(curr.r, curr.c);
    if (closed.has(ck)) continue;
    closed.add(ck);
    visited.push({ r: curr.r, c: curr.c });

    if (curr.r === end.r && curr.c === end.c) break;

    const gCurr = dist.get(ck) ?? 0;
    for (const [dr, dc] of dirs) {
      const nr = curr.r + dr;
      const nc = curr.c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (walls[nr][nc]) continue;
      const nk = key(nr, nc);
      if (closed.has(nk)) continue;

      const tentativeG = gCurr + 1;
      if (!dist.has(nk) || tentativeG < dist.get(nk)!) {
        dist.set(nk, tentativeG);
        prev.set(nk, { r: curr.r, c: curr.c });
        const h = algorithm === 'astar' ? Math.abs(nr - end.r) + Math.abs(nc - end.c) : 0;
        open.push({ r: nr, c: nc, f: tentativeG + h });
      }
    }
  }

  const path: GridCoord[] = [];
  let trace: GridCoord | null = end;
  if (prev.has(key(end.r, end.c))) {
    while (trace) {
      path.unshift(trace);
      trace = prev.get(key(trace.r, trace.c)) ?? null;
    }
  }

  return { visited, path };
}
