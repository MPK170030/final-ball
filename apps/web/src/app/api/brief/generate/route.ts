import { NextRequest, NextResponse } from 'next/server'
import {
  generateBrief,
  computeInputHash,
  loadContext,
  FplClient,
  FplError,
  MemoryCacheAdapter,
  getActiveGameweek,
} from '@finalball/agent'
import type { BriefResult } from '@finalball/agent'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const VERSION_CAP = 3

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

  // Concurrent generation guard — also recover from rows stuck in 'generating'
  // if Vercel killed the function at maxDuration before the catch block ran.
  const serviceClient = createServiceClient()
  const staleCutoff = new Date(Date.now() - 360_000).toISOString() // 6 min > maxDuration

  const { data: generating } = await supabase
    .from('briefs')
    .select('id, created_at')
    .eq('user_id', user.id)
    .eq('status', 'generating')
    .maybeSingle()

  if (generating) {
    if (generating.created_at >= staleCutoff) {
      return NextResponse.json({ error: 'already_generating' }, { status: 409 })
    }
    // Stale — clean it up so the new attempt can proceed
    await serviceClient
      .from('briefs')
      .update({ status: 'error', error: 'Generation timed out' })
      .eq('id', generating.id)
  }

  // ── SSE setup ───────────────────────────────────────────────────────────────
  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const send = (data: object) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

  // ── Async generation task ───────────────────────────────────────────────────
  ;(async () => {
    let briefId: string | null = null

    try {
      // Get active gameweek — needed to fetch existing versions and detect FPL updating
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

      // Fetch all ready briefs for this user+gameweek (version cap + hash check)
      const { data: existingBriefs } = await serviceClient
        .from('briefs')
        .select('version, input_hash, generated_at')
        .eq('user_id', user.id)
        .eq('gameweek', gameweek)
        .eq('status', 'ready')
        .order('version', { ascending: false })

      const readyCount = existingBriefs?.length ?? 0

      // Version cap: 3 per gameweek (D10.5, US-4.2)
      if (readyCount >= VERSION_CAP) {
        await send({ status: 'cap_reached' })
        return
      }

      // Hash comparison: if latest brief has a hash, check whether inputs changed (D10.6)
      const latestBrief = existingBriefs?.[0]
      if (latestBrief?.input_hash) {
        const ctx = await loadContext(teamId, fplClient)
        const newHash = computeInputHash(ctx)
        if (newHash === latestBrief.input_hash) {
          await send({ status: 'no_change', lastGenerated: latestBrief.generated_at })
          return
        }
      }

      const nextVersion = (existingBriefs?.[0]?.version ?? 0) + 1

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

      // Run the agent pipeline; fplClient already has bootstrap (and context if loaded above) cached
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

      // Mark brief as ready, storing the input hash and change summary (D10.6)
      const { error: updateErr } = await serviceClient
        .from('briefs')
        .update({
          status: 'ready',
          trace: result.trace,
          generated_at: new Date().toISOString(),
          input_hash: result.meta.inputHash,
          change_summary: latestBrief ? result.meta.changeSummary : null,
        })
        .eq('id', briefId)

      if (updateErr) throw new Error(updateErr.message)

      await send({ status: 'ready', briefId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[brief/generate] pipeline error', { teamId, briefId, msg }, err)
      await send({ status: 'error', message: msg })
      if (briefId) {
        void serviceClient
          .from('briefs')
          .update({ status: 'error', error: msg })
          .eq('id', briefId)
      }
    } finally {
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
