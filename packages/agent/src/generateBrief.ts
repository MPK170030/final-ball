import { createHash } from 'node:crypto'
import { FplClient } from './fpl/client.js'
import { MemoryCacheAdapter } from './fpl/cache.js'
import { loadContext } from './context.js'
import { findWeakSpots } from './analysis/weakspot.js'
import { buildTransferPlan } from './analysis/candidates.js'
import { rankWithModel } from './analysis/rank.js'
import { generateCaptain } from './generateCaptain.js'
import { numberSteps } from './trace.js'
import type { TraceStep, TraceEntry } from './trace.js'
import type { RankedTransferCard } from './analysis/rank.js'
import type { CaptainResult } from './generateCaptain.js'
import type { Player } from './fpl/types.js'
import type { PlayerScore } from './analysis/weakspot.js'
import type { AgentContext } from './context.js'

export interface BriefResult {
  save: boolean
  saveReason?: string
  bestOptionForComparison?: { player: Player; reason: string }
  transfers: RankedTransferCard[]
  captain: CaptainResult
  /** Combined numbered trace from all pipeline phases. */
  trace: TraceStep[]
  meta: {
    gameweekId: number
    freeTransfers: number
    bank: number
    elapsedMs: number
    usage: { inputTokens: number; outputTokens: number }
    /** SHA-256 of the inputs used this run (D10.6). */
    inputHash: string
    /** Human-readable summary of notable squad state, shown as a chip when hash changes (D10.6). */
    changeSummary: string
  }
  /** Top-3 weakest players for the "Why sell?" expansion (D8.6, D17.4). */
  whySellContext: PlayerScore[]
}

/**
 * Computes a deterministic SHA-256 hash of the inputs that determine brief output:
 * squad picks + selling prices, bank, free transfers, player news, and FDR values
 * for the next 3 GWs (D10.6).
 */
export function computeInputHash(ctx: AgentContext): string {
  const upcomingGwIds = ctx.bootstrap.events
    .filter(e => e.id >= ctx.gameweek.id)
    .map(e => e.id)
    .sort((a, b) => a - b)
    .slice(0, 3)

  const fdrMap = new Map<string, number>()
  for (const fixture of ctx.allFixtures) {
    if (fixture.event === null || !upcomingGwIds.includes(fixture.event)) continue
    fdrMap.set(`${fixture.team_h}-${fixture.event}`, fixture.team_h_difficulty)
    fdrMap.set(`${fixture.team_a}-${fixture.event}`, fixture.team_a_difficulty)
  }

  const picks = ctx.picks.picks
    .map(p => ({ id: p.element, sp: p.selling_price ?? 0 }))
    .sort((a, b) => a.id - b.id)

  const news: Record<number, string> = {}
  const fdrs: Record<number, (number | null)[]> = {}
  for (const player of ctx.squadPlayers) {
    news[player.id] = player.news
    fdrs[player.id] = upcomingGwIds.map(gwId => fdrMap.get(`${player.team}-${gwId}`) ?? null)
  }

  return createHash('sha256')
    .update(JSON.stringify({ picks, bank: ctx.bank, freeTransfers: ctx.freeTransfers, news, fdrs }))
    .digest('hex')
}

/** Produces a brief human-readable summary of notable squad state. */
function computeChangeSummary(ctx: AgentContext): string {
  const flagged = ctx.squadPlayers
    .filter(p => p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round < 100)
    .map(p => `${p.web_name} ${p.chance_of_playing_next_round}%`)
    .slice(0, 2)
  return flagged.length > 0 ? `Updated — ${flagged.join(', ')} flagged` : 'FPL data updated'
}

/**
 * Runs the full brief pipeline: loads FPL context once, scores the squad,
 * finds candidates, ranks with the model, then picks the captain.
 * Reports progress via opts.onProgress so callers can stream step names.
 */
export async function generateBrief(
  teamId: number,
  opts?: {
    /** Reuse an existing client (shares its cache with the caller). */
    client?: FplClient
    onProgress?: (step: string) => void
  },
): Promise<BriefResult> {
  const t0 = Date.now()
  const client = opts?.client ?? new FplClient({ cache: new MemoryCacheAdapter() })
  const onProgress = opts?.onProgress ?? (() => {})

  // Phase 1: bootstrap + picks + history in parallel
  onProgress('Loading your squad...')
  const ctx = await loadContext(teamId, client)
  const inputHash = computeInputHash(ctx)
  const changeSummary = computeChangeSummary(ctx)

  // Phase 2+3: score all players, identify weak spots
  onProgress('Scoring your squad...')
  const weakspots = findWeakSpots(
    ctx.squadPlayers,
    ctx.picks.picks,
    ctx.allFixtures,
    ctx.bootstrap,
    ctx.freeTransfers,
  )

  // Phase 4+5: candidates and constraint check
  onProgress('Searching for candidates...')
  const plan = buildTransferPlan(weakspots, ctx)

  // Phase 6: model ranking
  onProgress('Ranking with AI...')
  const ranked = await rankWithModel(plan, ctx)

  // Phase 7: captain (uses post-transfer starting XI)
  onProgress('Picking your captain...')
  const captain = await generateCaptain(ctx, {
    save: ranked.save,
    saveReason: ranked.saveReason,
    bestOptionForComparison: ranked.bestOptionForComparison,
    transfers: ranked.transfers,
    trace: [] as TraceStep[],
    meta: {
      gameweekId: ctx.gameweek.id,
      freeTransfers: ctx.freeTransfers,
      bank: ctx.bank,
      elapsedMs: 0,
      usage: ranked.usage,
    },
  })

  // Combine all trace entries and assign sequential numbers
  const allEntries: TraceEntry[] = [
    {
      title: 'Context loaded',
      text: `Squad: 15 players, £${(ctx.bank / 10).toFixed(1)}m bank, ${ctx.freeTransfers} free transfer${ctx.freeTransfers > 1 ? 's' : ''}. GW${ctx.gameweek.id}.`,
    },
    {
      title: 'Players scored',
      text: `Scored all 15 players over the next 3 GWs. Three weakest: ${weakspots.whySellContext.map(ws => `${ws.player.web_name} (${ws.score.total.toFixed(1)} pts)`).join(', ')}.`,
    },
    {
      title: 'Weak spot',
      text: `Sell candidate${weakspots.sellCandidates.length > 1 ? 's' : ''}: ${weakspots.sellCandidates.map(s => s.player.web_name).join(' and ')}.`,
    },
    ...ranked.trace,
    ...captain.trace,
  ]

  return {
    save: ranked.save,
    saveReason: ranked.saveReason,
    bestOptionForComparison: ranked.bestOptionForComparison,
    transfers: ranked.transfers,
    captain,
    trace: numberSteps(allEntries),
    meta: {
      gameweekId: ctx.gameweek.id,
      freeTransfers: ctx.freeTransfers,
      bank: ctx.bank,
      elapsedMs: Date.now() - t0,
      usage: {
        inputTokens: ranked.usage.inputTokens + captain.usage.inputTokens,
        outputTokens: ranked.usage.outputTokens + captain.usage.outputTokens,
      },
      inputHash,
      changeSummary,
    },
    whySellContext: weakspots.whySellContext,
  }
}
