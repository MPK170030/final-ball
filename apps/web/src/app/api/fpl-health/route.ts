import { NextResponse } from 'next/server'
import { FplClient, FplError, MemoryCacheAdapter, getActiveGameweek, getNextGameweek } from '@finalball/agent'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()
  const client = new FplClient({ cache: new MemoryCacheAdapter() })

  try {
    const bootstrap = await client.getBootstrap()
    const activeGw = getActiveGameweek(bootstrap)
    const nextGw = getNextGameweek(bootstrap)
    const nextDeadline = nextGw
      ? bootstrap.events.find((ev) => ev.id === nextGw)?.deadline_time ?? null
      : null

    return NextResponse.json({
      ok: true,
      activeGameweek: activeGw,
      nextGameweek: nextGw,
      nextDeadline,
      totalPlayers: bootstrap.total_players,
      latencyMs: Date.now() - start,
    })
  } catch (err: unknown) {
    const fplErr = err instanceof FplError ? err : null
    const status = fplErr ? (fplErr.status === 404 ? 502 : fplErr.status) : 500
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        latencyMs: Date.now() - start,
      },
      { status },
    )
  }
}
