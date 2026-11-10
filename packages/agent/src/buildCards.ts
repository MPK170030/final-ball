import type { BriefResult } from './generateBrief.js'
import type { CaptainPick } from './generateCaptain.js'

export type EnrichMeta = {
  clubs: Map<number, string>
  nextFixtureForTeam: Map<number, { opponent: string; isHome: boolean } | null>
  freeTransfers: number
  gameweekId: number
}

export type CardRow = {
  type: 'transfer' | 'captain'
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

export function buildCardRows(result: BriefResult, enrich: EnrichMeta): CardRow[] {
  const { clubs, nextFixtureForTeam, freeTransfers, gameweekId } = enrich
  const rows: CardRow[] = []
  let pos = 1

  if (result.save) {
    const sellPlayer = result.whySellContext[0]
    rows.push({
      type: 'transfer',
      position: pos++,
      payload: {
        save: true,
        reason: result.saveReason ?? '',
        bestOption: result.bestOptionForComparison
          ? withClub(result.bestOptionForComparison, clubs)
          : null,
        sellPlayer: sellPlayer
          ? {
              player: sellPlayer.player,
              sellingPrice: sellPlayer.player.now_cost,
              clubShortName: clubs.get(sellPlayer.player.team),
            }
          : null,
        freeTransfersNextGw: Math.min(2, freeTransfers + 1),
        nextGw: gameweekId + 1,
      },
    })
  } else {
    for (const card of result.transfers) {
      rows.push({
        type: 'transfer',
        position: pos++,
        payload: {
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
          whySellContext: result.whySellContext.map(ws => withClub(ws, clubs)),
        },
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
    position: pos,
    payload: {
      captain: enrichCaptainPick(result.captain.captain),
      vc: enrichCaptainPick(result.captain.vc),
      alternatives: result.captain.alternatives.map(enrichCaptainPick),
    },
  })

  return rows
}
