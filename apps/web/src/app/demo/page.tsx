import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import { SampleClient } from '../sample/sample-client'
import type { SampleBriefData, SampleMeta } from '../sample/sample-client'
import type { BriefCard } from '@/components/brief/types'
import type { TraceStep } from '@finalball/agent'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Demo · Final Ball',
  description:
    'See a full example of a Final Ball gameweek brief — transfer pick, captain, and the full AI reasoning. No sign-in needed.',
  openGraph: {
    title: 'Demo · Final Ball',
    description:
      'See a full example of a Final Ball gameweek brief — transfer pick, captain, and the full AI reasoning.',
    url: 'https://finalball.manavpkothari.dev/demo',
    siteName: 'Final Ball',
    type: 'website',
  },
}

export default async function DemoPage() {
  const service = createServiceClient()
  const { data } = await service
    .from('sample_brief')
    .select('gameweek, version, trace, cards, meta, generated_at')
    .eq('key', 'demo')
    .maybeSingle()

  let briefData: SampleBriefData | null = null
  if (data) {
    briefData = {
      gameweek: data.gameweek,
      version: data.version,
      trace: (data.trace as TraceStep[]) ?? [],
      cards: (data.cards as BriefCard[]) ?? [],
      meta: (data.meta as SampleMeta) ?? {
        teamName: 'Example Team',
        freeTransfers: 1,
        bankTenths: 0,
        deadlineMs: null,
      },
      generatedAt: data.generated_at,
    }
  }

  return <SampleClient briefData={briefData} isDemo />
}
