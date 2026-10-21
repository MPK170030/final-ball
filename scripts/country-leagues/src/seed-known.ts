/**
 * Seeds the country_leagues table with the 131 countries discovered by the
 * sampling run, then probes tie-group sizes for the big leagues.
 *
 * Run when the full sampling script (index.ts) was interrupted before upsert.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm --filter @finalball/script-country-leagues seed
 */

import { FplClient } from '@finalball/agent'
import { createClient } from '@finalball/db'

const CURRENT_SEASON = 2026

// Country → FPL classic league ID (discovered 2026-10-20, GW7, ~3,144 sample entries)
const KNOWN_COUNTRIES: [string, number][] = [
  ['India', 120],
  ['Norway', 181],
  ['England', 261],
  ['Croatia', 117],
  ['Ghana', 101],
  ['Finland', 92],
  ['Australia', 33],
  ['Saudi Arabia', 208],
  ['Wales', 264],
  ['Belgium', 41],
  ['Nigeria', 177],
  ['Singapore', 213],
  ['Algeria', 23],
  ['Ireland', 124],
  ['Denmark', 78],
  ['USA', 249],
  ['United Arab Emirates', 246],
  ['South Africa', 218],
  ['Egypt', 83],
  ['Tunisia', 238],
  ['Hungary', 118],
  ['Bahrain', 37],
  ['Maldives', 151],
  ['Trinidad and Tobago', 237],
  ['Uganda', 244],
  ['Sweden', 226],
  ['Iraq', 123],
  ['Serbia', 210],
  ['Kuwait', 135],
  ['Kenya', 131],
  ['Tanzania', 231],
  ['Thailand', 232],
  ['Malaysia', 150],
  ['Aland Islands', 265],
  ['Bhutan', 45],
  ['Bosnia-Herzegovina', 47],
  ['Germany', 100],
  ['Northern Ireland', 262],
  ['Scotland', 263],
  ['Bangladesh', 38],
  ['Canada', 59],
  ['Cyprus', 76],
  ['Portugal', 193],
  ['Jamaica', 127],
  ['Switzerland', 227],
  ['Japan', 128],
  ['Greece', 103],
  ['Colombia', 68],
  ['Somalia', 217],
  ['Morocco', 165],
  ['Poland', 192],
  ['Oman', 182],
  ['New Zealand', 174],
  ['Nepal', 170],
  ['United Kingdom', 247],
  ['South Korea', 134],
  ['Slovenia', 215],
  ['Qatar', 195],
  ['Libya', 142],
  ['Jordan', 129],
  ['Bulgaria', 54],
  ['Israel', 125],
  ['Sudan', 222],
  ['Czech Republic', 77],
  ['Hong Kong, China', 116],
  ['Namibia', 168],
  ['Vietnam', 254],
  ['Yemen', 257],
  ['Zimbabwe', 259],
  ['Zambia', 258],
  ['Albania', 22],
  ['Lebanon', 139],
  ['Romania', 197],
  ['Estonia', 87],
  ['Botswana', 48],
  ['Indonesia', 121],
  ['Ethiopia', 88],
  ['Turkey', 239],
  ['Norfolk Island', 179],
  ['France', 93],
  ['US Virgin Islands', 243],
  ['Montenegro', 260],
  ['Netherlands', 172],
  ['Lithuania', 144],
  ['Iceland', 119],
  ['Spain', 220],
  ['Italy', 126],
  ['Turkmenistan', 240],
  ['China', 65],
  ['Malawi', 149],
  ['Ukraine', 245],
  ['Peru', 189],
  ['Antarctica', 28],
  ['Argentina', 30],
  ['Iran', 122],
  ['Kazakhstan', 130],
  ['Slovakia', 214],
  ['Mauritania', 156],
  ['Sri Lanka', 221],
  ['American Samoa', 24],
  ['Ecuador', 82],
  ['Sierra Leone', 212],
  ['Faeroe Islands', 89],
  ['Pitcairn Island', 191],
  ['Palestine', 185],
  ['Cameroon', 58],
  ['Senegal', 209],
  ['Pakistan', 183],
  ['Martinique', 155],
  ['Mongolia', 163],
  ['Austria', 34],
  ['Tuvalu', 242],
  ['Brazil', 50],
  ['Mauritius', 157],
  ['Gibraltar', 102],
  ['Chile', 64],
  ['Syria', 228],
  ['Rwanda', 199],
  ['Panama', 186],
  ['Guernsey', 267],
  ['Eswatini', 225],
  ['Armenia', 31],
  ['Mozambique', 166],
  ['Haiti', 112],
  ['Macedonia', 147],
  ['Latvia', 138],
  ['Seychelles', 211],
  ['Philippines', 190],
  ['Brunei Darussalam', 53],
  ['Moldova', 161],
  ['Malta', 153],
  ['Luxembourg', 145],
]

const BATCH_DELAY_MS = 400

// Probe targets: country name (as stored in countryMap) → league id
const PROBE_TARGETS: [string, number][] = [
  ['England', 261],
  ['India', 120],
  ['USA', 249],
  ['Pakistan', 183],
  ['Nigeria', 177],
  ['Bangladesh', 38],
]
const PROBE_PAGES = [1, 100, 1000]

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const fpl = new FplClient({ maxConcurrent: 3, retries: 3 })
const db = createClient(supabaseUrl, supabaseKey)

async function main() {
  // Upsert known countries
  console.log(`Upserting ${KNOWN_COUNTRIES.length} known country → league mappings…`)
  const rows = KNOWN_COUNTRIES.map(([country, league_id]) => ({
    season: CURRENT_SEASON,
    country,
    league_id,
  }))

  const { error } = await db.from('country_leagues').upsert(rows, { onConflict: 'season,country' })
  if (error) {
    console.error('Supabase upsert failed:', error.message)
    process.exit(1)
  }
  console.log(`Done. ${rows.length} rows written.\n`)

  // Tie-group probe
  console.log('--- Tie-group probe ---')
  console.log('(max entries sharing the same rank on a given page)\n')

  for (const [country, leagueId] of PROBE_TARGETS) {
    const rowData: string[] = []
    for (const page of PROBE_PAGES) {
      try {
        const s = await fpl.getLeagueStandings(leagueId, page)
        if (!s.standings.results.length) {
          rowData.push(`p${page}:no entries`)
          break
        }
        const groups = new Map<number, number>()
        for (const r of s.standings.results) {
          groups.set(r.rank, (groups.get(r.rank) ?? 0) + 1)
        }
        const maxTie = Math.max(...groups.values())
        const firstRank = s.standings.results[0]?.rank ?? '?'
        const lastRank = s.standings.results[s.standings.results.length - 1]?.rank ?? '?'
        rowData.push(`p${page}(r${firstRank}-${lastRank}):maxTie=${maxTie}`)
        if (!s.standings.has_next) break
      } catch {
        rowData.push(`p${page}:error`)
      }
      await sleep(BATCH_DELAY_MS)
    }
    console.log(`  ${country.padEnd(15)} ${leagueId}  |  ${rowData.join('  |  ')}`)
  }
  console.log('\nDone.')
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
