/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { detectSoftwareGl, createAdaptiveRenderer, createAfterDrawScheduler } from '../utils/webglGuard';
import { Sparkles, Rotate3d, Compass } from 'lucide-react';

interface InteractiveFocalStageProps {
  className?: string;
  onExploreTopic?: (topic: string) => void;
}

export function InteractiveFocalStage({ className = '', onExploreTopic }: InteractiveFocalStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);

  // Check reduced motion preference
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(media.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || prefersReducedMotion) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = container.clientWidth || 360;
    const height = container.clientHeight || 260;

    // Three.js Scene Setup
    const scene = new THREE.Scene();
    scene.background = null; // transparent to blend with #080B10

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.5);

    const renderer = createAdaptiveRenderer(isSoftwareGl);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    // Studio Rim Lighting Setup
    const ambientLight = new THREE.AmbientLight(0x0e1726, 2.5);
    scene.add(ambientLight);

    const keyRimCyan = new THREE.DirectionalLight(0x22d3ee, 4.5);
    keyRimCyan.position.set(4, 5, 4);
    scene.add(keyRimCyan);

    const fillRimAmber = new THREE.DirectionalLight(0xf59e0b, 2.8);
    fillRimAmber.position.set(-4, -3, -3);
    scene.add(fillRimAmber);

    const coreLight = new THREE.PointLight(0x38bdf8, 3, 10);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);

    // Centerpiece Group
    const stageGroup = new THREE.Group();
    scene.add(stageGroup);

    // 1. Central Mathematical Manifold (Torus Knot)
    const knotGeom = new THREE.TorusKnotGeometry(1.25, 0.38, 128, 32, 2, 3);
    const knotMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      emissive: 0x061e38,
      roughness: 0.22,
      metalness: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.15,
      wireframe: false,
    });
    const knotMesh = new THREE.Mesh(knotGeom, knotMat);
    stageGroup.add(knotMesh);

    // 2. Wireframe Overlay Accent
    const wireGeom = new THREE.TorusKnotGeometry(1.26, 0.382, 64, 16, 2, 3);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const wireMesh = new THREE.Mesh(wireGeom, wireMat);
    stageGroup.add(wireMesh);

    // 3. Precision Gimbal Rings
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const ringGeom1 = new THREE.RingGeometry(2.35, 2.38, 48);
    const ringMesh1 = new THREE.Mesh(ringGeom1, ringMat);
    stageGroup.add(ringMesh1);

    const ringGeom2 = new THREE.RingGeometry(2.55, 2.58, 48);
    const ringMesh2 = new THREE.Mesh(ringGeom2, ringMat);
    ringMesh2.rotation.x = Math.PI / 2;
    stageGroup.add(ringMesh2);

    // Pointer Parallax Tilt targets and lerp state
    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;
    let boostVel = 0;

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetRotY = x * 1.2;
      targetRotX = y * 0.9;
    };

    const handlePointerLeave = () => {
      targetRotX = 0;
      targetRotY = 0;
    };

    const handleClick = () => {
      boostVel = 0.2;
      setPulseCount((c) => c + 1);
    };

    container.addEventListener('mousemove', handlePointerMove);
    container.addEventListener('mouseleave', handlePointerLeave);
    container.addEventListener('click', handleClick);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || 360;
      const newH = container.clientHeight || 260;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    // IntersectionObserver to pause rendering when offscreen
    let isVisible = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.1 }
    );
    observer.observe(container);

    // Animation Loop with lerp damping
    let animId = 0;
    let timerId = 0;
    const afterDraw = createAfterDrawScheduler(renderer, (id) => (timerId = id));

    const renderLoop = () => {
      animId = requestAnimationFrame(renderLoop);
      if (!isVisible) return;

      // Lerp damping towards pointer target
      currentRotX += (targetRotX - currentRotX) * 0.06;
      currentRotY += (targetRotY - currentRotY) * 0.06;

      boostVel *= 0.95; // decay click impulse

      // Gyroscopic idle rotation
      knotMesh.rotation.x += 0.007 + boostVel;
      knotMesh.rotation.y += 0.011 + boostVel;
      wireMesh.rotation.x = knotMesh.rotation.x;
      wireMesh.rotation.y = knotMesh.rotation.y;

      ringMesh1.rotation.z += 0.003;
      ringMesh2.rotation.z -= 0.004;

      // Parallax container tilt
      stageGroup.rotation.x = currentRotX;
      stageGroup.rotation.y = currentRotY;

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(() => {});
      }
    };
    renderLoop();

    // Clean Resource Disposal
    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(timerId);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handlePointerMove);
      container.removeEventListener('mouseleave', handlePointerLeave);
      container.removeEventListener('click', handleClick);

      // Dispose Three.js objects
      knotGeom.dispose();
      wireGeom.dispose();
      ringGeom1.dispose();
      ringGeom2.dispose();
      knotMat.dispose();
      wireMat.dispose();
      ringMat.dispose();
      renderer.dispose();

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [prefersReducedMotion]);

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-[#182232] bg-[#0E141F] specular-card transition-all ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Precision Corner Badges */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
        <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-widest uppercase bg-[#080B10]/80 border border-[#182232] text-cyan-300 flex items-center gap-1.5">
          <Rotate3d className="w-3 h-3 text-cyan-400" />
          Focal Singularity Stage
        </span>
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-400 bg-[#080B10]/60 border border-[#182232]">
          Torus Manifold (2, 3)
        </span>
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 pointer-events-none">
        <span className="text-[10px] font-mono text-amber-400/90 bg-[#080B10]/80 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          Interactive 3D
        </span>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div
        ref={containerRef}
        className="w-full h-56 md:h-64 cursor-grab active:cursor-grabbing relative flex items-center justify-center"
      >
        {/* Static CSS Fallback for Reduced Motion or Disabled WebGL */}
        {prefersReducedMotion && (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-2">
            <Compass className="w-12 h-12 text-cyan-400 animate-pulse" />
            <div className="text-sm font-semibold text-white">Mathematical Singularity</div>
            <div className="text-xs text-slate-400 font-mono">
              Static rendering active (reduced motion requested).
            </div>
          </div>
        )}
      </div>

      {/* Interactive Controls & Metadata Drawer */}
      <div className="p-3.5 bg-[#080B10]/80 border-t border-[#182232] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <span>
            Tilt Parallax: <strong className="text-cyan-300 font-semibold">{isHovered ? 'Active' : 'Neutral'}</strong>
          </span>
          <span>·</span>
          <span>
            Pulses: <strong className="text-amber-300 font-semibold">{pulseCount}</strong>
          </span>
          <span className="hidden sm:inline">· Click stage to pulse angular momentum</span>
        </div>

        {onExploreTopic && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onExploreTopic('harmonic')}
              className="px-2.5 py-1 rounded bg-[#162030] hover:bg-[#1E2B40] border border-[#212E42] text-[11px] font-mono text-cyan-300 transition-colors"
            >
              Load Wavepacket
            </button>
            <button
              type="button"
              onClick={() => onExploreTopic('cad-gear')}
              className="px-2.5 py-1 rounded bg-[#162030] hover:bg-[#1E2B40] border border-[#212E42] text-[11px] font-mono text-amber-300 transition-colors"
            >
              Spur Gear CAD
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
