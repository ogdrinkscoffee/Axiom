export type CadPrimitiveKind = 'box' | 'cylinder' | 'cone' | 'torus' | 'bracket' | 'gear';
export type CadMaterialId = 'titanium' | 'aluminum' | 'polymer' | 'copper' | 'glass';

export interface CadMaterialPreset {
  id: CadMaterialId;
  label: string;
  densityGcm3: number;
  color: string;
  metalness: number;
  roughness: number;
  transparent?: boolean;
  opacity?: number;
}

export const CAD_MATERIALS: Record<CadMaterialId, CadMaterialPreset> = {
  titanium: {
    id: 'titanium',
    label: 'Anodized Titanium',
    densityGcm3: 4.43,
    color: '#94A3B8',
    metalness: 0.88,
    roughness: 0.26,
  },
  aluminum: {
    id: 'aluminum',
    label: 'Brushed 6061 Aluminum',
    densityGcm3: 2.7,
    color: '#CBD5E1',
    metalness: 0.92,
    roughness: 0.18,
  },
  copper: {
    id: 'copper',
    label: 'Machined Copper',
    densityGcm3: 8.96,
    color: '#D97757',
    metalness: 0.9,
    roughness: 0.22,
  },
  polymer: {
    id: 'polymer',
    label: 'Carbon Nylon PA12',
    densityGcm3: 1.01,
    color: '#1E293B',
    metalness: 0.08,
    roughness: 0.72,
  },
  glass: {
    id: 'glass',
    label: 'Borosilicate Optical Glass',
    densityGcm3: 2.23,
    color: '#67E8F9',
    metalness: 0.05,
    roughness: 0.08,
    transparent: true,
    opacity: 0.48,
  },
};

export interface CadDimensions {
  w: number;     // cm (X)
  h: number;     // cm (Y)
  d: number;     // cm (Z)
  r: number;     // radius cm
  bevel: number; // cm
}

export interface CadObject {
  id: string;
  name: string;
  kind: CadPrimitiveKind;
  position: [number, number, number];
  rotationDeg: [number, number, number];
  dimensions: CadDimensions;
  materialId: CadMaterialId;
  visible: boolean;
}

export interface CadMassProperties {
  volumeCm3: number;
  surfaceAreaCm2: number;
  massGrams: number;
}

export function snapToGrid(value: number, step: number = 0.5): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export function computeCadMassProperties(obj: CadObject): CadMassProperties {
  const { w, h, d, r } = obj.dimensions;
  const mat = CAD_MATERIALS[obj.materialId];
  let volumeCm3 = 0;
  let surfaceAreaCm2 = 0;

  switch (obj.kind) {
    case 'box':
      volumeCm3 = w * h * d;
      surfaceAreaCm2 = 2 * (w * h + h * d + w * d);
      break;
    case 'cylinder':
      volumeCm3 = Math.PI * r * r * h;
      surfaceAreaCm2 = 2 * Math.PI * r * (r + h);
      break;
    case 'cone': {
      const slant = Math.hypot(r, h);
      volumeCm3 = (1 / 3) * Math.PI * r * r * h;
      surfaceAreaCm2 = Math.PI * r * (r + slant);
      break;
    }
    case 'torus': {
      const tubeR = Math.max(0.1, Math.min(r * 0.38, d * 0.25));
      volumeCm3 = 2 * Math.PI * Math.PI * r * tubeR * tubeR;
      surfaceAreaCm2 = 4 * Math.PI * Math.PI * r * tubeR;
      break;
    }
    case 'bracket': {
      // L-bracket extrusion volume approximation (~55% of bounding box)
      volumeCm3 = 0.55 * w * h * d;
      surfaceAreaCm2 = 1.65 * (w * h + h * d + w * d);
      break;
    }
    case 'gear': {
      // Spur gear cylindrical disc + teeth minus bore
      const boreR = r * 0.28;
      volumeCm3 = Math.PI * (r * r - boreR * boreR) * h * 0.92;
      surfaceAreaCm2 = 2 * Math.PI * (r * r - boreR * boreR) + 2 * Math.PI * r * h * 1.25;
      break;
    }
  }

  return {
    volumeCm3: Number(volumeCm3.toFixed(3)),
    surfaceAreaCm2: Number(surfaceAreaCm2.toFixed(3)),
    massGrams: Number((volumeCm3 * mat.densityGcm3).toFixed(3)),
  };
}

export function exportCadSceneToOBJ(objects: CadObject[]): string {
  const lines: string[] = [
    '# Axiom CAD Studio Wavefront OBJ Export',
    `# Objects: ${objects.filter((o) => o.visible).length}`,
    '',
  ];
  let vertexOffset = 1;

  for (const obj of objects) {
    if (!obj.visible) continue;
    lines.push(`o ${obj.name.replace(/\s+/g, '_')}`);
    const [px, py, pz] = obj.position;
    const { w, h, d, r } = obj.dimensions;
    const hx = (obj.kind === 'box' || obj.kind === 'bracket' ? w : r * 2) / 2;
    const hy = h / 2;
    const hz = (obj.kind === 'box' || obj.kind === 'bracket' ? d : r * 2) / 2;

    const verts = [
      [px - hx, py - hy, pz + hz],
      [px + hx, py - hy, pz + hz],
      [px + hx, py + hy, pz + hz],
      [px - hx, py + hy, pz + hz],
      [px - hx, py - hy, pz - hz],
      [px + hx, py - hy, pz - hz],
      [px + hx, py + hy, pz - hz],
      [px - hx, py + hy, pz - hz],
    ];

    for (const [vx, vy, vz] of verts) {
      lines.push(`v ${vx.toFixed(4)} ${vy.toFixed(4)} ${vz.toFixed(4)}`);
    }

    const faces = [
      [0, 1, 2, 3],
      [5, 4, 7, 6],
      [4, 0, 3, 7],
      [1, 5, 6, 2],
      [3, 2, 6, 7],
      [4, 5, 1, 0],
    ];
    for (const [a, b, c, dIdx] of faces) {
      lines.push(`f ${vertexOffset + a} ${vertexOffset + b} ${vertexOffset + c} ${vertexOffset + dIdx}`);
    }
    vertexOffset += 8;
    lines.push('');
  }

  return lines.join('\n');
}
