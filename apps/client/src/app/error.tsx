"use client";

import { clientEnv } from "@/config/client-env";
import { getFriendlyErrorMessage } from "@/shared/errors";
import { createLogger } from "@/shared/infrastructure";
import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const logger = createLogger("ErrorBoundary");
const isDev = clientEnv.NEXT_PUBLIC_NODE_ENV === "development";

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const message = getFriendlyErrorMessage(error);

  useEffect(() => {
    if (isDev) {
      logger.error("Application crashed inside boundary", {
        message: error.message,
        digest: error.digest,
        stack: error.stack,
      });
    }
  }, [error]);

  return (
    <main className="h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-bold text-white">{isDev ? error.message : message}</h1>
      {error.digest && <p className="text-xs text-white font-mono">ID: {error.digest}</p>}
      <button
        onClick={reset}
        className="px-4 cursor-pointer py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
      >
        Try again
      </button>
    </main>
  );
}
