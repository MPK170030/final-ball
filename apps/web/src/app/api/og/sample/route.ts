import { ImageResponse } from 'next/og'
import React from 'react'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

interface StoredTransferPayload {
  save: boolean
  reason?: string
  sell?: { player: { web_name: string } }
  topPick?: { player: { web_name: string } }
}

interface StoredCaptainPayload {
  captain: { player: { web_name: string } }
}

interface StoredCard {
  type: 'transfer' | 'captain'
  position: number
  payload: StoredTransferPayload | StoredCaptainPayload
}

function getTransferLabel(cards: StoredCard[]): string {
  const card = cards.find(c => c.type === 'transfer')
  if (!card) return ''
  const p = card.payload as StoredTransferPayload
  if (p.save) return 'Save your transfer'
  if (p.sell && p.topPick) {
    return `${p.sell.player.web_name} → ${p.topPick.player.web_name}`
  }
  return ''
}

function getCaptainLabel(cards: StoredCard[]): string {
  const card = cards.find(c => c.type === 'captain')
  if (!card) return ''
  const p = card.payload as StoredCaptainPayload
  return p.captain?.player?.web_name ?? ''
}

const h = React.createElement

export async function GET() {
  const service = createServiceClient()
  const { data } = await service
    .from('sample_brief')
    .select('gameweek, cards')
    .eq('key', 'current')
    .maybeSingle()

  const gameweek = data?.gameweek ?? null
  const cards = (data?.cards as StoredCard[]) ?? []
  const transferLabel = getTransferLabel(cards)
  const captainLabel = getCaptainLabel(cards)

  const label = (text: string) =>
    h(
      'span',
      {
        style: {
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: '#71717a',
          textTransform: 'uppercase' as const,
        },
      },
      text,
    )

  const bigText = (text: string) =>
    h(
      'span',
      {
        style: {
          fontSize: 42,
          fontWeight: 700,
          color: '#FAFAFA',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        },
      },
      text,
    )

  const contentSection = data
    ? h(
        'div',
        { style: { display: 'flex', flexDirection: 'column' as const, gap: '40px' } },
        transferLabel
          ? h(
              'div',
              { style: { display: 'flex', flexDirection: 'column' as const, gap: '8px' } },
              label('Transfer'),
              bigText(transferLabel),
            )
          : null,
        captainLabel
          ? h(
              'div',
              { style: { display: 'flex', flexDirection: 'column' as const, gap: '8px' } },
              label('Captain'),
              bigText(captainLabel),
            )
          : null,
      )
    : h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
          },
        },
        h('span', { style: { fontSize: 28, color: '#71717a' } }, 'Brief coming soon'),
      )

  const image = h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column' as const,
        width: '1200px',
        height: '630px',
        background: '#0D0D0F',
        padding: '64px',
        fontFamily: 'sans-serif',
        justifyContent: 'space-between',
      },
    },
    // Top row
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h(
        'span',
        { style: { fontSize: 28, fontWeight: 700, color: '#FF6B35', letterSpacing: '-0.02em' } },
        'Final Ball',
      ),
      gameweek
        ? h('span', { style: { fontSize: 20, color: '#71717a', fontWeight: 500 } }, `GW${gameweek}`)
        : null,
    ),
    // Content
    contentSection,
    // Bottom row
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('span', { style: { fontSize: 16, color: '#52525b' } }, "Owner's brief · not advice for your team"),
      h('span', { style: { fontSize: 16, color: '#52525b' } }, 'finalball.manavpkothari.dev'),
    ),
  )

  return new ImageResponse(image, { width: 1200, height: 630 })
}
