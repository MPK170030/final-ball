import { createClient as _createClient } from '@supabase/supabase-js'
import type { Database } from './types.js'

export function createClient(url: string, key: string) {
  return _createClient<Database>(url, key)
}

export type SupabaseClient = ReturnType<typeof createClient>
