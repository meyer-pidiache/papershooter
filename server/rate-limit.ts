interface Entry { start: number; count: number }

/** Fixed-window limiter with bounded memory. Deploy an edge limit for multiple instances. */
export class RateLimiter {
  private readonly entries = new Map<string, Entry>();
  constructor(
    private readonly limit = 30,
    private readonly windowMs = 60000,
    private readonly maxEntries = 5000,
    private readonly now: () => number = Date.now,
  ) {}

  get size(): number { return this.entries.size; }

  allow(key: string): boolean {
    const now = this.now();
    let entry = this.entries.get(key);
    if (entry && now - entry.start >= this.windowMs) {
      this.entries.delete(key);
      entry = undefined;
    }
    if (!entry) {
      if (this.entries.size >= this.maxEntries) {
        for (const [ip, value] of this.entries) if (now - value.start >= this.windowMs) this.entries.delete(ip);
      }
      if (this.entries.size >= this.maxEntries) return false;
      entry = { start: now, count: 0 };
      this.entries.set(key, entry);
    }
    return ++entry.count <= this.limit;
  }
}
