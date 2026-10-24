import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FplClient, MemoryCacheAdapter, getActiveGameweek, isDeadlinePassed } from '@finalball/agent'
import type { TraceStep } from '@finalball/agent'
import { BriefClient } from './brief-client'
import type { BriefData, BriefCard } from '@/components/brief/types'

export const dynamic = 'force-dynamic'

// ── Load FPL data (best-effort) ───────────────────────────────────────────────

interface FplPageData {
  gameweek: number
  deadlineMs: number | null
  freeTransfers: number
  bankTenths: number
  deadlinePassed: boolean
}

async function loadFplData(teamId: number): Promise<FplPageData> {
  try {
    const client = new FplClient({ cache: new MemoryCacheAdapter() })
    const bootstrap = await client.getBootstrap()
    const gw = getActiveGameweek(bootstrap)
    const [picks, history] = await Promise.all([
      client.getEntryPicks(teamId, gw),
      client.getEntryHistory(teamId),
    ])
    const event = bootstrap.events.find(e => e.id === gw)

    // Derive free transfers: count unused transfers from past GWs
    const chipByEvent = new Map(history.chips.map(c => [c.event, c.name]))
    const pastEvents = history.current.filter(e => e.event < gw).sort((a, b) => a.event - b.event)
    let ft = 1
    for (const ev of pastEvents) {
      const chip = chipByEvent.get(ev.event)
      if (chip === 'wildcard') { ft = 1; continue }
      if (chip === 'freehit') continue
      const used = ev.event_transfers
      ft = Math.min(2, ft - used + 1)
      if (ft < 1) ft = 1
    }

    return {
      gameweek: gw,
      deadlineMs: event ? event.deadline_time_epoch * 1000 : null,
      freeTransfers: ft,
      bankTenths: picks.entry_history.bank,
      deadlinePassed: isDeadlinePassed(bootstrap, gw),
    }
  } catch {
    return { gameweek: 1, deadlineMs: null, freeTransfers: 1, bankTenths: 0, deadlinePassed: false }
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

  // Load in parallel: FPL data + latest brief + today's usage
  const today = new Date().toISOString().slice(0, 10)
  const [fplData, latestBriefRes, usageRes] = await Promise.all([
    loadFplData(teamId),
    supabase
      .from('briefs')
      .select('id, gameweek, version, status, trace, generated_at')
      .eq('user_id', user.id)
      .eq('status', 'ready')
      .order('gameweek', { ascending: false })
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('generation_usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),
  ])

  const briefRow = latestBriefRes.data
  const usageToday = usageRes.data?.count ?? 0
  const gameweek = fplData.gameweek

  // Load cards if we have a brief
  let briefData: BriefData | null = null
  if (briefRow) {
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
    }
  }

  return (
    <BriefClient
      initialBrief={briefData}
      gameweek={gameweek}
      deadlineMs={fplData.deadlineMs}
      freeTransfers={fplData.freeTransfers}
      bankTenths={fplData.bankTenths}
      usageToday={usageToday}
      isDeadlinePassed={fplData.deadlinePassed}
      displayName={displayName}
      initial={initial}
      teamName={teamName}
    />
  )
}
