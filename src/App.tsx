/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, Loader2, Sparkles } from 'lucide-react';
import { CloudSyncProvider, useCloudSync } from './context/CloudSyncContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CalculatorView } from './components/CalculatorView';
import { GraphView } from './components/GraphView';
import { StemLabView } from './components/StemLabView';
import { CadView } from './components/CadView';
import { ResearchView } from './components/ResearchView';
import { InteractiveFocalStage } from './components/InteractiveFocalStage';
import {
  AxiomBrandLogo,
  DuotoneCalculatorIcon,
  DuotoneGraphIcon,
  DuotoneStemIcon,
  DuotoneCadIcon,
  DuotoneResearchIcon,
} from './components/AxiomIcons';

type WorkspaceTab = 'calc' | 'graph' | 'stem' | 'cad' | 'research';

const NAV_ITEMS: { id: WorkspaceTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'calc', label: 'Calculator', Icon: DuotoneCalculatorIcon },
  { id: 'graph', label: 'Graph', Icon: DuotoneGraphIcon },
  { id: 'stem', label: 'STEM Lab', Icon: DuotoneStemIcon },
  { id: 'cad', label: 'CAD 3D', Icon: DuotoneCadIcon },
  { id: 'research', label: 'Research', Icon: DuotoneResearchIcon },
];

function AxiomShell() {
  const { user, login, logout, isAuthenticating } = useCloudSync();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('calc');
  const [sharedGraphExpr, setSharedGraphExpr] = useState<string | undefined>(undefined);
  const [sharedCalcExpr, setSharedCalcExpr] = useState<string | undefined>(undefined);
  const [showFocalStage, setShowFocalStage] = useState(false);

  const handleSendToGraph = (expr: string) => {
    setSharedGraphExpr(expr);
    setActiveTab('graph');
  };

  const handleOpenInCalc = (expr: string) => {
    setSharedCalcExpr(expr);
    setActiveTab('calc');
  };

  const handleExploreFocalTopic = (topic: string) => {
    if (topic === 'harmonic') {
      handleSendToGraph('2.2 * exp(-0.15 * x) * cos(3.5 * x)');
      setShowFocalStage(false);
    } else if (topic === 'cad-gear') {
      setActiveTab('cad');
      setShowFocalStage(false);
    }
  };

  return (
    <div className="min-h-[100dvh] h-[100dvh] flex flex-col bg-[#080B10] text-[#F0F4F8] overflow-hidden">
      {/* Strict 3-Zone Top Bar with Specular Highlight and Z-index 20 */}
      <header className="h-14 px-3 sm:px-4 md:px-6 border-b border-[#182232] bg-[#0E141F] flex items-center justify-between gap-4 md:gap-8 shrink-0 z-20 specular-card">
        {/* Zone 1: Brand Wordmark with Geometric SVG Icon */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('calc');
            }}
            className="flex items-center gap-2.5 font-display text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap btn-tactile focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-lg p-1"
          >
            <AxiomBrandLogo className="w-6 h-6 text-cyan-400 shrink-0" />
            <span className="font-bold tracking-tight">Axiom</span>
          </a>

          {/* Focal 3D Centerpiece Quick Toggle */}
          <button
            type="button"
            aria-label="Toggle 3D Focal Stage"
            onClick={() => setShowFocalStage((v) => !v)}
            className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono border transition-all btn-tactile ${
              showFocalStage
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                : 'bg-[#162030] hover:bg-[#1E2B40] text-slate-400 hover:text-white border-[#212E42]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>3D Singularity</span>
          </button>
        </div>

        {/* Zone 2: 5 Concise Workspace Links with Shared-Layout Motion Indicator (Desktop) */}
        <nav aria-label="Primary workspaces" className="hidden md:flex items-center gap-1 min-w-0">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`relative px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 rounded-lg btn-tactile focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  active ? 'text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{label}</span>
                {active && (
                  <motion.div
                    layoutId="activeWorkspacePill"
                    transition={{ type: 'spring', bounce: 0.18, duration: 0.4 }}
                    className="absolute inset-0 rounded-lg bg-cyan-500/10 border border-cyan-500/30 -z-10"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action with Double-Submit Prevention */}
        <div className="shrink-0">
          {user ? (
            <button
              type="button"
              disabled={isAuthenticating}
              onClick={logout}
              aria-label="Sign out of account"
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-[#162030] hover:bg-[#1E2B40] text-slate-200 border border-[#212E42] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 btn-tactile disabled:opacity-50 min-h-[38px]"
            >
              {isAuthenticating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              ) : (
                <LogOut className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span className="max-w-[120px] truncate">{user.displayName || 'Account'}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isAuthenticating}
              onClick={login}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 btn-tactile disabled:opacity-50 min-h-[38px]"
            >
              {isAuthenticating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
              ) : (
                <LogIn className="w-3.5 h-3.5" />
              )}
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Expandable 3D Focal Stage Banner */}
      <AnimatePresence>
        {showFocalStage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-b border-[#182232] bg-[#05070B] p-3 sm:p-4 shrink-0"
          >
            <div className="max-w-4xl mx-auto">
              <InteractiveFocalStage onExploreTopic={handleExploreFocalTopic} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Active Workspace with Route-Level Isolation */}
      <main className="flex-1 min-h-0 min-w-0 overflow-hidden pb-16 md:pb-0 relative">
        {activeTab === 'calc' && (
          <ErrorBoundary name="Scientific Calculator" onReset={() => setSharedCalcExpr(undefined)}>
            <CalculatorView onSendToGraph={handleSendToGraph} externalExpr={sharedCalcExpr} />
          </ErrorBoundary>
        )}
        {activeTab === 'graph' && (
          <ErrorBoundary name="2D & 3D Grapher" onReset={() => setSharedGraphExpr(undefined)}>
            <GraphView initialExpression={sharedGraphExpr} />
          </ErrorBoundary>
        )}
        {activeTab === 'stem' && (
          <ErrorBoundary name="STEM Simulation Lab">
            <StemLabView />
          </ErrorBoundary>
        )}
        {activeTab === 'cad' && (
          <ErrorBoundary name="Parametric 3D CAD Studio">
            <CadView />
          </ErrorBoundary>
        )}
        {activeTab === 'research' && (
          <ErrorBoundary name="Peer Research & Cloud Sync">
            <ResearchView onOpenInCalc={handleOpenInCalc} onOpenInGraph={handleSendToGraph} />
          </ErrorBoundary>
        )}
      </main>

      {/* Mobile / Android Thumb-Zone Bottom Bar (<= 15% viewport height, >= 44px targets, z-20) */}
      <nav
        aria-label="Mobile workspace navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-20 h-16 bg-[#0E141F] border-t border-[#182232] grid grid-cols-5 items-center specular-card"
      >
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors btn-tactile ${
                active ? 'text-cyan-300 font-semibold' : 'text-slate-400'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span className="text-[10px] whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary name="Root Application">
      <CloudSyncProvider>
        <AxiomShell />
      </CloudSyncProvider>
    </ErrorBoundary>
  );
}
