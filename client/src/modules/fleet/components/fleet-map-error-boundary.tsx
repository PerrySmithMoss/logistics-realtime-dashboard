"use client";

import { clientEnv } from "@/config/client-env";
import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

const isDev = clientEnv.NEXT_PUBLIC_NODE_ENV === "development";
export class FleetMapErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (error.message.includes("Loading chunk")) {
      // force a refresh to get new JS assets if error is related to JS chunk.
      window.location.reload();
      return;
    }

    // Ideally we would be logging this to external logger (Sentry/Rollbar).
    // Here we just log in development to prevent leaking anything.
    if (isDev) {
      console.error("Map Engine Crash:", error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-slate-100 rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
          <div className="bg-white p-4 rounded-full shadow-sm mb-4">🗺️</div>
          <h3 className="text-sm font-bold text-slate-800">
            Map rendering failed
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-50">
            There was a problem initialising the map.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-700"
          >
            Try reloading map
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
