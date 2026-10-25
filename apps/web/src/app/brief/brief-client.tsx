'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import NumberFlow from '@number-flow/react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { RefreshCwIcon } from 'lucide-react'
import { AccountMenu } from '@/components/brief/account-menu'
import { BriefBanner } from '@/components/brief/brief-banner'
import { TransferCard } from '@/components/brief/transfer-card'
import { CaptainCard } from '@/components/brief/captain-card'
import { GeneratingState } from '@/components/brief/generating-state'
import { DetailSheet } from '@/components/brief/detail-sheet'
import type {
  BriefData,
  TransferCardPayload,
  TransferCardPayloadTransfer,
  CaptainCardPayload,
  DetailState,
} from '@/components/brief/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const DAILY_CAP = 3

type GenerateStatus =
  | { kind: 'idle' }
  | { kind: 'generating'; steps: string[]; currentStep: string | null }
  | { kind: 'error'; message: string }
  | { kind: 'fpl_updating' }

interface BriefClientProps {
  initialBrief: BriefData | null
  gameweek: number
  deadlineMs: number | null
  freeTransfers: number
  bankTenths: number
  usageToday: number
  isDeadlinePassed: boolean
  displayName: string
  initial: string
  teamName: string
}

// ── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(deadlineMs: number | null) {
  const [remaining, setRemaining] = useState(() =>
    deadlineMs ? Math.max(0, deadlineMs - Date.now()) : null,
  )

  useEffect(() => {
    if (!deadlineMs) return
    const tick = () => setRemaining(Math.max(0, deadlineMs - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [deadlineMs])

  if (remaining === null) return null

  const totalSeconds = Math.floor(remaining / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return { days, hours, minutes, seconds, totalMs: remaining }
}

function Countdown({ deadlineMs }: { deadlineMs: number | null }) {
  const time = useCountdown(deadlineMs)
  if (!time) return null

  return (
    // aria-live="off": updating every second would be too noisy for screen readers
    <div aria-live="off" className="flex items-baseline gap-0.5 font-mono text-number text-muted-foreground tabular-nums">
      {time.days > 0 && (
        <>
          <NumberFlow value={time.days} />
          <span>d </span>
        </>
      )}
      <NumberFlow value={time.hours} format={{ minimumIntegerDigits: time.days > 0 ? 2 : 1 }} />
      <span>h </span>
      <NumberFlow value={time.minutes} format={{ minimumIntegerDigits: 2 }} />
      <span>m </span>
      {time.days === 0 && (
        <>
          <NumberFlow value={time.seconds} format={{ minimumIntegerDigits: 2 }} />
          <span>s</span>
        </>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function BriefClient({
  initialBrief,
  gameweek,
  deadlineMs,
  freeTransfers,
  bankTenths,
  usageToday,
  isDeadlinePassed,
  displayName,
  initial,
  teamName,
}: BriefClientProps) {
  const [brief] = useState<BriefData | null>(initialBrief)
  const [genStatus, setGenStatus] = useState<GenerateStatus>({ kind: 'idle' })
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [isMobile, setIsMobile] = useState(true)
  const router = useRouter()
  const reducedMotion = useReducedMotion()
  const abortRef = useRef<AbortController | null>(null)
  // Tracks the button that triggered the detail panel so focus returns on close
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null)

  // Detect desktop vs mobile
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsMobile(!mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(!e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── Generate brief ──────────────────────────────────────────────────────────
  const generateBrief = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setGenStatus({ kind: 'generating', steps: [], currentStep: 'Starting...' })

    try {
      const res = await fetch('/api/brief/generate', {
        method: 'POST',
        signal: ctrl.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        if (res.status === 429) {
          setGenStatus({ kind: 'idle' })
          return
        }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''
      const completedSteps: string[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6)) as {
            step?: string
            status?: string
            briefId?: string
            message?: string
          }

          if (data.step) {
            setGenStatus(prev => {
              if (prev.kind !== 'generating') return prev
              const newCompleted = prev.currentStep
                ? [...prev.steps, prev.currentStep]
                : prev.steps
              return { kind: 'generating', steps: newCompleted, currentStep: data.step! }
            })
            if (data.step) completedSteps.push(data.step)
          } else if (data.status === 'fpl_updating') {
            setGenStatus({ kind: 'fpl_updating' })
            return
          } else if (data.status === 'ready') {
            router.refresh()
            setGenStatus({ kind: 'idle' })
            return
          } else if (data.status === 'error') {
            throw new Error(data.message ?? 'Generation failed')
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Generation failed'
      setGenStatus({ kind: 'error', message: msg })
    }
  }, [router])

  // ── Detail handlers ─────────────────────────────────────────────────────────
  const openDetail = useCallback(
    (cardId: string, tab: 'why' | 'trace', trigger?: HTMLButtonElement) => {
      detailTriggerRef.current = trigger ?? null
      setDetail({ cardId, tab })
    },
    [],
  )

  const closeDetail = useCallback(() => {
    setDetail(null)
    // Return focus to the button that opened the panel (desktop aside case;
    // the Sheet from base-ui handles focus return for the mobile modal itself)
    setTimeout(() => detailTriggerRef.current?.focus(), 0)
  }, [])

  const changeTab = useCallback((tab: 'why' | 'trace') => {
    setDetail(prev => prev ? { ...prev, tab } : null)
  }, [])

  // ── Cap/deadline state ──────────────────────────────────────────────────────
  const cappedToday = usageToday >= DAILY_CAP
  const canGenerate = !isDeadlinePassed && !cappedToday && genStatus.kind !== 'generating'
  let newBriefDisabledReason: string | null = null
  if (isDeadlinePassed) newBriefDisabledReason = 'Deadline passed'
  else if (cappedToday) newBriefDisabledReason = 'Daily limit reached'

  // ── Transfer card lookup for detail panel ───────────────────────────────────
  const detailTransferPayload = detail?.cardId && brief
    ? (brief.cards.find(c => c.id === detail.cardId && c.type === 'transfer')?.payload as TransferCardPayload | undefined)
    : undefined

  const detailCaptainPayload = detail?.cardId && brief
    ? (brief.cards.find(c => c.id === detail.cardId && c.type === 'captain')?.payload as CaptainCardPayload | undefined)
    : undefined

  const transferCards = brief?.cards.filter(c => c.type === 'transfer') ?? []
  const captainCard = brief?.cards.find(c => c.type === 'captain')

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Nav */}
      <header className="border-border flex items-center justify-between border-b px-4 py-3">
        <span className="text-body-strong text-foreground">Final Ball</span>
        <AccountMenu initial={initial} displayName={displayName} />
      </header>

      {/* Banners */}
      {genStatus.kind === 'fpl_updating' && (
        <BriefBanner variant="info">
          <strong>FPL is updating its data.</strong> Try generating your brief in a few minutes.
        </BriefBanner>
      )}
      {genStatus.kind === 'error' && (
        <BriefBanner variant="warning">
          <strong>Generation failed.</strong> {genStatus.message}
        </BriefBanner>
      )}
      {isDeadlinePassed && (
        <BriefBanner variant="info">
          <strong>Deadline passed.</strong> This brief is read-only. Next brief arrives for GW{gameweek + 1}.
        </BriefBanner>
      )}
      {!isDeadlinePassed && cappedToday && (
        <BriefBanner variant="info">
          <strong>Daily limit reached.</strong> You&apos;ve used {usageToday} of {DAILY_CAP} generations today.
        </BriefBanner>
      )}

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
            {/* Page header */}
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-title text-foreground">{teamName}</h1>
                  <p className="text-small text-muted-foreground">
                    GW{gameweek} · {freeTransfers} free transfer{freeTransfers > 1 ? 's' : ''} ·{' '}
                    <span className="font-mono">£{(bankTenths / 10).toFixed(1)}m</span> bank
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {deadlineMs && !isDeadlinePassed && (
                    <div className="flex items-center gap-1.5 text-small text-muted-foreground">
                      <span>Deadline in</span>
                      <Countdown deadlineMs={deadlineMs} />
                    </div>
                  )}
                  {brief?.generatedAt && (
                    <p className="text-small text-muted-foreground">
                      Brief v{brief.version} ·{' '}
                      {new Date(brief.generatedAt).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* New brief button */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  onClick={generateBrief}
                  disabled={!canGenerate}
                  size="sm"
                  variant={brief ? 'outline' : 'default'}
                  className="gap-1.5"
                >
                  <RefreshCwIcon className="size-3.5" aria-hidden="true" />
                  {genStatus.kind === 'error' ? 'Try again' : brief ? 'New brief' : 'Generate brief'}
                  {!isDeadlinePassed && (
                    <span className="font-mono text-xs opacity-70">
                      {DAILY_CAP - usageToday} left today
                    </span>
                  )}
                </Button>
                {newBriefDisabledReason && (
                  <span className="text-small text-muted-foreground">{newBriefDisabledReason}</span>
                )}
              </div>
            </div>

            {/* Content */}
            <h2 className="sr-only">Weekly suggestions</h2>
            {genStatus.kind === 'generating' ? (
              <GeneratingState
                steps={genStatus.steps}
                currentStep={genStatus.currentStep}
              />
            ) : brief ? (
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
            ) : (
              <div className="border-border bg-card rounded-lg border px-6 py-10 text-center">
                <p className="text-body-strong text-foreground">No brief yet</p>
                <p className="text-small mt-1 text-muted-foreground">
                  Generate your first brief to see transfer and captain suggestions.
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
            traceSteps={brief?.trace ?? []}
            gameweek={gameweek}
            version={brief?.version ?? 1}
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
          traceSteps={brief?.trace ?? []}
          gameweek={gameweek}
          version={brief?.version ?? 1}
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
