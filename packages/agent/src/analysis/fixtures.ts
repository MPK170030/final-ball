import type { Bootstrap, Fixture } from '../fpl/types.js'
import { getNextGameweek } from '../fpl/helpers.js'

export interface GwFixture {
  gwId: number
  /** null = blank gameweek (player's club has no fixture). */
  avgFdr: number | null
  isDouble: boolean
}

/**
 * Returns the next `count` gameweek IDs starting from the GW that ep_next covers
 * (i.e. the GW with is_next = true). Index 0 aligns with ep_next.
 */
export function getUpcomingGwIds(bootstrap: Bootstrap, count: number): number[] {
  const nextGwId = getNextGameweek(bootstrap)
  if (!nextGwId) return []
  return bootstrap.events
    .filter(e => e.id >= nextGwId)
    .sort((a, b) => a.id - b.id)
    .slice(0, count)
    .map(e => e.id)
}

/**
 * Returns fixture info for a club across the given GW IDs.
 * Blank GWs: avgFdr = null.
 * Double GWs: isDouble = true, avgFdr = mean of both FDRs.
 */
export function getClubGwFixtures(
  clubId: number,
  allFixtures: Fixture[],
  gwIds: number[],
): GwFixture[] {
  return gwIds.map(gwId => {
    const matches = allFixtures.filter(
      f => f.event === gwId && (f.team_h === clubId || f.team_a === clubId),
    )

    if (matches.length === 0) {
      return { gwId, avgFdr: null, isDouble: false }
    }

    const fdrs = matches.map(f =>
      f.team_h === clubId ? f.team_h_difficulty : f.team_a_difficulty,
    )
    const avgFdr = fdrs.reduce((a, b) => a + b, 0) / fdrs.length

    return { gwId, avgFdr, isDouble: matches.length > 1 }
  })
}

/**
 * FDR 1 → 1.0, FDR 3 → 0.5, FDR 5 → 0.25.
 * Floor at 0.25 so even the hardest fixture still contributes (players score in
 * tough games too). No ceiling — FDR 1 is the best possible.
 */
export function fdrMultiplier(fdr: number): number {
  return Math.max(0.25, (5 - fdr) / 4)
}
