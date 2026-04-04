export interface ThrottledFn<TArgs extends unknown[]> {
  (...args: TArgs): void;
  cancel: () => void;
}

export const throttle = <TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  limitMs: number,
): ThrottledFn<TArgs> => {
  let trailingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastCalledAt: number | null = null;

  const throttled = (...args: TArgs): void => {
    const now = Date.now();

    if (lastCalledAt === null) {
      // fire first call immediately
      fn(...args);
      lastCalledAt = now;
      return;
    }

    // clear any trailing calls, will be rescheduled with latest args
    if (trailingTimeoutId !== null) clearTimeout(trailingTimeoutId);

    const remaining = limitMs - (now - lastCalledAt);

    trailingTimeoutId = setTimeout(() => {
      fn(...args);
      lastCalledAt = Date.now();
      trailingTimeoutId = null;
    }, remaining);
  };

  throttled.cancel = (): void => {
    if (trailingTimeoutId !== null) {
      clearTimeout(trailingTimeoutId);
      trailingTimeoutId = null;
    }
    lastCalledAt = null;
  };

  return throttled;
};
