import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateCaptain } from './generateCaptain.js'
import type { AgentContext } from './context.js'
import type { GenerateTransfersResult } from './generateTransfers.js'
import type { Player } from './fpl/types.js'
import {
  makePlayer,
  makeBootstrap,
  makeFixtures,
  makePick,
} from './analysis/__tests__/helpers.js'

// ── Anthropic SDK mock ─────────────────────────────────────────────────────────
// Mocked at the module level so no real API calls are made.

vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn()
  const MockAnthropic = vi.fn(() => ({
    messages: { create: mockCreate },
  }))
  return { default: MockAnthropic, __mockCreate: mockCreate }
})

async function getMockCreate() {
  const mod = await import('@anthropic-ai/sdk')
  // @ts-expect-error — accessing the exported mock handle
  return mod.__mockCreate as ReturnType<typeof vi.fn>
}

// ── Shared fixtures ────────────────────────────────────────────────────────────

/** Returns a minimal AgentContext with an 11-player starting XI + 4 bench. */
function makeCtx(opts?: { swapGkId?: number }): AgentContext {
  // GK on bench (position 12) — should be excluded from captain candidates
  const gk = makePlayer({ id: 1, element_type: 1, team: 1, now_cost: 50, ep_next: '5.0', web_name: 'Keeper' })
  // 10 outfield starters (ids 2–11)
  const starters: Player[] = Array.from({ length: 10 }, (_, i) => {
    const id = i + 2
    return makePlayer({
      id,
      element_type: id <= 5 ? 2 : id <= 8 ? 3 : 4,
      team: id,
      now_cost: 80 + i * 5,
      ep_next: String(9.0 - i * 0.5), // id=2 → ep 9.0, id=11 → ep 4.5
      web_name: `Player${id}`,
    })
  })
  // Bench (positions 12–15)
  const bench: Player[] = Array.from({ length: 4 }, (_, i) => {
    const id = i + 12
    return makePlayer({ id, element_type: i === 0 ? 1 : 3, team: id, now_cost: 45, ep_next: '2.0', web_name: `Bench${id}` })
  })

  const allPlayers = [gk, ...starters, ...bench]
  const bootstrap = makeBootstrap({ gwIds: [8, 9, 10], nextGwId: 8, players: allPlayers })
  // Add fake teams so fixtureDisplay can look them up
  bootstrap.teams = allPlayers.map(p => ({
    id: p.team,
    short_name: `TM${p.team}`,
    name: `Team ${p.team}`,
    code: p.team, draw: 0, form: null, loss: 0, played: 7, points: 14, position: p.team,
    team_division: null, unavailable: false, win: 7,
    strength: 3, strength_overall_home: 3, strength_overall_away: 3,
    strength_attack_home: 3, strength_attack_away: 3,
    strength_defence_home: 3, strength_defence_away: 3,
    pulse_id: p.team,
  }))

  const allFixtures = allPlayers.flatMap(p =>
    makeFixtures(p.team, [{ gwId: 8, fdr: 3 }, { gwId: 9, fdr: 2 }, { gwId: 10, fdr: 4 }]),
  )

  const picks = [
    makePick(1, 12), // GK on bench
    ...starters.map((p, i) => makePick(p.id, i + 1)),
    ...bench.slice(1).map((p, i) => makePick(p.id, i + 13)),
  ]

  return {
    bootstrap,
    allFixtures,
    gameweek: bootstrap.events[0]!,
    picks: {
      active_chip: null,
      automatic_subs: [],
      entry_history: {
        event: 8, points: 50, total_points: 400, rank: null, rank_sort: null,
        overall_rank: 50000, percentile_rank: null, bank: 10, value: 1000,
        event_transfers: 1, event_transfers_cost: 0, points_on_bench: 3,
      },
      picks,
    },
    bank: 10,
    freeTransfers: 1,
    squadPlayers: allPlayers,
    squadByClub: new Map(allPlayers.map(p => [p.team, 1])),
  }
}

function makeNoTransferResult(): GenerateTransfersResult {
  return {
    save: true,
    saveReason: 'No meaningful improvement available.',
    transfers: [],
    trace: [],
    meta: { gameweekId: 8, freeTransfers: 1, bank: 10, elapsedMs: 0, usage: { inputTokens: 0, outputTokens: 0 } },
  }
}

function makeTransferResult(sellId: number, buyPlayer: Player): GenerateTransfersResult {
  const sell = {
    player: makePlayer({ id: sellId, element_type: 3, team: sellId, now_cost: 80, web_name: `Player${sellId}` }),
    score: { total: 4.0, perGw: [], epNext: 2.0, form: 2.0, availability: 1.0 },
    squadRank: 1,
    rankScore: 0.5,
  }
  const topPick = {
    player: buyPlayer,
    score: { total: 12.0, perGw: [], epNext: 7.0, form: 5.0, availability: 1.0 },
    valueScore: 1.5,
  }
  return {
    save: false,
    transfers: [{ sell, sellingPrice: 80, topPick, topPickReason: 'Great value.', topPickWhy: { form: '', fixtures: '', price: '', risks: '' }, alternatives: [], whySell: 'Poor form.', swapReason: 'Upgrade.', replans: [] }],
    trace: [{ n: 1, title: 'Transfer', text: `Sell Player${sellId} → buy ${buyPlayer.web_name}.` }],
    meta: { gameweekId: 8, freeTransfers: 1, bank: 10, elapsedMs: 0, usage: { inputTokens: 0, outputTokens: 0 } },
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('generateCaptain', () => {
  beforeEach(async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockReset()
  })

  it('returns captain, vc, and at least 1 alternative from the model output', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce({
      usage: { input_tokens: 200, output_tokens: 100 },
      content: [
        {
          type: 'tool_use',
          input: {
            captain: { name: 'Player2', reason: 'Best ep_next in the squad.', why: { form: 'Excellent form.', fixture: 'vs TM99 (H) FDR 3', risks: 'None identified' } },
            vc: { name: 'Player3', reason: 'Second best expected points.', why: { form: 'Good form.', fixture: 'vs TM100 (H) FDR 3', risks: 'None identified' } },
            alternatives: [
              { name: 'Player4', reason: 'Differential option.', why: { form: 'Decent form.', fixture: 'vs TM101 (H) FDR 2', risks: 'None identified' } },
            ],
          },
        },
      ],
    })

    const result = await generateCaptain(makeCtx(), makeNoTransferResult())

    expect(result.captain.player.web_name).toBe('Player2')
    expect(result.vc.player.web_name).toBe('Player3')
    expect(result.alternatives).toHaveLength(1)
    expect(result.alternatives[0]!.player.web_name).toBe('Player4')
    expect(result.captain.reason).toMatch(/Best ep_next/)
    expect(result.captain.why.form).toBeTruthy()
    expect(result.captain.why.fixture).toBeTruthy()
    expect(result.captain.why.risks).toBeTruthy()
  })

  it('excludes GKs from the captain shortlist', async () => {
    const mockCreate = await getMockCreate()
    // Return "Keeper" (id=1, GK) as captain — should be rejected as not in shortlist
    mockCreate.mockResolvedValueOnce({
      usage: { input_tokens: 150, output_tokens: 80 },
      content: [
        {
          type: 'tool_use',
          input: {
            captain: { name: 'Keeper', reason: 'High ep_next.', why: { form: 'Good.', fixture: 'vs X', risks: 'None' } },
            vc: { name: 'Player2', reason: 'Good pick.', why: { form: 'Good.', fixture: 'vs Y', risks: 'None' } },
            alternatives: [],
          },
        },
      ],
    })

    const result = await generateCaptain(makeCtx(), makeNoTransferResult())

    // Keeper not in the shortlist → replan → falls back to Player2 (highest ep_next)
    expect(result.captain.player.element_type).not.toBe(1) // not a GK
    expect(result.trace.some(t => t.replan)).toBe(true)
  })

  it('applies transfer and can captain the incoming player (D4.4)', async () => {
    // Sell Player5 (starting pos 4) and bring in HighEpPlayer (ep_next 15.0)
    const highEpPlayer = makePlayer({
      id: 99,
      element_type: 3,
      team: 99,
      now_cost: 90,
      ep_next: '15.0',
      web_name: 'HighEpPlayer',
    })

    const ctx = makeCtx()
    ctx.bootstrap.elements.push(highEpPlayer)
    ctx.bootstrap.teams.push({
      id: 99, short_name: 'HEP', name: 'HEP Team', code: 99, draw: 0, form: null,
      loss: 0, played: 7, points: 14, position: 99, team_division: null, unavailable: false,
      win: 7, strength: 3, strength_overall_home: 3, strength_overall_away: 3,
      strength_attack_home: 3, strength_attack_away: 3, strength_defence_home: 3,
      strength_defence_away: 3, pulse_id: 99,
    })
    ctx.allFixtures.push(...makeFixtures(99, [{ gwId: 8, fdr: 1 }, { gwId: 9, fdr: 1 }, { gwId: 10, fdr: 1 }]))

    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce({
      usage: { input_tokens: 180, output_tokens: 90 },
      content: [
        {
          type: 'tool_use',
          input: {
            captain: { name: 'HighEpPlayer', reason: 'Incredible ep_next.', why: { form: 'On fire.', fixture: 'vs HEP FDR 1', risks: 'None identified' } },
            vc: { name: 'Player2', reason: 'Backup option.', why: { form: 'Good.', fixture: 'vs TM2', risks: 'None' } },
            alternatives: [],
          },
        },
      ],
    })

    const result = await generateCaptain(ctx, makeTransferResult(5, highEpPlayer))

    expect(result.captain.player.web_name).toBe('HighEpPlayer')
    // Trace should note the incoming player is the captain
    expect(result.trace.some(t => t.title === 'Captain is incoming player')).toBe(true)
  })

  it('uses deterministic fallback when model call throws', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockRejectedValueOnce(new Error('Network error'))

    const result = await generateCaptain(makeCtx(), makeNoTransferResult())

    // Fallback: Player2 has ep_next 9.0 (highest non-GK)
    expect(result.captain.player.web_name).toBe('Player2')
    expect(result.vc.player.web_name).toBe('Player3')
    expect(result.trace.some(t => t.title === 'Fallback')).toBe(true)
  })

  it('uses deterministic fallback when model returns no tool block', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce({
      usage: { input_tokens: 100, output_tokens: 0 },
      content: [{ type: 'text', text: 'I suggest Salah.' }],
    })

    const result = await generateCaptain(makeCtx(), makeNoTransferResult())

    expect(result.captain.player.web_name).toBe('Player2') // top by ep_next
    expect(result.trace.some(t => t.title === 'Fallback')).toBe(true)
  })

  it('replans when model picks the same player for captain and vc', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce({
      usage: { input_tokens: 150, output_tokens: 80 },
      content: [
        {
          type: 'tool_use',
          input: {
            captain: { name: 'Player2', reason: 'Top pick.', why: { form: 'Good.', fixture: 'vs X', risks: 'None' } },
            vc: { name: 'Player2', reason: 'Still top pick.', why: { form: 'Good.', fixture: 'vs X', risks: 'None' } },
            alternatives: [],
          },
        },
      ],
    })

    const result = await generateCaptain(makeCtx(), makeNoTransferResult())

    expect(result.captain.player.id).not.toBe(result.vc.player.id)
    expect(result.trace.some(t => t.replan)).toBe(true)
  })

  it('calls messages.create with temperature: 0 (D10.7)', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce({
      usage: { input_tokens: 200, output_tokens: 100 },
      content: [
        {
          type: 'tool_use',
          input: {
            captain: { name: 'Player2', reason: 'Best ep_next.', why: { form: 'Good.', fixture: 'vs X', risks: 'None' } },
            vc: { name: 'Player3', reason: 'Second best.', why: { form: 'OK.', fixture: 'vs Y', risks: 'None' } },
            alternatives: [],
          },
        },
      ],
    })

    await generateCaptain(makeCtx(), makeNoTransferResult())

    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0 }),
    )
  })

  it('adds trace steps at each phase', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce({
      usage: { input_tokens: 200, output_tokens: 100 },
      content: [
        {
          type: 'tool_use',
          input: {
            captain: { name: 'Player2', reason: 'Best.', why: { form: 'Good.', fixture: 'vs X', risks: 'None' } },
            vc: { name: 'Player3', reason: 'Second.', why: { form: 'OK.', fixture: 'vs Y', risks: 'None' } },
            alternatives: [],
          },
        },
      ],
    })

    const result = await generateCaptain(makeCtx(), makeNoTransferResult())

    const titles = result.trace.map(t => t.title)
    expect(titles).toContain('Post-transfer squad')
    expect(titles).toContain('Captain candidates')
    expect(titles).toContain('Model captain ranking')
    expect(titles).toContain('Tokens used')
    expect(titles).toContain('Captain result')
  })
})
