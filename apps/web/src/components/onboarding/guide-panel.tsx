'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'

// ─── Phone sketch (placeholder; real screenshots replace these before launch) ─

function PhoneSketch({ variant }: { variant: 'nav' | 'bar2' | 'bar3' | 'center' }) {
  const base = 'flex-none flex flex-col gap-[5px] w-[88px] h-[136px] p-[8px_6px_6px] border-2 border-foreground rounded-[14px] bg-background'
  if (variant === 'nav') return (
    <div className={base} aria-hidden="true">
      <div className="h-4 rounded bg-secondary" /><div className="h-4 rounded bg-secondary" /><div className="h-4 rounded bg-secondary" />
      <div className="mt-auto flex gap-[3px]">
        <span className="flex-1 h-[14px] rounded-sm bg-secondary" />
        <span className="flex-1 h-[14px] rounded-sm bg-secondary" />
        <span className="flex-1 h-[14px] rounded-sm bg-primary" />
        <span className="flex-1 h-[14px] rounded-sm bg-secondary" />
      </div>
    </div>
  )
  if (variant === 'bar2') return (
    <div className={base} aria-hidden="true">
      <div className="h-4 rounded bg-secondary" /><div className="h-4 rounded bg-primary" /><div className="h-4 rounded bg-secondary" />
      <div className="h-4 rounded bg-secondary" /><div className="h-4 rounded bg-secondary" />
    </div>
  )
  if (variant === 'bar3') return (
    <div className={base} aria-hidden="true">
      <div className="h-4 rounded bg-secondary" /><div className="h-4 rounded bg-secondary" /><div className="h-4 rounded bg-secondary" />
      <div className="h-7 rounded bg-primary" /><div className="h-4 rounded bg-secondary" />
    </div>
  )
  return (
    <div className={cn(base, 'items-center justify-center')} aria-hidden="true">
      <div className="h-7 w-16 rounded bg-primary" />
    </div>
  )
}

// ─── Guide content per type ───────────────────────────────────────────────────

type GuideData = {
  label: string
  title: string
  steps: { sketch: 'nav' | 'bar2' | 'bar3' | 'center'; n: string; text: React.ReactNode }[]
}

const RANK_GUIDE: GuideData = {
  label: 'In the FPL app',
  title: "Where's my country rank?",
  steps: [
    { sketch: 'nav' as const, n: 'Step 1', text: <>Open the FPL app and tap <b>Leagues</b>.</> },
    { sketch: 'bar2' as const, n: 'Step 2', text: <>Find your <b>country&apos;s name</b> in the league list.</> },
    { sketch: 'bar3' as const, n: 'Step 3', text: <>Your rank is the <b>number next to it</b>. Enter it as shown right now.</> },
  ],
}

const NAME_GUIDE = {
  label: 'In the FPL app',
  title: "Where's my team name?",
  steps: [
    { sketch: 'nav' as const, n: 'Step 1', text: <>Open the FPL app and go to <b>Pick Team</b>.</> },
    { sketch: 'center' as const, n: 'Step 2', text: <>Your team name appears at the top. Enter it exactly as it appears, including any emoji.</> },
  ],
}

const LINK_GUIDE_PHONE = {
  label: 'On your phone',
  title: 'Getting your FPL link on a phone',
  steps: [
    { sketch: 'nav' as const, n: 'Step 1', text: <>Open the FPL website (not the app) in your phone&apos;s <b>browser</b>.</> },
    { sketch: 'bar2' as const, n: 'Step 2', text: <>Sign in, then tap your team name. The URL will contain <b>/entry/</b> followed by your ID.</> },
    { sketch: 'bar3' as const, n: 'Step 3', text: <>Copy the URL or just the number after <b>/entry/</b> and paste it here.</> },
  ],
}

const LINK_GUIDE_COMPUTER = {
  label: 'On your computer',
  title: 'Getting your FPL link on a computer',
  steps: [
    { sketch: 'bar2' as const, n: 'Step 1', text: <>Go to <b>fantasy.premierleague.com</b> and sign in.</> },
    { sketch: 'bar3' as const, n: 'Step 2', text: <>Click your team name. Your URL will contain <b>/entry/</b> followed by a number — that&apos;s your team ID.</> },
  ],
}

export type GuideType = 'rank' | 'team-name' | 'link'

function GuideStepsSection({ guide }: { guide: GuideData }) {
  return (
    <>
      <div className="flex flex-col gap-0.5">
        <span className="text-label text-muted-foreground">{guide.label}</span>
        <span className="text-heading">{guide.title}</span>
      </div>
      <ol className="flex flex-col gap-4 list-none m-0 p-0 mt-1">
        {guide.steps.map(({ sketch, n, text }) => (
          <li key={n} className="flex gap-3.5 items-center">
            <PhoneSketch variant={sketch} />
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-small text-muted-foreground">{n}</span>
              <span className="text-body">{text}</span>
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}

function LinkGuide() {
  const [tab, setTab] = useState<'phone' | 'computer'>('phone')
  const guide = tab === 'phone' ? LINK_GUIDE_PHONE : LINK_GUIDE_COMPUTER
  return (
    <>
      <div className="flex flex-col gap-0.5">
        <span className="text-label text-muted-foreground">In the FPL website</span>
        <span className="text-heading">Getting your FPL link</span>
      </div>
      <div className="flex gap-5 border-b border-border -mx-5 px-5">
        {(['phone', 'computer'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'h-11 px-0.5 border-0 border-b-2 -mb-px bg-transparent text-small font-medium cursor-pointer transition-colors',
              tab === t ? 'border-primary text-foreground font-semibold' : 'border-transparent text-muted-foreground',
            )}
          >
            {t === 'phone' ? 'On a phone' : 'On a computer'}
          </button>
        ))}
      </div>
      <ol className="flex flex-col gap-4 list-none m-0 p-0 mt-1">
        {guide.steps.map(({ sketch, n, text }) => (
          <li key={n} className="flex gap-3.5 items-center">
            <PhoneSketch variant={sketch} />
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-small text-muted-foreground">{n}</span>
              <span className="text-body">{text}</span>
            </div>
          </li>
        ))}
      </ol>
      <a
        href="https://fantasy.premierleague.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-small font-semibold text-foreground underline underline-offset-2 hover:text-primary min-h-[44px]"
      >
        Open FPL in a new tab
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 10 L10 2 M5 2 H10 V7" /></svg>
      </a>
    </>
  )
}

function GuideContent({ type }: { type: GuideType }) {
  if (type === 'rank') return <GuideStepsSection guide={RANK_GUIDE} />
  if (type === 'team-name') return <GuideStepsSection guide={NAME_GUIDE} />
  return <LinkGuide />
}

// ─── Mobile: (i) button + Sheet dialog ───────────────────────────────────────

interface InfoButtonProps {
  type: GuideType
  label: string
}

export function InfoButton({ type, label }: InfoButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className="lg:hidden inline-flex items-center justify-center w-11 h-11 -my-[11px] -mr-1 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
      >
        <span className="flex items-center justify-center w-[22px] h-[22px] rounded-full border-[1.5px] border-current text-[13px] font-semibold leading-none select-none">
          i
        </span>
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 data-[starting-style]:opacity-0 data-[closed]:opacity-0" />
          <Dialog.Popup
            aria-label={label}
            className={cn(
              'fixed right-0 top-0 z-50 flex h-full w-[min(340px,90vw)] flex-col bg-popover',
              'rounded-l-lg overflow-hidden shadow-xl',
              'transition-transform duration-300 ease-out',
              'data-[starting-style]:translate-x-full data-[closed]:translate-x-full',
            )}
          >
            <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-1">
              <div className="flex flex-col gap-4 flex-1 min-w-0">
                <GuideContent type={type} />
              </div>
              <Dialog.Close
                aria-label="Close guide"
                className="flex-none inline-flex items-center justify-center w-11 h-11 -mt-1 -mr-1 rounded-lg text-foreground hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 3 L15 15 M15 3 L3 15" />
                </svg>
              </Dialog.Close>
            </div>
            <div className="mt-auto p-5 pb-6">
              <Dialog.Close className="w-full h-12 bg-primary text-primary-foreground rounded-md font-semibold text-body hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
                Got it
              </Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

// ─── Desktop: always-visible aside ───────────────────────────────────────────

export function GuideAside({ type }: { type: GuideType }) {
  return (
    <aside className="hidden lg:flex flex-col gap-4 p-6 bg-card border border-border rounded-lg self-start">
      <GuideContent type={type} />
    </aside>
  )
}
