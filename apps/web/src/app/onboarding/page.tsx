import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingFlow } from './onboarding-flow'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()

  if (profile?.team_id) redirect('/brief')

  // Fetch available countries (built once per season; may be empty during dev)
  const { data: rows } = await supabase
    .from('country_leagues')
    .select('country')
    .order('country')

  const countries = [...new Set((rows ?? []).map((r) => r.country))].filter(Boolean)

  return <OnboardingFlow countries={countries} />
}
