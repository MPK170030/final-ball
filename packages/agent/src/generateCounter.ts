import Anthropic from '@anthropic-ai/sdk'
import type { AgentContext } from './context.js'
import type { Player } from './fpl/types.js'
import type { TraceEntry } from './trace.js'
import { numberSteps } from './trace.js'
import type { TraceStep } from './trace.js'
import { getUpcomingGwIds } from './analysis/fixtures.js'

// ── Counter card input types (framework-agnostic; populated by the API route) ─

export interface TransferCounterCard {
  type: 'transfer'
  save: false
  gameweek: number
  sellPlayerName: string
  sellPlayerPos: 'GK' | 'DEF' | 'MID' | 'FWD'
  topPickName: string
  topPickRiskTag: string
  topPickReason: string
  topPickWhy: { form: string; fixtures: string; price: string; risks: string }
  alternatives: Array<{ name: string; riskTag: string; reason: string }>
  whySell: string
}

export interface SaveCounterCard {
  type: 'transfer'
  save: true
  gameweek: number
  saveReason: string
  bestOptionName?: string
  bestOptionReason?: string
}

export interface CaptainCounterCard {
  type: 'captain'
  gameweek: number
  captainName: string
  captainRiskTag: string
  captainReason: string
  captainWhy: { form: string; fixture: string; risks: string }
  vcName: string
  vcRiskTag: string
  vcReason: string
  alternatives: Array<{ name: string; riskTag: string; reason: string }>
}

export type CounterCard = TransferCounterCard | SaveCounterCard | CaptainCounterCard

// ── Counter result types ──────────────────────────────────────────────────────

export type CounterOutcome = 'held' | 'changed_fact' | 'accepted_preference' | 'declined'

export interface CounterNewPick {
  playerName: string
  reason: string
}

export interface CounterResult {
  outcome: CounterOutcome
  response: string
  /** Only set when outcome is 'changed_fact'. */
  newPick?: CounterNewPick
  trace: TraceStep[]
  usage: { inputTokens: number; outputTokens: number }
}

// ── Internal model I/O ────────────────────────────────────────────────────────

interface SubmitOutcomeInput {
  outcome: CounterOutcome
  response: string
  newPick?: CounterNewPick
}

// ── Position helpers ──────────────────────────────────────────────────────────

const TYPE_TO_POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
const POS_TO_TYPE: Record<string, number> = { GK: 1, DEF: 2, MID: 3, FWD: 4 }

// ── Player lookup ─────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findPlayer(name: string, elements: Player[]): Player | null {
  const norm = normalizeName(name)
  return (
    elements.find(p => normalizeName(p.web_name) === norm) ??
    elements.find(p => normalizeName(p.web_name).includes(norm)) ??
    elements.find(p => norm.includes(normalizeName(p.web_name))) ??
    null
  )
}

// ── Tool implementations ──────────────────────────────────────────────────────

function toolGetPlayer(name: string, ctx: AgentContext): string {
  const player = findPlayer(name, ctx.bootstrap.elements)
  if (!player) return `Player "${name}" not found.`

  const teamById = new Map(ctx.bootstrap.teams.map(t => [t.id, t]))
  const team = teamById.get(player.team)
  const pos = TYPE_TO_POS[player.element_type] ?? '?'
  const ep = player.ep_next !== null
    ? `${parseFloat(player.ep_next).toFixed(1)} pts projected next week`
    : `form ${player.form}`
  const avail =
    player.chance_of_playing_next_round !== null
      ? `${player.chance_of_playing_next_round}% fit`
      : 'fully fit'

  const [gwId] = getUpcomingGwIds(ctx.bootstrap, 1)
  let nextFix = 'no fixture'
  if (gwId !== undefined) {
    const matches = ctx.allFixtures.filter(
      f => f.event === gwId && (f.team_h === player.team || f.team_a === player.team),
    )
    if (matches.length > 0) {
      const segs = matches.map(m => {
        const isHome = m.team_h === player.team
        const opp = teamById.get(isHome ? m.team_a : m.team_h)?.short_name ?? '?'
        const fdr = isHome ? m.team_h_difficulty : m.team_a_difficulty
        const diff = fdr <= 2 ? 'easy' : fdr === 3 ? 'average' : 'tough'
        return `${isHome ? 'home' : 'away'} vs ${opp} (${diff})`
      })
      nextFix = matches.length > 1 ? `plays twice: ${segs.join(' + ')}` : segs[0]!
    }
  }

  const lines = [
    `${player.web_name} | ${pos} | ${team?.name ?? 'unknown'} | £${(player.now_cost / 10).toFixed(1)}m`,
    `${ep} | recent form: ${player.form} | ${avail} | next fixture: ${nextFix}`,
  ]
  if (player.news) lines.push(`News: ${player.news}`)
  return lines.join('\n')
}

function toolGetFixtures(teamName: string, n: number, ctx: AgentContext): string {
  const norm = normalizeName(teamName)
  const team =
    ctx.bootstrap.teams.find(t => normalizeName(t.name) === norm) ??
    ctx.bootstrap.teams.find(t => normalizeName(t.short_name) === norm) ??
    ctx.bootstrap.teams.find(t => normalizeName(t.name).includes(norm)) ??
    null
  if (!team) return `Team "${teamName}" not found.`

  const teamById = new Map(ctx.bootstrap.teams.map(t => [t.id, t]))
  const upcoming = ctx.allFixtures
    .filter(
      f =>
        f.event !== null &&
        f.event >= (ctx.gameweek.id ?? 0) &&
        (f.team_h === team.id || f.team_a === team.id),
    )
    .sort((a, b) => (a.event ?? 0) - (b.event ?? 0))
    .slice(0, Math.min(n, 5))

  if (upcoming.length === 0) return `${team.name} have no upcoming fixtures found.`

  const rows = upcoming.map(f => {
    const isHome = f.team_h === team.id
    const opp = teamById.get(isHome ? f.team_a : f.team_h)?.short_name ?? '?'
    const fdr = isHome ? f.team_h_difficulty : f.team_a_difficulty
    const diff = fdr <= 2 ? 'easy' : fdr === 3 ? 'average' : 'tough'
    return `GW${f.event}: ${isHome ? 'home' : 'away'} vs ${opp} (${diff})`
  })
  return `${team.name} next ${upcoming.length} fixture${upcoming.length > 1 ? 's' : ''}:\n${rows.join('\n')}`
}

function toolCompare(nameA: string, nameB: string, ctx: AgentContext): string {
  const infoA = toolGetPlayer(nameA, ctx)
  const infoB = toolGetPlayer(nameB, ctx)
  return `### ${nameA}\n${infoA}\n\n### ${nameB}\n${infoB}`
}

function toolSearchCandidates(position: string, maxPriceMns: number, ctx: AgentContext): string {
  const posType = POS_TO_TYPE[position.toUpperCase()]
  if (!posType) return `Unknown position "${position}". Use GK, DEF, MID, or FWD.`

  const ownedIds = new Set(ctx.squadPlayers.map(p => p.id))
  const budget = Math.round(maxPriceMns * 10)

  const candidates = ctx.bootstrap.elements
    .filter(
      p =>
        p.element_type === posType &&
        !ownedIds.has(p.id) &&
        p.now_cost <= budget &&
        p.status !== 'u' &&
        p.status !== 'n',
    )
    .sort((a, b) => {
      const epA = a.ep_next !== null ? parseFloat(a.ep_next) : parseFloat(a.form) * 0.9
      const epB = b.ep_next !== null ? parseFloat(b.ep_next) : parseFloat(b.form) * 0.9
      return epB - epA
    })
    .slice(0, 10)

  if (candidates.length === 0) return `No available ${position} candidates under £${maxPriceMns.toFixed(1)}m.`

  const rows = candidates.map((p, i) => {
    const ep = p.ep_next !== null ? `${parseFloat(p.ep_next).toFixed(1)} pts projected` : `form ${p.form}`
    const avail =
      p.chance_of_playing_next_round !== null
        ? `${p.chance_of_playing_next_round}% fit`
        : 'fully fit'
    const news = p.news ? ` | ${p.news}` : ''
    return `${i + 1}. ${p.web_name} | £${(p.now_cost / 10).toFixed(1)}m | ${ep} | ${avail}${news}`
  })
  return `Top ${position} candidates under £${maxPriceMns.toFixed(1)}m (not in your squad):\n${rows.join('\n')}`
}

function toolCheckConstraints(sellName: string, buyName: string, ctx: AgentContext): string {
  const sellPlayer = findPlayer(sellName, ctx.squadPlayers)
  if (!sellPlayer) return `"${sellName}" is not in your squad and cannot be sold.`

  const buyPlayer = findPlayer(buyName, ctx.bootstrap.elements)
  if (!buyPlayer) return `"${buyName}" not found in the player database.`

  if (buyPlayer.id === sellPlayer.id) return 'Cannot sell and buy the same player.'

  if (buyPlayer.element_type !== sellPlayer.element_type) {
    const buyPos = TYPE_TO_POS[buyPlayer.element_type] ?? '?'
    const sellPos = TYPE_TO_POS[sellPlayer.element_type] ?? '?'
    return `Position mismatch: ${sellPlayer.web_name} is a ${sellPos} but ${buyPlayer.web_name} is a ${buyPos}.`
  }

  const sellPrice =
    ctx.picks.picks.find(p => p.element === sellPlayer.id)?.selling_price ?? sellPlayer.now_cost
  const budget = sellPrice + ctx.bank
  if (buyPlayer.now_cost > budget) {
    return `Cannot afford ${buyPlayer.web_name} (£${(buyPlayer.now_cost / 10).toFixed(1)}m). Budget after selling ${sellPlayer.web_name}: £${(budget / 10).toFixed(1)}m.`
  }

  // Club limit: check how many from buy player's club are in the squad after selling
  const ownedFromBuyClub = ctx.squadPlayers.filter(
    p => p.team === buyPlayer.team && p.id !== sellPlayer.id,
  ).length
  if (ownedFromBuyClub >= 3) {
    const teamName =
      ctx.bootstrap.teams.find(t => t.id === buyPlayer.team)?.short_name ?? 'that club'
    return `Club limit: already have 3 players from ${teamName} after selling ${sellPlayer.web_name}.`
  }

  if (ctx.freeTransfers < 1) return 'No free transfers available.'

  return `✓ ${sellPlayer.web_name} → ${buyPlayer.web_name} is valid. £${(buyPlayer.now_cost / 10).toFixed(1)}m; £${((budget - buyPlayer.now_cost) / 10).toFixed(1)}m left in bank.`
}

function executeToolCall(
  name: string,
  input: Record<string, unknown>,
  ctx: AgentContext,
): string {
  switch (name) {
    case 'get_player':
      return toolGetPlayer(String(input['name'] ?? ''), ctx)
    case 'get_fixtures':
      return toolGetFixtures(String(input['team'] ?? ''), Number(input['n'] ?? 3), ctx)
    case 'compare':
      return toolCompare(String(input['playerA'] ?? ''), String(input['playerB'] ?? ''), ctx)
    case 'search_candidates':
      return toolSearchCandidates(String(input['position'] ?? ''), Number(input['max_price'] ?? 10), ctx)
    case 'check_constraints':
      return toolCheckConstraints(String(input['sell'] ?? ''), String(input['buy'] ?? ''), ctx)
    default:
      return `Unknown tool: ${name}`
  }
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const COUNTER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_player',
    description:
      'Look up a player by name. Returns their current status, news, form, projected points, price, and next fixture.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "The player's web name or full name." },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_fixtures',
    description: "Get a team's next fixtures, with difficulty.",
    input_schema: {
      type: 'object',
      properties: {
        team: { type: 'string', description: 'Team name or short name.' },
        n: { type: 'number', description: 'Number of upcoming fixtures to return (1–5). Defaults to 3.' },
      },
      required: ['team'],
    },
  },
  {
    name: 'compare',
    description: 'Compare two players side-by-side on form, projected points, fixtures, and price.',
    input_schema: {
      type: 'object',
      properties: {
        playerA: { type: 'string' },
        playerB: { type: 'string' },
      },
      required: ['playerA', 'playerB'],
    },
  },
  {
    name: 'search_candidates',
    description:
      'Find available players at a position within a price limit who are not in your squad.',
    input_schema: {
      type: 'object',
      properties: {
        position: { type: 'string', enum: ['GK', 'DEF', 'MID', 'FWD'] },
        max_price: { type: 'number', description: 'Maximum price in £m (e.g. 8.5).' },
      },
      required: ['position', 'max_price'],
    },
  },
  {
    name: 'check_constraints',
    description:
      'Check whether a proposed transfer is valid: budget, 3-per-club limit, position match, free transfers.',
    input_schema: {
      type: 'object',
      properties: {
        sell: { type: 'string', description: 'Name of the player to sell (must be in your squad).' },
        buy: { type: 'string', description: 'Name of the player to buy.' },
      },
      required: ['sell', 'buy'],
    },
  },
  {
    name: 'submit_counter_outcome',
    description: 'Submit your final answer to the counter. Call this once per counter.',
    input_schema: {
      type: 'object',
      properties: {
        outcome: {
          type: 'string',
          enum: ['held', 'changed_fact', 'accepted_preference', 'declined'],
          description:
            'held = data still supports the original pick; changed_fact = a tool check found new data that changes the advice; accepted_preference = user expressed a preference, not a fact; declined = off-topic counter',
        },
        response: {
          type: 'string',
          description:
            '1–3 plain-English sentences shown to the manager. Lead with: "Still [action]:" (held), "New pick:" (changed_fact), "Your call:" (accepted_preference), or a polite one-liner (declined).',
        },
        newPick: {
          type: 'object',
          description: 'Required when outcome is changed_fact.',
          properties: {
            playerName: { type: 'string' },
            reason: { type: 'string', description: 'One sentence on why this is now the better pick.' },
          },
          required: ['playerName', 'reason'],
        },
      },
      required: ['outcome', 'response'],
    },
  },
]

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Final Ball's counter agent for Fantasy Premier League. A manager has pushed back on a recommendation card.

Your job:
1. If the counter is off-topic (not about this specific pick): call submit_counter_outcome immediately with outcome="declined" and a polite one-liner. Use no other tools.
2. For any on-topic counter: call at least one data tool (get_player, get_fixtures, compare, search_candidates, check_constraints) to verify the facts before answering.
3. After investigating, call submit_counter_outcome with exactly one outcome:
   - "held": the data still supports the original recommendation
   - "changed_fact": a tool call revealed data that changes the advice — name the new best pick
   - "accepted_preference": the manager is expressing a preference, not a factual claim — acknowledge it and give the best move given their constraint

Rules:
- Never treat a preference as a fact. "I want to keep X" or "I prefer Y" is not evidence. Acknowledge preferences honestly.
- For "accepted_preference": investigate what the best alternative is given the constraint (e.g. if they want to keep the sell candidate, check who else is weak).
- Write 1–3 clear sentences in the response. Lead with the outcome label.
- Plain English only: no ep_next, FDR, BLK, DGW. Translate everything: "projected X pts next week", "easy home vs Wolves", "plays twice this week", "carrying a knock (75% fit)".`

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildInitialPrompt(
  card: CounterCard,
  quickReply: string | null,
  message: string,
): string {
  const lines: string[] = []

  if (card.type === 'transfer' && !card.save) {
    lines.push(`GW${card.gameweek} — Transfer recommendation`)
    lines.push('')
    lines.push(`Sell: ${card.sellPlayerName} (${card.sellPlayerPos})`)
    lines.push(`Why sell: ${card.whySell}`)
    lines.push('')
    lines.push(`Top pick [${card.topPickRiskTag}]: ${card.topPickName}`)
    lines.push(`Reason: ${card.topPickReason}`)
    lines.push(`Why: form — ${card.topPickWhy.form}; fixtures — ${card.topPickWhy.fixtures}; price — ${card.topPickWhy.price}; risks — ${card.topPickWhy.risks}`)
    if (card.alternatives.length > 0) {
      lines.push('')
      lines.push('Alternatives:')
      for (const alt of card.alternatives) {
        lines.push(`  - ${alt.name} [${alt.riskTag}]: ${alt.reason}`)
      }
    }
  } else if (card.type === 'transfer' && card.save) {
    lines.push(`GW${card.gameweek} — Save the transfer`)
    lines.push('')
    lines.push(`Reason: ${card.saveReason}`)
    if (card.bestOptionName) {
      lines.push(`Best option if transferring: ${card.bestOptionName}${card.bestOptionReason ? ` — ${card.bestOptionReason}` : ''}`)
    }
  } else if (card.type === 'captain') {
    lines.push(`GW${card.gameweek} — Captain recommendation`)
    lines.push('')
    lines.push(`Captain [${card.captainRiskTag}]: ${card.captainName}`)
    lines.push(`Reason: ${card.captainReason}`)
    lines.push(`Why: form — ${card.captainWhy.form}; fixture — ${card.captainWhy.fixture}; risks — ${card.captainWhy.risks}`)
    lines.push('')
    lines.push(`VC [${card.vcRiskTag}]: ${card.vcName} — ${card.vcReason}`)
    if (card.alternatives.length > 0) {
      lines.push('')
      lines.push('Alternatives:')
      for (const alt of card.alternatives) {
        lines.push(`  - ${alt.name} [${alt.riskTag}]: ${alt.reason}`)
      }
    }
  }

  lines.push('')
  lines.push('---')
  if (quickReply) lines.push(`Quick reply: "${quickReply}"`)
  lines.push(`Manager's counter: ${message}`)

  return lines.join('\n')
}

// ── changed_fact validation ───────────────────────────────────────────────────

function getStartingXiIds(ctx: AgentContext): Set<number> {
  return new Set(
    ctx.picks.picks
      .filter(p => p.position >= 1 && p.position <= 11)
      .map(p => p.element),
  )
}

function validateChangedFact(
  result: SubmitOutcomeInput,
  card: CounterCard,
  ctx: AgentContext,
  trace: TraceEntry[],
): SubmitOutcomeInput {
  if (!result.newPick?.playerName) {
    trace.push({ title: 'Validation', text: 'changed_fact missing newPick — degrading to held.' })
    return { outcome: 'held', response: 'The original recommendation still stands.' }
  }

  const player = findPlayer(result.newPick.playerName, ctx.bootstrap.elements)
  if (!player) {
    trace.push({ title: 'Validation', text: `New pick "${result.newPick.playerName}" not found — degrading to held.` })
    return { outcome: 'held', response: `Could not verify "${result.newPick.playerName}" — the original recommendation stands.` }
  }

  if (card.type === 'captain') {
    const startingXiIds = getStartingXiIds(ctx)
    if (!startingXiIds.has(player.id)) {
      trace.push({ title: 'Validation', text: `${player.web_name} not in starting XI — degrading to held.` })
      return {
        outcome: 'held',
        response: `${player.web_name} is not in the starting XI — the original captain recommendation stands.`,
      }
    }
  } else if (card.type === 'transfer' && !card.save) {
    const constraintMsg = toolCheckConstraints(card.sellPlayerName, player.web_name, ctx)
    if (!constraintMsg.startsWith('✓')) {
      trace.push({ title: 'Validation', text: `Constraint check failed: ${constraintMsg} — degrading to held.` })
      return { outcome: 'held', response: `${player.web_name} fails a constraint (${constraintMsg.split('.')[0]}) — the original recommendation stands.` }
    }
  }

  trace.push({ title: 'Validation', text: `New pick ${player.web_name} validated.` })
  return { ...result, newPick: { playerName: player.web_name, reason: result.newPick.reason } }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Runs the counter loop for one card (D17.5).
 * - Rejects off-topic counters immediately.
 * - Requires at least one data tool call before submitting an outcome.
 * - Validates changed_fact outcomes in code (player exists and passes constraints).
 * - Cap: MAX_DATA_CALLS data tool calls max; on exhaust forces a conclusion.
 */
export async function generateCounter(
  card: CounterCard,
  quickReply: string | null,
  message: string,
  ctx: AgentContext,
  opts?: { onProgress?: (step: string) => void },
): Promise<CounterResult> {
  const trace: TraceEntry[] = []
  const usage = { inputTokens: 0, outputTokens: 0 }
  const onProgress = opts?.onProgress ?? (() => {})

  const model = process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-6'
  const client = new Anthropic()

  trace.push({
    title: 'Counter started',
    text: `GW${card.gameweek} ${card.type} card. Counter: "${message.slice(0, 100)}${message.length > 100 ? '…' : ''}"`,
  })

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildInitialPrompt(card, quickReply, message) },
  ]

  const MAX_DATA_CALLS = 6
  let dataCallCount = 0
  let hasInvestigated = false
  let rejectedSkipOnce = false

  while (true) {
    const forceConclusion = dataCallCount >= MAX_DATA_CALLS

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: COUNTER_TOOLS,
      tool_choice: forceConclusion
        ? { type: 'tool', name: 'submit_counter_outcome' }
        : { type: 'any' },
      messages,
    }
    let response: Anthropic.Message
    try {
      response = await client.messages.create(params)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      trace.push({ title: 'Error', text: `Model call failed: ${msg}` })
      return {
        outcome: 'held',
        response: 'Unable to process your counter right now — the original recommendation stands.',
        trace: numberSteps(trace),
        usage,
      }
    }

    usage.inputTokens += response.usage.input_tokens
    usage.outputTokens += response.usage.output_tokens

    const outcomeBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_counter_outcome',
    )

    if (outcomeBlock) {
      const raw = outcomeBlock.input as SubmitOutcomeInput

      // Guard: must investigate before concluding (not for declined or forced conclusion)
      if (!forceConclusion && !rejectedSkipOnce && raw.outcome !== 'declined' && !hasInvestigated) {
        rejectedSkipOnce = true
        trace.push({ title: 'Guard', text: 'Model tried to conclude without investigating — asking it to re-check.' })
        onProgress('Re-checking the data...')
        messages.push({ role: 'assistant', content: response.content })
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: outcomeBlock.id,
              content:
                'You must call at least one data tool (get_player, get_fixtures, compare, search_candidates, or check_constraints) to verify the counter before submitting your answer.',
              is_error: true,
            },
          ],
        })
        continue
      }

      // Validate changed_fact outcomes in code (D17.5)
      const validated =
        raw.outcome === 'changed_fact'
          ? validateChangedFact(raw, card, ctx, trace)
          : raw

      trace.push({
        title: 'Counter outcome',
        text: `${validated.outcome}${validated.newPick ? ` → ${validated.newPick.playerName}` : ''}: "${validated.response.slice(0, 120)}"`,
      })
      trace.push({ title: 'Tokens used', text: `${usage.inputTokens} input / ${usage.outputTokens} output.` })

      return {
        outcome: validated.outcome,
        response: validated.response,
        newPick: validated.newPick,
        trace: numberSteps(trace),
        usage,
      }
    }

    // Execute data tool calls
    const dataCalls = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )

    if (dataCalls.length === 0) {
      // Model returned text-only (shouldn't happen with tool_choice:any)
      break
    }

    messages.push({ role: 'assistant', content: response.content })
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const call of dataCalls) {
      onProgress(`Checking ${call.name.replace(/_/g, ' ')}...`)
      const result = executeToolCall(call.name, call.input as Record<string, unknown>, ctx)
      trace.push({ title: `Tool: ${call.name}`, text: result.slice(0, 400) })
      toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: result })
      dataCallCount++
      hasInvestigated = true
    }

    messages.push({ role: 'user', content: toolResults })
  }

  trace.push({ title: 'Fallback', text: 'Loop ended without outcome — original recommendation stands.' })
  return {
    outcome: 'held',
    response: 'The original recommendation still stands.',
    trace: numberSteps(trace),
    usage,
  }
}
