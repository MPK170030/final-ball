'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import NumberFlow from '@number-flow/react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { AccountMenu } from '@/components/brief/account-menu'
import { BriefBanner } from '@/components/brief/brief-banner'
import { TransferCard } from '@/components/brief/transfer-card'
import { CaptainCard } from '@/components/brief/captain-card'
import { DetailSheet } from '@/components/brief/detail-sheet'
import type {
  BriefData,
  BriefCard,
  TransferCardPayload,
  TransferCardPayloadTransfer,
  CaptainCardPayload,
  DetailState,
  CounterPhase,
} from '@/components/brief/types'
import { cn } from '@/lib/utils'

const COUNTER_CAP = 10

interface BriefClientProps {
  initialBrief: BriefData | null
  gameweek: number
  deadlineMs: number | null
  freeTransfers: number
  bankTenths: number
  countersThisGw: number
  isDeadlinePassed: boolean
  isFplUpdating: boolean
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

// ── Risk tag key ──────────────────────────────────────────────────────────────

function RiskTagKey() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Risk tags · next 3 GWs
      </span>
      <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center rounded-[5px] border border-foreground/40 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-foreground">
          Safe
        </span>
        high floor
      </span>
      <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center rounded-[5px] bg-secondary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-foreground">
          Balanced
        </span>
        most expected pts
      </span>
      <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center rounded-[5px] bg-foreground px-1.5 py-0.5 text-[11px] font-semibold leading-none text-background">
          Bold
        </span>
        high ceiling
      </span>
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
  countersThisGw,
  isDeadlinePassed,
  isFplUpdating,
  displayName,
  initial,
  teamName,
}: BriefClientProps) {
  const brief = initialBrief
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [isMobile, setIsMobile] = useState(true)
  const [counterStates, setCounterStates] = useState<Record<string, CounterPhase>>({})
  const [countersUsedThisSession, setCountersUsedThisSession] = useState(0)
  const reducedMotion = useReducedMotion()
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

  const activeCards = brief?.cards ?? []

  // ── Counter state ───────────────────────────────────────────────────────────
  const countersLeft = Math.max(0, COUNTER_CAP - countersThisGw - countersUsedThisSession)
  const canCounter = !isDeadlinePassed && !isFplUpdating && countersLeft > 0

  let counterDisabledReason: string | undefined
  if (isDeadlinePassed) counterDisabledReason = 'Counters are locked after the deadline.'
  else if (isFplUpdating) counterDisabledReason = 'Counters pause while FPL updates.'
  else if (countersLeft === 0)
    counterDisabledReason = `You've used all ${COUNTER_CAP} counters this gameweek.`

  const activeCounterPhase: CounterPhase = detail?.cardId
    ? (counterStates[detail.cardId] ?? { phase: 'idle' })
    : { phase: 'idle' }

  // ── Detail handlers ─────────────────────────────────────────────────────────
  const openDetail = useCallback(
    (cardId: string, tab: 'why' | 'trace' | 'counter', trigger?: HTMLButtonElement) => {
      detailTriggerRef.current = trigger ?? null
      setDetail({ cardId, tab })
    },
    [],
  )

  const closeDetail = useCallback(() => {
    setDetail(null)
    setTimeout(() => detailTriggerRef.current?.focus(), 0)
  }, [])

  const changeTab = useCallback((tab: 'why' | 'trace' | 'counter') => {
    setDetail(prev => (prev ? { ...prev, tab } : null))
  }, [])

  // ── Counter submit / reset ──────────────────────────────────────────────────
  const submitCounter = useCallback(
    async (quickReply: string | null, message: string) => {
      const cardId = detail?.cardId
      if (!cardId) return

      setCounterStates(prev => ({ ...prev, [cardId]: { phase: 'checking', steps: [] } }))

      try {
        const res = await fetch('/api/counter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardId, quickReply, message }),
        })

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No stream')

        const decoder = new TextDecoder()
        let buffer = ''

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
              outcome?: string
              response?: string
              newPick?: unknown
              message?: string
            }

            if (data.step) {
              setCounterStates(prev => {
                const cur = prev[cardId]
                if (!cur || cur.phase !== 'checking') return prev
                return { ...prev, [cardId]: { phase: 'checking', steps: [...cur.steps, data.step!] } }
              })
            } else if (data.status === 'ready') {
              setCounterStates(prev => ({
                ...prev,
                [cardId]: {
                  phase: 'done',
                  outcome: data.outcome as 'held' | 'changed_fact' | 'accepted_preference' | 'declined',
                  response: data.response!,
                  newPick: data.newPick ?? null,
                },
              }))
              setCountersUsedThisSession(prev => prev + 1)
            } else if (data.status === 'error') {
              throw new Error(data.message ?? 'Counter failed')
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        const msg = err instanceof Error ? err.message : 'Counter failed'
        setCounterStates(prev => ({ ...prev, [cardId]: { phase: 'error', message: msg } }))
      }
    },
    [detail?.cardId],
  )

  const resetCounter = useCallback(() => {
    const cardId = detail?.cardId
    if (!cardId) return
    setCounterStates(prev => ({ ...prev, [cardId]: { phase: 'idle' } }))
  }, [detail?.cardId])

  // ── Transfer card lookup for detail panel ───────────────────────────────────
  const detailTransferPayload = useMemo<TransferCardPayloadTransfer | undefined>(() => {
    if (!detail?.cardId) return undefined
    const activeCard = activeCards.find(c => c.id === detail.cardId && c.type === 'transfer')
    if (!activeCard) return undefined
    const payload = activeCard.payload as TransferCardPayload
    if (payload.save) return undefined
    return payload as TransferCardPayloadTransfer
  }, [detail?.cardId, activeCards])

  const detailCaptainPayload = useMemo<CaptainCardPayload | undefined>(() => {
    if (!detail?.cardId) return undefined
    const activeCard = activeCards.find(c => c.id === detail.cardId && c.type === 'captain')
    return activeCard ? (activeCard.payload as CaptainCardPayload) : undefined
  }, [detail?.cardId, activeCards])

  // ── Quick replies for the active counter tab ────────────────────────────────
  const quickReplies = useMemo<string[]>(() => {
    if (!detail?.cardId) return []
    const card = activeCards.find(c => c.id === detail.cardId)
    if (!card) return []

    if (card.type === 'captain') {
      const p = card.payload as CaptainCardPayload
      return [
        `${p.captain.player.web_name} looks good`,
        `Why not ${p.vc.player.web_name}?`,
        'Too risky',
      ]
    }

    if (card.type === 'transfer') {
      const p = card.payload as TransferCardPayload
      if (p.save) {
        return ['I want to make a transfer', "The savings don't feel worth it", 'What would you buy?']
      }
      return [
        `Keep ${p.sell.player.web_name}`,
        `Why not ${p.topPick.player.web_name}?`,
        'Too risky',
        'I want to save',
      ]
    }

    return []
  }, [detail?.cardId, activeCards])

  const transferCards = activeCards.filter((c: BriefCard) => c.type === 'transfer')
  const captainCard = activeCards.find((c: BriefCard) => c.type === 'captain')

  const sharedDetailProps = {
    detail,
    onClose: closeDetail,
    onTabChange: changeTab,
    transferPayload:
      detailTransferPayload && !('save' in detailTransferPayload && detailTransferPayload.save)
        ? (detailTransferPayload as TransferCardPayloadTransfer)
        : undefined,
    captainPayload: detailCaptainPayload,
    traceSteps: brief?.trace ?? [],
    gameweek,
    version: brief?.version ?? 1,
    counterPhase: activeCounterPhase,
    quickReplies,
    onCounterSubmit: submitCounter,
    onCounterReset: resetCounter,
    counterDisabled: !canCounter || activeCounterPhase.phase === 'checking',
    counterDisabledReason,
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Nav */}
      <header className="border-border flex h-14 items-center justify-between border-b px-4 md:h-16">
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-foreground md:text-[19px]">
          Final Ball
        </span>
        <AccountMenu initial={initial} displayName={displayName} />
      </header>

      {/* Banners */}
      {isFplUpdating && (
        <BriefBanner variant="info">
          <strong>FPL is updating.</strong> Showing your saved brief. Counters pause until FPL is back.
        </BriefBanner>
      )}
      {isDeadlinePassed && (
        <BriefBanner variant="info">
          <strong>The GW {gameweek} deadline has passed.</strong> This brief is read-only. Your GW{' '}
          {gameweek + 1} brief arrives once the window opens.
        </BriefBanner>
      )}

      {/* Main */}
      <main className="flex-1 px-4 pt-6 pb-12 md:px-8 md:pt-8">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="md:flex md:items-start md:gap-5">

            {/* Cards column */}
            <div className="md:flex-[999_1_560px] md:min-w-0">
              <div className="space-y-4">

                {/* Gameweek header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <p className="text-[12px] font-semibold leading-4 tracking-[0.06em] uppercase text-muted-foreground">
                      Gameweek {gameweek}
                    </p>
                    <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.01em] text-foreground md:text-[34px] md:leading-10 md:tracking-[-0.015em]">
                      Your brief
                    </h1>
                    {/* Mobile: team name on own line */}
                    <p className="text-[14px] text-foreground md:hidden">{teamName}</p>
                    {/* Meta row */}
                    <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1 text-[13px] text-muted-foreground">
                      {/* Desktop: team name inline */}
                      <span className="hidden md:inline text-[14px] text-foreground">{teamName}</span>
                      {isDeadlinePassed ? (
                        <span className="font-mono font-medium">Deadline passed</span>
                      ) : deadlineMs ? (
                        <span className="inline-flex items-baseline gap-1 shrink-0">
                          Deadline in <Countdown deadlineMs={deadlineMs} />
                        </span>
                      ) : null}
                      <span className="shrink-0">
                        {freeTransfers} free transfer{freeTransfers > 1 ? 's' : ''} ·{' '}
                        <span className="font-mono">£{(bankTenths / 10).toFixed(1)}m</span> in the bank
                      </span>
                      {brief?.generatedAt && (
                        <span className="shrink-0 text-muted-foreground">
                          Generated{' '}
                          {new Date(brief.generatedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                          ,{' '}
                          {new Date(brief.generatedAt).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    {/* Counters left — mobile */}
                    <p className="text-[13px] text-muted-foreground md:hidden">
                      <span className="font-mono tabular-nums">{countersLeft} of {COUNTER_CAP}</span>
                      {' '}counters left this GW
                    </p>
                  </div>

                  {/* Counters left — desktop */}
                  <div className="hidden md:flex shrink-0 items-center gap-2 rounded-[8px] border border-border px-3 py-2">
                    <span className="font-mono text-[13px] tabular-nums text-foreground">
                      {countersLeft} of {COUNTER_CAP}
                    </span>
                    <span className="text-[13px] text-muted-foreground">counters left this GW</span>
                  </div>
                </div>

                {/* Risk tag key */}
                <RiskTagKey />

                {/* Content */}
                <h2 className="sr-only">Weekly suggestions</h2>
                {brief ? (
                  <AnimatePresence>
                    <div className="space-y-4">
                      {transferCards.map((card, i) => {
                        const payload = card.payload as TransferCardPayload
                        const cardPhase = counterStates[card.id] ?? { phase: 'idle' }
                        const cardCounterDisabled = !canCounter || cardPhase.phase === 'checking'
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
                              onCounterClick={(t) => openDetail(card.id, 'counter', t)}
                              counterDisabled={cardCounterDisabled}
                              counterDisabledReason={counterDisabledReason}
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
                          {(() => {
                            const cardPhase = counterStates[captainCard.id] ?? { phase: 'idle' }
                            const cardCounterDisabled = !canCounter || cardPhase.phase === 'checking'
                            return (
                              <CaptainCard
                                payload={captainCard.payload as CaptainCardPayload}
                                onWhyClick={(t) => openDetail(captainCard.id, 'why', t)}
                                onCounterClick={(t) => openDetail(captainCard.id, 'counter', t)}
                                counterDisabled={cardCounterDisabled}
                                counterDisabledReason={counterDisabledReason}
                                isSelected={detail?.cardId === captainCard.id}
                              />
                            )
                          })()}
                        </motion.div>
                      )}
                      {/* How the agent decided */}
                      {(captainCard ?? transferCards[0]) && (() => {
                        const traceCardId = (captainCard ?? transferCards[0])!.id
                        const stepCount = brief.trace.length
                        const replanCount = brief.trace.filter(s => s.replan).length
                        const mobileSubtitle = replanCount > 0
                          ? `${stepCount} steps · ${replanCount} replan${replanCount > 1 ? 's' : ''}`
                          : `${stepCount} steps`
                        const desktopSubtitle = `${mobileSubtitle} · the full trace for this brief`
                        return (
                          <motion.div
                            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: (transferCards.length + 1) * 0.06 }}
                          >
                            <button
                              type="button"
                              onClick={(e) => openDetail(traceCardId, 'trace', e.currentTarget)}
                              className="w-full text-left border border-border rounded-[12px] md:rounded-[14px] px-4 py-3 md:px-5 md:py-4 flex items-center justify-between gap-4 min-h-16 hover:bg-secondary/30 transition-colors focus-visible:outline-2 focus-visible:outline-ring"
                            >
                              <div className="flex flex-col gap-0.5">
                                <p className="text-[15px] font-semibold text-foreground">
                                  How the agent decided
                                </p>
                                <p className="text-[13px] text-muted-foreground md:hidden">
                                  {mobileSubtitle}
                                </p>
                                <p className="hidden text-[13px] text-muted-foreground md:block">
                                  {desktopSubtitle}
                                </p>
                              </div>
                              <span
                                className="text-muted-foreground text-[18px] leading-none shrink-0"
                                aria-hidden="true"
                              >
                                →
                              </span>
                            </button>
                          </motion.div>
                        )
                      })()}
                    </div>
                  </AnimatePresence>
                ) : (
                  <div className="border-border bg-card rounded-lg border px-6 py-10 text-center">
                    <p className="text-body-strong text-foreground">No brief yet for GW {gameweek}</p>
                    <p className="text-small mt-1 text-muted-foreground">
                      Your brief will arrive on schedule before the deadline.
                    </p>
                  </div>
                )}

              </div>
            </div>

            {/* Desktop detail panel — in-flow beside cards column */}
            {!isMobile && detail && (
              <DetailSheet {...sharedDetailProps} isMobile={false} />
            )}

          </div>
        </div>
      </main>

      {/* Mobile detail sheet */}
      {isMobile && <DetailSheet {...sharedDetailProps} isMobile={true} />}

      {/* Footer */}
      <footer className="border-border border-t px-4 py-5 md:px-8">
        <div className="mx-auto w-full max-w-[1200px] flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-6 md:gap-y-1">
          <span className="font-mono text-[12px] text-muted-foreground">v0.1 · MVP in progress</span>
          <p className="text-[12px] text-muted-foreground md:text-[13px]">
            Final Ball is not affiliated with the Premier League or Fantasy Premier League.
          </p>
          <a
            href="/privacy"
            className={cn(
              'text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground',
            )}
          >
            Privacy
          </a>
        </div>
      </footer>
    </div>
  )
}
