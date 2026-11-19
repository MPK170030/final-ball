import { NextRequest, NextResponse } from 'next/server'
import {
  loadContext,
  findWeakSpots,
  buildTransferPlanForSell,
  rankWithModel,
  buildTransferCardPayload,
  buildSaveCardPayload,
  computeLineup,
  generateCaptain,
  FplClient,
  MemoryCacheAdapter,
} from '@finalball/agent'
import type { CaptainPick } from '@finalball/agent'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ counterId: string }> },
) {
  const { counterId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()

  const { data: counter } = await serviceClient
    .from('counters')
    .select('id, user_id, card_id, outcome, new_payload')
    .eq('id', counterId)
    .single()

  if (!counter) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (counter.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (counter.outcome !== 'accepted_preference' && counter.outcome !== 'changed_fact') {
    return NextResponse.json({ error: 'not_regeneratable' }, { status: 422 })
  }

  const storedPayload = counter.new_payload as { newPick?: { playerName: string } } | null
  const newSellName = storedPayload?.newPick?.playerName
  if (!newSellName) return NextResponse.json({ error: 'no_new_pick' }, { status: 422 })

  const { data: cardRow } = await serviceClient
    .from('cards')
    .select('brief_id')
    .eq('id', counter.card_id)
    .single()

  if (!cardRow) return NextResponse.json({ error: 'card_not_found' }, { status: 404 })

  const { data: brief } = await serviceClient
    .from('briefs')
    .select('user_id')
    .eq('id', cardRow.brief_id)
    .single()

  if (!brief || brief.user_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()

  if (!profile?.team_id) return NextResponse.json({ error: 'no_team' }, { status: 422 })

  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const send = (data: object) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

  ;(async () => {
    try {
      await send({ step: 'Loading your squad...' })
      const fplClient = new FplClient({ cache: new MemoryCacheAdapter() })
      const ctx = await loadContext(profile.team_id!, fplClient)

      await send({ step: 'Finding sell candidate...' })
      const weakspotResult = findWeakSpots(
        ctx.squadPlayers,
        ctx.picks.picks,
        ctx.allFixtures,
        ctx.bootstrap,
        ctx.freeTransfers,
      )
      const norm = normalizeName(newSellName)
      const sc = weakspotResult.ranked.find(ps => {
        const n = normalizeName(ps.player.web_name)
        return n === norm || n.includes(norm) || norm.includes(n)
      })
      if (!sc) {
        await send({ status: 'error', message: `${newSellName} not found in your squad` })
        return
      }

      await send({ step: `Building transfer plan for ${sc.player.web_name}...` })
      const plan = buildTransferPlanForSell(sc, ctx)

      await send({ step: 'Ranking options...' })
      const rankedPlan = await rankWithModel(plan, ctx)

      const clubs = new Map(ctx.bootstrap.teams.map(t => [t.id, t.short_name]))

      let payload: object
      let lineupPayload: object | undefined
      let captainPayload: object | undefined

      if (rankedPlan.save) {
        payload = buildSaveCardPayload({
          saveReason: rankedPlan.saveReason ?? '',
          bestOptionForComparison: rankedPlan.bestOptionForComparison,
          whySellContext: weakspotResult.whySellContext,
          freeTransfers: ctx.freeTransfers,
          gameweekId: ctx.gameweek.id,
          clubs,
        })
      } else {
        const card = rankedPlan.transfers[0]
        if (!card) {
          await send({ status: 'error', message: 'No transfer option found' })
          return
        }
        payload = buildTransferCardPayload(card, weakspotResult.whySellContext, clubs)

        // Build the post-transfer squad and recompute the lineup
        const topPickPlayer = card.topPick.player
        const newSquad = ctx.squadPlayers.map(p => p.id === sc.player.id ? topPickPlayer : p)
        const lineup = computeLineup(newSquad)

        const nextFixtureForTeam = new Map<number, { opponent: string; isHome: boolean } | null>()
        for (const f of ctx.allFixtures) {
          if (f.event !== ctx.gameweek.id) continue
          nextFixtureForTeam.set(f.team_h, { opponent: clubs.get(f.team_a) ?? '???', isHome: true })
          nextFixtureForTeam.set(f.team_a, { opponent: clubs.get(f.team_h) ?? '???', isHome: false })
        }

        lineupPayload = {
          gameweek: ctx.gameweek.id,
          formation: lineup.formation,
          starting: lineup.starting.map(s => ({
            player: s.player,
            clubShortName: clubs.get(s.player.team),
            nextFixture: nextFixtureForTeam.get(s.player.team) ?? null,
            epNext: s.epNext,
            isDoubtful: s.isDoubtful,
          })),
          bench: lineup.bench.map(s => ({
            player: s.player,
            clubShortName: clubs.get(s.player.team),
            epNext: s.epNext,
            isDoubtful: s.isDoubtful,
          })),
          swapsIn: lineup.swapsIn,
          swapsOut: lineup.swapsOut,
          hasChanges: lineup.hasChanges,
        }

        // Regenerate captain based on the post-transfer starting XI
        await send({ step: 'Updating captain recommendation...' })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const captainResult = await generateCaptain(ctx, { save: false, transfers: [card] } as any)
        const enrichPick = (pick: CaptainPick) => ({
          ...pick,
          clubShortName: clubs.get(pick.player.team),
          nextFixture: nextFixtureForTeam.get(pick.player.team) ?? null,
        })
        captainPayload = {
          captain: enrichPick(captainResult.captain),
          vc: enrichPick(captainResult.vc),
          alternatives: captainResult.alternatives.map(enrichPick),
        }
      }

      // Persist updated payloads so the card survives a page reload
      await serviceClient
        .from('cards')
        .update({ payload })
        .eq('id', counter.card_id)

      if (lineupPayload) {
        const { data: lineupCard } = await serviceClient
          .from('cards')
          .select('id')
          .eq('brief_id', cardRow.brief_id)
          .eq('type', 'lineup')
          .maybeSingle()
        if (lineupCard) {
          await serviceClient
            .from('cards')
            .update({ payload: lineupPayload })
            .eq('id', lineupCard.id)
        }
      }

      if (captainPayload) {
        const { data: captainCard } = await serviceClient
          .from('cards')
          .select('id')
          .eq('brief_id', cardRow.brief_id)
          .eq('type', 'captain')
          .maybeSingle()
        if (captainCard) {
          await serviceClient
            .from('cards')
            .update({ payload: captainPayload })
            .eq('id', captainCard.id)
        }
      }

      await send({ status: 'ready', payload, lineupPayload, captainPayload })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[counter/regenerate] error', { counterId, msg }, err)
      await send({ status: 'error', message: msg })
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
