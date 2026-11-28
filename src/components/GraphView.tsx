import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Play,
  Pause,
  RotateCcw,
  BookmarkPlus,
  Check,
  SlidersHorizontal,
} from 'lucide-react';
import {
  compileGraphExpression,
  numericalDerivative,
  numericalIntegral,
  type AngleMode,
} from '../engine/mathEngine';
import {
  detectSoftwareGl,
  createAdaptiveRenderer,
  createAfterDrawScheduler,
} from '../utils/webglGuard';
import { useCloudSync } from '../context/CloudSyncContext';

interface GraphCurve {
  id: string;
  expression: string;
  color: string;
  visible: boolean;
}

const CURVE_PALETTE = ['#4C8DFF', '#F59E0B', '#34D399', '#A78BFA', '#EF6A6A'];

export function GraphView({ initialExpression }: { initialExpression?: string }) {
  const { saveFormula } = useCloudSync();

  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  const [angleMode, setAngleMode] = useState<AngleMode>('rad');
  const [curves, setCurves] = useState<GraphCurve[]>([
    {
      id: 'c1',
      expression: initialExpression || 'a * sin(b * x) * exp(-0.08 * x^2)',
      color: '#4C8DFF',
      visible: true,
    },
    {
      id: 'c2',
      expression: 'r = 2.4 * cos(3 * theta)',
      color: '#F59E0B',
      visible: true,
    },
  ]);
  const [expr3D, setExpr3D] = useState('1.5 * sin(sqrt(x^2 + y^2) - a) * exp(-0.04 * (x^2 + y^2))');
  const [paramA, setParamA] = useState(1.8);
  const [paramB, setParamB] = useState(2.2);
  const [animating, setAnimating] = useState(false);
  const [showDerivative, setShowDerivative] = useState(false);
  const [showIntegral, setShowIntegral] = useState(false);
  const [tracePoint, setTracePoint] = useState<{ x: number; y: number; slope: number | null } | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);

  // Sync external expression if sent from Calculator
  useEffect(() => {
    if (!initialExpression) return;
    setCurves((prev) => {
      if (prev.some((c) => c.expression === initialExpression)) return prev;
      return [
        {
          id: `c_${Date.now()}`,
          expression: initialExpression,
          color: CURVE_PALETTE[prev.length % CURVE_PALETTE.length],
          visible: true,
        },
        ...prev,
      ];
    });
  }, [initialExpression]);

  // Animate parameter A smoothly when Play is enabled
  useEffect(() => {
    if (!animating) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      setParamA(Number((1.5 + Math.sin(t * 1.4) * 1.3).toFixed(2)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animating]);

  // --- 2D HIGH-DPI CANVAS PLOTTER WITH PINCH/PAN GESTURES ---
  const canvas2DRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef({ cx: 0, cy: 0, scale: 52 }); // pixels per unit
  const pointerStateRef = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    lastPan: { x: number; y: number } | null;
    lastPinchDist: number | null;
  }>({
    pointers: new Map(),
    lastPan: null,
    lastPinchDist: null,
  });

  const draw2D = useCallback(() => {
    const canvas = canvas2DRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.floor(rect.width * dpr);
    const targetH = Math.floor(rect.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    const { cx, cy, scale } = viewRef.current;
    const originX = w / 2 - cx * scale;
    const originY = h / 2 + cy * scale;

    const toScreenX = (x: number) => originX + x * scale;
    const toScreenY = (y: number) => originY - y * scale;
    const toWorldX = (sx: number) => (sx - originX) / scale;

    // Background
    ctx.fillStyle = '#111318';
    ctx.fillRect(0, 0, w, h);

    // Adaptive grid step
    const rawStep = 80 / scale;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    const step = norm < 2 ? mag : norm < 5 ? 2 * mag : 5 * mag;
    const subStep = step / 4;

    const xMin = toWorldX(0);
    const xMax = toWorldX(w);
    const yMin = (originY - h) / scale;
    const yMax = originY / scale;

    // Minor grid
    ctx.strokeStyle = '#1A1E24';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.floor(xMin / subStep) * subStep; x <= xMax; x += subStep) {
      const sx = toScreenX(x);
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
    }
    for (let y = Math.floor(yMin / subStep) * subStep; y <= yMax; y += subStep) {
      const sy = toScreenY(y);
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
    }
    ctx.stroke();

    // Major grid
    ctx.strokeStyle = '#22252C';
    ctx.beginPath();
    for (let x = Math.floor(xMin / step) * step; x <= xMax; x += step) {
      const sx = toScreenX(x);
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
    }
    for (let y = Math.floor(yMin / step) * step; y <= yMax; y += step) {
      const sy = toScreenY(y);
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
    }
    ctx.stroke();

    // Axes
    ctx.strokeStyle = '#3B404B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (originX >= 0 && originX <= w) {
      ctx.moveTo(originX, 0);
      ctx.lineTo(originX, h);
    }
    if (originY >= 0 && originY <= h) {
      ctx.moveTo(0, originY);
      ctx.lineTo(w, originY);
    }
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#6B7079';
    ctx.font = '11px "Geist Mono", monospace';
    for (let x = Math.floor(xMin / step) * step; x <= xMax; x += step) {
      if (Math.abs(x) < step * 0.1) continue;
      const sx = toScreenX(x);
      const labelY = Math.min(Math.max(originY + 14, 14), h - 6);
      ctx.fillText(Number(x.toPrecision(4)).toString(), sx + 3, labelY);
    }
    for (let y = Math.floor(yMin / step) * step; y <= yMax; y += step) {
      if (Math.abs(y) < step * 0.1) continue;
      const sy = toScreenY(y);
      const labelX = Math.min(Math.max(originX + 6, 6), w - 34);
      ctx.fillText(Number(y.toPrecision(4)).toString(), labelX, sy - 4);
    }

    const params = { a: paramA, b: paramB, c: 1 };

    // Optional shaded integral on first cartesian curve [0, 3]
    if (showIntegral && curves[0]?.visible) {
      const compiled = compileGraphExpression(curves[0].expression, angleMode, false);
      if (compiled.kind === 'cartesian' && compiled.eval2D) {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.16)';
        ctx.beginPath();
        const aBound = 0;
        const bBound = 3;
        ctx.moveTo(toScreenX(aBound), toScreenY(0));
        for (let i = 0; i <= 120; i++) {
          const wx = aBound + ((bBound - aBound) * i) / 120;
          const wy = compiled.eval2D(wx, params);
          if (Number.isFinite(wy)) {
            ctx.lineTo(toScreenX(wx), toScreenY(wy));
          }
        }
        ctx.lineTo(toScreenX(bBound), toScreenY(0));
        ctx.closePath();
        ctx.fill();
      }
    }

    // Plot curves
    for (const curve of curves) {
      if (!curve.visible || !curve.expression.trim()) continue;
      const compiled = compileGraphExpression(curve.expression, angleMode, false);
      if (compiled.error) continue;

      ctx.strokeStyle = curve.color;
      ctx.lineWidth = 2.25;
      ctx.beginPath();

      if (compiled.kind === 'cartesian' && compiled.eval2D) {
        const samples = Math.min(900, Math.max(300, Math.floor(w * 1.5)));
        let penDown = false;
        let prevSy = 0;
        for (let i = 0; i <= samples; i++) {
          const sx = (w * i) / samples;
          const wx = toWorldX(sx);
          const wy = compiled.eval2D(wx, params);
          if (!Number.isFinite(wy) || Math.abs(wy) > 1e5) {
            penDown = false;
            continue;
          }
          const sy = toScreenY(wy);
          if (penDown && Math.abs(sy - prevSy) > h * 1.2) {
            penDown = false;
          }
          if (!penDown) {
            ctx.moveTo(sx, sy);
            penDown = true;
          } else {
            ctx.lineTo(sx, sy);
          }
          prevSy = sy;
        }
        ctx.stroke();

        // Derivative overlay
        if (showDerivative) {
          ctx.save();
          ctx.strokeStyle = '#8A9099';
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          let dPen = false;
          for (let i = 0; i <= samples; i += 2) {
            const sx = (w * i) / samples;
            const wx = toWorldX(sx);
            const dy = numericalDerivative((x) => compiled.eval2D!(x, params), wx);
            if (!Number.isFinite(dy) || Math.abs(dy) > 1e5) {
              dPen = false;
              continue;
            }
            const sy = toScreenY(dy);
            if (!dPen) {
              ctx.moveTo(sx, sy);
              dPen = true;
            } else {
              ctx.lineTo(sx, sy);
            }
          }
          ctx.stroke();
          ctx.restore();
        }
      } else if (compiled.kind === 'polar' && compiled.eval2D) {
        const steps = 600;
        const maxTheta = Math.PI * 2;
        let pen = false;
        for (let i = 0; i <= steps; i++) {
          const theta = (maxTheta * i) / steps;
          const r = compiled.eval2D(theta, params);
          if (!Number.isFinite(r)) {
            pen = false;
            continue;
          }
          const sx = toScreenX(r * Math.cos(theta));
          const sy = toScreenY(r * Math.sin(theta));
          if (!pen) {
            ctx.moveTo(sx, sy);
            pen = true;
          } else {
            ctx.lineTo(sx, sy);
          }
        }
        ctx.stroke();
      } else if (compiled.kind === 'parametric' && compiled.evalParametric) {
        const steps = 600;
        const maxT = Math.PI * 2;
        let pen = false;
        for (let i = 0; i <= steps; i++) {
          const t = (maxT * i) / steps;
          const [px, py] = compiled.evalParametric(t, params);
          if (!Number.isFinite(px) || !Number.isFinite(py)) {
            pen = false;
            continue;
          }
          const sx = toScreenX(px);
          const sy = toScreenY(py);
          if (!pen) {
            ctx.moveTo(sx, sy);
            pen = true;
          } else {
            ctx.lineTo(sx, sy);
          }
        }
        ctx.stroke();
      }
    }

    // Trace crosshair & tangent line
    if (tracePoint) {
      const sx = toScreenX(tracePoint.x);
      const sy = toScreenY(tracePoint.y);
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();

      if (tracePoint.slope !== null && Number.isFinite(tracePoint.slope)) {
        const dx = 1.6;
        const x1 = tracePoint.x - dx;
        const y1 = tracePoint.y - tracePoint.slope * dx;
        const x2 = tracePoint.x + dx;
        const y2 = tracePoint.y + tracePoint.slope * dx;
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(toScreenX(x1), toScreenY(y1));
        ctx.lineTo(toScreenX(x2), toScreenY(y2));
        ctx.stroke();
      }

      ctx.fillStyle = '#4C8DFF';
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [curves, angleMode, paramA, paramB, showDerivative, showIntegral, tracePoint]);

  useEffect(() => {
    if (mode !== '2d') return;
    draw2D();
    const onResize = () => draw2D();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [mode, draw2D]);

  const updateTraceAtClient = (clientX: number) => {
    const canvas = canvas2DRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { cx, scale } = viewRef.current;
    const originX = rect.width / 2 - cx * scale;
    const wx = (clientX - rect.left - originX) / scale;

    const first = curves.find((c) => c.visible);
    if (!first) return;
    const compiled = compileGraphExpression(first.expression, angleMode, false);
    if (compiled.kind === 'cartesian' && compiled.eval2D) {
      const params = { a: paramA, b: paramB, c: 1 };
      const wy = compiled.eval2D(wx, params);
      if (Number.isFinite(wy)) {
        const slope = numericalDerivative((x) => compiled.eval2D!(x, params), wx);
        setTracePoint({ x: wx, y: wy, slope });
      }
    }
  };

  // --- 3D THREE.JS SURFACE RENDERER ---
  const mount3DRef = useRef<HTMLDivElement | null>(null);
  const expr3DRef = useRef(expr3D);
  const paramARef = useRef(paramA);
  const angleModeRef = useRef(angleMode);
  const request3DRenderRef = useRef<(() => void) | null>(null);
  const updateSurfaceRef = useRef<(() => void) | null>(null);

  expr3DRef.current = expr3D;
  paramARef.current = paramA;
  angleModeRef.current = angleMode;

  useEffect(() => {
    if (mode !== '3d') return;
    const container = mount3DRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const renderer = createAdaptiveRenderer(isSoftwareGl);
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0C0E11');
    scene.fog = new THREE.Fog('#0C0E11', 22, 48);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 120);
    camera.position.set(11, 9, 12);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0, 0);

    // 3-point warm/cool studio lighting
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.85);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0xfff1e6, 2.0);
    keyLight.position.set(8, 14, 10);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x22d3ee, 0.9);
    rimLight.position.set(-10, 6, -8);
    scene.add(rimLight);

    const grid = new THREE.GridHelper(12, 12, 0x334155, 0x1a2230);
    grid.position.y = -2.2;
    scene.add(grid);

    const axes = new THREE.AxesHelper(6.5);
    scene.add(axes);

    // Surface mesh
    const segs = 56;
    const surfaceGeo = new THREE.PlaneGeometry(10, 10, segs, segs);
    surfaceGeo.rotateX(-Math.PI / 2);

    const posCount = surfaceGeo.attributes.position.count;
    const colorAttr = new THREE.BufferAttribute(new Float32Array(posCount * 3), 3);
    surfaceGeo.setAttribute('color', colorAttr);

    const surfaceMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.35,
      metalness: 0.25,
      side: THREE.DoubleSide,
    });
    const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    scene.add(surfaceMesh);

    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const wireMesh = new THREE.Mesh(surfaceGeo, wireMat);
    wireMesh.position.y = 0.008;
    scene.add(wireMesh);

    const lowColor = new THREE.Color('#2C5AA8');
    const midColor = new THREE.Color('#4C8DFF');
    const highColor = new THREE.Color('#F59E0B');
    const tmpColor = new THREE.Color();

    const rebuildSurface = () => {
      const compiled = compileGraphExpression(expr3DRef.current, angleModeRef.current, true);
      const pos = surfaceGeo.attributes.position;
      const col = surfaceGeo.attributes.color;
      const params = { a: paramARef.current, b: 1, c: 1 };

      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        let y = 0;
        if (compiled.eval3D) {
          const val = compiled.eval3D(x, z, params);
          if (Number.isFinite(val)) y = THREE.MathUtils.clamp(val, -4, 4);
        }
        pos.setY(i, y);

        const t = THREE.MathUtils.clamp((y + 2) / 4, 0, 1);
        if (t < 0.5) {
          tmpColor.lerpColors(lowColor, midColor, t * 2);
        } else {
          tmpColor.lerpColors(midColor, highColor, (t - 0.5) * 2);
        }
        col.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      surfaceGeo.computeVertexNormals();
    };

    rebuildSurface();
    updateSurfaceRef.current = () => {
      rebuildSurface();
      requestRender();
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

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

    request3DRenderRef.current = requestRender;
    controls.addEventListener('change', requestRender);
    requestRender();

    const onResize = () => {
      if (!container) return;
      const nw = container.clientWidth || 800;
      const nh = container.clientHeight || 520;
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
      surfaceGeo.dispose();
      surfaceMat.dispose();
      wireMat.dispose();
      renderer.dispose();
    };
  }, [mode]);

  useEffect(() => {
    if (mode === '3d') {
      updateSurfaceRef.current?.();
    }
  }, [mode, expr3D, paramA, angleMode]);

  const integralEstimate =
    showIntegral && curves[0]
      ? numericalIntegral(curves[0].expression, 0, 3, 120, angleMode)
      : null;

  return (
    <div className="h-full flex flex-col lg:flex-row gap-3 p-3 md:p-4 max-w-[1440px] mx-auto w-full overflow-hidden">
      {/* Left Expression & Sliders Sidebar */}
      <aside
        className={`lg:w-[350px] shrink-0 panel p-4 flex flex-col gap-4 overflow-y-auto ${
          mobilePanelOpen ? 'max-h-[48vh]' : 'max-h-[210px] lg:max-h-none'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded-[10px] border border-[#23262E]">
            <button
              type="button"
              onClick={() => setMode('2d')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === '2d' ? 'bg-[#24272F] text-white' : 'text-[#9EA3AC] hover:text-white'
              }`}
            >
              2D Plotter
            </button>
            <button
              type="button"
              onClick={() => setMode('3d')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === '3d' ? 'bg-[#24272F] text-white' : 'text-[#9EA3AC] hover:text-white'
              }`}
            >
              3D Surface
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobilePanelOpen((v) => !v)}
            className="lg:hidden px-2.5 py-1.5 text-xs rounded-lg bg-[#1A1D24] text-zinc-300 flex items-center gap-1"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {mobilePanelOpen ? 'Compact' : 'Expand'}
          </button>

          <button
            type="button"
            onClick={() => setAngleMode((m) => (m === 'rad' ? 'deg' : 'rad'))}
            className="chip hidden lg:inline-flex hover:border-[#3B404B] hover:text-white"
          >
            {angleMode.toUpperCase()}
          </button>
        </div>

        {mode === '2d' ? (
          <div className="space-y-2.5">
            {curves.map((curve, idx) => {
              const compiled = compileGraphExpression(curve.expression, angleMode, false);
              return (
                <div
                  key={curve.id}
                  className="panel-inset p-2.5 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Toggle curve ${idx + 1} visibility`}
                      onClick={() =>
                        setCurves((prev) =>
                          prev.map((c) => (c.id === curve.id ? { ...c, visible: !c.visible } : c))
                        )
                      }
                      className="p-1.5 rounded-md hover:bg-[#1A1D24] shrink-0"
                      style={{ color: curve.visible ? curve.color : '#475569' }}
                    >
                      {curve.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <input
                      type="text"
                      aria-label={`Curve ${idx + 1} equation`}
                      value={curve.expression}
                      onChange={(e) =>
                        setCurves((prev) =>
                          prev.map((c) => (c.id === curve.id ? { ...c, expression: e.target.value } : c))
                        )
                      }
                      className="flex-1 bg-transparent font-mono text-xs md:text-sm text-white focus:outline-none min-w-0"
                    />
                    {curves.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove curve ${idx + 1}`}
                        onClick={() => setCurves((prev) => prev.filter((c) => c.id !== curve.id))}
                        className="p-1.5 rounded-md text-zinc-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {compiled.error && curve.expression.trim() && (
                    <div className="text-[11px] font-mono text-amber-400 pl-8">{compiled.error}</div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() =>
                setCurves((prev) => [
                  ...prev,
                  {
                    id: `c_${Date.now()}`,
                    expression: '(a * cos(t), b * sin(t))',
                    color: CURVE_PALETTE[prev.length % CURVE_PALETTE.length],
                    visible: true,
                  },
                ])
              }
              className="w-full py-2 rounded-lg border border-dashed border-[#333844] hover:border-blue-500/50 text-xs font-medium text-zinc-300 hover:text-blue-300 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Cartesian / Polar / Parametric
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-xs text-zinc-400">3D Surface z = f(x, y)</span>
              <input
                type="text"
                value={expr3D}
                onChange={(e) => setExpr3D(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#0C0E11] border border-[#24272F] font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                ['Radial Wave', '1.5 * sin(sqrt(x^2 + y^2) - a) * exp(-0.04 * (x^2 + y^2))'],
                ['Hyperbolic Saddle', '0.18 * (x^2 - y^2)'],
                ['Egg Carton', '0.8 * sin(x) * cos(y)'],
              ].map(([name, fn]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setExpr3D(fn)}
                  className="px-2.5 py-1 text-[11px] rounded-md bg-[#0C0E11] border border-[#24272F] text-zinc-300 hover:text-blue-300"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Parameter Sliders */}
        <div className="pt-3 border-t border-[#24272F] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">Parameter Sliders</span>
            <button
              type="button"
              onClick={() => setAnimating((v) => !v)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-[#1A1D24] text-blue-300 hover:bg-[#2A2E37]"
            >
              {animating ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {animating ? 'Pause' : 'Animate'}
            </button>
          </div>

          <label className="block space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-400">a</span>
              <span className="text-blue-300">{paramA.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="-5"
              max="5"
              step="0.05"
              value={paramA}
              onChange={(e) => setParamA(Number(e.target.value))}
              className="w-full accent-blue-400"
            />
          </label>

          <label className="block space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-400">b</span>
              <span className="text-amber-300">{paramB.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="8"
              step="0.1"
              value={paramB}
              onChange={(e) => setParamB(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
          </label>
        </div>

        {/* Calculus & Save Controls */}
        {mode === '2d' && (
          <div className="pt-3 border-t border-[#24272F] space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowDerivative((v) => !v)}
                className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                  showDerivative
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                    : 'bg-[#0C0E11] border-[#24272F] text-zinc-400'
                }`}
              >
                Plot f&apos;(x)
              </button>
              <button
                type="button"
                onClick={() => setShowIntegral((v) => !v)}
                className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                  showIntegral
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                    : 'bg-[#0C0E11] border-[#24272F] text-zinc-400'
                }`}
              >
                ∫ [0, 3] Area
              </button>
            </div>
            {integralEstimate !== null && Number.isFinite(integralEstimate) && (
              <div className="text-xs font-mono text-blue-300 panel-inset px-3 py-2">
                ∫₀³ f(x) dx = {integralEstimate.toFixed(5)}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={async () => {
            await saveFormula({
              expression: mode === '2d' ? curves[0]?.expression || 'sin(x)' : expr3D,
              label: mode === '2d' ? '2D Graph Curve' : '3D Surface Plot',
              mode: mode === '2d' ? 'graph2d' : 'graph3d',
              color: '#4C8DFF',
            });
            setSavedFlag(true);
            setTimeout(() => setSavedFlag(false), 1400);
          }}
          className="mt-auto btn mt-auto h-9 w-full justify-center"
        >
          {savedFlag ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />}
          {savedFlag ? 'Synced to Cloud' : 'Save Graph to Cloud'}
        </button>
      </aside>

      {/* Main Graph Viewport */}
      <div className="flex-1 relative panel panel-inset overflow-hidden min-h-[380px]">
        {mode === '2d' ? (
          <>
            <canvas
              ref={canvas2DRef}
              data-testid="graph-2d-canvas"
              className="w-full h-full block cursor-crosshair touch-none"
              onPointerDown={(e) => {
                (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
                pointerStateRef.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (pointerStateRef.current.pointers.size === 1) {
                  pointerStateRef.current.lastPan = { x: e.clientX, y: e.clientY };
                }
              }}
              onPointerMove={(e) => {
                const ps = pointerStateRef.current;
                ps.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (ps.pointers.size === 2) {
                  const pts = Array.from(ps.pointers.values()) as { x: number; y: number }[];
                  const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                  if (ps.lastPinchDist !== null && dist > 10) {
                    const factor = dist / ps.lastPinchDist;
                    viewRef.current.scale = Math.min(280, Math.max(12, viewRef.current.scale * factor));
                    draw2D();
                  }
                  ps.lastPinchDist = dist;
                } else if (ps.pointers.size === 1 && ps.lastPan) {
                  const dx = e.clientX - ps.lastPan.x;
                  const dy = e.clientY - ps.lastPan.y;
                  viewRef.current.cx -= dx / viewRef.current.scale;
                  viewRef.current.cy += dy / viewRef.current.scale;
                  ps.lastPan = { x: e.clientX, y: e.clientY };
                  draw2D();
                } else {
                  updateTraceAtClient(e.clientX);
                }
              }}
              onPointerUp={(e) => {
                const ps = pointerStateRef.current;
                ps.pointers.delete(e.pointerId);
                if (ps.pointers.size < 2) ps.lastPinchDist = null;
                if (ps.pointers.size === 0) ps.lastPan = null;
              }}
              onWheel={(e) => {
                e.preventDefault();
                const zoom = e.deltaY < 0 ? 1.12 : 0.89;
                viewRef.current.scale = Math.min(280, Math.max(12, viewRef.current.scale * zoom));
                draw2D();
              }}
              onDoubleClick={() => {
                viewRef.current = { cx: 0, cy: 0, scale: 52 };
                draw2D();
              }}
            />

            {/* Floating Coordinate HUD */}
            <div className="absolute top-3 left-3 bg-[#12141A]/95 border border-[#24272F] rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-300 flex items-center gap-3 pointer-events-none">
              {tracePoint ? (
                <>
                  <span>x: {tracePoint.x.toFixed(3)}</span>
                  <span className="text-blue-300">y: {tracePoint.y.toFixed(3)}</span>
                  {tracePoint.slope !== null && Number.isFinite(tracePoint.slope) && (
                    <span className="text-amber-300">f&apos;: {tracePoint.slope.toFixed(3)}</span>
                  )}
                </>
              ) : (
                <span>Drag to pan · Pinch or wheel to zoom · Hover to trace</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                viewRef.current = { cx: 0, cy: 0, scale: 52 };
                draw2D();
              }}
              aria-label="Reset 2D viewport"
              className="absolute bottom-3 right-3 px-3 py-2 rounded-lg bg-[#12141A]/95 border border-[#24272F] text-xs font-medium text-zinc-200 hover:text-white flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset View
            </button>
          </>
        ) : (
          <>
            <div ref={mount3DRef} data-testid="graph-3d-canvas" className="w-full h-full" />
            <div className="absolute top-3 left-3 bg-[#12141A]/95 border border-[#24272F] rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-300 pointer-events-none">
              Drag to orbit · Pinch or scroll to zoom · z = f(x, y)
            </div>
          </>
        )}
      </div>
    </div>
  );
}
