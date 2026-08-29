/** Brute-force lockout: 5 failed attempts per user per 10-minute window (03 §5). */

const MAX_FAILURES = 5;
const WINDOW_MS = 10 * 60_000;

interface FailureRecord {
  timestamps: number[];
}

export class LoginLockout {
  private readonly failures = new Map<string, FailureRecord>();

  isLocked(userKey: string, now = Date.now()): boolean {
    const record = this.failures.get(userKey);
    if (!record) return false;
    record.timestamps = record.timestamps.filter((t) => now - t < WINDOW_MS);
    if (record.timestamps.length === 0) {
      this.failures.delete(userKey);
      return false;
    }
    return record.timestamps.length >= MAX_FAILURES;
  }

  recordFailure(userKey: string, now = Date.now()): void {
    const record = this.failures.get(userKey) ?? { timestamps: [] };
    record.timestamps.push(now);
    this.failures.set(userKey, record);
  }

  clear(userKey: string): void {
    this.failures.delete(userKey);
  }
}
