/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, Loader2, Boxes, ChevronDown } from 'lucide-react';
import { CloudSyncProvider, useCloudSync } from './context/CloudSyncContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CalculatorView } from './components/CalculatorView';
const GraphView = lazy(() => import('./components/GraphView').then((m) => ({ default: m.GraphView })));
const StemLabView = lazy(() => import('./components/StemLabView').then((m) => ({ default: m.StemLabView })));
const CadView = lazy(() => import('./components/CadView').then((m) => ({ default: m.CadView })));
const ResearchView = lazy(() => import('./components/ResearchView').then((m) => ({ default: m.ResearchView })));

function ViewFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center text-[#6B7079]">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em]">Loading…</span>
    </div>
  );
}
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

const NAV_ITEMS: {
  id: WorkspaceTab;
  label: string;
  short: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'calc', label: 'Calculator', short: 'Calc', Icon: DuotoneCalculatorIcon },
  { id: 'graph', label: 'Graph', short: 'Graph', Icon: DuotoneGraphIcon },
  { id: 'stem', label: 'STEM Lab', short: 'Lab', Icon: DuotoneStemIcon },
  { id: 'cad', label: 'CAD 3D', short: 'CAD', Icon: DuotoneCadIcon },
  { id: 'research', label: 'Research', short: 'Docs', Icon: DuotoneResearchIcon },
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

  const activeLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? 'Workspace';

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-[#0A0B0D] text-[#ECEDEF]">
      {/* ------------------------------- Top bar ------------------------------ */}
      <header className="relative z-30 shrink-0 border-b border-[#202329] bg-[#0A0B0D]/95">
        <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-3 px-3 sm:px-5 lg:px-6">
          {/* Brand */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('calc');
            }}
            className="group flex shrink-0 items-center gap-2.5 rounded-lg py-1 pr-1"
          >
            <AxiomBrandLogo className="h-[26px] w-[26px] shrink-0 transition-transform duration-300 group-hover:rotate-3" />
            <span className="flex flex-col leading-none">
              <span className="text-[15px] font-semibold tracking-[-0.02em] text-white">Axiom</span>
              <span className="mt-1 hidden text-[9.5px] font-medium uppercase tracking-[0.12em] text-[#6B7079] sm:block">
                Engineering Studio
              </span>
            </span>
          </a>

          <span className="mx-1 hidden h-6 w-px bg-[#23262E] md:block" />

          {/* Desktop workspace switcher */}
          <nav aria-label="Primary workspaces" className="hidden min-w-0 md:block">
            <div className="segmented">
              {NAV_ITEMS.map(({ id, label, Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    data-active={active}
                    aria-current={active ? 'page' : undefined}
                    className="segmented-item"
                  >
                    {active && (
                      <motion.span
                        layoutId="workspace-indicator"
                        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
                        className="absolute inset-0 -z-10 rounded-[7px] border border-[#31353F] bg-[#1B1F26]"
                      />
                    )}
                    <Icon className={`h-[15px] w-[15px] ${active ? 'text-[#4C8DFF]' : 'text-[#6B7079]'}`} />
                    <span className="hidden lg:inline">{label}</span>
                    <span className="lg:hidden">{label === 'STEM Lab' ? 'Lab' : label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              aria-expanded={showFocalStage}
              onClick={() => setShowFocalStage((v) => !v)}
              className={`btn hidden h-9 sm:inline-flex ${showFocalStage ? 'border-[#31353F] bg-[#1B1F26] text-white' : ''}`}
            >
              <Boxes className="h-[15px] w-[15px] text-[#4C8DFF]" />
              <span className="hidden lg:inline">Live stage</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-[#6B7079] transition-transform duration-300 ${showFocalStage ? 'rotate-180' : ''}`}
              />
            </button>

            {user ? (
              <button
                type="button"
                disabled={isAuthenticating}
                onClick={logout}
                aria-label="Sign out of account"
                className="btn h-9 max-w-[168px]"
              >
                {isAuthenticating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9EA3AC]" />
                ) : (
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#4C8DFF]/15 text-[10px] font-semibold text-[#9CC0FF]">
                    {(user.displayName || user.email || 'A').slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="truncate">{user.displayName || 'Account'}</span>
                <LogOut className="h-3.5 w-3.5 shrink-0 text-[#6B7079]" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isAuthenticating}
                onClick={login}
                className="btn btn-primary h-9"
              >
                {isAuthenticating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogIn className="h-3.5 w-3.5" />
                )}
                <span className="hidden xs:inline sm:inline">Sign in</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ---------------------------- Live stage ----------------------------- */}
      <AnimatePresence initial={false}>
        {showFocalStage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0 overflow-hidden border-b border-[#202329] bg-[#0C0E11]"
          >
            <div className="mx-auto w-full max-w-[1000px] px-4 py-4">
              <InteractiveFocalStage onExploreTopic={handleExploreFocalTopic} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contextual workspace bar */}
      <div className="hidden shrink-0 items-center justify-between border-b border-[#1A1D23] px-6 py-2 md:flex">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-[13px] font-medium tracking-[-0.01em] text-[#ECEDEF]">{activeLabel}</h1>
          <span className="text-[11px] text-[#6B7079]">
            {activeTab === 'calc' && 'CAS evaluation, statistics, base conversion and equation solving'}
            {activeTab === 'graph' && 'Cartesian, polar and parametric plotting with a real-time 3D surface'}
            {activeTab === 'stem' && 'Physics, chemistry, electrical and computer science models'}
            {activeTab === 'cad' && 'Parametric solid modelling with material mass properties'}
            {activeTab === 'research' && 'Shared formula libraries backed by your account'}
          </span>
        </div>
        <span className="eyebrow">v2.1</span>
      </div>

      {/* --------------------------- Active workspace ------------------------ */}
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden pb-[68px] md:pb-0">
        <Suspense fallback={<ViewFallback />}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
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
          </motion.div>
        </AnimatePresence>
        </Suspense>
      </main>

      {/* --------------------------- Mobile tab bar -------------------------- */}
      <nav
        aria-label="Mobile workspace navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#202329] bg-[#0A0B0D]/98 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="grid grid-cols-5">
          {NAV_ITEMS.map(({ id, short, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-current={active ? 'page' : undefined}
                className="flex h-[60px] flex-col items-center justify-center gap-1"
              >
                <span
                  className={`flex h-7 w-11 items-center justify-center rounded-lg transition-colors ${
                    active ? 'bg-[#4C8DFF]/12 text-[#6BA2FF]' : 'text-[#6B7079]'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className={`text-[10px] font-medium ${active ? 'text-[#ECEDEF]' : 'text-[#6B7079]'}`}>
                  {short}
                </span>
              </button>
            );
          })}
        </div>
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
