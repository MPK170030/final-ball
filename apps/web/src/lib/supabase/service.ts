import { createClient } from '@supabase/supabase-js'
import type { Database } from '@finalball/db'

/** Service-role client for server-only writes (briefs, cards, generation_usage). */
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
