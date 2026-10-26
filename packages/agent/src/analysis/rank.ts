import Anthropic from '@anthropic-ai/sdk'
import type { AgentContext } from '../context.js'
import type { TransferPlanResult, Candidate } from './candidates.js'
import type { PlayerScore } from './weakspot.js'
import type { Player } from '../fpl/types.js'
import type { TraceEntry } from '../trace.js'

/** D17.5: minimum 3-GW pts gain to recommend a transfer over saving. */
export const SAVE_THRESHOLD_PTS = 1.0

const MAX_REPLANS = 2

const POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

// ── Output types ──────────────────────────────────────────────────────────────

export interface WhySection {
  form: string
  fixtures: string
  price: string
  risks: string
}

export interface RankedAlternative {
  candidate: Candidate
  reason: string
}

export interface RankedTransferCard {
  sell: PlayerScore
  sellingPrice: number
  topPick: Candidate
  topPickReason: string
  topPickWhy: WhySection
  alternatives: RankedAlternative[]
  whySell: string
  swapReason: string
  replans: string[]
}

export interface RankedPlan {
  save: boolean
  saveReason?: string
  /** Shown alongside a save recommendation for comparison (D2.2). */
  bestOptionForComparison?: { player: Player; reason: string }
  transfers: RankedTransferCard[]
  trace: TraceEntry[]
  usage: { inputTokens: number; outputTokens: number }
}

// ── Internal model I/O types (mirror the tool schema) ────────────────────────

interface ModelWhySection {
  form: string
  fixtures: string
  price: string
  risks: string
}

interface ModelTransferCard {
  sellPlayerName: string
  whySell: string
  swapReason: string
  topPick: { playerName: string; reason: string; why: ModelWhySection }
  alternatives: Array<{ playerName: string; reason: string }>
}

interface ModelOutput {
  recommendation: 'transfer' | 'save'
  saveReason?: string
  bestOptionForComparison?: { playerName: string; reason: string }
  transfers?: ModelTransferCard[]
}

// ── Tool definition ───────────────────────────────────────────────────────────

const PLAN_TOOL: Anthropic.Tool = {
  name: 'submit_transfer_plan',
  description: 'Submit the ranked transfer recommendation with reasoning.',
  input_schema: {
    type: 'object',
    properties: {
      recommendation: {
        type: 'string',
        enum: ['transfer', 'save'],
        description: 'Whether to make a transfer or save the free transfer.',
      },
      saveReason: {
        type: 'string',
        description: 'One sentence. Required when recommendation is "save".',
      },
      bestOptionForComparison: {
        type: 'object',
        description: 'Required when saving: the best available option shown alongside for comparison (D2.2).',
        properties: {
          playerName: { type: 'string' },
          reason: { type: 'string', description: 'One sentence on why this is the best available option despite not clearing the threshold.' },
        },
        required: ['playerName', 'reason'],
      },
      transfers: {
        type: 'array',
        description: 'Required when recommendation is "transfer". One entry per free transfer (max 2).',
        items: {
          type: 'object',
          properties: {
            sellPlayerName: { type: 'string' },
            whySell: {
              type: 'string',
              description: "One sentence: why this player is the squad's biggest weakness.",
            },
            swapReason: {
              type: 'string',
              description: 'One sentence: the overall case for this transfer.',
            },
            topPick: {
              type: 'object',
              properties: {
                playerName: { type: 'string' },
                reason: { type: 'string', description: 'One sentence.' },
                why: {
                  type: 'object',
                  properties: {
                    form: { type: 'string', description: 'One sentence on recent scoring trend.' },
                    fixtures: { type: 'string', description: 'One sentence on the 3-GW fixture run.' },
                    price: { type: 'string', description: 'One sentence on price and value for money.' },
                    risks: { type: 'string', description: 'One sentence on injury, rotation, or other concerns. Write "None identified" if clean.' },
                  },
                  required: ['form', 'fixtures', 'price', 'risks'],
                },
              },
              required: ['playerName', 'reason', 'why'],
            },
            alternatives: {
              type: 'array',
              maxItems: 3,
              items: {
                type: 'object',
                properties: {
                  playerName: { type: 'string' },
                  reason: { type: 'string', description: 'One sentence.' },
                },
                required: ['playerName', 'reason'],
              },
            },
          },
          required: ['sellPlayerName', 'whySell', 'swapReason', 'topPick', 'alternatives'],
        },
      },
    },
    required: ['recommendation'],
  },
}

const SYSTEM_PROMPT = `You are Final Ball's transfer analyst for Fantasy Premier League (FPL). Given a squad's weakest player and a list of replacement candidates, make a clear, honest transfer recommendation.

Data reference (internal — do NOT use these labels in your written output):
- ep_next: projected points for the next match
- form: rolling average points per game from recent weeks
- FDR: fixture difficulty (1 = easy, 5 = very tough)
- BLK: no fixture that week
- DGW: plays twice that week
- pts/£m: points per £1m spent
- availability: chance of playing next round (100% = fully fit)

Your task:
1. Decide: transfer or save?
2. If transferring — pick the best replacement and up to 3 alternatives, each with a one-line reason.
3. If saving — explain why in one sentence and name the best available option for the manager to see.

Save threshold: recommend "save" when the best candidate improves 3-GW projected pts by less than ${SAVE_THRESHOLD_PTS.toFixed(1)} pts. Rolling the transfer earns an extra free transfer next week, which is often more valuable than a marginal swap.

Writing rules:
- One sentence per reason. Use real numbers from the data.
- Speak directly to the manager ("he has", "his fixtures", not "the player shows").
- Plain English only in all written fields — never write ep_next, FDR, BLK, DGW, pts/£m, or availability. Translate them: "projected 4.2 pts next week", "tough away trip to Arsenal", "no game this week", "plays twice", "good value at £6.5m", "carrying a knock (75% fit)".
- whySell: explain the actual weakness in plain terms — poor run of fixtures, dropping form, low projected score — not just "he scores less."
- topPick.why.form: the recent scoring trend and whether it's sustainable.
- topPick.why.fixtures: the quality of the 3-match run — name the opponents.
- topPick.why.price: whether the price is good value for what he offers.
- topPick.why.risks: injury doubts, rotation risk, or penalty/set-piece uncertainty. Write "None identified" if clean.`

// ── Prompt builder ────────────────────────────────────────────────────────────

function formatSell(sell: PlayerScore, sellingPrice: number): string {
  const p = sell.player
  const s = sell.score
  const gws = s.perGw
    .map(g =>
      g.fdr === null
        ? 'BLK'
        : `GW${g.gwId}: ${g.points.toFixed(1)} pts (FDR ${g.fdr.toFixed(1)}${g.isDouble ? ' DGW' : ''})`,
    )
    .join(' | ')
  return [
    `${p.web_name} | ${POS[p.element_type] ?? '?'} | £${(p.now_cost / 10).toFixed(1)}m | selling at £${(sellingPrice / 10).toFixed(1)}m`,
    `form ${p.form} | ep_next ${p.ep_next ?? 'n/a'} | availability ${s.availability < 1 ? `${(s.availability * 100).toFixed(0)}%` : '100%'}`,
    `3-GW projected: ${s.total.toFixed(1)} pts | ${gws}`,
    p.news ? `news: ${p.news}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function formatCandidate(c: Candidate, rank: number): string {
  const p = c.player
  const s = c.score
  const gws = s.perGw
    .map(g =>
      g.fdr === null
        ? 'BLK'
        : `GW${g.gwId}: ${g.points.toFixed(1)} pts (FDR ${g.fdr.toFixed(1)}${g.isDouble ? ' DGW' : ''})`,
    )
    .join(' | ')
  return [
    `${rank}. ${p.web_name} | ${POS[p.element_type] ?? '?'} | £${(p.now_cost / 10).toFixed(1)}m | pts/£m ${c.valueScore.toFixed(2)}`,
    `   form ${p.form} | ep_next ${p.ep_next ?? 'n/a'} | availability ${s.availability < 1 ? `${(s.availability * 100).toFixed(0)}%` : '100%'}`,
    `   3-GW projected: ${s.total.toFixed(1)} pts | ${gws}`,
    p.news ? `   news: ${p.news}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildUserPrompt(plan: TransferPlanResult, ctx: AgentContext): string {
  const { bank, freeTransfers, gameweek } = ctx
  const lines: string[] = [
    `GW${gameweek.id} — ${freeTransfers} free transfer${freeTransfers > 1 ? 's' : ''}`,
    `Bank: £${(bank / 10).toFixed(1)}m`,
    '',
  ]

  for (const [i, opt] of plan.transfers.entries()) {
    if (plan.transfers.length > 1) lines.push(`## Transfer ${i + 1}`)

    lines.push('### Player to sell')
    lines.push(formatSell(opt.sell, opt.sellingPrice))
    lines.push(`Budget for replacement: £${((opt.sellingPrice + bank) / 10).toFixed(1)}m`)
    if (opt.replans.length) lines.push(`Constraint notes from filtering: ${opt.replans.join('; ')}`)
    lines.push('')

    const candidates = opt.candidatesForModel.length > 0
      ? opt.candidatesForModel
      : [opt.topPick, ...opt.alternatives]
    lines.push(`### Candidates (same position, affordable, not owned, max 3 per club — ranked by pts/£m)`)
    for (const [j, c] of candidates.entries()) {
      lines.push(formatCandidate(c, j + 1))
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ── Step 7: validate model picks ──────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function resolveCandidate(modelName: string, candidates: Candidate[]): Candidate | null {
  const norm = normalizeName(modelName)
  return (
    candidates.find(c => normalizeName(c.player.web_name) === norm) ??
    candidates.find(c => normalizeName(c.player.web_name).includes(norm)) ??
    candidates.find(c => norm.includes(normalizeName(c.player.web_name))) ??
    null
  )
}

// ── Deterministic fallback (model unavailable or returned garbage) ─────────────

function deterministicFallback(
  plan: TransferPlanResult,
  trace: TraceEntry[],
  usage: { inputTokens: number; outputTokens: number },
): RankedPlan {
  return {
    save: plan.save,
    saveReason: plan.saveReason,
    transfers: plan.transfers.map(opt => ({
      sell: opt.sell,
      sellingPrice: opt.sellingPrice,
      topPick: opt.topPick,
      topPickReason: '',
      topPickWhy: { form: '', fixtures: '', price: '', risks: '' },
      alternatives: opt.alternatives.map(c => ({ candidate: c, reason: '' })),
      whySell: '',
      swapReason: '',
      replans: opt.replans,
    })),
    trace,
    usage,
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function rankWithModel(
  plan: TransferPlanResult,
  ctx: AgentContext,
): Promise<RankedPlan> {
  const trace: TraceEntry[] = [...plan.trace]
  const usage = { inputTokens: 0, outputTokens: 0 }

  if (plan.save) {
    trace.push({ title: 'Model ranking skipped', text: 'Deterministic phase already recommended saving the transfer.' })
    return { save: true, saveReason: plan.saveReason, transfers: [], trace, usage }
  }

  const model = process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-6'
  const client = new Anthropic()
  const candidateCount = plan.transfers.reduce((n, t) => n + t.candidatesForModel.length, 0)
  trace.push({ title: 'Model ranking', text: `Ranking ${candidateCount} candidate${candidateCount !== 1 ? 's' : ''} with ${model}.` })

  let response: Anthropic.Message
  try {
    // 2-transfer prompts need more room — each card has 4 why fields + 3 alts
    const maxTokens = plan.transfers.length > 1 ? 2048 : 1024
    response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      tools: [PLAN_TOOL],
      tool_choice: { type: 'tool', name: 'submit_transfer_plan' },
      messages: [{ role: 'user', content: buildUserPrompt(plan, ctx) }],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    trace.push({ title: 'Fallback', text: `Model call failed (${msg}) — using top-ranked deterministic picks.` })
    return deterministicFallback(plan, trace, usage)
  }

  usage.inputTokens = response.usage.input_tokens
  usage.outputTokens = response.usage.output_tokens
  trace.push({ title: 'Tokens used', text: `${usage.inputTokens} input / ${usage.outputTokens} output.` })

  const toolBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  if (!toolBlock) {
    trace.push({ title: 'Fallback', text: 'Model did not return a structured plan — using top-ranked deterministic picks.' })
    return deterministicFallback(plan, trace, usage)
  }

  const output = toolBlock.input as ModelOutput

  // ── Save recommendation ────────────────────────────────────────────────────
  if (output.recommendation === 'save') {
    const saveReason = output.saveReason ?? 'No candidate improves the squad enough to justify using the transfer.'
    trace.push({ title: 'Model recommends save', text: saveReason })

    let bestOptionForComparison: RankedPlan['bestOptionForComparison']
    if (output.bestOptionForComparison && plan.transfers[0]) {
      const allCandidates = plan.transfers[0].candidatesForModel.length > 0
        ? plan.transfers[0].candidatesForModel
        : [plan.transfers[0].topPick, ...plan.transfers[0].alternatives]
      const resolved = resolveCandidate(output.bestOptionForComparison.playerName, allCandidates)
      if (resolved) {
        bestOptionForComparison = { player: resolved.player, reason: output.bestOptionForComparison.reason }
      }
    }

    return { save: true, saveReason, bestOptionForComparison, transfers: [], trace, usage }
  }

  // ── Transfer recommendation — build cards with step 7 re-validation ────────
  const transfers: RankedTransferCard[] = []

  for (const [i, modelCard] of (output.transfers ?? []).entries()) {
    const opt = plan.transfers[i]
    if (!opt) continue

    const allCandidates = opt.candidatesForModel.length > 0
      ? opt.candidatesForModel
      : [opt.topPick, ...opt.alternatives]

    const replans = [...opt.replans]
    let replanCount = 0

    // Step 7: validate top pick
    let topPick = resolveCandidate(modelCard.topPick.playerName, allCandidates)
    if (!topPick) {
      if (replanCount < MAX_REPLANS) {
        replanCount++
        replans.push(
          `Model top pick "${modelCard.topPick.playerName}" not in candidate list — using ${opt.topPick.player.web_name}`,
        )
        trace.push({
          title: `Replan · T${i + 1} pick`,
          text: `Model chose "${modelCard.topPick.playerName}" — not in the valid candidate list. Using ${opt.topPick.player.web_name} instead.`,
          replan: true,
        })
      }
      topPick = opt.topPick
    }

    // Step 7: validate alternatives
    const usedIds = new Set([topPick.player.id])
    const alternatives: RankedAlternative[] = []

    for (const alt of modelCard.alternatives) {
      if (alternatives.length >= 3) break
      const resolved = resolveCandidate(alt.playerName, allCandidates)
      if (!resolved || usedIds.has(resolved.player.id)) {
        if (!resolved && replanCount < MAX_REPLANS) {
          replanCount++
          replans.push(`Model alternative "${alt.playerName}" not found — skipped`)
          trace.push({
            title: `Replan · T${i + 1} alt`,
            text: `Model alternative "${alt.playerName}" not in valid list — skipped.`,
            replan: true,
          })
        }
        continue
      }
      usedIds.add(resolved.player.id)
      alternatives.push({ candidate: resolved, reason: alt.reason })
    }

    for (const c of allCandidates) {
      if (alternatives.length >= 3) break
      if (usedIds.has(c.player.id)) continue
      usedIds.add(c.player.id)
      alternatives.push({ candidate: c, reason: '' })
    }

    const reranked = topPick.player.web_name !== opt.topPick.player.web_name
      ? ' (model chose differently from deterministic top pick)'
      : ''
    trace.push({
      title: `T${i + 1} transfer`,
      text: `Sell ${opt.sell.player.web_name} → buy ${topPick.player.web_name}${reranked}.`,
    })

    transfers.push({
      sell: opt.sell,
      sellingPrice: opt.sellingPrice,
      topPick,
      topPickReason: modelCard.topPick.reason,
      topPickWhy: modelCard.topPick.why,
      alternatives,
      whySell: modelCard.whySell,
      swapReason: modelCard.swapReason,
      replans,
    })
  }

  if (transfers.length === 0) {
    trace.push({ title: 'Fallback', text: 'Model returned no transfer cards — using top-ranked deterministic picks.' })
    return deterministicFallback(plan, trace, usage)
  }

  return { save: false, transfers, trace, usage }
}
