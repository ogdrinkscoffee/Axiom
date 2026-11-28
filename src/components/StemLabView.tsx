import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Play, Pause, RotateCcw } from 'lucide-react';
import {
  simulateProjectileTrajectory,
  evaluateElectricField,
  MOLECULE_CATALOG,
  computeMolarMass,
  solveIdealGas,
  computePH,
  analyzeRLC,
  analyzeBeamDeflection,
  evaluateBooleanExpression,
  runPathfinding,
  type PointCharge,
} from '../engine/stemEngine';
import {
  detectSoftwareGl,
  createAdaptiveRenderer,
  createAfterDrawScheduler,
} from '../utils/webglGuard';

type StemDomain = 'physics' | 'chemistry' | 'electrical' | 'cs';

export function StemLabView() {
  const [domain, setDomain] = useState<StemDomain>('physics');

  // --- PHYSICS STATE ---
  const [physicsSim, setPhysicsSim] = useState<'projectile' | 'efield'>('projectile');
  const [v0, setV0] = useState(28);
  const [angleDeg, setAngleDeg] = useState(48);
  const [gravity, setGravity] = useState(9.81);
  const [dragCoeff, setDragCoeff] = useState(0.02);
  const [projPlaying, setProjPlaying] = useState(true);
  const projCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [charges, setCharges] = useState<PointCharge[]>([
    { id: 'q1', x: -2.2, y: 0, q: 4 },
    { id: 'q2', x: 2.2, y: 0, q: -4 },
  ]);
  const efieldCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragChargeRef = useRef<string | null>(null);

  // --- CHEMISTRY STATE ---
  const [molId, setMolId] = useState(MOLECULE_CATALOG[1].id);
  const [chemFormula, setChemFormula] = useState('C6H12O6');
  const [gasSolveFor, setGasSolveFor] = useState<'P' | 'V' | 'n' | 'T'>('P');
  const [gasP, setGasP] = useState(1);
  const [gasV, setGasV] = useState(22.414);
  const [gasN, setGasN] = useState(1);
  const [gasT, setGasT] = useState(298.15);
  const [acidMolarity, setAcidMolarity] = useState(0.05);
  const [acidPKa, setAcidPKa] = useState(4.76);
  const [strongAcid, setStrongAcid] = useState(false);
  const molMountRef = useRef<HTMLDivElement | null>(null);

  // --- ELECTRICAL & ENGINEERING STATE ---
  const [rlcR, setRlcR] = useState(25);
  const [rlcL, setRlcL] = useState(15);
  const [rlcC, setRlcC] = useState(10);
  const [rlcV, setRlcV] = useState(12);
  const [rlcFreq, setRlcFreq] = useState(410);
  const scopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [beamLen, setBeamLen] = useState(2.5);
  const [beamLoad, setBeamLoad] = useState(1200);
  const [beamSupport, setBeamSupport] = useState<'cantilever' | 'simply-supported'>('cantilever');

  // --- COMPUTER SCIENCE STATE ---
  const [boolExpr, setBoolExpr] = useState('(A AND B) OR NOT C');
  const [pfAlgo, setPfAlgo] = useState<'astar' | 'dijkstra' | 'bfs'>('astar');
  const [walls, setWalls] = useState<boolean[][]>(() => {
    const g = Array.from({ length: 12 }, () => Array(18).fill(false));
    for (let r = 2; r <= 9; r++) g[r][6] = true;
    for (let r = 1; r <= 8; r++) g[r][12] = true;
    return g;
  });
  const [pfStep, setPfStep] = useState(999);

  // --- PHYSICS: PROJECTILE ANIMATION ---
  const projResult = simulateProjectileTrajectory({
    v0,
    angleDeg,
    gravity,
    dragCoeff,
    mass: 1.5,
  });

  useEffect(() => {
    if (domain !== 'physics' || physicsSim !== 'projectile') return;
    const canvas = projCanvasRef.current;
    if (!canvas) return;

    let raf = 0;
    const startTime = performance.now();

    const renderFrame = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const tw = Math.floor(rect.width * dpr);
        const th = Math.floor(rect.height * dpr);
        if (canvas.width !== tw || canvas.height !== th) {
          canvas.width = tw;
          canvas.height = th;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const w = rect.width;
          const h = rect.height;
          ctx.fillStyle = '#090C11';
          ctx.fillRect(0, 0, w, h);

          const padL = 44;
          const padB = 34;
          const maxX = Math.max(25, projResult.range * 1.15);
          const maxY = Math.max(12, projResult.maxHeight * 1.25);
          const scaleX = (w - padL - 24) / maxX;
          const scaleY = (h - padB - 24) / maxY;
          const scale = Math.min(scaleX, scaleY);

          const toX = (x: number) => padL + x * scale;
          const toY = (y: number) => h - padB - y * scale;

          // Grid
          ctx.strokeStyle = '#171E2B';
          ctx.lineWidth = 1;
          for (let gx = 0; gx <= maxX; gx += 10) {
            ctx.beginPath();
            ctx.moveTo(toX(gx), 12);
            ctx.lineTo(toX(gx), h - padB);
            ctx.stroke();
          }
          for (let gy = 0; gy <= maxY; gy += 5) {
            ctx.beginPath();
            ctx.moveTo(padL, toY(gy));
            ctx.lineTo(w - 12, toY(gy));
            ctx.stroke();
          }

          // Ground line
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(padL, toY(0));
          ctx.lineTo(w - 12, toY(0));
          ctx.stroke();

          // Full Trajectory Path
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          projResult.points.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(toX(pt.x), toY(pt.y));
            else ctx.lineTo(toX(pt.x), toY(pt.y));
          });
          ctx.stroke();

          // Animated Projectile
          const totalT = Math.max(0.2, projResult.flightTime);
          const elapsed = projPlaying ? ((now - startTime) / 1000) % (totalT + 0.6) : totalT * 0.45;
          const tClamped = Math.min(elapsed, totalT);
          let cur = projResult.points[projResult.points.length - 1];
          for (const pt of projResult.points) {
            if (pt.t >= tClamped) {
              cur = pt;
              break;
            }
          }

          if (cur) {
            // Active trail
            ctx.strokeStyle = '#22D3EE';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            let started = false;
            for (const pt of projResult.points) {
              if (pt.t > cur.t) break;
              if (!started) {
                ctx.moveTo(toX(pt.x), toY(pt.y));
                started = true;
              } else {
                ctx.lineTo(toX(pt.x), toY(pt.y));
              }
            }
            ctx.stroke();

            // Velocity vector arrow
            const sx = toX(cur.x);
            const sy = toY(cur.y);
            ctx.strokeStyle = '#F59E0B';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + cur.vx * 1.4, sy - cur.vy * 1.4);
            ctx.stroke();

            // Ball
            ctx.fillStyle = '#22D3EE';
            ctx.beginPath();
            ctx.arc(sx, sy, 6, 0, Math.PI * 2);
            ctx.fill();

            // Live Energy Bar HUD inside canvas corner
            const totalE = Math.max(1, cur.ke + cur.pe);
            const kePct = cur.ke / totalE;
            ctx.fillStyle = '#94A3B8';
            ctx.font = '11px "JetBrains Mono", monospace';
            ctx.fillText(`t = ${cur.t.toFixed(2)}s   KE ${(kePct * 100).toFixed(0)}% / PE ${((1 - kePct) * 100).toFixed(0)}%`, padL + 8, 24);
          }
        }
      }
      if (projPlaying) raf = requestAnimationFrame(renderFrame);
    };

    raf = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(raf);
  }, [domain, physicsSim, projPlaying, projResult]);

  // --- PHYSICS: ELECTRIC FIELD SANDBOX ---
  useEffect(() => {
    if (domain !== 'physics' || physicsSim !== 'efield') return;
    const canvas = efieldCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    const scale = Math.min(w, h) / 10;
    const toScreenX = (x: number) => w / 2 + x * scale;
    const toScreenY = (y: number) => h / 2 - y * scale;

    ctx.fillStyle = '#090C11';
    ctx.fillRect(0, 0, w, h);

    // Vector field arrows
    const cols = 20;
    const rows = 14;
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const sx = (w * (c + 0.5)) / (cols + 1);
        const sy = (h * (r + 0.5)) / (rows + 1);
        const wx = (sx - w / 2) / scale;
        const wy = (h / 2 - sy) / scale;
        const f = evaluateElectricField(charges, wx, wy);
        if (f.magnitude < 0.01) continue;
        const ux = f.ex / f.magnitude;
        const uy = f.ey / f.magnitude;
        const len = 14;
        const intensity = Math.min(1, Math.log10(1 + f.magnitude) / 1.5);
        ctx.strokeStyle = `rgba(34, 211, 238, ${0.22 + intensity * 0.72})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(sx - (ux * len) / 2, sy + (uy * len) / 2);
        ctx.lineTo(sx + (ux * len) / 2, sy - (uy * len) / 2);
        ctx.stroke();

        // Arrowhead
        const hx = sx + (ux * len) / 2;
        const hy = sy - (uy * len) / 2;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(hx, hy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw charges
    for (const ch of charges) {
      const sx = toScreenX(ch.x);
      const sy = toScreenY(ch.y);
      ctx.fillStyle = ch.q >= 0 ? '#F59E0B' : '#22D3EE';
      ctx.beginPath();
      ctx.arc(sx, sy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#090C11';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${ch.q > 0 ? '+' : ''}${ch.q}`, sx, sy);
    }
  }, [domain, physicsSim, charges]);

  // --- CHEMISTRY: 3D VSEPR MOLECULE VIEWER ---
  const activeMolecule = MOLECULE_CATALOG.find((m) => m.id === molId) || MOLECULE_CATALOG[0];

  useEffect(() => {
    if (domain !== 'chemistry') return;
    const container = molMountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const renderer = createAdaptiveRenderer(isSoftwareGl);
    const width = container.clientWidth || 500;
    const height = container.clientHeight || 360;
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090C11');
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(3.8, 2.8, 4.8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;

    scene.add(new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.9));
    const key = new THREE.DirectionalLight(0xfff1e6, 2.0);
    key.position.set(5, 8, 6);
    scene.add(key);

    const molGroup = new THREE.Group();
    const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];

    const sphereGeo = new THREE.SphereGeometry(1, 24, 24);
    disposables.push(sphereGeo);
    const bondGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 16);
    disposables.push(bondGeo);
    const bondMat = new THREE.MeshStandardMaterial({
      color: '#64748B',
      roughness: 0.35,
      metalness: 0.6,
    });
    disposables.push(bondMat);

    // Atoms
    for (const atom of activeMolecule.atoms) {
      const mat = new THREE.MeshStandardMaterial({
        color: atom.color,
        roughness: 0.25,
        metalness: 0.2,
      });
      disposables.push(mat);
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.position.set(...atom.position);
      mesh.scale.setScalar(atom.radius);
      molGroup.add(mesh);
    }

    // Bonds (single & double)
    const up = new THREE.Vector3(0, 1, 0);
    for (const b of activeMolecule.bonds) {
      const p1 = new THREE.Vector3(...activeMolecule.atoms[b.from].position);
      const p2 = new THREE.Vector3(...activeMolecule.atoms[b.to].position);
      const dir = p2.clone().sub(p1);
      const len = dir.length();
      const mid = p1.clone().add(p2).multiplyScalar(0.5);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());

      const offsets = b.order === 2 ? [-0.09, 0.09] : [0];
      const perp = new THREE.Vector3(0, 0, 1).cross(dir).normalize();
      if (perp.lengthSq() < 0.01) perp.set(1, 0, 0);

      for (const off of offsets) {
        const bondMesh = new THREE.Mesh(bondGeo, bondMat);
        bondMesh.position.copy(mid).addScaledVector(perp, off);
        bondMesh.quaternion.copy(quat);
        bondMesh.scale.set(1, len, 1);
        molGroup.add(bondMesh);
      }
    }

    scene.add(molGroup);
    if (!isSoftwareGl) renderer.compile(scene, camera);

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    const afterDraw = createAfterDrawScheduler(renderer, (id) => {
      frameId = id;
    });

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        controls.update();
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    controls.addEventListener('change', requestRender);
    requestRender();

    const onResize = () => {
      if (!container) return;
      const nw = container.clientWidth || 500;
      const nh = container.clientHeight || 360;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
      requestRender();
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('change', requestRender);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
  }, [domain, activeMolecule]);

  // --- ELECTRICAL: 60FPS OSCILLOSCOPE ---
  const rlc = analyzeRLC(rlcR, rlcL, rlcC, rlcV, rlcFreq);

  useEffect(() => {
    if (domain !== 'electrical') return;
    const canvas = scopeCanvasRef.current;
    if (!canvas) return;
    let raf = 0;
    const t0 = performance.now();

    const renderScope = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const tw = Math.floor(rect.width * dpr);
        const th = Math.floor(rect.height * dpr);
        if (canvas.width !== tw || canvas.height !== th) {
          canvas.width = tw;
          canvas.height = th;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const w = rect.width;
          const h = rect.height;
          ctx.fillStyle = '#090C11';
          ctx.fillRect(0, 0, w, h);

          // Graticule
          ctx.strokeStyle = '#151D2B';
          ctx.lineWidth = 1;
          for (let x = 0; x <= w; x += w / 8) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
          }
          for (let y = 0; y <= h; y += h / 6) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }
          ctx.strokeStyle = '#2B364A';
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.stroke();

          const phaseShift = ((now - t0) / 1000) * 3.0;
          const phaseRad = (rlc.phaseDeg * Math.PI) / 180;

          // Voltage waveform V(t)
          ctx.strokeStyle = '#22D3EE';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          for (let px = 0; px <= w; px += 3) {
            const theta = (px / w) * Math.PI * 4 - phaseShift;
            const y = h / 2 - Math.sin(theta) * (h * 0.36);
            if (px === 0) ctx.moveTo(px, y);
            else ctx.lineTo(px, y);
          }
          ctx.stroke();

          // Current waveform I(t)
          const iScale = Math.min(0.36, Math.max(0.08, (rlc.currentA / Math.max(0.1, rlcV / rlcR)) * 0.34));
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          for (let px = 0; px <= w; px += 3) {
            const theta = (px / w) * Math.PI * 4 - phaseShift - phaseRad;
            const y = h / 2 - Math.sin(theta) * (h * iScale);
            if (px === 0) ctx.moveTo(px, y);
            else ctx.lineTo(px, y);
          }
          ctx.stroke();

          ctx.fillStyle = '#94A3B8';
          ctx.font = '11px "JetBrains Mono", monospace';
          ctx.fillText('V(t) Cyan  ·  I(t) Amber', 12, 20);
        }
      }
      raf = requestAnimationFrame(renderScope);
    };

    raf = requestAnimationFrame(renderScope);
    return () => cancelAnimationFrame(raf);
  }, [domain, rlc.phaseDeg, rlc.currentA, rlcV, rlcR]);

  const beamRes = analyzeBeamDeflection({
    lengthM: beamLen,
    loadN: beamLoad,
    widthMm: 50,
    heightMm: 100,
    E_GPa: 200,
    support: beamSupport,
  });

  // --- CS: PATHFINDING & BOOLEAN ---
  const pfStart = { r: 2, c: 2 };
  const pfEnd = { r: 9, c: 15 };
  const pfResult = runPathfinding(walls, pfStart, pfEnd, pfAlgo);
  const visitedSlice = new Set(
    pfResult.visited.slice(0, pfStep).map((p) => `${p.r},${p.c}`)
  );
  const pathSet = new Set(
    pfStep >= pfResult.visited.length ? pfResult.path.map((p) => `${p.r},${p.c}`) : []
  );

  useEffect(() => {
    if (domain !== 'cs' || pfStep >= pfResult.visited.length) return;
    const timer = window.setTimeout(() => setPfStep((s) => s + 3), 24);
    return () => clearTimeout(timer);
  }, [domain, pfStep, pfResult.visited.length]);

  const molarMassRes = computeMolarMass(chemFormula);
  const solvedGas = solveIdealGas(gasSolveFor, { P: gasP, V: gasV, n: gasN, T: gasT });
  const phRes = computePH(acidMolarity, acidPKa, strongAcid);
  const truthTable = evaluateBooleanExpression(boolExpr);

  return (
    <div className="h-full flex flex-col gap-3 p-3 md:p-5 max-w-[1440px] mx-auto w-full overflow-y-auto">
      {/* Sub-domain Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-[#10151E] p-1 rounded-lg border border-[#1E2736] overflow-x-auto">
          {(
            [
              ['physics', 'Physics'],
              ['chemistry', 'Chemistry'],
              ['electrical', 'Electrical & Mech'],
              ['cs', 'Computer Science'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDomain(id)}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 min-h-[38px] ${
                domain === id ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-300 hover:bg-[#18202D]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* PHYSICS LAB */}
      {domain === 'physics' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
          <div className="lg:col-span-4 bg-[#10151E] border border-[#1E2736] rounded-xl p-4 space-y-4">
            <div className="flex gap-1 bg-[#090C11] p-1 rounded-lg border border-[#1E2736]">
              <button
                type="button"
                onClick={() => setPhysicsSim('projectile')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md ${
                  physicsSim === 'projectile' ? 'bg-[#1C2536] text-white' : 'text-slate-400'
                }`}
              >
                Ballistic Kinematics
              </button>
              <button
                type="button"
                onClick={() => setPhysicsSim('efield')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md ${
                  physicsSim === 'efield' ? 'bg-[#1C2536] text-white' : 'text-slate-400'
                }`}
              >
                Electrostatic Field
              </button>
            </div>

            {physicsSim === 'projectile' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">Launch Parameters</span>
                  <button
                    type="button"
                    onClick={() => setProjPlaying((v) => !v)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-[#161E2B] text-cyan-300"
                  >
                    {projPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {projPlaying ? 'Pause' : 'Run'}
                  </button>
                </div>

                {(
                  [
                    ['Initial Velocity v₀ (m/s)', v0, 5, 60, 1, setV0],
                    ['Launch Angle θ (°)', angleDeg, 5, 85, 1, setAngleDeg],
                    ['Gravity g (m/s²)', gravity, 1.62, 24.79, 0.1, setGravity],
                    ['Air Drag Coeff', dragCoeff, 0, 0.15, 0.005, setDragCoeff],
                  ] as [string, number, number, number, number, React.Dispatch<React.SetStateAction<number>>][]
                ).map(([label, val, min, max, step, setter]) => (
                  <label key={label} className="block space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">{label}</span>
                      <span className="font-mono text-cyan-300">{val.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={val}
                      onChange={(e) => setter(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </label>
                ))}

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1E2736] font-mono">
                  <div className="bg-[#090C11] border border-[#1E2736] rounded-lg p-2.5">
                    <div className="text-[11px] text-slate-400">Range</div>
                    <div className="text-sm text-white mt-0.5">{projResult.range.toFixed(2)} m</div>
                  </div>
                  <div className="bg-[#090C11] border border-[#1E2736] rounded-lg p-2.5">
                    <div className="text-[11px] text-slate-400">Apex</div>
                    <div className="text-sm text-cyan-300 mt-0.5">{projResult.maxHeight.toFixed(2)} m</div>
                  </div>
                  <div className="bg-[#090C11] border border-[#1E2736] rounded-lg p-2.5">
                    <div className="text-[11px] text-slate-400">Time</div>
                    <div className="text-sm text-amber-300 mt-0.5">{projResult.flightTime.toFixed(2)} s</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Drag point charges directly on the field canvas to inspect real-time dipole/monopole E-field vectors.
                </p>
                {charges.map((ch, idx) => (
                  <div key={ch.id} className="bg-[#090C11] border border-[#1E2736] rounded-lg p-2.5 space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-300">Charge q{idx + 1}</span>
                      <span className={ch.q >= 0 ? 'text-amber-300' : 'text-cyan-300'}>
                        {ch.q > 0 ? `+${ch.q}` : ch.q} µC
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-10"
                      max="10"
                      step="1"
                      value={ch.q}
                      onChange={(e) =>
                        setCharges((prev) =>
                          prev.map((c) => (c.id === ch.id ? { ...c, q: Number(e.target.value) } : c))
                        )
                      }
                      className="w-full accent-cyan-400"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setCharges((prev) => [
                      ...prev,
                      { id: `q_${Date.now()}`, x: 0, y: 1.8, q: 3 },
                    ])
                  }
                  className="w-full py-2 text-xs font-medium rounded-lg bg-[#161E2B] text-slate-200 border border-[#263245]"
                >
                  Add Point Charge
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-8 bg-[#090C11] border border-[#1E2736] rounded-xl overflow-hidden min-h-[360px]">
            {physicsSim === 'projectile' ? (
              <canvas ref={projCanvasRef} className="w-full h-full block" />
            ) : (
              <canvas
                ref={efieldCanvasRef}
                className="w-full h-full block touch-none cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const scale = Math.min(rect.width, rect.height) / 10;
                  const wx = (e.clientX - rect.left - rect.width / 2) / scale;
                  const wy = (rect.height / 2 - (e.clientY - rect.top)) / scale;
                  const hit = charges.find((c) => Math.hypot(c.x - wx, c.y - wy) < 0.7);
                  if (hit) dragChargeRef.current = hit.id;
                }}
                onPointerMove={(e) => {
                  if (!dragChargeRef.current) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const scale = Math.min(rect.width, rect.height) / 10;
                  const wx = (e.clientX - rect.left - rect.width / 2) / scale;
                  const wy = (rect.height / 2 - (e.clientY - rect.top)) / scale;
                  setCharges((prev) =>
                    prev.map((c) => (c.id === dragChargeRef.current ? { ...c, x: wx, y: wy } : c))
                  );
                }}
                onPointerUp={() => {
                  dragChargeRef.current = null;
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* CHEMISTRY LAB */}
      {domain === 'chemistry' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
          <div className="lg:col-span-5 bg-[#10151E] border border-[#1E2736] rounded-xl p-4 space-y-4 overflow-y-auto">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">3D VSEPR Molecular Structure</h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {MOLECULE_CATALOG.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMolId(m.id)}
                    className={`py-2 px-2 rounded-lg text-xs font-mono border transition-colors ${
                      molId === m.id
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-semibold'
                        : 'bg-[#090C11] border-[#1E2736] text-slate-300 hover:bg-[#161E2B]'
                    }`}
                  >
                    {m.formula}
                  </button>
                ))}
              </div>
              <div className="bg-[#090C11] border border-[#1E2736] rounded-lg p-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-slate-400">Geometry</div>
                  <div className="text-white font-medium mt-0.5">{activeMolecule.geometry}</div>
                </div>
                <div>
                  <div className="text-slate-400">Bond Angle</div>
                  <div className="font-mono text-cyan-300 mt-0.5">{activeMolecule.bondAngle}</div>
                </div>
                <div>
                  <div className="text-slate-400">Molar Mass</div>
                  <div className="font-mono text-amber-300 mt-0.5">{activeMolecule.molarMass} g/mol</div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1E2736] space-y-2">
              <h3 className="text-sm font-semibold text-white">Molar Mass Formula Parser</h3>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  aria-label="Chemical formula"
                  value={chemFormula}
                  onChange={(e) => setChemFormula(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#090C11] border border-[#1E2736] font-mono text-sm text-white"
                />
                <div className="px-3 py-2 rounded-lg bg-[#090C11] border border-[#1E2736] font-mono text-sm text-cyan-300">
                  {molarMassRes.error ? molarMassRes.error : `${molarMassRes.mass} g/mol`}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1E2736] space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Ideal Gas Law (PV = nRT)</h3>
                <select
                  aria-label="Solve ideal gas variable"
                  value={gasSolveFor}
                  onChange={(e) => setGasSolveFor(e.target.value as 'P' | 'V' | 'n' | 'T')}
                  className="px-2 py-1 text-xs font-mono rounded bg-[#090C11] border border-[#1E2736] text-cyan-300"
                >
                  <option value="P">Solve P (atm)</option>
                  <option value="V">Solve V (L)</option>
                  <option value="n">Solve n (mol)</option>
                  <option value="T">Solve T (K)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(
                  [
                    ['P (atm)', gasP, setGasP, gasSolveFor === 'P'],
                    ['V (L)', gasV, setGasV, gasSolveFor === 'V'],
                    ['n (mol)', gasN, setGasN, gasSolveFor === 'n'],
                    ['T (K)', gasT, setGasT, gasSolveFor === 'T'],
                  ] as [string, number, React.Dispatch<React.SetStateAction<number>>, boolean][]
                ).map(([lbl, val, setter, disabled]) => (
                  <label key={lbl} className="block space-y-1">
                    <span className="text-slate-400">{lbl}</span>
                    <input
                      type="number"
                      step="any"
                      disabled={disabled}
                      value={disabled ? Number(solvedGas.toFixed(4)) : val}
                      onChange={(e) => setter(Number(e.target.value))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-sm ${
                        disabled
                          ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                          : 'bg-[#090C11] border-[#1E2736] text-white'
                      }`}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[#1E2736] space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Acid Equilibrium pH</h3>
                <button
                  type="button"
                  onClick={() => setStrongAcid((v) => !v)}
                  className="text-xs font-mono px-2 py-1 rounded bg-[#090C11] border border-[#1E2736] text-slate-300"
                >
                  {strongAcid ? 'Strong Acid' : 'Weak Acid'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <label className="space-y-1">
                  <span className="text-slate-400">[HA] (M)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={acidMolarity}
                    onChange={(e) => setAcidMolarity(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded bg-[#090C11] border border-[#1E2736] font-mono text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">pKa</span>
                  <input
                    type="number"
                    step="0.1"
                    disabled={strongAcid}
                    value={acidPKa}
                    onChange={(e) => setAcidPKa(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded bg-[#090C11] border border-[#1E2736] font-mono text-white disabled:opacity-40"
                  />
                </label>
                <div className="bg-[#090C11] border border-[#1E2736] rounded p-2 flex flex-col justify-center">
                  <span className="text-slate-400">pH / pOH</span>
                  <span className="font-mono text-cyan-300">
                    {phRes.ph.toFixed(2)} / {phRes.poh.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 relative bg-[#090C11] border border-[#1E2736] rounded-xl overflow-hidden min-h-[360px]">
            <div ref={molMountRef} className="w-full h-full" />
            <div className="absolute top-3 left-3 bg-[#10151E]/95 border border-[#1E2736] rounded-lg px-3 py-1.5 text-xs font-mono text-slate-300 pointer-events-none">
              {activeMolecule.name} ({activeMolecule.formula}) · Drag to orbit 3D geometry
            </div>
          </div>
        </div>
      )}

      {/* ELECTRICAL & ENGINEERING LAB */}
      {domain === 'electrical' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
          <div className="lg:col-span-5 bg-[#10151E] border border-[#1E2736] rounded-xl p-4 space-y-4 overflow-y-auto">
            <h3 className="text-sm font-semibold text-white">Series RLC AC Circuit Analyzer</h3>
            <div className="space-y-2.5">
              {(
                [
                  ['Resistance R (Ω)', rlcR, 1, 200, 1, setRlcR],
                  ['Inductance L (mH)', rlcL, 1, 100, 1, setRlcL],
                  ['Capacitance C (µF)', rlcC, 1, 100, 1, setRlcC],
                  ['Source Frequency f (Hz)', rlcFreq, 50, 2000, 5, setRlcFreq],
                  ['Source Voltage Vrms (V)', rlcV, 1, 240, 1, setRlcV],
                ] as [string, number, number, number, number, React.Dispatch<React.SetStateAction<number>>][]
              ).map(([lbl, val, min, max, step, setter]) => (
                <label key={lbl} className="block space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">{lbl}</span>
                    <span className="font-mono text-cyan-300">{val}</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={val}
                    onChange={(e) => setter(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[#1E2736] font-mono text-xs">
              <div className="bg-[#090C11] border border-[#1E2736] rounded-lg p-2.5">
                <div className="text-slate-400">Impedance |Z|</div>
                <div className="text-cyan-300 text-sm mt-0.5">{rlc.zMag.toFixed(2)} Ω</div>
              </div>
              <div className="bg-[#090C11] border border-[#1E2736] rounded-lg p-2.5">
                <div className="text-slate-400">Phase φ</div>
                <div className="text-amber-300 text-sm mt-0.5">{rlc.phaseDeg.toFixed(1)}°</div>
              </div>
              <div className="bg-[#090C11] border border-[#1E2736] rounded-lg p-2.5">
                <div className="text-slate-400">Resonance f₀</div>
                <div className="text-white text-sm mt-0.5">{rlc.resonantHz.toFixed(1)} Hz</div>
              </div>
              <div className="bg-[#090C11] border border-[#1E2736] rounded-lg p-2.5">
                <div className="text-slate-400">Current Irms</div>
                <div className="text-white text-sm mt-0.5">{rlc.currentA.toFixed(3)} A</div>
              </div>
              <div className="bg-[#090C11] border border-[#1E2736] rounded-lg p-2.5">
                <div className="text-slate-400">Real Power P</div>
                <div className="text-emerald-300 text-sm mt-0.5">{rlc.realPowerW.toFixed(2)} W</div>
              </div>
              <div className="bg-[#090C11] border border-[#1E2736] rounded-lg p-2.5">
                <div className="text-slate-400">Q-Factor</div>
                <div className="text-white text-sm mt-0.5">{rlc.qFactor.toFixed(2)}</div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1E2736] space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Structural Steel Beam Solver</h3>
                <button
                  type="button"
                  onClick={() =>
                    setBeamSupport((s) => (s === 'cantilever' ? 'simply-supported' : 'cantilever'))
                  }
                  className="text-xs font-mono px-2.5 py-1 rounded bg-[#090C11] border border-[#1E2736] text-cyan-300"
                >
                  {beamSupport === 'cantilever' ? 'Cantilever' : 'Simply Supported'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="space-y-1">
                  <span className="text-slate-400">Span Length (m)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={beamLen}
                    onChange={(e) => setBeamLen(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-[#090C11] border border-[#1E2736] font-mono text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">Point Load (N)</span>
                  <input
                    type="number"
                    step="50"
                    value={beamLoad}
                    onChange={(e) => setBeamLoad(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-[#090C11] border border-[#1E2736] font-mono text-white"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="bg-[#090C11] border border-[#1E2736] rounded p-2">
                  <span className="text-slate-400">Max Deflection: </span>
                  <span className="text-cyan-300">{beamRes.deflectionMm.toFixed(3)} mm</span>
                </div>
                <div className="bg-[#090C11] border border-[#1E2736] rounded p-2">
                  <span className="text-slate-400">Bending Stress: </span>
                  <span className="text-amber-300">{beamRes.maxStressMPa.toFixed(2)} MPa</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-[#090C11] border border-[#1E2736] rounded-xl overflow-hidden min-h-[340px]">
            <canvas ref={scopeCanvasRef} className="w-full h-full block" />
          </div>
        </div>
      )}

      {/* COMPUTER SCIENCE LAB */}
      {domain === 'cs' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
          <div className="lg:col-span-5 bg-[#10151E] border border-[#1E2736] rounded-xl p-4 space-y-4 overflow-y-auto">
            <h3 className="text-sm font-semibold text-white">Boolean Logic & Truth Table</h3>
            <input
              type="text"
              aria-label="Boolean expression"
              value={boolExpr}
              onChange={(e) => setBoolExpr(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#090C11] border border-[#1E2736] font-mono text-sm text-white"
            />
            {truthTable.error ? (
              <div className="text-xs font-mono text-amber-400">{truthTable.error}</div>
            ) : (
              <div className="overflow-x-auto max-h-[260px] border border-[#1E2736] rounded-lg">
                <table className="w-full text-xs font-mono text-center">
                  <thead className="bg-[#090C11] text-slate-400 border-b border-[#1E2736]">
                    <tr>
                      {truthTable.variables.map((v) => (
                        <th key={v} className="py-2 px-2">
                          {v}
                        </th>
                      ))}
                      <th className="py-2 px-2 text-cyan-300">OUT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {truthTable.rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-[#161E2B] last:border-none">
                        {truthTable.variables.map((v) => (
                          <td key={v} className="py-1.5 px-2 text-slate-300">
                            {row.inputs[v] ? '1' : '0'}
                          </td>
                        ))}
                        <td
                          className={`py-1.5 px-2 font-semibold ${
                            row.output ? 'text-cyan-300' : 'text-slate-500'
                          }`}
                        >
                          {row.output ? '1' : '0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 bg-[#10151E] border border-[#1E2736] rounded-xl p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-[#090C11] p-1 rounded-lg border border-[#1E2736]">
                {(['astar', 'dijkstra', 'bfs'] as const).map((alg) => (
                  <button
                    key={alg}
                    type="button"
                    onClick={() => {
                      setPfAlgo(alg);
                      setPfStep(0);
                    }}
                    className={`px-3 py-1 text-xs font-mono uppercase rounded-md ${
                      pfAlgo === alg ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {alg === 'astar' ? 'A*' : alg}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPfStep(0)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                >
                  Animate Search
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWalls(Array.from({ length: 12 }, () => Array(18).fill(false)));
                    setPfStep(999);
                  }}
                  className="px-2.5 py-1.5 text-xs rounded-lg bg-[#090C11] text-slate-300 border border-[#1E2736] flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear Walls
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Tap grid cells to toggle obstacle walls</span>
              <span className="font-mono text-cyan-300">
                Visited: {pfResult.visited.length} · Shortest Path: {pfResult.path.length || 'Blocked'}
              </span>
            </div>

            <div
              className="grid gap-1 flex-1 content-center"
              style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))' }}
            >
              {walls.map((row, r) =>
                row.map((isWall, c) => {
                  const isStart = r === pfStart.r && c === pfStart.c;
                  const isEnd = r === pfEnd.r && c === pfEnd.c;
                  const k = `${r},${c}`;
                  const isPath = pathSet.has(k);
                  const isVisited = visitedSlice.has(k);

                  return (
                    <button
                      key={k}
                      type="button"
                      aria-label={`Grid cell ${r},${c}`}
                      onClick={() => {
                        if (isStart || isEnd) return;
                        setWalls((prev) =>
                          prev.map((wr, ri) =>
                            ri === r ? wr.map((val, ci) => (ci === c ? !val : val)) : wr
                          )
                        );
                      }}
                      className={`aspect-square rounded-[3px] transition-colors ${
                        isStart
                          ? 'bg-emerald-400'
                          : isEnd
                          ? 'bg-rose-500'
                          : isWall
                          ? 'bg-slate-600'
                          : isPath
                          ? 'bg-amber-400'
                          : isVisited
                          ? 'bg-cyan-500/40'
                          : 'bg-[#090C11] hover:bg-[#1A2230]'
                      }`}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
