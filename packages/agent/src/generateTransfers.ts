import { FplClient } from './fpl/client.js'
import { MemoryCacheAdapter } from './fpl/cache.js'
import { loadContext } from './context.js'
import { findWeakSpots } from './analysis/weakspot.js'
import { buildTransferPlan } from './analysis/candidates.js'
import { rankWithModel } from './analysis/rank.js'
import { numberSteps } from './trace.js'
import type { TraceStep } from './trace.js'
import type { RankedTransferCard } from './analysis/rank.js'
import type { Player } from './fpl/types.js'

export interface GenerateTransfersResult {
  save: boolean
  saveReason?: string
  /** Best option to show alongside a save recommendation (D2.2). */
  bestOptionForComparison?: { player: Player; reason: string }
  transfers: RankedTransferCard[]
  trace: TraceStep[]
  meta: {
    gameweekId: number
    freeTransfers: number
    /** Bank in tenths of £m (FPL wire format). */
    bank: number
    elapsedMs: number
    usage: { inputTokens: number; outputTokens: number }
  }
}

export async function generateTransfers(
  teamId: number,
  opts?: { client?: FplClient },
): Promise<GenerateTransfersResult> {
  const t0 = Date.now()
  const client = opts?.client ?? new FplClient({ cache: new MemoryCacheAdapter() })

  // Phase 1: load context
  const ctx = await loadContext(teamId, client)
  const { gameweek, bank, freeTransfers, squadPlayers, picks, bootstrap, allFixtures } = ctx

  // Phase 2+3: score all players and identify weak spots
  const weakspots = findWeakSpots(squadPlayers, picks.picks, allFixtures, bootstrap, freeTransfers)

  const topThree = weakspots.whySellContext
    .map(ws => `${ws.player.web_name} (${ws.score.total.toFixed(1)} pts)`)
    .join(', ')
  const sellNames = weakspots.sellCandidates.map(s => s.player.web_name).join(' and ')

  // Phase 4+5: candidates and constraints
  const plan = buildTransferPlan(weakspots, ctx)

  // Phase 6+7: model ranking and validation
  const ranked = await rankWithModel(plan, ctx)

  // Assemble trace: prepend the context/scoring steps with sequential numbers
  const allEntries = [
    {
      title: 'Context loaded',
      text: `Squad: 15 players, £${(bank / 10).toFixed(1)}m in the bank, ${freeTransfers} free transfer${freeTransfers > 1 ? 's' : ''}. GW${gameweek.id}.`,
    },
    {
      title: 'Players scored',
      text: `Scored all 15 players over the next 3 GWs. Three weakest: ${topThree}.`,
    },
    {
      title: 'Weak spot',
      text: `Sell candidate${weakspots.sellCandidates.length > 1 ? 's' : ''}: ${sellNames}.`,
    },
    ...plan.trace,
    ...ranked.trace,
  ]

  return {
    save: ranked.save,
    saveReason: ranked.saveReason,
    bestOptionForComparison: ranked.bestOptionForComparison,
    transfers: ranked.transfers,
    trace: numberSteps(allEntries),
    meta: {
      gameweekId: gameweek.id,
      freeTransfers,
      bank,
      elapsedMs: Date.now() - t0,
      usage: ranked.usage,
    },
  }
}
