import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ decisionId: string }> },
) {
  const { decisionId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Verify ownership via RLS (decisions policy: "Users read own decisions")
  const { data: decision } = await supabase
    .from('decisions')
    .select('id')
    .eq('id', decisionId)
    .single()

  if (!decision) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const body = await req.json()
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('decisions')
    .update({ journal_note: note })
    .eq('id', decisionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
