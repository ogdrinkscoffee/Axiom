import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simulateProjectileTrajectory,
  evaluateElectricField,
  computeMolarMass,
  solveIdealGas,
  computePH,
  analyzeRLC,
  analyzeBeamDeflection,
  evaluateBooleanExpression,
  runPathfinding,
} from './stemEngine';

test('simulates projectile trajectory and lands at expected range without drag', () => {
  const sim = simulateProjectileTrajectory({
    v0: 20,
    angleDeg: 45,
    gravity: 9.81,
    dragCoeff: 0,
    mass: 1,
  });
  const idealRange = (20 * 20) / 9.81;
  assert.ok(Math.abs(sim.range - idealRange) < 1.2);
  assert.ok(sim.maxHeight > 9.5 && sim.maxHeight < 11.0);
});

test('evaluates electric field symmetry between equal opposite charges', () => {
  const field = evaluateElectricField(
    [
      { id: 'c1', x: -2, y: 0, q: 5 },
      { id: 'c2', x: 2, y: 0, q: -5 },
    ],
    0,
    0
  );
  assert.ok(field.ex > 0);
  assert.ok(Math.abs(field.potential) < 1e-6);
});

test('computes molar mass, ideal gas, and pH accurately', () => {
  const glucose = computeMolarMass('C6H12O6');
  assert.ok(Math.abs(glucose.mass - 180.156) < 0.1);

  const caoh2 = computeMolarMass('Ca(OH)2');
  assert.ok(Math.abs(caoh2.mass - 74.092) < 0.1);

  const p = solveIdealGas('P', { P: 0, V: 22.414, n: 1, T: 273.15 });
  assert.ok(Math.abs(p - 1) < 0.01);

  const strongAcid = computePH(0.01, 4.76, true);
  assert.ok(Math.abs(strongAcid.ph - 2) < 1e-6);
});

test('analyzes RLC series resonance and beam deflection', () => {
  // L = 10mH, C = 10uF -> f0 ~ 503.29 Hz
  const rlc = analyzeRLC(10, 10, 10, 12, 503.2921);
  assert.ok(Math.abs(rlc.resonantHz - 503.2921) < 0.1);
  assert.ok(Math.abs(rlc.phaseDeg) < 0.5);
  assert.ok(Math.abs(rlc.zMag - 10) < 0.1);

  const beam = analyzeBeamDeflection({
    lengthM: 2,
    loadN: 1000,
    widthMm: 50,
    heightMm: 100,
    E_GPa: 200,
    support: 'cantilever',
  });
  assert.ok(beam.deflectionMm > 0);
  assert.ok(beam.maxStressMPa > 0);
});

test('evaluates boolean truth tables and finds shortest path with A*', () => {
  const tt = evaluateBooleanExpression('(A AND B) OR NOT C');
  assert.equal(tt.error, undefined);
  assert.deepEqual(tt.variables, ['A', 'B', 'C']);
  assert.equal(tt.rows.length, 8);

  const walls = [
    [false, false, false, false],
    [true, true, false, true],
    [false, false, false, false],
  ];
  const pf = runPathfinding(walls, { r: 0, c: 0 }, { r: 2, c: 3 }, 'astar');
  assert.ok(pf.path.length > 0);
  assert.deepEqual(pf.path[0], { r: 0, c: 0 });
  assert.deepEqual(pf.path[pf.path.length - 1], { r: 2, c: 3 });
});
