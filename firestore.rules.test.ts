import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidFirestoreId,
  validateSavedFormulaPayload,
  validateWorkspacePayload,
  validateWorkspaceItemPayload,
} from './src/utils/firestoreValidation';

test('blocks Dirty Dozen adversarial payloads before Firestore mutation', () => {
  // 1. Shadow field injection
  const shadowFormula = validateSavedFormulaPayload(
    {
      id: 'f1',
      ownerId: 'alice',
      expression: 'sin(x)',
      label: 'Wave',
      mode: 'graph2d',
      color: '#22D3EE',
      visible: true,
      isAdmin: true,
    },
    'alice'
  );
  assert.equal(shadowFormula.ok, false);

  // 2. Identity spoofing
  const spoofed = validateSavedFormulaPayload(
    {
      id: 'f1',
      ownerId: 'alice',
      expression: 'sin(x)',
      label: 'Wave',
      mode: 'graph2d',
      color: '#22D3EE',
      visible: true,
    },
    'bob'
  );
  assert.equal(spoofed.ok, false);

  // 3. ID poisoning (>128 chars or invalid chars)
  assert.equal(isValidFirestoreId('a'.repeat(200)), false);
  assert.equal(isValidFirestoreId('../admin'), false);

  // 4. Value poisoning (>500 expression chars or bad hex color)
  const oversized = validateSavedFormulaPayload(
    {
      id: 'f2',
      ownerId: 'alice',
      expression: 'x'.repeat(501),
      label: 'Big',
      mode: 'calc',
      color: '#22D3EE',
      visible: true,
    },
    'alice'
  );
  assert.equal(oversized.ok, false);

  // 5. Workspace item cross-workspace injection
  const crossItem = validateWorkspaceItemPayload(
    {
      id: 'i1',
      workspaceId: 'ws-other',
      authorId: 'alice',
      authorName: 'Alice',
      kind: 'formula',
      title: 'Harmonic',
      expression: 'cos(x)',
      color: '#22D3EE',
    },
    'alice',
    'ws-target'
  );
  assert.equal(crossItem.ok, false);

  // 6. Valid payloads pass cleanly
  const validWs = validateWorkspacePayload(
    {
      id: 'ws_1',
      ownerId: 'alice',
      ownerName: 'Alice',
      title: 'Quantum Oscillator Lab',
      domain: 'physics',
      visibility: 'shared',
    },
    'alice'
  );
  assert.equal(validWs.ok, true);
});
