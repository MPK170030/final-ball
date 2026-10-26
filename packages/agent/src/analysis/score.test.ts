import { describe, it, expect } from 'vitest'
import { scorePlayer } from './score.js'
import { makePlayer, makeBootstrap, makeFixtures } from './__tests__/helpers.js'

// Bootstrap and fixtures shared across tests: GW8 is next, GW9 and GW10 follow.
// Club 1 has fixtures in all 3 GWs (FDR 3 / 2 / 4).
const BOOTSTRAP = makeBootstrap({
  gwIds: [7, 8, 9, 10],
  nextGwId: 8,
})
const FIXTURES_CLUB1 = makeFixtures(1, [
  { gwId: 8, fdr: 3 },
  { gwId: 9, fdr: 2 },
  { gwId: 10, fdr: 4 },
])

describe('scorePlayer', () => {
  it('scores across 3 GWs using ep_next for GW1 and form × fdrMultiplier for GW2+', () => {
    const player = makePlayer({ id: 1, element_type: 3, team: 1, now_cost: 80, ep_next: '5.0', form: '4.0' })
    const result = scorePlayer(player, FIXTURES_CLUB1, BOOTSTRAP)

    // GW8 (i=0): ep_next * availability = 5.0 * 1.0
    expect(result.perGw[0]!.points).toBeCloseTo(5.0)
    // GW9 (i=1): form * fdrMultiplier(2) * 1.0 = 4.0 * 0.75 = 3.0
    expect(result.perGw[1]!.points).toBeCloseTo(3.0)
    // GW10 (i=2): form * fdrMultiplier(4) * 1.0 = 4.0 * 0.25 = 1.0
    expect(result.perGw[2]!.points).toBeCloseTo(1.0)
    expect(result.total).toBeCloseTo(9.0)
  })

  it('applies availability to all GWs', () => {
    const player = makePlayer({
      id: 2,
      element_type: 3,
      team: 1,
      now_cost: 80,
      ep_next: '5.0',
      form: '4.0',
      chance_of_playing_next_round: 75,
    })
    const result = scorePlayer(player, FIXTURES_CLUB1, BOOTSTRAP)

    // GW8: 5.0 * 0.75 = 3.75
    expect(result.perGw[0]!.points).toBeCloseTo(3.75)
    // GW9: 4.0 * 0.75 * 0.75 = 2.25
    expect(result.perGw[1]!.points).toBeCloseTo(2.25)
    expect(result.availability).toBeCloseTo(0.75)
  })

  it('scores 0 for a blank gameweek', () => {
    const fixtures = makeFixtures(1, [
      { gwId: 8, fdr: 3 },
      // GW9: blank — no fixture
      { gwId: 10, fdr: 2 },
    ])
    const player = makePlayer({ id: 3, element_type: 3, team: 1, now_cost: 80, ep_next: '5.0', form: '4.0' })
    const result = scorePlayer(player, fixtures, BOOTSTRAP)

    expect(result.perGw[0]!.points).toBeCloseTo(5.0)
    expect(result.perGw[1]!.points).toBe(0)
    expect(result.perGw[1]!.fdr).toBeNull()
    expect(result.perGw[2]!.points).toBeCloseTo(3.0) // form * fdrMultiplier(2) = 4.0 * 0.75
  })

  it('doubles GW2/3 points for a double gameweek', () => {
    const fixtures = makeFixtures(1, [
      { gwId: 8, fdr: 3 },
      { gwId: 9, fdr: 2, double: true },
      { gwId: 10, fdr: 4 },
    ])
    const player = makePlayer({ id: 4, element_type: 3, team: 1, now_cost: 80, ep_next: '5.0', form: '4.0' })
    const result = scorePlayer(player, fixtures, BOOTSTRAP)

    // GW9 double: base = form * fdrMultiplier(2) = 4.0 * 0.75 = 3.0, doubled = 6.0
    expect(result.perGw[1]!.points).toBeCloseTo(6.0)
    expect(result.perGw[1]!.isDouble).toBe(true)
  })

  it('falls back to form × 0.9 when ep_next is null', () => {
    const player = makePlayer({
      id: 5,
      element_type: 3,
      team: 1,
      now_cost: 80,
      ep_next: null,
      form: '4.0',
    })
    const result = scorePlayer(player, FIXTURES_CLUB1, BOOTSTRAP)

    // GW8: form * 0.9 * 1.0 = 3.6
    // maxEp = ppg * 3 * fdrMultiplier(3) = 4.0 * 3 * 0.5 = 6.0; 3.6 < 6.0 → no cap
    expect(result.perGw[0]!.points).toBeCloseTo(3.6)
    expect(result.epNext).toBeCloseTo(3.6)
  })

  it('caps ep_next and form when a player had one exceptional game far above their ppg', () => {
    // Reproduces the Henderson scenario: one 12-pt game gives form=12 and high ep_next,
    // but the player's season ppg is only 3.0. Without the cap they over-rank badly.
    const player = makePlayer({
      id: 6,
      element_type: 3,
      team: 1,
      now_cost: 45,
      form: '12.0',
      ep_next: '6.0',
      points_per_game: '3.0',
    })
    const result = scorePlayer(player, FIXTURES_CLUB1, BOOTSTRAP)

    // GW8 (FDR 3): maxEp = 3.0 * 3 * fdrMultiplier(3) = 3.0 * 3 * 0.5 = 4.5
    //   ep_next 6.0 > maxEp 4.5 → capped; points = 4.5
    expect(result.perGw[0]!.points).toBeCloseTo(4.5)

    // GW9 (FDR 2): cappedForm = min(12, 3*2) = 6.0; blendedForm = 6*0.5 + 3*0.5 = 4.5
    //   points = 4.5 * fdrMultiplier(2) = 4.5 * 0.75 = 3.375
    expect(result.perGw[1]!.points).toBeCloseTo(3.375)

    // GW10 (FDR 4): points = 4.5 * fdrMultiplier(4) = 4.5 * 0.25 = 1.125
    expect(result.perGw[2]!.points).toBeCloseTo(1.125)

    expect(result.total).toBeCloseTo(9.0)
  })
})
