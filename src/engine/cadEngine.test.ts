import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCadMassProperties, snapToGrid, exportCadSceneToOBJ, type CadObject } from './cadEngine';

test('computes analytical CAD volume, surface area, and mass', () => {
  const box: CadObject = {
    id: 'b1',
    name: 'Test Block',
    kind: 'box',
    position: [0, 1, 0],
    rotationDeg: [0, 0, 0],
    dimensions: { w: 2, h: 3, d: 4, r: 1, bevel: 0.1 },
    materialId: 'aluminum',
    visible: true,
  };
  const props = computeCadMassProperties(box);
  assert.equal(props.volumeCm3, 24);
  assert.equal(props.surfaceAreaCm2, 52);
  assert.ok(Math.abs(props.massGrams - 24 * 2.7) < 1e-6);
});

test('snaps coordinates to CAD grid step and exports valid Wavefront OBJ', () => {
  assert.equal(snapToGrid(1.37, 0.5), 1.5);
  assert.equal(snapToGrid(-0.24, 0.5), -0);

  const objStr = exportCadSceneToOBJ([
    {
      id: 'c1',
      name: 'Cylinder Flange',
      kind: 'cylinder',
      position: [0, 1, 0],
      rotationDeg: [0, 0, 0],
      dimensions: { w: 2, h: 2, d: 2, r: 1, bevel: 0 },
      materialId: 'titanium',
      visible: true,
    },
  ]);
  assert.ok(objStr.includes('o Cylinder_Flange'));
  assert.ok(objStr.includes('v '));
  assert.ok(objStr.includes('f '));
});
