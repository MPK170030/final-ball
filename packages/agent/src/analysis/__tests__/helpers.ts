import type { Player, Bootstrap, Fixture, PickItem, GameweekEvent } from '../../fpl/types.js'

export function makePlayer(opts: {
  id: number
  element_type: number
  team: number
  now_cost: number
  ep_next?: string | null
  form?: string
  chance_of_playing_next_round?: number | null
  status?: Player['status']
  web_name?: string
}): Player {
  const name = opts.web_name ?? `P${opts.id}`
  return {
    chance_of_playing_next_round: opts.chance_of_playing_next_round ?? null,
    chance_of_playing_this_round: null,
    code: opts.id,
    cost_change_event: 0,
    cost_change_event_fall: 0,
    cost_change_start: 0,
    cost_change_start_fall: 0,
    dreamteam_count: 0,
    element_type: opts.element_type,
    ep_next: opts.ep_next !== undefined ? opts.ep_next : opts.form ?? '4.0',
    ep_this: null,
    event_points: 0,
    first_name: 'Test',
    form: opts.form ?? '4.0',
    id: opts.id,
    in_dreamteam: false,
    news: '',
    news_added: null,
    now_cost: opts.now_cost,
    photo: '',
    points_per_game: opts.form ?? '4.0',
    second_name: name,
    selected_by_percent: '10.0',
    special: false,
    squad_number: null,
    status: opts.status ?? 'a',
    team: opts.team,
    team_code: opts.team,
    total_points: 40,
    transfers_in: 0,
    transfers_in_event: 0,
    transfers_out: 0,
    transfers_out_event: 0,
    value_form: '0.0',
    value_season: '0.0',
    web_name: name,
    minutes: 90,
    goals_scored: 5,
    assists: 5,
    clean_sheets: 5,
    goals_conceded: 10,
    own_goals: 0,
    penalties_saved: 0,
    penalties_missed: 0,
    yellow_cards: 1,
    red_cards: 0,
    saves: 0,
    bonus: 5,
    bps: 100,
    influence: '100.0',
    creativity: '100.0',
    threat: '100.0',
    ict_index: '30.0',
    starts: 10,
    expected_goals: '5.0',
    expected_assists: '3.0',
    expected_goal_involvements: '8.0',
    expected_goals_conceded: '10.0',
    influence_rank: 1,
    influence_rank_type: 1,
    creativity_rank: 1,
    creativity_rank_type: 1,
    threat_rank: 1,
    threat_rank_type: 1,
    ict_index_rank: 1,
    ict_index_rank_type: 1,
    corners_and_indirect_freekicks_order: null,
    corners_and_indirect_freekicks_text: '',
    direct_freekicks_order: null,
    direct_freekicks_text: '',
    penalties_order: null,
    penalties_text: '',
    expected_goals_per_90: 0.5,
    saves_per_90: 0,
    expected_assists_per_90: 0.3,
    expected_goal_involvements_per_90: 0.8,
    expected_goals_conceded_per_90: 1.0,
    goals_conceded_per_90: 1.0,
    now_cost_rank: 1,
    now_cost_rank_type: 1,
    form_rank: 1,
    form_rank_type: 1,
    points_per_game_rank: 1,
    points_per_game_rank_type: 1,
    selected_rank: 1,
    selected_rank_type: 1,
    starts_per_90: 0.9,
    clean_sheets_per_90: 0.5,
  }
}

export function makeGwEvent(id: number, isNext: boolean): GameweekEvent {
  return {
    id,
    name: `Gameweek ${id}`,
    deadline_time: '2026-10-22T11:00:00Z',
    average_entry_score: 50,
    finished: false,
    data_checked: false,
    highest_scoring_entry: null,
    deadline_time_epoch: 1761181200,
    deadline_time_game_offset: 0,
    highest_score: null,
    is_previous: false,
    is_current: !isNext,
    is_next: isNext,
    cup_leagues_created: false,
    h2h_ko_matches_created: false,
    ranked_count: 0,
  }
}

export function makeBootstrap(opts: {
  gwIds: number[]
  nextGwId: number
  players?: Player[]
}): Bootstrap {
  return {
    events: opts.gwIds.map(id => makeGwEvent(id, id === opts.nextGwId)),
    game_settings: {} as Bootstrap['game_settings'],
    phases: [],
    teams: [],
    total_players: 1000,
    elements: opts.players ?? [],
    element_stats: [],
    element_types: [],
  }
}

/** One fixture per GW for the given club. Pass fdr=null to create a blank. */
export function makeFixtures(
  clubId: number,
  gws: Array<{ gwId: number; fdr: number | null; double?: boolean }>,
): Fixture[] {
  const fixtures: Fixture[] = []
  let fixtureId = 1
  for (const { gwId, fdr, double: isDouble } of gws) {
    if (fdr === null) continue
    const opponent = clubId + 100
    fixtures.push({
      code: fixtureId,
      event: gwId,
      finished: false,
      finished_provisional: false,
      id: fixtureId++,
      kickoff_time: null,
      minutes: 0,
      provisional_start_time: false,
      started: false,
      pulse_id: 0,
      team_h: clubId,
      team_a: opponent,
      team_h_score: null,
      team_a_score: null,
      team_h_difficulty: fdr,
      team_a_difficulty: 3,
      stats: [],
    })
    if (isDouble) {
      fixtures.push({
        code: fixtureId,
        event: gwId,
        finished: false,
        finished_provisional: false,
        id: fixtureId++,
        kickoff_time: null,
        minutes: 0,
        provisional_start_time: false,
        started: false,
        pulse_id: 0,
        team_h: opponent + 1,
        team_a: clubId,
        team_h_score: null,
        team_a_score: null,
        team_h_difficulty: 3,
        team_a_difficulty: fdr,
        stats: [],
      })
    }
  }
  return fixtures
}

export function makePick(
  elementId: number,
  position: number,
  opts?: { sellingPrice?: number; isCaptain?: boolean },
): PickItem {
  return {
    element: elementId,
    position,
    multiplier: position <= 11 ? 1 : 0,
    is_captain: opts?.isCaptain ?? false,
    is_vice_captain: false,
    selling_price: opts?.sellingPrice,
  }
}
