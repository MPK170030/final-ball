'use client'

import { useState, useEffect, useRef } from 'react'
import { TransferCard } from '@/components/brief/transfer-card'
import { DetailSheet } from '@/components/brief/detail-sheet'
import { cn } from '@/lib/utils'
import {
  DEMO_OPTIONS,
  DEMO_TRACE_STEPS,
  DEMO_QUICK_REPLIES,
  DEMO_COUNTER_OUTCOMES,
  type DemoCounterOutcome,
} from '@/content/landing-demo'
import type { CounterPhase } from '@/components/brief/types'

const TAB_LABELS = ['Top pick', 'Safe', 'Bold'] as const

type DemoPhase = 'animating' | 'done'

const TOOL_NAMES = [
  'get_squad',
  'get_news',
  'get_fixtures',
  'search_candidates',
  'compare',
  'check_constraints',
] as const

export function LiveBriefDemo() {
  const [phase, setPhase] = useState<DemoPhase>('animating')
  const [visibleSteps, setVisibleSteps] = useState(0)
  const [selectedTab, setSelectedTab] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTab, setDetailTab] = useState<'counter' | 'trace'>('trace')
  const [counterPhase, setCounterPhase] = useState<CounterPhase>({ phase: 'idle' })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check reduced motion — skip animation if requested
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Animation sequence
  useEffect(() => {
    if (prefersReducedMotion) {
      setVisibleSteps(TOOL_NAMES.length)
      setPhase('done')
      return
    }

    if (phase !== 'animating') return

    intervalRef.current = setInterval(() => {
      setVisibleSteps((prev) => {
        const next = prev + 1
        if (next >= TOOL_NAMES.length) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          setTimeout(() => setPhase('done'), 450)
        }
        return next
      })
    }, 750)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [phase, prefersReducedMotion])

  function replay() {
    setPhase('animating')
    setVisibleSteps(0)
    setDetailOpen(false)
    setCounterPhase({ phase: 'idle' })
  }

  function handleTraceClick() {
    setDetailTab('trace')
    setDetailOpen(true)
  }

  function handleCounterClick() {
    setDetailTab('counter')
    setDetailOpen(true)
  }

  function handleCounterSubmit(quickReply: string | null, _message: string) {
    setCounterPhase({ phase: 'checking', steps: ['Checking your argument...', 'Reviewing fixtures...'] })
    setTimeout(() => {
      const outcome =
        DEMO_COUNTER_OUTCOMES.find((o) => o.trigger === quickReply) ??
        DEMO_COUNTER_OUTCOMES[DEMO_COUNTER_OUTCOMES.length - 1]
      const done: DemoCounterOutcome = { phase: 'done', ...outcome }
      setCounterPhase(done)
    }, 1400)
  }

  const currentPayload = DEMO_OPTIONS[selectedTab]

  return (
    <div className="relative w-full">
      {/* Stacked card decoration — aria-hidden */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 top-7 h-full rounded-[14px] border border-border"
        style={{ background: '#202020' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 top-3.5 h-full rounded-[14px] border border-border"
        style={{ background: '#262626' }}
      />

      {/* Main card */}
      <div className="relative z-10 rounded-[14px] border border-border bg-card p-4 md:p-5">
        {/* Header: label + option tabs */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            GW13 · Transfer
          </span>
          <div
            role="tablist"
            aria-label="Pick variant"
            className="flex items-center rounded-[8px] bg-secondary p-0.5"
          >
            {TAB_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={selectedTab === i}
                onClick={() => {
                  setSelectedTab(i)
                  setCounterPhase({ phase: 'idle' })
                }}
                className={cn(
                  'min-h-[32px] rounded-[6px] px-3 text-[13px] font-semibold transition-colors',
                  selectedTab === i
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Trace — fixed-height row slot + counter. No reflow on transition. */}
        <div className="mb-3">
          <div className="mb-1 h-[36px]">
            {phase === 'animating' && visibleSteps > 0 && (() => {
              const name = TOOL_NAMES[visibleSteps - 1]
              return (
                <div className="flex h-full items-center gap-2.5 rounded-[8px] bg-secondary px-3 trace-row-anim">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-primary"
                    aria-hidden="true"
                  />
                  <span className="flex-1 font-mono text-[13px] text-foreground">{name}</span>
                  <span
                    className="h-2 w-20 rounded-sm bg-gradient-to-r from-secondary via-muted-foreground/20 to-secondary"
                    style={{ backgroundSize: '400% 100%', animation: 'shimmer 1.5s linear infinite' }}
                    aria-hidden="true"
                  />
                </div>
              )
            })()}
          </div>
          <p className="text-right font-mono text-[12px] text-muted-foreground tabular-nums">
            {Math.min(visibleSteps, TOOL_NAMES.length)} / {TOOL_NAMES.length} tool calls
          </p>
        </div>

        {/* Transfer card — always rendered; fades in to avoid layout jump */}
        <div
          className={cn(
            'transition-opacity duration-500',
            phase === 'done' ? 'opacity-100' : 'pointer-events-none select-none opacity-0',
          )}
        >
          <TransferCard
            payload={currentPayload}
            cardIndex={0}
            totalCards={1}
            onTraceClick={() => handleTraceClick()}
            onCounterClick={() => handleCounterClick()}
            counterDisabled={false}
          />
        </div>

        {/* Replay link — fades in with the card */}
        <div
          className={cn(
            'mt-3 flex justify-end transition-opacity duration-500',
            phase === 'done' ? 'opacity-100' : 'pointer-events-none select-none opacity-0',
          )}
        >
          <button
            type="button"
            onClick={replay}
            className="text-[13px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Replay
          </button>
        </div>
      </div>

      {/* Detail sheet — always bottom sheet so it doesn't disrupt the hero layout */}
      {phase === 'done' && (
        <DetailSheet
          detail={detailOpen ? { cardId: 'demo', tab: detailTab } : null}
          onClose={() => setDetailOpen(false)}
          onTabChange={(t) => setDetailTab(t)}
          panelLabel="Transfer"
          panelTitle={currentPayload.topPick.player.web_name}
          traceSteps={DEMO_TRACE_STEPS}
          gameweek={13}
          version={1}
          isMobile={true}
          counterPhase={counterPhase}
          quickReplies={DEMO_QUICK_REPLIES}
          onCounterSubmit={(quickReply, msg) => handleCounterSubmit(quickReply, msg)}
          onCounterReset={() => setCounterPhase({ phase: 'idle' })}
          onRegenerate={() => {}}
          counterDisabled={false}
        />
      )}
    </div>
  )
}
