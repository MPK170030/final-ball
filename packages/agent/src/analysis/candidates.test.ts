import { describe, it, expect } from 'vitest'
import { buildTransferPlan } from './candidates.js'
import { findWeakSpots } from './weakspot.js'
import { makePlayer, makeBootstrap, makeFixtures, makePick } from './__tests__/helpers.js'
import type { AgentContext } from '../context.js'
import type { EntryPicks } from '../fpl/types.js'

const BOOTSTRAP_BASE = makeBootstrap({ gwIds: [7, 8, 9, 10], nextGwId: 8 })

/** Build a minimal AgentContext from a squad + a pool of available candidates. */
function makeCtx(
  squad: ReturnType<typeof makePlayer>[],
  allPlayers: ReturnType<typeof makePlayer>[],
  opts?: { bank?: number; freeTransfers?: number },
): AgentContext {
  const bank = opts?.bank ?? 0
  const freeTransfers = opts?.freeTransfers ?? 1
  const allFixtures = allPlayers.flatMap(p =>
    makeFixtures(p.team, [
      { gwId: 8, fdr: 3 },
      { gwId: 9, fdr: 3 },
      { gwId: 10, fdr: 3 },
    ]),
  )
  const picks: EntryPicks = {
    active_chip: null,
    automatic_subs: [],
    entry_history: {
      event: 8,
      points: 0,
      total_points: 0,
      rank: null,
      rank_sort: null,
      overall_rank: 100000,
      percentile_rank: null,
      bank,
      value: 1000,
      event_transfers: 0,
      event_transfers_cost: 0,
      points_on_bench: 0,
    },
    picks: squad.map((p, i) => makePick(p.id, i + 1, { sellingPrice: p.now_cost })),
  }
  const squadByClub = new Map<number, number>()
  for (const p of squad) {
    squadByClub.set(p.team, (squadByClub.get(p.team) ?? 0) + 1)
  }
  return {
    bootstrap: makeBootstrap({ gwIds: [7, 8, 9, 10], nextGwId: 8, players: allPlayers }),
    allFixtures,
    gameweek: BOOTSTRAP_BASE.events.find(e => e.is_next)!,
    picks,
    squadPlayers: squad,
    bank,
    freeTransfers,
    squadByClub,
  }
}

describe('buildTransferPlan', () => {
  it('returns a transfer when there is a clearly better affordable candidate', () => {
    // Squad: 15 MIDs from teams 1–15. Weakest is id=1 (ep_next=1.0).
    const squad = Array.from({ length: 15 }, (_, i) =>
      makePlayer({ id: i + 1, element_type: 3, team: i + 1, now_cost: 80, ep_next: `${(i + 1).toFixed(1)}`, form: `${(i + 1).toFixed(1)}` }),
    )
    // One candidate not in the squad: better than the weakest, same position, affordable.
    const candidate = makePlayer({ id: 99, element_type: 3, team: 20, now_cost: 80, ep_next: '10.0', form: '10.0' })

    const ctx = makeCtx(squad, [...squad, candidate])
    const weakspots = findWeakSpots(squad, ctx.picks.picks, ctx.allFixtures, ctx.bootstrap, 1)
    const plan = buildTransferPlan(weakspots, ctx)

    expect(plan.save).toBe(false)
    expect(plan.transfers).toHaveLength(1)
    expect(plan.transfers[0]!.sell.player.id).toBe(1)
    expect(plan.transfers[0]!.topPick.player.id).toBe(99)
  })

  it('returns save when no candidate beats the weakest player', () => {
    // Squad of 15 strong players; the only candidate outside is weaker.
    const squad = Array.from({ length: 15 }, (_, i) =>
      makePlayer({ id: i + 1, element_type: 3, team: i + 1, now_cost: 80, ep_next: '8.0', form: '8.0' }),
    )
    const weakCandidate = makePlayer({ id: 99, element_type: 3, team: 20, now_cost: 80, ep_next: '2.0', form: '2.0' })

    const ctx = makeCtx(squad, [...squad, weakCandidate])
    const weakspots = findWeakSpots(squad, ctx.picks.picks, ctx.allFixtures, ctx.bootstrap, 1)
    const plan = buildTransferPlan(weakspots, ctx)

    expect(plan.save).toBe(true)
    expect(plan.transfers).toHaveLength(0)
  })

  it('skips candidates over the 3-per-club limit and records a replan (D2.8)', () => {
    // Squad has 3 players from team 5 (club limit).
    // Sell target is from team 9 (MID, cheapest in squad).
    // All top-ranked affordable candidates are from team 5 → should be skipped.
    // Only the 4th candidate (team 6) is valid.
    const squadMids = [
      makePlayer({ id: 1, element_type: 3, team: 9, now_cost: 60, ep_next: '1.0', form: '1.0' }), // sell
      makePlayer({ id: 2, element_type: 3, team: 5, now_cost: 80, ep_next: '5.0', form: '5.0' }), // club 5 #1
      makePlayer({ id: 3, element_type: 3, team: 5, now_cost: 80, ep_next: '5.0', form: '5.0' }), // club 5 #2
      makePlayer({ id: 4, element_type: 3, team: 5, now_cost: 80, ep_next: '5.0', form: '5.0' }), // club 5 #3
      ...Array.from({ length: 11 }, (_, i) =>
        makePlayer({ id: i + 10, element_type: 3, team: i + 10, now_cost: 80, ep_next: '4.0', form: '4.0' }),
      ),
    ]

    // Candidates outside the squad:
    // Three from team 5 (high pts/£m but club-limited) + one valid from team 6
    const club5Candidates = [
      makePlayer({ id: 101, element_type: 3, team: 5, now_cost: 60, ep_next: '9.0', form: '9.0', web_name: 'Club5A' }),
      makePlayer({ id: 102, element_type: 3, team: 5, now_cost: 60, ep_next: '8.5', form: '8.5', web_name: 'Club5B' }),
      makePlayer({ id: 103, element_type: 3, team: 5, now_cost: 60, ep_next: '8.0', form: '8.0', web_name: 'Club5C' }),
    ]
    const validCandidate = makePlayer({ id: 200, element_type: 3, team: 6, now_cost: 60, ep_next: '7.0', form: '7.0', web_name: 'ValidPick' })

    const allPlayers = [...squadMids, ...club5Candidates, validCandidate]
    const ctx = makeCtx(squadMids, allPlayers)
    const weakspots = findWeakSpots(squadMids, ctx.picks.picks, ctx.allFixtures, ctx.bootstrap, 1)
    const plan = buildTransferPlan(weakspots, ctx)

    expect(plan.save).toBe(false)
    expect(plan.transfers[0]!.topPick.player.id).toBe(200)

    // All 3 club-5 candidates should appear as replans
    const replanText = plan.transfers[0]!.replans.join(' ')
    expect(replanText).toContain('Club5A')
    expect(replanText).toContain('Club5B')
    expect(replanText).toContain('Club5C')

    // Trace should contain replan entries
    const replanSteps = plan.trace.filter(s => s.replan)
    expect(replanSteps.length).toBeGreaterThanOrEqual(3)
  })

  it('checks two transfers jointly and returns both when both improve the squad', () => {
    // Squad: 15 MIDs from teams 1–15. Two weakest: id=1 and id=2.
    const squad = Array.from({ length: 15 }, (_, i) =>
      makePlayer({ id: i + 1, element_type: 3, team: i + 1, now_cost: 80, ep_next: `${(i + 1).toFixed(1)}`, form: `${(i + 1).toFixed(1)}` }),
    )
    const c1 = makePlayer({ id: 99, element_type: 3, team: 20, now_cost: 80, ep_next: '12.0', form: '12.0' })
    const c2 = makePlayer({ id: 98, element_type: 3, team: 21, now_cost: 80, ep_next: '11.0', form: '11.0' })

    const ctx = makeCtx(squad, [...squad, c1, c2], { freeTransfers: 2 })
    const weakspots = findWeakSpots(squad, ctx.picks.picks, ctx.allFixtures, ctx.bootstrap, 2)
    const plan = buildTransferPlan(weakspots, ctx)

    expect(plan.save).toBe(false)
    expect(plan.transfers).toHaveLength(2)
    expect(plan.transfers[0]!.sell.player.id).toBe(1)
    expect(plan.transfers[1]!.sell.player.id).toBe(2)
  })
})
