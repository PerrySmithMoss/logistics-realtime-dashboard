export const mergeAbortSignals = (signals: AbortSignal[]): AbortSignal => {
  const controller = new AbortController();

  const abort = (signal: AbortSignal) => {
    controller.abort(signal.reason);
    signals.forEach((candidate) => {
      candidate.removeEventListener("abort", onAbort);
    });
  };

  const onAbort = (event: Event) => {
    abort(event.target as AbortSignal);
  };

  for (const signal of signals) {
    if (signal.aborted) {
      abort(signal);
      break;
    }

    signal.addEventListener("abort", onAbort, { once: true });
  }

  return controller.signal;
};
