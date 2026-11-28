import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateExpression,
  compileGraphExpression,
  numericalDerivative,
  numericalIntegral,
  solveQuadratic,
  convertBase,
  decomposeFloat32,
} from './mathEngine';

test('evaluates trig identities in rad and deg accurately', () => {
  const rad = evaluateExpression('sin(pi/4)^2 + cos(pi/4)^2', 'rad');
  assert.equal(rad.ok, true);
  assert.ok(Math.abs((rad.numericValue ?? 0) - 1) < 1e-9);

  const deg = evaluateExpression('sin(30)', 'deg');
  assert.equal(deg.ok, true);
  assert.ok(Math.abs((deg.numericValue ?? 0) - 0.5) < 1e-9);
});

test('computes symbolic derivative and matrix determinant', () => {
  const deriv = evaluateExpression('d/dx(x^3 + 2*x)', 'rad');
  assert.equal(deriv.ok, true);
  assert.ok(deriv.formatted.includes('x'));

  const detRes = evaluateExpression('det([[3, 1], [2, 4]])', 'rad');
  assert.equal(detRes.ok, true);
  assert.equal(detRes.numericValue, 10);
});

test('computes numerical definite integral and derivative', () => {
  const intRes = numericalIntegral('x^2', 0, 3, 200, 'rad');
  assert.ok(Math.abs(intRes - 9) < 1e-6);

  const compiled = compileGraphExpression('x^3', 'rad', false);
  assert.ok(compiled.eval2D);
  const slope = numericalDerivative((x) => compiled.eval2D!(x, {}), 2);
  assert.ok(Math.abs(slope - 12) < 1e-6);
});

test('compiles polar, parametric, and 3D surface expressions', () => {
  const polar = compileGraphExpression('r = 2 * cos(2 * theta)', 'rad', false);
  assert.equal(polar.kind, 'polar');
  assert.ok(Math.abs(polar.eval2D!(0, {}) - 2) < 1e-9);

  const param = compileGraphExpression('(cos(t), sin(t))', 'rad', false);
  assert.equal(param.kind, 'parametric');
  const [px, py] = param.evalParametric!(0, {});
  assert.ok(Math.abs(px - 1) < 1e-9 && Math.abs(py) < 1e-9);

  const surf = compileGraphExpression('sin(sqrt(x^2 + y^2))', 'rad', true);
  assert.equal(surf.kind, 'surface3d');
  assert.ok(Math.abs(surf.eval3D!(0, 0, {})) < 1e-9);
});

test('solves quadratic equations with real and complex roots', () => {
  const realSol = solveQuadratic(1, -5, 6);
  assert.deepEqual(realSol.roots, ['3', '2']);

  const complexSol = solveQuadratic(1, 0, 4);
  assert.equal(complexSol.roots.length, 2);
  assert.ok(complexSol.roots[0].includes('i'));
});

test('converts base-N and decomposes IEEE-754 float32', () => {
  const conv = convertBase('FF', 16);
  assert.equal(conv.dec, '255');
  assert.equal(conv.bin, '11111111');
  assert.equal(conv.oct, '377');

  const f32 = decomposeFloat32(-6.5);
  assert.equal(f32.signBit, '1');
  assert.equal(f32.actualExponent, 2);
  assert.equal(f32.hex, '0xC0D00000');
});
