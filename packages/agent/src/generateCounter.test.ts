import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateCounter } from './generateCounter.js'
import type { AgentContext } from './context.js'
import type { TransferCounterCard, CaptainCounterCard, WeakspotCounterCard } from './generateCounter.js'
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

// ── Context ───────────────────────────────────────────────────────────────────

function makeCtx(): AgentContext {
  // Starting XI: ids 1–11 (positions 1–11)
  // Bench: ids 12–15 (positions 12–15)
  // Not in squad: id=20 AltMid (MID, valid buy), id=21 Defender (DEF, wrong pos)
  const squadPlayers = [
    makePlayer({ id: 1,  element_type: 1, team: 1,  now_cost: 50, web_name: 'GK' }),
    makePlayer({ id: 2,  element_type: 2, team: 2,  now_cost: 55, web_name: 'Def1' }),
    makePlayer({ id: 3,  element_type: 3, team: 3,  now_cost: 80, web_name: 'Sell' }),
    makePlayer({ id: 4,  element_type: 3, team: 4,  now_cost: 75, web_name: 'Mid2' }),
    makePlayer({ id: 5,  element_type: 3, team: 5,  now_cost: 75, web_name: 'Mid3' }),
    makePlayer({ id: 6,  element_type: 3, team: 6,  now_cost: 75, web_name: 'Mid4' }),
    makePlayer({ id: 7,  element_type: 3, team: 7,  now_cost: 75, web_name: 'Mid5' }),
    makePlayer({ id: 8,  element_type: 4, team: 8,  now_cost: 90, web_name: 'Fwd1' }),
    makePlayer({ id: 9,  element_type: 4, team: 9,  now_cost: 85, web_name: 'Fwd2' }),
    makePlayer({ id: 10, element_type: 4, team: 10, now_cost: 80, web_name: 'Fwd3' }),
    makePlayer({ id: 11, element_type: 2, team: 11, now_cost: 55, web_name: 'Def2' }),
    // bench
    makePlayer({ id: 12, element_type: 1, team: 12, now_cost: 45, web_name: 'BenchGK' }),
    makePlayer({ id: 13, element_type: 3, team: 13, now_cost: 45, web_name: 'BenchMid' }),
    makePlayer({ id: 14, element_type: 2, team: 14, now_cost: 45, web_name: 'BenchDef' }),
    makePlayer({ id: 15, element_type: 4, team: 15, now_cost: 45, web_name: 'BenchFwd' }),
  ]

  const externalPlayers = [
    // Valid buy: same position as Sell (MID), affordable (selling Sell ~80 + bank 20 = 100 budget)
    makePlayer({ id: 20, element_type: 3, team: 20, now_cost: 75, web_name: 'AltMid', ep_next: '7.0' }),
    // Wrong position: DEF while Sell is MID
    makePlayer({ id: 21, element_type: 2, team: 21, now_cost: 60, web_name: 'Defender' }),
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
    makeFixtures(p.team, [{ gwId: 8, fdr: 3 }, { gwId: 9, fdr: 2 }, { gwId: 10, fdr: 4 }]),
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

// ── Mock response helpers ─────────────────────────────────────────────────────

type ToolBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }

function makeToolResponse(tools: Array<{ id: string; name: string; input: Record<string, unknown> }>) {
  return {
    usage: { input_tokens: 100, output_tokens: 50 },
    content: tools.map(t => ({ type: 'tool_use' as const, ...t })) as ToolBlock[],
  }
}

function submitResponse(
  outcome: string,
  response: string,
  newPick?: { playerName: string; buyPlayerName?: string; reason: string },
) {
  const input: Record<string, unknown> = { outcome, response }
  if (newPick) input['newPick'] = newPick
  return makeToolResponse([{ id: 'submit_1', name: 'submit_counter_outcome', input }])
}

function dataToolResponse(name: string, input: Record<string, unknown>) {
  return makeToolResponse([{ id: 'data_1', name, input }])
}

// ── Cards ─────────────────────────────────────────────────────────────────────

const transferCard: TransferCounterCard = {
  type: 'transfer',
  save: false,
  gameweek: 8,
  sellPlayerName: 'Sell',
  sellPlayerPos: 'MID',
  topPickName: 'AltMid',
  topPickRiskTag: 'balanced',
  topPickReason: 'Great form and fixtures.',
  topPickWhy: { form: 'Scoring consistently', fixtures: 'Easy run', price: 'Good value', risks: 'None' },
  alternatives: [],
  whySell: 'Poor recent form.',
}

const captainCard: CaptainCounterCard = {
  type: 'captain',
  gameweek: 8,
  captainName: 'Fwd1',
  captainRiskTag: 'bold',
  captainReason: 'Big fixture.',
  captainWhy: { form: 'Hot form', fixture: 'vs weak team', risks: 'None' },
  vcName: 'Fwd2',
  vcRiskTag: 'balanced',
  vcReason: 'Solid floor.',
  alternatives: [],
}

// squad players ranked weakest → strongest: Sell(id=3 MID), BenchMid(id=13 MID), BenchDef(id=14 DEF)
const weakspotCard: WeakspotCounterCard = {
  type: 'weakspot',
  gameweek: 8,
  sellPlayerName: 'Sell',
  sellPlayerPos: 'MID',
  whySell: 'Consistently poor scores and an upcoming tough run.',
  weakSpots: [
    { name: 'Sell', pos: 'MID', scoreTotal: 3.2 },
    { name: 'BenchMid', pos: 'MID', scoreTotal: 3.8 },
    { name: 'BenchDef', pos: 'DEF', scoreTotal: 4.1 },
  ],
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generateCounter', () => {
  let mockCreate: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    mockCreate = await getMockCreate()
    mockCreate.mockReset()
  })

  // ── Off-topic ────────────────────────────────────────────────────────────────

  it('returns declined for off-topic counter without calling any data tool', async () => {
    mockCreate.mockResolvedValueOnce(
      submitResponse('declined', "That's outside what I can help with for this pick.")
    )

    const result = await generateCounter(transferCard, null, 'Who should I captain in GW9?', makeCtx())

    expect(result.outcome).toBe('declined')
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  // ── Hold ─────────────────────────────────────────────────────────────────────

  it('returns held after investigating a valid counter', async () => {
    mockCreate.mockResolvedValueOnce(dataToolResponse('get_player', { name: 'AltMid' }))
    mockCreate.mockResolvedValueOnce(
      submitResponse('held', 'Still buy AltMid: the data supports the original recommendation.')
    )

    const result = await generateCounter(transferCard, null, 'Is AltMid actually good?', makeCtx())

    expect(result.outcome).toBe('held')
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  // ── Guard: forces investigation before submitting ─────────────────────────────

  it('guard rejects premature conclusion and forces investigation first', async () => {
    // Model tries to submit without having called a data tool
    mockCreate.mockResolvedValueOnce(submitResponse('held', 'Still buy AltMid.'))
    // After guard feedback: model calls a data tool
    mockCreate.mockResolvedValueOnce(dataToolResponse('get_player', { name: 'AltMid' }))
    // Then submits for real
    mockCreate.mockResolvedValueOnce(
      submitResponse('held', 'Still buy AltMid: data confirms the recommendation.')
    )

    const result = await generateCounter(transferCard, null, 'I disagree.', makeCtx())

    expect(result.outcome).toBe('held')
    expect(mockCreate).toHaveBeenCalledTimes(3)
  })

  // ── accepted_preference ───────────────────────────────────────────────────────

  it('returns accepted_preference when manager wants to keep the sell player', async () => {
    mockCreate.mockResolvedValueOnce(dataToolResponse('get_player', { name: 'Sell' }))
    mockCreate.mockResolvedValueOnce(
      submitResponse('accepted_preference', 'Your call: keeping Sell is fine if you prefer.')
    )

    const result = await generateCounter(
      transferCard,
      'Keep him',
      'Keep him · I want to hold onto Sell',
      makeCtx(),
    )

    expect(result.outcome).toBe('accepted_preference')
  })

  // ── changed_fact: valid ───────────────────────────────────────────────────────

  it('returns changed_fact with the new pick when player passes constraints', async () => {
    // AltMid (id=20) is MID, affordable (Sell ~£8.0m + £2.0m bank = £10.0m budget vs £7.5m cost), new club
    mockCreate.mockResolvedValueOnce(dataToolResponse('compare', { playerA: 'Sell', playerB: 'AltMid' }))
    mockCreate.mockResolvedValueOnce(
      submitResponse('changed_fact', 'New pick: AltMid has better upcoming fixtures.', {
        playerName: 'AltMid',
        reason: 'AltMid has an easy run of fixtures.',
      })
    )

    const result = await generateCounter(transferCard, null, 'What about AltMid instead?', makeCtx())

    expect(result.outcome).toBe('changed_fact')
    expect(result.newPick?.playerName).toBe('AltMid')
  })

  // ── changed_fact: degrade cases ───────────────────────────────────────────────

  it('degrades changed_fact to held when newPick field is missing', async () => {
    mockCreate.mockResolvedValueOnce(dataToolResponse('get_player', { name: 'AltMid' }))
    mockCreate.mockResolvedValueOnce(
      makeToolResponse([{
        id: 'submit_1',
        name: 'submit_counter_outcome',
        input: { outcome: 'changed_fact', response: 'New pick: someone good.' },
        // newPick intentionally omitted
      }])
    )

    const result = await generateCounter(transferCard, null, 'Changed my mind.', makeCtx())

    expect(result.outcome).toBe('held')
  })

  it('degrades changed_fact to held when the named player does not exist', async () => {
    mockCreate.mockResolvedValueOnce(dataToolResponse('get_player', { name: 'Ghost' }))
    mockCreate.mockResolvedValueOnce(
      submitResponse('changed_fact', 'New pick: Ghost.', {
        playerName: 'Ghost',
        reason: 'Very good player.',
      })
    )

    const result = await generateCounter(transferCard, null, 'What about Ghost?', makeCtx())

    expect(result.outcome).toBe('held')
  })

  it('degrades changed_fact to held when transfer constraint fails (wrong position)', async () => {
    // Defender is a DEF; Sell is a MID — position mismatch
    mockCreate.mockResolvedValueOnce(dataToolResponse('get_player', { name: 'Defender' }))
    mockCreate.mockResolvedValueOnce(
      submitResponse('changed_fact', 'New pick: Defender.', {
        playerName: 'Defender',
        reason: 'Defender is good.',
      })
    )

    const result = await generateCounter(transferCard, null, 'What about Defender?', makeCtx())

    expect(result.outcome).toBe('held')
  })

  it('degrades changed_fact to held when captain new pick is not in the starting XI', async () => {
    // BenchMid (id=13) is at bench position 13, not in positions 1–11
    mockCreate.mockResolvedValueOnce(dataToolResponse('get_player', { name: 'BenchMid' }))
    mockCreate.mockResolvedValueOnce(
      submitResponse('changed_fact', 'New pick: BenchMid.', {
        playerName: 'BenchMid',
        reason: 'Worth captaining.',
      })
    )

    const result = await generateCounter(captainCard, null, 'Captain BenchMid instead.', makeCtx())

    expect(result.outcome).toBe('held')
  })

  // ── Weakspot counters ─────────────────────────────────────────────────────────

  it('weakspot: returns held when sell candidate is still the weakest', async () => {
    mockCreate.mockResolvedValueOnce(dataToolResponse('compare', { playerA: 'Sell', playerB: 'BenchMid' }))
    mockCreate.mockResolvedValueOnce(
      submitResponse('held', 'Still selling Sell: they remain the weakest link in your squad.')
    )

    const result = await generateCounter(weakspotCard, null, 'Sell is performing fine', makeCtx())

    expect(result.outcome).toBe('held')
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('weakspot: returns accepted_preference when manager wants to keep the sell candidate', async () => {
    mockCreate.mockResolvedValueOnce(dataToolResponse('get_player', { name: 'BenchMid' }))
    mockCreate.mockResolvedValueOnce(
      submitResponse('accepted_preference', 'Your call: keeping Sell is fine. Next-weakest is BenchMid.')
    )

    const result = await generateCounter(
      weakspotCard,
      'I need them for cover',
      'I need them for cover · they provide depth',
      makeCtx(),
    )

    expect(result.outcome).toBe('accepted_preference')
  })

  it('weakspot: returns changed_fact with new sell + buy when squad player is weaker', async () => {
    // BenchMid (id=13, MID, £4.5m) is in squad; AltMid (id=20, MID, £7.5m) is valid buy
    // Need bank ≥ £3.0m so that BenchMid (£4.5m) + bank ≥ £7.5m (AltMid cost)
    const ctx = { ...makeCtx(), bank: 30 }
    mockCreate.mockResolvedValueOnce(dataToolResponse('compare', { playerA: 'Sell', playerB: 'BenchMid' }))
    mockCreate.mockResolvedValueOnce(
      submitResponse('changed_fact', 'New pick: BenchMid is actually weaker. Sell BenchMid and buy AltMid.', {
        playerName: 'BenchMid',
        buyPlayerName: 'AltMid',
        reason: 'BenchMid has lower projected points and no value as cover.',
      })
    )

    const result = await generateCounter(weakspotCard, null, 'Why not sell BenchMid?', ctx)

    expect(result.outcome).toBe('changed_fact')
    expect(result.newPick?.playerName).toBe('BenchMid')
    expect(result.newPick?.buyPlayerName).toBe('AltMid')
  })

  it('weakspot: degrades to held when new sell candidate is not in the squad', async () => {
    mockCreate.mockResolvedValueOnce(dataToolResponse('get_player', { name: 'Ghost' }))
    mockCreate.mockResolvedValueOnce(
      submitResponse('changed_fact', 'New pick: Ghost.', {
        playerName: 'Ghost',
        buyPlayerName: 'AltMid',
        reason: 'Ghost is weaker.',
      })
    )

    const result = await generateCounter(weakspotCard, null, 'What about Ghost?', makeCtx())

    expect(result.outcome).toBe('held')
  })

  it('weakspot: clears buyPlayerName (but keeps sell change) when buy fails constraints', async () => {
    // BenchMid is in squad (valid sell); Defender is DEF while BenchMid is MID — constraint fails
    mockCreate.mockResolvedValueOnce(dataToolResponse('compare', { playerA: 'Sell', playerB: 'BenchMid' }))
    mockCreate.mockResolvedValueOnce(
      submitResponse('changed_fact', 'Sell BenchMid, buy Defender.', {
        playerName: 'BenchMid',
        buyPlayerName: 'Defender',
        reason: 'BenchMid is weaker.',
      })
    )

    const result = await generateCounter(weakspotCard, null, 'Sell BenchMid.', makeCtx())

    expect(result.outcome).toBe('changed_fact')
    expect(result.newPick?.playerName).toBe('BenchMid')
    expect(result.newPick?.buyPlayerName).toBeUndefined()
  })

  // ── Error handling ────────────────────────────────────────────────────────────

  it('returns held with a fallback message when the model call throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API timeout'))

    const result = await generateCounter(transferCard, null, 'Is this pick correct?', makeCtx())

    expect(result.outcome).toBe('held')
    expect(result.response).toContain('original recommendation')
  })
})
