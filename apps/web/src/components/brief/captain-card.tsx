'use client'

import { cn } from '@/lib/utils'
import type { CaptainCardPayload, CaptainPickWithMeta, RiskTag, NewsFlag } from './types'

interface CaptainCardProps {
  payload: CaptainCardPayload
  onWhyClick: (trigger: HTMLButtonElement) => void
  onCounterClick?: (trigger: HTMLButtonElement) => void
  counterDisabled?: boolean
  counterDisabledReason?: string
  isSelected?: boolean
  newsFlags?: NewsFlag[]
}

const POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

function playerMeta(pick: CaptainPickWithMeta): string {
  if (pick.clubShortName && pick.nextFixture) {
    const ha = pick.nextFixture.isHome ? 'H' : 'A'
    return `${pick.clubShortName} · vs ${pick.nextFixture.opponent} (${ha})`
  }
  return `${POS[pick.player.element_type] ?? '?'} · £${(pick.player.now_cost / 10).toFixed(1)}m`
}

const RISK_TAG_STYLES: Record<RiskTag, string> = {
  safe: 'border border-foreground/40 text-foreground',
  balanced: 'bg-secondary text-foreground',
  bold: 'bg-foreground text-background',
}

function RiskTagBadge({ tag }: { tag: RiskTag }) {
  const label = tag === 'safe' ? 'Safe' : tag === 'bold' ? 'Bold' : 'Balanced'
  return (
    <span className={cn('inline-flex items-center rounded-[5px] px-1.5 py-0.5 text-[11px] font-semibold leading-none', RISK_TAG_STYLES[tag])}>
      {label}
    </span>
  )
}

function CaptainBadge({ type }: { type: 'C' | 'V' }) {
  return (
    <span
      className={cn(
        'shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-semibold md:h-6 md:w-6 md:text-[12px]',
        type === 'C'
          ? 'bg-primary text-primary-foreground'
          : 'border-[1.5px] border-foreground text-foreground',
      )}
      aria-label={type === 'C' ? 'Captain' : 'Vice-captain'}
    >
      {type}
    </span>
  )
}

function NewsBanner({
  flags,
  onCounterClick,
  counterDisabled,
}: {
  flags: NewsFlag[]
  onCounterClick?: (trigger: HTMLButtonElement) => void
  counterDisabled?: boolean
}) {
  return (
    <div className="rounded-[10px] border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <span className="mt-px shrink-0 text-amber-500" aria-hidden="true">⚠</span>
        <div className="flex flex-col gap-0.5">
          <p className="text-[13px] font-semibold text-foreground">News since this brief</p>
          {flags.map((f) => (
            <p key={f.playerName} className="text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">{f.playerName}:</span> {f.news}
            </p>
          ))}
        </div>
      </div>
      {onCounterClick && (
        <button
          type="button"
          onClick={(e) => onCounterClick(e.currentTarget)}
          disabled={counterDisabled}
          className="self-start inline-flex min-h-[36px] items-center rounded-[8px] border border-amber-500/50 bg-transparent px-3 text-[13px] font-semibold text-foreground hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Counter to re-check
        </button>
      )}
    </div>
  )
}

export function CaptainCard({
  payload,
  onWhyClick,
  onCounterClick,
  counterDisabled = false,
  counterDisabledReason,
  isSelected = false,
  newsFlags,
}: CaptainCardProps) {
  const { captain, vc, alternatives } = payload

  return (
    <article
      className={cn(
        'border-border bg-card rounded-[14px] border p-4 flex flex-col gap-[14px] md:p-6 md:gap-[16px]',
        isSelected && 'ring-2 ring-primary',
      )}
      aria-label={`Captain: ${captain.player.web_name}`}
    >
      {/* Card header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold leading-4 tracking-[0.06em] uppercase text-muted-foreground">
          Captain
        </span>
        {/* Action buttons — desktop only (in header) */}
        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => onWhyClick(e.currentTarget)}
            aria-label={`Why ${captain.player.web_name} as captain?`}
            className="inline-flex min-h-[44px] items-center border-0 bg-transparent p-0 text-[14px] font-semibold text-foreground underline underline-offset-[3px] hover:text-primary cursor-pointer focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Why?
          </button>
          {onCounterClick && (
            <button
              type="button"
              onClick={(e) => onCounterClick(e.currentTarget)}
              disabled={counterDisabled}
              title={counterDisabledReason}
              aria-label="Counter this pick"
              className="inline-flex min-h-[44px] items-center rounded-[8px] border border-border bg-transparent px-3 text-[14px] font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer transition-colors"
            >
              Counter this pick
            </button>
          )}
        </div>
      </div>

      {newsFlags && newsFlags.length > 0 && (
        <NewsBanner flags={newsFlags} onCounterClick={onCounterClick} counterDisabled={counterDisabled} />
      )}

      {/* ── Desktop: 4-column grid (C · V · alts) ──────────────────────────── */}
      <div
        className="hidden md:grid md:gap-3.5"
        style={{ gridTemplateColumns: `repeat(${2 + alternatives.length}, minmax(0, 1fr))` }}
      >
        {/* Captain emphasis */}
        <div className="flex flex-col gap-1.5 rounded-[10px] border-2 border-primary bg-background p-4">
          <div className="flex items-center gap-2">
            <CaptainBadge type="C" />
            <span className="text-[12px] font-semibold leading-4 tracking-[0.06em] uppercase text-muted-foreground">
              Captain
            </span>
            {captain.riskTag && <RiskTagBadge tag={captain.riskTag} />}
          </div>
          <span className="text-[20px] leading-[26px] font-semibold text-foreground">
            {captain.player.web_name}
          </span>
          <span className="text-[13px] leading-[18px] text-muted-foreground">
            {playerMeta(captain)}
          </span>
          <p className="text-[13px] leading-[18px] text-foreground">{captain.reason}</p>
        </div>

        {/* Vice block */}
        <div className="flex flex-col gap-1.5 rounded-[10px] border border-border p-4">
          <div className="flex items-center gap-2">
            <CaptainBadge type="V" />
            <span className="text-[12px] font-semibold leading-4 tracking-[0.06em] uppercase text-muted-foreground">
              Vice
            </span>
          </div>
          <span className="text-[17px] leading-6 font-semibold text-foreground">
            {vc.player.web_name}
          </span>
          <span className="text-[13px] leading-[18px] text-muted-foreground">
            {playerMeta(vc)}
          </span>
          <p className="text-[13px] leading-[18px] text-foreground">{vc.reason}</p>
        </div>

        {/* Alt cards */}
        {alternatives.map((alt) => (
          <div
            key={alt.player.id}
            className="flex flex-col gap-1.5 bg-secondary rounded-[10px] p-4"
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[12px] font-semibold leading-4 tracking-[0.06em] uppercase text-muted-foreground">
                Alternative
              </span>
              {alt.riskTag && <RiskTagBadge tag={alt.riskTag} />}
              {alt.riskTag === 'safe' && (
                <span className="text-[11px] text-muted-foreground">highest floor</span>
              )}
              {alt.riskTag === 'bold' && (
                <span className="text-[11px] text-muted-foreground">highest ceiling</span>
              )}
            </div>
            <span className="text-[17px] leading-[24px] font-semibold text-foreground">
              {alt.player.web_name}
            </span>
            <span className="text-[13px] leading-[18px] text-muted-foreground">
              {playerMeta(alt)}
            </span>
            <p className="text-[13px] leading-[18px] text-foreground">{alt.reason}</p>
          </div>
        ))}
      </div>

      {/* ── Mobile: stacked layout ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-3.5 md:hidden">
        {/* Captain emphasis */}
        <div className="flex gap-3 rounded-[10px] border-2 border-primary bg-background p-3.5">
          <CaptainBadge type="C" />
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[20px] leading-[26px] font-semibold text-foreground">
                {captain.player.web_name}
              </span>
              {captain.riskTag && <RiskTagBadge tag={captain.riskTag} />}
            </div>
            <span className="text-[13px] leading-[18px] text-muted-foreground">
              {playerMeta(captain)}
            </span>
            <p className="text-[14px] leading-5 text-foreground">{captain.reason}</p>
          </div>
        </div>

        {/* Vice */}
        <div className="flex gap-3">
          <CaptainBadge type="V" />
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[16px] leading-[22px] font-semibold text-foreground">
                {vc.player.web_name}
              </span>
            </div>
            <span className="text-[13px] leading-[18px] text-muted-foreground">
              {playerMeta(vc)}
            </span>
            <p className="text-[14px] leading-5 text-foreground">{vc.reason}</p>
          </div>
        </div>

        {/* Action row — mobile only (after vice) */}
        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={(e) => onWhyClick(e.currentTarget)}
            aria-label={`Why ${captain.player.web_name} as captain?`}
            className="inline-flex min-h-[44px] items-center border-0 bg-transparent p-0 text-[14px] font-semibold text-foreground underline underline-offset-[3px] hover:text-primary cursor-pointer focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Why?
          </button>
          {onCounterClick && (
            <button
              type="button"
              onClick={(e) => onCounterClick(e.currentTarget)}
              disabled={counterDisabled}
              title={counterDisabledReason}
              aria-label="Counter this pick"
              className="inline-flex min-h-[44px] items-center rounded-[8px] border border-border bg-transparent px-3 text-[14px] font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer transition-colors"
            >
              Counter this pick
            </button>
          )}
        </div>

        {/* Alternatives */}
        {alternatives.length > 0 && (
          <>
            <div className="h-px bg-border" />
            <span className="text-[12px] font-semibold leading-4 tracking-[0.06em] uppercase text-muted-foreground">
              Alternatives
            </span>
            {alternatives.map((alt, i) => (
              <div
                key={alt.player.id}
                className={cn(
                  'flex flex-col gap-0.5 pb-2.5',
                  i < alternatives.length - 1 && 'border-b border-border',
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="text-[15px] leading-[22px] font-semibold text-foreground">
                      {alt.player.web_name}
                    </span>
                    {alt.riskTag && <RiskTagBadge tag={alt.riskTag} />}
                    {alt.riskTag === 'safe' && (
                      <span className="text-[11px] text-muted-foreground">highest floor</span>
                    )}
                    {alt.riskTag === 'bold' && (
                      <span className="text-[11px] text-muted-foreground">highest ceiling</span>
                    )}
                  </div>
                  <span className="shrink-0 text-[13px] text-muted-foreground">
                    {playerMeta(alt)}
                  </span>
                </div>
                <p className="text-[14px] leading-5 text-foreground">{alt.reason}</p>
              </div>
            ))}
          </>
        )}
      </div>
    </article>
  )
}
