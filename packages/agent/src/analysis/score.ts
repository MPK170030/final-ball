import type { Player, Bootstrap, Fixture } from '../fpl/types.js'
import { getUpcomingGwIds, getClubGwFixtures, fdrMultiplier } from './fixtures.js'

export interface GwScore {
  gwId: number
  points: number
  /** null = blank GW */
  fdr: number | null
  isDouble: boolean
  /** Resolved opponent(s) for display. Empty on blank GWs. */
  opponents: { shortName: string; isHome: boolean }[]
}

export interface ScoreBreakdown {
  /** Sum across the 3 GWs. Use this for ranking. */
  total: number
  perGw: GwScore[]
  /** ep_next parsed as float (or form × 0.9 fallback). Used as GW1 base. */
  epNext: number
  /** form parsed as float. Used as GW2/3 base. */
  form: number
  /** 0–1. chance_of_playing_next_round / 100, or 1.0 if unknown. */
  availability: number
}

/**
 * Scores a player across the next 3 gameweeks.
 *
 * GW1: ep_next × availability
 *   FPL's ep_next already encodes fixture difficulty for the immediate next GW,
 *   so we don't apply a fixture multiplier on top.
 *
 * GW2/3: form × fdrMultiplier(fdr) × availability
 *   We have no FPL model for future GWs, so we project forward using form.
 *   Blank GW → 0 pts. Double GW → contribution × 2 (two games played).
 *
 * Availability: we only have chance_of_playing_next_round (one value from FPL).
 *   Applied to all 3 GWs as the best available signal — conservative for injuries,
 *   reasonable for fit players.
 */
export function scorePlayer(
  player: Player,
  allFixtures: Fixture[],
  bootstrap: Bootstrap,
): ScoreBreakdown {
  const epNext =
    player.ep_next !== null ? parseFloat(player.ep_next) : parseFloat(player.form) * 0.9

  // Blend recent form (4-game rolling avg, volatile) with season points_per_game
  // (stable) so one standout game doesn't inflate GW2/3 projections.
  const form = parseFloat(player.form) * 0.6 + parseFloat(player.points_per_game) * 0.4

  const availability =
    player.chance_of_playing_next_round !== null
      ? player.chance_of_playing_next_round / 100
      : 1.0

  const gwIds = getUpcomingGwIds(bootstrap, 3)
  const fixtures = getClubGwFixtures(player.team, allFixtures, gwIds, bootstrap.teams)

  const perGw: GwScore[] = fixtures.map((fx, i) => {
    if (fx.avgFdr === null) {
      return { gwId: fx.gwId, points: 0, fdr: null, isDouble: false, opponents: [] }
    }

    let points: number
    if (i === 0) {
      // GW1 — trust FPL's own projection; availability is the only adjustment we add
      points = epNext * availability
    } else {
      // GW2/3 — form-based projection with fixture and availability adjustments
      const base = form * fdrMultiplier(fx.avgFdr) * availability
      points = fx.isDouble ? base * 2 : base
    }

    return { gwId: fx.gwId, points, fdr: fx.avgFdr, isDouble: fx.isDouble, opponents: fx.opponents }
  })

  const total = perGw.reduce((sum, gw) => sum + gw.points, 0)

  return { total, perGw, epNext, form, availability }
}
