"use client";

import { getFriendlyErrorMessage } from "@/shared/errors";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const message = getFriendlyErrorMessage(error);

  return (
    <main className="h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-bold text-slate-800">{message}</h1>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
      >
        Try again
      </button>
    </main>
  );
}
