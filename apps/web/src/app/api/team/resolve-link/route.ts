import { NextRequest, NextResponse } from 'next/server'
import { FplClient, FplError, MemoryCacheAdapter } from '@finalball/agent'
import { createClient } from '@/lib/supabase/server'
import { extractTeamId } from '@/lib/team/parse-link'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { input?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (typeof body.input !== 'string' || !body.input.trim()) {
    return NextResponse.json({ error: 'invalid_request', message: 'Provide a team ID or FPL team URL.' }, { status: 400 })
  }

  const teamId = extractTeamId(body.input)
  if (teamId === null) {
    return NextResponse.json(
      { error: 'invalid_input', message: 'Could not find a team ID in that input. Paste the URL from your FPL team page or enter your team ID directly.' },
      { status: 422 },
    )
  }

  const fplClient = new FplClient({ maxConcurrent: 2, retries: 2, cache: new MemoryCacheAdapter() })

  try {
    const entry = await fplClient.getEntry(teamId)
    return NextResponse.json({
      teamId: entry.id,
      teamName: entry.name,
      managerName: `${entry.player_first_name} ${entry.player_last_name}`,
      overallRank: entry.summary_overall_rank,
      totalPoints: entry.summary_overall_points,
      country: entry.player_region_name,
    })
  } catch (err) {
    if (err instanceof FplError) {
      if (err.status === 404) {
        return NextResponse.json(
          { error: 'not_found', message: `No team found with ID ${teamId}. Double-check the link or ID.` },
          { status: 404 },
        )
      }
      if (err.status === 503) {
        return NextResponse.json(
          { error: 'fpl_updating', message: 'FPL is currently updating. Try again in a moment.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: 'fpl_error', message: err.message }, { status: 502 })
    }
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
