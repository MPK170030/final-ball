import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const userId = user.id

  // Collect IDs for joined-table deletes
  const [decisionRes, counterRes, briefRes] = await Promise.all([
    service.from('decisions').select('id').eq('user_id', userId),
    service.from('counters').select('id').eq('user_id', userId),
    service.from('briefs').select('id').eq('user_id', userId),
  ])
  const decisionIds = (decisionRes.data ?? []).map((r) => r.id)
  const counterIds = (counterRes.data ?? []).map((r) => r.id)
  const briefIds = (briefRes.data ?? []).map((r) => r.id)

  // Delete in FK-safe order
  if (counterIds.length > 0) {
    await service.from('counter_records').delete().in('counter_id', counterIds)
  }
  if (decisionIds.length > 0) {
    await service.from('intents').delete().in('decision_id', decisionIds)
    await service.from('receipts').delete().in('decision_id', decisionIds)
  }
  await service.from('decisions').delete().eq('user_id', userId)
  await service.from('counters').delete().eq('user_id', userId)
  await service.from('counter_usage').delete().eq('user_id', userId)
  if (briefIds.length > 0) {
    await service.from('cards').delete().in('brief_id', briefIds)
  }
  await service.from('briefs').delete().eq('user_id', userId)
  await service.from('generation_usage').delete().eq('user_id', userId)
  await service.from('lookup_usage').delete().eq('user_id', userId)
  await service.from('email_log').delete().eq('user_id', userId)
  await service.from('profiles').delete().eq('id', userId)

  // Remove the auth user last (service client, so no session needed)
  await service.auth.admin.deleteUser(userId)

  return NextResponse.json({ ok: true })
}
