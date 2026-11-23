'use client'

import { useState } from 'react'
import { XIcon, Loader2Icon } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { TraceStepList } from './trace-step-list'
import { cn } from '@/lib/utils'
import type { TraceStep } from '@finalball/agent'
import type { DetailState, CounterPhase } from './types'

// ── Counter tab UI ─────────────────────────────────────────────────────────────

function CounterCompose({
  quickReplies,
  onSubmit,
  disabled,
  disabledReason,
  countersLeft,
}: {
  quickReplies: string[]
  onSubmit: (quickReply: string | null, message: string) => void
  disabled: boolean
  disabledReason?: string
  countersLeft?: number
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [text, setText] = useState('')
  const MAX = 200

  const canSend = !disabled && (!!selected || text.trim().length > 0)

  const handleSend = () => {
    if (!canSend) return
    const finalMessage = [selected, text.trim()].filter(Boolean).join(' · ')
    onSubmit(selected, finalMessage)
  }

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1">
        <p className="text-[13px] text-muted-foreground">
          Push back on this pick. The agent re-checks with its tools before it answers.
        </p>
        {countersLeft !== undefined && (
          <p className="text-[13px]">
            <span className="text-foreground">{countersLeft} of 10 left this GW.</span>
          </p>
        )}
      </div>

      {disabled && disabledReason && (
        <p className="rounded-[8px] bg-secondary/60 px-3 py-2.5 text-[13px] text-muted-foreground">
          {disabledReason}
        </p>
      )}

      {quickReplies.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickReplies.map((qr) => (
            <button
              key={qr}
              type="button"
              disabled={disabled}
              onClick={() => setSelected((prev) => (prev === qr ? null : qr))}
              className={cn(
                'inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                selected === qr
                  ? 'border-primary text-primary'
                  : 'border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground',
                'disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              {qr}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ctr" className="text-[13px] font-medium text-foreground">
          Or say it your way
        </label>
        <div className="relative">
          <textarea
            id="ctr"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            disabled={disabled}
            placeholder="Say why you disagree, or add context..."
            rows={4}
            className="w-full resize-none rounded-[8px] border border-border bg-background px-3 py-2.5 text-[14px] leading-5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          />
          <span
            className={cn(
              'pointer-events-none absolute bottom-2.5 right-3 font-mono text-[11px] tabular-nums',
              text.length >= MAX ? 'text-warning' : 'text-muted-foreground',
            )}
          >
            {text.length}/{MAX}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        className="inline-flex h-9 items-center rounded-[6px] bg-foreground px-3.5 text-[13px] font-semibold text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 transition-opacity"
      >
        Send counter
      </button>
    </div>
  )
}

function CounterChecking({ steps }: { steps: string[] }) {
  return (
    <div className="space-y-3 py-2">
      <p className="text-[13px] text-muted-foreground">Reviewing your counter...</p>
      <ul className="space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-2.5 text-[13px] text-foreground">
            <span className="size-4 shrink-0 font-mono text-primary" aria-hidden="true">
              ✓
            </span>
            {step}
          </li>
        ))}
        <li className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
          <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
          Working...
        </li>
      </ul>
    </div>
  )
}

type RegenState =
  | { phase: 'idle' }
  | { phase: 'loading'; steps: string[] }
  | { phase: 'error'; message: string }

function CounterOutcome({
  outcome,
  response,
  newPick,
  counterId,
  counterType,
  onReset,
  onRegenerate,
}: {
  outcome: string
  response: string
  newPick: unknown
  counterId?: string
  counterType?: string
  onReset: () => void
  onRegenerate: (payload: Record<string, unknown>, lineupPayload?: Record<string, unknown>, captainPayload?: Record<string, unknown>) => void
}) {
  const [regenState, setRegenState] = useState<RegenState>({ phase: 'idle' })

  const OUTCOME_LABELS: Record<string, string> = {
    held: 'Agent holds the pick',
    changed_fact: 'Agent updates the pick',
    accepted_preference: 'Agent accepts your preference',
    declined: 'Off-topic',
  }

  const newPickObj = newPick as Record<string, unknown> | null
  const newPickName = newPickObj?.playerName as string | undefined
  const newPickBuyName = newPickObj?.buyPlayerName as string | undefined
  const newPickReason = newPickObj?.reason as string | undefined
  const isWeakspotChange = outcome === 'changed_fact' && !!newPickBuyName

  const canRegenerate =
    counterType === 'weakspot' &&
    !!newPickName &&
    !!counterId &&
    (outcome === 'accepted_preference' || outcome === 'changed_fact')

  const handleRegenerate = async () => {
    if (!counterId) return
    setRegenState({ phase: 'loading', steps: [] })
    try {
      const res = await fetch(`/api/counter/${counterId}/regenerate`, { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6)) as {
            step?: string
            status?: string
            payload?: Record<string, unknown>
            lineupPayload?: Record<string, unknown>
            captainPayload?: Record<string, unknown>
            message?: string
          }
          if (data.step) {
            setRegenState(prev =>
              prev.phase === 'loading'
                ? { phase: 'loading', steps: [...prev.steps, data.step!] }
                : prev,
            )
          } else if (data.status === 'ready' && data.payload) {
            onRegenerate(data.payload, data.lineupPayload, data.captainPayload)
            return
          } else if (data.status === 'error') {
            throw new Error(data.message ?? 'Regenerate failed')
          }
        }
      }
    } catch (err) {
      setRegenState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Failed',
      })
    }
  }

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2 rounded-[10px] border border-border bg-background p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {OUTCOME_LABELS[outcome] ?? 'Result'}
        </p>
        <p className="text-[14px] leading-5 text-foreground">{response}</p>
        {outcome === 'changed_fact' && newPickName && (
          <div className="mt-3 space-y-1 border-t border-border pt-3">
            {isWeakspotChange ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  New sell candidate
                </p>
                <p className="text-[16px] leading-6 font-semibold text-foreground">{newPickName}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Best buy
                </p>
                <p className="text-[16px] leading-6 font-semibold text-foreground">{newPickBuyName}</p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  New pick
                </p>
                <p className="text-[16px] leading-6 font-semibold text-foreground">{newPickName}</p>
              </>
            )}
            {newPickReason && (
              <p className="text-[13px] leading-[18px] text-foreground">{newPickReason}</p>
            )}
          </div>
        )}
        {regenState.phase === 'error' && (
          <p className="mt-3 text-[13px] text-muted-foreground border-t border-border pt-3">
            Regenerate failed: {regenState.message}
          </p>
        )}
      </div>

      {canRegenerate && regenState.phase === 'idle' && (
        <div className="rounded-[10px] border border-border bg-background p-4 space-y-3">
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Regenerate the card with <span className="font-semibold text-foreground">{newPickName}</span> as the sell candidate instead.
          </p>
          <button
            type="button"
            onClick={handleRegenerate}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[8px] bg-secondary px-5 text-[14px] font-semibold text-foreground hover:bg-secondary/80 transition-colors"
          >
            Regenerate card
          </button>
        </div>
      )}

      {regenState.phase === 'loading' && (
        <div className="rounded-[10px] border border-border bg-background p-4 space-y-2">
          <p className="text-[13px] text-muted-foreground">Regenerating...</p>
          {regenState.steps.map((step, i) => (
            <p key={i} className="flex items-center gap-2 text-[13px] text-foreground">
              <span className="font-mono text-primary" aria-hidden="true">✓</span>
              {step}
            </p>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onReset}
        className="inline-flex min-h-[44px] items-center border-0 bg-transparent p-0 text-[13px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground cursor-pointer"
      >
        Counter again
      </button>
    </div>
  )
}

function CounterError({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div className="space-y-4 py-2">
      <div className="rounded-[8px] border border-warning/40 bg-warning/10 px-3 py-2.5">
        <p className="text-[13px] text-foreground">Something went wrong: {message}</p>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex min-h-[44px] items-center border-0 bg-transparent p-0 text-[14px] font-semibold text-foreground underline underline-offset-[3px] hover:text-primary cursor-pointer"
      >
        Try again
      </button>
    </div>
  )
}

function CounterTab({
  counterPhase,
  quickReplies,
  onSubmit,
  onReset,
  onRegenerate,
  disabled,
  disabledReason,
  countersLeft,
}: {
  counterPhase: CounterPhase
  quickReplies: string[]
  onSubmit: (quickReply: string | null, message: string) => void
  onReset: () => void
  onRegenerate: (payload: Record<string, unknown>, lineupPayload?: Record<string, unknown>, captainPayload?: Record<string, unknown>) => void
  disabled: boolean
  disabledReason?: string
  countersLeft?: number
}) {
  if (counterPhase.phase === 'checking') {
    return <CounterChecking steps={counterPhase.steps} />
  }
  if (counterPhase.phase === 'done') {
    return (
      <CounterOutcome
        outcome={counterPhase.outcome}
        response={counterPhase.response}
        newPick={counterPhase.newPick}
        counterId={counterPhase.counterId}
        counterType={counterPhase.counterType}
        onReset={onReset}
        onRegenerate={onRegenerate}
      />
    )
  }
  if (counterPhase.phase === 'error') {
    return <CounterError message={counterPhase.message} onReset={onReset} />
  }
  return (
    <CounterCompose
      quickReplies={quickReplies}
      onSubmit={onSubmit}
      disabled={disabled}
      disabledReason={disabledReason}
      countersLeft={countersLeft}
    />
  )
}

// ── Shared panel content ──────────────────────────────────────────────────────

interface PanelContentProps {
  label: string
  mainTitle: string
  tab: 'counter' | 'trace'
  onTabChange: (tab: 'counter' | 'trace') => void
  onClose: () => void
  traceSteps: TraceStep[]
  counterTraceSteps?: string[]
  gameweek: number
  version: number
  counterPhase: CounterPhase
  quickReplies: string[]
  onCounterSubmit: (quickReply: string | null, message: string) => void
  onCounterReset: () => void
  onRegenerate: (payload: Record<string, unknown>, lineupPayload?: Record<string, unknown>, captainPayload?: Record<string, unknown>) => void
  counterDisabled: boolean
  counterDisabledReason?: string
  countersLeft?: number
  closeButtonClass?: string
}

function PanelContent({
  label,
  mainTitle,
  tab,
  onTabChange,
  onClose,
  traceSteps,
  counterTraceSteps,
  gameweek,
  version,
  counterPhase,
  quickReplies,
  onCounterSubmit,
  onCounterReset,
  onRegenerate,
  counterDisabled,
  counterDisabledReason,
  countersLeft,
  closeButtonClass = '',
}: PanelContentProps) {
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Header: label + title + tabs + close */}
      <div className="relative border-b border-border px-4 pt-5 pb-3 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            closeButtonClass,
          )}
          aria-label="Close"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>

        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <p className="mb-3 text-[18px] leading-6 font-semibold text-foreground pr-8">
          {mainTitle}
        </p>

        {/* Pill tabs */}
        <div className="mb-3 flex gap-1 rounded-[10px] bg-background p-1" role="tablist">
          {(['counter', 'trace'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => onTabChange(t)}
              className={cn(
                'flex h-10 flex-1 items-center justify-center rounded-[6px] border-0 text-[14px] font-medium transition-colors',
                tab === t
                  ? 'bg-foreground text-background'
                  : 'bg-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {tab === 'counter' ? (
          <CounterTab
            counterPhase={counterPhase}
            quickReplies={quickReplies}
            onSubmit={onCounterSubmit}
            onReset={onCounterReset}
            onRegenerate={onRegenerate}
            disabled={counterDisabled}
            disabledReason={counterDisabledReason}
            countersLeft={countersLeft}
          />
        ) : (
          <div>
            <p className="mb-4 text-[13px] text-muted-foreground">
              Whole brief · GW {gameweek} · version {version}
            </p>
            <TraceStepList steps={traceSteps} />
            {counterTraceSteps && counterTraceSteps.length > 0 && (
              <div className="mt-5 pt-4 border-t border-border">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Counter steps
                </p>
                <ol className="space-y-1.5">
                  {counterTraceSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px]">
                      <span className="shrink-0 w-4 font-mono text-[12px] text-primary tabular-nums">
                        {i + 1}
                      </span>
                      <span className="text-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Mobile: bottom Sheet ──────────────────────────────────────────────────────

type SharedPanelProps = Omit<PanelContentProps, 'closeButtonClass'>

export function MobileDetailSheet({
  open,
  onClose,
  ...panelProps
}: SharedPanelProps & { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[80dvh] rounded-[14px_14px_0_0] border-t border-border p-0 overflow-hidden"
      >
        <SheetTitle className="sr-only">{panelProps.mainTitle}</SheetTitle>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1" aria-hidden="true">
          <div className="h-1 w-9 rounded-[4px] bg-[#6B6B6B]" />
        </div>
        <PanelContent {...panelProps} onClose={onClose} />
      </SheetContent>
    </Sheet>
  )
}

// ── Desktop: side panel ────────────────────────────────────────────────────────

export function DesktopDetailPanel({
  onClose,
  ...panelProps
}: SharedPanelProps & { onClose: () => void }) {
  return (
    <aside
      role="region"
      aria-label="Card details"
      className="border-border bg-card rounded-[14px] border flex flex-col flex-[1_1_340px] max-w-[420px] shrink-0 sticky top-[150px] max-h-[calc(100dvh-150px)] overflow-y-auto"
    >
      <PanelContent {...panelProps} onClose={onClose} />
    </aside>
  )
}

// ── Unified component ──────────────────────────────────────────────────────────

export interface DetailSheetProps {
  detail: DetailState | null
  onClose: () => void
  onTabChange: (tab: 'counter' | 'trace') => void
  panelLabel: string
  panelTitle: string
  traceSteps: TraceStep[]
  counterTraceSteps?: string[]
  gameweek: number
  version: number
  isMobile: boolean
  counterPhase: CounterPhase
  quickReplies: string[]
  onCounterSubmit: (quickReply: string | null, message: string) => void
  onCounterReset: () => void
  onRegenerate: (payload: Record<string, unknown>, lineupPayload?: Record<string, unknown>, captainPayload?: Record<string, unknown>) => void
  counterDisabled: boolean
  counterDisabledReason?: string
  countersLeft?: number
}

export function DetailSheet({
  detail,
  onClose,
  onTabChange,
  panelLabel,
  panelTitle,
  traceSteps,
  counterTraceSteps,
  gameweek,
  version,
  isMobile,
  counterPhase,
  quickReplies,
  onCounterSubmit,
  onCounterReset,
  onRegenerate,
  counterDisabled,
  counterDisabledReason,
  countersLeft,
}: DetailSheetProps) {
  if (!detail) {
    if (!isMobile) {
      return (
        <aside
          role="region"
          aria-label="Card details"
          className="border-border bg-card rounded-[14px] border flex flex-col flex-[1_1_340px] max-w-[420px] shrink-0 sticky top-[150px] max-h-[calc(100dvh-150px)] p-[18px] overflow-y-auto"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground" />
            <span className="text-[12px] text-muted-foreground">Pick Counter or Trace on a card</span>
          </div>
        </aside>
      )
    }
    return null
  }

  const sharedProps: SharedPanelProps = {
    label: panelLabel,
    mainTitle: panelTitle,
    tab: detail.tab,
    onTabChange,
    onClose,
    traceSteps,
    counterTraceSteps,
    gameweek,
    version,
    counterPhase,
    quickReplies,
    onCounterSubmit,
    onCounterReset,
    onRegenerate,
    counterDisabled,
    counterDisabledReason,
    countersLeft,
  }

  if (isMobile) {
    return <MobileDetailSheet open={!!detail} {...sharedProps} />
  }

  return <DesktopDetailPanel {...sharedProps} />
}
