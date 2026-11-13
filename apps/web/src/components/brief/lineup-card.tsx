'use client'

import { cn } from '@/lib/utils'
import type { LineupCardPayload, LineupSlotPayload } from './types'
import type { Player } from '@finalball/agent'


interface LineupCardProps {
  payload: LineupCardPayload
}

function PositionGroup({
  label,
  slots,
}: {
  label: string
  slots: LineupSlotPayload[]
}) {
  return (
    <div className="flex gap-3">
      <span className="w-8 shrink-0 pt-[3px] text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 space-y-1.5">
        {slots.map((s) => (
          <SlotRow key={s.player.id} slot={s} />
        ))}
      </div>
    </div>
  )
}

function SlotRow({ slot }: { slot: LineupSlotPayload }) {
  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="truncate text-[14px] leading-5 text-foreground">{slot.player.web_name}</span>
        {slot.isDoubtful && (
          <span className="shrink-0 inline-flex h-[18px] items-center rounded px-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] bg-warning/15 text-warning">
            {slot.player.chance_of_playing_next_round ?? '?'}%
          </span>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {slot.clubShortName && (
          <span className="text-[12px] text-muted-foreground">{slot.clubShortName}</span>
        )}
        <span className="font-mono text-[13px] tabular-nums text-muted-foreground">
          {slot.epNext.toFixed(1)}
        </span>
      </div>
    </div>
  )
}

function SwapBadge({ player, dir }: { player: Player; dir: 'in' | 'out' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium',
        dir === 'in'
          ? 'bg-positive/10 text-positive'
          : 'bg-negative/10 text-[hsl(var(--negative))]',
      )}
    >
      <span aria-hidden="true">{dir === 'in' ? '↑' : '↓'}</span>
      {player.web_name}
    </span>
  )
}

export function LineupCard({ payload }: LineupCardProps) {
  const gkSlots = payload.starting.filter((s) => s.player.element_type === 1)
  const defSlots = payload.starting.filter((s) => s.player.element_type === 2)
  const midSlots = payload.starting.filter((s) => s.player.element_type === 3)
  const fwdSlots = payload.starting.filter((s) => s.player.element_type === 4)

  return (
    <article
      className="border-border bg-card rounded-[14px] border p-4 md:p-6"
      aria-label="Recommended lineup"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold leading-4 tracking-[0.06em] uppercase text-muted-foreground">
          GW{payload.gameweek} · Lineup
        </p>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-[12px] font-semibold text-muted-foreground">
          {payload.formation}
        </span>
      </div>

      {/* Swap recommendations */}
      {payload.hasChanges && (
        <div className="mb-4 flex flex-wrap gap-2">
          {payload.swapsIn.map((p) => (
            <SwapBadge key={p.id} player={p} dir="in" />
          ))}
          {payload.swapsOut.map((p) => (
            <SwapBadge key={p.id} player={p} dir="out" />
          ))}
        </div>
      )}

      {!payload.hasChanges && (
        <p className="mb-4 text-[13px] text-muted-foreground">Your current lineup looks optimal.</p>
      )}

      {/* Starting XI */}
      <div className="space-y-3">
        <PositionGroup label="GK" slots={gkSlots} />
        <PositionGroup label="DEF" slots={defSlots} />
        <PositionGroup label="MID" slots={midSlots} />
        <PositionGroup label="FWD" slots={fwdSlots} />
      </div>

      {/* Bench */}
      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Bench — auto-sub order
        </p>
        <div className="space-y-1.5">
          {payload.bench.map((s, i) => (
            <div key={s.player.id} className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-4 shrink-0 font-mono text-[12px] text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                <span className="truncate text-[14px] leading-5 text-muted-foreground">
                  {s.player.web_name}
                </span>
                {s.player.element_type === 1 && (
                  <span className="text-[11px] text-muted-foreground/60">(GK)</span>
                )}
                {s.isDoubtful && (
                  <span className="shrink-0 inline-flex h-[18px] items-center rounded px-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] bg-warning/15 text-warning">
                    {s.player.chance_of_playing_next_round ?? '?'}%
                  </span>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {s.clubShortName && (
                  <span className="text-[12px] text-muted-foreground/60">{s.clubShortName}</span>
                )}
                <span className="font-mono text-[13px] tabular-nums text-muted-foreground">
                  {s.epNext.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}
