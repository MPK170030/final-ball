import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FplClient, MemoryCacheAdapter, getActiveGameweek, getSquadGameweek, isDeadlinePassed } from '@finalball/agent'
import type { TraceStep } from '@finalball/agent'
import { BriefClient } from './brief-client'
import type { BriefData, BriefCard, ReceiptData, ReceiptRowData } from '@/components/brief/types'

export const dynamic = 'force-dynamic'

// ── Load FPL data (best-effort) ───────────────────────────────────────────────

interface FplPageData {
  gameweek: number
  deadlineMs: number | null
  freeTransfers: number
  bankTenths: number
  deadlinePassed: boolean
  fplOk: boolean
}

async function loadFplData(teamId: number): Promise<FplPageData> {
  try {
    const client = new FplClient({ cache: new MemoryCacheAdapter() })
    const bootstrap = await client.getBootstrap()
    const gw = getActiveGameweek(bootstrap)
    const squadGw = getSquadGameweek(bootstrap)
    const [picks, history] = await Promise.all([
      client.getEntryPicks(teamId, squadGw),
      client.getEntryHistory(teamId),
    ])
    const event = bootstrap.events.find(e => e.id === gw)

    // Derive free transfers: mirrors deriveFreeTransfers in context.ts
    const chipByEvent = new Map(history.chips.map(c => [c.event, c.name]))
    const pastEvents = history.current.filter(e => e.event < gw).sort((a, b) => a.event - b.event)
    let ft = 1
    for (const ev of pastEvents) {
      const chip = chipByEvent.get(ev.event)
      if (chip === 'wildcard') {
        ft = 1
      } else {
        // freehit squad is restored so those transfers don't count, but the week
        // still earns the +1 free transfer accumulation
        const effectiveTransfers = chip === 'freehit' ? 0 : ev.event_transfers
        const freeUsed = Math.min(ft, effectiveTransfers)
        ft = Math.min(2, ft - freeUsed + 1)
      }
    }

    return {
      gameweek: gw,
      deadlineMs: event ? event.deadline_time_epoch * 1000 : null,
      freeTransfers: ft,
      bankTenths: picks.entry_history.bank,
      deadlinePassed: isDeadlinePassed(bootstrap, gw),
      fplOk: true,
    }
  } catch {
    return { gameweek: 1, deadlineMs: null, freeTransfers: 1, bankTenths: 0, deadlinePassed: false, fplOk: false }
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BriefPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.team_id) redirect('/onboarding')

  const teamId = profile.team_id
  const teamName = profile.team_name ?? 'Your team'
  const displayName =
    (profile.manager_name as string | null) ??
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    ''
  const initial = displayName[0]?.toUpperCase() ?? '?'

  // Load FPL data first so we know the current gameweek for the version count query
  const fplData = await loadFplData(teamId)
  const fplGameweek = fplData.gameweek
  // International break: deadline is > 8 days away — brief exists as a planning tool
  const isEarlyPlanning =
    !fplData.deadlinePassed &&
    fplData.deadlineMs !== null &&
    fplData.deadlineMs - Date.now() > 8 * 24 * 60 * 60 * 1000

  // Then load the latest brief + counter usage + recent decisions in parallel
  const [latestBriefRes, counterUsageRes, decisionsRes] = await Promise.all([
    supabase
      .from('briefs')
      .select('id, gameweek, version, status, trace, generated_at, change_summary')
      .eq('user_id', user.id)
      .eq('status', 'ready')
      .order('gameweek', { ascending: false })
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('counter_usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('gameweek', fplGameweek)
      .maybeSingle(),
    // Last 5 GWs of decisions
    supabase
      .from('decisions')
      .select('id, gameweek, label, risk_tag, actual_move')
      .eq('user_id', user.id)
      .order('gameweek', { ascending: false })
      .limit(20),
  ])

  const briefRow = latestBriefRes.data
  // When FPL is down, loadFplData falls back to GW 1 which is wrong.
  // Use the user's latest brief GW instead — it's the best proxy for the real current GW.
  const gameweek = !fplData.fplOk && briefRow ? briefRow.gameweek : fplGameweek
  const countersThisGw = counterUsageRes.data?.count ?? 0

  // Build receipts data from the last 5 GWs of decisions
  const rawDecisions = decisionsRes.data ?? []
  const decisionIds = rawDecisions.map((d) => d.id)

  const intentsMap = new Map<string, string>()
  const receiptsMap = new Map<string, {
    window_start_gw: number; window_end_gw: number; player_in_pts: number | null
    player_out_pts: number | null; delta_pts: number | null; status: string
  }>()

  if (decisionIds.length > 0) {
    const [intentsRes, receiptsRes] = await Promise.all([
      supabase.from('intents').select('decision_id, inferred').in('decision_id', decisionIds),
      supabase.from('receipts')
        .select('decision_id, window_start_gw, window_end_gw, player_in_pts, player_out_pts, delta_pts, status')
        .in('decision_id', decisionIds),
    ])
    for (const r of intentsRes.data ?? []) intentsMap.set(r.decision_id, r.inferred)
    for (const r of receiptsRes.data ?? []) receiptsMap.set(r.decision_id, r)
  }

  const GW_WINDOW = 5
  const minGw = gameweek - GW_WINDOW
  const receiptRows: ReceiptRowData[] = rawDecisions
    .filter((d) => d.gameweek > minGw)
    .map((d) => {
      const move = d.actual_move as {
        element_in?: number; element_in_name?: string | null
        element_out?: number; element_out_name?: string | null
      } | null
      const receipt = receiptsMap.get(d.id) ?? null
      return {
        decisionId: d.id,
        gameweek: d.gameweek,
        label: d.label as ReceiptRowData['label'],
        riskTag: (d.risk_tag as ReceiptRowData['riskTag']) ?? null,
        intent: ((intentsMap.get(d.id) ?? 'points') as ReceiptRowData['intent']),
        actualMove: move
          ? {
              element_in: move.element_in ?? 0,
              element_in_name: move.element_in_name ?? null,
              element_out: move.element_out ?? 0,
              element_out_name: move.element_out_name ?? null,
            }
          : null,
        receipt: receipt
          ? {
              windowStartGw: receipt.window_start_gw,
              windowEndGw: receipt.window_end_gw,
              playerInPts: receipt.player_in_pts,
              playerOutPts: receipt.player_out_pts,
              deltaPts: receipt.delta_pts,
              status: receipt.status as 'pending' | 'settled',
            }
          : null,
      }
    })
  const receiptData: ReceiptData = { rows: receiptRows }

  // Load cards if we have a brief
  let briefData: BriefData | null = null
  if (briefRow && briefRow.gameweek === gameweek) {
    const { data: cardRows } = await supabase
      .from('cards')
      .select('id, type, position, payload')
      .eq('brief_id', briefRow.id)
      .order('position', { ascending: true })

    briefData = {
      id: briefRow.id,
      gameweek: briefRow.gameweek,
      version: briefRow.version,
      generatedAt: briefRow.generated_at ?? new Date().toISOString(),
      trace: (briefRow.trace as TraceStep[]) ?? [],
      cards: (cardRows ?? []) as BriefCard[],
      changeSummary: (briefRow.change_summary as string | null) ?? null,
    }
  }

  return (
    <BriefClient
      initialBrief={briefData}
      gameweek={gameweek}
      deadlineMs={fplData.deadlineMs}
      freeTransfers={fplData.freeTransfers}
      bankTenths={fplData.bankTenths}
      countersThisGw={countersThisGw}
      isDeadlinePassed={fplData.deadlinePassed}
      isEarlyPlanning={isEarlyPlanning}
      isFplUpdating={!fplData.fplOk}
      displayName={displayName}
      initial={initial}
      teamName={teamName}
      receiptData={receiptData}
    />
  )
}
