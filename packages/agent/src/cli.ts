import { FplClient } from './fpl/client.js'
import { MemoryCacheAdapter } from './fpl/cache.js'
import { loadContext } from './context.js'
import { scorePlayer } from './analysis/score.js'
import type { ScoreBreakdown } from './analysis/score.js'
import type { Player } from './fpl/types.js'

const args = process.argv.slice(2)
const teamFlag = args.indexOf('--team')
const teamId = teamFlag !== -1 ? Number(args[teamFlag + 1]) : NaN

if (!teamId || isNaN(teamId)) {
  console.error('Usage: pnpm agent:run -- --team <teamId>')
  process.exit(1)
}

const POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

const client = new FplClient({ cache: new MemoryCacheAdapter() })

console.log(`\nLoading context for team ${teamId}…`)
const t0 = Date.now()

const ctx = await loadContext(teamId, client)
const { gameweek, bank, freeTransfers, squadPlayers, picks, bootstrap, allFixtures } = ctx

// Score all 15
const scored: Array<{ player: Player; score: ScoreBreakdown; position: number }> =
  squadPlayers.map((player, i) => ({
    player,
    score: scorePlayer(player, allFixtures, bootstrap),
    position: i + 1,  // 1–15
  }))

const elapsed = ((Date.now() - t0) / 1000).toFixed(2)

// Header
console.log(`\n── GW${gameweek.id}: ${gameweek.name} ──`)
console.log(`Deadline : ${new Date(gameweek.deadline_time).toUTCString()}`)
console.log(`Bank     : £${(bank / 10).toFixed(1)}m  |  Free transfers: ${freeTransfers}`)

// GW labels from the score breakdown (first player has the GW IDs)
const gwIds = scored[0]?.score.perGw.map(g => `GW${g.gwId}`) ?? ['GW?', 'GW?', 'GW?']
const [gw1Label, gw2Label, gw3Label] = gwIds

// Squad table — sorted by total score ascending (weakest first)
const sorted = [...scored].sort((a, b) => a.score.total - b.score.total)

const header = [
  'Rank',
  'Pos ',
  'Player          ',
  ' £   ',
  'Total',
  gw1Label.padStart(5),
  gw2Label.padStart(5),
  gw3Label.padStart(5),
  'Avail',
  'Bench',
  'Notes',
].join('  ')

console.log(`\nSquad ranked weakest → strongest (3-GW projected pts):`)
console.log(header)
console.log('─'.repeat(header.length))

for (const [rank, { player, score, position }] of sorted.entries()) {
  const pick = picks.picks.find(p => p.element === player.id)!
  const pos = POS[player.element_type] ?? '?'
  const price = `£${(player.now_cost / 10).toFixed(1)}`
  const bench = position > 11 ? '✓' : ''
  const avail = player.chance_of_playing_next_round !== null
    ? `${player.chance_of_playing_next_round}%`
    : '   '
  const badge = pick.is_captain ? '(C)' : pick.is_vice_captain ? '(v)' : ''
  const notes: string[] = []
  if (score.perGw.some(g => g.fdr === null)) notes.push('BLANK')
  if (score.perGw.some(g => g.isDouble)) notes.push('DGW')
  if (player.news) notes.push(`⚠ ${player.news.slice(0, 40)}`)

  const fmtGw = (gw: typeof score.perGw[0]) =>
    gw.fdr === null ? '  BLK' : gw.points.toFixed(1).padStart(5)

  console.log([
    String(rank + 1).padStart(4),
    pos.padEnd(4),
    `${player.web_name}${badge ? ' ' + badge : ''}`.padEnd(18),
    price.padStart(5),
    score.total.toFixed(1).padStart(5),
    fmtGw(score.perGw[0]),
    fmtGw(score.perGw[1]),
    fmtGw(score.perGw[2]),
    avail.padStart(5),
    bench.padStart(5),
    notes.join(' '),
  ].join('  '))
}

console.log(`\nLoaded and scored in ${elapsed}s`)
