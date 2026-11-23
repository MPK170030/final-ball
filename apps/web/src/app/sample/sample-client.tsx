'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BriefBanner } from '@/components/brief/brief-banner'
import { TransferCard } from '@/components/brief/transfer-card'
import { CaptainCard } from '@/components/brief/captain-card'
import { PitchView } from '@/components/brief/pitch-view'
import { SnapshotWidget } from '@/components/brief/snapshot-widget'
import { ChipsLine } from '@/components/brief/chips-line'
import { StatusStrip } from '@/components/brief/status-strip'
import { DetailSheet } from '@/components/brief/detail-sheet'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/landing/logo'
import type {
  BriefCard,
  TransferCardPayload,
  TransferCardPayloadTransfer,
  CaptainCardPayload,
  LineupCardPayload,
  ChipCardPayload,
  PreviewCardPayload,
  DetailState,
} from '@/components/brief/types'
import type { TraceStep } from '@finalball/agent'

export interface SampleMeta {
  teamName: string
  freeTransfers: number
  bankTenths: number
  deadlineMs: number | null
}

export interface SampleBriefData {
  gameweek: number
  version: number
  trace: TraceStep[]
  cards: BriefCard[]
  meta: SampleMeta
  generatedAt: string
}

interface SampleClientProps {
  briefData: SampleBriefData | null
  isDemo?: boolean
}

// ── Public header ─────────────────────────────────────────────────────────────

function PublicHeader() {
  const [loading, setLoading] = useState(false)

  async function handleSignIn() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <header
      className="sticky top-0 z-20 border-b border-[#2C2C2C]"
      style={{ background: 'rgba(24,24,24,0.94)', backdropFilter: 'blur(12px)' }}
    >
      <div className="mx-auto max-w-[1200px] px-4 md:px-6">
        <div className="flex h-14 items-center justify-between gap-3 md:h-16">
          <Logo size={28} />
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleSignIn} disabled={loading} className="h-11">
              Sign in
            </Button>
            <Button size="sm" onClick={handleSignIn} disabled={loading} className="h-11">
              Get started
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}

// ── CTA panel ─────────────────────────────────────────────────────────────────

function GetStartedPanel() {
  const [loading, setLoading] = useState(false)

  async function handleSignIn() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <section
      aria-labelledby="cta-heading"
      className="border-border bg-secondary/30 rounded-lg border px-6 py-8 text-center"
    >
      <h2 id="cta-heading" className="text-heading text-foreground mb-2">
        Get a brief for your own team
      </h2>
      <p className="text-body text-muted-foreground mb-6 mx-auto max-w-sm">
        Sign in with Google and find your team. Then you can counter any pick.
      </p>
      <Button onClick={handleSignIn} disabled={loading} className="gap-2">
        {loading && (
          <span className="border-primary-foreground h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
        )}
        Continue with Google
      </Button>
      <p className="text-small text-muted-foreground mt-3">Free to use. No credit card needed.</p>
    </section>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function SampleClient({ briefData, isDemo = false }: SampleClientProps) {
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [isMobile, setIsMobile] = useState(true)
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsMobile(!mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(!e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const openDetail = useCallback(
    (cardId: string, tab: 'counter' | 'trace', trigger?: HTMLButtonElement) => {
      detailTriggerRef.current = trigger ?? null
      setDetail({ cardId, tab })
    },
    [],
  )

  const closeDetail = useCallback(() => {
    setDetail(null)
    setTimeout(() => detailTriggerRef.current?.focus(), 0)
  }, [])

  const changeTab = useCallback((tab: 'counter' | 'trace') => {
    setDetail(prev => prev ? { ...prev, tab } : null)
  }, [])

  const lineupCards = briefData?.cards.filter(c => c.type === 'lineup') ?? []
  const transferCards = briefData?.cards.filter(c => c.type === 'transfer') ?? []
  const captainCard = briefData?.cards.find(c => c.type === 'captain')
  const chipCard = briefData?.cards.find(c => c.type === 'chip')
  const previewCards = briefData?.cards.filter(c => c.type === 'preview') ?? []
  const bankTenths = briefData?.meta.bankTenths ?? 0
  const gameweek = briefData?.gameweek ?? 1
  const version = briefData?.version ?? 1
  const isDeadlinePassed = briefData?.meta.deadlineMs
    ? briefData.meta.deadlineMs < Date.now()
    : false

  const detailCard = detail?.cardId && briefData
    ? briefData.cards.find(c => c.id === detail.cardId)
    : undefined

  const panelLabel = (() => {
    if (!detailCard) return ''
    if (detailCard.type === 'lineup') return 'Your XI'
    if (detailCard.type === 'transfer') return 'Transfer'
    if (detailCard.type === 'captain') return 'Captain'
    return ''
  })()

  const panelTitle = (() => {
    if (!detailCard) return ''
    if (detailCard.type === 'lineup') return 'Your lineup'
    if (detailCard.type === 'transfer') {
      const p = detailCard.payload as TransferCardPayload
      if (p.save) return 'Save your transfer'
      return (p as TransferCardPayloadTransfer).topPick.player.web_name
    }
    if (detailCard.type === 'captain') {
      const p = detailCard.payload as CaptainCardPayload
      return p.captain.player.web_name
    }
    return ''
  })()

  const sharedDetailProps = {
    detail,
    onClose: closeDetail,
    onTabChange: changeTab,
    panelLabel,
    panelTitle,
    traceSteps: briefData?.trace ?? [],
    gameweek,
    version,
    counterPhase: { phase: 'idle' as const },
    quickReplies: [],
    onCounterSubmit: () => undefined,
    onCounterReset: () => undefined,
    onRegenerate: () => undefined,
    counterDisabled: true,
    counterDisabledReason: 'Sign in to counter any pick.',
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />

      {/* Demo/sample info banner */}
      <BriefBanner variant="info">
        {isDemo ? (
          <>
            <strong>Demo brief.</strong> Example data to show how the app works — not advice for your
            team. Visitors can&apos;t counter.
          </>
        ) : (
          <>
            <strong>Sample brief.</strong> This is the owner&apos;s real team this week. It isn&apos;t
            advice for your team, and visitors can&apos;t counter.
          </>
        )}
      </BriefBanner>

      {/* Status strip */}
      {briefData && (
        <div className="md:border-b md:border-[#2C2C2C] md:bg-background-alt">
          <div className="mx-auto max-w-[1200px] px-4 md:px-6">
            <StatusStrip
              gameweek={gameweek}
              teamName={briefData.meta.teamName}
              generatedAt={briefData.generatedAt}
              refreshesThisGw={3}
              onRefresh={() => undefined}
              refreshing={false}
              deadlineMs={briefData.meta.deadlineMs}
              isDeadlinePassed={isDeadlinePassed}
              freeTransfers={briefData.meta.freeTransfers}
              bankTenths={bankTenths}
              countersLeft={0}
              counterCap={10}
            />
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 pt-4 pb-12 md:pt-7 md:pb-16">
        <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6">
          {briefData ? (
            <div className="md:flex md:items-start md:gap-5">
              {/* Cards column */}
              <div className="md:flex-[999_1_620px] md:min-w-0">
                <div className="space-y-4">

                  {/* Snapshot widget */}
                  <SnapshotWidget
                    transferPayload={transferCards[0]?.payload as TransferCardPayload | undefined}
                    captainPayload={captainCard?.payload as CaptainCardPayload | undefined}
                    lineupPayload={lineupCards[0]?.payload as LineupCardPayload | undefined}
                    chipPayload={chipCard?.payload as ChipCardPayload | undefined}
                    onTransferClick={() =>
                      document.getElementById('transfer-section')?.scrollIntoView({ behavior: 'smooth' })
                    }
                    onCaptainClick={() =>
                      document.getElementById('captain-section')?.scrollIntoView({ behavior: 'smooth' })
                    }
                    onLineupClick={() =>
                      document.getElementById('lineup-section')?.scrollIntoView({ behavior: 'smooth' })
                    }
                    onChipClick={() =>
                      document.getElementById('chip-section')?.scrollIntoView({ behavior: 'smooth' })
                    }
                  />

                  <h2 className="sr-only">Weekly suggestions</h2>

                  {/* Lineup / YOUR XI */}
                  {lineupCards.map((card) => (
                    <section key={card.id} id="lineup-section">
                      <PitchView
                        payload={card.payload as LineupCardPayload}
                        gameweek={gameweek}
                        captainId={captainCard ? (captainCard.payload as CaptainCardPayload).captain.player.id : undefined}
                        vcId={captainCard ? (captainCard.payload as CaptainCardPayload).vc.player.id : undefined}
                        onTraceClick={(t) => openDetail(card.id, 'trace', t)}
                        isSelected={detail?.cardId === card.id}
                      />
                    </section>
                  ))}

                  {/* Transfer(s) */}
                  {transferCards.map((card, i) => {
                    const payload = card.payload as TransferCardPayload
                    return (
                      <section
                        key={card.id}
                        id={i === 0 ? 'transfer-section' : `transfer-section-${i}`}
                      >
                        <TransferCard
                          payload={payload}
                          cardIndex={i}
                          totalCards={transferCards.length}
                          onTraceClick={(t) => openDetail(card.id, 'trace', t)}
                          isSelected={detail?.cardId === card.id}
                        />
                      </section>
                    )
                  })}

                  {/* Captain */}
                  {captainCard && (
                    <section id="captain-section">
                      <CaptainCard
                        payload={captainCard.payload as CaptainCardPayload}
                        onTraceClick={(t) => openDetail(captainCard.id, 'trace', t)}
                        isSelected={detail?.cardId === captainCard.id}
                      />
                    </section>
                  )}

                  {/* Chips */}
                  {chipCard && (
                    <section id="chip-section">
                      <ChipsLine payload={chipCard.payload as ChipCardPayload} />
                    </section>
                  )}

                  {/* Next-week preview */}
                  {previewCards.map((card) => {
                    const previewPayload = card.payload as PreviewCardPayload
                    return (
                      <p key={card.id} className="px-1 text-[14px] leading-5 text-muted-foreground">
                        <span className="font-mono text-[12px] uppercase tracking-[0.06em]">
                          NEXT WEEK ·{' '}
                        </span>
                        {previewPayload.text}
                      </p>
                    )
                  })}

                  {/* CTA */}
                  <GetStartedPanel />
                </div>
              </div>

              {/* Desktop detail panel */}
              {!isMobile && detail && (
                <DetailSheet {...sharedDetailProps} isMobile={false} />
              )}
            </div>
          ) : (
            <div className="border-border bg-card rounded-lg border px-6 py-10 text-center">
              <p className="text-body-strong text-foreground">
                {isDemo ? 'Demo not yet available' : 'No sample brief yet'}
              </p>
              <p className="text-small mt-1 text-muted-foreground">
                {isDemo ? (
                  <>
                    The demo hasn&apos;t been published yet. Check back soon or{' '}
                    <a href="/sample" className="underline underline-offset-2 hover:text-foreground">
                      see the live sample brief
                    </a>
                    .
                  </>
                ) : (
                  "The owner hasn&apos;t generated this week&apos;s brief yet. Check back soon."
                )}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Mobile detail sheet */}
      {isMobile && <DetailSheet {...sharedDetailProps} isMobile={true} />}

      {/* Footer */}
      <footer className="border-border border-t">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-5 md:px-6 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-6 md:gap-y-1">
          <p className="text-[12px] text-muted-foreground md:text-[13px]">
            Final Ball is not affiliated with the Premier League or Fantasy Premier League.
          </p>
          <a
            href="/privacy"
            className="text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Privacy
          </a>
        </div>
      </footer>
    </div>
  )
}
