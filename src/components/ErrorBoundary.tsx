/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  name?: string;
  fallback?: React.ReactNode | ((props: { error: Error; reset: () => void }) => React.ReactNode);
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary: ${this.props.name || 'Root'}] caught an error:`, error, errorInfo);
  }

  handleReset = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback({
          error: this.state.error,
          reset: this.handleReset,
        });
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isRouteLevel = Boolean(this.props.name && this.props.name !== 'Root');

      return (
        <div
          role="alert"
          aria-live="assertive"
          className={`flex items-center justify-center p-4 md:p-8 ${
            isRouteLevel ? 'h-full w-full bg-[#090C11]' : 'min-h-[100dvh] w-full bg-[#090C11]'
          }`}
        >
          <div className="max-w-md w-full bg-[#10151E] border border-rose-500/30 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white truncate">
                  {this.props.name ? `${this.props.name} Error` : 'Workspace Recovery'}
                </h2>
                <p className="text-xs text-slate-400">
                  {isRouteLevel
                    ? 'This workspace encountered an issue, but other tools are active.'
                    : 'The application encountered an unexpected runtime issue.'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#090C11] border border-[#1E2736] font-mono text-xs text-rose-300 break-words max-h-36 overflow-y-auto">
              {this.state.error.message || 'Unknown runtime error'}
            </div>

            <details className="text-[11px] text-slate-500 font-mono">
              <summary className="cursor-pointer hover:text-slate-300 transition-colors select-none">
                View Stack Trace
              </summary>
              <pre className="mt-2 p-2 rounded bg-[#090C11] border border-[#1E2736] overflow-x-auto whitespace-pre-wrap text-[10px] text-slate-400 max-h-32">
                {this.state.error.stack || 'No stack trace available'}
              </pre>
            </details>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Workspace
              </button>
              {isRouteLevel && (
                <button
                  type="button"
                  onClick={() => {
                    this.handleReset();
                    window.location.hash = '#calc';
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-[#162030] hover:bg-[#1E2B40] text-slate-300 hover:text-white border border-[#212E42] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Return to Calc
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
