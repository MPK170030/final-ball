export interface CacheAdapter {
  get(key: string): Promise<{ payload: unknown; fetchedAt: number } | null>
  set(key: string, payload: unknown): Promise<void>
}

// In-memory adapter — lives for the process lifetime.
// TTL enforcement is the caller's responsibility (see FplClient.fetchCached).
export class MemoryCacheAdapter implements CacheAdapter {
  private store = new Map<string, { payload: unknown; fetchedAt: number }>()

  async get(key: string) {
    return this.store.get(key) ?? null
  }

  async set(key: string, payload: unknown) {
    this.store.set(key, { payload, fetchedAt: Date.now() })
  }

  invalidate(key: string) {
    this.store.delete(key)
  }

  clear() {
    this.store.clear()
  }
}
