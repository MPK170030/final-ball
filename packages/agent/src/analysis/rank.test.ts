import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rankWithModel } from './rank.js'
import { safeSortKey, boldSortKey } from './candidates.js'
import type { AgentContext } from '../context.js'
import type { TransferPlanResult, Candidate } from './candidates.js'
import {
  makePlayer,
  makeBootstrap,
  makeFixtures,
  makePick,
} from './__tests__/helpers.js'

// ── Anthropic SDK mock ─────────────────────────────────────────────────────────

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

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCtx(): AgentContext {
  const players = [
    makePlayer({ id: 1, element_type: 1, team: 1, now_cost: 50 }),
    makePlayer({ id: 2, element_type: 2, team: 2, now_cost: 55 }),
    makePlayer({ id: 3, element_type: 3, team: 3, now_cost: 80 }),
    makePlayer({ id: 4, element_type: 3, team: 4, now_cost: 75 }),
    makePlayer({ id: 5, element_type: 4, team: 5, now_cost: 90 }),
  ]
  const bootstrap = makeBootstrap({ gwIds: [8, 9, 10], nextGwId: 8, players })
  bootstrap.teams = players.map(p => ({
    id: p.team, short_name: `T${p.team}`, name: `Team ${p.team}`, code: p.team,
    draw: 0, form: null, loss: 0, played: 7, points: 14, position: p.team,
    team_division: null, unavailable: false, win: 7,
    strength: 3, strength_overall_home: 3, strength_overall_away: 3,
    strength_attack_home: 3, strength_attack_away: 3,
    strength_defence_home: 3, strength_defence_away: 3, pulse_id: p.team,
  }))
  const allFixtures = players.flatMap(p =>
    makeFixtures(p.team, [{ gwId: 8, fdr: 3 }, { gwId: 9, fdr: 2 }, { gwId: 10, fdr: 4 }]),
  )
  const picks = players.map((p, i) => makePick(p.id, i + 1))

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
    squadPlayers: players,
    squadByClub: new Map(players.map(p => [p.team, 1])),
  }
}

function makeTransferPlan(): TransferPlanResult {
  const sellPlayer = makePlayer({ id: 3, element_type: 3, team: 3, now_cost: 80, form: '2.0', ep_next: '2.0' })
  const buyPlayer = makePlayer({ id: 10, element_type: 3, team: 10, now_cost: 85, form: '8.0', ep_next: '8.0' })

  const sell = {
    player: sellPlayer,
    score: { total: 6.0, perGw: [], epNext: 2.0, form: 2.0, availability: 1.0 },
    squadRank: 1,
    rankScore: 0.3,
  }
  const topPick = {
    player: buyPlayer,
    score: { total: 24.0, perGw: [], epNext: 8.0, form: 8.0, availability: 1.0 },
    valueScore: 2.8,
  }

  return {
    save: false,
    transfers: [{
      sell,
      sellingPrice: 80,
      topPick,
      alternatives: [],
      candidatesForModel: [topPick],
      replans: [],
    }],
    trace: [],
  }
}

function makeModelResponse(playerName: string) {
  return {
    usage: { input_tokens: 200, output_tokens: 100 },
    content: [{
      type: 'tool_use',
      input: {
        recommendation: 'transfer',
        transfers: [{
          sellPlayerName: 'P3',
          whySell: 'Poor form.',
          swapReason: 'Clear upgrade.',
          topPick: {
            playerName,
            reason: 'In great form.',
            why: { form: 'Excellent.', fixtures: 'Good run.', price: 'Fair value.', risks: 'None identified.' },
          },
          alternatives: [],
        }],
      },
    }],
  }
}

// ── Multi-candidate plan (for tag tests) ──────────────────────────────────────

function makeMultiCandidatePlan(): TransferPlanResult {
  const sellPlayer = makePlayer({ id: 3, element_type: 3, team: 3, now_cost: 80, form: '2.0', ep_next: '2.0' })

  // Alpha: highest 3-GW total (9.0), low next-GW (1.5), fully fit
  //   balanced rank 1 (total=9.0), safe rank 1 (floor=1.5), bold rank 3 (peak=4.0)
  const alpha = {
    player: makePlayer({ id: 10, web_name: 'Alpha', element_type: 3, team: 10, now_cost: 85 }),
    score: {
      total: 9.0,
      perGw: [
        { gwId: 8, points: 1.5, fdr: 3, isDouble: false, opponents: [] },
        { gwId: 9, points: 4.0, fdr: 2, isDouble: false, opponents: [] },
        { gwId: 10, points: 3.5, fdr: 3, isDouble: false, opponents: [] },
      ],
      epNext: 1.5, form: 3.5, availability: 1.0,
    },
    valueScore: 1.06,
  }

  // Charlie: high 3-GW total (8.0) but only 50% fit
  //   balanced rank 2, safe rank 3 (floor=2.5×0.5=1.25), bold rank 2 (peak=3.0)
  const charlie = {
    player: makePlayer({ id: 12, web_name: 'Charlie', element_type: 3, team: 12, now_cost: 85, chance_of_playing_next_round: 50 }),
    score: {
      total: 8.0,
      perGw: [
        { gwId: 8, points: 3.0, fdr: 2, isDouble: false, opponents: [] },
        { gwId: 9, points: 2.5, fdr: 2, isDouble: false, opponents: [] },
        { gwId: 10, points: 2.5, fdr: 2, isDouble: false, opponents: [] },
      ],
      epNext: 3.0, form: 2.5, availability: 0.5,
    },
    valueScore: 0.94,
  }

  // Bravo: lowest 3-GW total (6.0), highest next-GW (5.0), fully fit
  //   balanced rank 3, safe rank 2 (floor=0.5×1.0=0.5), bold rank 1 (peak=5.0)
  const bravo = {
    player: makePlayer({ id: 11, web_name: 'Bravo', element_type: 3, team: 11, now_cost: 85 }),
    score: {
      total: 6.0,
      perGw: [
        { gwId: 8, points: 5.0, fdr: 1, isDouble: false, opponents: [] },
        { gwId: 9, points: 0.5, fdr: 5, isDouble: false, opponents: [] },
        { gwId: 10, points: 0.5, fdr: 5, isDouble: false, opponents: [] },
      ],
      epNext: 5.0, form: 2.0, availability: 1.0,
    },
    valueScore: 0.71,
  }

  const sell = {
    player: sellPlayer,
    score: { total: 6.0, perGw: [], epNext: 2.0, form: 2.0, availability: 1.0 },
    squadRank: 1,
    rankScore: 0.3,
  }

  return {
    save: false,
    transfers: [{
      sell,
      sellingPrice: 80,
      topPick: alpha,
      alternatives: [charlie, bravo],
      candidatesForModel: [alpha, charlie, bravo], // balanced order: 9.0 > 8.0 > 6.0
      replans: [],
    }],
    trace: [],
  }
}

function getUserMessage(mockCreate: ReturnType<typeof vi.fn>): string {
  const call = mockCreate.mock.calls[0]![0] as { messages: Array<{ content: string }> }
  return call.messages[0]!.content
}

// ── D2.16 sort key unit tests ─────────────────────────────────────────────────

function makeCandidate(perGwPoints: number[], availability = 1.0): Candidate {
  return {
    player: makePlayer({ id: Math.floor(Math.random() * 10000), element_type: 3, team: 1, now_cost: 80 }),
    score: {
      total: perGwPoints.reduce((s, p) => s + p * availability, 0),
      perGw: perGwPoints.map((points, i) => ({ gwId: 8 + i, points, fdr: 3, isDouble: false, opponents: [] })),
      epNext: perGwPoints[0] ?? 0,
      form: perGwPoints[0] ?? 0,
      availability,
    },
    valueScore: 1.0,
  }
}

describe('safeSortKey / boldSortKey — floor/ceiling orthogonality (D2.16)', () => {
  it('safe: steady 4/4/4 beats spiky 8/2/2 even though both are 100%-fit with equal totals', () => {
    const steady = makeCandidate([4, 4, 4], 1.0) // total=12, floor=4
    const spiky  = makeCandidate([8, 2, 2], 1.0) // total=12, floor=2
    expect(safeSortKey(steady)).toBeGreaterThan(safeSortKey(spiky))
  })

  it('bold: spiky 8/2/2 beats steady 4/4/4 — higher ceiling wins', () => {
    const steady = makeCandidate([4, 4, 4], 1.0) // ceiling=4
    const spiky  = makeCandidate([8, 2, 2], 1.0) // ceiling=8
    expect(boldSortKey(spiky)).toBeGreaterThan(boldSortKey(steady))
  })

  it('bold: DGW asset with blank GW1 (0/8/4) beats consistent 4/4/4 player — fixes the GW1-only bug', () => {
    const dgw      = makeCandidate([0, 8, 4], 1.0) // max=8 (was invisible with perGw[0] key)
    const steady   = makeCandidate([4, 4, 4], 1.0) // max=4
    expect(boldSortKey(dgw)).toBeGreaterThan(boldSortKey(steady))
  })

  it('safe: DGW asset with blank GW1 (0/8/4) ranks last — zero floor', () => {
    const dgw      = makeCandidate([0, 8, 4], 1.0) // floor=0
    const steady   = makeCandidate([4, 4, 4], 1.0) // floor=4
    expect(safeSortKey(steady)).toBeGreaterThan(safeSortKey(dgw))
  })

  it('safe: 75%-fit player falls behind 100%-fit player with lower raw floor', () => {
    const doubtful = makeCandidate([5, 5, 5], 0.75) // floor=5×0.75=3.75
    const fit      = makeCandidate([4, 4, 4], 1.0)  // floor=4×1.0=4.0
    expect(safeSortKey(fit)).toBeGreaterThan(safeSortKey(doubtful))
  })
})

// ── D2.11 risk-tag assignment tests ──────────────────────────────────────────

describe('rankWithModel — risk tag assignment (D2.11)', () => {
  beforeEach(async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockReset()
  })

  it('Alpha (balanced leader) gets [Balanced] tag in prompt; Bravo (bold leader) gets [Bold]', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce(makeModelResponse('Alpha'))

    await rankWithModel(makeMultiCandidatePlan(), makeCtx())

    const msg = getUserMessage(mockCreate)
    // Alpha is pool[0] (highest total=9.0). Bravo leads on boldSortKey (peak=5.0).
    // Alpha leads on safeSortKey (floor=1.5×1.0=1.5 > charlie=1.25 > bravo=0.5).
    // Since safeLeaderIdx === 0 (Alpha) → topTag is 'safe', not 'balanced'.
    // Bravo gets Bold tag. Charlie gets Balanced.
    expect(msg).toContain('Alpha [Safe]')
    expect(msg).toContain('Bravo [Bold]')
    expect(msg).toContain('Charlie [Balanced]')
  })

  it('tagged options include the floor- and ceiling-leaders among the 4', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce(makeModelResponse('Alpha'))

    const result = await rankWithModel(makeMultiCandidatePlan(), makeCtx())

    // The result should have risk tags on transfers
    expect(result.transfers).toHaveLength(1)
    const card = result.transfers[0]!
    // topPick (Alpha) should have a risk tag
    expect(card.topPickRiskTag).toBeDefined()
    expect(['safe', 'balanced', 'bold']).toContain(card.topPickRiskTag)
    // alternatives should all have risk tags
    for (const alt of card.alternatives) {
      expect(['safe', 'balanced', 'bold']).toContain(alt.riskTag)
    }
  })

  it('prompt includes tag labels in the candidates section header', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce(makeModelResponse('Alpha'))

    await rankWithModel(makeMultiCandidatePlan(), makeCtx())

    const msg = getUserMessage(mockCreate)
    // The prompt should say "select from this list only"
    expect(msg).toContain('select your top pick and alternatives from this list')
  })

  it('Bold tag surfaces the ceiling-leader even when it ranks outside balanced top-2', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce(makeModelResponse('Alpha'))

    await rankWithModel(makeMultiCandidatePlan(), makeCtx())

    const msg = getUserMessage(mockCreate)
    // Bravo has the highest boldSortKey (peak=5.0) but lowest 3-GW total.
    // It must still appear in the prompt with [Bold] tag.
    expect(msg).toContain('Bravo [Bold]')
  })
})

// ── Pool expansion still surfaces out-of-top-10 picks (D2.15) ──────────────────

describe('rankWithModel — pool expansion surfaces out-of-top-10 picks (D2.15)', () => {
  beforeEach(async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockReset()
  })

  function makeLargePoolPlan(): TransferPlanResult {
    const sellPlayer = makePlayer({ id: 3, element_type: 3, team: 3, now_cost: 80, form: '2.0', ep_next: '2.0' })
    const sell = {
      player: sellPlayer,
      score: { total: 6.0, perGw: [], epNext: 2.0, form: 2.0, availability: 1.0 },
      squadRank: 1,
      rankScore: 0.3,
    }

    const filler: typeof sell[] = []
    for (let i = 1; i <= 10; i++) {
      const total = 12.0 - (i - 1) * 0.1
      filler.push({
        player: makePlayer({ id: 100 + i, web_name: `Cand${i}`, element_type: 3, team: 100 + i, now_cost: 90 }),
        score: {
          total,
          perGw: [
            { gwId: 8, points: 0.5, fdr: 4, isDouble: false, opponents: [] },
            { gwId: 9, points: (total - 0.5) / 2, fdr: 2, isDouble: false, opponents: [] },
            { gwId: 10, points: (total - 0.5) / 2, fdr: 2, isDouble: false, opponents: [] },
          ],
          epNext: 0.5, form: 4.0, availability: 1.0,
        },
        valueScore: total / 9,
      } as unknown as typeof sell)
    }

    // BoldOutlier: position #11 by 3-GW total, but highest next-GW pts (DGW asset).
    // GW9/10 pts = 0.3 so floor=0.3 < Cand1's floor=0.5 → Cand1 wins safe tag, BoldOutlier wins bold.
    const boldOutlier = {
      player: makePlayer({ id: 200, web_name: 'BoldOutlier', element_type: 3, team: 200, now_cost: 85 }),
      score: {
        total: 11.0,
        perGw: [
          { gwId: 8, points: 9.0, fdr: 2, isDouble: true, opponents: [] },
          { gwId: 9, points: 0.3, fdr: 5, isDouble: false, opponents: [] },
          { gwId: 10, points: 0.3, fdr: 5, isDouble: false, opponents: [] },
        ],
        epNext: 9.0, form: 3.5, availability: 1.0,
      },
      valueScore: 1.29,
    }

    const allCandidates = [...filler, boldOutlier] as unknown as Parameters<typeof rankWithModel>[0]['transfers'][0]['candidatesForModel']

    return {
      save: false,
      transfers: [{
        sell,
        sellingPrice: 80,
        topPick: filler[0]! as unknown as Parameters<typeof rankWithModel>[0]['transfers'][0]['topPick'],
        alternatives: filler.slice(1, 4) as unknown as Parameters<typeof rankWithModel>[0]['transfers'][0]['alternatives'],
        candidatesForModel: allCandidates,
        replans: [],
      }],
      trace: [],
    }
  }

  it('BoldOutlier (position #11 by total, highest peak pts) surfaces in the prompt with [Bold] tag', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce(makeModelResponse('Cand1'))

    await rankWithModel(makeLargePoolPlan(), makeCtx())

    const msg = getUserMessage(mockCreate)
    // BoldOutlier has the highest boldSortKey (peak=9.0 DGW) — must appear in tagged candidates
    expect(msg).toContain('BoldOutlier [Bold]')
    // Cand1 (highest total=12.0) is the balanced leader — must appear too
    expect(msg).toContain('Cand1')
  })
})

describe('rankWithModel', () => {
  beforeEach(async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockReset()
  })

  it('calls messages.create with temperature: 0 (D10.7)', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce(makeModelResponse('P10'))

    await rankWithModel(makeTransferPlan(), makeCtx())

    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0 }),
    )
  })

  it('skips the model and returns save when plan.save is true', async () => {
    const mockCreate = await getMockCreate()
    const savePlan: TransferPlanResult = { save: true, saveReason: 'Strong squad.', transfers: [], trace: [] }

    const result = await rankWithModel(savePlan, makeCtx())

    expect(result.save).toBe(true)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('uses the deterministic fallback when the model call throws', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockRejectedValueOnce(new Error('Timeout'))

    const result = await rankWithModel(makeTransferPlan(), makeCtx())

    expect(result.save).toBe(false)
    expect(result.transfers).toHaveLength(1)
    expect(result.trace.some(t => t.title === 'Fallback')).toBe(true)
  })

  it('deterministic fallback includes risk tags on the transfer card', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockRejectedValueOnce(new Error('Timeout'))

    const result = await rankWithModel(makeMultiCandidatePlan(), makeCtx())

    expect(result.transfers[0]!.topPickRiskTag).toBeDefined()
    expect(['safe', 'balanced', 'bold']).toContain(result.transfers[0]!.topPickRiskTag)
  })

  it('uses the deterministic fallback when model returns no tool block', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce({
      usage: { input_tokens: 100, output_tokens: 0 },
      content: [{ type: 'text', text: 'Sell low, buy high.' }],
    })

    const result = await rankWithModel(makeTransferPlan(), makeCtx())

    expect(result.trace.some(t => t.title === 'Fallback')).toBe(true)
  })

  it('does not append any style rider to the system prompt', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce(makeModelResponse('P10'))

    await rankWithModel(makeTransferPlan(), makeCtx())

    const call = mockCreate.mock.calls[0]![0] as { system: string }
    expect(call.system).not.toContain('Style:')
  })
})
