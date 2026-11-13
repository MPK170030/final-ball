import type { Player } from '../fpl/types.js'

export interface LineupSlot {
  player: Player
  epNext: number
  isDoubtful: boolean
}

export interface LineupResult {
  starting: LineupSlot[]  // 11 players: GK, then DEF, MID, FWD (all sorted by score within group)
  bench: LineupSlot[]     // 4 players: highest-scoring non-GK first, GK last
  formation: string       // e.g. "4-4-2"
  swapsIn: Player[]       // recommended to start but currently on bench
  swapsOut: Player[]      // recommended to bench but currently starting
  hasChanges: boolean
}

// All 9 valid FPL formations [nDEF, nMID, nFWD]
const FORMATIONS: [number, number, number][] = [
  [3, 5, 2], [3, 4, 3],
  [4, 5, 1], [4, 4, 2], [4, 3, 3],
  [5, 4, 1], [5, 3, 2], [5, 2, 3],
]

function slotScore(p: Player): number {
  const ep = p.ep_next !== null ? parseFloat(p.ep_next) : parseFloat(p.form) * 0.9
  const avail = p.chance_of_playing_next_round !== null ? p.chance_of_playing_next_round / 100 : 1.0
  return ep * avail
}

function toSlot(p: Player): LineupSlot {
  return {
    player: p,
    epNext: slotScore(p),
    isDoubtful: p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round < 75,
  }
}

/**
 * Recommends the best starting XI and bench order from the given 15-player squad.
 *
 * @param squad 15 players in position order (index 0 = position 1 = current GK starter).
 *   squad.slice(0, 11) are the user's current starters; .slice(11) are the bench.
 */
export function computeLineup(squad: Player[]): LineupResult {
  const gks = [...squad.filter(p => p.element_type === 1)].sort((a, b) => slotScore(b) - slotScore(a))
  const defs = [...squad.filter(p => p.element_type === 2)].sort((a, b) => slotScore(b) - slotScore(a))
  const mids = [...squad.filter(p => p.element_type === 3)].sort((a, b) => slotScore(b) - slotScore(a))
  const fwds = [...squad.filter(p => p.element_type === 4)].sort((a, b) => slotScore(b) - slotScore(a))

  const startGk = gks[0]!
  const benchGk = gks[1]

  // Try all valid formations; pick the one with the highest total outfield score
  let bestFormation: [number, number, number] = [4, 4, 2]
  let bestScore = -1
  for (const [nDef, nMid, nFwd] of FORMATIONS) {
    if (defs.length < nDef || mids.length < nMid || fwds.length < nFwd) continue
    const total =
      defs.slice(0, nDef).reduce((s, p) => s + slotScore(p), 0) +
      mids.slice(0, nMid).reduce((s, p) => s + slotScore(p), 0) +
      fwds.slice(0, nFwd).reduce((s, p) => s + slotScore(p), 0)
    if (total > bestScore) {
      bestScore = total
      bestFormation = [nDef, nMid, nFwd]
    }
  }

  const [nDef, nMid, nFwd] = bestFormation

  const starting: LineupSlot[] = [
    toSlot(startGk),
    ...defs.slice(0, nDef).map(toSlot),
    ...mids.slice(0, nMid).map(toSlot),
    ...fwds.slice(0, nFwd).map(toSlot),
  ]
  const recommendedStarterIds = new Set(starting.map(s => s.player.id))

  // Bench: remaining outfield sorted by score (best auto-sub first), GK last
  const benchOutfield = squad
    .filter(p => p.element_type !== 1 && !recommendedStarterIds.has(p.id))
    .sort((a, b) => slotScore(b) - slotScore(a))
  const bench = [...benchOutfield, ...(benchGk ? [benchGk] : [])].map(toSlot)

  // Swap detection: compare recommended set against squad.slice(0, 11)
  const currentStarterIds = new Set(squad.slice(0, 11).map(p => p.id))
  const swapsIn = starting.filter(s => !currentStarterIds.has(s.player.id)).map(s => s.player)
  const swapsOut = squad.slice(0, 11).filter(p => !recommendedStarterIds.has(p.id))

  return {
    starting,
    bench,
    formation: `${nDef}-${nMid}-${nFwd}`,
    swapsIn,
    swapsOut,
    hasChanges: swapsIn.length > 0 || swapsOut.length > 0,
  }
}
