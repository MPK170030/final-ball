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
  }
  /** Top-3 weakest players for the "Why sell?" expansion (D8.6, D17.4). */
  whySellContext: PlayerScore[]
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
    },
    whySellContext: weakspots.whySellContext,
  }
}
