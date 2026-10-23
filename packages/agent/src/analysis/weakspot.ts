import type { Player, Bootstrap, Fixture } from '../fpl/types.js'
import { scorePlayer, type ScoreBreakdown } from './score.js'

export interface PlayerScore {
  player: Player
  score: ScoreBreakdown
  /** 1 = weakest in squad, 15 = strongest. */
  squadRank: number
}

export interface WeakspotResult {
  /** All 15 players sorted weakest → strongest. */
  ranked: PlayerScore[]
  /**
   * The actual sell candidates: top N from ranked, where N = min(freeTransfers, 2).
   * These are the players the agent will search replacements for.
   */
  sellCandidates: PlayerScore[]
  /**
   * The top 3 weakest (or fewer if squad is small), used by the "Why sell X?" view (D8.6).
   * Always includes the sell candidate(s) plus enough context to show the ranking isn't arbitrary.
   */
  whySellContext: PlayerScore[]
}

/**
 * Ranks all 15 squad players by 3-GW projected score (weakest first) and
 * identifies sell candidates based on the number of free transfers available.
 *
 * Ranking is cross-squad (all positions together) per the PROMPT spec — the
 * weakest player regardless of position is the sell target. The candidate search
 * phase enforces position matching when finding replacements.
 */
export function findWeakSpots(
  squadPlayers: Player[],
  allFixtures: Fixture[],
  bootstrap: Bootstrap,
  freeTransfers: number,
): WeakspotResult {
  const scored = squadPlayers.map(player => ({
    player,
    score: scorePlayer(player, allFixtures, bootstrap),
  }))

  const sorted = [...scored].sort((a, b) => a.score.total - b.score.total)

  const ranked: PlayerScore[] = sorted.map((item, i) => ({
    ...item,
    squadRank: i + 1,
  }))

  const n = Math.min(Math.max(freeTransfers, 1), 2)
  const sellCandidates = ranked.slice(0, n)

  // D8.6: show the sell target(s) in context of the 3 weakest overall
  const whySellContext = ranked.slice(0, Math.max(3, n))

  return { ranked, sellCandidates, whySellContext }
}
