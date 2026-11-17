'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ChipCardPayload, ChipStatus, ChipTimingAdvice } from './types'

interface ChipCardProps {
  payload: ChipCardPayload
}

const CHIP_SHORT: Record<string, string> = {
  wildcard: 'WC',
  freehit: 'FH',
  '3xc': 'TC',
  bboost: 'BB',
}

function ChipPill({ chip }: { chip: ChipStatus }) {
  const short = CHIP_SHORT[chip.name] ?? chip.name

  if (chip.used) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="inline-flex items-center rounded-[7px] border border-border px-2.5 py-1.5 text-[13px] font-semibold leading-none text-muted-foreground line-through">
          {short}
        </span>
        <span className="text-[10px] text-muted-foreground">
          Used GW{chip.usedInEvent}
        </span>
      </div>
    )
  }

  if (!chip.playable) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="inline-flex items-center rounded-[7px] border border-border/50 px-2.5 py-1.5 text-[13px] font-semibold leading-none text-muted-foreground/60">
          {short}
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          GW{chip.window.startEvent}+
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1" aria-label={`${chip.displayName} available`}>
      <span className="inline-flex items-center rounded-[7px] border border-primary bg-primary/10 px-2.5 py-1.5 text-[13px] font-semibold leading-none text-primary">
        {short}
      </span>
      <span className="text-[10px] font-medium text-primary">Available</span>
    </div>
  )
}

function TimingRow({ advice }: { advice: ChipTimingAdvice }) {
  return (
    <div className="rounded-[10px] border border-border p-3 md:p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-foreground">
          {advice.chip === '3xc'
            ? 'Triple Captain'
            : advice.chip === 'bboost'
              ? 'Bench Boost'
              : advice.chip === 'wildcard'
                ? 'Wildcard'
                : 'Free Hit'}
        </p>
        {advice.provisional && (
          <span className="shrink-0 inline-flex items-center rounded-[5px] border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Provisional
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
        {advice.recommendation}
      </p>
    </div>
  )
}

export function ChipCard({ payload }: ChipCardProps) {
  const [open, setOpen] = useState(false)
  const { status, timing, expiryNudge, specialGws } = payload

  const availableCount = status.filter(s => s.playable).length

  return (
    <article
      className="border-border bg-card rounded-[14px] border"
      aria-label="Chip advice"
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'w-full text-left px-4 py-3.5 md:px-6 md:py-4 flex items-center justify-between gap-4 min-h-[52px] hover:bg-secondary/30 transition-colors focus-visible:outline-2 focus-visible:outline-ring rounded-[14px]',
          open && 'rounded-b-none',
        )}
        aria-expanded={open}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-[12px] font-semibold leading-4 tracking-[0.06em] uppercase text-muted-foreground">
            Chips
          </p>
          <p className="text-[15px] font-semibold text-foreground">
            {open ? 'Hide chip advice' : 'Want to use a chip this week?'}
          </p>
          {!open && availableCount > 0 && (
            <p className="text-[12px] text-muted-foreground">
              {availableCount} chip{availableCount !== 1 ? 's' : ''} available
            </p>
          )}
        </div>
        <span
          className={cn(
            'shrink-0 text-muted-foreground text-[18px] leading-none transition-transform',
            open && 'rotate-90',
          )}
          aria-hidden="true"
        >
          →
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-4 md:px-6 md:pb-6 space-y-4">
          {/* Chip status strip */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-3">
              Your chips this season
            </p>
            <div className="flex flex-wrap gap-4">
              {status.map(cs => (
                <ChipPill key={`${cs.name}-${cs.window.startEvent}`} chip={cs} />
              ))}
            </div>
          </div>

          {/* Expiry nudge */}
          {expiryNudge && (
            <div className="rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <p className="text-[13px] font-medium text-amber-400">{expiryNudge}</p>
            </div>
          )}

          {/* BGW/DGW alert */}
          {specialGws.length > 0 && (
            <div className="rounded-[8px] border border-primary/20 bg-primary/5 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-primary mb-1">
                Blank / Double gameweeks confirmed
              </p>
              {specialGws.map(sg => (
                <p key={sg.gwId} className="text-[12px] text-muted-foreground">
                  GW{sg.gwId}
                  {sg.dgwTeamCount > 0 && ` · ${sg.dgwTeamCount} team${sg.dgwTeamCount !== 1 ? 's' : ''} playing twice`}
                  {sg.bgwTeamCount > 0 && ` · ${sg.bgwTeamCount} team${sg.bgwTeamCount !== 1 ? 's' : ''} with no fixture`}
                </p>
              ))}
            </div>
          )}

          {/* Timing advice */}
          {timing.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Timing advice
              </p>
              {timing.map(adv => (
                <TimingRow key={adv.chip} advice={adv} />
              ))}
            </div>
          )}

          {timing.length === 0 && (
            <p className="text-[13px] text-muted-foreground">
              All chips in this half of the season have been played.
            </p>
          )}
        </div>
      )}
    </article>
  )
}
