import { NextRequest, NextResponse } from 'next/server'
import { generateBrief, FplClient, FplError, MemoryCacheAdapter, getActiveGameweek } from '@finalball/agent'
import type { BriefResult } from '@finalball/agent'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const DAILY_CAP = 3

// ── Card payload builder ──────────────────────────────────────────────────────

type CardInsert = {
  brief_id: string
  type: 'transfer' | 'captain'
  position: number
  payload: unknown
}

function buildCardRows(briefId: string, result: BriefResult): CardInsert[] {
  const rows: CardInsert[] = []
  let pos = 1

  if (result.save) {
    rows.push({
      brief_id: briefId,
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
        brief_id: briefId,
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
    brief_id: briefId,
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

export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Require a linked team
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()

  if (!profile?.team_id) {
    return NextResponse.json({ error: 'no_team' }, { status: 422 })
  }
  const teamId = profile.team_id

  // First-brief exemption (D15.3): the very first brief for a user is free
  const { count: briefCount } = await supabase
    .from('briefs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const isFirstBrief = (briefCount ?? 0) === 0

  // Daily cap check — skipped for the first brief
  const today = new Date().toISOString().slice(0, 10)
  let currentUsageCount = 0

  if (!isFirstBrief) {
    const { data: usage } = await supabase
      .from('generation_usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle()

    currentUsageCount = usage?.count ?? 0
    if (currentUsageCount >= DAILY_CAP) {
      return NextResponse.json({ error: 'cap_reached' }, { status: 429 })
    }
  }

  // Concurrent generation guard
  const { data: generating } = await supabase
    .from('briefs')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'generating')
    .maybeSingle()

  if (generating) {
    return NextResponse.json({ error: 'already_generating' }, { status: 409 })
  }

  // ── SSE setup ───────────────────────────────────────────────────────────────
  const serviceClient = createServiceClient()
  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const send = (data: object) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

  // ── Async generation task ───────────────────────────────────────────────────
  ;(async () => {
    let briefId: string | null = null
    let success = false

    try {
      // Get active gameweek — needed to create the brief row and detect FPL updating
      await send({ step: 'Connecting to FPL...' })
      const fplClient = new FplClient({ cache: new MemoryCacheAdapter() })

      let gameweek: number
      try {
        const bootstrap = await fplClient.getBootstrap()
        gameweek = getActiveGameweek(bootstrap)
      } catch (err) {
        if (err instanceof FplError && err.status === 503) {
          await send({ status: 'fpl_updating' })
          return
        }
        throw err
      }

      // Determine next version for this user+gameweek (handles same-gameweek regeneration)
      const { data: existing } = await serviceClient
        .from('briefs')
        .select('version')
        .eq('user_id', user.id)
        .eq('gameweek', gameweek)
        .order('version', { ascending: false })
        .limit(1)

      const nextVersion = (existing?.[0]?.version ?? 0) + 1

      // Create the brief row now so the concurrent guard holds for the full run
      const { data: briefRow, error: briefErr } = await serviceClient
        .from('briefs')
        .insert({ user_id: user.id, gameweek, version: nextVersion, status: 'generating' })
        .select('id')
        .single()

      if (briefErr || !briefRow) {
        throw new Error(briefErr?.message ?? 'Failed to create brief row')
      }
      briefId = briefRow.id

      // Run the agent pipeline; bootstrap is already cached in fplClient
      const result = await generateBrief(teamId, {
        client: fplClient,
        onProgress: (step) => void send({ step }),
      })

      await send({ step: 'Saving your brief...' })

      // Insert cards
      const { error: cardsErr } = await serviceClient
        .from('cards')
        .insert(buildCardRows(briefId, result))

      if (cardsErr) throw new Error(cardsErr.message)

      // Mark brief as ready
      const { error: updateErr } = await serviceClient
        .from('briefs')
        .update({
          status: 'ready',
          trace: result.trace,
          generated_at: new Date().toISOString(),
        })
        .eq('id', briefId)

      if (updateErr) throw new Error(updateErr.message)

      success = true
      await send({ status: 'ready', briefId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      await send({ status: 'error', message: msg })
      if (briefId) {
        void serviceClient
          .from('briefs')
          .update({ status: 'error', error: msg })
          .eq('id', briefId)
      }
    } finally {
      // Only count toward the cap on success, and never for the first brief (D15.3, D15.5)
      if (success && !isFirstBrief) {
        void serviceClient
          .from('generation_usage')
          .upsert({ user_id: user.id, date: today, count: currentUsageCount + 1 })
      }
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
