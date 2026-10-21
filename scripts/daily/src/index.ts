/**
 * Daily data-refresh job (D11.7, D16.4).
 * Runs via GitHub Actions every day to:
 *   1. Cache FPL bootstrap-static (prices, injuries, squad availability)
 *   2. Cache fixtures for the current and next gameweek
 *
 * This keeps Supabase active during international breaks and feeds
 * the Wednesday team-linking lookup with fresh standings.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm --filter @finalball/script-daily start
 */

import { FplClient } from '@finalball/agent'
import { createClient } from '@finalball/db'

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const fpl = new FplClient({ maxConcurrent: 3, retries: 3 })
const db = createClient(supabaseUrl, supabaseKey)

async function upsertCache(key: string, payload: unknown) {
  const { error } = await db
    .from('fpl_cache')
    .upsert({ key, payload, fetched_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(`Cache write failed for "${key}": ${error.message}`)
}

async function main() {
  console.log(`[daily] Starting — ${new Date().toISOString()}`)

  // 1. Bootstrap (players, clubs, gameweeks, prices)
  console.log('[daily] Fetching bootstrap-static…')
  const bootstrap = await fpl.getBootstrap()
  await upsertCache('bootstrap', bootstrap)
  console.log(
    `[daily] Bootstrap cached — ${bootstrap.elements.length} players, ${bootstrap.total_players.toLocaleString()} managers`,
  )

  // 2. Current gameweek fixtures
  const currentGw = bootstrap.events.find((e) => e.is_current)
  const nextGw = bootstrap.events.find((e) => e.is_next)

  if (currentGw) {
    console.log(`[daily] Fetching GW${currentGw.id} fixtures…`)
    const fixtures = await fpl.getFixtures(currentGw.id)
    await upsertCache(`fixtures_gw${currentGw.id}`, fixtures)
    console.log(`[daily] GW${currentGw.id} fixtures cached (${fixtures.length} matches)`)
  }

  if (nextGw) {
    console.log(`[daily] Fetching GW${nextGw.id} fixtures…`)
    const fixtures = await fpl.getFixtures(nextGw.id)
    await upsertCache(`fixtures_gw${nextGw.id}`, fixtures)
    console.log(`[daily] GW${nextGw.id} fixtures cached (${fixtures.length} matches)`)
  }

  console.log('[daily] Done.')
}

main().catch((err) => {
  console.error('[daily] Error:', err)
  process.exit(1)
})
