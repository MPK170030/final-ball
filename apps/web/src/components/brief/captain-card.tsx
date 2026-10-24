'use client'

import { cn } from '@/lib/utils'
import type { CaptainCardPayload } from './types'

interface CaptainCardProps {
  payload: CaptainCardPayload
  onWhyClick: (trigger: HTMLButtonElement) => void
  onTraceClick: (trigger: HTMLButtonElement) => void
  isSelected?: boolean
}

function CaptainBadge({ type }: { type: 'C' | 'V' }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
        type === 'C'
          ? 'bg-primary text-primary-foreground'
          : 'border-primary border text-primary',
      )}
      aria-label={type === 'C' ? 'Captain' : 'Vice-captain'}
    >
      {type}
    </span>
  )
}

export function CaptainCard({
  payload,
  onWhyClick,
  onTraceClick,
  isSelected = false,
}: CaptainCardProps) {
  const { captain, vc, alternatives } = payload

  return (
    <article
      className={cn(
        'border-border bg-card rounded-lg border',
        isSelected && 'ring-2 ring-primary',
      )}
      aria-label={`Captain: ${captain.player.web_name}`}
    >
      {/* Header */}
      <div className="border-border border-b px-4 py-3">
        <span className="text-label uppercase tracking-widest text-muted-foreground">Captain</span>
      </div>

      {/* Captain pick — orange emphasis */}
      <div className="border-primary/60 border-b mx-4 my-4 rounded-md border bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <CaptainBadge type="C" />
          <p className="text-heading text-foreground">{captain.player.web_name}</p>
        </div>
        <p className="text-small mt-1.5 text-muted-foreground">{captain.reason}</p>
        <div className="mt-2.5 flex items-center gap-3">
          <button
            onClick={(e) => onWhyClick(e.currentTarget)}
            aria-label={`Why ${captain.player.web_name} as captain?`}
            className="min-h-[44px] px-0 text-small font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Why?
          </button>
          <button
            onClick={(e) => onTraceClick(e.currentTarget)}
            className="min-h-[44px] px-0 text-small text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            How the agent decided
          </button>
        </div>
      </div>

      {/* Vice captain */}
      <div className={cn('border-border border-t px-4 py-3', alternatives.length > 0 && 'border-b')}>
        <div className="flex items-center gap-2">
          <CaptainBadge type="V" />
          <span className="text-body-strong text-foreground">{vc.player.web_name}</span>
          <span className="text-label rounded-sm bg-secondary px-1 py-0.5 text-muted-foreground">
            VC
          </span>
        </div>
        <p className="text-small mt-1 text-muted-foreground">{vc.reason}</p>
      </div>

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div className="border-border border-t">
          <div className="border-border border-b px-4 py-2">
            <span className="text-label uppercase tracking-widest text-muted-foreground">
              {alternatives.length} alternative{alternatives.length > 1 ? 's' : ''}
            </span>
          </div>
          {alternatives.map((alt, i) => (
            <div
              key={alt.player.id}
              className={cn(
                'px-4 py-2.5',
                i < alternatives.length - 1 && 'border-border border-b',
              )}
            >
              <span className="text-body-strong text-foreground">{alt.player.web_name}</span>
              <p className="text-small mt-0.5 text-muted-foreground">{alt.reason}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
