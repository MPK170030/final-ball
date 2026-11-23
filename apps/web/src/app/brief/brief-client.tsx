'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { AccountMenu } from '@/components/brief/account-menu'
import { BriefBanner } from '@/components/brief/brief-banner'
import { TransferCard } from '@/components/brief/transfer-card'
import { CaptainCard } from '@/components/brief/captain-card'
import { PitchView } from '@/components/brief/pitch-view'
import { ReceiptsSection } from '@/components/brief/receipts-section'
import { StatusStrip } from '@/components/brief/status-strip'
import { SnapshotWidget } from '@/components/brief/snapshot-widget'
import { ChipsLine } from '@/components/brief/chips-line'
import { Logo } from '@/components/landing/logo'
const DetailSheet = dynamic(
  () => import('@/components/brief/detail-sheet').then(m => ({ default: m.DetailSheet })),
  { ssr: false },
)
import type {
  BriefData,
  BriefCard,
  TransferCardPayload,
  TransferCardPayloadTransfer,
  CaptainCardPayload,
  ChipCardPayload,
  PreviewCardPayload,
  LineupCardPayload,
  DetailState,
  CounterPhase,
  ReceiptData,
} from '@/components/brief/types'
import { cn } from '@/lib/utils'

const COUNTER_CAP = 10

type GenState =
  | { phase: 'idle' }
  | { phase: 'generating'; steps: string[] }
  | { phase: 'no_change' }
  | { phase: 'error'; message: string }
  | { phase: 'fpl_updating' }

interface BriefClientProps {
  initialBrief: BriefData | null
  gameweek: number
  deadlineMs: number | null
  freeTransfers: number
  bankTenths: number
  countersThisGw: number
  isDeadlinePassed: boolean
  isEarlyPlanning: boolean
  isFplUpdating: boolean
  displayName: string
  initial: string
  teamName: string
  receiptData: ReceiptData
  emailOptOut: boolean
  refreshesThisGw?: number
}

export function BriefClient({
  initialBrief,
  gameweek,
  deadlineMs,
  freeTransfers,
  bankTenths,
  countersThisGw,
  isDeadlinePassed,
  isEarlyPlanning,
  isFplUpdating,
  displayName,
  initial,
  teamName,
  receiptData,
  emailOptOut,
  refreshesThisGw = 0,
}: BriefClientProps) {
  const brief = initialBrief
  const router = useRouter()
  const [view, setView] = useState<'thisweek' | 'record'>('thisweek')
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [isMobile, setIsMobile] = useState(true)
  const [counterStates, setCounterStates] = useState<Record<string, CounterPhase>>({})
  const [counterTraces, setCounterTraces] = useState<Record<string, string[]>>({})
  const [countersUsedThisSession, setCountersUsedThisSession] = useState(0)
  const [genState, setGenState] = useState<GenState>({ phase: 'idle' })
  const [regenPayloads, setRegenPayloads] = useState<Record<string, BriefCard['payload']>>({})
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null)

  const triggerGenerate = useCallback(async () => {
    setGenState({ phase: 'generating', steps: [] })
    try {
      const res = await fetch('/api/brief/generate', { method: 'POST' })
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
          const data = JSON.parse(line.slice(6)) as { step?: string; status?: string; message?: string }
          if (data.step) {
            setGenState(prev =>
              prev.phase === 'generating'
                ? { phase: 'generating', steps: [...prev.steps, data.step!] }
                : prev,
            )
          } else if (data.status === 'ready') {
            router.refresh()
            return
          } else if (data.status === 'no_change') {
            setGenState({ phase: 'no_change' })
            return
          } else if (data.status === 'fpl_updating') {
            setGenState({ phase: 'fpl_updating' })
            return
          } else if (data.status === 'error') {
            throw new Error(data.message ?? 'Generation failed')
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      setGenState({ phase: 'error', message: msg })
    }
  }, [router])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsMobile(!mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(!e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const briefIdRef = useRef(initialBrief?.id ?? null)
  useEffect(() => {
    const newId = initialBrief?.id ?? null
    if (newId !== briefIdRef.current) {
      briefIdRef.current = newId
      setGenState({ phase: 'idle' })
    }
  }, [initialBrief?.id])

  useEffect(() => {
    if (!initialBrief && !isDeadlinePassed && !isFplUpdating) {
      triggerGenerate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeCards = useMemo(
    () => (brief?.cards ?? []).map(c =>
      regenPayloads[c.id] ? { ...c, payload: regenPayloads[c.id] } : c,
    ),
    [brief?.cards, regenPayloads],
  )

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
    setDetail(prev => (prev ? { ...prev, tab } : null))
  }, [])

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
        let capturedSteps: string[] = []

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
              counterId?: string
              message?: string
            }

            if (data.step) {
              capturedSteps = [...capturedSteps, data.step!]
              setCounterStates(prev => {
                const cur = prev[cardId]
                if (!cur || cur.phase !== 'checking') return prev
                return { ...prev, [cardId]: { phase: 'checking', steps: [...cur.steps, data.step!] } }
              })
            } else if (data.status === 'ready') {
              setCounterTraces(prev => ({ ...prev, [cardId]: capturedSteps }))
              setCounterStates(prev => ({
                ...prev,
                [cardId]: {
                  phase: 'done',
                  outcome: data.outcome as 'held' | 'changed_fact' | 'accepted_preference' | 'declined',
                  response: data.response!,
                  newPick: data.newPick ?? null,
                  counterId: data.counterId ?? '',
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

  const handleRegenerate = useCallback((payload: Record<string, unknown>, lineupPayload?: Record<string, unknown>, captainPayload?: Record<string, unknown>) => {
    const cardId = detail?.cardId
    if (!cardId) return
    setRegenPayloads(prev => {
      const updates: Record<string, BriefCard['payload']> = {
        ...prev,
        [cardId]: payload as unknown as TransferCardPayload,
      }
      if (lineupPayload) {
        const lineupCard = (brief?.cards ?? []).find(c => c.type === 'lineup')
        if (lineupCard) updates[lineupCard.id] = lineupPayload as unknown as LineupCardPayload
      }
      if (captainPayload) {
        const captainCard = (brief?.cards ?? []).find(c => c.type === 'captain')
        if (captainCard) updates[captainCard.id] = captainPayload as unknown as CaptainCardPayload
      }
      return updates
    })
    closeDetail()
  }, [detail?.cardId, brief?.cards, closeDetail])

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
  const chipCard = activeCards.find((c: BriefCard) => c.type === 'chip')
  const lineupCards = activeCards.filter((c: BriefCard) => c.type === 'lineup')
  const previewCards = activeCards.filter((c: BriefCard) => c.type === 'preview')

  const { panelLabel, panelTitle } = useMemo(() => {
    if (!detail?.cardId) return { panelLabel: '', panelTitle: '' }
    const card = activeCards.find(c => c.id === detail.cardId)
    if (!card) return { panelLabel: '', panelTitle: '' }

    if (card.type === 'transfer') {
      const payload = card.payload as TransferCardPayload
      const tCards = activeCards.filter(c => c.type === 'transfer')
      const idx = tCards.findIndex(c => c.id === card.id)
      const label = tCards.length > 1 ? `Transfer ${idx + 1} of ${tCards.length}` : 'Transfer'
      if (payload.save) return { panelLabel: label, panelTitle: 'Save your transfer' }
      return { panelLabel: label, panelTitle: (payload as TransferCardPayloadTransfer).topPick.player.web_name }
    }

    if (card.type === 'captain') {
      const payload = card.payload as CaptainCardPayload
      return { panelLabel: 'Captain', panelTitle: payload.captain.player.web_name }
    }

    if (card.type === 'lineup') {
      return { panelLabel: 'Your XI', panelTitle: 'Your lineup' }
    }

    return { panelLabel: '', panelTitle: '' }
  }, [detail?.cardId, activeCards])

  const sharedDetailProps = {
    detail,
    onClose: closeDetail,
    onTabChange: changeTab,
    panelLabel,
    panelTitle,
    traceSteps: brief?.trace ?? [],
    counterTraceSteps: detail?.cardId ? counterTraces[detail.cardId] : undefined,
    gameweek,
    version: brief?.version ?? 1,
    counterPhase: activeCounterPhase,
    quickReplies,
    onCounterSubmit: submitCounter,
    onCounterReset: resetCounter,
    onRegenerate: handleRegenerate,
    counterDisabled: !canCounter || activeCounterPhase.phase === 'checking',
    counterDisabledReason,
    countersLeft,
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* App bar */}
      <header
        className="sticky top-0 z-20 border-b border-[#2C2C2C]"
        style={{ background: 'rgba(24,24,24,0.94)', backdropFilter: 'blur(12px)' }}
      >
        <div className="mx-auto max-w-[1200px] px-4 pb-[10px] md:px-6 md:pb-0">
        {/* Logo row */}
        <div className="flex h-[54px] items-center gap-3 md:h-16">
          <div className="md:hidden"><Logo size={26} /></div>
          <div className="hidden md:block"><Logo size={30} /></div>

          {/* Nav — desktop: inline; mobile: second row */}
          <div className="ml-2 hidden md:flex items-center gap-1 rounded-[10px] bg-[#232323] p-1">
            <button
              type="button"
              onClick={() => setView('thisweek')}
              className={cn(
                'inline-flex h-10 items-center rounded-[6px] border-0 px-3.5 text-[14px] font-medium transition-colors',
                view === 'thisweek'
                  ? 'bg-[#383838] text-foreground'
                  : 'bg-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => setView('record')}
              className={cn(
                'inline-flex h-10 items-center rounded-[6px] border-0 px-3.5 text-[14px] font-medium transition-colors',
                view === 'record'
                  ? 'bg-[#383838] text-foreground'
                  : 'bg-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              Record
            </button>
          </div>

          <div className="flex-1" />

          {/* Last 5 GWs chip — desktop only */}
          <span className="hidden md:inline-flex h-9 items-center gap-2 rounded-full border border-border px-3 text-[13px] text-foreground">
            Last 5 GWs
            <span className="font-mono text-muted-foreground">pending</span>
          </span>

          <AccountMenu initial={initial} displayName={displayName} emailOptOut={emailOptOut} />
        </div>

        {/* Mobile nav row */}
        <div className="flex md:hidden items-center gap-1 rounded-[10px] bg-[#232323] p-1">
          <button
            type="button"
            onClick={() => setView('thisweek')}
            className={cn(
              'flex-1 inline-flex h-10 items-center justify-center rounded-[6px] border-0 text-[14px] font-medium transition-colors',
              view === 'thisweek'
                ? 'bg-[#383838] text-foreground'
                : 'bg-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => setView('record')}
            className={cn(
              'flex-1 inline-flex h-10 items-center justify-center rounded-[6px] border-0 text-[14px] font-medium transition-colors',
              view === 'record'
                ? 'bg-[#383838] text-foreground'
                : 'bg-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Record
          </button>
        </div>
        </div>
      </header>

      {/* System banners */}
      {isFplUpdating && (
        <BriefBanner variant="info">
          <strong>FPL is updating.</strong>{' '}
          {brief ? 'Showing your saved brief. ' : ''}
          Counters pause until FPL is back.
        </BriefBanner>
      )}
      {isDeadlinePassed && (
        <BriefBanner variant="info">
          <strong>The GW {gameweek} deadline has passed.</strong> This brief is read-only. Your GW{' '}
          {gameweek + 1} brief arrives once the window opens.
        </BriefBanner>
      )}
      {isEarlyPlanning && !isDeadlinePassed && (
        <BriefBanner variant="warning">
          <strong>International break — planning brief.</strong> FPL data can change significantly
          during the break. Don&apos;t make your actual transfer yet — wait until closer to the GW{' '}
          {gameweek} deadline to act on this advice.
        </BriefBanner>
      )}

      {/* Status strip — full-width on desktop */}
      {view === 'thisweek' && brief && (
        <div className="md:border-b md:border-[#2C2C2C] md:bg-background-alt">
          <div className="mx-auto max-w-[1200px] px-4 md:px-6">
            <StatusStrip
              gameweek={gameweek}
              teamName={teamName}
              generatedAt={brief.generatedAt}
              refreshesThisGw={refreshesThisGw}
              onRefresh={triggerGenerate}
              refreshing={genState.phase === 'generating'}
              deadlineMs={deadlineMs}
              isDeadlinePassed={isDeadlinePassed}
              freeTransfers={freeTransfers}
              bankTenths={bankTenths}
              countersLeft={countersLeft}
              counterCap={COUNTER_CAP}
            />
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 pt-4 pb-12 md:pt-7 md:pb-16">
        <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6">

          {view === 'record' ? (
            <div className="space-y-4 pt-2">
              <div className="flex flex-col gap-1">
                <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Record
                </p>
                <p className="text-[22px] font-semibold tracking-[-0.01em] text-foreground">
                  Your decision history
                </p>
              </div>
              <ReceiptsSection data={receiptData} />
            </div>
          ) : (
            <div className="md:flex md:items-start md:gap-5">
              {/* Cards column */}
              <div className="md:flex-[999_1_620px] md:min-w-0">
                <div className="space-y-4">

                  {/* genState feedback (no_change / error) */}
                  {genState.phase === 'no_change' && (
                    <BriefBanner variant="info">
                      Brief is up to date — nothing changed since last generation.
                    </BriefBanner>
                  )}
                  {(genState.phase === 'error' || genState.phase === 'fpl_updating') && (
                    <BriefBanner variant="warning">
                      {genState.phase === 'fpl_updating'
                        ? 'FPL is updating — try again shortly.'
                        : (genState as { phase: 'error'; message: string }).message}
                      <button
                        type="button"
                        onClick={triggerGenerate}
                        className="ml-3 font-semibold underline underline-offset-2 hover:no-underline"
                      >
                        Retry
                      </button>
                    </BriefBanner>
                  )}

                  {brief ? (
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

                      {/* Pitch view */}
                      {lineupCards.map((card) => (
                        <PitchView
                          key={card.id}
                          payload={card.payload as LineupCardPayload}
                          gameweek={gameweek}
                          captainId={captainCard ? (captainCard.payload as CaptainCardPayload).captain.player.id : undefined}
                          vcId={captainCard ? (captainCard.payload as CaptainCardPayload).vc.player.id : undefined}
                          onTraceClick={(t) => openDetail(card.id, 'trace', t)}
                          onCounterClick={captainCard ? (t) => openDetail(captainCard.id, 'counter', t) : undefined}
                          isSelected={detail?.cardId === card.id}
                        />
                      ))}

                      {/* Transfer(s) */}
                      {transferCards.map((card, i) => {
                        const payload = card.payload as TransferCardPayload
                        const cardPhase = counterStates[card.id] ?? { phase: 'idle' }
                        const cardCounterDisabled = !canCounter || cardPhase.phase === 'checking'
                        return (
                          <section
                            key={card.id}
                            id={i === 0 ? 'transfer-section' : `transfer-section-${i}`}
                            className={i > 0 ? 'brief-card-anim' : undefined}
                            style={i > 0 ? { animationDelay: `${i * 60}ms` } : undefined}
                          >
                            <TransferCard
                              payload={payload}
                              cardIndex={i}
                              totalCards={transferCards.length}
                              onCounterClick={(t) => openDetail(card.id, 'counter', t)}
                              counterDisabled={cardCounterDisabled}
                              counterDisabledReason={counterDisabledReason}
                              onTraceClick={(t) => openDetail(card.id, 'trace', t)}
                              isSelected={detail?.cardId === card.id}
                              newsFlags={card.newsFlags}
                            />
                          </section>
                        )
                      })}

                      {/* Captain */}
                      {captainCard && (() => {
                        const cardPhase = counterStates[captainCard.id] ?? { phase: 'idle' }
                        const cardCounterDisabled = !canCounter || cardPhase.phase === 'checking'
                        return (
                          <section
                            id="captain-section"
                            className="brief-card-anim"
                            style={{ animationDelay: `${transferCards.length * 60}ms` }}
                          >
                            <CaptainCard
                              payload={captainCard.payload as CaptainCardPayload}
                              onCounterClick={(t) => openDetail(captainCard.id, 'counter', t)}
                              counterDisabled={cardCounterDisabled}
                              counterDisabledReason={counterDisabledReason}
                              onTraceClick={(t) => openDetail(captainCard.id, 'trace', t)}
                              isSelected={detail?.cardId === captainCard.id}
                              newsFlags={captainCard.newsFlags}
                            />
                          </section>
                        )
                      })()}

                      {/* Chips line */}
                      {chipCard && (() => {
                        const chipPayload = chipCard.payload as ChipCardPayload
                        return (
                          <section
                            id="chip-section"
                            className="brief-card-anim"
                            style={{ animationDelay: `${(transferCards.length + 1) * 60}ms` }}
                          >
                            <ChipsLine payload={chipPayload} />
                          </section>
                        )
                      })()}

                      {/* Next-week preview line */}
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
                    </div>
                  ) : (
                    <NoBriefState
                      gameweek={gameweek}
                      genState={genState}
                      isEarlyPlanning={isEarlyPlanning}
                      isFplUpdating={isFplUpdating}
                      onGenerate={triggerGenerate}
                      onReload={() => router.refresh()}
                    />
                  )}

                </div>
              </div>

              {/* Desktop detail panel */}
              {!isMobile && (
                <DetailSheet {...sharedDetailProps} isMobile={false} />
              )}
            </div>
          )}
        </div>
      </main>

      {/* Mobile detail sheet */}
      {isMobile && <DetailSheet {...sharedDetailProps} isMobile={true} />}

      {/* Footer */}
      <footer className="border-border border-t">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-5 md:px-6 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-6 md:gap-y-1">
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

// ── Empty state component ─────────────────────────────────────────────────────

function NoBriefState({
  gameweek,
  genState,
  isEarlyPlanning,
  isFplUpdating,
  onGenerate,
  onReload,
}: {
  gameweek: number
  genState: GenState
  isEarlyPlanning: boolean
  isFplUpdating: boolean
  onGenerate: () => void
  onReload: () => void
}) {
  if (genState.phase === 'generating') {
    return (
      <div className="border-border bg-card rounded-lg border px-6 py-10 text-center">
        <p className="text-[15px] font-semibold text-foreground">
          {isEarlyPlanning ? 'Generating your planning brief…' : 'Generating your brief…'}
        </p>
        {genState.steps.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {genState.steps.map((s, i) => (
              <li key={i} className="text-[13px] text-muted-foreground">{s}</li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (genState.phase === 'error' || genState.phase === 'fpl_updating') {
    return (
      <div className="border-border bg-card rounded-lg border px-6 py-10 text-center">
        <p className="text-[15px] font-semibold text-foreground">
          {genState.phase === 'fpl_updating' ? 'FPL is updating' : 'Something went wrong'}
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {genState.phase === 'fpl_updating'
            ? 'Try again in a few minutes.'
            : (genState as { phase: 'error'; message: string }).message}
        </p>
        <button
          type="button"
          onClick={onGenerate}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-primary px-5 py-2.5 text-[14px] font-semibold text-background hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  // phase === 'idle' or 'no_change'
  if (isEarlyPlanning) {
    return (
      <div className="border-border bg-card rounded-lg border px-6 py-10 text-center">
        <p className="text-[15px] font-semibold text-foreground">No planning brief yet for GW {gameweek}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Explore your options early — but wait until closer to the deadline to make your actual transfer.
        </p>
        <button
          type="button"
          onClick={onGenerate}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-primary px-5 py-2.5 text-[14px] font-semibold text-background hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring transition-colors"
        >
          Generate planning brief
        </button>
      </div>
    )
  }

  return (
    <div className="border-border bg-card rounded-lg border px-6 py-10 text-center">
      <p className="text-[15px] font-semibold text-foreground">No brief yet for GW {gameweek}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        {isFplUpdating
          ? "FPL is updating — reload once it's back to generate your brief."
          : 'Your brief will arrive on schedule before the deadline.'}
      </p>
      {isFplUpdating && (
        <button
          type="button"
          onClick={onReload}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-border px-5 py-2.5 text-[14px] font-semibold text-foreground hover:bg-secondary/50 focus-visible:outline-2 focus-visible:outline-ring transition-colors"
        >
          Reload
        </button>
      )}
    </div>
  )
}
