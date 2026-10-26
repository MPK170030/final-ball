import Anthropic from '@anthropic-ai/sdk'
import type { AgentContext } from './context.js'
import type { GenerateTransfersResult } from './generateTransfers.js'
import type { Player } from './fpl/types.js'
import type { TraceEntry } from './trace.js'
import { getUpcomingGwIds } from './analysis/fixtures.js'

// ── Output types ──────────────────────────────────────────────────────────────

/** Mirrors WhySection in rank.ts but scoped to captaincy: no price field. */
export interface CaptainWhySection {
  form: string
  fixture: string
  risks: string
}

export interface CaptainPick {
  player: Player
  reason: string
  why: CaptainWhySection
}

export interface CaptainResult {
  captain: CaptainPick
  vc: CaptainPick
  /** 1–2 alternatives (D4.1). */
  alternatives: CaptainPick[]
  trace: TraceEntry[]
  usage: { inputTokens: number; outputTokens: number }
}

// ── Internal model I/O types (mirror the tool schema) ─────────────────────────

interface ModelCaptainPick {
  name: string
  reason: string
  why: { form: string; fixture: string; risks: string }
}

interface ModelOutput {
  captain: ModelCaptainPick
  vc: ModelCaptainPick
  alternatives: ModelCaptainPick[]
}

// ── Deterministic shortlist ───────────────────────────────────────────────────

const POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

/**
 * Returns the starting XI after applying all suggested transfers (D4.4).
 * The incoming player takes the same position slot as the player sold.
 * If save=true the squad is unchanged.
 */
function postTransferStartingPlayers(
  ctx: AgentContext,
  transferResult: GenerateTransfersResult,
): Player[] {
  const playerById = new Map<number, Player>(ctx.bootstrap.elements.map(p => [p.id, p]))

  // Position slot → player id (copy so we can mutate)
  const posToId = new Map<number, number>(ctx.picks.picks.map(pick => [pick.position, pick.element]))

  for (const card of transferResult.transfers) {
    const sellId = card.sell.player.id
    const buyId = card.topPick.player.id
    // The topPick player may not be in the bootstrap elements map if it was filtered;
    // add it so lookups below work.
    playerById.set(buyId, card.topPick.player)
    for (const [pos, id] of posToId) {
      if (id === sellId) {
        posToId.set(pos, buyId)
        break
      }
    }
  }

  // Starting XI = positions 1–11
  const starting: Player[] = []
  for (let pos = 1; pos <= 11; pos++) {
    const id = posToId.get(pos)
    const player = id !== undefined ? playerById.get(id) : undefined
    if (player) starting.push(player)
  }
  return starting
}

/** One-line fixture summary used in the prompt and fallback text. */
function fixtureDisplay(player: Player, ctx: AgentContext): string {
  const teamById = new Map(ctx.bootstrap.teams.map(t => [t.id, t]))
  const [gwId] = getUpcomingGwIds(ctx.bootstrap, 1)
  if (!gwId) return 'no fixture'

  const matches = ctx.allFixtures.filter(
    f => f.event === gwId && (f.team_h === player.team || f.team_a === player.team),
  )
  if (matches.length === 0) return 'no fixture this week'

  const segments = matches.map(m => {
    const isHome = m.team_h === player.team
    const oppId = isHome ? m.team_a : m.team_h
    const opp = teamById.get(oppId)?.short_name ?? '???'
    const fdr = isHome ? m.team_h_difficulty : m.team_a_difficulty
    const difficulty = fdr <= 2 ? 'easy' : fdr === 3 ? 'average' : 'tough'
    return `${isHome ? 'home' : 'away'} vs ${opp} (${difficulty})`
  })

  return matches.length > 1 ? `plays twice: ${segments.join(' + ')}` : segments[0]!
}

const SHORTLIST_SIZE = 8

/**
 * Scores starting XI players by ep_next descending and returns the top N.
 * GKs are excluded — captaining a keeper is never useful.
 */
function captainShortlist(
  startingPlayers: Player[],
  ctx: AgentContext,
): Array<{ player: Player; epNext: number; fixDisplay: string }> {
  return startingPlayers
    .filter(p => p.element_type !== 1) // exclude GKs
    .map(p => {
      const epNext = p.ep_next !== null ? parseFloat(p.ep_next) : parseFloat(p.form) * 0.9
      return { player: p, epNext, fixDisplay: fixtureDisplay(p, ctx) }
    })
    .sort((a, b) => b.epNext - a.epNext)
    .slice(0, SHORTLIST_SIZE)
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildPrompt(
  candidates: Array<{ player: Player; epNext: number; fixDisplay: string }>,
  ctx: AgentContext,
  transferResult: GenerateTransfersResult,
): string {
  const lines: string[] = [`GW${ctx.gameweek.id} — captain picks`, '']

  if (transferResult.transfers.length) {
    const incoming = transferResult.transfers
      .map(c => c.topPick.player.web_name)
      .join(', ')
    lines.push(`Suggested transfer(s) already applied — incoming: ${incoming}`, '')
  } else if (transferResult.save) {
    lines.push('No transfer suggested — squad is unchanged.', '')
  }

  lines.push('### Candidates (starting XI, ranked by projected points — GKs excluded)')
  for (const [i, c] of candidates.entries()) {
    const p = c.player
    const avail =
      p.chance_of_playing_next_round !== null
        ? `${p.chance_of_playing_next_round}% fit`
        : 'fully fit'
    lines.push(
      `${i + 1}. ${p.web_name} | ${POS[p.element_type] ?? '?'} | £${(p.now_cost / 10).toFixed(1)}m | projected ${c.epNext.toFixed(1)} pts | recent form ${p.form} | ${c.fixDisplay} | ${avail}${p.news ? ` | news: ${p.news}` : ''}`,
    )
  }

  return lines.join('\n')
}

// ── Tool definition ────────────────────────────────────────────────────────────

const CAPTAIN_TOOL: Anthropic.Tool = {
  name: 'submit_captain_pick',
  description: 'Submit the captain recommendation for this gameweek.',
  input_schema: {
    type: 'object',
    properties: {
      captain: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          reason: { type: 'string', description: 'One sentence.' },
          why: {
            type: 'object',
            properties: {
              form: { type: 'string', description: 'Recent scoring trend and sustainability.' },
              fixture: { type: 'string', description: 'Next opponent and matchup quality.' },
              risks: { type: 'string', description: 'Rotation, injury, or set-piece uncertainty. Write "None identified" if clean.' },
            },
            required: ['form', 'fixture', 'risks'],
          },
        },
        required: ['name', 'reason', 'why'],
      },
      vc: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          reason: { type: 'string', description: 'One sentence.' },
          why: {
            type: 'object',
            properties: {
              form: { type: 'string' },
              fixture: { type: 'string' },
              risks: { type: 'string' },
            },
            required: ['form', 'fixture', 'risks'],
          },
        },
        required: ['name', 'reason', 'why'],
      },
      alternatives: {
        type: 'array',
        maxItems: 2,
        description: '1–2 alternative captain options.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            reason: { type: 'string', description: 'One sentence.' },
            why: {
              type: 'object',
              properties: {
                form: { type: 'string' },
                fixture: { type: 'string' },
                risks: { type: 'string' },
              },
              required: ['form', 'fixture', 'risks'],
            },
          },
          required: ['name', 'reason', 'why'],
        },
      },
    },
    required: ['captain', 'vc', 'alternatives'],
  },
}

const SYSTEM_PROMPT = `You are Final Ball's captain analyst for Fantasy Premier League (FPL). Given the starting XI's best players ranked by projected points, pick the captain and vice-captain for this gameweek.

Data reference (internal — do NOT use these labels in your written output):
- projected pts: expected points for the next match
- recent form: rolling average points per game from recent weeks
- easy/average/tough: fixture difficulty
- plays twice: double gameweek — two matches
- no fixture: blank gameweek — no match, zero points

Your task:
1. Pick the captain — the player with the best chance of a big haul this gameweek.
2. Pick the vice-captain — the best fallback if the captain doesn't play.
3. Suggest 1–2 alternatives — safer or differential options worth considering.

Writing rules:
- One sentence per reason. Use real numbers from the data.
- Speak directly to the manager: "he has", "his next match", not "the player shows".
- Plain English only — never write ep_next, FDR, BLK, DGW, or pts/£m. Translate them: "projected 7.1 pts", "easy home match against Wolves", "no game this week", "plays twice this week".
- why.form: the recent scoring trend and whether it looks sustainable.
- why.fixture: name the opponent and describe the matchup in plain terms (e.g. "home to struggling Wolves", "tough away trip to Arsenal").
- why.risks: rotation risk, injury doubts, penalty/set-piece uncertainty. Write "None identified" if clean.`

// ── Name resolver ──────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function resolveCandidate(
  name: string,
  candidates: Array<{ player: Player; epNext: number; fixDisplay: string }>,
): (typeof candidates)[0] | null {
  const norm = normalizeName(name)
  return (
    candidates.find(c => normalizeName(c.player.web_name) === norm) ??
    candidates.find(c => normalizeName(c.player.web_name).includes(norm)) ??
    candidates.find(c => norm.includes(normalizeName(c.player.web_name))) ??
    null
  )
}

// ── Deterministic fallback ─────────────────────────────────────────────────────

function deterministicFallback(
  candidates: Array<{ player: Player; epNext: number; fixDisplay: string }>,
  trace: TraceEntry[],
  usage: { inputTokens: number; outputTokens: number },
): CaptainResult {
  const [c0, c1, c2] = candidates
  if (!c0 || !c1) throw new Error('Not enough starting XI players for a captain pick')
  const mkPick = (c: (typeof candidates)[0], label: string): CaptainPick => ({
    player: c.player,
    reason: `${label} by ep_next this gameweek (${c.epNext.toFixed(1)} pts projected).`,
    why: {
      form: `Form ${c.player.form} over recent weeks.`,
      fixture: c.fixDisplay,
      risks: c.player.news || 'None identified',
    },
  })
  return {
    captain: mkPick(c0, 'Highest expected points'),
    vc: mkPick(c1, 'Second-highest expected points'),
    alternatives: c2 ? [mkPick(c2, 'Third option')] : [],
    trace,
    usage,
  }
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function generateCaptain(
  ctx: AgentContext,
  transferResult: GenerateTransfersResult,
): Promise<CaptainResult> {
  const trace: TraceEntry[] = []
  const usage = { inputTokens: 0, outputTokens: 0 }

  // ── Phase A: build post-transfer starting XI ──────────────────────────────
  const startingPlayers = postTransferStartingPlayers(ctx, transferResult)

  trace.push({
    title: 'Post-transfer squad',
    text: `Starting XI after transfer${transferResult.transfers.length > 1 ? 's' : ''}: ${startingPlayers.map(p => p.web_name).join(', ')}.`,
  })

  // ── Phase B: deterministic shortlist ─────────────────────────────────────
  const candidates = captainShortlist(startingPlayers, ctx)

  if (candidates.length < 2) {
    trace.push({ title: 'Captain fallback', text: 'Fewer than 2 non-GK starters — using deterministic picks.' })
    return deterministicFallback(candidates, trace, usage)
  }

  trace.push({
    title: 'Captain candidates',
    text: `Top ${candidates.length} by ep_next: ${candidates.map(c => `${c.player.web_name} (${c.epNext.toFixed(1)})`).join(', ')}.`,
  })

  // ── Phase C: model ranking ────────────────────────────────────────────────
  const model = process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-6'
  const client = new Anthropic()

  trace.push({
    title: 'Model captain ranking',
    text: `Ranking ${candidates.length} candidates with ${model}.`,
  })

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [CAPTAIN_TOOL],
      tool_choice: { type: 'tool', name: 'submit_captain_pick' },
      messages: [{ role: 'user', content: buildPrompt(candidates, ctx, transferResult) }],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    trace.push({ title: 'Fallback', text: `Model call failed (${msg}) — using top ep_next picks.` })
    return deterministicFallback(candidates, trace, usage)
  }

  usage.inputTokens += response.usage.input_tokens
  usage.outputTokens += response.usage.output_tokens
  trace.push({ title: 'Tokens used', text: `${usage.inputTokens} input / ${usage.outputTokens} output.` })

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  )
  if (!toolBlock) {
    trace.push({ title: 'Fallback', text: 'Model returned no structured pick — using top ep_next picks.' })
    return deterministicFallback(candidates, trace, usage)
  }

  const output = toolBlock.input as ModelOutput

  // ── Phase D: step-7 re-validation (must be in the shortlist) ─────────────
  const MAX_REPLANS = 2
  let replanCount = 0

  function validated(pick: ModelCaptainPick, label: string, usedIds: Set<number>): {
    player: Player; epNext: number; fixDisplay: string
  } {
    const resolved = resolveCandidate(pick.name, candidates)
    if (resolved && !usedIds.has(resolved.player.id)) return resolved

    if (replanCount < MAX_REPLANS) {
      replanCount++
      const reason = resolved
        ? `Model ${label} "${pick.name}" was already used — taking next available.`
        : `Model ${label} "${pick.name}" not in the valid starting XI shortlist — taking next available.`
      trace.push({ title: `Replan · ${label}`, text: reason, replan: true })
    }

    // Fall back to the highest-ep_next candidate not yet used
    const fallback = candidates.find(c => !usedIds.has(c.player.id))
    if (!fallback) throw new Error(`No remaining captain candidates for ${label}`)
    return fallback
  }

  const usedIds = new Set<number>()

  const captainCandidate = validated(output.captain, 'captain', usedIds)
  usedIds.add(captainCandidate.player.id)

  const vcCandidate = validated(output.vc, 'VC', usedIds)
  usedIds.add(vcCandidate.player.id)

  const alternatives: CaptainPick[] = []
  for (const alt of output.alternatives.slice(0, 2)) {
    const resolved = resolveCandidate(alt.name, candidates)
    if (!resolved || usedIds.has(resolved.player.id)) {
      if (!resolved && replanCount < MAX_REPLANS) {
        replanCount++
        trace.push({ title: 'Replan · alt', text: `Model alternative "${alt.name}" not found — skipped.`, replan: true })
      }
      continue
    }
    usedIds.add(resolved.player.id)
    alternatives.push({ player: resolved.player, reason: alt.reason, why: alt.why })
  }

  trace.push({
    title: 'Captain result',
    text: `Captain: ${captainCandidate.player.web_name}. VC: ${vcCandidate.player.web_name}${alternatives.length ? '. Alt: ' + alternatives.map(a => a.player.web_name).join(', ') : ''}.`,
  })

  // Determine whether the captain is the incoming transfer player (D4.4)
  const incomingIds = new Set(transferResult.transfers.map(c => c.topPick.player.id))
  if (incomingIds.has(captainCandidate.player.id)) {
    trace.push({
      title: 'Captain is incoming player',
      text: `${captainCandidate.player.web_name} was just brought in — the captain pick reflects the post-transfer squad (D4.4).`,
    })
  }

  return {
    captain: {
      player: captainCandidate.player,
      reason: output.captain.reason,
      why: output.captain.why,
    },
    vc: {
      player: vcCandidate.player,
      reason: output.vc.reason,
      why: output.vc.why,
    },
    alternatives,
    trace,
    usage,
  }
}
