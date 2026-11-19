import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('email_opt_out')
    .eq('id', user.id)
    .single()

  const newValue = !(profile?.email_opt_out ?? false)

  await service.from('profiles').update({ email_opt_out: newValue }).eq('id', user.id)

  return NextResponse.json({ emailOptOut: newValue })
}
