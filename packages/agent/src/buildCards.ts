import type { BriefResult } from './generateBrief.js'
import type { CaptainPick } from './generateCaptain.js'
import type { RankedTransferCard } from './analysis/rank.js'
import type { PlayerScore } from './analysis/weakspot.js'
import type { Player } from './fpl/types.js'

export type EnrichMeta = {
  clubs: Map<number, string>
  nextFixtureForTeam: Map<number, { opponent: string; isHome: boolean } | null>
  freeTransfers: number
  gameweekId: number
}

export type CardRow = {
  type: 'transfer' | 'captain' | 'chip' | 'preview' | 'lineup'
  position: number
  payload: unknown
}

function withClub<T extends { player: { team: number } }>(
  obj: T,
  clubs: Map<number, string>,
): T & { clubShortName?: string } {
  const name = clubs.get(obj.player.team)
  return name ? { ...obj, clubShortName: name } : obj
}

export function buildTransferCardPayload(
  card: RankedTransferCard,
  whySellContext: PlayerScore[],
  clubs: Map<number, string>,
): object {
  return {
    save: false,
    sell: withClub(card.sell, clubs),
    sellingPrice: card.sellingPrice,
    topPick: withClub(card.topPick, clubs),
    topPickReason: card.topPickReason,
    topPickWhy: card.topPickWhy,
    topPickRiskTag: card.topPickRiskTag,
    alternatives: card.alternatives.map(alt => ({
      ...alt,
      candidate: withClub(alt.candidate, clubs),
    })),
    whySell: card.whySell,
    swapReason: card.swapReason,
    replans: card.replans,
    whySellContext: whySellContext.map(ws => withClub(ws, clubs)),
  }
}

export function buildSaveCardPayload(opts: {
  saveReason: string
  bestOptionForComparison?: { player: Player; reason: string }
  whySellContext: PlayerScore[]
  freeTransfers: number
  gameweekId: number
  clubs: Map<number, string>
}): object {
  const { saveReason, bestOptionForComparison, whySellContext, freeTransfers, gameweekId, clubs } = opts
  const sellPlayer = whySellContext[0]
  return {
    save: true,
    reason: saveReason ?? '',
    bestOption: bestOptionForComparison ? withClub(bestOptionForComparison, clubs) : null,
    sellPlayer: sellPlayer
      ? {
          player: sellPlayer.player,
          sellingPrice: sellPlayer.player.now_cost,
          clubShortName: clubs.get(sellPlayer.player.team),
        }
      : null,
    freeTransfersNextGw: Math.min(2, freeTransfers + 1),
    nextGw: gameweekId + 1,
  }
}

export function buildCardRows(result: BriefResult, enrich: EnrichMeta): CardRow[] {
  const { clubs, nextFixtureForTeam, freeTransfers, gameweekId } = enrich
  const rows: CardRow[] = []
  let pos = 1

  if (result.save) {
    rows.push({
      type: 'transfer',
      position: pos++,
      payload: buildSaveCardPayload({
        saveReason: result.saveReason ?? '',
        bestOptionForComparison: result.bestOptionForComparison,
        whySellContext: result.whySellContext,
        freeTransfers,
        gameweekId,
        clubs,
      }),
    })
  } else {
    for (const card of result.transfers) {
      rows.push({
        type: 'transfer',
        position: pos++,
        payload: buildTransferCardPayload(card, result.whySellContext, clubs),
      })
    }
  }

  function enrichCaptainPick(pick: CaptainPick) {
    return {
      ...pick,
      clubShortName: clubs.get(pick.player.team),
      nextFixture: nextFixtureForTeam.get(pick.player.team) ?? null,
    }
  }

  rows.push({
    type: 'captain',
    position: pos++,
    payload: {
      captain: enrichCaptainPick(result.captain.captain),
      vc: enrichCaptainPick(result.captain.vc),
      alternatives: result.captain.alternatives.map(enrichCaptainPick),
    },
  })

  if (result.chipAdvice) {
    rows.push({
      type: 'chip',
      position: pos++,
      payload: result.chipAdvice,
    })
  }

  if (result.lineup) {
    rows.push({
      type: 'lineup',
      position: pos++,
      payload: {
        gameweek: enrich.gameweekId,
        formation: result.lineup.formation,
        starting: result.lineup.starting.map(s => ({
          player: s.player,
          clubShortName: clubs.get(s.player.team),
          nextFixture: nextFixtureForTeam.get(s.player.team) ?? null,
          epNext: s.epNext,
          isDoubtful: s.isDoubtful,
        })),
        bench: result.lineup.bench.map(s => ({
          player: s.player,
          clubShortName: clubs.get(s.player.team),
          epNext: s.epNext,
          isDoubtful: s.isDoubtful,
        })),
        swapsIn: result.lineup.swapsIn,
        swapsOut: result.lineup.swapsOut,
        hasChanges: result.lineup.hasChanges,
      },
    })
  }

  if (result.nextWeekPreview) {
    rows.push({
      type: 'preview',
      position: pos,
      payload: {
        text: result.nextWeekPreview,
        nextGameweek: result.meta.gameweekId + 1,
      },
    })
  }

  return rows
}
