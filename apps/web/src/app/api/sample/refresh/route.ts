import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { generateBrief, FplClient, MemoryCacheAdapter, getActiveGameweek } from '@finalball/agent'
import type { BriefResult } from '@finalball/agent'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const OWNER_EMAIL = 'manavkothari17@gmail.com'

// ── Card payload builder (same shape as /api/brief/generate) ──────────────────

type SampleCard = {
  id: string
  type: 'transfer' | 'captain'
  position: number
  payload: unknown
}

function buildCards(result: BriefResult): SampleCard[] {
  const rows: SampleCard[] = []
  let pos = 1
  let id = 1

  if (result.save) {
    rows.push({
      id: String(id++),
      type: 'transfer',
      position: pos++,
      payload: {
        save: true,
        reason: result.saveReason ?? '',
        bestOption: result.bestOptionForComparison ?? null,
      },
    })
  } else {
    for (const card of result.transfers) {
      rows.push({
        id: String(id++),
        type: 'transfer',
        position: pos++,
        payload: {
          save: false,
          sell: card.sell,
          sellingPrice: card.sellingPrice,
          topPick: card.topPick,
          topPickReason: card.topPickReason,
          topPickWhy: card.topPickWhy,
          alternatives: card.alternatives,
          whySell: card.whySell,
          swapReason: card.swapReason,
          replans: card.replans,
          whySellContext: result.whySellContext,
        },
      })
    }
  }

  rows.push({
    id: String(id++),
    type: 'captain',
    position: pos,
    payload: {
      captain: result.captain.captain,
      vc: result.captain.vc,
      alternatives: result.captain.alternatives,
    },
  })

  return rows
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST() {
  // Require owner authentication
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const teamIdStr = process.env['SAMPLE_TEAM_ID']
  if (!teamIdStr) {
    return NextResponse.json({ error: 'SAMPLE_TEAM_ID not set' }, { status: 500 })
  }
  const teamId = parseInt(teamIdStr, 10)
  if (isNaN(teamId)) {
    return NextResponse.json({ error: 'SAMPLE_TEAM_ID must be a number' }, { status: 500 })
  }

  try {
    const fplClient = new FplClient({ cache: new MemoryCacheAdapter() })

    // Load bootstrap to get gameweek + deadline
    const bootstrap = await fplClient.getBootstrap()
    const gameweek = getActiveGameweek(bootstrap)
    const event = bootstrap.events.find(e => e.id === gameweek)
    const deadlineMs = event ? event.deadline_time_epoch * 1000 : null

    // Load picks + history for FT count and bank
    const [picks, history, entry] = await Promise.all([
      fplClient.getEntryPicks(teamId, gameweek),
      fplClient.getEntryHistory(teamId),
      fplClient.getEntry(teamId),
    ])

    const bankTenths = picks.entry_history.bank

    // Calculate free transfers
    const chipByEvent = new Map(history.chips.map(c => [c.event, c.name]))
    const pastEvents = history.current
      .filter(e => e.event < gameweek)
      .sort((a, b) => a.event - b.event)
    let ft = 1
    for (const ev of pastEvents) {
      const chip = chipByEvent.get(ev.event)
      if (chip === 'wildcard') { ft = 1; continue }
      if (chip === 'freehit') continue
      const used = ev.event_transfers
      ft = Math.min(2, ft - used + 1)
      if (ft < 1) ft = 1
    }

    // Run the full agent pipeline (shares the already-warm fplClient cache)
    const result = await generateBrief(teamId, { client: fplClient })

    const service = createServiceClient()

    // Upsert the single 'current' row
    const { error } = await service
      .from('sample_brief')
      .upsert({
        key: 'current',
        gameweek,
        version: 1,
        trace: result.trace,
        cards: buildCards(result),
        meta: {
          teamName: entry.name,
          freeTransfers: ft,
          bankTenths,
          deadlineMs,
        },
        generated_at: new Date().toISOString(),
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Bust the Next.js cache for the sample page and OG image
    revalidatePath('/sample')
    revalidatePath('/api/og/sample')

    return NextResponse.json({
      ok: true,
      gameweek,
      teamName: entry.name,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[sample/refresh] error', { teamId: teamIdStr, msg }, err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
