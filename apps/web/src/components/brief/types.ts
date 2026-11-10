import type {
  PlayerScore,
  RankedAlternative,
  WhySection,
  CaptainPick,
  TraceStep,
  RiskTag,
} from '@finalball/agent'
import type { Player } from '@finalball/agent'
import type { Candidate } from '@finalball/agent'

// ── Enriched variants (club name + captain fixture added at card-build time) ──

export type PlayerScoreWithClub = PlayerScore & { clubShortName?: string }
export type CandidateWithClub = Candidate & { clubShortName?: string }
export type RankedAlternativeWithClub = Omit<RankedAlternative, 'candidate'> & {
  candidate: CandidateWithClub
  riskTag: RiskTag
}

export interface NextFixture {
  opponent: string
  isHome: boolean
}

export type CaptainPickWithMeta = CaptainPick & {
  clubShortName?: string
  nextFixture?: NextFixture | null
  riskTag: RiskTag
}

// ── Card payload types ────────────────────────────────────────────────────────

export interface TransferCardPayloadSave {
  save: true
  reason: string
  bestOption: { player: Player; reason: string; clubShortName?: string } | null
  /** Weakest squad player — who would be sold if making a transfer (from whySellContext[0]). */
  sellPlayer?: { player: Player; sellingPrice: number; clubShortName?: string } | null
  /** Free transfers available in the next GW after saving this one. */
  freeTransfersNextGw?: number
  /** The GW number after the current one. */
  nextGw?: number
}

export interface TransferCardPayloadTransfer {
  save: false
  sell: PlayerScoreWithClub
  sellingPrice: number
  topPick: CandidateWithClub
  topPickReason: string
  topPickWhy: WhySection
  topPickRiskTag: RiskTag
  alternatives: RankedAlternativeWithClub[]
  whySell: string
  swapReason: string
  replans: string[]
  whySellContext: PlayerScoreWithClub[]
}

export { RiskTag }

export type TransferCardPayload = TransferCardPayloadSave | TransferCardPayloadTransfer

export interface CaptainCardPayload {
  captain: CaptainPickWithMeta
  vc: CaptainPickWithMeta
  alternatives: CaptainPickWithMeta[]
}

export interface BriefCard {
  id: string
  type: 'transfer' | 'captain'
  position: number
  payload: TransferCardPayload | CaptainCardPayload
}

export interface BriefData {
  id: string
  gameweek: number
  version: number
  generatedAt: string
  trace: TraceStep[]
  cards: BriefCard[]
  /** Human-readable summary of what changed since the previous brief (D10.6). Null for the first brief. */
  changeSummary: string | null
}

export type CounterPhase =
  | { phase: 'idle' }
  | { phase: 'checking'; steps: string[] }
  | {
      phase: 'done'
      outcome: 'held' | 'changed_fact' | 'accepted_preference' | 'declined'
      response: string
      newPick: unknown
    }
  | { phase: 'error'; message: string }

/** State for the detail sheet / side panel */
export interface DetailState {
  cardId: string
  tab: 'why' | 'trace' | 'counter'
  counterType?: 'weakspot'
}
