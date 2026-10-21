export interface Bootstrap {
  events: GameweekEvent[]
  game_settings: GameSettings
  phases: Phase[]
  teams: Club[]
  total_players: number
  elements: Player[]
  element_stats: ElementStat[]
  element_types: ElementType[]
}

export interface GameweekEvent {
  id: number
  name: string
  deadline_time: string
  average_entry_score: number
  finished: boolean
  data_checked: boolean
  highest_scoring_entry: number | null
  deadline_time_epoch: number
  deadline_time_game_offset: number
  highest_score: number | null
  is_previous: boolean
  is_current: boolean
  is_next: boolean
  cup_leagues_created: boolean
  h2h_ko_matches_created: boolean
  ranked_count: number
}

export interface GameSettings {
  game_name: string
  squad_squadsize: number
  squad_teamlimit: number
  squad_total_spend: number
  ui_currency_multiplier: number
  ui_use_special_shirts: boolean
  ui_special_shirt_exclusions: number[]
  stats_prefix: string
  cup_start_event_id: number | null
  cup_stop_event_id: number | null
  cup_qualifying_method: string | null
  cup_type: string | null
  featured_entries: number[]
  percentile_ranks: number[]
}

export interface Phase {
  id: number
  name: string
  start_event: number
  stop_event: number
  highest_score: number | null
}

export interface Club {
  code: number
  draw: number
  form: string | null
  id: number
  loss: number
  name: string
  played: number
  points: number
  position: number
  short_name: string
  strength: number
  team_division: string | null
  unavailable: boolean
  win: number
  strength_overall_home: number
  strength_overall_away: number
  strength_attack_home: number
  strength_attack_away: number
  strength_defence_home: number
  strength_defence_away: number
  pulse_id: number
}

export interface Player {
  chance_of_playing_next_round: number | null
  chance_of_playing_this_round: number | null
  code: number
  cost_change_event: number
  cost_change_event_fall: number
  cost_change_start: number
  cost_change_start_fall: number
  dreamteam_count: number
  element_type: number
  ep_next: string | null
  ep_this: string | null
  event_points: number
  first_name: string
  form: string
  id: number
  in_dreamteam: boolean
  news: string
  news_added: string | null
  now_cost: number
  photo: string
  points_per_game: string
  second_name: string
  selected_by_percent: string
  special: boolean
  squad_number: number | null
  status: 'a' | 'd' | 'i' | 'n' | 's' | 'u'
  team: number
  team_code: number
  total_points: number
  transfers_in: number
  transfers_in_event: number
  transfers_out: number
  transfers_out_event: number
  value_form: string
  value_season: string
  web_name: string
  minutes: number
  goals_scored: number
  assists: number
  clean_sheets: number
  goals_conceded: number
  own_goals: number
  penalties_saved: number
  penalties_missed: number
  yellow_cards: number
  red_cards: number
  saves: number
  bonus: number
  bps: number
  influence: string
  creativity: string
  threat: string
  ict_index: string
  starts: number
  expected_goals: string
  expected_assists: string
  expected_goal_involvements: string
  expected_goals_conceded: string
  influence_rank: number
  influence_rank_type: number
  creativity_rank: number
  creativity_rank_type: number
  threat_rank: number
  threat_rank_type: number
  ict_index_rank: number
  ict_index_rank_type: number
  corners_and_indirect_freekicks_order: number | null
  corners_and_indirect_freekicks_text: string
  direct_freekicks_order: number | null
  direct_freekicks_text: string
  penalties_order: number | null
  penalties_text: string
  expected_goals_per_90: number
  saves_per_90: number
  expected_assists_per_90: number
  expected_goal_involvements_per_90: number
  expected_goals_conceded_per_90: number
  goals_conceded_per_90: number
  now_cost_rank: number
  now_cost_rank_type: number
  form_rank: number
  form_rank_type: number
  points_per_game_rank: number
  points_per_game_rank_type: number
  selected_rank: number
  selected_rank_type: number
  starts_per_90: number
  clean_sheets_per_90: number
}

export interface ElementStat {
  label: string
  name: string
}

export interface ElementType {
  id: number
  plural_name: string
  plural_name_short: string
  singular_name: string
  singular_name_short: string
  squad_select: number
  squad_min_play: number
  squad_max_play: number
  ui_shirt_specific: boolean
  sub_positions_locked: number[]
  element_count: number
}

export interface Fixture {
  code: number
  event: number | null
  finished: boolean
  finished_provisional: boolean
  id: number
  kickoff_time: string | null
  minutes: number
  provisional_start_time: boolean
  started: boolean | null
  pulse_id: number
  team_a: number
  team_a_score: number | null
  team_h: number
  team_h_score: number | null
  team_h_difficulty: number
  team_a_difficulty: number
  stats: FixtureStat[]
}

export interface FixtureStat {
  identifier: string
  a: Array<{ value: number; element: number }>
  h: Array<{ value: number; element: number }>
}

export interface Entry {
  id: number
  joined_time: string
  started_event: number
  favourite_team: number | null
  player_first_name: string
  player_last_name: string
  player_region_id: number
  player_region_name: string
  player_region_iso_code_short: string
  player_region_iso_code_long: string
  summary_overall_points: number
  summary_overall_rank: number
  summary_event_points: number
  summary_event_rank: number
  current_event: number | null
  leagues: {
    classic: EntryLeague[]
    h2h: EntryLeague[]
    cup: unknown
  }
  name: string
  kit: string | null
  last_deadline_bank: number
  last_deadline_value: number
  last_deadline_total_transfers: number
}

export interface EntryLeague {
  id: number
  name: string
  short_name: string
  created: string
  closed: boolean
  rank: number | null
  max_entries: number | null
  league_type: string
  scoring: string
  admin_entry: number | null
  start_event: number
  entry_can_leave: boolean
  entry_can_admin: boolean
  entry_can_invite: boolean
  has_cup: boolean
  active_phases: unknown[]
  entry_rank: number
  entry_last_rank: number
}

export interface LeagueStandingsResponse {
  league: {
    id: number
    name: string
    created: string
    closed: boolean
    max_entries: number | null
    league_type: string
    scoring: string
    admin_entry: number | null
    start_event: number
    code_privacy: string
    has_cup: boolean
    cup_league: number | null
    rank: number | null
  }
  new_entries: {
    has_next: boolean
    page: number
    results: unknown[]
  }
  standings: {
    has_next: boolean
    page: number
    results: Array<{
      id: number
      event_total: number
      player_name: string
      rank: number
      last_rank: number
      rank_sort: number
      total: number
      entry: number
      entry_name: string
    }>
  }
}
