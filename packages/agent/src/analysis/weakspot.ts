import type { Player, Bootstrap, Fixture, PickItem } from '../fpl/types.js'
import { scorePlayer, type ScoreBreakdown } from './score.js'

export interface PlayerScore {
  player: Player
  score: ScoreBreakdown
  /** 1 = weakest in squad, 15 = strongest. */
  squadRank: number
  /** pts/£m used for ranking (backup GK has a floor applied, D17.3). */
  rankScore: number
}

export interface WeakspotResult {
  /** All 15 players sorted weakest → strongest by rankScore. */
  ranked: PlayerScore[]
  /**
   * Sell candidates: top N, N = min(freeTransfers, 2).
   */
  sellCandidates: PlayerScore[]
  /**
   * Top 3 weakest for the "Why sell X?" view (D8.6).
   */
  whySellContext: PlayerScore[]
}

/**
 * A backup GK scoring 0 pts is expected — they provide structural insurance
 * value, not scoring returns. Without an offset they'd always rank as the
 * squad's worst player and dominate the sell recommendation regardless of
 * whether the transfer makes sense. The floor represents ~1 GW of basic
 * coverage value. If their pts/£m is still poor after the floor (expensive
 * bench GK, poor form), they'll still rank weakly — just not unfairly so.
 * (D17.3)
 */
const BENCH_GK_FLOOR_PTS = 2.0

function backupGkId(squadPlayers: Player[], picks: PickItem[]): number | null {
  for (const pick of picks) {
    if (pick.position > 11) {
      const player = squadPlayers.find(p => p.id === pick.element)
      if (player?.element_type === 1) return player.id
    }
  }
  return null
}

export function findWeakSpots(
  squadPlayers: Player[],
  picks: PickItem[],
  allFixtures: Fixture[],
  bootstrap: Bootstrap,
  freeTransfers: number,
): WeakspotResult {
  const gkBackupId = backupGkId(squadPlayers, picks)

  const scored = squadPlayers.map(player => {
    const score = scorePlayer(player, allFixtures, bootstrap)
    const isBackupGk = player.id === gkBackupId
    const effectivePts = isBackupGk
      ? Math.max(score.total, BENCH_GK_FLOOR_PTS)
      : score.total
    const rankScore =
      player.now_cost > 0 ? effectivePts / (player.now_cost / 10) : 0
    return { player, score, rankScore }
  })

  const sorted = [...scored].sort((a, b) => a.rankScore - b.rankScore)

  const ranked: PlayerScore[] = sorted.map((item, i) => ({
    ...item,
    squadRank: i + 1,
  }))

  const n = Math.min(Math.max(freeTransfers, 1), 2)
  const sellCandidates = ranked.slice(0, n)
  const whySellContext = ranked.slice(0, 3)

  return { ranked, sellCandidates, whySellContext }
}
