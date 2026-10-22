import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { teamId?: unknown; teamName?: unknown; managerName?: unknown; country?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { teamId, teamName, managerName, country } = body

  if (
    typeof teamId !== 'number' ||
    !Number.isInteger(teamId) ||
    teamId < 1 ||
    typeof teamName !== 'string' ||
    !teamName.trim() ||
    typeof managerName !== 'string' ||
    !managerName.trim()
  ) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  // D9.5a: one team per account — check if another profile already holds this team_id
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('team_id', teamId)
    .neq('id', user.id)
    .limit(1)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'already_linked' }, { status: 409 })
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      team_id: teamId,
      team_name: teamName.trim(),
      manager_name: managerName.trim(),
      country: typeof country === 'string' ? country.trim() || null : null,
    })
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ error: 'db_error', message: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
