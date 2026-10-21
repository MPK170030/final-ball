import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@finalball/db'

// Cast away @supabase/ssr v0.5 / supabase-js v2.118 generic-param-order mismatch.
// The SSR wrapper returns SupabaseClient<DB, SchemaName, Schema> (3-arg old API) but
// v2.118 added a 5-param signature where the 3rd slot is SchemaName (not Schema), so
// the schema object lands in the wrong position and table queries infer as never.
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component; cookies can't be set.
            // Middleware handles session refresh.
          }
        },
      },
    },
  ) as unknown as SupabaseClient<Database>
}
