import type { Player, Bootstrap, Fixture } from '../fpl/types.js'
import type { AgentContext } from '../context.js'
import type { WeakspotResult, PlayerScore } from './weakspot.js'
import { scorePlayer } from './score.js'
import type { ScoreBreakdown } from './score.js'

export interface Candidate {
  player: Player
  score: ScoreBreakdown
  /** pts / (now_cost/10) — buy-side ranking metric per D17.1 */
  valueScore: number
}

export interface TransferOption {
  sell: PlayerScore
  /** Selling price in tenths of £m (from picks API; falls back to now_cost). */
  sellingPrice: number
  topPick: Candidate
  /** Up to 3 ranked alternatives that pass all constraints. */
  alternatives: Candidate[]
  /** Top 10 constraint-passing candidates — passed to the model for ranking (step 6). */
  candidatesForModel: Candidate[]
  /** Constraint violations that caused a replan, for the agent trace (D8.4). */
  replans: string[]
}

export interface TransferPlanResult {
  save: boolean
  saveReason?: string
  /** 0–2 options (never more than freeTransfers). */
  transfers: TransferOption[]
  /** Full Phase 4+5 decision trace. */
  trace: string[]
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getSellingPrice(player: Player, ctx: AgentContext): number {
  const pick = ctx.picks.picks.find(p => p.element === player.id)
  return pick?.selling_price ?? player.now_cost
}

function scoreAsCandidate(
  player: Player,
  allFixtures: Fixture[],
  bootstrap: Bootstrap,
): Candidate {
  const score = scorePlayer(player, allFixtures, bootstrap)
  const valueScore = player.now_cost > 0 ? score.total / (player.now_cost / 10) : 0
  return { player, score, valueScore }
}

/**
 * Phase 4: all affordable, same-position, unowned players sorted by pts/£m desc.
 * Status 'u' (unavailable for season) and 'n' (no contract) are excluded;
 * injured/doubtful players score low naturally via their availability factor.
 */
function eligibleCandidates(
  positionType: number,
  budget: number,
  excludeIds: Set<number>,
  allPlayers: Player[],
  allFixtures: Fixture[],
  bootstrap: Bootstrap,
): Candidate[] {
  return allPlayers
    .filter(
      p =>
        p.element_type === positionType &&
        !excludeIds.has(p.id) &&
        p.now_cost <= budget &&
        p.status !== 'u' &&
        p.status !== 'n',
    )
    .map(p => scoreAsCandidate(p, allFixtures, bootstrap))
    .sort((a, b) => b.valueScore - a.valueScore)
}

/**
 * Phase 5: walk the ranked candidates and pick up to `limit` that pass the
 * 3-per-club constraint. Returns valid picks + replan notes for the trace.
 */
function pickValid(
  candidates: Candidate[],
  squadByClub: Map<number, number>,
  limit = 10,
): { valid: Candidate[]; replans: string[] } {
  const valid: Candidate[] = []
  const replans: string[] = []
  for (const c of candidates) {
    if (valid.length >= limit) break
    const count = squadByClub.get(c.player.team) ?? 0
    if (count >= 3) {
      replans.push(
        `${c.player.web_name} (£${(c.player.now_cost / 10).toFixed(1)}m) skipped — already 3 from this club`,
      )
      continue
    }
    valid.push(c)
  }
  return { valid, replans }
}

// ── single-transfer path ──────────────────────────────────────────────────────

function oneTransferPlan(
  sc: PlayerScore,
  ctx: AgentContext,
  trace: string[],
): TransferPlanResult {
  const { bootstrap, allFixtures, bank, squadByClub, squadPlayers } = ctx
  const sp = getSellingPrice(sc.player, ctx)
  const budget = sp + bank

  trace.push(
    `Phase 4: sell ${sc.player.web_name} (£${(sc.player.now_cost / 10).toFixed(1)}m, sp £${(sp / 10).toFixed(1)}m) — budget £${(budget / 10).toFixed(1)}m`,
  )

  const owned = new Set(squadPlayers.map(p => p.id))

  // After the sell, the sold player's club slot frees up
  const clubAfterSell = new Map(squadByClub)
  clubAfterSell.set(sc.player.team, (clubAfterSell.get(sc.player.team) ?? 1) - 1)

  const raw = eligibleCandidates(
    sc.player.element_type,
    budget,
    owned,
    bootstrap.elements,
    allFixtures,
    bootstrap,
  )
  trace.push(`  ${raw.length} affordable same-position candidates`)

  const { valid, replans } = pickValid(raw, clubAfterSell)
  if (replans.length) trace.push(`  Phase 5 replans: ${replans.join('; ')}`)

  const topPick = valid[0] ?? null

  if (!topPick || topPick.score.total <= sc.score.total) {
    const reason = topPick
      ? `${topPick.player.web_name} (${topPick.score.total.toFixed(1)} pts) does not beat ${sc.player.web_name} (${sc.score.total.toFixed(1)} pts)`
      : 'No valid affordable same-position player found'
    trace.push(`  Save recommended — ${reason}`)
    return { save: true, saveReason: reason, transfers: [], trace }
  }

  trace.push(
    `  Top pick: ${topPick.player.web_name} £${(topPick.player.now_cost / 10).toFixed(1)}m — ${topPick.score.total.toFixed(1)} pts (${topPick.valueScore.toFixed(2)} pts/£m)`,
  )

  return {
    save: false,
    transfers: [
      { sell: sc, sellingPrice: sp, topPick, alternatives: valid.slice(1, 4), candidatesForModel: valid, replans },
    ],
    trace,
  }
}

// ── two-transfer path ─────────────────────────────────────────────────────────

/**
 * Checks both transfers together (D2.3 / plan step 5):
 * T2 budget = bank + sp0 + sp1 − cost(R1), so R1 choice constrains R2.
 * Club counts are updated after T1 before checking T2.
 * If no valid pair is found, falls back to a single transfer on sc0.
 */
function twoTransferPlan(
  sc0: PlayerScore,
  sc1: PlayerScore,
  ctx: AgentContext,
  trace: string[],
): TransferPlanResult {
  const { bootstrap, allFixtures, bank, squadByClub, squadPlayers } = ctx
  const sp0 = getSellingPrice(sc0.player, ctx)
  const sp1 = getSellingPrice(sc1.player, ctx)
  const budget0 = sp0 + bank

  trace.push(
    `Phase 4: 2 free transfers — T1 sell ${sc0.player.web_name} (sp £${(sp0 / 10).toFixed(1)}m), T2 sell ${sc1.player.web_name} (sp £${(sp1 / 10).toFixed(1)}m)`,
  )
  trace.push(`  Bank £${(bank / 10).toFixed(1)}m, T1 budget £${(budget0 / 10).toFixed(1)}m`)

  // Exclude both sell players from owned set so either position can be targeted
  const owned = new Set(squadPlayers.map(p => p.id))
  const ownedNoBothSells = new Set(
    [...owned].filter(id => id !== sc0.player.id && id !== sc1.player.id),
  )

  // Base club counts after both sells
  const clubBase = new Map(squadByClub)
  clubBase.set(sc0.player.team, (clubBase.get(sc0.player.team) ?? 1) - 1)
  clubBase.set(sc1.player.team, (clubBase.get(sc1.player.team) ?? 1) - 1)

  const raw0 = eligibleCandidates(
    sc0.player.element_type,
    budget0,
    ownedNoBothSells,
    bootstrap.elements,
    allFixtures,
    bootstrap,
  )
  trace.push(`  T1 raw candidates: ${raw0.length}`)

  let topPick0: Candidate | null = null
  let topPick1: Candidate | null = null
  let alts0: Candidate[] = []
  let alts1: Candidate[] = []
  let t2ModelCandidates: Candidate[] = []
  const replans0: string[] = []
  const replans1: string[] = []

  // Try T1 picks in value order, stop at the first pair that satisfies both constraints
  for (const c0 of raw0.slice(0, 30)) {
    const c0ClubCount = clubBase.get(c0.player.team) ?? 0
    if (c0ClubCount >= 3) {
      replans0.push(`${c0.player.web_name} T1 skipped — club limit`)
      continue
    }

    const budget1 = bank + sp0 + sp1 - c0.player.now_cost
    if (budget1 < 0) {
      replans0.push(
        `${c0.player.web_name} (£${(c0.player.now_cost / 10).toFixed(1)}m) T1 skipped — leaves negative T2 budget`,
      )
      continue
    }

    // Club counts after T1 buy
    const clubAfterT1 = new Map(clubBase)
    clubAfterT1.set(c0.player.team, c0ClubCount + 1)

    const ownedForT2 = new Set([...ownedNoBothSells, c0.player.id])
    const raw1 = eligibleCandidates(
      sc1.player.element_type,
      budget1,
      ownedForT2,
      bootstrap.elements,
      allFixtures,
      bootstrap,
    )

    const { valid: valid1, replans: rp1 } = pickValid(raw1, clubAfterT1)
    if (valid1.length === 0) {
      replans0.push(`${c0.player.web_name} for T1 leaves no valid T2 — trying next`)
      replans1.push(...rp1)
      continue
    }

    topPick0 = c0
    topPick1 = valid1[0]
    alts1 = valid1.slice(1, 4)
    t2ModelCandidates = valid1
    replans1.push(...rp1)
    trace.push(`  T2 budget with ${c0.player.web_name}: £${(budget1 / 10).toFixed(1)}m, ${raw1.length} candidates`)
    break
  }

  if (!topPick0 || !topPick1) {
    trace.push('  No valid 2-transfer pair — falling back to 1-transfer')
    return oneTransferPlan(sc0, ctx, trace)
  }

  // Alternatives and candidatesForModel for T1: top picks under base club constraint
  const t1ModelCandidates: Candidate[] = [topPick0]
  for (const c0 of raw0) {
    if (t1ModelCandidates.length >= 10) break
    if (t1ModelCandidates.some(c => c.player.id === c0.player.id)) continue
    const count = clubBase.get(c0.player.team) ?? 0
    if (count >= 3) continue
    t1ModelCandidates.push(c0)
  }
  alts0 = t1ModelCandidates.slice(1, 4)

  if (replans0.length) trace.push(`  T1 phase 5 replans: ${replans0.join('; ')}`)
  if (replans1.length) trace.push(`  T2 phase 5 replans: ${replans1.join('; ')}`)
  trace.push(
    `  T1 pick: ${topPick0.player.web_name} £${(topPick0.player.now_cost / 10).toFixed(1)}m — ${topPick0.score.total.toFixed(1)} pts`,
  )
  trace.push(
    `  T2 pick: ${topPick1.player.web_name} £${(topPick1.player.now_cost / 10).toFixed(1)}m — ${topPick1.score.total.toFixed(1)} pts`,
  )

  // Phase 6: save check — only include transfers that improve raw 3-GW pts
  const t0Improves = topPick0.score.total > sc0.score.total
  const t1Improves = topPick1.score.total > sc1.score.total

  if (!t0Improves && !t1Improves) {
    const reason = 'Neither transfer improves 3-GW projected pts'
    trace.push(`  Save recommended — ${reason}`)
    return { save: true, saveReason: reason, transfers: [], trace }
  }

  const transfers: TransferOption[] = []
  if (t0Improves) {
    transfers.push({ sell: sc0, sellingPrice: sp0, topPick: topPick0, alternatives: alts0, candidatesForModel: t1ModelCandidates, replans: replans0 })
  }
  if (t1Improves) {
    transfers.push({ sell: sc1, sellingPrice: sp1, topPick: topPick1, alternatives: alts1, candidatesForModel: t2ModelCandidates, replans: replans1 })
  }

  return { save: false, transfers, trace }
}

// ── public API ────────────────────────────────────────────────────────────────

export function buildTransferPlan(
  weakspots: WeakspotResult,
  ctx: AgentContext,
): TransferPlanResult {
  const { sellCandidates } = weakspots
  const trace: string[] = []

  if (ctx.freeTransfers === 2 && sellCandidates.length === 2) {
    return twoTransferPlan(sellCandidates[0], sellCandidates[1], ctx, trace)
  }

  return oneTransferPlan(sellCandidates[0], ctx, trace)
}
