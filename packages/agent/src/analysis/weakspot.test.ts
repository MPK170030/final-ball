import { describe, it, expect } from 'vitest'
import { findWeakSpots } from './weakspot.js'
import { makePlayer, makeBootstrap, makeFixtures, makePick } from './__tests__/helpers.js'

// 15 outfield players (MIDs, teams 1–15) with linearly increasing ep_next/form.
// All cost £8.0m and face FDR 3 in all 3 GWs, so ranking == pts ranking.
function makeSquad() {
  return Array.from({ length: 15 }, (_, i) =>
    makePlayer({
      id: i + 1,
      element_type: 3,
      team: i + 1,
      now_cost: 80,
      ep_next: `${(i + 1).toFixed(1)}`,
      form: `${(i + 1).toFixed(1)}`,
    }),
  )
}

function makeSquadFixtures(players: ReturnType<typeof makeSquad>) {
  return players.flatMap(p =>
    makeFixtures(p.team, [
      { gwId: 8, fdr: 3 },
      { gwId: 9, fdr: 3 },
      { gwId: 10, fdr: 3 },
    ]),
  )
}

const BOOTSTRAP = makeBootstrap({ gwIds: [7, 8, 9, 10], nextGwId: 8 })

describe('findWeakSpots', () => {
  it('returns the single weakest player as the sell candidate with 1 free transfer', () => {
    const squad = makeSquad()
    const picks = squad.map((p, i) => makePick(p.id, i + 1))
    const fixtures = makeSquadFixtures(squad)

    const result = findWeakSpots(squad, picks, fixtures, BOOTSTRAP, 1)

    expect(result.sellCandidates).toHaveLength(1)
    expect(result.sellCandidates[0]!.player.id).toBe(1) // id=1 has lowest ep_next
    expect(result.sellCandidates[0]!.squadRank).toBe(1)
  })

  it('returns the 2 weakest players as sell candidates with 2 free transfers', () => {
    const squad = makeSquad()
    const picks = squad.map((p, i) => makePick(p.id, i + 1))
    const fixtures = makeSquadFixtures(squad)

    const result = findWeakSpots(squad, picks, fixtures, BOOTSTRAP, 2)

    expect(result.sellCandidates).toHaveLength(2)
    expect(result.sellCandidates[0]!.player.id).toBe(1)
    expect(result.sellCandidates[1]!.player.id).toBe(2)
  })

  it('always returns the top 3 for the Why-sell context regardless of free transfers', () => {
    const squad = makeSquad()
    const picks = squad.map((p, i) => makePick(p.id, i + 1))
    const fixtures = makeSquadFixtures(squad)

    const result = findWeakSpots(squad, picks, fixtures, BOOTSTRAP, 1)

    expect(result.whySellContext).toHaveLength(3)
    expect(result.whySellContext.map(ws => ws.player.id)).toEqual([1, 2, 3])
  })

  it('floor prevents bench GK from dominating the sell list (D17.3)', () => {
    // Bench GK with near-zero score that would rank #1 without the floor
    const backupGk = makePlayer({
      id: 100,
      element_type: 1,
      team: 20,
      now_cost: 45, // £4.5m
      ep_next: '0.1',
      form: '0.1',
    })
    // 14 outfield players with slightly higher pts/£m than the post-floor GK
    const outfield = Array.from({ length: 14 }, (_, i) =>
      makePlayer({
        id: i + 1,
        element_type: 3,
        team: i + 1,
        now_cost: 80,
        ep_next: '0.5',
        form: '0.5',
      }),
    )

    // squad: outfield positions 1–11 (starters) + bench GK at 12 + more bench
    const squad = [...outfield.slice(0, 11), backupGk, ...outfield.slice(11)]
    const picks = squad.map((p, i) => makePick(p.id, i + 1))

    const gkFixtures = makeFixtures(20, [{ gwId: 8, fdr: 3 }, { gwId: 9, fdr: 3 }, { gwId: 10, fdr: 3 }])
    const outfieldFixtures = outfield.flatMap(p =>
      makeFixtures(p.team, [{ gwId: 8, fdr: 3 }, { gwId: 9, fdr: 3 }, { gwId: 10, fdr: 3 }]),
    )

    const result = findWeakSpots(squad, picks, [...gkFixtures, ...outfieldFixtures], BOOTSTRAP, 1)

    // Without floor, GK would score ~0.2 pts on £4.5m = 0.04 pts/£m → rank #1 (weakest).
    // With floor at 2.0 pts, GK ranks at 2.0/4.5 = 0.44 pts/£m.
    // Outfield players score ~1.0 pts on £8.0m = 0.125 pts/£m → they are weaker.
    // So the sell candidate should be an outfield player, not the GK.
    expect(result.sellCandidates[0]!.player.id).not.toBe(100)
    expect(result.sellCandidates[0]!.player.element_type).toBe(3)
  })
})
