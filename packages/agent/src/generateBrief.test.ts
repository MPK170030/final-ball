import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateBrief } from './generateBrief.js'
import { loadContext } from './context.js'
import { findWeakSpots } from './analysis/weakspot.js'
import type { AgentContext } from './context.js'
import type { WeakspotResult, PlayerScore } from './analysis/weakspot.js'
import { makePlayer, makeBootstrap, makeFixtures, makePick } from './analysis/__tests__/helpers.js'

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

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('./context.js', () => ({ loadContext: vi.fn() }))
vi.mock('./analysis/weakspot.js', () => ({ findWeakSpots: vi.fn() }))

// ── Context builder ───────────────────────────────────────────────────────────

function makeCtx(): AgentContext {
  const squadPlayers = [
    makePlayer({ id: 1,  element_type: 1, team: 1,  now_cost: 50, web_name: 'GK',       ep_next: '5.0' }),
    makePlayer({ id: 2,  element_type: 2, team: 2,  now_cost: 55, web_name: 'Def1',     ep_next: '5.0' }),
    makePlayer({ id: 3,  element_type: 3, team: 3,  now_cost: 80, web_name: 'Sell',     ep_next: '2.0', form: '2.0' }),
    makePlayer({ id: 4,  element_type: 3, team: 4,  now_cost: 75, web_name: 'Mid2',     ep_next: '5.0' }),
    makePlayer({ id: 5,  element_type: 3, team: 5,  now_cost: 75, web_name: 'Mid3',     ep_next: '5.0' }),
    makePlayer({ id: 6,  element_type: 3, team: 6,  now_cost: 75, web_name: 'Mid4',     ep_next: '5.0' }),
    makePlayer({ id: 7,  element_type: 3, team: 7,  now_cost: 75, web_name: 'Mid5',     ep_next: '5.0' }),
    makePlayer({ id: 8,  element_type: 4, team: 8,  now_cost: 90, web_name: 'Fwd1',     ep_next: '8.0' }),
    makePlayer({ id: 9,  element_type: 4, team: 9,  now_cost: 85, web_name: 'Fwd2',     ep_next: '7.0' }),
    makePlayer({ id: 10, element_type: 4, team: 10, now_cost: 80, web_name: 'Fwd3',     ep_next: '6.0' }),
    makePlayer({ id: 11, element_type: 2, team: 11, now_cost: 55, web_name: 'Def2',     ep_next: '5.0' }),
    makePlayer({ id: 12, element_type: 1, team: 12, now_cost: 45, web_name: 'BenchGK',  ep_next: '4.0' }),
    makePlayer({ id: 13, element_type: 3, team: 13, now_cost: 45, web_name: 'BenchMid', ep_next: '3.0' }),
    makePlayer({ id: 14, element_type: 2, team: 14, now_cost: 45, web_name: 'BenchDef', ep_next: '3.5' }),
    makePlayer({ id: 15, element_type: 4, team: 15, now_cost: 45, web_name: 'BenchFwd', ep_next: '3.5' }),
  ]

  const externalPlayers = [
    makePlayer({ id: 20, element_type: 3, team: 20, now_cost: 75, web_name: 'AltMid', ep_next: '7.0', form: '6.0' }),
    makePlayer({ id: 21, element_type: 3, team: 21, now_cost: 70, web_name: 'Alt2',   ep_next: '6.0', form: '5.0' }),
    makePlayer({ id: 22, element_type: 3, team: 22, now_cost: 65, web_name: 'Alt3',   ep_next: '5.5', form: '4.5' }),
  ]

  const allPlayers = [...squadPlayers, ...externalPlayers]
  const bootstrap = makeBootstrap({ gwIds: [8, 9, 10], nextGwId: 8, players: allPlayers })
  bootstrap.teams = allPlayers.map(p => ({
    id: p.team, short_name: `T${p.team}`, name: `Team ${p.team}`, code: p.team,
    draw: 0, form: null, loss: 0, played: 7, points: 14, position: p.team,
    team_division: null, unavailable: false, win: 7,
    strength: 3, strength_overall_home: 3, strength_overall_away: 3,
    strength_attack_home: 3, strength_attack_away: 3,
    strength_defence_home: 3, strength_defence_away: 3, pulse_id: p.team,
  }))

  const allFixtures = allPlayers.flatMap(p =>
    makeFixtures(p.team, [
      { gwId: 8, fdr: 3 },
      { gwId: 9, fdr: 2 },
      { gwId: 10, fdr: 4 },
    ]),
  )

  const picks = [
    makePick(1, 1),
    makePick(2, 2), makePick(11, 3),
    makePick(3, 4), makePick(4, 5), makePick(5, 6), makePick(6, 7), makePick(7, 8),
    makePick(8, 9), makePick(9, 10), makePick(10, 11),
    makePick(12, 12), makePick(13, 13), makePick(14, 14), makePick(15, 15),
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
    bank: 20,
    freeTransfers: 1,
    squadPlayers,
    squadByClub: new Map(squadPlayers.map(p => [p.team, 1])),
  }
}

function makeWeakspots(ctx: AgentContext): WeakspotResult {
  // Sorted weakest → strongest. Sell (ep_next=2.0) ends up first.
  const sorted = [...ctx.squadPlayers].sort(
    (a, b) => parseFloat(a.ep_next ?? '4') - parseFloat(b.ep_next ?? '4'),
  )
  const ranked = sorted.map((p, i) => ({
    player: p,
    score: {
      total: 2.0 + i * 1.0,
      perGw: [
        { gwId: 8, points: (2.0 + i * 1.0) / 3, fdr: 3, isDouble: false },
        { gwId: 9, points: (2.0 + i * 1.0) / 3, fdr: 2, isDouble: false },
        { gwId: 10, points: (2.0 + i * 1.0) / 3, fdr: 4, isDouble: false },
      ],
    },
  })) as PlayerScore[]
  const n = Math.min(Math.max(ctx.freeTransfers, 1), 2)
  return { ranked, sellCandidates: ranked.slice(0, n), whySellContext: ranked.slice(0, 3) }
}

// ── Mock response helpers ─────────────────────────────────────────────────────

type ToolBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }

function makeToolResponse(tools: Array<{ id: string; name: string; input: Record<string, unknown> }>) {
  return {
    usage: { input_tokens: 100, output_tokens: 50 },
    content: tools.map(t => ({ type: 'tool_use' as const, ...t })) as ToolBlock[],
  }
}

function dataToolResponse(name: string, input: Record<string, unknown>) {
  return makeToolResponse([{ id: 'data_1', name, input }])
}

function submitBriefResponse(input: Record<string, unknown>) {
  return makeToolResponse([{ id: 'submit_1', name: 'submit_brief', input }])
}

// ── Standard submissions ───────────────────────────────────────────────────────

const VALID_CAPTAIN = {
  captain: { name: 'Fwd1', reason: 'Best fixture.', why: { form: 'Hot recently.', fixture: 'vs weak team.', risks: 'None identified.' } },
  vc:      { name: 'Fwd2', reason: 'Solid floor.',  why: { form: 'Consistent.',   fixture: 'Home game.',    risks: 'None identified.' } },
  captainAlternatives: [],
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generateBrief', () => {
  let mockCreate: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    mockCreate = await getMockCreate()
    mockCreate.mockReset()

    const ctx = makeCtx()
    vi.mocked(loadContext).mockResolvedValue(ctx)
    vi.mocked(findWeakSpots).mockReturnValue(makeWeakspots(ctx))
  })

  // ── Guard ─────────────────────────────────────────────────────────────────────

  it('guard rejects premature submit and forces at least one data tool call', async () => {
    // Model tries to submit without calling any data tool first
    mockCreate.mockResolvedValueOnce(submitBriefResponse({
      recommendation: 'save',
      saveReason: 'No clear upgrade.',
      ...VALID_CAPTAIN,
    }))
    // After guard feedback: model calls a data tool
    mockCreate.mockResolvedValueOnce(dataToolResponse('get_player', { name: 'Sell' }))
    // Then submits for real
    mockCreate.mockResolvedValueOnce(submitBriefResponse({
      recommendation: 'save',
      saveReason: 'Checked Sell — no upgrade clears the threshold.',
      ...VALID_CAPTAIN,
    }))

    const result = await generateBrief(123)

    expect(result.save).toBe(true)
    expect(mockCreate).toHaveBeenCalledTimes(3)
  })

  // ── Valid transfer ────────────────────────────────────────────────────────────

  it('valid transfer resolves with correct captain', async () => {
    mockCreate.mockResolvedValueOnce(dataToolResponse('search_candidates', { position: 'MID', max_price: 8.5 }))
    mockCreate.mockResolvedValueOnce(submitBriefResponse({
      recommendation: 'transfer',
      transfers: [{
        sellPlayerName: 'Sell',
        whySell: 'Poor form and tough run ahead.',
        swapReason: 'AltMid brings significantly better projected points.',
        topPickName: 'AltMid',
        topPickReason: 'Best-in-position within budget.',
        topPickWhy: { form: 'Scoring consistently.', fixtures: 'Easy next 3.', price: 'Good value at £7.5m.', risks: 'None identified.' },
        alternatives: [],
      }],
      ...VALID_CAPTAIN,
    }))

    const result = await generateBrief(123)

    expect(result.save).toBe(false)
    expect(result.transfers).toHaveLength(1)
    expect(result.transfers[0]!.topPick.player.web_name).toBe('AltMid')
    expect(result.captain.captain.player.web_name).toBe('Fwd1')
    expect(result.captain.vc.player.web_name).toBe('Fwd2')
  })

  // ── Bug 1: alternative reason binding ────────────────────────────────────────

  it('skipped (unresolvable) first alt does not steal reason from the second alt', async () => {
    // Ghost cannot be resolved → skipped. Alt2 is second; it must keep "Alt2 correct reason",
    // not "Ghost reason" (which is what the positional-index bug would assign).
    mockCreate.mockResolvedValueOnce(dataToolResponse('search_candidates', { position: 'MID', max_price: 8.0 }))
    mockCreate.mockResolvedValueOnce(submitBriefResponse({
      recommendation: 'transfer',
      transfers: [{
        sellPlayerName: 'Sell',
        whySell: 'Poor form.',
        swapReason: 'Better alternative available.',
        topPickName: 'AltMid',
        topPickReason: 'Best option.',
        topPickWhy: { form: 'Hot.', fixtures: 'Easy run.', price: 'Good value.', risks: 'None identified.' },
        alternatives: [
          { playerName: 'Ghost',  reason: 'Ghost reason — must not appear on Alt2' },
          { playerName: 'Alt2',   reason: 'Alt2 correct reason' },
        ],
      }],
      ...VALID_CAPTAIN,
    }))

    const result = await generateBrief(123)

    expect(result.save).toBe(false)
    const card = result.transfers[0]!
    expect(card.alternatives).toHaveLength(1)
    expect(card.alternatives[0]!.candidate.player.web_name).toBe('Alt2')
    expect(card.alternatives[0]!.reason).toBe('Alt2 correct reason')
  })

  // ── Bug 2: transfer recommendation with no cards → fallback ──────────────────

  it('transfer recommendation with no transfers falls back to deterministic', async () => {
    mockCreate.mockResolvedValueOnce(dataToolResponse('get_player', { name: 'Sell' }))
    // Model says "transfer" but omits the transfers array
    mockCreate.mockResolvedValueOnce(submitBriefResponse({
      recommendation: 'transfer',
      // transfers: intentionally absent
      ...VALID_CAPTAIN,
    }))

    const result = await generateBrief(123)

    // Deterministic fallback ran — result is still a valid brief
    expect(result).toBeDefined()
    expect(result.captain).toBeDefined()
    expect(result.meta.gameweekId).toBe(8)
  })

  // ── Captain not in starting XI → fallback ─────────────────────────────────────

  it('captain named on the bench falls back to deterministic brief', async () => {
    // BenchMid (id=13) is at position 13 — bench, not starting XI
    mockCreate.mockResolvedValueOnce(dataToolResponse('get_player', { name: 'BenchMid' }))
    mockCreate.mockResolvedValueOnce(submitBriefResponse({
      recommendation: 'save',
      saveReason: 'No upgrade available.',
      captain: { name: 'BenchMid', reason: 'High ep_next.', why: { form: 'Good.', fixture: 'Easy.', risks: 'None identified.' } },
      vc:      { name: 'Fwd1',     reason: 'Second choice.', why: { form: 'Hot.',  fixture: 'vs weak.', risks: 'None identified.' } },
      captainAlternatives: [],
    }))

    const result = await generateBrief(123)

    // Fallback ran — BenchMid must not be captain
    expect(result).toBeDefined()
    expect(result.captain.captain.player.web_name).not.toBe('BenchMid')
  })

  // ── Error handling ─────────────────────────────────────────────────────────────

  it('falls back to deterministic brief when the model call throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API timeout'))

    const result = await generateBrief(123)

    expect(result).toBeDefined()
    expect(result.captain).toBeDefined()
    expect(result.trace.some(t => t.text.includes('Model call failed'))).toBe(true)
  })
})
