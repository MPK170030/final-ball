import type {
  PlayerScore,
  RankedAlternative,
  WhySection,
  CaptainPick,
  TraceStep,
  RiskTag,
  ChipStatus,
  ChipTimingAdvice,
  SpecialGw,
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

export interface PreviewCardPayload {
  text: string
  nextGameweek: number
}

export interface LineupSlotPayload {
  player: Player
  clubShortName?: string
  nextFixture?: NextFixture | null
  epNext: number
  isDoubtful: boolean
}

export interface LineupCardPayload {
  gameweek: number
  formation: string
  starting: LineupSlotPayload[]
  bench: LineupSlotPayload[]
  swapsIn: Player[]
  swapsOut: Player[]
  hasChanges: boolean
}

export interface ChipCardPayload {
  status: ChipStatus[]
  timing: ChipTimingAdvice[]
  expiryNudge?: string
  specialGws: SpecialGw[]
}

export { ChipStatus, ChipTimingAdvice, SpecialGw }

export interface BriefCard {
  id: string
  type: 'transfer' | 'captain' | 'chip' | 'preview' | 'lineup'
  position: number
  payload: TransferCardPayload | CaptainCardPayload | ChipCardPayload | PreviewCardPayload | LineupCardPayload
}

// ── Receipt types (E5) ───────────────────────────────────────────────────────

export interface ReceiptRowData {
  decisionId: string
  gameweek: number
  label: 'followed' | 'own_move' | 'ignored_rolled' | 'ignored_transferred'
  riskTag: 'safe' | 'balanced' | 'bold' | null
  intent: 'points' | 'funding' | 'injury_cover'
  actualMove: {
    element_in: number
    element_in_name: string | null
    element_out: number
    element_out_name: string | null
  } | null
  receipt: {
    windowStartGw: number
    windowEndGw: number
    playerInPts: number | null
    playerOutPts: number | null
    deltaPts: number | null
    status: 'pending' | 'settled'
  } | null
}

export interface ReceiptData {
  rows: ReceiptRowData[]
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
