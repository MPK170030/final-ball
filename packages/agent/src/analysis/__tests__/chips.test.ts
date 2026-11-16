import { describe, it, expect } from 'vitest'
import { computeChipAdvice } from '../chips.js'
import type { AgentContext } from '../../context.js'
import type { BootstrapChip } from '../../fpl/types.js'
import { makePlayer, makeBootstrap, makeFixtures, makePick } from './helpers.js'

// ── Bootstrap chips (mirrors real FPL API structure) ──────────────────────────

const CHIPS_H1: BootstrapChip[] = [
  { id: 1, name: 'wildcard', number: 1, start_event: 2,  stop_event: 19, chip_type: 'transfer' },
  { id: 3, name: 'freehit',  number: 1, start_event: 2,  stop_event: 19, chip_type: 'transfer' },
  { id: 4, name: 'bboost',   number: 1, start_event: 1,  stop_event: 19, chip_type: 'team'     },
  { id: 5, name: '3xc',      number: 1, start_event: 1,  stop_event: 19, chip_type: 'team'     },
]
const CHIPS_H2: BootstrapChip[] = [
  { id: 2, name: 'wildcard', number: 2, start_event: 20, stop_event: 38, chip_type: 'transfer' },
  { id: 6, name: 'freehit',  number: 2, start_event: 20, stop_event: 38, chip_type: 'transfer' },
  { id: 7, name: 'bboost',   number: 2, start_event: 20, stop_event: 38, chip_type: 'team'     },
  { id: 8, name: '3xc',      number: 2, start_event: 20, stop_event: 38, chip_type: 'team'     },
]
const ALL_CHIPS = [...CHIPS_H1, ...CHIPS_H2]

// ── Context builder ───────────────────────────────────────────────────────────

function makeCtx(opts: {
  gwId?: number
  usedChipNames?: string[]
  doubleTeams?: number[]  // inject a DGW for these teams in GW15
}): AgentContext {
  const gwId = opts.gwId ?? 10
  const teamCount = 20

  const squadPlayers = [
    makePlayer({ id: 1,  element_type: 1, team: 1,  now_cost: 50, ep_next: '5.0' }),
    makePlayer({ id: 2,  element_type: 2, team: 2,  now_cost: 55, ep_next: '4.0' }),
    makePlayer({ id: 3,  element_type: 2, team: 3,  now_cost: 50, ep_next: '4.0' }),
    makePlayer({ id: 4,  element_type: 2, team: 4,  now_cost: 50, ep_next: '4.0' }),
    makePlayer({ id: 5,  element_type: 3, team: 5,  now_cost: 75, ep_next: '5.0' }),
    makePlayer({ id: 6,  element_type: 3, team: 6,  now_cost: 75, ep_next: '5.0' }),
    makePlayer({ id: 7,  element_type: 3, team: 7,  now_cost: 75, ep_next: '5.0' }),
    makePlayer({ id: 8,  element_type: 3, team: 8,  now_cost: 75, ep_next: '7.0' }),
    // Player 9 has the highest ep_next (9.0) → always selected as TC candidate
    makePlayer({ id: 9,  element_type: 4, team: 9,  now_cost: 90, ep_next: '9.0' }),
    makePlayer({ id: 10, element_type: 4, team: 10, now_cost: 85, ep_next: '7.0' }),
    makePlayer({ id: 11, element_type: 4, team: 11, now_cost: 80, ep_next: '6.0' }),
    makePlayer({ id: 12, element_type: 1, team: 12, now_cost: 45, ep_next: '4.0' }),
    makePlayer({ id: 13, element_type: 3, team: 13, now_cost: 45, ep_next: '3.0' }),
    makePlayer({ id: 14, element_type: 2, team: 14, now_cost: 45, ep_next: '3.5' }),
    makePlayer({ id: 15, element_type: 4, team: 15, now_cost: 45, ep_next: '3.5' }),
  ]

  const bootstrap = makeBootstrap({ gwIds: [gwId], nextGwId: gwId, players: squadPlayers })
  bootstrap.chips = ALL_CHIPS
  bootstrap.teams = Array.from({ length: teamCount }, (_, i) => ({
    id: i + 1, short_name: `T${i + 1}`, name: `Team ${i + 1}`, code: i + 1,
    draw: 0, form: null, loss: 0, played: gwId - 1, points: 20, position: i + 1,
    team_division: null, unavailable: false, win: gwId - 1,
    strength: 3, strength_overall_home: 3, strength_overall_away: 3,
    strength_attack_home: 3, strength_attack_away: 3,
    strength_defence_home: 3, strength_defence_away: 3, pulse_id: i + 1,
  }))

  // Build fixtures: each of 20 teams plays a single home fixture in GW10–19
  const doubleTeams = new Set(opts.doubleTeams ?? [])
  const allFixtures = Array.from({ length: teamCount }, (_, i) => {
    const teamId = i + 1
    const gws = Array.from({ length: 10 }, (_, j) => ({
      gwId: gwId + j,
      fdr: 3,
      double: doubleTeams.has(teamId) && gwId + j === 15,
    }))
    return makeFixtures(teamId, gws)
  }).flat()

  const picks = [
    makePick(1, 1),
    makePick(2, 2), makePick(3, 3), makePick(4, 4),
    makePick(5, 5), makePick(6, 6), makePick(7, 7), makePick(8, 8),
    makePick(9, 9), makePick(10, 10), makePick(11, 11),
    makePick(12, 12), makePick(13, 13), makePick(14, 14), makePick(15, 15),
  ]

  const usedChips = (opts.usedChipNames ?? []).map((name, i) => ({
    name,
    event: gwId - 2 - i,
    time: '2026-10-01T07:00:00.000Z',
  }))

  return {
    bootstrap,
    allFixtures,
    gameweek: bootstrap.events[0]!,
    picks: {
      active_chip: null,
      automatic_subs: [],
      entry_history: {
        event: gwId, points: 50, total_points: 400, rank: null, rank_sort: null,
        overall_rank: 50000, percentile_rank: null, bank: 10, value: 1000,
        event_transfers: 1, event_transfers_cost: 0, points_on_bench: 3,
      },
      picks,
    },
    bank: 20,
    freeTransfers: 1,
    squadPlayers,
    squadByClub: new Map(squadPlayers.map(p => [p.team, 1])),
    usedChips,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computeChipAdvice', () => {
  describe('GW10, no chips used, no special GWs', () => {
    it('returns 8 status entries: 4 playable + 4 future', () => {
      const ctx = makeCtx({})
      const result = computeChipAdvice(ctx)

      expect(result.status).toHaveLength(8)

      const playable = result.status.filter(s => s.playable)
      const future   = result.status.filter(s => !s.playable && !s.used)

      expect(playable).toHaveLength(4)
      expect(future).toHaveLength(4)
    })

    it('playable chips are all H1 names and have used=false', () => {
      const ctx = makeCtx({})
      const { status } = computeChipAdvice(ctx)
      const playableNames = status.filter(s => s.playable).map(s => s.name).sort()
      expect(playableNames).toEqual(['3xc', 'bboost', 'freehit', 'wildcard'])
      expect(status.filter(s => s.used)).toHaveLength(0)
    })

    it('future chips have correct window (GW20+)', () => {
      const ctx = makeCtx({})
      const { status } = computeChipAdvice(ctx)
      const future = status.filter(s => !s.playable && !s.used)
      expect(future.every(s => s.window.startEvent === 20)).toBe(true)
    })

    it('specialGws is empty when fixture list has no blanks or doubles', () => {
      const ctx = makeCtx({})
      expect(computeChipAdvice(ctx).specialGws).toHaveLength(0)
    })

    it('timing has 4 entries — one for each playable chip', () => {
      const ctx = makeCtx({})
      const { timing } = computeChipAdvice(ctx)
      expect(timing).toHaveLength(4)
      expect(timing.map(t => t.chip).sort()).toEqual(['3xc', 'bboost', 'freehit', 'wildcard'])
    })

    it('BB and FH advice contain "no confirmed" when no special GWs exist', () => {
      const ctx = makeCtx({})
      const { timing } = computeChipAdvice(ctx)
      const bb = timing.find(t => t.chip === 'bboost')!
      const fh = timing.find(t => t.chip === 'freehit')!
      expect(bb.recommendation).toMatch(/no confirmed double/i)
      expect(fh.recommendation).toMatch(/no confirmed/i)
    })

    it('all timing advice has provisional=true (D5.7)', () => {
      const ctx = makeCtx({})
      const { timing } = computeChipAdvice(ctx)
      expect(timing.every(t => t.provisional)).toBe(true)
    })
  })

  describe('used chip', () => {
    it('a used H1 wildcard is marked used and not playable', () => {
      const ctx = makeCtx({ usedChipNames: ['wildcard'] })
      const { status } = computeChipAdvice(ctx)
      const wc = status.find(s => s.name === 'wildcard' && s.window.startEvent === 2)!
      expect(wc.used).toBe(true)
      expect(wc.playable).toBe(false)
      expect(wc.usedInEvent).toBeDefined()
    })

    it('used chip is excluded from timing advice', () => {
      const ctx = makeCtx({ usedChipNames: ['wildcard'] })
      const { timing } = computeChipAdvice(ctx)
      expect(timing.find(t => t.chip === 'wildcard')).toBeUndefined()
      expect(timing).toHaveLength(3)
    })

    it('H2 wildcard remains playable after H1 wildcard is used', () => {
      const ctx = makeCtx({ usedChipNames: ['wildcard'] })
      const { status } = computeChipAdvice(ctx)
      const h2wc = status.find(s => s.name === 'wildcard' && s.window.startEvent === 20)!
      expect(h2wc.used).toBe(false)
      expect(h2wc.playable).toBe(false) // H2 not yet open at GW10
    })
  })

  describe('synthetic DGW (GW15, teams 9 and 10 double)', () => {
    it('detects the DGW in specialGws', () => {
      const ctx = makeCtx({ doubleTeams: [9, 10] })
      const { specialGws } = computeChipAdvice(ctx)
      const dgw = specialGws.find(sg => sg.gwId === 15)
      expect(dgw).toBeDefined()
      expect(dgw!.dgwTeamCount).toBeGreaterThanOrEqual(2)
    })

    it('BB advice targets GW15 when 2+ squad players have a DGW (teams 9 and 10)', () => {
      // Players id=9 (team 9) and id=10 (team 10) both play twice in GW15
      const ctx = makeCtx({ doubleTeams: [9, 10] })
      const { timing } = computeChipAdvice(ctx)
      const bb = timing.find(t => t.chip === 'bboost')!
      expect(bb.targetGwId).toBe(15)
      expect(bb.recommendation).toMatch(/GW15/)
    })

    it('TC advice targets GW15 when best captain (player 9, team 9, ep=9.0) has a DGW', () => {
      // Player id=9 has ep_next=9.0 — the clear highest in the starting XI
      const ctx = makeCtx({ doubleTeams: [9, 10] })
      const { timing } = computeChipAdvice(ctx)
      const tc = timing.find(t => t.chip === '3xc')!
      expect(tc.targetGwId).toBe(15)
      expect(tc.recommendation).toMatch(/GW15/)
    })
  })

  describe('expiry nudge (D5.3)', () => {
    it('shows nudge at GW12 (7 GWs before H1 stop at GW19)', () => {
      const ctx = makeCtx({ gwId: 12 })
      const { expiryNudge } = computeChipAdvice(ctx)
      expect(expiryNudge).toBeDefined()
      expect(expiryNudge).toMatch(/GW19/)
    })

    it('no nudge when all H1 chips already used', () => {
      const ctx = makeCtx({ gwId: 12, usedChipNames: ['wildcard', 'freehit', 'bboost', '3xc'] })
      const { expiryNudge } = computeChipAdvice(ctx)
      expect(expiryNudge).toBeUndefined()
    })

    it('no nudge early in season (GW1, 19 GWs until expiry)', () => {
      // gwsUntilExpiry = 19 - 1 + 1 = 19 > 8 → no nudge
      const ctx = makeCtx({ gwId: 1 })
      const { expiryNudge } = computeChipAdvice(ctx)
      expect(expiryNudge).toBeUndefined()
    })
  })
})
