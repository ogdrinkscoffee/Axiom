// Validation helpers synchronized verbatim with firebase-blueprint.json & firestore.rules

export const BLUEPRINT_LIMITS = {
  idMin: 1,
  idMax: 128,
  idPattern: /^[a-zA-Z0-9_-]+$/,
  displayNameMax: 80,
  emailMax: 160,
  expressionMax: 500,
  labelMax: 80,
  titleMax: 120,
  notesMax: 1000,
  colorPattern: /^#[0-9a-fA-F]{3,8}$/,
} as const;

export const ALLOWED_FORMULA_MODES = ['calc', 'graph2d', 'graph3d'] as const;
export const ALLOWED_WORKSPACE_DOMAINS = ['math', 'physics', 'chemistry', 'electrical', 'cs', 'cad'] as const;
export const ALLOWED_WORKSPACE_VISIBILITIES = ['private', 'shared'] as const;
export const ALLOWED_ITEM_KINDS = ['formula', 'graph', 'cad', 'note'] as const;

export function isValidFirestoreId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length >= BLUEPRINT_LIMITS.idMin &&
    id.length <= BLUEPRINT_LIMITS.idMax &&
    BLUEPRINT_LIMITS.idPattern.test(id)
  );
}

export function isValidHexColor(color: unknown): color is string {
  return typeof color === 'string' && color.length >= 4 && color.length <= 16 && BLUEPRINT_LIMITS.colorPattern.test(color);
}

export interface SavedFormulaPayload {
  id: string;
  ownerId: string;
  expression: string;
  label: string;
  mode: (typeof ALLOWED_FORMULA_MODES)[number];
  color: string;
  visible: boolean;
}

export function validateSavedFormulaPayload(payload: Record<string, unknown>, expectedUid: string): { ok: boolean; error?: string } {
  const allowedKeys = new Set(['id', 'ownerId', 'expression', 'label', 'mode', 'color', 'visible', 'createdAt', 'updatedAt']);
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) return { ok: false, error: `Unexpected shadow field: ${key}` };
  }
  if (!isValidFirestoreId(payload.id)) return { ok: false, error: 'Invalid formula id' };
  if (!isValidFirestoreId(payload.ownerId) || payload.ownerId !== expectedUid) return { ok: false, error: 'Owner mismatch' };
  if (typeof payload.expression !== 'string' || payload.expression.trim().length < 1 || payload.expression.length > BLUEPRINT_LIMITS.expressionMax) {
    return { ok: false, error: 'Invalid expression length' };
  }
  if (typeof payload.label !== 'string' || payload.label.trim().length < 1 || payload.label.length > BLUEPRINT_LIMITS.labelMax) {
    return { ok: false, error: 'Invalid label length' };
  }
  if (!ALLOWED_FORMULA_MODES.includes(payload.mode as (typeof ALLOWED_FORMULA_MODES)[number])) {
    return { ok: false, error: 'Invalid formula mode' };
  }
  if (!isValidHexColor(payload.color)) return { ok: false, error: 'Invalid color format' };
  if (typeof payload.visible !== 'boolean') return { ok: false, error: 'Visible must be boolean' };
  return { ok: true };
}

export function validateWorkspacePayload(payload: Record<string, unknown>, expectedUid: string): { ok: boolean; error?: string } {
  const allowedKeys = new Set(['id', 'ownerId', 'ownerName', 'title', 'domain', 'visibility', 'createdAt', 'updatedAt']);
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) return { ok: false, error: `Unexpected shadow field: ${key}` };
  }
  if (!isValidFirestoreId(payload.id)) return { ok: false, error: 'Invalid workspace id' };
  if (!isValidFirestoreId(payload.ownerId) || payload.ownerId !== expectedUid) return { ok: false, error: 'Owner mismatch' };
  if (typeof payload.ownerName !== 'string' || payload.ownerName.trim().length < 1 || payload.ownerName.length > BLUEPRINT_LIMITS.displayNameMax) {
    return { ok: false, error: 'Invalid ownerName' };
  }
  if (typeof payload.title !== 'string' || payload.title.trim().length < 1 || payload.title.length > BLUEPRINT_LIMITS.titleMax) {
    return { ok: false, error: 'Invalid title' };
  }
  if (!ALLOWED_WORKSPACE_DOMAINS.includes(payload.domain as (typeof ALLOWED_WORKSPACE_DOMAINS)[number])) {
    return { ok: false, error: 'Invalid domain' };
  }
  if (!ALLOWED_WORKSPACE_VISIBILITIES.includes(payload.visibility as (typeof ALLOWED_WORKSPACE_VISIBILITIES)[number])) {
    return { ok: false, error: 'Invalid visibility' };
  }
  return { ok: true };
}

export function validateWorkspaceItemPayload(payload: Record<string, unknown>, expectedUid: string, expectedWorkspaceId: string): { ok: boolean; error?: string } {
  const allowedKeys = new Set(['id', 'workspaceId', 'authorId', 'authorName', 'kind', 'title', 'expression', 'notes', 'color', 'createdAt', 'updatedAt']);
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) return { ok: false, error: `Unexpected shadow field: ${key}` };
  }
  if (!isValidFirestoreId(payload.id)) return { ok: false, error: 'Invalid item id' };
  if (!isValidFirestoreId(payload.workspaceId) || payload.workspaceId !== expectedWorkspaceId) return { ok: false, error: 'Workspace id mismatch' };
  if (!isValidFirestoreId(payload.authorId) || payload.authorId !== expectedUid) return { ok: false, error: 'Author mismatch' };
  if (typeof payload.authorName !== 'string' || payload.authorName.trim().length < 1 || payload.authorName.length > BLUEPRINT_LIMITS.displayNameMax) {
    return { ok: false, error: 'Invalid authorName' };
  }
  if (!ALLOWED_ITEM_KINDS.includes(payload.kind as (typeof ALLOWED_ITEM_KINDS)[number])) {
    return { ok: false, error: 'Invalid kind' };
  }
  if (typeof payload.title !== 'string' || payload.title.trim().length < 1 || payload.title.length > BLUEPRINT_LIMITS.titleMax) {
    return { ok: false, error: 'Invalid title' };
  }
  if (typeof payload.expression !== 'string' || payload.expression.trim().length < 1 || payload.expression.length > BLUEPRINT_LIMITS.expressionMax) {
    return { ok: false, error: 'Invalid expression' };
  }
  if (payload.notes !== undefined && (typeof payload.notes !== 'string' || payload.notes.length > BLUEPRINT_LIMITS.notesMax)) {
    return { ok: false, error: 'Invalid notes' };
  }
  if (!isValidHexColor(payload.color)) return { ok: false, error: 'Invalid color' };
  return { ok: true };
}
