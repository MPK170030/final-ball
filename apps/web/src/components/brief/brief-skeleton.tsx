import { cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-secondary animate-pulse rounded',
        className,
      )}
      style={{
        backgroundImage:
          'linear-gradient(90deg, var(--secondary) 25%, color-mix(in srgb, var(--secondary) 70%, var(--foreground)) 50%, var(--secondary) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 2s infinite linear',
      }}
      aria-hidden="true"
    />
  )
}

function TransferCardSkeleton() {
  return (
    <div className="border-border bg-card rounded-lg border">
      <div className="border-border border-b px-4 py-3">
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="border-border border-b px-4 py-3">
        <Skeleton className="mb-1.5 h-3 w-40" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="border-border border-b px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-6 w-10 rounded-sm" />
            <Skeleton className="h-6 w-10 rounded-sm" />
            <Skeleton className="h-6 w-10 rounded-sm" />
          </div>
        </div>
      </div>
      <div className="border-border mx-4 my-4 rounded-md border border-primary/20 px-4 py-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-6 w-10 rounded-sm" />
            <Skeleton className="h-6 w-10 rounded-sm" />
            <Skeleton className="h-6 w-10 rounded-sm" />
          </div>
        </div>
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="border-border border-t px-4 py-2">
        <Skeleton className="h-3 w-24" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-border border-t flex items-start gap-3 px-4 py-2.5">
          <Skeleton className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>
      ))}
    </div>
  )
}

function CaptainCardSkeleton() {
  return (
    <div className="border-border bg-card rounded-lg border">
      <div className="border-border border-b px-4 py-3">
        <Skeleton className="h-3 w-14" />
      </div>
      <div className="border-border mx-4 my-4 rounded-md border border-primary/20 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="border-border border-t px-4 py-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-3 w-52" />
      </div>
    </div>
  )
}

interface BriefSkeletonProps {
  transferCount?: number
}

export function BriefSkeleton({ transferCount = 1 }: BriefSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: transferCount }).map((_, i) => (
        <TransferCardSkeleton key={i} />
      ))}
      <CaptainCardSkeleton />
    </div>
  )
}
