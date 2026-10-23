import { FplClient } from './fpl/client.js'
import { MemoryCacheAdapter } from './fpl/cache.js'
import { loadContext } from './context.js'
import { scorePlayer } from './analysis/score.js'
import { findWeakSpots } from './analysis/weakspot.js'
import { buildTransferPlan } from './analysis/candidates.js'
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

// ── Weak spots ──────────────────────────────────────────────────────────────
const weakspots = findWeakSpots(squadPlayers, picks.picks, allFixtures, bootstrap, freeTransfers)

const POS_FULL: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

console.log(`\n── Weak spots (${freeTransfers} free transfer${freeTransfers > 1 ? 's' : ''}) ──`)

console.log(`\nSell candidate${weakspots.sellCandidates.length > 1 ? 's' : ''}:`)
for (const { player, score, squadRank } of weakspots.sellCandidates) {
  const pos = POS_FULL[player.element_type]
  const price = `£${(player.now_cost / 10).toFixed(1)}m`
  const bench = squadPlayers.indexOf(player) >= 11 ? ' [bench]' : ''
  console.log(`  → ${player.web_name} (${pos}, ${price}${bench}) — 3-GW score ${score.total.toFixed(1)}, squad rank ${squadRank}/15`)
}

console.log(`\nWhy sell? context (D8.6) — 3 weakest in squad:`)
for (const { player, score, squadRank } of weakspots.whySellContext) {
  const pos = POS_FULL[player.element_type]
  const isSell = weakspots.sellCandidates.some(s => s.player.id === player.id)
  const marker = isSell ? ' ← SELL' : ''
  const bench = squadPlayers.indexOf(player) >= 11 ? ' [bench]' : ''
  const gwBreakdown = score.perGw
    .map(g => (g.fdr === null ? 'BLK' : g.points.toFixed(1)))
    .join(' / ')
  console.log(`  ${squadRank}. ${player.web_name} (${pos}${bench}) — ${score.total.toFixed(1)} pts  [${gwBreakdown}]${marker}`)
}

console.log(`\nLoaded, scored, and ranked in ${elapsed}s`)

// ── Phase 4+5+6: Candidates, constraints, transfer plan ─────────────────────
const plan = buildTransferPlan(weakspots, ctx)

console.log(`\n── Transfer Plan ──`)

if (plan.save) {
  console.log(`\n  ✓ SAVE your transfer — ${plan.saveReason}`)
} else {
  for (const [ti, opt] of plan.transfers.entries()) {
    const spStr = (opt.sellingPrice / 10).toFixed(1)
    const posStr = POS_FULL[opt.sell.player.element_type]
    console.log(`\n  T${ti + 1}: Sell ${opt.sell.player.web_name} (${posStr}, selling at £${spStr}m)`)

    const tp = opt.topPick
    const budget = (opt.sellingPrice + ctx.bank) / 10
    console.log(
      `      Top pick:   ${tp.player.web_name.padEnd(18)} £${(tp.player.now_cost / 10).toFixed(1)}m  ` +
        `3GW: ${tp.score.total.toFixed(1)} pts  val: ${tp.valueScore.toFixed(2)} pts/£m` +
        `  [budget £${budget.toFixed(1)}m]`,
    )

    if (opt.alternatives.length > 0) {
      console.log(`      Alternatives:`)
      for (const alt of opt.alternatives) {
        console.log(
          `        ${alt.player.web_name.padEnd(18)} £${(alt.player.now_cost / 10).toFixed(1)}m  ` +
            `3GW: ${alt.score.total.toFixed(1)} pts  val: ${alt.valueScore.toFixed(2)} pts/£m`,
        )
      }
    }

    if (opt.replans.length > 0) {
      console.log(`      [replans: ${opt.replans.join('; ')}]`)
    }
  }
}

console.log(`\n── Agent trace (Phase 4+5) ──`)
for (const line of plan.trace) {
  console.log(`  ${line}`)
}
