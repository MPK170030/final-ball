import { NextRequest, NextResponse } from 'next/server'
import {
  generateCounter,
  loadContext,
  FplClient,
  MemoryCacheAdapter,
} from '@finalball/agent'
import type { CounterCard, WeakspotCounterCard } from '@finalball/agent'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const COUNTER_CAP = 10

// ── CounterCard builder ───────────────────────────────────────────────────────

const ELEMENT_TYPE_TO_POS: Record<number, 'GK' | 'DEF' | 'MID' | 'FWD'> = {
  1: 'GK',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
}

function buildCounterCard(
  cardType: string,
  payload: unknown,
  gameweek: number,
  counterType?: string,
): CounterCard | null {
  const p = payload as Record<string, unknown>

  if (counterType === 'weakspot' && cardType === 'transfer') {
    if (p['save'] === true) return null
    const sell = p['sell'] as Record<string, unknown>
    const sellPlayer = sell['player'] as Record<string, unknown>
    const whySellContext = (p['whySellContext'] as Array<Record<string, unknown>>) ?? []
    return {
      type: 'weakspot',
      gameweek,
      sellPlayerName: sellPlayer['web_name'] as string,
      sellPlayerPos: ELEMENT_TYPE_TO_POS[sellPlayer['element_type'] as number] ?? 'MID',
      whySell: p['whySell'] as string,
      weakSpots: whySellContext.slice(0, 3).map(ws => {
        const wsPlayer = ws['player'] as Record<string, unknown>
        const wsScore = ws['score'] as Record<string, unknown>
        return {
          name: wsPlayer['web_name'] as string,
          pos: ELEMENT_TYPE_TO_POS[wsPlayer['element_type'] as number] ?? '?',
          scoreTotal: (wsScore['total'] as number) ?? 0,
        }
      }),
    } satisfies WeakspotCounterCard
  }

  if (cardType === 'captain') {
    const captain = p['captain'] as Record<string, unknown>
    const vc = p['vc'] as Record<string, unknown>
    const alternatives = (p['alternatives'] as Array<Record<string, unknown>>) ?? []
    return {
      type: 'captain',
      gameweek,
      captainName: (captain['player'] as Record<string, unknown>)['web_name'] as string,
      captainRiskTag: captain['riskTag'] as string,
      captainReason: captain['reason'] as string,
      captainWhy: captain['why'] as { form: string; fixture: string; risks: string },
      vcName: (vc['player'] as Record<string, unknown>)['web_name'] as string,
      vcRiskTag: vc['riskTag'] as string,
      vcReason: vc['reason'] as string,
      alternatives: alternatives.map(alt => ({
        name: (alt['player'] as Record<string, unknown>)['web_name'] as string,
        riskTag: alt['riskTag'] as string,
        reason: alt['reason'] as string,
      })),
    }
  }

  if (cardType === 'transfer') {
    if (p['save'] === true) {
      const bestOption = p['bestOption'] as Record<string, unknown> | null | undefined
      return {
        type: 'transfer',
        save: true,
        gameweek,
        saveReason: p['reason'] as string,
        bestOptionName: bestOption
          ? ((bestOption['player'] as Record<string, unknown>)['web_name'] as string)
          : undefined,
        bestOptionReason: bestOption ? (bestOption['reason'] as string | undefined) : undefined,
      }
    }

    const sell = p['sell'] as Record<string, unknown>
    const topPick = p['topPick'] as Record<string, unknown>
    const alternatives = (p['alternatives'] as Array<Record<string, unknown>>) ?? []
    const sellPlayer = sell['player'] as Record<string, unknown>

    return {
      type: 'transfer',
      save: false,
      gameweek,
      sellPlayerName: sellPlayer['web_name'] as string,
      sellPlayerPos: ELEMENT_TYPE_TO_POS[sellPlayer['element_type'] as number] ?? 'MID',
      topPickName: (topPick['player'] as Record<string, unknown>)['web_name'] as string,
      topPickRiskTag: p['topPickRiskTag'] as string,
      topPickReason: p['topPickReason'] as string,
      topPickWhy: p['topPickWhy'] as { form: string; fixtures: string; price: string; risks: string },
      alternatives: alternatives.map(alt => ({
        name: ((alt['candidate'] as Record<string, unknown>)['player'] as Record<string, unknown>)['web_name'] as string,
        riskTag: alt['riskTag'] as string,
        reason: alt['reason'] as string,
      })),
      whySell: p['whySell'] as string,
    }
  }

  return null
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { cardId?: string; quickReply?: string | null; message?: string; counterType?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { cardId, quickReply = null, message, counterType } = body
  if (!cardId || !message?.trim()) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // ── Card ownership check ─────────────────────────────────────────────────
  const { data: cardRow } = await serviceClient
    .from('cards')
    .select('id, type, payload, brief_id')
    .eq('id', cardId)
    .single()

  if (!cardRow) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: brief } = await serviceClient
    .from('briefs')
    .select('user_id, gameweek')
    .eq('id', cardRow.brief_id)
    .single()

  if (!brief) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (brief.user_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { gameweek } = brief

  // ── Counter cap check ────────────────────────────────────────────────────
  const { data: usage } = await serviceClient
    .from('counter_usage')
    .select('count')
    .eq('user_id', user.id)
    .eq('gameweek', gameweek)
    .maybeSingle()

  if ((usage?.count ?? 0) >= COUNTER_CAP) {
    return NextResponse.json({ error: 'cap_reached' }, { status: 429 })
  }

  // ── Require a linked team ────────────────────────────────────────────────
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()

  if (!profile?.team_id) {
    return NextResponse.json({ error: 'no_team' }, { status: 422 })
  }

  // ── Build CounterCard ────────────────────────────────────────────────────
  const counterCard = buildCounterCard(cardRow.type, cardRow.payload, gameweek, counterType)
  if (!counterCard) {
    return NextResponse.json({ error: 'unsupported_card_type' }, { status: 422 })
  }

  // ── Create pending counter row ───────────────────────────────────────────
  const { data: counterRow, error: counterErr } = await serviceClient
    .from('counters')
    .insert({
      user_id: user.id,
      card_id: cardId,
      gameweek,
      quick_reply: quickReply ?? null,
      message,
      status: 'pending',
    })
    .select('id')
    .single()

  if (counterErr || !counterRow) {
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  const counterId = counterRow.id
  const teamId = profile.team_id
  const currentCount = usage?.count ?? 0

  // ── SSE setup ────────────────────────────────────────────────────────────
  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const send = (data: object) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

  // ── Async pipeline ───────────────────────────────────────────────────────
  ;(async () => {
    try {
      await send({ step: 'Loading your squad...' })
      const fplClient = new FplClient({ cache: new MemoryCacheAdapter() })
      const ctx = await loadContext(teamId, fplClient)

      const result = await generateCounter(counterCard, quickReply ?? null, message, ctx, {
        onProgress: (step) => void send({ step }),
      })

      await send({ step: 'Saving...' })

      const newPayload =
        result.outcome === 'changed_fact' && result.newPick
          ? { outcome: result.outcome, response: result.response, newPick: result.newPick }
          : null

      await serviceClient
        .from('counters')
        .update({ status: 'ok', outcome: result.outcome, trace: result.trace, new_payload: newPayload })
        .eq('id', counterId)

      await serviceClient
        .from('counter_usage')
        .upsert(
          { user_id: user.id, gameweek, count: currentCount + 1 },
          { onConflict: 'user_id,gameweek' },
        )

      await send({
        status: 'ready',
        counterId,
        outcome: result.outcome,
        response: result.response,
        newPick: result.newPick ?? null,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[counter] pipeline error', { cardId, counterId, msg }, err)
      await send({ status: 'error', message: msg })
      void serviceClient.from('counters').update({ status: 'failed' }).eq('id', counterId)
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
