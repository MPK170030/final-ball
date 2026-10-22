/**
 * Offline lookup test — runs the rank-search algorithm directly against FPL.
 * No auth, no Supabase. Mirrors the logic in apps/web/src/app/api/team/lookup/route.ts.
 *
 * Usage: pnpm tsx scripts/test-lookup.ts
 */

import { FplClient, MemoryCacheAdapter } from '../packages/agent/src/index'
import { fuzzyMatchTeamName } from '../apps/web/src/lib/team/fuzzy'
import { pageForRank } from '../apps/web/src/lib/team/page-for-rank'

const TEST_CASES = [
  { who: 'Manav', country: 'USA', leagueId: 249, rank: 130_322, teamName: 'Kobbie and Paste' },
]

const MAX_PAGES = 10 // safety cap for the test
const TIMEOUT_MS = 30_000

async function runCase(
  client: FplClient,
  who: string,
  leagueId: number,
  rank: number,
  teamName: string,
  country: string,
) {
  const startPage = pageForRank(rank)
  const firstPage = Math.max(1, startPage - 1)
  console.log(`\n[${who}] "${teamName}" | ${country} rank ${rank.toLocaleString()} | start page ${startPage}`)

  const deadline = Date.now() + TIMEOUT_MS
  let pagesScanned = 0
  let found = false
  let foundId: number | null = null
  const t0 = Date.now()

  for (let page = firstPage; page <= firstPage + MAX_PAGES && Date.now() < deadline; page++) {
    let data
    try {
      data = await client.getLeagueStandings(leagueId, page)
    } catch (err) {
      console.error(`  page ${page}: fetch error —`, err)
      break
    }

    pagesScanned++
    const results = data.standings.results

    if (results.length === 0) {
      console.log(`  page ${page}: empty — end of league`)
      break
    }

    for (const entry of results) {
      const diff = entry.rank - rank
      if (diff > 1) {
        // Past rank+1 window
        break
      }
      if (diff >= -1 && fuzzyMatchTeamName(teamName, entry.entry_name)) {
        found = true
        foundId = entry.entry
        console.log(`  page ${page}: FOUND — "${entry.entry_name}" (ID ${entry.entry}, rank ${entry.rank})`)
        break
      }
    }

    if (found) break
    if (!data.standings.has_next) break
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  if (!found) {
    console.log(`  NOT FOUND after ${pagesScanned} page(s), ${elapsed}s`)
  }

  return { found, foundId, pagesScanned, elapsedS: elapsed }
}

async function main() {
  const client = new FplClient({ maxConcurrent: 3, retries: 2, cache: new MemoryCacheAdapter() })

  const results: Array<{
    who: string; country: string; rank: number; teamName: string
    found: boolean; foundId: number | null; pagesScanned: number; elapsedS: string
  }> = []

  for (const tc of TEST_CASES) {
    const r = await runCase(client, tc.who, tc.leagueId, tc.rank, tc.teamName, tc.country)
    results.push({ ...tc, ...r })
  }

  console.log('\n── Results ──────────────────────────────────────────────────────')
  console.log('| Who   | Team name         | Rank    | Found | Pages | Time  |')
  console.log('|-------|-------------------|---------|-------|-------|-------|')
  for (const r of results) {
    const found = r.found ? `yes (${r.foundId})` : 'no'
    console.log(
      `| ${r.who.padEnd(5)} | ${r.teamName.padEnd(17)} | ${String(r.rank).padStart(7)} | ${found.padEnd(13)} | ${String(r.pagesScanned).padStart(5)} | ${r.elapsedS}s  |`
    )
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
