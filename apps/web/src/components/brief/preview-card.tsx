import type { PreviewCardPayload } from './types'

interface PreviewCardProps {
  payload: PreviewCardPayload
}

export function PreviewCard({ payload }: PreviewCardProps) {
  return (
    <article
      className="border-border bg-card rounded-[14px] border p-4 md:p-6"
      aria-label="Next week preview"
    >
      <p className="text-[12px] font-semibold leading-4 tracking-[0.06em] uppercase text-muted-foreground">
        Next week
      </p>
      <p className="mt-2 text-[15px] text-foreground">{payload.text}</p>
    </article>
  )
}
