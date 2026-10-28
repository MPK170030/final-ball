import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rankWithModel } from './rank.js'
import type { AgentContext } from '../context.js'
import type { TransferPlanResult } from './candidates.js'
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

// ── Tests ─────────────────────────────────────────────────────────────────────

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

  it('uses the deterministic fallback when model returns no tool block', async () => {
    const mockCreate = await getMockCreate()
    mockCreate.mockResolvedValueOnce({
      usage: { input_tokens: 100, output_tokens: 0 },
      content: [{ type: 'text', text: 'Sell low, buy high.' }],
    })

    const result = await rankWithModel(makeTransferPlan(), makeCtx())

    expect(result.trace.some(t => t.title === 'Fallback')).toBe(true)
  })
})
