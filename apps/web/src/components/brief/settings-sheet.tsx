'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  emailOptOut: boolean
}

export function SettingsSheet({ open, onOpenChange, emailOptOut: initialEmailOptOut }: SettingsSheetProps) {
  const router = useRouter()
  const [emailOptOut, setEmailOptOut] = useState(initialEmailOptOut)
  const [togglingEmail, setTogglingEmail] = useState(false)
  const [deletePhase, setDeletePhase] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function toggleEmailOptOut() {
    setTogglingEmail(true)
    try {
      const res = await fetch('/api/account/email-opt-out', { method: 'POST' })
      if (res.ok) {
        const data = (await res.json()) as { emailOptOut: boolean }
        setEmailOptOut(data.emailOptOut)
      }
    } finally {
      setTogglingEmail(false)
    }
  }

  async function handleDelete() {
    setDeletePhase('deleting')
    setDeleteError(null)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      const supabase = createClient()
      await supabase.auth.signOut().catch(() => {})
      router.push('/')
    } catch {
      setDeleteError('Something went wrong. Please try again.')
      setDeletePhase('confirm')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto px-6 py-6">
        <SheetHeader className="px-0 pb-2">
          <SheetTitle className="text-[18px] font-semibold tracking-[-0.01em]">Settings</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-8">
          {/* Email preferences */}
          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Email preferences
            </p>
            <div className="flex items-center justify-between gap-4 rounded-[10px] border border-border px-4 py-3">
              <div>
                <p className="text-[14px] font-medium text-foreground">Weekly brief emails</p>
                <p className="text-[13px] text-muted-foreground">
                  {emailOptOut ? 'Currently off' : 'Sent ~24h before the GW deadline'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!emailOptOut}
                disabled={togglingEmail}
                onClick={toggleEmailOptOut}
                className="relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 aria-checked:bg-primary aria-[checked=false]:bg-muted-foreground/30"
              >
                <span
                  className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform aria-checked:translate-x-4 aria-[checked=false]:translate-x-0"
                  aria-hidden="true"
                  aria-checked={!emailOptOut}
                />
              </button>
            </div>
          </section>

          {/* Account */}
          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Account
            </p>

            {deletePhase === 'idle' && (
              <div className="rounded-[10px] border border-border px-4 py-3">
                <p className="mb-0.5 text-[14px] font-medium text-foreground">Delete account</p>
                <p className="mb-3 text-[13px] text-muted-foreground">
                  Permanently removes your account, team link, briefs, decisions, receipts, counters, and notes.
                </p>
                <button
                  type="button"
                  onClick={() => setDeletePhase('confirm')}
                  className="inline-flex min-h-[36px] items-center rounded-[8px] border border-destructive/50 px-3 py-1.5 text-[13px] font-medium text-destructive hover:bg-destructive/5 focus-visible:outline-2 focus-visible:outline-ring transition-colors"
                >
                  Delete account
                </button>
              </div>
            )}

            {(deletePhase === 'confirm' || deletePhase === 'deleting') && (
              <div className="rounded-[10px] border border-destructive/40 bg-destructive/5 px-4 py-3">
                <p className="mb-1 text-[14px] font-semibold text-foreground">Are you sure?</p>
                <p className="mb-3 text-[13px] text-muted-foreground">
                  This cannot be undone. Everything listed above will be permanently deleted.
                </p>
                {deleteError && (
                  <p className="mb-3 text-[13px] text-destructive">{deleteError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deletePhase === 'deleting'}
                    className="inline-flex min-h-[36px] items-center rounded-[8px] bg-destructive px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-destructive/90 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 transition-colors"
                  >
                    {deletePhase === 'deleting' ? 'Deleting…' : 'Yes, delete everything'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDeletePhase('idle'); setDeleteError(null) }}
                    disabled={deletePhase === 'deleting'}
                    className="inline-flex min-h-[36px] items-center rounded-[8px] border border-border px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-secondary/50 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
