'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { createClient } from '@/lib/supabase/client'
import { BriefBanner } from '@/components/brief/brief-banner'
import { TransferCard } from '@/components/brief/transfer-card'
import { CaptainCard } from '@/components/brief/captain-card'
import { DetailSheet } from '@/components/brief/detail-sheet'
import { Button } from '@/components/ui/button'
import type {
  BriefCard,
  TransferCardPayload,
  TransferCardPayloadTransfer,
  CaptainCardPayload,
  DetailState,
} from '@/components/brief/types'
import type { TraceStep } from '@finalball/agent'
import { cn } from '@/lib/utils'

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
    <header className="border-border flex items-center justify-between border-b px-4 py-3">
      <span className="text-body-strong text-foreground">Final Ball</span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleSignIn} disabled={loading}>
          Sign in
        </Button>
        <Button size="sm" onClick={handleSignIn} disabled={loading}>
          Get started
        </Button>
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
        Final Ball generates personalised transfer and captain picks every gameweek — with the
        full AI reasoning behind each decision.
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

export function SampleClient({ briefData }: SampleClientProps) {
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [isMobile, setIsMobile] = useState(true)
  const reducedMotion = useReducedMotion()
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsMobile(!mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(!e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const openDetail = useCallback(
    (cardId: string, tab: 'why' | 'trace', trigger?: HTMLButtonElement) => {
      detailTriggerRef.current = trigger ?? null
      setDetail({ cardId, tab })
    },
    [],
  )

  const closeDetail = useCallback(() => {
    setDetail(null)
    setTimeout(() => detailTriggerRef.current?.focus(), 0)
  }, [])

  const changeTab = useCallback((tab: 'why' | 'trace') => {
    setDetail(prev => prev ? { ...prev, tab } : null)
  }, [])

  const transferCards = briefData?.cards.filter(c => c.type === 'transfer') ?? []
  const captainCard = briefData?.cards.find(c => c.type === 'captain')
  const bankTenths = briefData?.meta.bankTenths ?? 0
  const gameweek = briefData?.gameweek ?? 1
  const version = briefData?.version ?? 1

  const detailTransferPayload = detail?.cardId && briefData
    ? (briefData.cards.find(c => c.id === detail.cardId && c.type === 'transfer')?.payload as TransferCardPayload | undefined)
    : undefined

  const detailCaptainPayload = detail?.cardId && briefData
    ? (briefData.cards.find(c => c.id === detail.cardId && c.type === 'captain')?.payload as CaptainCardPayload | undefined)
    : undefined

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />

      {/* Sample brief banner */}
      <BriefBanner variant="info">
        Sample brief. This is the owner&apos;s real team this week. It isn&apos;t advice for your
        team.
      </BriefBanner>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Cards area */}
        <main
          className={cn(
            'flex-1 overflow-y-auto px-4 py-6',
            !isMobile && detail && 'lg:max-w-xl',
          )}
        >
          <div className="mx-auto w-full max-w-lg space-y-6">
            {briefData ? (
              <>
                {/* Page header */}
                <div className="space-y-1">
                  <h1 className="text-title text-foreground">{briefData.meta.teamName}</h1>
                  <p className="text-small text-muted-foreground">
                    GW{gameweek} · {briefData.meta.freeTransfers} free transfer
                    {briefData.meta.freeTransfers > 1 ? 's' : ''} ·{' '}
                    <span className="font-mono">
                      £{(briefData.meta.bankTenths / 10).toFixed(1)}m
                    </span>{' '}
                    bank
                  </p>
                  <p className="text-small text-muted-foreground">
                    Brief v{version} ·{' '}
                    {new Date(briefData.generatedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>

                {/* Cards */}
                <h2 className="sr-only">Weekly suggestions</h2>
                <AnimatePresence>
                  <div className="space-y-4">
                    {transferCards.map((card, i) => {
                      const payload = card.payload as TransferCardPayload
                      return (
                        <motion.div
                          key={card.id}
                          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: i * 0.06 }}
                        >
                          <TransferCard
                            payload={payload}
                            cardIndex={i}
                            totalCards={transferCards.length}
                            bankTenths={bankTenths}
                            onWhyClick={(t) => openDetail(card.id, 'why', t)}
                            onTraceClick={(t) => openDetail(card.id, 'trace', t)}
                            isSelected={detail?.cardId === card.id}
                          />
                        </motion.div>
                      )
                    })}
                    {captainCard && (
                      <motion.div
                        key={captainCard.id}
                        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: transferCards.length * 0.06 }}
                      >
                        <CaptainCard
                          payload={captainCard.payload as CaptainCardPayload}
                          onWhyClick={(t) => openDetail(captainCard.id, 'why', t)}
                          onTraceClick={(t) => openDetail(captainCard.id, 'trace', t)}
                          isSelected={detail?.cardId === captainCard.id}
                        />
                      </motion.div>
                    )}
                  </div>
                </AnimatePresence>

                {/* CTA */}
                <GetStartedPanel />
              </>
            ) : (
              <div className="border-border bg-card rounded-lg border px-6 py-10 text-center">
                <p className="text-body-strong text-foreground">No sample brief yet</p>
                <p className="text-small mt-1 text-muted-foreground">
                  The owner hasn&apos;t generated this week&apos;s brief yet. Check back soon.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Desktop detail panel */}
        {!isMobile && detail && (
          <DetailSheet
            detail={detail}
            onClose={closeDetail}
            onTabChange={changeTab}
            transferPayload={
              detailTransferPayload && !('save' in detailTransferPayload && detailTransferPayload.save)
                ? (detailTransferPayload as TransferCardPayloadTransfer)
                : undefined
            }
            captainPayload={detailCaptainPayload}
            traceSteps={briefData?.trace ?? []}
            gameweek={gameweek}
            version={version}
            isMobile={false}
          />
        )}
      </div>

      {/* Mobile detail sheet */}
      {isMobile && (
        <DetailSheet
          detail={detail}
          onClose={closeDetail}
          onTabChange={changeTab}
          transferPayload={
            detailTransferPayload && !('save' in detailTransferPayload && detailTransferPayload.save)
              ? (detailTransferPayload as TransferCardPayloadTransfer)
              : undefined
          }
          captainPayload={detailCaptainPayload}
          traceSteps={briefData?.trace ?? []}
          gameweek={gameweek}
          version={version}
          isMobile={true}
        />
      )}

      {/* Footer */}
      <footer className="border-border border-t px-4 py-4 text-center">
        <p className="text-small text-muted-foreground">
          Not affiliated with or endorsed by the Premier League or Fantasy Premier League.{' '}
          <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy
          </a>
        </p>
      </footer>
    </div>
  )
}
