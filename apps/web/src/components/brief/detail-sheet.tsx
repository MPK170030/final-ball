'use client'

import { XIcon } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TraceStepList } from './trace-step-list'
import { FixtureChip } from './fixture-chip'
import { cn } from '@/lib/utils'
import type { TraceStep } from '@finalball/agent'
import type { TransferCardPayloadTransfer, CaptainCardPayload, DetailState } from './types'

interface WhyTransferProps {
  payload: TransferCardPayloadTransfer
}

function WhyTransfer({ payload }: WhyTransferProps) {
  const POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

  return (
    <div className="space-y-6 py-2">
      {/* Why sell section */}
      <section>
        <h3 className="text-label mb-3 uppercase tracking-widest text-muted-foreground">
          Why sell {payload.sell.player.web_name}?
        </h3>
        <p className="text-body text-foreground mb-3">{payload.whySell}</p>

        {/* Weakest 3 players ranked */}
        <div className="space-y-1.5">
          {payload.whySellContext.map((ws, i) => {
            const isSell = ws.player.id === payload.sell.player.id
            return (
              <div
                key={ws.player.id}
                className={cn(
                  'flex items-center gap-3 rounded-md border px-3 py-2',
                  isSell ? 'border-foreground/40' : 'border-border',
                )}
              >
                <span className="text-number w-4 shrink-0 font-mono text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <span className={cn('text-body-strong', isSell && 'text-foreground')}>
                    {ws.player.web_name}
                  </span>
                  <span className="text-small ml-2 text-muted-foreground">
                    {POS[ws.player.element_type] ?? '?'} · {ws.score.total.toFixed(1)} pts projected
                  </span>
                </div>
                <div className="flex gap-1">
                  {ws.score.perGw.map((gw) => (
                    <FixtureChip key={gw.gwId} fdr={gw.fdr} isDouble={gw.isDouble} size="sm" />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Why top pick section */}
      <section>
        <h3 className="text-label mb-3 uppercase tracking-widest text-muted-foreground">
          Why {payload.topPick.player.web_name}?
        </h3>
        <div className="space-y-3">
          {[
            { label: 'Form', text: payload.topPickWhy.form },
            { label: 'Fixtures', text: payload.topPickWhy.fixtures },
            { label: 'Price', text: payload.topPickWhy.price },
            { label: 'Risks', text: payload.topPickWhy.risks },
          ].map(({ label, text }) => (
            <div key={label}>
              <span className="text-label text-muted-foreground">{label}</span>
              <p className="text-body mt-0.5 text-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

interface WhyCaptainProps {
  payload: CaptainCardPayload
}

function WhyCaptain({ payload }: WhyCaptainProps) {
  return (
    <div className="space-y-6 py-2">
      <section>
        <h3 className="text-label mb-3 uppercase tracking-widest text-muted-foreground">
          Why {payload.captain.player.web_name}?
        </h3>
        <p className="text-body text-foreground mb-3">{payload.captain.reason}</p>
        <div className="space-y-3">
          {[
            { label: 'Form', text: payload.captain.why.form },
            { label: 'Fixture', text: payload.captain.why.fixture },
            { label: 'Risks', text: payload.captain.why.risks },
          ].map(({ label, text }) => (
            <div key={label}>
              <span className="text-label text-muted-foreground">{label}</span>
              <p className="text-body mt-0.5 text-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>
      {payload.vc && (
        <section>
          <h3 className="text-label mb-3 uppercase tracking-widest text-muted-foreground">
            Vice-captain: {payload.vc.player.web_name}
          </h3>
          <p className="text-body text-foreground">{payload.vc.reason}</p>
        </section>
      )}
    </div>
  )
}

interface DetailSheetContentProps {
  title: string
  tab: 'why' | 'trace'
  onTabChange: (tab: 'why' | 'trace') => void
  whyContent: React.ReactNode
  traceSteps: TraceStep[]
  gameweek: number
  version: number
}

function DetailContent({
  title,
  tab,
  onTabChange,
  whyContent,
  traceSteps,
  gameweek,
  version,
}: DetailSheetContentProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-border border-b px-4 pb-3 pt-4">
        <p className="text-label mb-2 uppercase tracking-widest text-muted-foreground">{title}</p>
        <Tabs value={tab} onValueChange={(v) => onTabChange(v as 'why' | 'trace')}>
          <TabsList variant="line" className="w-full justify-start gap-4 bg-transparent p-0">
            <TabsTrigger
              value="why"
              className="text-body-strong px-0 pb-2 data-active:border-b-2 data-active:border-primary data-active:text-foreground"
            >
              Why?
            </TabsTrigger>
            <TabsTrigger
              value="trace"
              className="text-body-strong px-0 pb-2 data-active:border-b-2 data-active:border-primary data-active:text-foreground"
            >
              How the agent decided
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tab === 'why' ? (
          whyContent
        ) : (
          <div>
            <p className="text-small mb-4 text-muted-foreground">
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

interface MobileDetailSheetProps {
  open: boolean
  onClose: () => void
  title: string
  tab: 'why' | 'trace'
  onTabChange: (tab: 'why' | 'trace') => void
  whyContent: React.ReactNode
  traceSteps: TraceStep[]
  gameweek: number
  version: number
}

export function MobileDetailSheet({
  open,
  onClose,
  title,
  tab,
  onTabChange,
  whyContent,
  traceSteps,
  gameweek,
  version,
}: MobileDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="h-[82dvh] rounded-t-2xl border-border p-0"
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>
        <DetailContent
          title={title}
          tab={tab}
          onTabChange={onTabChange}
          whyContent={whyContent}
          traceSteps={traceSteps}
          gameweek={gameweek}
          version={version}
        />
      </SheetContent>
    </Sheet>
  )
}

// ── Desktop: side panel ────────────────────────────────────────────────────────

interface DesktopDetailPanelProps {
  title: string
  tab: 'why' | 'trace'
  onTabChange: (tab: 'why' | 'trace') => void
  onClose: () => void
  whyContent: React.ReactNode
  traceSteps: TraceStep[]
  gameweek: number
  version: number
}

export function DesktopDetailPanel({
  title,
  tab,
  onTabChange,
  onClose,
  whyContent,
  traceSteps,
  gameweek,
  version,
}: DesktopDetailPanelProps) {
  return (
    <aside className="border-border relative flex h-full w-[400px] shrink-0 flex-col border-l bg-popover">
      <button
        onClick={onClose}
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Close detail panel"
      >
        <XIcon className="size-4" aria-hidden="true" />
      </button>
      <DetailContent
        title={title}
        tab={tab}
        onTabChange={onTabChange}
        whyContent={whyContent}
        traceSteps={traceSteps}
        gameweek={gameweek}
        version={version}
      />
    </aside>
  )
}

// ── Unified component ──────────────────────────────────────────────────────────

interface DetailSheetProps {
  detail: DetailState | null
  onClose: () => void
  onTabChange: (tab: 'why' | 'trace') => void
  transferPayload?: TransferCardPayloadTransfer
  captainPayload?: CaptainCardPayload
  traceSteps: TraceStep[]
  gameweek: number
  version: number
  isMobile: boolean
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
}: DetailSheetProps) {
  if (!detail) return null

  const isTransfer = !!transferPayload
  const title = isTransfer ? `Transfer · ${transferPayload?.sell.player.web_name}` : 'Captain pick'
  const whyContent = isTransfer && transferPayload ? (
    <WhyTransfer payload={transferPayload} />
  ) : captainPayload ? (
    <WhyCaptain payload={captainPayload} />
  ) : null

  const sharedProps = {
    title,
    tab: detail.tab,
    onTabChange,
    whyContent,
    traceSteps,
    gameweek,
    version,
  }

  if (isMobile) {
    return (
      <MobileDetailSheet
        open={!!detail}
        onClose={onClose}
        {...sharedProps}
      />
    )
  }

  return (
    <DesktopDetailPanel
      onClose={onClose}
      {...sharedProps}
    />
  )
}
