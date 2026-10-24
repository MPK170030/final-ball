import { cn } from '@/lib/utils'
import type { TraceStep } from '@finalball/agent'

interface TraceStepListProps {
  steps: TraceStep[]
  className?: string
}

export function TraceStepList({ steps, className }: TraceStepListProps) {
  return (
    <ol className={cn('space-y-3', className)}>
      {steps.map((step) => (
        <li
          key={step.n}
          className={cn(
            'rounded-md border px-3 py-2.5',
            step.replan
              ? 'border-primary/40 border-dashed bg-primary/5'
              : 'border-border bg-card',
          )}
        >
          <div className="flex items-start gap-2.5">
            <span className="text-number mt-0.5 font-mono text-muted-foreground tabular-nums">
              {step.n}.
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body-strong text-foreground">
                {step.replan && (
                  <span className="text-primary mr-1">Replan ·</span>
                )}
                {step.title}
              </p>
              <p className="text-small mt-0.5 text-muted-foreground">{step.text}</p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
