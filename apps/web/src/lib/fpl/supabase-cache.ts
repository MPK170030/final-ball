import type { CacheAdapter } from '@finalball/agent'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@finalball/db'

/**
 * Persists FPL API responses in the fpl_cache table so warm data survives
 * process restarts (Vercel cold starts, GH Actions fresh containers).
 * TTL enforcement stays with FplClient — this adapter just reads/writes rows.
 */
export class SupabaseCacheAdapter implements CacheAdapter {
  constructor(private client: SupabaseClient<Database>) {}

  async get(key: string) {
    const { data } = await this.client
      .from('fpl_cache')
      .select('payload, fetched_at')
      .eq('key', key)
      .single()
    if (!data) return null
    return {
      payload: data.payload,
      fetchedAt: new Date(data.fetched_at).getTime(),
    }
  }

  async set(key: string, payload: unknown) {
    await this.client
      .from('fpl_cache')
      .upsert({ key, payload, fetched_at: new Date().toISOString() })
  }
}
