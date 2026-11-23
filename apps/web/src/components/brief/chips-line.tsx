'use client'

import type { ChipCardPayload } from './types'

export const CHIP_LABELS: Record<string, string> = {
  wildcard: 'Wildcard',
  freehit: 'Free Hit',
  bboost: 'Bench Boost',
  '3xc': 'Triple Captain',
  none: 'Save them',
}

interface ChipsLineProps {
  payload: ChipCardPayload
}

export function ChipsLine({ payload }: ChipsLineProps) {
  const available = payload.status.filter((s) => s.playable)

  if (available.length === 0) return null

  const anyChip = payload.timing[0]
  if (anyChip) {
    const name = CHIP_LABELS[anyChip.chip] ?? anyChip.chip
    return (
      <div className="flex flex-col gap-1.5 rounded-[14px] border border-dashed border-border px-5 py-4">
        <span className="font-mono text-[12px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">
          Chips
        </span>
        <span className="text-[15px]">
          {name} is worth a look this week.{' '}
          <span className="text-muted-foreground">The transfer above assumes you don&apos;t play it.</span>
        </span>
      </div>
    )
  }

  const firstExpiry = available.length > 0 ? Math.min(...available.map(s => s.window.stopEvent)) : null

  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] border border-dashed border-border px-5 py-4">
      <span className="font-mono text-[12px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">
        Chips
      </span>
      <span className="text-[15px]">
        Save them this week.
        <span className="text-muted-foreground">
          {' '}{available.length} available{firstExpiry != null ? ` · first set expires GW${firstExpiry}` : ''}.
        </span>
      </span>
    </div>
  )
}
