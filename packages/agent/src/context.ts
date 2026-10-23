import type { Bootstrap, Fixture, GameweekEvent, EntryPicks, Player, EntryHistoryItem, EntryChipHistory } from './fpl/types.js'
import type { FplClient } from './fpl/client.js'
import { getActiveGameweek } from './fpl/helpers.js'

export interface AgentContext {
  bootstrap: Bootstrap
  allFixtures: Fixture[]
  gameweek: GameweekEvent
  picks: EntryPicks
  /**
   * All 15 squad players in position order (1 = GK, positions 1–11 starting, 12–15 bench).
   * Indexed to match picks.picks after sorting.
   */
  squadPlayers: Player[]
  /** In tenths of £m. £0.9m = 9. Matches FPL wire format throughout. */
  bank: number
  /** 1 or 2, derived from history using FPL transfer rules. */
  freeTransfers: number
  /** clubId → number of players from that club in the 15-man squad. */
  squadByClub: Map<number, number>
}

/**
 * Loads everything the agent needs for one run.
 * Fetches bootstrap, fixtures, and history in parallel; then picks sequentially
 * (needs the active GW id from bootstrap first).
 */
export async function loadContext(teamId: number, client: FplClient): Promise<AgentContext> {
  const [bootstrap, history, allFixtures] = await Promise.all([
    client.getBootstrap(),
    client.getEntryHistory(teamId),
    client.getFixtures(),
  ])

  const gwId = getActiveGameweek(bootstrap)
  const gameweek = bootstrap.events.find(e => e.id === gwId)
  if (!gameweek) throw new Error(`GW${gwId} not found in bootstrap events`)

  const picks = await client.getEntryPicks(teamId, gwId)
  const bank = picks.entry_history.bank
  const freeTransfers = deriveFreeTransfers(history.current, history.chips, gwId)

  const playerById = new Map<number, Player>(bootstrap.elements.map(p => [p.id, p]))
  const squadPlayers = picks.picks
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(pick => {
      const player = playerById.get(pick.element)
      if (!player) throw new Error(`Player id ${pick.element} not found in bootstrap`)
      return player
    })

  const squadByClub = new Map<number, number>()
  for (const player of squadPlayers) {
    squadByClub.set(player.team, (squadByClub.get(player.team) ?? 0) + 1)
  }

  return { bootstrap, allFixtures, gameweek, picks, squadPlayers, bank, freeTransfers, squadByClub }
}

/**
 * Derives the number of free transfers available for `targetGwId` by replaying
 * the manager's transfer history from GW1.
 *
 * FPL rules:
 *   - Start with 1 FT at GW1.
 *   - Each week: unused FTs carry over (max 2 banked).
 *   - Wildcard resets to 1 FT the following week (fresh squad).
 *   - Free Hit restores the squad so those transfers don't count; FT bank carries through.
 *   - Triple Captain / Bench Boost: normal transfer activity applies.
 */
function deriveFreeTransfers(
  current: EntryHistoryItem[],
  chips: EntryChipHistory[],
  targetGwId: number,
): number {
  const chipByEvent = new Map<number, string>(chips.map(c => [c.event, c.name]))

  const pastEvents = current
    .filter(e => e.event < targetGwId)
    .sort((a, b) => a.event - b.event)

  let ft = 1

  for (const event of pastEvents) {
    const chip = chipByEvent.get(event.event)

    if (chip === 'wildcard') {
      ft = 1
    } else {
      // freehit squad is restored so those transfers don't count against the FT bank
      const effectiveTransfers = chip === 'freehit' ? 0 : event.event_transfers
      const freeUsed = Math.min(ft, effectiveTransfers)
      const leftover = ft - freeUsed
      ft = Math.min(2, leftover + 1)
    }
  }

  return ft
}
