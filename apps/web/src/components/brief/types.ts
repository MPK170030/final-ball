import type {
  PlayerScore,
  RankedAlternative,
  WhySection,
  CaptainPick,
  TraceStep,
} from '@finalball/agent'
import type { Player } from '@finalball/agent'
import type { Candidate } from '@finalball/agent'

export interface TransferCardPayloadSave {
  save: true
  reason: string
  bestOption: { player: Player; reason: string } | null
}

export interface TransferCardPayloadTransfer {
  save: false
  sell: PlayerScore
  sellingPrice: number
  topPick: Candidate
  topPickReason: string
  topPickWhy: WhySection
  alternatives: RankedAlternative[]
  whySell: string
  swapReason: string
  replans: string[]
  whySellContext: PlayerScore[]
}

export type TransferCardPayload = TransferCardPayloadSave | TransferCardPayloadTransfer

export interface CaptainCardPayload {
  captain: CaptainPick
  vc: CaptainPick
  alternatives: CaptainPick[]
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
}

/** State for the detail sheet / side panel */
export interface DetailState {
  cardId: string
  tab: 'why' | 'trace'
}
