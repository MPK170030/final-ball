'use client'

import { useState } from 'react'
import { XIcon, Loader2Icon } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TraceStepList } from './trace-step-list'
import { cn } from '@/lib/utils'
import type { TraceStep } from '@finalball/agent'
import type {
  TransferCardPayloadTransfer,
  CaptainCardPayload,
  DetailState,
  CounterPhase,
} from './types'

const POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </p>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-0.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </p>
  )
}

// ── Counter tab UI ─────────────────────────────────────────────────────────────

function CounterCompose({
  quickReplies,
  onSubmit,
  disabled,
  disabledReason,
}: {
  quickReplies: string[]
  onSubmit: (quickReply: string | null, message: string) => void
  disabled: boolean
  disabledReason?: string
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [text, setText] = useState('')
  const MAX = 400

  const canSend = !disabled && (!!selected || text.trim().length > 0)

  const handleSend = () => {
    if (!canSend) return
    const finalMessage = [selected, text.trim()].filter(Boolean).join(' · ')
    onSubmit(selected, finalMessage)
  }

  return (
    <div className="space-y-4 py-2">
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

      <div className="relative">
        <textarea
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

      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        className="inline-flex min-h-[44px] items-center justify-center rounded-[8px] bg-primary px-5 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
      >
        Send to agent
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

function CounterOutcome({
  outcome,
  response,
  newPick,
  onReset,
}: {
  outcome: string
  response: string
  newPick: unknown
  onReset: () => void
}) {
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
      </div>

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
  disabled,
  disabledReason,
}: {
  counterPhase: CounterPhase
  quickReplies: string[]
  onSubmit: (quickReply: string | null, message: string) => void
  onReset: () => void
  disabled: boolean
  disabledReason?: string
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
        onReset={onReset}
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
    />
  )
}

// ── Why Transfer ──────────────────────────────────────────────────────────────

function WhyTransfer({ payload }: { payload: TransferCardPayloadTransfer }) {
  return (
    <div className="space-y-5 py-2">
      {/* 1 · Why sell */}
      <section>
        <SectionLabel>1 · Why sell {payload.sell.player.web_name}</SectionLabel>
        {payload.whySell ? (
          <p className="mb-3 text-[15px] leading-[22px] text-foreground">{payload.whySell}</p>
        ) : null}
        {payload.whySellContext.length > 0 && (
          <div className="space-y-2">
            {payload.whySellContext.map((ws, i) => {
              const isSell = ws.player.id === payload.sell.player.id
              const pos = POS[ws.player.element_type] ?? '?'
              const price = `£${(ws.player.now_cost / 10).toFixed(1)}m`
              const flagText = ws.player.news ? ws.player.news.slice(0, 35) : null
              const meta = [
                ws.clubShortName ?? null,
                flagText,
                `Form ${ws.player.form}`,
                `${ws.score.total.toFixed(1)} pts next 3`,
              ]
                .filter(Boolean)
                .join(' · ')
              return (
                <div
                  key={ws.player.id}
                  className={cn(
                    'rounded-[8px] border px-3 py-2.5',
                    isSell ? 'border-[1.5px] border-foreground' : 'border-border',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="shrink-0 w-4 font-mono text-[12px] text-muted-foreground tabular-nums">
                        {i + 1}
                      </span>
                      <span className="text-[14px] leading-5 font-semibold text-foreground truncate">
                        {ws.player.web_name}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[12px] text-muted-foreground tabular-nums">
                      {pos} · {price}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] leading-[18px] text-muted-foreground">{meta}</p>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 2 · Why top pick */}
      <section>
        <SectionLabel>2 · Why {payload.topPick.player.web_name}</SectionLabel>
        {payload.topPickReason ? (
          <p className="mb-3 text-[14px] leading-5 text-foreground">{payload.topPickReason}</p>
        ) : null}
        {(() => {
          const rows = [
            { label: 'Form', text: payload.topPickWhy.form },
            { label: 'Next 3 Fixtures', text: payload.topPickWhy.fixtures },
            { label: 'Price', text: payload.topPickWhy.price },
            { label: 'Risks', text: payload.topPickWhy.risks },
          ].filter(({ text }) => text)
          return rows.length > 0 ? (
            <div className="space-y-3">
              {rows.map(({ label, text }) => (
                <div key={label}>
                  <FieldLabel>{label}</FieldLabel>
                  <p className="text-[15px] leading-[22px] text-foreground">{text}</p>
                </div>
              ))}
            </div>
          ) : null
        })()}
      </section>
    </div>
  )
}

// ── Why Captain ───────────────────────────────────────────────────────────────

function WhyCaptain({ payload }: { payload: CaptainCardPayload }) {
  return (
    <div className="space-y-5 py-2">
      {/* 1 · Why captain */}
      <section>
        <SectionLabel>1 · Why {payload.captain.player.web_name}</SectionLabel>
        {payload.captain.reason ? (
          <p className="mb-3 text-[14px] leading-5 text-foreground">{payload.captain.reason}</p>
        ) : null}
        {(() => {
          const rows = [
            { label: 'Form', text: payload.captain.why.form },
            { label: 'Fixture', text: payload.captain.why.fixture },
            { label: 'Risks', text: payload.captain.why.risks },
          ].filter(({ text }) => text)
          return rows.length > 0 ? (
            <div className="space-y-3">
              {rows.map(({ label, text }) => (
                <div key={label}>
                  <FieldLabel>{label}</FieldLabel>
                  <p className="text-[15px] leading-[22px] text-foreground">{text}</p>
                </div>
              ))}
            </div>
          ) : null
        })()}
      </section>

      {/* 2 · Vice-captain */}
      {payload.vc && (
        <section>
          <SectionLabel>2 · Vice-captain: {payload.vc.player.web_name}</SectionLabel>
          <p className="text-[14px] leading-5 text-foreground">{payload.vc.reason}</p>
        </section>
      )}
    </div>
  )
}

// ── Shared panel content ──────────────────────────────────────────────────────

interface PanelContentProps {
  label: string
  mainTitle: string
  tab: 'why' | 'trace' | 'counter'
  onTabChange: (tab: 'why' | 'trace' | 'counter') => void
  onClose: () => void
  whyContent: React.ReactNode
  traceSteps: TraceStep[]
  gameweek: number
  version: number
  counterPhase: CounterPhase
  quickReplies: string[]
  onCounterSubmit: (quickReply: string | null, message: string) => void
  onCounterReset: () => void
  counterDisabled: boolean
  counterDisabledReason?: string
  closeButtonClass?: string
}

function PanelContent({
  label,
  mainTitle,
  tab,
  onTabChange,
  onClose,
  whyContent,
  traceSteps,
  gameweek,
  version,
  counterPhase,
  quickReplies,
  onCounterSubmit,
  onCounterReset,
  counterDisabled,
  counterDisabledReason,
  closeButtonClass = '',
}: PanelContentProps) {
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Header: label + title + tabs + close */}
      <div className="relative border-b border-border px-4 pt-5 pb-0 shrink-0">
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

        <Tabs
          value={tab}
          onValueChange={(v) => onTabChange(v as 'why' | 'trace' | 'counter')}
        >
          <TabsList variant="line" className="w-full justify-start gap-4 bg-transparent p-0">
            <TabsTrigger
              value="why"
              className="px-0 pb-2.5 text-[14px] font-semibold text-muted-foreground data-active:border-b-2 data-active:border-primary data-active:text-foreground"
            >
              Why
            </TabsTrigger>
            <TabsTrigger
              value="counter"
              className="px-0 pb-2.5 text-[14px] font-semibold text-muted-foreground data-active:border-b-2 data-active:border-primary data-active:text-foreground"
            >
              Counter
            </TabsTrigger>
            <TabsTrigger
              value="trace"
              className="px-0 pb-2.5 text-[14px] font-semibold text-muted-foreground data-active:border-b-2 data-active:border-primary data-active:text-foreground"
            >
              How the agent decided
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {tab === 'why' ? (
          whyContent
        ) : tab === 'counter' ? (
          <CounterTab
            counterPhase={counterPhase}
            quickReplies={quickReplies}
            onSubmit={onCounterSubmit}
            onReset={onCounterReset}
            disabled={counterDisabled}
            disabledReason={counterDisabledReason}
          />
        ) : (
          <div>
            <p className="mb-4 text-[13px] text-muted-foreground">
              Whole brief · GW {gameweek} · version {version}
            </p>
            <TraceStepList steps={traceSteps} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Mobile: bottom Sheet ──────────────────────────────────────────────────────

export function MobileDetailSheet({
  open,
  onClose,
  label,
  mainTitle,
  tab,
  onTabChange,
  whyContent,
  traceSteps,
  gameweek,
  version,
  counterPhase,
  quickReplies,
  onCounterSubmit,
  onCounterReset,
  counterDisabled,
  counterDisabledReason,
}: {
  open: boolean
  onClose: () => void
  label: string
  mainTitle: string
  tab: 'why' | 'trace' | 'counter'
  onTabChange: (tab: 'why' | 'trace' | 'counter') => void
  whyContent: React.ReactNode
  traceSteps: TraceStep[]
  gameweek: number
  version: number
  counterPhase: CounterPhase
  quickReplies: string[]
  onCounterSubmit: (quickReply: string | null, message: string) => void
  onCounterReset: () => void
  counterDisabled: boolean
  counterDisabledReason?: string
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="h-[82dvh] rounded-t-2xl border-border p-0 overflow-hidden"
      >
        <SheetTitle className="sr-only">{mainTitle}</SheetTitle>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>
        <PanelContent
          label={label}
          mainTitle={mainTitle}
          tab={tab}
          onTabChange={onTabChange}
          onClose={onClose}
          whyContent={whyContent}
          traceSteps={traceSteps}
          gameweek={gameweek}
          version={version}
          counterPhase={counterPhase}
          quickReplies={quickReplies}
          onCounterSubmit={onCounterSubmit}
          onCounterReset={onCounterReset}
          counterDisabled={counterDisabled}
          counterDisabledReason={counterDisabledReason}
        />
      </SheetContent>
    </Sheet>
  )
}

// ── Desktop: side panel ────────────────────────────────────────────────────────

export function DesktopDetailPanel({
  onClose,
  label,
  mainTitle,
  tab,
  onTabChange,
  whyContent,
  traceSteps,
  gameweek,
  version,
  counterPhase,
  quickReplies,
  onCounterSubmit,
  onCounterReset,
  counterDisabled,
  counterDisabledReason,
}: {
  onClose: () => void
  label: string
  mainTitle: string
  tab: 'why' | 'trace' | 'counter'
  onTabChange: (tab: 'why' | 'trace' | 'counter') => void
  whyContent: React.ReactNode
  traceSteps: TraceStep[]
  gameweek: number
  version: number
  counterPhase: CounterPhase
  quickReplies: string[]
  onCounterSubmit: (quickReply: string | null, message: string) => void
  onCounterReset: () => void
  counterDisabled: boolean
  counterDisabledReason?: string
}) {
  return (
    <aside
      role="region"
      aria-label="Transfer details"
      className="border-border bg-card rounded-[14px] border flex flex-col flex-[1_1_360px] max-w-[420px] shrink-0 h-[calc(100dvh-8rem)] overflow-hidden"
    >
      <PanelContent
        label={label}
        mainTitle={mainTitle}
        tab={tab}
        onTabChange={onTabChange}
        onClose={onClose}
        whyContent={whyContent}
        traceSteps={traceSteps}
        gameweek={gameweek}
        version={version}
        counterPhase={counterPhase}
        quickReplies={quickReplies}
        onCounterSubmit={onCounterSubmit}
        onCounterReset={onCounterReset}
        counterDisabled={counterDisabled}
        counterDisabledReason={counterDisabledReason}
      />
    </aside>
  )
}

// ── Unified component ──────────────────────────────────────────────────────────

interface DetailSheetProps {
  detail: DetailState | null
  onClose: () => void
  onTabChange: (tab: 'why' | 'trace' | 'counter') => void
  transferPayload?: TransferCardPayloadTransfer
  captainPayload?: CaptainCardPayload
  traceSteps: TraceStep[]
  gameweek: number
  version: number
  isMobile: boolean
  counterPhase: CounterPhase
  quickReplies: string[]
  onCounterSubmit: (quickReply: string | null, message: string) => void
  onCounterReset: () => void
  counterDisabled: boolean
  counterDisabledReason?: string
}

export function DetailSheet({
  detail,
  onClose,
  onTabChange,
  transferPayload,
  captainPayload,
  traceSteps,
  gameweek,
  version,
  isMobile,
  counterPhase,
  quickReplies,
  onCounterSubmit,
  onCounterReset,
  counterDisabled,
  counterDisabledReason,
}: DetailSheetProps) {
  if (!detail) return null

  const isTransfer = !!transferPayload
  const label = isTransfer ? 'Transfer · Top Pick' : 'Captain'
  const mainTitle =
    isTransfer && transferPayload
      ? `${transferPayload.sell.player.web_name} → ${transferPayload.topPick.player.web_name}`
      : captainPayload?.captain.player.web_name ?? 'Captain pick'

  const whyContent =
    isTransfer && transferPayload ? (
      <WhyTransfer payload={transferPayload} />
    ) : captainPayload ? (
      <WhyCaptain payload={captainPayload} />
    ) : null

  const sharedProps = {
    label,
    mainTitle,
    tab: detail.tab,
    onTabChange,
    whyContent,
    traceSteps,
    gameweek,
    version,
    counterPhase,
    quickReplies,
    onCounterSubmit,
    onCounterReset,
    counterDisabled,
    counterDisabledReason,
  }

  if (isMobile) {
    return <MobileDetailSheet open={!!detail} onClose={onClose} {...sharedProps} />
  }

  return <DesktopDetailPanel onClose={onClose} {...sharedProps} />
}
