import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Download,
  Box as BoxIcon,
  Cylinder,
  Triangle,
  CircleDot,
  Cog,
  Wrench,
} from 'lucide-react';
import {
  CAD_MATERIALS,
  computeCadMassProperties,
  exportCadSceneToOBJ,
  snapToGrid,
  type CadMaterialId,
  type CadObject,
  type CadPrimitiveKind,
} from '../engine/cadEngine';
import {
  detectSoftwareGl,
  createAdaptiveRenderer,
  createAfterDrawScheduler,
} from '../utils/webglGuard';

function buildGearShape(outerRadius: number, teeth: number, boreRadius: number) {
  const shape = new THREE.Shape();
  const innerR = outerRadius * 0.82;
  const step = (Math.PI * 2) / teeth;

  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.2;
    const a2 = a0 + step * 0.45;
    const a3 = a0 + step * 0.65;

    const p0x = Math.cos(a0) * innerR;
    const p0y = Math.sin(a0) * innerR;
    if (i === 0) shape.moveTo(p0x, p0y);
    else shape.lineTo(p0x, p0y);

    shape.lineTo(Math.cos(a1) * outerRadius, Math.sin(a1) * outerRadius);
    shape.lineTo(Math.cos(a2) * outerRadius, Math.sin(a2) * outerRadius);
    shape.lineTo(Math.cos(a3) * innerR, Math.sin(a3) * innerR);
  }
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(0, 0, boreRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

function buildBracketShape(w: number, h: number) {
  const t = Math.min(w, h) * 0.26;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -h / 2);
  shape.lineTo(w / 2, -h / 2);
  shape.lineTo(w / 2, -h / 2 + t);
  shape.lineTo(-w / 2 + t, -h / 2 + t);
  shape.lineTo(-w / 2 + t, h / 2);
  shape.lineTo(-w / 2, h / 2);
  shape.closePath();
  return shape;
}

function createCadGeometry(obj: CadObject): THREE.BufferGeometry {
  const { w, h, d, r, bevel } = obj.dimensions;
  switch (obj.kind) {
    case 'box':
      return new THREE.BoxGeometry(w, h, d);
    case 'cylinder':
      return new THREE.CylinderGeometry(r, r, h, 32);
    case 'cone':
      return new THREE.ConeGeometry(r, h, 32);
    case 'torus':
      return new THREE.TorusGeometry(r, Math.max(0.12, Math.min(r * 0.35, d * 0.2)), 20, 44);
    case 'gear': {
      const shape = buildGearShape(r, 14, r * 0.28);
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: h,
        bevelEnabled: true,
        bevelThickness: Math.min(0.08, bevel),
        bevelSize: Math.min(0.06, bevel),
        bevelSegments: 2,
      });
      geo.center();
      geo.rotateX(Math.PI / 2);
      return geo;
    }
    case 'bracket': {
      const shape = buildBracketShape(w, h);
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: d,
        bevelEnabled: true,
        bevelThickness: Math.min(0.08, bevel),
        bevelSize: Math.min(0.06, bevel),
        bevelSegments: 2,
      });
      geo.center();
      return geo;
    }
  }
}

const INITIAL_CAD_OBJECTS: CadObject[] = [
  {
    id: 'cad_gear_1',
    name: 'Drive Spur Gear',
    kind: 'gear',
    position: [0, 0.5, 0],
    rotationDeg: [0, 0, 0],
    dimensions: { w: 3, h: 0.7, d: 3, r: 1.6, bevel: 0.05 },
    materialId: 'titanium',
    visible: true,
  },
  {
    id: 'cad_bracket_1',
    name: 'Mounting L-Bracket',
    kind: 'bracket',
    position: [-2.5, 1.0, 0],
    rotationDeg: [0, 0, 0],
    dimensions: { w: 2.0, h: 2.0, d: 1.4, r: 1.0, bevel: 0.06 },
    materialId: 'aluminum',
    visible: true,
  },
  {
    id: 'cad_shaft_1',
    name: 'Copper Bearing Sleeve',
    kind: 'cylinder',
    position: [0, 1.0, 0],
    rotationDeg: [0, 0, 0],
    dimensions: { w: 1, h: 1.8, d: 1, r: 0.42, bevel: 0 },
    materialId: 'copper',
    visible: true,
  },
];

export function CadView() {
  const [objects, setObjects] = useState<CadObject[]>(INITIAL_CAD_OBJECTS);
  const [selectedId, setSelectedId] = useState<string>(INITIAL_CAD_OBJECTS[0].id);
  const [wireframe, setWireframe] = useState(false);
  const [gridSnap, setGridSnap] = useState(true);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const objectsRef = useRef(objects);
  const selectedIdRef = useRef(selectedId);
  const wireframeRef = useRef(wireframe);
  const rebuildSceneRef = useRef<(() => void) | null>(null);
  const setCameraPresetRef = useRef<((preset: 'iso' | 'top' | 'front' | 'side') => void) | null>(null);

  objectsRef.current = objects;
  selectedIdRef.current = selectedId;
  wireframeRef.current = wireframe;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const renderer = createAdaptiveRenderer(isSoftwareGl);
    const width = container.clientWidth || 840;
    const height = container.clientHeight || 540;
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090C11');
    scene.fog = new THREE.Fog('#090C11', 20, 52);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 150);
    camera.position.set(6.5, 5.2, 7.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0.8, 0);

    // 3-point CAD studio rig
    scene.add(new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.9));
    const keyLight = new THREE.DirectionalLight(0xfff1e6, 2.2);
    keyLight.position.set(8, 12, 8);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x22d3ee, 1.0);
    rimLight.position.set(-8, 6, -7);
    scene.add(rimLight);

    // Ground CAD drafting grid + contact plane
    const grid = new THREE.GridHelper(20, 40, 0x334155, 0x161f2d);
    scene.add(grid);
    const axes = new THREE.AxesHelper(2.5);
    axes.position.y = 0.01;
    scene.add(axes);

    const assemblyGroup = new THREE.Group();
    scene.add(assemblyGroup);

    const interactables: THREE.Mesh[] = [];
    const activeDisposables: (THREE.BufferGeometry | THREE.Material)[] = [];

    const clearAssembly = () => {
      while (assemblyGroup.children.length > 0) {
        assemblyGroup.remove(assemblyGroup.children[0]);
      }
      interactables.length = 0;
      for (const d of activeDisposables) d.dispose();
      activeDisposables.length = 0;
    };

    const rebuildAssembly = () => {
      clearAssembly();
      for (const obj of objectsRef.current) {
        if (!obj.visible) continue;
        const matSpec = CAD_MATERIALS[obj.materialId];
        const geo = createCadGeometry(obj);
        const mat = new THREE.MeshPhysicalMaterial({
          color: matSpec.color,
          metalness: matSpec.metalness,
          roughness: matSpec.roughness,
          transparent: Boolean(matSpec.transparent),
          opacity: matSpec.opacity ?? 1,
          wireframe: wireframeRef.current,
          emissive: obj.id === selectedIdRef.current ? new THREE.Color('#0E7490') : new THREE.Color('#000000'),
          emissiveIntensity: obj.id === selectedIdRef.current ? 0.25 : 0,
        });
        activeDisposables.push(geo, mat);

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(...obj.position);
        mesh.rotation.set(
          THREE.MathUtils.degToRad(obj.rotationDeg[0]),
          THREE.MathUtils.degToRad(obj.rotationDeg[1]),
          THREE.MathUtils.degToRad(obj.rotationDeg[2])
        );
        mesh.castShadow = !isSoftwareGl;
        mesh.receiveShadow = !isSoftwareGl;
        mesh.userData.cadId = obj.id;

        if (obj.id === selectedIdRef.current) {
          const edgesGeo = new THREE.EdgesGeometry(geo, 22);
          const edgesMat = new THREE.LineBasicMaterial({ color: 0x22d3ee });
          activeDisposables.push(edgesGeo, edgesMat);
          mesh.add(new THREE.LineSegments(edgesGeo, edgesMat));
        }

        assemblyGroup.add(mesh);
        interactables.push(mesh);
      }
    };

    rebuildAssembly();
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

    rebuildSceneRef.current = () => {
      rebuildAssembly();
      requestRender();
    };

    setCameraPresetRef.current = (preset) => {
      if (preset === 'iso') camera.position.set(6.5, 5.2, 7.5);
      else if (preset === 'top') camera.position.set(0.01, 10, 0.01);
      else if (preset === 'front') camera.position.set(0, 1.5, 10);
      else camera.position.set(10, 1.5, 0);
      controls.target.set(0, 0.8, 0);
      controls.update();
      requestRender();
    };

    // Raycast selection
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downPt = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      downPt = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactables, false);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData.cadId as string;
        if (hitId) setSelectedId(hitId);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    controls.addEventListener('change', requestRender);
    requestRender();

    const onResize = () => {
      if (!container) return;
      const nw = container.clientWidth || 840;
      const nh = container.clientHeight || 540;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
      requestRender();
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.removeEventListener('change', requestRender);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      clearAssembly();
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    rebuildSceneRef.current?.();
  }, [objects, selectedId, wireframe]);

  const selectedObj = objects.find((o) => o.id === selectedId) || objects[0];
  const massProps = selectedObj ? computeCadMassProperties(selectedObj) : null;

  const addPrimitive = (kind: CadPrimitiveKind) => {
    const idx = objects.length + 1;
    const next: CadObject = {
      id: `cad_${Date.now().toString(36)}`,
      name: `${kind.charAt(0).toUpperCase() + kind.slice(1)} ${idx}`,
      kind,
      position: [snapToGrid((idx % 3) * 1.5 - 1.5, 0.5), 1, 0],
      rotationDeg: [0, 0, 0],
      dimensions: { w: 1.8, h: 1.4, d: 1.8, r: 0.9, bevel: 0.06 },
      materialId: 'aluminum',
      visible: true,
    };
    setObjects((prev) => [...prev, next]);
    setSelectedId(next.id);
  };

  const updateSelected = (updater: (obj: CadObject) => CadObject) => {
    if (!selectedObj) return;
    setObjects((prev) => prev.map((o) => (o.id === selectedObj.id ? updater(o) : o)));
  };

  const handleExportObj = () => {
    const content = exportCadSceneToOBJ(objects);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'axiom-assembly.obj';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-3 p-3 md:p-4 max-w-[1440px] mx-auto w-full overflow-hidden">
      {/* Left CAD Part Browser & Parametric Inspector */}
      <aside className="lg:w-[360px] shrink-0 bg-[#10151E] border border-[#1E2736] rounded-xl p-4 flex flex-col gap-4 overflow-y-auto max-h-[44vh] lg:max-h-none">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-white">Create Parametric Part</h2>
            <button
              type="button"
              onClick={handleExportObj}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25"
            >
              <Download className="w-3.5 h-3.5" />
              Export .OBJ
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ['box', 'Box', BoxIcon],
                ['cylinder', 'Cylinder', Cylinder],
                ['cone', 'Cone', Triangle],
                ['torus', 'Torus', CircleDot],
                ['gear', 'Spur Gear', Cog],
                ['bracket', 'Bracket', Wrench],
              ] as const
            ).map(([kind, label, Icon]) => (
              <button
                key={kind}
                type="button"
                onClick={() => addPrimitive(kind)}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-[#090C11] hover:bg-[#17202E] border border-[#1E2736] text-xs text-slate-200 transition-colors min-h-[40px]"
              >
                <Icon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Assembly Tree */}
        <div className="pt-3 border-t border-[#1E2736] space-y-1.5">
          <div className="text-xs font-medium text-slate-400">Assembly Tree ({objects.length})</div>
          <div className="space-y-1 max-h-[130px] overflow-y-auto">
            {objects.map((obj) => (
              <div
                key={obj.id}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
                  obj.id === selectedId
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-white'
                    : 'bg-[#090C11] border-[#1E2736] text-slate-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(obj.id)}
                  className="flex-1 text-left truncate font-medium"
                >
                  {obj.name}
                </button>
                <button
                  type="button"
                  aria-label={`Toggle ${obj.name} visibility`}
                  onClick={() =>
                    setObjects((prev) =>
                      prev.map((o) => (o.id === obj.id ? { ...o, visible: !o.visible } : o))
                    )
                  }
                  className="p-1 text-slate-400 hover:text-white"
                >
                  {obj.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                {objects.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Delete ${obj.name}`}
                    onClick={() => {
                      const remaining = objects.filter((o) => o.id !== obj.id);
                      setObjects(remaining);
                      if (selectedId === obj.id && remaining[0]) setSelectedId(remaining[0].id);
                    }}
                    className="p-1 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Selected Object Parameters */}
        {selectedObj && (
          <div className="pt-3 border-t border-[#1E2736] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Inspector · {selectedObj.name}</span>
              <button
                type="button"
                onClick={() => setGridSnap((v) => !v)}
                className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                  gridSnap
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                    : 'bg-[#090C11] border-[#1E2736] text-slate-400'
                }`}
              >
                Snap {gridSnap ? '0.5cm' : 'Off'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                <label key={axis} className="space-y-1">
                  <span className="text-slate-400 font-mono">Pos {axis}</span>
                  <input
                    type="number"
                    step={gridSnap ? 0.5 : 0.1}
                    value={selectedObj.position[i]}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const v = gridSnap ? snapToGrid(raw, 0.5) : raw;
                      updateSelected((o) => {
                        const nextPos: [number, number, number] = [...o.position];
                        nextPos[i] = v;
                        return { ...o, position: nextPos };
                      });
                    }}
                    className="w-full px-2 py-1.5 rounded bg-[#090C11] border border-[#1E2736] font-mono text-white"
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {(selectedObj.kind === 'box' || selectedObj.kind === 'bracket') && (
                <>
                  <label className="space-y-1">
                    <span className="text-slate-400 font-mono">Width (cm)</span>
                    <input
                      type="number"
                      min="0.2"
                      step="0.2"
                      value={selectedObj.dimensions.w}
                      onChange={(e) =>
                        updateSelected((o) => ({
                          ...o,
                          dimensions: { ...o.dimensions, w: Math.max(0.2, Number(e.target.value)) },
                        }))
                      }
                      className="w-full px-2 py-1.5 rounded bg-[#090C11] border border-[#1E2736] font-mono text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-slate-400 font-mono">Depth (cm)</span>
                    <input
                      type="number"
                      min="0.2"
                      step="0.2"
                      value={selectedObj.dimensions.d}
                      onChange={(e) =>
                        updateSelected((o) => ({
                          ...o,
                          dimensions: { ...o.dimensions, d: Math.max(0.2, Number(e.target.value)) },
                        }))
                      }
                      className="w-full px-2 py-1.5 rounded bg-[#090C11] border border-[#1E2736] font-mono text-white"
                    />
                  </label>
                </>
              )}
              {selectedObj.kind !== 'box' && selectedObj.kind !== 'bracket' && (
                <label className="space-y-1">
                  <span className="text-slate-400 font-mono">Radius (cm)</span>
                  <input
                    type="number"
                    min="0.2"
                    step="0.1"
                    value={selectedObj.dimensions.r}
                    onChange={(e) =>
                      updateSelected((o) => ({
                        ...o,
                        dimensions: { ...o.dimensions, r: Math.max(0.2, Number(e.target.value)) },
                      }))
                    }
                    className="w-full px-2 py-1.5 rounded bg-[#090C11] border border-[#1E2736] font-mono text-white"
                  />
                </label>
              )}
              <label className="space-y-1">
                <span className="text-slate-400 font-mono">Height (cm)</span>
                <input
                  type="number"
                  min="0.2"
                  step="0.2"
                  value={selectedObj.dimensions.h}
                  onChange={(e) =>
                    updateSelected((o) => ({
                      ...o,
                      dimensions: { ...o.dimensions, h: Math.max(0.2, Number(e.target.value)) },
                    }))
                  }
                  className="w-full px-2 py-1.5 rounded bg-[#090C11] border border-[#1E2736] font-mono text-white"
                />
              </label>
            </div>

            <label className="block space-y-1 text-xs">
              <span className="text-slate-400">Engineering Material</span>
              <select
                value={selectedObj.materialId}
                onChange={(e) =>
                  updateSelected((o) => ({ ...o, materialId: e.target.value as CadMaterialId }))
                }
                className="w-full px-2.5 py-2 rounded-lg bg-[#090C11] border border-[#1E2736] text-white"
              >
                {Object.values(CAD_MATERIALS).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.densityGcm3} g/cm³)
                  </option>
                ))}
              </select>
            </label>

            {massProps && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1E2736] font-mono text-xs">
                <div className="bg-[#090C11] border border-[#1E2736] rounded p-2">
                  <div className="text-slate-400 text-[10px]">Volume</div>
                  <div className="text-white mt-0.5">{massProps.volumeCm3} cm³</div>
                </div>
                <div className="bg-[#090C11] border border-[#1E2736] rounded p-2">
                  <div className="text-slate-400 text-[10px]">Area</div>
                  <div className="text-cyan-300 mt-0.5">{massProps.surfaceAreaCm2} cm²</div>
                </div>
                <div className="bg-[#090C11] border border-[#1E2736] rounded p-2">
                  <div className="text-slate-400 text-[10px]">Mass</div>
                  <div className="text-amber-300 mt-0.5">{massProps.massGrams} g</div>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Main 3D CAD Viewport */}
      <div className="flex-1 relative bg-[#090C11] border border-[#1E2736] rounded-xl overflow-hidden min-h-[380px]">
        <div ref={mountRef} data-testid="cad-3d-canvas" className="w-full h-full" />

        {/* Bottom Camera & Viewport Dock (no backdrop-filter over WebGL!) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#10151E]/95 border border-[#1E2736] rounded-xl px-2 py-1.5 flex items-center gap-1.5">
          {(['iso', 'top', 'front', 'side'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setCameraPresetRef.current?.(preset)}
              className="px-3 py-1.5 text-xs font-mono uppercase rounded-lg text-slate-300 hover:bg-[#1A2333] hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {preset}
            </button>
          ))}
          <div className="w-px h-5 bg-[#1E2736]" />
          <button
            type="button"
            onClick={() => setWireframe((v) => !v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              wireframe ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-300 hover:bg-[#1A2333]'
            }`}
          >
            Wireframe
          </button>
        </div>

        <div className="absolute top-3 left-3 bg-[#10151E]/95 border border-[#1E2736] rounded-lg px-3 py-1.5 text-xs font-mono text-slate-300 pointer-events-none">
          Click part to select · Drag to orbit · Scroll or pinch to zoom
        </div>
      </div>
    </div>
  );
}
