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
 * GW1: min(ep_next, ppg × 3 × fdrMultiplier × dgwFactor) × availability
 *   ep_next encodes fixture difficulty, but is derived from form and can spike
 *   after one exceptional game. We cap it relative to ppg and the upcoming
 *   fixture so a single outlier doesn't dominate the immediate forecast.
 *
 * GW2/3: blendedForm × fdrMultiplier(fdr) × availability
 *   form is capped at 2× ppg before blending 50/50 with ppg — one fluke game
 *   can't project as a new long-run baseline.
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

  const ppg = parseFloat(player.points_per_game)

  // Cap form at 2× ppg before blending 50/50 with ppg.
  // Prevents a single exceptional game (high form, few recent appearances) from
  // projecting unrealistically high across multiple future GWs.
  const rawForm = parseFloat(player.form)
  const cappedForm = ppg > 0 ? Math.min(rawForm, ppg * 2) : rawForm
  const form = cappedForm * 0.5 + ppg * 0.5

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
      // GW1 — use FPL's ep_next but cap it at ppg × 3 × fixture-factor.
      // ep_next is fixture-aware but form-driven; this cap ensures one standout
      // game can't make a 3 ppg player project as a 6+ pt GW1 scorer at an
      // average fixture. The factor scales with difficulty so easy-fixture
      // players retain the full ep_next headroom they deserve.
      const maxEp = ppg * 3 * fdrMultiplier(fx.avgFdr) * (fx.isDouble ? 2 : 1)
      points = Math.min(epNext, maxEp) * availability
    } else {
      // GW2/3 — blended form projection with fixture and availability adjustments
      const base = form * fdrMultiplier(fx.avgFdr) * availability
      points = fx.isDouble ? base * 2 : base
    }

    return { gwId: fx.gwId, points, fdr: fx.avgFdr, isDouble: fx.isDouble, opponents: fx.opponents }
  })

  const total = perGw.reduce((sum, gw) => sum + gw.points, 0)

  return { total, perGw, epNext, form, availability }
}
