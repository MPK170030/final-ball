import type { Metadata } from 'next'
import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import { SampleClient } from './sample-client'
import type { SampleBriefData, SampleMeta } from './sample-client'
import type { BriefCard } from '@/components/brief/types'
import type { TraceStep } from '@finalball/agent'

export const dynamic = 'force-dynamic'

// ── Data fetching ─────────────────────────────────────────────────────────────

const getSampleBrief = cache(async () => {
  const service = createServiceClient()
  const { data } = await service
    .from('sample_brief')
    .select('gameweek, version, trace, cards, meta, generated_at')
    .eq('key', 'current')
    .maybeSingle()
  return data
})

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const row = await getSampleBrief()
  const gw = row?.gameweek
  const ts = row ? new Date(row.generated_at).getTime() : 0

  const title = gw ? `GW${gw} Brief · Final Ball` : 'Sample Brief · Final Ball'
  const description =
    'See a real FPL brief: transfer picks, captain, and the full AI reasoning. No sign-in needed.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: 'https://finalball.manavpkothari.dev/sample',
      siteName: 'Final Ball',
      images: [
        {
          url: `/api/og/sample?v=${ts}`,
          width: 1200,
          height: 630,
          alt: 'Final Ball sample brief card',
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/sample?v=${ts}`],
    },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SamplePage() {
  const row = await getSampleBrief()

  let briefData: SampleBriefData | null = null
  if (row) {
    briefData = {
      gameweek: row.gameweek,
      version: row.version,
      trace: (row.trace as TraceStep[]) ?? [],
      cards: (row.cards as BriefCard[]) ?? [],
      meta: (row.meta as SampleMeta) ?? {
        teamName: 'Owner',
        freeTransfers: 1,
        bankTenths: 0,
        deadlineMs: null,
      },
      generatedAt: row.generated_at,
    }
  }

  return <SampleClient briefData={briefData} />
}
