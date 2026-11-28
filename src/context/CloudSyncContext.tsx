/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
  where,
  or,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, signInWithGoogle, signOutUser } from '../services/firebaseClient';
import {
  isValidFirestoreId,
  validateSavedFormulaPayload,
  validateWorkspacePayload,
  validateWorkspaceItemPayload,
  type ALLOWED_FORMULA_MODES,
  type ALLOWED_WORKSPACE_DOMAINS,
  type ALLOWED_ITEM_KINDS,
} from '../utils/firestoreValidation';
import { withTimeout, formatUserFacingError } from '../utils/asyncResilience';

export interface CloudFormula {
  id: string;
  ownerId: string;
  expression: string;
  label: string;
  mode: (typeof ALLOWED_FORMULA_MODES)[number];
  color: string;
  visible: boolean;
  updatedAtLabel: string;
}

export interface ResearchWorkspace {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  domain: (typeof ALLOWED_WORKSPACE_DOMAINS)[number];
  visibility: 'private' | 'shared';
}

export interface WorkspaceItem {
  id: string;
  workspaceId: string;
  authorId: string;
  authorName: string;
  kind: (typeof ALLOWED_ITEM_KINDS)[number];
  title: string;
  expression: string;
  notes?: string;
  color: string;
}

const SEED_FORMULAS: CloudFormula[] = [
  {
    id: 'seed-damped-wave',
    ownerId: 'local',
    expression: 'a * sin(b * x) * exp(-0.08 * x^2)',
    label: 'Damped Gaussian Wavepacket',
    mode: 'graph2d',
    color: '#4C8DFF',
    visible: true,
    updatedAtLabel: 'Local Preset',
  },
  {
    id: 'seed-spiral-rose',
    ownerId: 'local',
    expression: 'r = 2.5 * cos(3 * theta)',
    label: 'Polar Trifoil',
    mode: 'graph2d',
    color: '#F59E0B',
    visible: true,
    updatedAtLabel: 'Local Preset',
  },
  {
    id: 'seed-saddle-3d',
    ownerId: 'local',
    expression: '1.6 * sin(sqrt(x^2 + y^2)) * cos(0.4 * x)',
    label: 'Bessel-Like Radial Wave',
    mode: 'graph3d',
    color: '#38BDF8',
    visible: true,
    updatedAtLabel: 'Local Preset',
  },
];

const SEED_WORKSPACES: ResearchWorkspace[] = [
  {
    id: 'ws-harmonic-lab',
    ownerId: 'local',
    ownerName: 'Axiom Lab',
    title: 'Coupled Harmonic & RLC Resonance Study',
    domain: 'physics',
    visibility: 'shared',
  },
  {
    id: 'ws-aerospace-cad',
    ownerId: 'local',
    ownerName: 'Axiom Lab',
    title: 'Turbine Flange & Structural Stress',
    domain: 'cad',
    visibility: 'shared',
  },
];

const SEED_ITEMS: WorkspaceItem[] = [
  {
    id: 'item-1',
    workspaceId: 'ws-harmonic-lab',
    authorId: 'local',
    authorName: 'Dr. Elena Vance',
    kind: 'graph',
    title: 'Underdamped Envelope',
    expression: '2.2 * exp(-0.15 * x) * cos(3.5 * x)',
    notes: 'Matches Q = 4.2 RLC step response at f0 = 503.3 Hz.',
    color: '#4C8DFF',
  },
  {
    id: 'item-2',
    workspaceId: 'ws-harmonic-lab',
    authorId: 'local',
    authorName: 'Marcus Chen',
    kind: 'formula',
    title: 'Resonant Frequency Relation',
    expression: '1 / (2 * pi * sqrt(0.01 * 0.00001))',
    notes: 'Nominal 10 mH inductor paired with 10 uF polypropylene cap.',
    color: '#F59E0B',
  },
  {
    id: 'item-3',
    workspaceId: 'ws-aerospace-cad',
    authorId: 'local',
    authorName: 'Axiom Lab',
    kind: 'cad',
    title: '6061-T6 Mounting Bracket',
    expression: 'Box(4.0, 2.5, 1.5) · Aluminum 2.70 g/cm³',
    notes: 'Safety factor > 2.4 under 1.2 kN cantilever load.',
    color: '#34D399',
  },
];

interface CloudSyncContextValue {
  user: User | null;
  authReady: boolean;
  syncStatus: 'local' | 'syncing' | 'synced' | 'error';
  syncError: string | null;
  isLoadingFormulas: boolean;
  isLoadingWorkspaces: boolean;
  isLoadingItems: boolean;
  isAuthenticating: boolean;
  isSavingFormula: boolean;
  isCreatingWorkspace: boolean;
  isJoiningWorkspace: boolean;
  isPublishingItem: boolean;
  deletingIds: string[];
  formulas: CloudFormula[];
  workspaces: ResearchWorkspace[];
  activeWorkspaceId: string;
  workspaceItems: WorkspaceItem[];
  setActiveWorkspaceId: (id: string) => void;
  clearSyncError: () => void;
  retrySync: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  saveFormula: (input: {
    expression: string;
    label: string;
    mode: (typeof ALLOWED_FORMULA_MODES)[number];
    color: string;
  }) => Promise<void>;
  deleteFormula: (id: string) => Promise<void>;
  createWorkspace: (
    title: string,
    domain: ResearchWorkspace['domain'],
    visibility: 'private' | 'shared'
  ) => Promise<string>;
  joinWorkspaceById: (workspaceId: string) => Promise<void>;
  addWorkspaceItem: (item: {
    kind: WorkspaceItem['kind'];
    title: string;
    expression: string;
    notes?: string;
    color: string;
  }) => Promise<void>;
  deleteWorkspaceItem: (itemId: string) => Promise<void>;
}

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);

export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'synced' | 'error'>('local');
  const [syncError, setSyncError] = useState<string | null>(null);

  const [isLoadingFormulas, setIsLoadingFormulas] = useState(false);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Mutation and Race Condition Loading Locks
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSavingFormula, setIsSavingFormula] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [isJoiningWorkspace, setIsJoiningWorkspace] = useState(false);
  const [isPublishingItem, setIsPublishingItem] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);

  const [formulas, setFormulas] = useState<CloudFormula[]>(SEED_FORMULAS);
  const [workspaces, setWorkspaces] = useState<ResearchWorkspace[]>(SEED_WORKSPACES);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(SEED_WORKSPACES[0].id);
  const [workspaceItems, setWorkspaceItems] = useState<WorkspaceItem[]>(SEED_ITEMS);

  const clearSyncError = useCallback(() => {
    setSyncError(null);
  }, []);

  const syncUserProfile = useCallback(async (currUser: User) => {
    if (!currUser.emailVerified) return;
    setSyncStatus('syncing');
    const profilePath = `users/${currUser.uid}`;
    try {
      await withTimeout(
        setDoc(
          doc(db, 'users', currUser.uid),
          {
            uid: currUser.uid,
            displayName: (currUser.displayName || 'Researcher').slice(0, 80),
            email: (currUser.email || '').slice(0, 160),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
        15000,
        'Profile synchronization'
      );
      setSyncStatus('synced');
    } catch (err) {
      setSyncStatus('error');
      const formatted = formatUserFacingError(err, 'Failed to sync user profile.');
      setSyncError(formatted);
      if (err instanceof Error && err.message.toLowerCase().includes('permission')) {
        handleFirestoreError(err, OperationType.WRITE, profilePath);
      }
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser && nextUser.emailVerified) {
        await syncUserProfile(nextUser);
      } else {
        setSyncStatus('local');
        setFormulas(SEED_FORMULAS);
        setWorkspaces(SEED_WORKSPACES);
        setWorkspaceItems(SEED_ITEMS);
        setActiveWorkspaceId(SEED_WORKSPACES[0].id);
      }
    });
    return () => unsub();
  }, [syncUserProfile]);

  // Listen to user's cloud formulas when signed in
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setIsLoadingFormulas(false);
      return;
    }
    setIsLoadingFormulas(true);
    const formulasPath = `users/${user.uid}/formulas`;
    const q = query(
      collection(db, formulasPath),
      where('ownerId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs: CloudFormula[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: String(data.ownerId),
            expression: String(data.expression),
            label: String(data.label),
            mode: data.mode as CloudFormula['mode'],
            color: String(data.color || '#4C8DFF'),
            visible: Boolean(data.visible),
            updatedAtLabel: 'Synced',
          };
        });
        setFormulas(docs);
        setIsLoadingFormulas(false);
        setSyncStatus('synced');
      },
      (error) => {
        setIsLoadingFormulas(false);
        setSyncStatus('error');
        setSyncError(formatUserFacingError(error, 'Failed to load cloud formulas.'));
        handleFirestoreError(error, OperationType.LIST, formulasPath);
      }
    );
    return () => unsub();
  }, [authReady, user]);

  // Listen to accessible workspaces when signed in
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setIsLoadingWorkspaces(false);
      return;
    }
    setIsLoadingWorkspaces(true);
    const q = query(
      collection(db, 'workspaces'),
      or(where('ownerId', '==', user.uid), where('visibility', '==', 'shared'))
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ResearchWorkspace[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: String(data.ownerId),
            ownerName: String(data.ownerName || 'Researcher'),
            title: String(data.title),
            domain: data.domain as ResearchWorkspace['domain'],
            visibility: data.visibility as 'private' | 'shared',
          };
        });
        setWorkspaces(list.length > 0 ? list : SEED_WORKSPACES);
        setIsLoadingWorkspaces(false);
        if (list.length > 0) {
          setActiveWorkspaceId((prev) => (list.some((w) => w.id === prev) ? prev : list[0].id));
        }
      },
      (error) => {
        setIsLoadingWorkspaces(false);
        setSyncStatus('error');
        setSyncError(formatUserFacingError(error, 'Failed to fetch collaborative workspaces.'));
        handleFirestoreError(error, OperationType.LIST, 'workspaces');
      }
    );
    return () => unsub();
  }, [authReady, user]);

  // Listen to items in active workspace when signed in
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified || !isValidFirestoreId(activeWorkspaceId)) {
      setIsLoadingItems(false);
      return;
    }
    const isSeedWs =
      SEED_WORKSPACES.some((w) => w.id === activeWorkspaceId) &&
      !workspaces.some((w) => w.id === activeWorkspaceId && w.ownerId !== 'local');
    if (isSeedWs) {
      setIsLoadingItems(false);
      return;
    }

    setIsLoadingItems(true);
    const itemsPath = `workspaces/${activeWorkspaceId}/items`;
    const q = query(
      collection(db, itemsPath),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('updatedAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: WorkspaceItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            workspaceId: String(data.workspaceId),
            authorId: String(data.authorId),
            authorName: String(data.authorName),
            kind: data.kind as WorkspaceItem['kind'],
            title: String(data.title),
            expression: String(data.expression),
            notes: data.notes ? String(data.notes) : undefined,
            color: String(data.color || '#4C8DFF'),
          };
        });
        setWorkspaceItems(items);
        setIsLoadingItems(false);
      },
      (error) => {
        setIsLoadingItems(false);
        setSyncStatus('error');
        setSyncError(formatUserFacingError(error, 'Failed to stream workspace feed items.'));
        handleFirestoreError(error, OperationType.LIST, itemsPath);
      }
    );
    return () => unsub();
  }, [authReady, user, activeWorkspaceId, workspaces]);

  const retrySync = useCallback(async () => {
    setSyncError(null);
    if (user) {
      await syncUserProfile(user);
    }
  }, [user, syncUserProfile]);

  const login = useCallback(async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setSyncError(null);
    try {
      await withTimeout(signInWithGoogle(), 30000, 'Google Sign-In');
    } catch (err) {
      const msg = formatUserFacingError(err, 'Sign-in could not be completed.');
      setSyncError(msg);
    } finally {
      setIsAuthenticating(false);
    }
  }, [isAuthenticating]);

  const logout = useCallback(async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setSyncError(null);
    try {
      await withTimeout(signOutUser(), 10000, 'Account Sign-Out');
    } catch (err) {
      setSyncError(formatUserFacingError(err, 'Sign-out failed.'));
    } finally {
      setIsAuthenticating(false);
    }
  }, [isAuthenticating]);

  const saveFormula = useCallback(
    async (input: {
      expression: string;
      label: string;
      mode: (typeof ALLOWED_FORMULA_MODES)[number];
      color: string;
    }) => {
      if (isSavingFormula) return;
      setIsSavingFormula(true);
      setSyncError(null);

      const id = `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      if (!user || !user.emailVerified) {
        setFormulas((prev) => [
          {
            id,
            ownerId: 'local',
            expression: input.expression.slice(0, 500),
            label: input.label.slice(0, 80),
            mode: input.mode,
            color: input.color,
            visible: true,
            updatedAtLabel: 'Saved Locally',
          },
          ...prev,
        ]);
        setIsSavingFormula(false);
        return;
      }

      const payload = {
        id,
        ownerId: user.uid,
        expression: input.expression.trim().slice(0, 500),
        label: input.label.trim().slice(0, 80) || 'Formula',
        mode: input.mode,
        color: /^#[0-9a-fA-F]{3,8}$/.test(input.color) ? input.color : '#4C8DFF',
        visible: true,
      };
      const check = validateSavedFormulaPayload(payload, user.uid);
      if (!check.ok) {
        setSyncError(check.error || 'Invalid formula payload');
        setIsSavingFormula(false);
        return;
      }

      const docPath = `users/${user.uid}/formulas/${id}`;
      try {
        await withTimeout(
          setDoc(doc(db, docPath), {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
          15000,
          'Saving formula'
        );
      } catch (err) {
        setSyncError(formatUserFacingError(err, 'Failed to save formula to cloud.'));
        handleFirestoreError(err, OperationType.CREATE, docPath);
      } finally {
        setIsSavingFormula(false);
      }
    },
    [user, isSavingFormula]
  );

  const deleteFormula = useCallback(
    async (id: string) => {
      if (deletingIds.includes(id)) return;
      setDeletingIds((prev) => [...prev, id]);
      setSyncError(null);

      if (!user || !user.emailVerified || id.startsWith('seed-')) {
        setFormulas((prev) => prev.filter((f) => f.id !== id));
        setDeletingIds((prev) => prev.filter((dId) => dId !== id));
        return;
      }
      const docPath = `users/${user.uid}/formulas/${id}`;
      try {
        await withTimeout(deleteDoc(doc(db, docPath)), 15000, 'Deleting formula');
      } catch (err) {
        setSyncError(formatUserFacingError(err, 'Failed to delete formula.'));
        handleFirestoreError(err, OperationType.DELETE, docPath);
      } finally {
        setDeletingIds((prev) => prev.filter((dId) => dId !== id));
      }
    },
    [user, deletingIds]
  );

  const createWorkspace = useCallback(
    async (title: string, domain: ResearchWorkspace['domain'], visibility: 'private' | 'shared') => {
      if (isCreatingWorkspace) return '';
      setIsCreatingWorkspace(true);
      setSyncError(null);

      const id = `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      if (!user || !user.emailVerified) {
        const localWs: ResearchWorkspace = {
          id,
          ownerId: 'local',
          ownerName: 'Local Researcher',
          title: title.trim().slice(0, 120),
          domain,
          visibility,
        };
        setWorkspaces((prev) => [localWs, ...prev]);
        setActiveWorkspaceId(id);
        setWorkspaceItems([]);
        setIsCreatingWorkspace(false);
        return id;
      }

      const payload = {
        id,
        ownerId: user.uid,
        ownerName: (user.displayName || 'Researcher').slice(0, 80),
        title: title.trim().slice(0, 120),
        domain,
        visibility,
      };
      const check = validateWorkspacePayload(payload, user.uid);
      if (!check.ok) {
        const msg = check.error || 'Invalid workspace payload';
        setSyncError(msg);
        setIsCreatingWorkspace(false);
        throw new Error(msg);
      }
      const wsPath = `workspaces/${id}`;
      try {
        await withTimeout(
          Promise.all([
            setDoc(doc(db, wsPath), {
              ...payload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }),
            setDoc(doc(db, `workspaces/${id}/members/${user.uid}`), {
              uid: user.uid,
              workspaceId: id,
              displayName: payload.ownerName,
              role: 'owner',
              joinedAt: serverTimestamp(),
            }),
          ]),
          15000,
          'Creating workspace'
        );
        setActiveWorkspaceId(id);
        return id;
      } catch (err) {
        setSyncError(formatUserFacingError(err, 'Failed to create workspace.'));
        handleFirestoreError(err, OperationType.CREATE, wsPath);
        return '';
      } finally {
        setIsCreatingWorkspace(false);
      }
    },
    [user, isCreatingWorkspace]
  );

  const joinWorkspaceById = useCallback(
    async (workspaceId: string) => {
      if (isJoiningWorkspace) return;
      setIsJoiningWorkspace(true);
      setSyncError(null);

      const cleanId = workspaceId.trim();
      if (!isValidFirestoreId(cleanId)) {
        setSyncError('Workspace ID must be alphanumeric/hyphens/underscores (3-64 chars).');
        setIsJoiningWorkspace(false);
        return;
      }
      if (!user || !user.emailVerified) {
        setActiveWorkspaceId(cleanId);
        setIsJoiningWorkspace(false);
        return;
      }
      const memberPath = `workspaces/${cleanId}/members/${user.uid}`;
      try {
        await withTimeout(
          setDoc(doc(db, memberPath), {
            uid: user.uid,
            workspaceId: cleanId,
            displayName: (user.displayName || 'Researcher').slice(0, 80),
            role: 'researcher',
            joinedAt: serverTimestamp(),
          }),
          15000,
          'Joining workspace'
        );
        setActiveWorkspaceId(cleanId);
      } catch (err) {
        setSyncError(formatUserFacingError(err, 'Failed to join workspace.'));
        handleFirestoreError(err, OperationType.CREATE, memberPath);
      } finally {
        setIsJoiningWorkspace(false);
      }
    },
    [user, isJoiningWorkspace]
  );

  const addWorkspaceItem = useCallback(
    async (item: {
      kind: WorkspaceItem['kind'];
      title: string;
      expression: string;
      notes?: string;
      color: string;
    }) => {
      if (isPublishingItem) return;
      setIsPublishingItem(true);
      setSyncError(null);

      const id = `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      if (!user || !user.emailVerified || activeWorkspaceId.startsWith('ws-')) {
        setWorkspaceItems((prev) => [
          {
            id,
            workspaceId: activeWorkspaceId,
            authorId: user?.uid || 'local',
            authorName: user?.displayName || 'You (Local)',
            kind: item.kind,
            title: item.title.trim().slice(0, 120),
            expression: item.expression.trim().slice(0, 500),
            notes: item.notes?.trim().slice(0, 1000),
            color: item.color,
          },
          ...prev,
        ]);
        setIsPublishingItem(false);
        return;
      }

      const payload = {
        id,
        workspaceId: activeWorkspaceId,
        authorId: user.uid,
        authorName: (user.displayName || 'Researcher').slice(0, 80),
        kind: item.kind,
        title: item.title.trim().slice(0, 120),
        expression: item.expression.trim().slice(0, 500),
        ...(item.notes?.trim() ? { notes: item.notes.trim().slice(0, 1000) } : {}),
        color: /^#[0-9a-fA-F]{3,8}$/.test(item.color) ? item.color : '#4C8DFF',
      };
      const check = validateWorkspaceItemPayload(payload, user.uid, activeWorkspaceId);
      if (!check.ok) {
        setSyncError(check.error || 'Invalid research entry');
        setIsPublishingItem(false);
        return;
      }

      const itemPath = `workspaces/${activeWorkspaceId}/items/${id}`;
      try {
        await withTimeout(
          setDoc(doc(db, itemPath), {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
          15000,
          'Publishing entry'
        );
      } catch (err) {
        setSyncError(formatUserFacingError(err, 'Failed to publish entry.'));
        handleFirestoreError(err, OperationType.CREATE, itemPath);
      } finally {
        setIsPublishingItem(false);
      }
    },
    [user, activeWorkspaceId, isPublishingItem]
  );

  const deleteWorkspaceItem = useCallback(
    async (itemId: string) => {
      if (deletingIds.includes(itemId)) return;
      setDeletingIds((prev) => [...prev, itemId]);
      setSyncError(null);

      if (!user || !user.emailVerified || activeWorkspaceId.startsWith('ws-')) {
        setWorkspaceItems((prev) => prev.filter((i) => i.id !== itemId));
        setDeletingIds((prev) => prev.filter((dId) => dId !== itemId));
        return;
      }
      const itemPath = `workspaces/${activeWorkspaceId}/items/${itemId}`;
      try {
        await withTimeout(deleteDoc(doc(db, itemPath)), 15000, 'Deleting entry');
      } catch (err) {
        setSyncError(formatUserFacingError(err, 'Failed to delete entry.'));
        handleFirestoreError(err, OperationType.DELETE, itemPath);
      } finally {
        setDeletingIds((prev) => prev.filter((dId) => dId !== itemId));
      }
    },
    [user, activeWorkspaceId, deletingIds]
  );

  return (
    <CloudSyncContext.Provider
      value={{
        user,
        authReady,
        syncStatus,
        syncError,
        isLoadingFormulas,
        isLoadingWorkspaces,
        isLoadingItems,
        isAuthenticating,
        isSavingFormula,
        isCreatingWorkspace,
        isJoiningWorkspace,
        isPublishingItem,
        deletingIds,
        formulas,
        workspaces,
        activeWorkspaceId,
        workspaceItems,
        setActiveWorkspaceId,
        clearSyncError,
        retrySync,
        login,
        logout,
        saveFormula,
        deleteFormula,
        createWorkspace,
        joinWorkspaceById,
        addWorkspaceItem,
        deleteWorkspaceItem,
      }}
    >
      {children}
    </CloudSyncContext.Provider>
  );
}

export function useCloudSync() {
  const ctx = useContext(CloudSyncContext);
  if (!ctx) throw new Error('useCloudSync must be used inside CloudSyncProvider');
  return ctx;
}
