/**
 * Sliding-window rate limiter (03 §1). In-memory per-instance for Phase 0–8;
 * the Redis adapter behind this interface is the production swap (same contract).
 */

interface WindowState {
  timestamps: number[];
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export class SlidingWindowLimiter {
  private readonly windows = new Map<string, WindowState>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now = Date.now()): RateLimitResult {
    const state = this.windows.get(key) ?? { timestamps: [] };
    state.timestamps = state.timestamps.filter((t) => now - t < this.windowMs);

    if (state.timestamps.length >= this.maxRequests) {
      const oldest = state.timestamps[0]!;
      this.windows.set(key, state);
      return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((this.windowMs - (now - oldest)) / 1000) };
    }
    state.timestamps.push(now);
    this.windows.set(key, state);
    return { allowed: true, remaining: this.maxRequests - state.timestamps.length, retryAfterSec: 0 };
  }

  reset(key: string): void {
    this.windows.delete(key);
  }
}
