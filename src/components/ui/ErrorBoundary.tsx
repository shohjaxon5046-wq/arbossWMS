import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/50 p-6 text-center dark:border-red-900/40 dark:bg-red-950/20">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {this.props.fallbackTitle || 'Ushbu sahifani yuklashda xatolik yuz berdi'}
          </h3>
          <p className="mt-1.5 max-w-md text-xs text-slate-500 dark:text-slate-400">
            {this.state.error?.message || 'Kutilmagan texnik muammo aniqlandi.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Qayta urinish</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
