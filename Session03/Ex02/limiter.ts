interface WindowCounter {
  prev: number;
  curr: number;
  lastWindowStart: number;
}

export class SlidingWindowLimiter {
  private counters = new Map<string, WindowCounter>();
  private readonly windowMs = 60_000;
  private readonly limit = 100;

  isAllowed(key: string, now: number): boolean {
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;

    let c = this.counters.get(key);
    if (!c) {
      c = { prev: 0, curr: 0, lastWindowStart: windowStart };
      this.counters.set(key, c);
    }

    const elapsedWindows = Math.floor(
      (windowStart - c.lastWindowStart) / this.windowMs,
    );
    if (elapsedWindows === 1) {
      c.prev = c.curr;
      c.curr = 0;
      c.lastWindowStart = windowStart;
    } else if (elapsedWindows > 1) {
      c.prev = 0;
      c.curr = 0;
      c.lastWindowStart = windowStart;
    }

    const timeInCurrentWindow = now - windowStart;
    const prevWeight = (this.windowMs - timeInCurrentWindow) / this.windowMs;

    const estimatedCount = c.prev * prevWeight + c.curr;

    if (estimatedCount >= this.limit) {
      return false;
    }

    c.curr++;
    return true;
  }
}
