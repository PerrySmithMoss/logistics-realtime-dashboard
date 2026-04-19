export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const exponentialBackoff = (delay: number, attempt: number, maxJitter = 100) => {
  const baseDelay = delay * Math.pow(2, attempt);
  const jitter = Math.random() * maxJitter;
  return new Promise((r) => setTimeout(r, baseDelay + jitter));
};
