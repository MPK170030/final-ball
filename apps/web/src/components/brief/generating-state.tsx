import { CheckIcon, LoaderIcon } from 'lucide-react'
import { BriefSkeleton } from './brief-skeleton'

interface GeneratingStateProps {
  steps: string[]
  currentStep: string | null
}

export function GeneratingState({ steps, currentStep }: GeneratingStateProps) {
  const allSteps = [...steps, ...(currentStep && !steps.includes(currentStep) ? [currentStep] : [])]

  return (
    <div className="space-y-4">
      {/* Live progress */}
      <div className="border-border bg-card rounded-lg border px-4 py-4">
        <p className="text-label mb-3 uppercase tracking-widest text-muted-foreground">
          Generating your brief
        </p>
        <ol className="space-y-2" aria-live="polite" aria-atomic="false">
          {allSteps.map((step, i) => {
            const isDone = i < allSteps.length - 1
            const isCurrent = i === allSteps.length - 1
            return (
              <li key={i} className="flex items-center gap-2.5">
                <span className="shrink-0" aria-hidden="true">
                  {isDone ? (
                    <CheckIcon className="size-4 text-positive" />
                  ) : (
                    <LoaderIcon className="size-4 animate-spin text-primary" />
                  )}
                </span>
                <span className="sr-only">{isDone ? 'Done: ' : 'In progress: '}</span>
                <span
                  className={
                    isCurrent ? 'text-body text-foreground' : 'text-small text-muted-foreground'
                  }
                >
                  {step}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Skeleton cards */}
      <BriefSkeleton />
    </div>
  )
}
