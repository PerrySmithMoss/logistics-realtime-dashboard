"use client";

import { createLogger } from "@/shared/infrastructure";
import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

const logger = createLogger("FleetMap:ErrorBoundary");

export class FleetMapErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (error.message.includes("Loading chunk") || error.message.includes("CSS chunk")) {
      logger.warn("Chunk load failure detected. Refreshing assets...");

      // force a refresh to get new JS assets if error is related to JS chunk.
      window.location.reload();
      return;
    }

    logger.error("Map Engine Crash", {
      message: error.message,
      componentStack: errorInfo.componentStack,
      error,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-slate-100 rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
          <h3 className="text-sm font-bold text-slate-800">Map rendering failed</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-50">
            There was a problem initialising the map.
          </p>
          <div className="flex gap-4 mt-6">
            <button
              onClick={this.handleReset}
              className="text-xs font-semibold px-4 py-2 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="text-xs font-semibold px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
