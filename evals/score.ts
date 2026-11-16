/**
 * Eval scorer for the Final Ball brief agent.
 *
 * Usage:
 *   tsx --env-file=apps/web/.env.local evals/score.ts --results evals/results/<timestamp>.json
 *
 * Reads the results file, grades each of the 25 questions against the
 * bootstrap-static snapshot, and writes evals/REPORT.md.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scorePlayer } from '../packages/agent/src/analysis/score.js'
import type { Player, Bootstrap, Fixture, EntryPicks } from '../packages/agent/src/fpl/types.js'
import type { EvalRun, QuestionResult, Snapshot, Question, ToolCallRecord } from './run.js'
import { computeCost, MODEL, PRICES } from './pricing.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Grade = 'correct' | 'wrong' | 'needs_review' | 'n/a' | 'error'

export interface GradeResult {
  questionId: string
  category: string
  text: string
  conditionMet: boolean
  grade: Grade
  answer: string
  expected: string
  note: string
}

interface NumberCheck {
  raw: string
  value: number
  grounded: boolean
  context: string
}

export interface GroundingResult {
  questionId: string
  fullyGrounded: boolean
  checks: NumberCheck[]
}

// ── Grounding helpers ─────────────────────────────────────────────────────────

function extractPrices(text: string): Array<{ raw: string; value: number }> {
  const results: Array<{ raw: string; value: number }> = []
  for (const m of text.matchAll(/£(\d+\.?\d*)\s*m/gi)) {
    results.push({ raw: m[0], value: parseFloat(m[1]!) })
  }
  return results
}

function extractPoints(text: string): Array<{ raw: string; value: number }> {
  const results: Array<{ raw: string; value: number }> = []
  // "7.1 pts", "projected 7.1", "7.1-point", "5.2 expected points"
  for (const m of text.matchAll(/(\d+\.\d+)\s*(?:pts?|points?|expected)/gi)) {
    const v = parseFloat(m[1]!)
    // Exclude likely gameweek numbers (> 38), years (> 2020), ordinals already stripped
    if (v < 30) results.push({ raw: m[0], value: v })
  }
  return results
}

function extractForm(text: string): Array<{ raw: string; value: number }> {
  const results: Array<{ raw: string; value: number }> = []
  for (const m of text.matchAll(/form\s+(?:of\s+)?(\d+\.?\d*)/gi)) {
    results.push({ raw: m[0], value: parseFloat(m[1]!) })
  }
  return results
}

function extractAvailability(text: string): Array<{ raw: string; value: number }> {
  const results: Array<{ raw: string; value: number }> = []
  for (const m of text.matchAll(/(\d+)\s*%\s*fit/gi)) {
    results.push({ raw: m[0], value: parseInt(m[1]!) })
  }
  return results
}

// Extract all £X.Xm prices from tool results (as tenths integers).
function toolResultPriceSet(toolCalls: ToolCallRecord[]): Set<number> {
  const prices = new Set<number>()
  for (const tc of toolCalls) {
    for (const m of tc.resultTruncated.matchAll(/£(\d+\.?\d*)\s*m/gi)) {
      prices.add(Math.round(parseFloat(m[1]!) * 10))
    }
  }
  return prices
}

// A price value is grounded if:
//   1. it matches any player price in the snapshot (±0.1m tolerance), OR
//   2. it matches any price that appeared in the tool results for this run, OR
//   3. it equals the absolute difference between any two prices from (1) or (2)
//      (covers computed differentials like "£1.1m more than Schade").
function priceGrounded(value: number, elements: Player[], toolPrices: Set<number>): boolean {
  const tenths = Math.round(value * 10)

  // 1. Direct match in bootstrap
  if (elements.some(p => Math.abs(p.now_cost - tenths) <= 1)) return true

  // 2. Direct match in tool results
  for (const tp of toolPrices) {
    if (Math.abs(tp - tenths) <= 1) return true
  }

  // 3. Absolute difference between any two grounded prices from tool results.
  //    Tool result prices are the agent's actual sources; the set is small (~20-50),
  //    so O(n²) is fine.
  const tpArr = Array.from(toolPrices)
  for (let i = 0; i < tpArr.length; i++) {
    for (let j = i + 1; j < tpArr.length; j++) {
      const diff = Math.abs(tpArr[i]! - tpArr[j]!)
      if (Math.abs(diff - tenths) <= 1) return true
    }
  }

  return false
}

function pointsGrounded(
  value: number,
  elements: Player[],
  fixtures: Fixture[],
  bootstrap: Bootstrap,
  relevantIds: number[],
): boolean {
  // Check against scorePlayer() output for relevant players (buy, sell, captain)
  for (const id of relevantIds) {
    const player = elements.find(p => p.id === id)
    if (!player) continue
    const sc = scorePlayer(player, fixtures, bootstrap)
    if (Math.abs(sc.total - value) < 0.6) return true
    for (const gw of sc.perGw) {
      if (gw.fdr !== null && Math.abs(gw.points - value) < 0.6) return true
    }
    if (Math.abs(sc.epNext - value) < 0.6) return true
  }
  // Broad fallback: ep_next of any player
  return elements.some(p => {
    const ep = p.ep_next !== null ? parseFloat(p.ep_next) : 0
    return Math.abs(ep - value) < 0.3
  })
}

function formGrounded(value: number, elements: Player[]): boolean {
  return elements.some(p => Math.abs(parseFloat(p.form) - value) < 0.05)
}

function availGrounded(value: number, elements: Player[]): boolean {
  return elements.some(
    p => p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round === value,
  )
}

export function checkGrounding(result: QuestionResult, snapshot: Snapshot): GroundingResult {
  const brief = result.brief
  if (!brief) return { questionId: result.questionId, fullyGrounded: true, checks: [] }

  const { elements } = snapshot.bootstrap
  const toolPrices = toolResultPriceSet(result.toolCalls)

  // Collect relevant player IDs for points grounding
  const relevantIds: number[] = []
  for (const t of brief.transfers) {
    relevantIds.push(t.sell.player.id, t.topPick.player.id)
    for (const a of t.alternatives) relevantIds.push(a.candidate.player.id)
  }
  relevantIds.push(brief.captain.captain.player.id, brief.captain.vc.player.id)

  // Collect reasoning text from all free-text fields
  const textParts: string[] = []
  for (const t of brief.transfers) {
    if (t.topPickWhy.form) textParts.push(t.topPickWhy.form)
    if (t.topPickWhy.fixtures) textParts.push(t.topPickWhy.fixtures)
    if (t.topPickWhy.price) textParts.push(t.topPickWhy.price)
    if (t.topPickWhy.risks) textParts.push(t.topPickWhy.risks)
    if (t.topPickReason) textParts.push(t.topPickReason)
    if (t.whySell) textParts.push(t.whySell)
    if (t.swapReason) textParts.push(t.swapReason)
    for (const a of t.alternatives) {
      if (a.reason) textParts.push(a.reason)
    }
  }
  if (brief.captain.captain.reason) textParts.push(brief.captain.captain.reason)
  if (brief.captain.captain.why.form) textParts.push(brief.captain.captain.why.form)
  if (brief.captain.captain.why.fixture) textParts.push(brief.captain.captain.why.fixture)
  if (brief.captain.captain.why.risks) textParts.push(brief.captain.captain.why.risks)
  if (brief.saveReason) textParts.push(brief.saveReason)

  const checks: NumberCheck[] = []

  for (const part of textParts) {
    for (const { raw, value } of extractPrices(part)) {
      checks.push({
        raw,
        value,
        grounded: priceGrounded(value, elements, toolPrices),
        context: part.slice(0, 80),
      })
    }
    for (const { raw, value } of extractPoints(part)) {
      checks.push({
        raw,
        value,
        grounded: pointsGrounded(value, elements, snapshot.fixtures, snapshot.bootstrap, relevantIds),
        context: part.slice(0, 80),
      })
    }
    for (const { raw, value } of extractForm(part)) {
      checks.push({
        raw,
        value,
        grounded: formGrounded(value, elements),
        context: part.slice(0, 80),
      })
    }
    for (const { raw, value } of extractAvailability(part)) {
      checks.push({
        raw,
        value,
        grounded: availGrounded(value, elements),
        context: part.slice(0, 80),
      })
    }
  }

  return {
    questionId: result.questionId,
    fullyGrounded: checks.every(c => c.grounded),
    checks,
  }
}

// ── Scoring helpers ───────────────────────────────────────────────────────────

function percentile(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) return 0
  const idx = Math.ceil((p / 100) * sortedMs.length) - 1
  return sortedMs[Math.max(0, idx)]!
}

// ── Best-legal-transfer helper ────────────────────────────────────────────────

function computeBestLegalTransfer(
  picks: EntryPicks,
  elements: Player[],
  fixtures: Fixture[],
  bootstrap: Bootstrap,
  bank: number,
): number {
  const squadIds = new Set(picks.picks.map(p => p.element))
  const squadByTeam = new Map<number, number>()
  for (const pick of picks.picks) {
    const p = elements.find(e => e.id === pick.element)
    if (p) squadByTeam.set(p.team, (squadByTeam.get(p.team) ?? 0) + 1)
  }

  let best = -Infinity
  for (const pick of picks.picks) {
    const sell = elements.find(e => e.id === pick.element)
    if (!sell) continue
    const sellingPrice = pick.selling_price ?? sell.now_cost
    const budget = sellingPrice + bank
    const sellScore = scorePlayer(sell, fixtures, bootstrap).total

    for (const buy of elements) {
      if (squadIds.has(buy.id)) continue
      if (buy.element_type !== sell.element_type) continue
      if (buy.now_cost > budget) continue
      if (buy.status === 'u' || buy.status === 'n') continue
      const sameSell = sell.team === buy.team ? 1 : 0
      const newCount = (squadByTeam.get(buy.team) ?? 0) - sameSell + 1
      if (newCount > 3) continue
      const improvement = scorePlayer(buy, fixtures, bootstrap).total - sellScore
      if (improvement > best) best = improvement
    }
  }
  return best === -Infinity ? 0 : best
}

// ── Per-question grading ──────────────────────────────────────────────────────

export function grade(result: QuestionResult, snapshot: Snapshot, _questions: Question[]): GradeResult {
  const baseInfo = {
    questionId: result.questionId,
    category: result.category,
    text: result.questionText,
  }

  if (result.error !== null || result.brief === null) {
    return { ...baseInfo, conditionMet: true, grade: 'error', answer: 'error', expected: '', note: result.error ?? 'brief is null' }
  }

  const brief = result.brief
  const { bootstrap, fixtures, picks } = snapshot
  const { elements, teams, events } = bootstrap

  const save = brief.save
  const transfer = brief.transfers[0] ?? null
  const sellId = transfer?.sell.player.id ?? null
  const buyId = transfer?.topPick.player.id ?? null
  const sellPlayer = sellId ? elements.find(p => p.id === sellId) : null
  const buyPlayer = buyId ? elements.find(p => p.id === buyId) : null
  const captainId = brief.captain.captain.player.id
  const vcId = brief.captain.vc.player.id
  const captainPlayer = elements.find(p => p.id === captainId)
  const squadIds = new Set(picks.picks.map(p => p.element))

  // Post-transfer starting XI (all transfers applied)
  const allTransferPairs = brief.transfers.map(t => ({ sell: t.sell.player.id, buy: t.topPick.player.id }))
  const startingXI = new Set(
    picks.picks
      .filter(p => p.position <= 11)
      .map(p => {
        const tr = allTransferPairs.find(t => t.sell === p.element)
        return tr ? tr.buy : p.element
      }),
  )

  // bottom-3 by 3-GW score
  const squadScores = picks.picks.map(p => {
    const pl = elements.find(e => e.id === p.element)
    if (!pl) return { id: p.element, total: 0 }
    return { id: p.element, total: scorePlayer(pl, fixtures, bootstrap).total }
  }).sort((a, b) => a.total - b.total)
  const bottom3Ids = new Set(squadScores.slice(0, 3).map(s => s.id))

  function ok(cond: boolean, answer: string, expected: string, note = ''): GradeResult {
    return { ...baseInfo, conditionMet: true, grade: cond ? 'correct' : 'wrong', answer, expected, note }
  }
  function na(note: string): GradeResult {
    return { ...baseInfo, conditionMet: false, grade: 'n/a', answer: 'n/a', expected: 'n/a', note }
  }
  function nr(answer: string, expected: string, note: string): GradeResult {
    return { ...baseInfo, conditionMet: true, grade: 'needs_review', answer, expected, note }
  }

  switch (result.questionId) {

    // ── Single-fact ───────────────────────────────────────────────────────────

    case 'sq01': {
      if (save) return na('save=true; no sell player')
      if (!sellId) return ok(false, 'no transfer', 'sell id in squad', 'no transfer card despite save=false')
      return ok(squadIds.has(sellId), String(sellId), 'in squad player IDs')
    }

    case 'sq02': {
      if (save) return na('save=true; no buy player')
      if (!buyId) return ok(false, 'no buy player', 'id in bootstrap.elements')
      return ok(elements.some(p => p.id === buyId), String(buyId), 'in bootstrap.elements')
    }

    case 'sq03': {
      if (save) return na('save=true')
      if (!sellPlayer || !buyPlayer) return ok(false, 'missing player', 'element_type match')
      const match = sellPlayer.element_type === buyPlayer.element_type
      return ok(match, `sell=${sellPlayer.element_type} buy=${buyPlayer.element_type}`, 'equal element_type')
    }

    case 'sq04': {
      const name = brief.captain.captain.player.web_name
      const exists = elements.some(p => p.id === captainId)
      return ok(!!name && name.length > 0 && exists, name, 'non-empty, exists in bootstrap')
    }

    case 'sq05': {
      return ok(captainId !== vcId, `C=${captainId} VC=${vcId}`, 'captainId ≠ vcId')
    }

    case 'sq06': {
      if (save) return na('save=true')
      if (!buyPlayer) return ok(false, 'no buy player', 'status ≠ u')
      return ok(buyPlayer.status !== 'u', `status=${buyPlayer.status}`, 'status ≠ u')
    }

    case 'sq07': {
      const gwId = brief.meta.gameweekId
      const event = events.find(e => e.id === gwId)
      return ok(!!event && !event.finished, `GW${gwId} finished=${event?.finished}`, 'event exists and finished=false')
    }

    case 'sq08': {
      if (!save) return na('save=false')
      const hasReason = !!brief.saveReason && brief.saveReason.length > 0
      return ok(hasReason, brief.saveReason ?? '(empty)', 'non-empty string')
    }

    case 'sq09': {
      const count = save ? 0 : brief.transfers.length
      return ok(count <= brief.meta.freeTransfers, `${count} transfers`, `≤ ${brief.meta.freeTransfers} free transfers`)
    }

    case 'sq10': {
      return ok(result.toolCallCount >= 2, `${result.toolCallCount} tool calls`, '≥ 2 tool calls')
    }

    // ── Multi-step ────────────────────────────────────────────────────────────

    case 'mq01': {
      if (save) return na('save=true')
      if (!transfer || !buyPlayer) return ok(false, 'no transfer data', 'affordable')
      const budget = transfer.sellingPrice + brief.meta.bank
      const canAfford = budget >= buyPlayer.now_cost
      return ok(
        canAfford,
        `sell£${(transfer.sellingPrice / 10).toFixed(1)}m + bank£${(brief.meta.bank / 10).toFixed(1)}m = £${(budget / 10).toFixed(1)}m`,
        `≥ buy cost £${(buyPlayer.now_cost / 10).toFixed(1)}m`,
      )
    }

    case 'mq02': {
      if (save) return na('save=true')
      if (!transfer) return ok(false, 'no transfer', 'buy.score > sell.score')
      const diff = transfer.topPick.score.total - transfer.sell.score.total
      return ok(
        diff > 0,
        `buy=${transfer.topPick.score.total.toFixed(2)} sell=${transfer.sell.score.total.toFixed(2)} diff=${diff.toFixed(2)}`,
        'buy 3GW score > sell 3GW score',
      )
    }

    case 'mq03': {
      if (save) return na('save=true')
      if (!transfer || !buyPlayer || !sellPlayer) return ok(false, 'missing data', 'club limit ≤ 3')
      const squadPlayers = picks.picks.map(p => elements.find(e => e.id === p.element)).filter(Boolean) as Player[]
      const fromBuyClub = squadPlayers.filter(
        p => p.team === buyPlayer.team && p.id !== sellPlayer.id,
      ).length
      return ok(
        fromBuyClub + 1 <= 3,
        `${fromBuyClub} existing + 1 new = ${fromBuyClub + 1} from ${teams.find(t => t.id === buyPlayer.team)?.short_name ?? buyPlayer.team}`,
        '≤ 3 from same club',
      )
    }

    case 'mq04': {
      return ok(startingXI.has(captainId), `captain ${captainId} in XI: ${startingXI.has(captainId)}`, 'captain in positions 1-11 post-transfer')
    }

    case 'mq05': {
      if (save) return na('save=true')
      if (brief.transfers.length === 0) return na('no transfers')
      // Recompute both sides from snapshot to avoid brief/snapshot drift
      let agentBest = -Infinity
      for (const t of brief.transfers) {
        const sellPl = elements.find(p => p.id === t.sell.player.id)
        const buyPl = elements.find(p => p.id === t.topPick.player.id)
        if (!sellPl || !buyPl) continue
        const imp = scorePlayer(buyPl, fixtures, bootstrap).total - scorePlayer(sellPl, fixtures, bootstrap).total
        if (imp > agentBest) agentBest = imp
      }
      if (agentBest === -Infinity) return na('could not score transfers')
      const bestLegal = computeBestLegalTransfer(picks, elements, fixtures, bootstrap, brief.meta.bank)
      const diff = bestLegal - agentBest
      return ok(
        diff <= 0.5,
        `agent=${agentBest.toFixed(2)} best=${bestLegal.toFixed(2)} diff=${diff.toFixed(2)}`,
        `within 0.5 pts of best legal (${bestLegal.toFixed(2)})`,
      )
    }

    case 'mq06': {
      if (save) return na('save=true')
      if (!transfer) return na('no transfer')
      const altCount = transfer.alternatives.length
      if (altCount === 0) return na('no alternatives')
      const allIds = [buyId!, ...transfer.alternatives.map(a => a.candidate.player.id)]
      const unique = new Set(allIds).size === allIds.length
      return ok(unique, allIds.join(', '), 'all player IDs unique')
    }

    case 'mq07': {
      if (save) return na('save=true')
      if (!transfer || !sellPlayer) return na('no transfer or sell player')
      if (transfer.alternatives.length === 0) return na('no alternatives')
      const wrongPos = transfer.alternatives.filter(a => {
        const p = elements.find(e => e.id === a.candidate.player.id)
        return p && p.element_type !== sellPlayer.element_type
      })
      return ok(
        wrongPos.length === 0,
        wrongPos.length === 0 ? 'all match' : `wrong: ${wrongPos.map(a => a.candidate.player.web_name).join(', ')}`,
        `all element_type = ${sellPlayer.element_type}`,
      )
    }

    case 'mq08': {
      return ok(startingXI.has(vcId), `vc ${vcId} in XI: ${startingXI.has(vcId)}`, 'vc in positions 1-11 post-transfer')
    }

    case 'mq09': {
      if (save) return na('save=true')
      if (!buyId) return ok(false, 'no buy player', 'buyId not in squad')
      return ok(!squadIds.has(buyId), `in squad: ${squadIds.has(buyId)}`, 'buy player not currently in squad')
    }

    case 'mq10': {
      if (save) return na('save=true')
      if (!transfer) return ok(false, 'no transfer', '≥ 1.0 pt improvement')
      const diff = transfer.topPick.score.total - transfer.sell.score.total
      return ok(diff >= 1.0, `diff=${diff.toFixed(2)} pts`, '≥ 1.0 (SAVE_THRESHOLD_PTS)')
    }

    // ── Open-ended ────────────────────────────────────────────────────────────

    case 'oq01': {
      const startingPlayers = [...startingXI]
        .map(id => elements.find(p => p.id === id))
        .filter((p): p is Player => !!p && p.element_type !== 1)
        .sort((a, b) => {
          const epA = a.ep_next !== null ? parseFloat(a.ep_next) : parseFloat(a.form) * 0.9
          const epB = b.ep_next !== null ? parseFloat(b.ep_next) : parseFloat(b.form) * 0.9
          return epB - epA
        })
      const top3 = new Set(startingPlayers.slice(0, 3).map(p => p.id))
      const top3Names = startingPlayers.slice(0, 3).map(p => p.web_name).join(', ')
      return ok(top3.has(captainId), `captain=${brief.captain.captain.player.web_name}`, `top-3 by ep_next: ${top3Names}`)
    }

    case 'oq02': {
      return na('merged into mq05')
    }

    case 'oq03': {
      if (save) return na('save=true')
      if (!transfer || !sellPlayer || !buyId) return na('no transfer data')
      const budget = transfer.sellingPrice + brief.meta.bank
      const posType = sellPlayer.element_type
      const topTen = elements
        .filter(p => p.element_type === posType && !squadIds.has(p.id) && p.now_cost <= budget && p.status !== 'u' && p.status !== 'n')
        .map(p => ({ id: p.id, total: scorePlayer(p, fixtures, bootstrap).total, name: p.web_name }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
      const topTenIds = new Set(topTen.map(c => c.id))
      const topTenNames = topTen.map(c => c.name).join(', ')
      return ok(topTenIds.has(buyId), elements.find(p => p.id === buyId)?.web_name ?? String(buyId), `top-10 candidates: ${topTenNames}`)
    }

    case 'oq04': {
      if (!captainPlayer) return ok(false, 'captain not found', 'FDR ≤ 3 fixture')
      const gwId = brief.meta.gameweekId
      const captainFixtures = fixtures.filter(
        f => f.event === gwId && (f.team_h === captainPlayer.team || f.team_a === captainPlayer.team),
      )
      if (captainFixtures.length === 0) {
        return nr(
          `${captainPlayer.web_name} blank GW${gwId}`,
          'FDR ≤ 3',
          'no fixture found in snapshot for this GW — blank or not yet scheduled',
        )
      }
      const hasEasy = captainFixtures.some(f => {
        const fdr = f.team_h === captainPlayer.team ? f.team_h_difficulty : f.team_a_difficulty
        return fdr <= 3
      })
      const fdrList = captainFixtures.map(f => {
        const fdr = f.team_h === captainPlayer.team ? f.team_h_difficulty : f.team_a_difficulty
        return `FDR${fdr}`
      }).join(', ')
      return ok(hasEasy, `${captainPlayer.web_name} GW${gwId}: ${fdrList}`, 'at least one FDR ≤ 3')
    }

    case 'oq05': {
      // Verify save/transfer decision against SAVE_THRESHOLD_PTS (1.0 pts).
      const whySell0 = save ? brief.whySellContext[0] : transfer ? { player: transfer.sell.player, score: transfer.sell.score } : null
      if (!whySell0) return nr('no sell candidate', 'threshold check', 'could not determine implied sell player')

      const impliedSellPlayer = elements.find(p => p.id === whySell0.player.id) ?? whySell0.player
      const impliedSellPick = picks.picks.find(p => p.element === impliedSellPlayer.id)
      const sellingPrice = impliedSellPick?.selling_price ?? impliedSellPlayer.now_cost
      const bankVal = brief.meta.bank
      const budget = sellingPrice + bankVal
      const posType = impliedSellPlayer.element_type
      const impliedSellScore = scorePlayer(impliedSellPlayer, fixtures, bootstrap).total

      const candidates = elements
        .filter(p => p.element_type === posType && !squadIds.has(p.id) && p.now_cost <= budget && p.status !== 'u' && p.status !== 'n')
        .map(p => scorePlayer(p, fixtures, bootstrap).total)
        .sort((a, b) => b - a)

      const bestImprovement = (candidates[0] ?? 0) - impliedSellScore

      if (save) {
        if (bestImprovement < 1.0) return ok(true, `best improvement ${bestImprovement.toFixed(2)}`, '< 1.0 → save correct')
        if (bestImprovement < 1.5) return nr(`best improvement ${bestImprovement.toFixed(2)}`, '< 1.0 → save', 'borderline: within 0.5 pts of threshold')
        return ok(false, `best improvement ${bestImprovement.toFixed(2)}`, '< 1.0 → save was wrong; transfer available')
      } else {
        if (!transfer) return ok(false, 'no transfer card', '≥ 1.0 improvement')
        const actual = transfer.topPick.score.total - impliedSellScore
        if (actual >= 1.0) return ok(true, `actual improvement ${actual.toFixed(2)}`, '≥ 1.0 → transfer correct')
        if (actual >= 0.5) return nr(`actual improvement ${actual.toFixed(2)}`, '≥ 1.0', 'borderline: improvement below threshold')
        return ok(false, `actual improvement ${actual.toFixed(2)}`, '≥ 1.0 → transfer below threshold')
      }
    }

    default:
      return { ...baseInfo, conditionMet: true, grade: 'error', answer: '?', expected: '?', note: `no grader for id ${result.questionId}` }
  }
}

// ── Stats helpers ─────────────────────────────────────────────────────────────

export function median(vals: number[]): number {
  if (vals.length === 0) return 0
  const s = [...vals].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? ((s[mid - 1]! + s[mid]!) / 2) : s[mid]!
}

export function p90(vals: number[]): number {
  if (vals.length === 0) return 0
  const s = [...vals].sort((a, b) => a - b)
  return s[Math.ceil(0.9 * s.length) - 1] ?? s[s.length - 1]!
}

// (no other stat helpers needed)

// ── Main (runs only when invoked directly) ────────────────────────────────────

if (fileURLToPath(import.meta.url) === process.argv[1]) {
const args = process.argv.slice(2)
const rflag = args.indexOf('--results')
if (rflag === -1 || !args[rflag + 1]) {
  console.error('Usage: tsx evals/score.ts --results <path-to-results.json>')
  process.exit(1)
}
const resultsPath = args[rflag + 1]!

const __dir = dirname(fileURLToPath(import.meta.url))

const evalRun: EvalRun = JSON.parse(readFileSync(resultsPath, 'utf8'))
const snapshot: Snapshot = JSON.parse(readFileSync(evalRun.snapshotFile, 'utf8'))
const questionsPath = join(__dir, 'questions.json')
const questions: Question[] = JSON.parse(readFileSync(questionsPath, 'utf8'))

// Grade all 25 questions
const grades: GradeResult[] = evalRun.questions.map(r => grade(r, snapshot, questions))

// Grounding check for all questions
const groundingResults: GroundingResult[] = evalRun.questions.map(r => checkGrounding(r, snapshot))

// ── Summary stats ─────────────────────────────────────────────────────────────

const applicable = grades.filter(g => g.conditionMet && g.grade !== 'error')
const correct = applicable.filter(g => g.grade === 'correct').length
const wrong = applicable.filter(g => g.grade === 'wrong').length
const needsReview = applicable.filter(g => g.grade === 'needs_review').length
const naCount = grades.filter(g => g.grade === 'n/a').length
const errorCount = grades.filter(g => g.grade === 'error').length
const denom = correct + wrong + needsReview  // excludes n/a and error

const groundedResults = groundingResults.filter(g => g.checks.length > 0)
const fullyGroundedCount = groundedResults.filter(g => g.fullyGrounded).length
const groundedPct = groundedResults.length > 0
  ? Math.round((fullyGroundedCount / groundedResults.length) * 100)
  : 100

const ungroundedNumbers = groundingResults
  .flatMap(g => g.checks.filter(c => !c.grounded).map(c => ({
    questionId: g.questionId,
    raw: c.raw,
    value: c.value,
    context: c.context,
  })))

const elapsedTimes = evalRun.questions.filter(r => !r.error).map(r => r.elapsedMs)
const medianMs = median(elapsedTimes)
const p90Ms = p90(elapsedTimes)

const totalInput = evalRun.questions.reduce((s, r) => s + r.tokenUsage.inputTokens, 0)
const totalOutput = evalRun.questions.reduce((s, r) => s + r.tokenUsage.outputTokens, 0)
const avgCost = evalRun.questions.length > 0
  ? computeCost(totalInput, totalOutput) / evalRun.questions.length
  : 0

const avgToolCalls = evalRun.questions.length > 0
  ? evalRun.questions.reduce((s, r) => s + r.toolCallCount, 0) / evalRun.questions.length
  : 0

// ── Wrong answers list ────────────────────────────────────────────────────────

const wrongAnswers = grades.filter(g => g.grade === 'wrong')

// ── REPORT.md ─────────────────────────────────────────────────────────────────

const reportLines: string[] = []

const dateStr = new Date(evalRun.startedAt).toISOString().split('T')[0]!

reportLines.push(`# Final Ball Agent Eval Report`)
reportLines.push(``)
reportLines.push(`| Field | Value |`)
reportLines.push(`|-------|-------|`)
reportLines.push(`| Date | ${dateStr} |`)
reportLines.push(`| Model | ${evalRun.model} |`)
reportLines.push(`| Snapshot | ${evalRun.snapshotFile.split(/[/\\]/).pop() ?? evalRun.snapshotFile} |`)
reportLines.push(`| Team ID | ${evalRun.teamId} |`)
reportLines.push(`| Questions | 25 |`)
reportLines.push(``)
reportLines.push(`## Results`)
reportLines.push(``)
reportLines.push(`| Metric | Value |`)
reportLines.push(`|--------|-------|`)
reportLines.push(`| Accuracy | ${correct}/${denom} correct (${needsReview} needs_review, ${naCount} n/a, ${errorCount} errors) |`)
reportLines.push(`| Grounded | ${groundedPct}% of answers with ≥1 extractable number fully grounded |`)
reportLines.push(`| Median latency | ${(medianMs / 1000).toFixed(1)}s |`)
reportLines.push(`| p90 latency | ${(p90Ms / 1000).toFixed(1)}s |`)
reportLines.push(`| Avg cost/question | $${avgCost.toFixed(4)} |`)
reportLines.push(`| Avg tool calls | ${avgToolCalls.toFixed(1)} |`)
reportLines.push(`| Errors | ${errorCount}/${evalRun.questions.length} |`)
reportLines.push(``)
reportLines.push(`> Accuracy denominator excludes n/a (condition not met for that run) and errors.`)
reportLines.push(`> Cost excludes cache read/write — generateBrief does not expose those counters.`)
reportLines.push(``)

// Per-question breakdown
reportLines.push(`## Per-question breakdown`)
reportLines.push(``)
reportLines.push(`| ID | Category | Grade | Answer | Expected | Note |`)
reportLines.push(`|----|----------|-------|--------|----------|------|`)
for (const g of grades) {
  const ans = String(g.answer).replace(/\|/g, '\\|').slice(0, 60)
  const exp = String(g.expected).replace(/\|/g, '\\|').slice(0, 60)
  const note = String(g.note).replace(/\|/g, '\\|').slice(0, 80)
  reportLines.push(`| ${g.questionId} | ${g.category} | **${g.grade}** | ${ans} | ${exp} | ${note} |`)
}
reportLines.push(``)

// Wrong answers
if (wrongAnswers.length > 0) {
  reportLines.push(`## Wrong answers`)
  reportLines.push(``)
  for (const g of wrongAnswers) {
    reportLines.push(`### ${g.questionId}: ${g.text}`)
    reportLines.push(`- **Answer**: ${g.answer}`)
    reportLines.push(`- **Expected**: ${g.expected}`)
    if (g.note) reportLines.push(`- **Note**: ${g.note}`)
    reportLines.push(``)
  }
}

// Ungrounded numbers
if (ungroundedNumbers.length > 0) {
  reportLines.push(`## Ungrounded numbers`)
  reportLines.push(``)
  reportLines.push(`Numbers found in brief reasoning text that do not appear in the FPL snapshot:`)
  reportLines.push(``)
  reportLines.push(`| Question | Raw | Value | Context |`)
  reportLines.push(`|----------|-----|-------|---------|`)
  for (const u of ungroundedNumbers) {
    const ctx = u.context.replace(/\|/g, '\\|')
    reportLines.push(`| ${u.questionId} | \`${u.raw}\` | ${u.value} | ${ctx} |`)
  }
  reportLines.push(``)
} else {
  reportLines.push(`## Ungrounded numbers`)
  reportLines.push(``)
  reportLines.push(`None — all extracted numbers are grounded in snapshot data.`)
  reportLines.push(``)
}

// Found issues (placeholder for bugs discovered during eval)
reportLines.push(`## Found issues`)
reportLines.push(``)
reportLines.push(`*(Document any bugs or unexpected agent behaviour discovered during this run here.)*`)
reportLines.push(``)

// Rerun command
reportLines.push(`## Rerun`)
reportLines.push(``)
reportLines.push(`\`\`\`bash`)
reportLines.push(`pnpm eval -- --team ${evalRun.teamId}`)
reportLines.push(`pnpm eval:score -- --results ${resultsPath}`)
reportLines.push(`\`\`\``)

const reportPath = join(__dir, 'REPORT.md')
writeFileSync(reportPath, reportLines.join('\n'))

// Console summary
console.log(`\n── Eval Score Report ──────────────────────────────────────`)
console.log(`  Accuracy     : ${correct}/${denom} correct  (${needsReview} needs_review, ${naCount} n/a, ${errorCount} errors)`)
console.log(`  Grounded     : ${groundedPct}% of numeric answers fully grounded`)
console.log(`  Median       : ${(medianMs / 1000).toFixed(1)}s`)
console.log(`  p90          : ${(p90Ms / 1000).toFixed(1)}s`)
console.log(`  Avg cost     : $${avgCost.toFixed(4)}/question`)
console.log(`  Avg tools    : ${avgToolCalls.toFixed(1)} calls/run`)
console.log(`  Errors       : ${errorCount}/${evalRun.questions.length}`)
console.log(``)
if (wrongAnswers.length > 0) {
  console.log(`  Wrong answers (${wrongAnswers.length}):`)
  for (const g of wrongAnswers) {
    console.log(`    ${g.questionId}: ${g.text.slice(0, 60)}`)
    console.log(`      got: ${String(g.answer).slice(0, 60)}`)
    console.log(`      exp: ${String(g.expected).slice(0, 60)}`)
  }
  console.log(``)
}
if (ungroundedNumbers.length > 0) {
  console.log(`  Ungrounded numbers (${ungroundedNumbers.length}):`)
  for (const u of ungroundedNumbers) {
    console.log(`    [${u.questionId}] ${u.raw} in "${u.context.slice(0, 50)}"`)
  }
  console.log(``)
}
console.log(`  Report → ${reportPath}`)
} // end if (isMain)
