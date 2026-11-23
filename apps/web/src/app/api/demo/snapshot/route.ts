import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

const OWNER_EMAIL = 'manavkothari17@gmail.com'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  const { data: current, error: readErr } = await service
    .from('sample_brief')
    .select('*')
    .eq('key', 'current')
    .maybeSingle()

  if (readErr || !current) {
    return NextResponse.json(
      { error: readErr?.message ?? 'No current brief to snapshot' },
      { status: 400 },
    )
  }

  const { error: writeErr } = await service.from('sample_brief').upsert({
    ...current,
    key: 'demo',
    generated_at: new Date().toISOString(),
  })

  if (writeErr) {
    return NextResponse.json({ error: writeErr.message }, { status: 500 })
  }

  revalidatePath('/demo')
  return NextResponse.json({ ok: true, gameweek: current.gameweek })
}
