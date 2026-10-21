/**
 * Discovers FPL country-league IDs by sampling entries from the overall
 * standings table. Each entry profile lists the manager's region name and
 * their classic leagues, one of which is their country league (D9.3f).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm --filter @finalball/script-country-leagues start
 *
 * Writes results to the country_leagues table (season = CURRENT_SEASON).
 * Safe to re-run: uses upsert, so existing rows are updated.
 */

import { FplClient } from '@finalball/agent'
import { createClient } from '@finalball/db'

const CURRENT_SEASON = 2026
const OVERALL_LEAGUE_ID = 314 // FPL "Overall" classic league (all managers)
const SAMPLE_COUNT = 500 // entries to inspect; covers ~150–200 countries
const BATCH_SIZE = 3 // concurrent FPL requests (polite throttle)
const BATCH_DELAY_MS = 300 // pause between batches

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const fpl = new FplClient({ maxConcurrent: BATCH_SIZE, retries: 3 })
const db = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('Fetching FPL bootstrap…')
  const bootstrap = await fpl.getBootstrap()
  const totalPlayers = bootstrap.total_players
  const currentGameweek = bootstrap.events.find((e) => e.is_current)?.id ?? 1
  console.log(`Total players: ${totalPlayers.toLocaleString()}, GW${currentGameweek}`)

  // Sample entry IDs spread evenly across the overall standings.
  // Standings pages have 50 entries each; we pick pages spread across the range.
  const totalPages = Math.ceil(totalPlayers / 50)
  const pageStep = Math.max(1, Math.floor(totalPages / SAMPLE_COUNT))
  const pagesToFetch = Array.from({ length: Math.ceil(SAMPLE_COUNT / 1) }, (_, i) =>
    Math.min(1 + i * pageStep, totalPages),
  ).filter((p, i, arr) => arr.indexOf(p) === i) // dedupe

  console.log(`Sampling ${pagesToFetch.length} standings pages…`)

  // Collect entry IDs
  const entryIds: number[] = []
  for (let i = 0; i < pagesToFetch.length; i += BATCH_SIZE) {
    const batch = pagesToFetch.slice(i, i + BATCH_SIZE)
    const pages = await Promise.allSettled(
      batch.map((p) => fpl.getLeagueStandings(OVERALL_LEAGUE_ID, p)),
    )
    for (const result of pages) {
      if (result.status === 'fulfilled') {
        for (const entry of result.value.standings.results) {
          entryIds.push(entry.entry)
        }
      }
    }
    if (i + BATCH_SIZE < pagesToFetch.length) await sleep(BATCH_DELAY_MS)
  }

  console.log(`Collected ${entryIds.length} entry IDs. Fetching entry details…`)

  // For each entry, find the country league
  const countryMap = new Map<string, number>() // region_name → league_id

  for (let i = 0; i < entryIds.length; i += BATCH_SIZE) {
    const batch = entryIds.slice(i, i + BATCH_SIZE)
    const entries = await Promise.allSettled(batch.map((id) => fpl.getEntry(id)))

    for (const result of entries) {
      if (result.status !== 'fulfilled') continue
      const entry = result.value
      const region = entry.player_region_name
      if (!region || countryMap.has(region)) continue

      // Find the country league: a classic system league whose name matches
      // the player's region, or any system league that isn't "Overall".
      const countryLeague = entry.leagues.classic.find(
        (l) =>
          l.league_type === 's' &&
          l.id !== OVERALL_LEAGUE_ID &&
          (l.name === region || l.name.toLowerCase() === region.toLowerCase()),
      )

      if (countryLeague) {
        countryMap.set(region, countryLeague.id)
        console.log(`  ${region} → ${countryLeague.id} (${countryLeague.name})`)
      }
    }

    process.stdout.write(
      `\r  Progress: ${Math.min(i + BATCH_SIZE, entryIds.length)} / ${entryIds.length} entries checked, ${countryMap.size} countries found`,
    )

    if (i + BATCH_SIZE < entryIds.length) await sleep(BATCH_DELAY_MS)
  }

  console.log(`\n\nFound ${countryMap.size} countries.`)

  if (countryMap.size === 0) {
    console.error('No country leagues found — check OVERALL_LEAGUE_ID or FPL API response shape.')
    process.exit(1)
  }

  // Upsert into Supabase
  console.log('Writing to Supabase…')
  const rows = Array.from(countryMap.entries()).map(([country, league_id]) => ({
    season: CURRENT_SEASON,
    country,
    league_id,
  }))

  const { error } = await db.from('country_leagues').upsert(rows, { onConflict: 'season,country' })

  if (error) {
    console.error('Supabase upsert failed:', error.message)
    process.exit(1)
  }

  console.log(`Done. ${rows.length} rows written to country_leagues.`)

  // Print a sample for verification
  console.log('\nSample (first 10):')
  for (const [country, id] of Array.from(countryMap.entries()).slice(0, 10)) {
    console.log(`  ${country.padEnd(30)} ${id}`)
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
