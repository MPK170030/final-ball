export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          google_sub: string | null
          email: string
          team_id: number | null
          team_name: string | null
          manager_name: string | null
          country: string | null
          email_opt_out: boolean
          created_at: string
        }
        Insert: {
          id: string
          google_sub?: string | null
          email: string
          team_id?: number | null
          team_name?: string | null
          manager_name?: string | null
          country?: string | null
          email_opt_out?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          google_sub?: string | null
          email?: string
          team_id?: number | null
          team_name?: string | null
          manager_name?: string | null
          country?: string | null
          email_opt_out?: boolean
          created_at?: string
        }
        Relationships: []
      }
      country_leagues: {
        Row: {
          id: number
          season: number
          country: string
          league_id: number
          created_at: string
        }
        Insert: {
          season: number
          country: string
          league_id: number
          created_at?: string
        }
        Update: {
          season?: number
          country?: string
          league_id?: number
          created_at?: string
        }
        Relationships: []
      }
      standings_cache: {
        Row: {
          league_id: number
          page: number
          gameweek: number
          payload: StandingsPage
          fetched_at: string
        }
        Insert: {
          league_id: number
          page: number
          gameweek: number
          payload: StandingsPage
          fetched_at?: string
        }
        Update: {
          league_id?: number
          page?: number
          gameweek?: number
          payload?: StandingsPage
          fetched_at?: string
        }
        Relationships: []
      }
      fpl_cache: {
        Row: {
          key: string
          payload: unknown
          fetched_at: string
        }
        Insert: {
          key: string
          payload: unknown
          fetched_at?: string
        }
        Update: {
          key?: string
          payload?: unknown
          fetched_at?: string
        }
        Relationships: []
      }
      briefs: {
        Row: {
          id: string
          user_id: string
          gameweek: number
          version: number
          status: 'generating' | 'ready' | 'error'
          payload: unknown | null
          trace: unknown | null
          error: string | null
          generated_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          gameweek: number
          version?: number
          status?: 'generating' | 'ready' | 'error'
          payload?: unknown | null
          trace?: unknown | null
          error?: string | null
          generated_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          gameweek?: number
          version?: number
          status?: 'generating' | 'ready' | 'error'
          payload?: unknown | null
          trace?: unknown | null
          error?: string | null
          generated_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          id: string
          brief_id: string
          type: 'transfer' | 'captain' | 'chip' | 'preview' | 'checkin'
          position: number
          payload: unknown
          created_at: string
        }
        Insert: {
          id?: string
          brief_id: string
          type: 'transfer' | 'captain' | 'chip' | 'preview' | 'checkin'
          position: number
          payload: unknown
          created_at?: string
        }
        Update: {
          id?: string
          brief_id?: string
          type?: 'transfer' | 'captain' | 'chip' | 'preview' | 'checkin'
          position?: number
          payload?: unknown
          created_at?: string
        }
        Relationships: []
      }
      generation_usage: {
        Row: {
          user_id: string
          date: string
          count: number
        }
        Insert: {
          user_id: string
          date?: string
          count?: number
        }
        Update: {
          user_id?: string
          date?: string
          count?: number
        }
        Relationships: []
      }
      lookup_usage: {
        Row: {
          user_id: string
          hour_bucket: string
          count: number
        }
        Insert: {
          user_id: string
          hour_bucket: string
          count?: number
        }
        Update: {
          user_id?: string
          hour_bucket?: string
          count?: number
        }
        Relationships: []
      }
      sample_brief: {
        Row: {
          key: string
          gameweek: number
          version: number
          trace: unknown
          cards: unknown
          meta: unknown
          generated_at: string
        }
        Insert: {
          key?: string
          gameweek: number
          version?: number
          trace?: unknown
          cards?: unknown
          meta?: unknown
          generated_at?: string
        }
        Update: {
          key?: string
          gameweek?: number
          version?: number
          trace?: unknown
          cards?: unknown
          meta?: unknown
          generated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export interface StandingsPage {
  league: {
    id: number
    name: string
    league_type: string
  }
  standings: {
    has_next: boolean
    page: number
    results: StandingEntry[]
  }
}

export interface StandingEntry {
  id: number
  event_total: number
  player_name: string
  rank: number
  last_rank: number
  rank_sort: number
  total: number
  entry: number
  entry_name: string
}
