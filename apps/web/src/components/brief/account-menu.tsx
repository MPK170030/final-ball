'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOutIcon, RefreshCwIcon } from 'lucide-react'

interface AccountMenuProps {
  initial: string
  displayName: string
}

export function AccountMenu({ initial, displayName }: AccountMenuProps) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  function handleChangeTeam() {
    router.push('/onboarding')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Account menu for ${displayName}`}
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <div className="px-1.5 py-1.5">
          <p className="text-small font-medium text-foreground truncate">{displayName}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleChangeTeam}>
          <RefreshCwIcon className="size-4" aria-hidden="true" />
          Change team
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOutIcon className="size-4" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
