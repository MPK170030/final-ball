import type { AgentContext } from '../context.js'
import type { BootstrapChip, Fixture } from '../fpl/types.js'

export type ChipName = 'wildcard' | 'freehit' | '3xc' | 'bboost'

const KNOWN_CHIPS: ReadonlySet<string> = new Set(['wildcard', 'freehit', '3xc', 'bboost'])

const CHIP_DISPLAY: Record<ChipName, string> = {
  wildcard: 'Wildcard',
  freehit: 'Free Hit',
  '3xc': 'Triple Captain',
  bboost: 'Bench Boost',
}

export interface ChipWindow {
  startEvent: number
  stopEvent: number
}

export interface ChipStatus {
  name: ChipName
  displayName: string
  used: boolean
  usedInEvent?: number
  window: ChipWindow
  /** True when the chip's window has opened and it has not yet been used. */
  playable: boolean
}

export interface SpecialGw {
  gwId: number
  dgwTeamCount: number
  bgwTeamCount: number
}

export interface ChipTimingAdvice {
  chip: ChipName
  recommendation: string
  targetGwId?: number
  /** Always true — advice is from fixture data which may change (D5.7). */
  provisional: boolean
}

export interface ChipAdvice {
  status: ChipStatus[]
  timing: ChipTimingAdvice[]
  expiryNudge?: string
  /** BGW/DGW scan across the full fixture list (D5.7). */
  specialGws: SpecialGw[]
}

// ── BGW/DGW scan ──────────────────────────────────────────────────────────────

function scanSpecialGws(allFixtures: Fixture[], fromGwId: number, totalTeams: number): SpecialGw[] {
  const gwTeamCount = new Map<number, Map<number, number>>()

  for (const f of allFixtures) {
    if (f.event === null || f.event < fromGwId) continue
    if (!gwTeamCount.has(f.event)) gwTeamCount.set(f.event, new Map())
    const teams = gwTeamCount.get(f.event)!
    teams.set(f.team_h, (teams.get(f.team_h) ?? 0) + 1)
    teams.set(f.team_a, (teams.get(f.team_a) ?? 0) + 1)
  }

  const result: SpecialGw[] = []
  for (const [gwId, teams] of gwTeamCount) {
    const dgwTeamCount = Array.from(teams.values()).filter(c => c >= 2).length
    const bgwTeamCount = totalTeams - teams.size
    if (dgwTeamCount > 0 || bgwTeamCount > 0) {
      result.push({ gwId, dgwTeamCount, bgwTeamCount })
    }
  }

  return result.sort((a, b) => a.gwId - b.gwId)
}

// ── Timing advice ─────────────────────────────────────────────────────────────

function adviseTc(ctx: AgentContext, specialGws: SpecialGw[]): ChipTimingAdvice {
  // Find the best captain candidate from the starting XI (highest ep_next)
  const startingIds = new Set(ctx.picks.picks.filter(p => p.position <= 11).map(p => p.element))
  const starters = ctx.squadPlayers.filter(p => startingIds.has(p.id))
  const best = starters
    .map(p => ({ player: p, ep: p.ep_next !== null ? parseFloat(p.ep_next) : parseFloat(p.form) * 0.9 }))
    .sort((a, b) => b.ep - a.ep)[0]

  if (!best) {
    return { chip: '3xc', recommendation: 'No starting XI data available.', provisional: true }
  }

  const teamId = best.player.team
  const teamName = ctx.bootstrap.teams.find(t => t.id === teamId)?.short_name ?? 'your captain'

  // Find best upcoming GW for this player: prefer DGW, then easiest single fixture
  const teamDgw = specialGws.find(sg => {
    const teamFixtures = ctx.allFixtures.filter(
      f => f.event === sg.gwId && (f.team_h === teamId || f.team_a === teamId),
    )
    return teamFixtures.length >= 2
  })

  if (teamDgw) {
    return {
      chip: '3xc',
      recommendation: `GW${teamDgw.gwId} — ${teamName} has a double gameweek. Tripling your captain there could yield up to 3× their score across both matches.`,
      targetGwId: teamDgw.gwId,
      provisional: true,
    }
  }

  // Find the GW with best fixture (lowest FDR) for the best captain
  const upcoming = ctx.allFixtures
    .filter(f => f.event !== null && f.event >= ctx.gameweek.id && (f.team_h === teamId || f.team_a === teamId))
    .map(f => ({
      gwId: f.event!,
      fdr: f.team_h === teamId ? f.team_h_difficulty : f.team_a_difficulty,
    }))
    .sort((a, b) => a.fdr - b.fdr || a.gwId - b.gwId)

  const easiest = upcoming[0]
  if (easiest && easiest.fdr <= 2) {
    return {
      chip: '3xc',
      recommendation: `GW${easiest.gwId} looks strong — ${teamName} has an easy fixture (FDR ${easiest.fdr}). Play Triple Captain when ${teamName} faces the softest run.`,
      targetGwId: easiest.gwId,
      provisional: true,
    }
  }

  return {
    chip: '3xc',
    recommendation: `No clearly standout gameweek yet — wait for a confirmed double gameweek or an easy fixture run for ${teamName} before playing Triple Captain.`,
    provisional: true,
  }
}

function adviseBb(ctx: AgentContext, specialGws: SpecialGw[]): ChipTimingAdvice {
  // Find the upcoming DGW where the most squad players play twice
  let bestGw: { gwId: number; count: number } | undefined

  for (const sg of specialGws) {
    if (sg.dgwTeamCount === 0) continue
    const dgwTeams = new Set(
      ctx.allFixtures
        .filter(f => f.event === sg.gwId)
        .flatMap(f => [f.team_h, f.team_a])
        .filter(teamId => {
          const matches = ctx.allFixtures.filter(
            f => f.event === sg.gwId && (f.team_h === teamId || f.team_a === teamId),
          )
          return matches.length >= 2
        }),
    )
    const count = ctx.squadPlayers.filter(p => dgwTeams.has(p.team)).length
    if (!bestGw || count > bestGw.count) {
      bestGw = { gwId: sg.gwId, count }
    }
  }

  if (bestGw && bestGw.count >= 2) {
    return {
      chip: 'bboost',
      recommendation: `GW${bestGw.gwId} — ${bestGw.count} of your squad have a double gameweek. Bench Boost lets your whole squad score, maximising returns across both matches.`,
      targetGwId: bestGw.gwId,
      provisional: true,
    }
  }

  return {
    chip: 'bboost',
    recommendation:
      'No confirmed double gameweek yet. Hold your Bench Boost until a week where your whole squad plays twice — that is when it scores the most.',
    provisional: true,
  }
}

function adviseWc(): ChipTimingAdvice {
  return {
    chip: 'wildcard',
    recommendation:
      'Use when you have 3 or more players to replace or need a full squad rebuild after injuries and price rises. No specific timing target from fixture data alone.',
    provisional: true,
  }
}

function adviseFh(specialGws: SpecialGw[]): ChipTimingAdvice {
  const bgwGw = specialGws.find(sg => sg.bgwTeamCount >= 3)
  if (bgwGw) {
    return {
      chip: 'freehit',
      recommendation: `GW${bgwGw.gwId} has ${bgwGw.bgwTeamCount} teams without a fixture (provisional blank gameweek). Free Hit lets you field a temporary squad around the teams that do play.`,
      targetGwId: bgwGw.gwId,
      provisional: true,
    }
  }

  const dgwGw = specialGws.find(sg => sg.dgwTeamCount >= 3)
  if (dgwGw) {
    return {
      chip: 'freehit',
      recommendation: `GW${dgwGw.gwId} has ${dgwGw.dgwTeamCount} teams with a double gameweek. Free Hit lets you temporarily stack that GW with DGW players.`,
      targetGwId: dgwGw.gwId,
      provisional: true,
    }
  }

  return {
    chip: 'freehit',
    recommendation:
      'No confirmed blank or double gameweek yet. Free Hit is most powerful when you can field a temporary squad built entirely around teams that play twice or dodge a blank.',
    provisional: true,
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeChipAdvice(ctx: AgentContext): ChipAdvice {
  const { bootstrap, allFixtures, gameweek, usedChips } = ctx
  const totalTeams = bootstrap.teams.length

  // 1. Build chip status from bootstrap.chips, cross-referenced with usedChips
  const validChips = (bootstrap.chips as BootstrapChip[]).filter(bc => KNOWN_CHIPS.has(bc.name))
  const status: ChipStatus[] = validChips
    .filter(bc => bc.stop_event >= gameweek.id)
    .map(bc => {
      const usedInstance = usedChips.find(
        uc => uc.name === bc.name && uc.event >= bc.start_event && uc.event <= bc.stop_event,
      )
      const isOpen = bc.start_event <= gameweek.id
      return {
        name: bc.name as ChipName,
        displayName: CHIP_DISPLAY[bc.name as ChipName],
        used: !!usedInstance,
        usedInEvent: usedInstance?.event,
        window: { startEvent: bc.start_event, stopEvent: bc.stop_event },
        playable: isOpen && !usedInstance,
      }
    })

  // 2. Scan full fixture list for BGW/DGW (D5.7)
  const specialGws = scanSpecialGws(allFixtures, gameweek.id, totalTeams)

  // 3. Timing advice for available chips only
  const timing: ChipTimingAdvice[] = []
  const availableInCurrentWindow = status.filter(
    s => !s.used && s.window.startEvent <= gameweek.id,
  )
  for (const cs of availableInCurrentWindow) {
    if (cs.name === '3xc') timing.push(adviseTc(ctx, specialGws))
    else if (cs.name === 'bboost') timing.push(adviseBb(ctx, specialGws))
    else if (cs.name === 'wildcard') timing.push(adviseWc())
    else if (cs.name === 'freehit') timing.push(adviseFh(specialGws))
  }

  // 4. Expiry nudge (D5.3): count available chips expiring soon
  const firstWindowStop = validChips.reduce((min, bc) => Math.min(min, bc.stop_event), Infinity)
  const availableExpiring = status.filter(
    s => !s.used && s.window.stopEvent === firstWindowStop && s.window.startEvent <= gameweek.id,
  )
  const gwsUntilExpiry = firstWindowStop - gameweek.id + 1
  let expiryNudge: string | undefined
  if (availableExpiring.length > 0 && gwsUntilExpiry <= 8) {
    const label = availableExpiring.length === 1 ? '1 chip expires' : `${availableExpiring.length} chips expire`
    expiryNudge = `${label} at the GW${firstWindowStop} deadline — ${gwsUntilExpiry} gameweek${gwsUntilExpiry === 1 ? '' : 's'} away.`
  }

  return { status, timing, expiryNudge, specialGws }
}
