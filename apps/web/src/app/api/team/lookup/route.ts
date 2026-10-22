import { NextRequest, NextResponse } from 'next/server'
import { FplClient, FplError, MemoryCacheAdapter, getActiveGameweek } from '@finalball/agent'
import { createClient } from '@/lib/supabase/server'
import { fuzzyMatchTeamName } from '@/lib/team/fuzzy'
import { getOrFetchStandingsPage } from '@/lib/team/standings-db'
import { pageForRank } from '@/lib/team/page-for-rank'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface TeamSummary {
  teamId: number
  teamName: string
  managerName: string
  overallRank: number
  totalPoints: number
  country: string
}

/**
 * D9.3d: Probe ~8 pages to estimate the tied group size.
 * Returns tooBig=true if the group likely exceeds MAX_SCANNABLE_PAGES.
 */
async function probeTiedGroupSize(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fplClient: FplClient,
  leagueId: number,
  startPage: number,
  targetRank: number,
  gameweek: number,
): Promise<{ tiedCount: number; tooBig: boolean }> {
  const MAX_SCANNABLE_PAGES = 200
  // Exponential offsets; last entry (offset 199) is the "too big" sentinel
  const probeOffsets = [0, 1, 3, 7, 15, 31, 63, 127, 199]

  // Run all probes concurrently (FplClient throttles to 3 at a time)
  const results = await Promise.allSettled(
    probeOffsets.map((offset) =>
      getOrFetchStandingsPage(supabase, fplClient, leagueId, startPage + offset, gameweek),
    ),
  )

  let lastHitOffset = -1
  for (let i = 0; i < probeOffsets.length; i++) {
    const result = results[i]
    if (result.status === 'rejected') break
    const page = result.value
    if (!page || page.standings.results.length === 0) break
    if (!page.standings.results.some((e) => e.rank === targetRank)) break
    lastHitOffset = probeOffsets[i]
  }

  if (lastHitOffset === -1) return { tiedCount: 0, tooBig: false }
  if (lastHitOffset >= 199) return { tiedCount: lastHitOffset * 50, tooBig: true }

  const estimatedPages = lastHitOffset + 1
  return {
    tiedCount: estimatedPages * 50,
    tooBig: estimatedPages >= MAX_SCANNABLE_PAGES,
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { country?: unknown; rank?: unknown; teamName?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { country, rank, teamName } = body
  if (
    typeof country !== 'string' ||
    !country ||
    typeof rank !== 'number' ||
    !Number.isInteger(rank) ||
    rank < 1 ||
    typeof teamName !== 'string' ||
    !teamName.trim()
  ) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  // Rate limit: 10 lookups per user per hour (D9.12)
  const hourBucket = new Date().toISOString().slice(0, 13) // '2026-10-22T14'
  const { data: rl } = await supabase
    .from('lookup_usage')
    .select('count')
    .eq('user_id', user.id)
    .eq('hour_bucket', hourBucket)
    .maybeSingle()

  const rlCount = rl?.count ?? 0
  if (rlCount >= 10) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many searches this hour. Try again later or use your FPL link instead.' },
      { status: 429 },
    )
  }

  // Increment before FPL calls — best-effort, slight TOCTOU is acceptable at MVP scale
  void supabase
    .from('lookup_usage')
    .upsert({ user_id: user.id, hour_bucket: hourBucket, count: rlCount + 1 })

  // Map country → league ID (D9.3f)
  const { data: countryLeague } = await supabase
    .from('country_leagues')
    .select('league_id')
    .eq('country', country)
    .order('season', { ascending: false })
    .limit(1)
    .single()

  if (!countryLeague) {
    return NextResponse.json(
      { error: 'unknown_country', message: `No league found for "${country}". Try your FPL link instead.` },
      { status: 422 },
    )
  }

  const leagueId = countryLeague.league_id
  const fplClient = new FplClient({ maxConcurrent: 3, retries: 2, cache: new MemoryCacheAdapter() })

  // Get active gameweek for the standings cache key
  let gameweek: number
  try {
    const bootstrap = await fplClient.getBootstrap()
    gameweek = getActiveGameweek(bootstrap)
  } catch (err) {
    if (err instanceof FplError && err.status === 503) {
      return NextResponse.json({ status: 'fpl_updating' }, { status: 503 })
    }
    return NextResponse.json({ error: 'fpl_error' }, { status: 502 })
  }

  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()

  const send = (data: object) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

  // Kick off scan asynchronously; response is returned immediately
  ;(async () => {
    try {
      const startPage = pageForRank(rank)

      // D9.3d: tie-size probe
      const { tiedCount, tooBig } = await probeTiedGroupSize(
        supabase,
        fplClient,
        leagueId,
        startPage,
        rank,
        gameweek,
      )

      if (tooBig) {
        await send({ status: 'too_big', tiedCount })
        await writer.close()
        return
      }

      const TIMEOUT_MS = 30_000
      const LINK_HINT_MS = 5_000
      const deadline = Date.now() + TIMEOUT_MS
      const startedAt = Date.now()

      await send({ checked: 0, total: tiedCount, page: startPage, etaSeconds: Math.ceil(tiedCount / 300) })

      let checked = 0
      let foundEntry: TeamSummary | null = null
      let lastProgressAt = 0

      // D9.3a: scan from startPage; also check startPage-1 for rank-1 neighbours
      const firstScanPage = Math.max(1, startPage - 1)
      let currentPage = firstScanPage
      let done = false

      while (!done && Date.now() < deadline) {
        let pageData
        try {
          pageData = await getOrFetchStandingsPage(supabase, fplClient, leagueId, currentPage, gameweek)
        } catch (err) {
          if (err instanceof FplError && err.status === 503) {
            await send({ status: 'fpl_updating' })
            done = true
            break
          }
          throw err
        }

        if (!pageData || pageData.standings.results.length === 0) break

        for (const entry of pageData.standings.results) {
          const diff = entry.rank - rank
          if (diff > 1) {
            // Past rank+1 neighbour: no more matches possible
            done = true
            break
          }
          if (diff >= -1) {
            // Within rank ±1 window
            checked++
            if (fuzzyMatchTeamName(teamName, entry.entry_name)) {
              // Fetch global rank from entry endpoint
              const fullEntry = await fplClient.getEntry(entry.entry)
              foundEntry = {
                teamId: entry.entry,
                teamName: entry.entry_name,
                managerName: entry.player_name,
                overallRank: fullEntry.summary_overall_rank,
                totalPoints: entry.total,
                country,
              }
              done = true
              break
            }
          }
          // diff < -1: before rank-1 window, keep scanning
        }

        if (!done && !pageData.standings.has_next) break

        // D9.3c: progress event at most once per second
        const now = Date.now()
        if (now - lastProgressAt >= 1_000) {
          const elapsed = now - startedAt
          const rate = elapsed > 0 ? (checked / elapsed) * 1_000 : 0
          const remaining = Math.max(0, tiedCount - checked)
          const etaSeconds = rate > 0 ? Math.ceil(remaining / rate) : null
          await send({
            checked,
            total: tiedCount,
            page: currentPage,
            etaSeconds,
            showLinkHint: elapsed >= LINK_HINT_MS,
          })
          lastProgressAt = now
        }

        currentPage++
      }

      if (foundEntry) {
        await send({ status: 'found', entry: foundEntry })
      } else if (Date.now() >= deadline) {
        await send({ status: 'timeout' })
      } else {
        await send({ status: 'not_found' })
      }
    } catch (err) {
      await send({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
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
