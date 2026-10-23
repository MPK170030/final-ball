import { FplClient } from './fpl/client.js'
import { MemoryCacheAdapter } from './fpl/cache.js'
import { loadContext } from './context.js'
import { scorePlayer } from './analysis/score.js'
import { findWeakSpots } from './analysis/weakspot.js'
import { buildTransferPlan } from './analysis/candidates.js'
import { rankWithModel } from './analysis/rank.js'
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

// ── Phase 4+5: Candidates and constraints ────────────────────────────────────
const plan = buildTransferPlan(weakspots, ctx)

// ── Phase 6: Model ranking ────────────────────────────────────────────────────
console.log(`\nRanking with model…`)
const ranked = await rankWithModel(plan, ctx)

console.log(`\n── Transfer Plan ──`)

if (ranked.save) {
  console.log(`\n  ✓ SAVE your transfer`)
  if (ranked.saveReason) console.log(`     Reason: ${ranked.saveReason}`)
  if (ranked.bestOptionForComparison) {
    const boc = ranked.bestOptionForComparison
    console.log(`     Best option if you want to move: ${boc.player.web_name} — ${boc.reason}`)
  }
} else {
  for (const [ti, card] of ranked.transfers.entries()) {
    const spStr = (card.sellingPrice / 10).toFixed(1)
    const posStr = POS_FULL[card.sell.player.element_type]
    console.log(`\n  T${ti + 1}: Sell ${card.sell.player.web_name} (${posStr}, selling at £${spStr}m)`)
    if (card.whySell) console.log(`       Why sell: ${card.whySell}`)
    if (card.swapReason) console.log(`       Case:     ${card.swapReason}`)

    const tp = card.topPick
    const budget = (card.sellingPrice + ctx.bank) / 10
    console.log(
      `\n      Top pick:   ${tp.player.web_name.padEnd(18)} £${(tp.player.now_cost / 10).toFixed(1)}m  ` +
        `3GW: ${tp.score.total.toFixed(1)} pts  val: ${tp.valueScore.toFixed(2)} pts/£m` +
        `  [budget £${budget.toFixed(1)}m]`,
    )
    if (card.topPickReason) console.log(`                  ${card.topPickReason}`)

    const why = card.topPickWhy
    if (why.form || why.fixtures || why.price || why.risks) {
      console.log(`        Form:     ${why.form}`)
      console.log(`        Fixtures: ${why.fixtures}`)
      console.log(`        Price:    ${why.price}`)
      console.log(`        Risks:    ${why.risks}`)
    }

    if (card.alternatives.length > 0) {
      console.log(`\n      Alternatives:`)
      for (const alt of card.alternatives) {
        const p = alt.candidate.player
        console.log(
          `        ${p.web_name.padEnd(18)} £${(p.now_cost / 10).toFixed(1)}m  ` +
            `3GW: ${alt.candidate.score.total.toFixed(1)} pts  val: ${alt.candidate.valueScore.toFixed(2)} pts/£m`,
        )
        if (alt.reason) console.log(`          ${alt.reason}`)
      }
    }

    if (card.replans.length > 0) {
      console.log(`      [replans: ${card.replans.join('; ')}]`)
    }
  }
}

console.log(`\n── Agent trace ──`)
for (const line of ranked.trace) {
  console.log(`  ${line}`)
}

console.log(`\n── Token usage ──`)
console.log(`  Input: ${ranked.usage.inputTokens} | Output: ${ranked.usage.outputTokens} | Total: ${ranked.usage.inputTokens + ranked.usage.outputTokens}`)
