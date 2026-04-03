"use client";

import { clientEnv } from "@/config/client-env";
import { getFriendlyErrorMessage } from "@/shared/errors";
import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const isDev = clientEnv.NEXT_PUBLIC_NODE_ENV === "development";

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const message = getFriendlyErrorMessage(error);

  useEffect(() => {
    // Ideally we would be logging this to external logger (Sentry/Rollbar).
    // Here we just log in development to prevent leaking anything.
    if (isDev) {
      console.error("Boundary Error:", error);
    }
  }, [error]);

  return (
    <main className="h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-bold text-white">
        {isDev ? error.message : message}
      </h1>
      <button
        onClick={reset}
        className="px-4 cursor-pointer py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
      >
        Try again
      </button>
    </main>
  );
}
