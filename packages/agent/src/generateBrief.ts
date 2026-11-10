import { createHash } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { FplClient } from './fpl/client.js'
import { MemoryCacheAdapter } from './fpl/cache.js'
import { loadContext } from './context.js'
import { findWeakSpots } from './analysis/weakspot.js'
import { buildTransferPlan } from './analysis/candidates.js'
import type { Candidate } from './analysis/candidates.js'
import type { RiskTag } from './analysis/candidates.js'
import { selectAndTagOptions, SAVE_THRESHOLD_PTS } from './analysis/rank.js'
import type { RankedTransferCard, RankedAlternative } from './analysis/rank.js'
import { scorePlayer } from './analysis/score.js'
import { assignCaptainTags } from './generateCaptain.js'
import type { CaptainResult, CaptainPick } from './generateCaptain.js'
import { getUpcomingGwIds } from './analysis/fixtures.js'
import { numberSteps } from './trace.js'
import type { TraceStep, TraceEntry } from './trace.js'
import type { Player } from './fpl/types.js'
import type { PlayerScore, WeakspotResult } from './analysis/weakspot.js'
import type { AgentContext } from './context.js'

// ── BriefResult (shape unchanged — UI and API route depend on this) ───────────

export interface BriefResult {
  save: boolean
  saveReason?: string
  bestOptionForComparison?: { player: Player; reason: string }
  transfers: RankedTransferCard[]
  captain: CaptainResult
  /** Combined numbered trace from all pipeline phases. */
  trace: TraceStep[]
  meta: {
    gameweekId: number
    freeTransfers: number
    bank: number
    elapsedMs: number
    usage: { inputTokens: number; outputTokens: number }
    /** SHA-256 of the inputs used this run (D10.6). */
    inputHash: string
    /** Human-readable summary of notable squad state, shown as a chip when hash changes (D10.6). */
    changeSummary: string
  }
  /** Top-3 weakest players for the "Why sell?" expansion (D8.6, D17.4). */
  whySellContext: PlayerScore[]
}

// ── Input hash and change summary (D10.6) ─────────────────────────────────────

/**
 * Computes a deterministic SHA-256 hash of the inputs that determine brief output:
 * squad picks + selling prices, bank, free transfers, player news, and FDR values
 * for the next 3 GWs (D10.6).
 */
export function computeInputHash(ctx: AgentContext): string {
  const upcomingGwIds = ctx.bootstrap.events
    .filter(e => e.id >= ctx.gameweek.id)
    .map(e => e.id)
    .sort((a, b) => a - b)
    .slice(0, 3)

  const fdrMap = new Map<string, number>()
  for (const fixture of ctx.allFixtures) {
    if (fixture.event === null || !upcomingGwIds.includes(fixture.event)) continue
    fdrMap.set(`${fixture.team_h}-${fixture.event}`, fixture.team_h_difficulty)
    fdrMap.set(`${fixture.team_a}-${fixture.event}`, fixture.team_a_difficulty)
  }

  const picks = ctx.picks.picks
    .map(p => ({ id: p.element, sp: p.selling_price ?? 0 }))
    .sort((a, b) => a.id - b.id)

  const news: Record<number, string> = {}
  const fdrs: Record<number, (number | null)[]> = {}
  for (const player of ctx.squadPlayers) {
    news[player.id] = player.news
    fdrs[player.id] = upcomingGwIds.map(gwId => fdrMap.get(`${player.team}-${gwId}`) ?? null)
  }

  return createHash('sha256')
    .update(JSON.stringify({ picks, bank: ctx.bank, freeTransfers: ctx.freeTransfers, news, fdrs }))
    .digest('hex')
}

/** Produces a brief human-readable summary of notable squad state. */
function computeChangeSummary(ctx: AgentContext): string {
  const flagged = ctx.squadPlayers
    .filter(p => p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round < 100)
    .map(p => `${p.web_name} ${p.chance_of_playing_next_round}%`)
    .slice(0, 2)
  return flagged.length > 0 ? `Updated — ${flagged.join(', ')} flagged` : 'FPL data updated'
}

// ── Internal model I/O types ──────────────────────────────────────────────────

interface ModelCaptainPick {
  name: string
  reason: string
  why: { form: string; fixture: string; risks: string }
}

interface ModelTransferCard {
  sellPlayerName: string
  whySell: string
  swapReason: string
  topPickName: string
  topPickReason: string
  topPickWhy: { form: string; fixtures: string; price: string; risks: string }
  alternatives: Array<{ playerName: string; reason: string }>
}

interface SubmitBriefInput {
  recommendation: 'transfer' | 'save'
  saveReason?: string
  bestOptionForComparison?: { playerName: string; reason: string }
  transfers?: ModelTransferCard[]
  captain: ModelCaptainPick
  vc: ModelCaptainPick
  captainAlternatives: ModelCaptainPick[]
}

// ── Position helpers ──────────────────────────────────────────────────────────

const TYPE_TO_POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
const POS_TO_TYPE: Record<string, number> = { GK: 1, DEF: 2, MID: 3, FWD: 4 }

// ── Player lookup helpers ─────────────────────────────────────────────────────

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

function findPlayerScore(name: string, scores: PlayerScore[]): PlayerScore | null {
  const norm = normalizeName(name)
  return (
    scores.find(s => normalizeName(s.player.web_name) === norm) ??
    scores.find(s => normalizeName(s.player.web_name).includes(norm)) ??
    scores.find(s => norm.includes(normalizeName(s.player.web_name))) ??
    null
  )
}

// ── Tool implementations (richer than counter — include 3-GW scores) ──────────

function toolGetPlayer(name: string, ctx: AgentContext): string {
  const player = findPlayer(name, ctx.bootstrap.elements)
  if (!player) return `Player "${name}" not found.`

  const teamById = new Map(ctx.bootstrap.teams.map(t => [t.id, t]))
  const team = teamById.get(player.team)
  const pos = TYPE_TO_POS[player.element_type] ?? '?'
  const avail =
    player.chance_of_playing_next_round !== null
      ? `${player.chance_of_playing_next_round}% fit`
      : 'fully fit'

  const score = scorePlayer(player, ctx.allFixtures, ctx.bootstrap)
  const gwLines = score.perGw
    .map(g =>
      g.fdr === null
        ? `GW${g.gwId}: BLK`
        : `GW${g.gwId}: ${g.points.toFixed(1)} pts (FDR ${g.fdr.toFixed(1)}${g.isDouble ? ' DGW' : ''})`,
    )
    .join(' | ')

  const lines = [
    `${player.web_name} | ${pos} | ${team?.name ?? 'unknown'} | £${(player.now_cost / 10).toFixed(1)}m`,
    `form ${player.form} | ep_next ${player.ep_next ?? 'n/a'} | ${avail}`,
    `3-GW projected: ${score.total.toFixed(1)} pts | ${gwLines}`,
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
    .map(p => {
      const score = scorePlayer(p, ctx.allFixtures, ctx.bootstrap)
      return { player: p, score }
    })
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, 10)

  if (candidates.length === 0) return `No available ${position} candidates under £${maxPriceMns.toFixed(1)}m.`

  const rows = candidates.map((c, i) => {
    const p = c.player
    const avail =
      p.chance_of_playing_next_round !== null
        ? `${p.chance_of_playing_next_round}% fit`
        : 'fully fit'
    const gwLines = c.score.perGw
      .map(g => (g.fdr === null ? `GW${g.gwId}: BLK` : `GW${g.gwId}: ${g.points.toFixed(1)} pts`))
      .join(' | ')
    const news = p.news ? ` | ${p.news}` : ''
    return `${i + 1}. ${p.web_name} | £${(p.now_cost / 10).toFixed(1)}m | 3-GW: ${c.score.total.toFixed(1)} pts (${gwLines}) | ${avail}${news}`
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

function executeToolCall(name: string, input: Record<string, unknown>, ctx: AgentContext): string {
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

const BRIEF_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_player',
    description:
      'Look up a player by name. Returns their status, news, form, 3-GW projected score breakdown, price, and availability.',
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
    description: 'Compare two players side-by-side on form, 3-GW projected scores, fixtures, and price.',
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
      'Find available players at a position within a price limit who are not in your squad. Returns 3-GW projected scores.',
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
    name: 'submit_brief',
    description: 'Submit the full transfer and captain recommendation for this gameweek.',
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
          description: 'Required when saving: the best available option shown alongside for comparison.',
          properties: {
            playerName: { type: 'string' },
            reason: {
              type: 'string',
              description: 'One sentence on why this is the best available option despite not clearing the threshold.',
            },
          },
          required: ['playerName', 'reason'],
        },
        transfers: {
          type: 'array',
          description: 'Required when recommendation is "transfer". One entry per free transfer (max 2).',
          maxItems: 2,
          items: {
            type: 'object',
            properties: {
              sellPlayerName: { type: 'string', description: 'Name of the squad player to sell.' },
              whySell: {
                type: 'string',
                description: "One sentence: why this player is the squad's biggest weakness.",
              },
              swapReason: {
                type: 'string',
                description: 'One sentence: the overall case for this transfer.',
              },
              topPickName: { type: 'string', description: 'Name of the best replacement.' },
              topPickReason: { type: 'string', description: 'One sentence.' },
              topPickWhy: {
                type: 'object',
                properties: {
                  form: { type: 'string', description: 'One sentence on recent scoring trend.' },
                  fixtures: { type: 'string', description: 'One sentence on the 3-GW fixture run.' },
                  price: { type: 'string', description: 'One sentence on price and value for money.' },
                  risks: {
                    type: 'string',
                    description: 'One sentence on injury, rotation, or other concerns. Write "None identified" if clean.',
                  },
                },
                required: ['form', 'fixtures', 'price', 'risks'],
              },
              alternatives: {
                type: 'array',
                maxItems: 3,
                description: 'Up to 3 alternative buy players.',
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
            required: ['sellPlayerName', 'whySell', 'swapReason', 'topPickName', 'topPickReason', 'topPickWhy', 'alternatives'],
          },
        },
        captain: {
          type: 'object',
          description: 'Captain recommendation.',
          properties: {
            name: { type: 'string' },
            reason: { type: 'string', description: 'One sentence.' },
            why: {
              type: 'object',
              properties: {
                form: { type: 'string', description: 'Recent scoring trend and sustainability.' },
                fixture: { type: 'string', description: 'Next opponent and matchup quality.' },
                risks: {
                  type: 'string',
                  description: 'Rotation, injury, or set-piece uncertainty. Write "None identified" if clean.',
                },
              },
              required: ['form', 'fixture', 'risks'],
            },
          },
          required: ['name', 'reason', 'why'],
        },
        vc: {
          type: 'object',
          description: 'Vice-captain recommendation.',
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
        captainAlternatives: {
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
      required: ['recommendation', 'captain', 'vc', 'captainAlternatives'],
    },
  },
]

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Final Ball's brief agent for Fantasy Premier League (FPL). Given a manager's squad scored over the next 3 gameweeks, pick the best transfer and captain for this gameweek.

Workflow:
1. Examine the squad scores in the message. Identify the weakest player(s) — lowest 3-GW projected pts relative to their price.
2. Use search_candidates to find replacements at their position within the available budget (selling price + bank).
3. Use get_player or compare to deep-dive on specific candidates.
4. Use check_constraints to validate a sell → buy pair before submitting.
5. For the captain: consider the post-transfer starting XI (positions 1–11). Check fixture difficulty and form.
6. Submit with submit_brief when you have enough information.

Data reference (internal — do NOT use these labels in written output):
- 3-GW projected pts: expected points across the next 3 gameweeks
- FDR: fixture difficulty (1–2 = easy, 3 = average, 4–5 = tough)
- BLK: blank gameweek — no match, zero points
- DGW: double gameweek — plays twice
- ep_next: projected points for the next match
- availability: chance of playing next round

Save threshold: recommend "save" when no candidate improves 3-GW projected pts by at least ${SAVE_THRESHOLD_PTS.toFixed(1)} pts over the sell candidate. Rolling earns an extra free transfer next week, which is often more valuable than a marginal swap.

Captain rule: the captain must be in the post-transfer starting XI (positions 1–11 of the squad). Do not captain a bench player. If you bring in a new player who would start, they are eligible for captaincy.

Writing rules:
- One sentence per reason. Use real numbers from the data.
- Speak directly to the manager: "he has", "his fixtures", not "the player shows".
- Plain English only — never write ep_next, FDR, BLK, DGW, pts/£m, or availability. Translate: "projected 7.1 pts next week", "easy home match against Wolves", "no game this week", "plays twice this week", "good value at £6.5m", "carrying a knock (75% fit)".
- topPickWhy.form: recent scoring trend and whether it looks sustainable.
- topPickWhy.fixtures: quality of the 3-match run — name the opponents.
- topPickWhy.price: whether the price is good value for what he offers.
- topPickWhy.risks: injury doubts, rotation risk, penalty/set-piece uncertainty. Write "None identified" if clean.
- captain.why.form: recent scoring trend.
- captain.why.fixture: name the opponent and describe the matchup.
- captain.why.risks: rotation, injury, or set-piece concerns.`

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildInitialPrompt(weakspots: WeakspotResult, ctx: AgentContext): string {
  const { bank, freeTransfers, gameweek } = ctx
  const lines: string[] = []

  lines.push(
    `GW${gameweek.id} brief | ${freeTransfers} free transfer${freeTransfers > 1 ? 's' : ''} | Bank: £${(bank / 10).toFixed(1)}m`,
  )
  lines.push('')
  lines.push('## Your squad (sorted weakest → strongest, 3-GW projected pts)')

  const startingIds = new Set(
    ctx.picks.picks.filter(p => p.position <= 11).map(p => p.element),
  )

  for (const [i, ps] of weakspots.ranked.entries()) {
    const p = ps.player
    const s = ps.score
    const pos = TYPE_TO_POS[p.element_type] ?? '?'
    const avail =
      p.chance_of_playing_next_round !== null
        ? `${p.chance_of_playing_next_round}% fit`
        : 'fit'
    const gwLines = s.perGw
      .map(g =>
        g.fdr === null
          ? `GW${g.gwId}: BLK`
          : `GW${g.gwId}: ${g.points.toFixed(1)} pts (FDR ${g.fdr.toFixed(1)}${g.isDouble ? ' DGW' : ''})`,
      )
      .join(' | ')
    const bench = startingIds.has(p.id) ? '' : ' (bench)'
    const news = p.news ? ` | ${p.news}` : ''
    lines.push(
      `${i + 1}. ${p.web_name} | ${pos} | £${(p.now_cost / 10).toFixed(1)}m | 3-GW: ${s.total.toFixed(1)} pts | ${gwLines} | ${avail}${bench}${news}`,
    )
  }

  lines.push('')
  lines.push('## Your task')
  lines.push(
    `1. Identify the weakest player${freeTransfers > 1 ? 's' : ''} (rank 1${freeTransfers > 1 ? '–2' : ''} above) and find the best replacement${freeTransfers > 1 ? 's' : ''}.`,
  )
  lines.push(`2. Pick the captain and vice-captain for GW${gameweek.id}.`)

  return lines.join('\n')
}

// ── Post-transfer starting XI helper ─────────────────────────────────────────

function applyTransfersToStartingXI(
  transfers: Array<{ sellId: number; buyId: number; buyPlayer: Player }>,
  ctx: AgentContext,
): Player[] {
  const playerById = new Map<number, Player>(ctx.bootstrap.elements.map(p => [p.id, p]))
  for (const t of transfers) {
    playerById.set(t.buyId, t.buyPlayer)
  }

  const posToId = new Map<number, number>(ctx.picks.picks.map(pick => [pick.position, pick.element]))

  for (const t of transfers) {
    for (const [pos, id] of posToId) {
      if (id === t.sellId) {
        posToId.set(pos, t.buyId)
        break
      }
    }
  }

  const starting: Player[] = []
  for (let pos = 1; pos <= 11; pos++) {
    const id = posToId.get(pos)
    const player = id !== undefined ? playerById.get(id) : undefined
    if (player) starting.push(player)
  }
  return starting
}

// ── Submission resolver ───────────────────────────────────────────────────────

function resolveSubmission(
  submission: SubmitBriefInput,
  weakspots: WeakspotResult,
  ctx: AgentContext,
  trace: TraceEntry[],
  usage: { inputTokens: number; outputTokens: number },
  t0: number,
  inputHash: string,
  changeSummary: string,
): BriefResult | null {
  // 1. Resolve transfer cards
  const transfers: RankedTransferCard[] = []

  if (submission.recommendation === 'transfer' && submission.transfers?.length) {
    for (const modelCard of submission.transfers) {
      const sellScore = findPlayerScore(modelCard.sellPlayerName, weakspots.ranked)
      if (!sellScore) {
        trace.push({ title: 'Validation', text: `Sell player "${modelCard.sellPlayerName}" not in squad — falling back.` })
        return null
      }

      const topPickPlayer = findPlayer(modelCard.topPickName, ctx.bootstrap.elements)
      if (!topPickPlayer) {
        trace.push({ title: 'Validation', text: `Top pick "${modelCard.topPickName}" not found — falling back.` })
        return null
      }

      const topPickScore = scorePlayer(topPickPlayer, ctx.allFixtures, ctx.bootstrap)
      const topPickCandidate: Candidate = {
        player: topPickPlayer,
        score: topPickScore,
        valueScore: topPickPlayer.now_cost > 0 ? topPickScore.total / (topPickPlayer.now_cost / 10) : 0,
      }

      const altCandidatesWithReasons: Array<{ candidate: Candidate; reason: string }> = []
      const usedBuyIds = new Set([topPickPlayer.id])
      for (const alt of (modelCard.alternatives ?? []).slice(0, 3)) {
        const altPlayer = findPlayer(alt.playerName, ctx.bootstrap.elements)
        if (!altPlayer || usedBuyIds.has(altPlayer.id)) continue
        usedBuyIds.add(altPlayer.id)
        const altScore = scorePlayer(altPlayer, ctx.allFixtures, ctx.bootstrap)
        altCandidatesWithReasons.push({
          candidate: {
            player: altPlayer,
            score: altScore,
            valueScore: altPlayer.now_cost > 0 ? altScore.total / (altPlayer.now_cost / 10) : 0,
          },
          reason: alt.reason,
        })
      }

      const altCandidates = altCandidatesWithReasons.map(a => a.candidate)
      const pool = [topPickCandidate, ...altCandidates]
      const taggedOptions = selectAndTagOptions(pool)
      const tagMap = new Map<number, RiskTag>(taggedOptions.map(o => [o.candidate.player.id, o.tag]))
      const getTag = (id: number): RiskTag => tagMap.get(id) ?? 'balanced'

      const sellingPrice =
        ctx.picks.picks.find(p => p.element === sellScore.player.id)?.selling_price ??
        sellScore.player.now_cost

      const alternatives: RankedAlternative[] = altCandidatesWithReasons.map(a => ({
        candidate: a.candidate,
        reason: a.reason,
        riskTag: getTag(a.candidate.player.id),
      }))

      transfers.push({
        sell: sellScore,
        sellingPrice,
        topPick: topPickCandidate,
        topPickReason: modelCard.topPickReason,
        topPickWhy: modelCard.topPickWhy,
        topPickRiskTag: getTag(topPickPlayer.id),
        alternatives,
        whySell: modelCard.whySell,
        swapReason: modelCard.swapReason,
        replans: [],
      })

      trace.push({
        title: 'Transfer',
        text: `Sell ${sellScore.player.web_name} → buy ${topPickPlayer.web_name} [${getTag(topPickPlayer.id)}].`,
      })
    }
  }

  // Guard: transfer recommendation must have at least one resolved card
  if (submission.recommendation === 'transfer' && transfers.length === 0) {
    trace.push({ title: 'Validation', text: 'Transfer recommendation with no valid transfer cards — falling back.' })
    return null
  }

  // 2. Post-transfer starting XI for captain validation
  const startingXI =
    transfers.length > 0
      ? applyTransfersToStartingXI(
          transfers.map(t => ({ sellId: t.sell.player.id, buyId: t.topPick.player.id, buyPlayer: t.topPick.player })),
          ctx,
        )
      : ctx.picks.picks
          .filter(p => p.position <= 11)
          .map(p => ctx.bootstrap.elements.find(e => e.id === p.element))
          .filter((p): p is Player => p !== undefined)

  // 3. Resolve captain picks — must be in starting XI
  const captainPlayer = findPlayer(submission.captain.name, startingXI)
  const vcPlayer = findPlayer(submission.vc.name, startingXI)

  if (!captainPlayer) {
    trace.push({ title: 'Validation', text: `Captain "${submission.captain.name}" not in starting XI — falling back.` })
    return null
  }
  if (!vcPlayer) {
    trace.push({ title: 'Validation', text: `VC "${submission.vc.name}" not in starting XI — falling back.` })
    return null
  }
  if (captainPlayer.id === vcPlayer.id) {
    trace.push({ title: 'Validation', text: `Captain and VC are the same player — falling back.` })
    return null
  }

  // 4. Resolve captain alternatives
  const usedCaptainIds = new Set([captainPlayer.id, vcPlayer.id])
  const altCaptainPicksRaw: Array<{ player: Player; model: ModelCaptainPick }> = []
  for (const alt of (submission.captainAlternatives ?? []).slice(0, 2)) {
    const p = findPlayer(alt.name, startingXI)
    if (!p || usedCaptainIds.has(p.id)) continue
    usedCaptainIds.add(p.id)
    altCaptainPicksRaw.push({ player: p, model: alt })
  }

  // 5. Assign captain tags
  const captainPicksForTagging: Array<{ player: Player; epNext: number }> = [
    captainPlayer,
    vcPlayer,
    ...altCaptainPicksRaw.map(a => a.player),
  ].map(p => ({
    player: p,
    epNext: p.ep_next !== null ? parseFloat(p.ep_next) : parseFloat(p.form) * 0.9,
  }))
  const captainTags = assignCaptainTags(captainPicksForTagging)

  const altCaptainPicks: CaptainPick[] = altCaptainPicksRaw.map((a, idx) => ({
    player: a.player,
    reason: a.model.reason,
    why: a.model.why,
    riskTag: captainTags[idx + 2] ?? 'balanced',
  }))

  const captainResult: CaptainResult = {
    captain: {
      player: captainPlayer,
      reason: submission.captain.reason,
      why: submission.captain.why,
      riskTag: captainTags[0] ?? 'balanced',
    },
    vc: {
      player: vcPlayer,
      reason: submission.vc.reason,
      why: submission.vc.why,
      riskTag: captainTags[1] ?? 'balanced',
    },
    alternatives: altCaptainPicks,
    trace: [],
    usage: { inputTokens: 0, outputTokens: 0 },
  }

  // 6. Best option for comparison (save path)
  let bestOptionForComparison: BriefResult['bestOptionForComparison']
  if (submission.recommendation === 'save' && submission.bestOptionForComparison) {
    const bop = findPlayer(submission.bestOptionForComparison.playerName, ctx.bootstrap.elements)
    if (bop) {
      bestOptionForComparison = { player: bop, reason: submission.bestOptionForComparison.reason }
    }
  }

  trace.push({
    title: 'Brief submitted',
    text: `${submission.recommendation === 'save' ? 'Save' : `${transfers.length} transfer${transfers.length > 1 ? 's' : ''}`}. Captain: ${captainPlayer.web_name}. VC: ${vcPlayer.web_name}.`,
  })

  return {
    save: submission.recommendation === 'save',
    saveReason: submission.saveReason,
    bestOptionForComparison,
    transfers,
    captain: captainResult,
    trace: numberSteps(trace),
    meta: {
      gameweekId: ctx.gameweek.id,
      freeTransfers: ctx.freeTransfers,
      bank: ctx.bank,
      elapsedMs: Date.now() - t0,
      usage,
      inputHash,
      changeSummary,
    },
    whySellContext: weakspots.whySellContext,
  }
}

// ── Deterministic fallback ────────────────────────────────────────────────────

function fixtureDisplay(player: Player, ctx: AgentContext): string {
  const teamById = new Map(ctx.bootstrap.teams.map(t => [t.id, t]))
  const [gwId] = getUpcomingGwIds(ctx.bootstrap, 1)
  if (!gwId) return 'no fixture'
  const matches = ctx.allFixtures.filter(
    f => f.event === gwId && (f.team_h === player.team || f.team_a === player.team),
  )
  if (!matches.length) return 'no fixture this week'
  const segs = matches.map(m => {
    const isHome = m.team_h === player.team
    const opp = teamById.get(isHome ? m.team_a : m.team_h)?.short_name ?? '?'
    const fdr = isHome ? m.team_h_difficulty : m.team_a_difficulty
    return `${isHome ? 'home' : 'away'} vs ${opp} (${fdr <= 2 ? 'easy' : fdr === 3 ? 'average' : 'tough'})`
  })
  return matches.length > 1 ? `plays twice: ${segs.join(' + ')}` : segs[0]!
}

function buildDeterministicBrief(
  weakspots: WeakspotResult,
  ctx: AgentContext,
  trace: TraceEntry[],
  usage: { inputTokens: number; outputTokens: number },
  t0: number,
  inputHash: string,
  changeSummary: string,
): BriefResult {
  trace.push({ title: 'Deterministic fallback', text: 'Using scored pipeline for transfers and captain.' })

  const plan = buildTransferPlan(weakspots, ctx)
  trace.push(...plan.trace)

  const transfers: RankedTransferCard[] = plan.transfers.map(opt => {
    const pool =
      opt.candidatesForModel.length > 0 ? opt.candidatesForModel : [opt.topPick, ...opt.alternatives]
    const taggedOptions = selectAndTagOptions(pool)
    const topTagged = taggedOptions[0] ?? { candidate: opt.topPick, tag: 'balanced' as RiskTag }
    const tagMap = new Map<number, RiskTag>(taggedOptions.map(o => [o.candidate.player.id, o.tag]))
    return {
      sell: opt.sell,
      sellingPrice: opt.sellingPrice,
      topPick: topTagged.candidate,
      topPickReason: '',
      topPickWhy: { form: '', fixtures: '', price: '', risks: '' },
      topPickRiskTag: topTagged.tag,
      alternatives: taggedOptions.slice(1).map(o => ({
        candidate: o.candidate,
        reason: '',
        riskTag: tagMap.get(o.candidate.player.id) ?? 'balanced',
      })),
      whySell: '',
      swapReason: '',
      replans: opt.replans,
    }
  })

  // Post-transfer starting XI
  const startingXI =
    transfers.length > 0
      ? applyTransfersToStartingXI(
          transfers.map(t => ({ sellId: t.sell.player.id, buyId: t.topPick.player.id, buyPlayer: t.topPick.player })),
          ctx,
        )
      : ctx.picks.picks
          .filter(p => p.position <= 11)
          .map(p => ctx.bootstrap.elements.find(e => e.id === p.element))
          .filter((p): p is Player => p !== undefined)

  const nonGkStarters = startingXI
    .filter(p => p.element_type !== 1)
    .map(p => ({
      player: p,
      epNext: p.ep_next !== null ? parseFloat(p.ep_next) : parseFloat(p.form) * 0.9,
    }))
    .sort((a, b) => b.epNext - a.epNext)

  const [cap, vc, ...restForAlt] = nonGkStarters
  if (!cap || !vc) throw new Error('Not enough starting XI players for a captain pick')

  const allCaptainPicks = [cap, vc, ...(restForAlt.slice(0, 2))]
  const captainTags = assignCaptainTags(allCaptainPicks)

  const mkCaptainPick = (item: { player: Player; epNext: number }, label: string, tag: RiskTag): CaptainPick => ({
    player: item.player,
    reason: `${label} by ep_next this gameweek (${item.epNext.toFixed(1)} pts projected).`,
    why: {
      form: `Form ${item.player.form} over recent weeks.`,
      fixture: fixtureDisplay(item.player, ctx),
      risks: item.player.news || 'None identified',
    },
    riskTag: tag,
  })

  const captainResult: CaptainResult = {
    captain: mkCaptainPick(cap, 'Highest expected points', captainTags[0] ?? 'balanced'),
    vc: mkCaptainPick(vc, 'Second-highest expected points', captainTags[1] ?? 'balanced'),
    alternatives: allCaptainPicks
      .slice(2)
      .map((item, i) => mkCaptainPick(item, 'Alternative option', captainTags[i + 2] ?? 'balanced')),
    trace: [],
    usage: { inputTokens: 0, outputTokens: 0 },
  }

  return {
    save: plan.save,
    saveReason: plan.saveReason,
    transfers,
    captain: captainResult,
    trace: numberSteps(trace),
    meta: {
      gameweekId: ctx.gameweek.id,
      freeTransfers: ctx.freeTransfers,
      bank: ctx.bank,
      elapsedMs: Date.now() - t0,
      usage,
      inputHash,
      changeSummary,
    },
    whySellContext: weakspots.whySellContext,
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Runs the brief loop: loads context, scores the squad, then lets the model
 * investigate freely with tools and submit a recommendation via submit_brief.
 * Falls back to a deterministic pipeline on model failure or validation error.
 */
export async function generateBrief(
  teamId: number,
  opts?: {
    /** Reuse an existing client (shares its cache with the caller). */
    client?: FplClient
    onProgress?: (step: string) => void
  },
): Promise<BriefResult> {
  const t0 = Date.now()
  const client = opts?.client ?? new FplClient({ cache: new MemoryCacheAdapter() })
  const onProgress = opts?.onProgress ?? (() => {})

  onProgress('Loading your squad...')
  const ctx = await loadContext(teamId, client)
  const inputHash = computeInputHash(ctx)
  const changeSummary = computeChangeSummary(ctx)

  onProgress('Scoring your squad...')
  const weakspots = findWeakSpots(
    ctx.squadPlayers,
    ctx.picks.picks,
    ctx.allFixtures,
    ctx.bootstrap,
    ctx.freeTransfers,
  )

  const trace: TraceEntry[] = []
  const usage = { inputTokens: 0, outputTokens: 0 }

  trace.push({
    title: 'Context loaded',
    text: `GW${ctx.gameweek.id}. Squad: 15 players, £${(ctx.bank / 10).toFixed(1)}m bank, ${ctx.freeTransfers} free transfer${ctx.freeTransfers > 1 ? 's' : ''}.`,
  })
  trace.push({
    title: 'Squad scored',
    text: `Three weakest: ${weakspots.whySellContext.map(ws => `${ws.player.web_name} (${ws.score.total.toFixed(1)} pts)`).join(', ')}.`,
  })

  const model = process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-6'
  const anthropic = new Anthropic()

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildInitialPrompt(weakspots, ctx) },
  ]

  const MAX_TOOL_CALLS = 15
  let toolCallCount = 0
  let hasInvestigated = false
  let rejectedSkipOnce = false

  onProgress('Investigating with AI...')

  while (true) {
    const forceConclusion = toolCallCount >= MAX_TOOL_CALLS

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: BRIEF_TOOLS,
      tool_choice: forceConclusion
        ? { type: 'tool', name: 'submit_brief' }
        : { type: 'any' },
      messages,
    }

    let response: Anthropic.Message
    try {
      response = await anthropic.messages.create(params)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      trace.push({ title: 'Error', text: `Model call failed: ${msg} — using deterministic fallback.` })
      return buildDeterministicBrief(weakspots, ctx, trace, usage, t0, inputHash, changeSummary)
    }

    usage.inputTokens += response.usage.input_tokens
    usage.outputTokens += response.usage.output_tokens

    const submitBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_brief',
    )

    if (submitBlock) {
      const raw = submitBlock.input as SubmitBriefInput

      // Guard: must investigate before concluding
      if (!forceConclusion && !rejectedSkipOnce && !hasInvestigated) {
        rejectedSkipOnce = true
        trace.push({ title: 'Guard', text: 'Model tried to submit without investigating — requiring at least one tool call.' })
        onProgress('Gathering more data...')
        messages.push({ role: 'assistant', content: response.content })
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: submitBlock.id,
              content:
                'You must call at least one data tool (get_player, get_fixtures, compare, search_candidates, or check_constraints) before submitting.',
              is_error: true,
            },
          ],
        })
        continue
      }

      trace.push({
        title: 'Tokens used',
        text: `${usage.inputTokens} input / ${usage.outputTokens} output tokens.`,
      })

      const result = resolveSubmission(raw, weakspots, ctx, trace, usage, t0, inputHash, changeSummary)
      if (result) return result

      trace.push({ title: 'Fallback', text: 'Submission validation failed — using deterministic fallback.' })
      return buildDeterministicBrief(weakspots, ctx, trace, usage, t0, inputHash, changeSummary)
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
      trace.push({ title: `Tool: ${call.name}`, text: result.slice(0, 500) })
      toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: result })
      toolCallCount++
      hasInvestigated = true
    }

    messages.push({ role: 'user', content: toolResults })
  }

  trace.push({ title: 'Fallback', text: 'Loop ended without submission — using deterministic fallback.' })
  return buildDeterministicBrief(weakspots, ctx, trace, usage, t0, inputHash, changeSummary)
}
