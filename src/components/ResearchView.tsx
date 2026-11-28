/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Cloud,
  Users,
  Plus,
  Trash2,
  ArrowUpRight,
  Copy,
  Check,
  LogIn,
  LogOut,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  FileQuestion,
  Bookmark,
  X,
  Loader2,
} from 'lucide-react';
import { useCloudSync, type ResearchWorkspace, type WorkspaceItem } from '../context/CloudSyncContext';

interface ResearchViewProps {
  onOpenInCalc: (expr: string) => void;
  onOpenInGraph: (expr: string) => void;
}

export function ResearchView({ onOpenInCalc, onOpenInGraph }: ResearchViewProps) {
  const {
    user,
    syncStatus,
    syncError,
    isLoadingFormulas,
    isLoadingWorkspaces,
    isLoadingItems,
    isAuthenticating,
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
    deleteFormula,
    createWorkspace,
    joinWorkspaceById,
    addWorkspaceItem,
    deleteWorkspaceItem,
  } = useCloudSync();

  const [newWsTitle, setNewWsTitle] = useState('');
  const [newWsDomain, setNewWsDomain] = useState<ResearchWorkspace['domain']>('physics');
  const [newWsVis, setNewWsVis] = useState<'shared' | 'private'>('shared');
  const [joinCode, setJoinCode] = useState('');

  const [itemKind, setItemKind] = useState<WorkspaceItem['kind']>('formula');
  const [itemTitle, setItemTitle] = useState('');
  const [itemExpr, setItemExpr] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsTitle.trim() || isCreatingWorkspace) return;
    try {
      await createWorkspace(newWsTitle, newWsDomain, newWsVis);
      setNewWsTitle('');
    } catch {
      // Error handled by context
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim() || !itemExpr.trim() || isPublishingItem) return;
    try {
      await addWorkspaceItem({
        kind: itemKind,
        title: itemTitle,
        expression: itemExpr,
        notes: itemNotes,
        color: itemKind === 'graph' ? '#22D3EE' : itemKind === 'cad' ? '#34D399' : '#F59E0B',
      });
      setItemTitle('');
      setItemExpr('');
      setItemNotes('');
    } catch {
      // Error handled by context
    }
  };

  const handleCopyWorkspaceId = () => {
    if (!activeWs) return;
    navigator.clipboard?.writeText(activeWs.id).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1200);
  };

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4 md:p-6 max-w-[1440px] mx-auto w-full space-y-5">
      {/* Cloud Sync Account Header Card */}
      <section className="bg-[#0E141F] border border-[#182232] rounded-xl p-4 md:p-5 flex flex-wrap items-center justify-between gap-4 specular-card">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-cyan-400 shrink-0" />
            <h2 className="text-base font-semibold text-white tracking-tight">
              Formula Cloud Database & Research Exchange
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            {user
              ? `Authenticated as ${user.displayName || user.email} · Firestore snapshot active (${syncStatus})`
              : 'Local session active. Sign in with Google to persist analytical formulas and collaborate across platforms.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <button
              type="button"
              disabled={isAuthenticating}
              onClick={logout}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[#161E2B] hover:bg-[#1E293B] text-slate-200 border border-[#263245] flex items-center gap-2 min-h-[44px] transition-colors btn-tactile disabled:opacity-50"
            >
              {isAuthenticating ? <Loader2 className="w-4 h-4 animate-spin text-cyan-400" /> : <LogOut className="w-4 h-4" />}
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              disabled={isAuthenticating}
              onClick={login}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center gap-2 min-h-[44px] transition-colors btn-tactile disabled:opacity-50"
            >
              {isAuthenticating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              Sign In with Google
            </button>
          )}
        </div>
      </section>

      {/* User-facing Error State Banner */}
      {syncError && (
        <section
          role="alert"
          aria-live="polite"
          className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2.5 text-amber-300 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="font-mono break-words">{syncError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void retrySync()}
              className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium flex items-center gap-1 transition-colors btn-tactile"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
            <button
              type="button"
              aria-label="Dismiss error notice"
              onClick={clearSyncError}
              className="p-1 text-amber-400 hover:text-amber-200 transition-colors btn-tactile"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0">
        {/* Left: Personal Cloud Formula Library */}
        <section className="lg:col-span-4 bg-[#0E141F] border border-[#182232] rounded-xl p-4 space-y-3 specular-card min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Stored Formulas</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {isLoadingFormulas ? '...' : formulas.length}
            </span>
          </div>

          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {/* 1. Loading State */}
            {isLoadingFormulas && (
              <div className="space-y-2 py-2">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="animate-pulse bg-[#05070B] border border-[#182232] rounded-lg p-3 space-y-2"
                  >
                    <div className="h-3 bg-[#1C2638] rounded w-2/3" />
                    <div className="h-4 bg-[#141C2B] rounded w-full" />
                    <div className="flex gap-2 pt-1">
                      <div className="h-5 bg-[#1C2638] rounded w-16" />
                      <div className="h-5 bg-[#1C2638] rounded w-16" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 2. Empty State */}
            {!isLoadingFormulas && formulas.length === 0 && (
              <div className="p-6 text-center space-y-2 bg-[#05070B] border border-[#182232] rounded-lg">
                <FileQuestion className="w-6 h-6 text-slate-500 mx-auto" />
                <p className="text-xs font-medium text-slate-300">No Stored Formulas</p>
                <p className="text-[11px] text-slate-500">
                  Save active calculations from the Calculator or plot curves in the Graph studio.
                </p>
              </div>
            )}

            {/* 3 & 4. Success State */}
            {!isLoadingFormulas &&
              formulas.map((f) => {
                const isDeleting = deletingIds.includes(f.id);
                return (
                  <div
                    key={f.id}
                    className="bg-[#05070B] border border-[#182232] rounded-lg p-3 space-y-2 transition-colors hover:border-[#27374D] min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-white truncate">{f.label}</div>
                        <div className="text-[11px] text-slate-500">
                          {f.mode} · {f.updatedAtLabel}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isDeleting}
                        aria-label={`Delete formula ${f.label}`}
                        onClick={() => void deleteFormula(f.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 shrink-0 transition-colors btn-tactile disabled:opacity-40"
                      >
                        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="font-mono text-xs text-cyan-300 break-all">{f.expression}</div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenInCalc(f.expression)}
                        className="px-2.5 py-1 text-[11px] rounded bg-[#162030] text-slate-200 hover:bg-[#1E2B40] flex items-center gap-1 transition-colors btn-tactile"
                      >
                        Calc <ArrowUpRight className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenInGraph(f.expression)}
                        className="px-2.5 py-1 text-[11px] rounded bg-[#162030] text-cyan-300 hover:bg-[#1E2B40] flex items-center gap-1 transition-colors btn-tactile"
                      >
                        Graph <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        {/* Right: Collaborative Peer Research Workspace */}
        <section className="lg:col-span-8 bg-[#0E141F] border border-[#182232] rounded-xl p-4 space-y-4 specular-card min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="w-4 h-4 text-amber-400 shrink-0" />
              <h3 className="text-sm font-semibold text-white">Peer Research Channels</h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="join-ws-input" className="sr-only">Join Workspace ID</label>
              <input
                id="join-ws-input"
                type="text"
                placeholder="Join workspace ID..."
                value={joinCode}
                disabled={isJoiningWorkspace}
                onChange={(e) => setJoinCode(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[#05070B] border border-[#182232] font-mono text-xs text-white w-44 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              />
              <button
                type="button"
                disabled={isJoiningWorkspace || !joinCode.trim()}
                onClick={() => {
                  if (joinCode.trim()) {
                    void joinWorkspaceById(joinCode);
                    setJoinCode('');
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#161E2B] text-slate-200 hover:bg-[#1E293B] border border-[#263245] transition-colors btn-tactile disabled:opacity-50 flex items-center gap-1.5"
              >
                {isJoiningWorkspace && <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />}
                Join
              </button>
            </div>
          </div>

          {/* Workspace Selector Strip */}
          {isLoadingWorkspaces ? (
            <div className="flex gap-2 py-1">
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className="animate-pulse h-12 w-44 bg-[#05070B] border border-[#182232] rounded-lg"
                />
              ))}
            </div>
          ) : workspaces.length === 0 ? (
            <div className="p-4 bg-[#05070B] border border-[#182232] rounded-lg text-center text-xs text-slate-400">
              <FolderOpen className="w-5 h-5 text-slate-500 mx-auto mb-1" />
              No active research workspaces. Create an initial workspace below.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => setActiveWorkspaceId(ws.id)}
                  className={`px-3 py-2 rounded-lg border text-left transition-colors btn-tactile ${
                    ws.id === activeWorkspaceId
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-white'
                      : 'bg-[#05070B] border-[#182232] text-slate-300 hover:bg-[#141B26]'
                  }`}
                >
                  <div className="text-xs font-medium">{ws.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {ws.domain} · {ws.visibility} · {ws.ownerName}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Create New Workspace Form */}
          <form
            onSubmit={handleCreateWorkspace}
            className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-[#182232]"
          >
            <div className="sm:col-span-6">
              <label htmlFor="new-ws-title" className="sr-only">Workspace Title</label>
              <input
                id="new-ws-title"
                type="text"
                placeholder="New research workspace title..."
                value={newWsTitle}
                disabled={isCreatingWorkspace}
                onChange={(e) => setNewWsTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#05070B] border border-[#182232] text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="new-ws-domain" className="sr-only">Workspace Domain</label>
              <select
                id="new-ws-domain"
                aria-label="Workspace domain"
                value={newWsDomain}
                disabled={isCreatingWorkspace}
                onChange={(e) => setNewWsDomain(e.target.value as ResearchWorkspace['domain'])}
                className="w-full px-2.5 py-2 rounded-lg bg-[#05070B] border border-[#182232] text-xs text-slate-200"
              >
                <option value="math">Math</option>
                <option value="physics">Physics</option>
                <option value="chemistry">Chemistry</option>
                <option value="electrical">Electrical</option>
                <option value="cs">CS</option>
                <option value="cad">CAD</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="new-ws-vis" className="sr-only">Workspace Visibility</label>
              <select
                id="new-ws-vis"
                aria-label="Workspace visibility"
                value={newWsVis}
                disabled={isCreatingWorkspace}
                onChange={(e) => setNewWsVis(e.target.value as 'shared' | 'private')}
                className="w-full px-2.5 py-2 rounded-lg bg-[#05070B] border border-[#182232] text-xs text-slate-200"
              >
                <option value="shared">Shared</option>
                <option value="private">Private</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isCreatingWorkspace || !newWsTitle.trim()}
              className="sm:col-span-2 px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold flex items-center justify-center gap-1 transition-colors btn-tactile disabled:opacity-50 min-h-[40px]"
            >
              {isCreatingWorkspace ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {isCreatingWorkspace ? 'Creating...' : 'Create'}
            </button>
          </form>

          {/* Active Workspace Header & Shareable ID */}
          {activeWs && (
            <div className="bg-[#05070B] border border-[#182232] rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-white">{activeWs.title}</div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  ID: {activeWs.id}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyWorkspaceId}
                className="px-2.5 py-1.5 text-xs rounded-md bg-[#162030] text-slate-200 hover:bg-[#1E2B40] flex items-center gap-1.5 transition-colors btn-tactile"
              >
                {copiedId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedId ? 'Copied ID' : 'Copy Invite ID'}
              </button>
            </div>
          )}

          {/* Contribute Shared Formula / Note */}
          <form
            onSubmit={handleAddItem}
            className="bg-[#05070B] border border-[#182232] rounded-lg p-3 space-y-2.5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-2">
                <label htmlFor="contrib-kind" className="sr-only">Contribution Kind</label>
                <select
                  id="contrib-kind"
                  aria-label="Contribution type"
                  value={itemKind}
                  disabled={isPublishingItem}
                  onChange={(e) => setItemKind(e.target.value as WorkspaceItem['kind'])}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#0E141F] border border-[#182232] text-xs text-slate-200"
                >
                  <option value="formula">Formula</option>
                  <option value="graph">Graph</option>
                  <option value="cad">CAD Spec</option>
                  <option value="note">Note</option>
                </select>
              </div>
              <div className="sm:col-span-4">
                <label htmlFor="contrib-title" className="sr-only">Entry Title</label>
                <input
                  id="contrib-title"
                  type="text"
                  placeholder="Entry title..."
                  value={itemTitle}
                  disabled={isPublishingItem}
                  onChange={(e) => setItemTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0E141F] border border-[#182232] text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                />
              </div>
              <div className="sm:col-span-6">
                <label htmlFor="contrib-expr" className="sr-only">Expression or Specification</label>
                <input
                  id="contrib-expr"
                  type="text"
                  placeholder="Expression or specification..."
                  value={itemExpr}
                  disabled={isPublishingItem}
                  onChange={(e) => setItemExpr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0E141F] border border-[#182232] font-mono text-xs text-cyan-300 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <label htmlFor="contrib-notes" className="sr-only">Peer Notes</label>
              <input
                id="contrib-notes"
                type="text"
                placeholder="Peer research notes or observations (optional)..."
                value={itemNotes}
                disabled={isPublishingItem}
                onChange={(e) => setItemNotes(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-[#0E141F] border border-[#182232] text-xs text-slate-200 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isPublishingItem || !itemTitle.trim() || !itemExpr.trim()}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors btn-tactile disabled:opacity-50 min-h-[40px] flex items-center justify-center gap-1.5"
              >
                {isPublishingItem && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isPublishingItem ? 'Publishing...' : 'Publish Entry'}
              </button>
            </div>
          </form>

          {/* Shared Workspace Feed */}
          <div className="space-y-2.5">
            {isLoadingItems && (
              <div className="space-y-2 py-2">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="animate-pulse bg-[#05070B] border border-[#182232] rounded-lg p-4 space-y-2"
                  >
                    <div className="h-4 bg-[#1C2638] rounded w-1/3" />
                    <div className="h-4 bg-[#141C2B] rounded w-4/5" />
                    <div className="h-3 bg-[#1C2638] rounded w-1/2" />
                  </div>
                ))}
              </div>
            )}

            {!isLoadingItems && workspaceItems.length === 0 && (
              <div className="p-8 text-center space-y-2 bg-[#05070B] border border-[#182232] rounded-lg">
                <FileQuestion className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">No Research Entries in this Channel</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Publish a verified calculation, mathematical graph curve, or CAD component above.
                </p>
              </div>
            )}

            {!isLoadingItems &&
              workspaceItems.map((item) => {
                const isDeleting = deletingIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className="bg-[#05070B] border border-[#182232] rounded-lg p-3.5 space-y-1.5 transition-colors hover:border-[#27374D] min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
                        <span className="font-semibold text-white truncate">{item.title}</span>
                        <span className="text-slate-500 shrink-0">·</span>
                        <span className="text-slate-400 capitalize shrink-0">{item.kind}</span>
                        <span className="text-slate-500 shrink-0">·</span>
                        <span className="text-slate-400 truncate">{item.authorName}</span>
                      </div>
                      <button
                        type="button"
                        disabled={isDeleting}
                        aria-label={`Remove ${item.title}`}
                        onClick={() => void deleteWorkspaceItem(item.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors btn-tactile disabled:opacity-40 shrink-0"
                      >
                        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="font-mono text-xs text-cyan-300 break-all">{item.expression}</div>
                    {item.notes && <p className="text-xs text-slate-400 break-words">{item.notes}</p>}
                    {(item.kind === 'formula' || item.kind === 'graph') && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => onOpenInCalc(item.expression)}
                          className="text-[11px] text-slate-300 hover:text-white underline underline-offset-2 btn-tactile"
                        >
                          Load in Calculator
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenInGraph(item.expression)}
                          className="text-[11px] text-cyan-300 hover:text-cyan-200 underline underline-offset-2 btn-tactile"
                        >
                          Plot in Graph
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      </div>
    </div>
  );
}
