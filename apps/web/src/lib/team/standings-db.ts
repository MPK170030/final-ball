import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, StandingsPage } from '@finalball/db'
import { FplClient, FplError } from '@finalball/agent'

/**
 * Returns standings page from Supabase cache if fresh for this gameweek,
 * otherwise fetches from FPL and writes the result into the cache.
 * Returns null only on a hard FPL error; throws FplError so callers can
 * detect the "game updating" (503) case.
 */
export async function getOrFetchStandingsPage(
  supabase: SupabaseClient<Database>,
  fplClient: FplClient,
  leagueId: number,
  page: number,
  gameweek: number,
): Promise<StandingsPage | null> {
  const { data: cached } = await supabase
    .from('standings_cache')
    .select('payload')
    .eq('league_id', leagueId)
    .eq('page', page)
    .eq('gameweek', gameweek)
    .single()

  if (cached) return cached.payload as StandingsPage

  const fplData = await fplClient.getLeagueStandings(leagueId, page)

  const standingsPage: StandingsPage = {
    league: {
      id: fplData.league.id,
      name: fplData.league.name,
      league_type: fplData.league.league_type,
    },
    standings: {
      has_next: fplData.standings.has_next,
      page: fplData.standings.page,
      results: fplData.standings.results,
    },
  }

  // Best-effort cache write — don't block or throw on failure
  void supabase
    .from('standings_cache')
    .upsert({ league_id: leagueId, page, gameweek, payload: standingsPage })

  return standingsPage
}

export { FplError }
