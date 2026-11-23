import type { Player, TraceStep } from '@finalball/agent'
import type {
  TransferCardPayloadTransfer,
  PlayerScoreWithClub,
  CandidateWithClub,
} from '@/components/brief/types'
import type { CounterPhase } from '@/components/brief/types'

// Builds a minimal Player for demo rendering. Only the fields that
// TransferCard and DetailSheet actually read are set; the rest are zeroed.
function mkPlayer(
  id: number,
  element_type: number,
  now_cost: number,
  web_name: string,
  form: string,
  news = '',
): Player {
  return {
    id,
    element_type,
    now_cost,
    web_name,
    form,
    news,
    status: 'a',
    code: id,
    chance_of_playing_next_round: null,
    chance_of_playing_this_round: null,
  } as unknown as Player
}

// ── Sell player (Saka) ────────────────────────────────────────────────────────

const SELL_PLAYER = mkPlayer(23, 3, 85, 'Saka', '6.1', 'Rotational risk flagged (75% chance of playing)')

const SELL: PlayerScoreWithClub = {
  player: SELL_PLAYER,
  clubShortName: 'ARS',
  score: {
    total: 10.4,
    epNext: 4.2,
    form: 6.1,
    availability: 0.75,
    perGw: [
      { gwId: 13, points: 3.9, fdr: 4, isDouble: false, opponents: [{ shortName: 'MCI', isHome: false }] },
      { gwId: 14, points: 3.5, fdr: 4, isDouble: false, opponents: [{ shortName: 'MCI', isHome: true }] },
      { gwId: 15, points: 3.0, fdr: 5, isDouble: false, opponents: [{ shortName: 'TOT', isHome: false }] },
    ],
  },
  squadRank: 8,
  rankScore: 0.72,
}

// ── Top pick (Palmer, CHE MID) — Tab 0: Balanced ──────────────────────────────

const PALMER: CandidateWithClub = {
  player: mkPlayer(351, 3, 105, 'Palmer', '8.4'),
  clubShortName: 'CHE',
  score: {
    total: 17.8,
    epNext: 7.2,
    form: 8.4,
    availability: 1.0,
    perGw: [
      { gwId: 13, points: 6.4, fdr: 2, isDouble: false, opponents: [{ shortName: 'WHU', isHome: true }] },
      { gwId: 14, points: 6.1, fdr: 2, isDouble: false, opponents: [{ shortName: 'NWC', isHome: true }] },
      { gwId: 15, points: 5.3, fdr: 3, isDouble: false, opponents: [{ shortName: 'AVL', isHome: false }] },
    ],
  },
  valueScore: 1.69,
}

export const DEMO_OPTION_TOP: TransferCardPayloadTransfer = {
  save: false,
  sell: SELL,
  sellingPrice: 85,
  topPick: PALMER,
  topPickReason: 'Palmer has the best 3-GW fixture run of any midfielder under £11m — three straight home-friendly matches with a combined xP of 17.8.',
  topPickWhy: {
    form: 'Averaged 8.4 over the last four gameweeks with three goal involvements.',
    fixtures: 'WHU H (FDR 2) · NWC H (FDR 2) · AVL A (FDR 3). The easiest 3-GW run in the top 50 midfielders.',
    price: '£10.5m. Net cost £2.0m — your bank covers it with £0.3m to spare.',
    risks: 'Chelsea fixture rotation in cups could affect starts. Underlying xG remains elite.',
  },
  topPickRiskTag: 'balanced',
  alternatives: [],
  whySell: 'Saka is flagged at 75% fitness and faces two Manchester City fixtures in the next three gameweeks (FDR 4 each). His form has dropped to 6.1.',
  swapReason: 'Palmer replaces Saka with a 2× expected points uplift over the next three weeks.',
  replans: [],
  whySellContext: [
    {
      player: SELL_PLAYER,
      clubShortName: 'ARS',
      score: { total: 10.4, epNext: 4.2, form: 6.1, availability: 0.75, perGw: SELL.score.perGw },
      squadRank: 8,
      rankScore: 0.72,
    },
    {
      player: mkPlayer(14, 4, 92, 'Watkins', '5.8'),
      clubShortName: 'AVL',
      score: { total: 12.1, epNext: 5.1, form: 5.8, availability: 1.0, perGw: [
        { gwId: 13, points: 4.5, fdr: 3, isDouble: false, opponents: [{ shortName: 'CHE', isHome: true }] },
        { gwId: 14, points: 4.1, fdr: 3, isDouble: false, opponents: [{ shortName: 'BOU', isHome: false }] },
        { gwId: 15, points: 3.5, fdr: 4, isDouble: false, opponents: [{ shortName: 'LIV', isHome: true }] },
      ] },
      squadRank: 7,
      rankScore: 0.80,
    },
  ],
}

// ── Safe pick (Mbeumo, BRE FWD) — Tab 1 ──────────────────────────────────────

const MBEUMO: CandidateWithClub = {
  player: mkPlayer(401, 4, 75, 'Mbeumo', '7.6'),
  clubShortName: 'BRE',
  score: {
    total: 15.1,
    epNext: 5.9,
    form: 7.6,
    availability: 1.0,
    perGw: [
      { gwId: 13, points: 5.6, fdr: 2, isDouble: false, opponents: [{ shortName: 'WOL', isHome: true }] },
      { gwId: 14, points: 4.8, fdr: 2, isDouble: false, opponents: [{ shortName: 'CRY', isHome: false }] },
      { gwId: 15, points: 4.7, fdr: 3, isDouble: false, opponents: [{ shortName: 'EVE', isHome: true }] },
    ],
  },
  valueScore: 2.01,
}

export const DEMO_OPTION_SAFE: TransferCardPayloadTransfer = {
  ...DEMO_OPTION_TOP,
  topPick: MBEUMO,
  topPickReason: 'Mbeumo is the most consistent budget forward — three clean double-digit returns in his last five. Cheap at £7.5m.',
  topPickWhy: {
    form: 'Three returns in five. Averaging 7.6 over four gameweeks, the highest form score among sub-£8m forwards.',
    fixtures: 'WOL H (FDR 2) · CRY A (FDR 2) · EVE H (FDR 3). Three favourable matches at a combined FDR of 7.',
    price: '£7.5m. Net cost £0.0m — frees up bank for a future premium buy.',
    risks: 'Lower ceiling than Palmer. Brentford can be conservative in away fixtures.',
  },
  topPickRiskTag: 'safe',
  alternatives: [],
}

// ── Bold pick (Semenyo, BOU FWD) — Tab 2 ─────────────────────────────────────

const SEMENYO: CandidateWithClub = {
  player: mkPlayer(502, 4, 59, 'Semenyo', '7.1'),
  clubShortName: 'BOU',
  score: {
    total: 14.6,
    epNext: 5.5,
    form: 7.1,
    availability: 1.0,
    perGw: [
      { gwId: 13, points: 5.6, fdr: 2, isDouble: false, opponents: [{ shortName: 'SOU', isHome: true }] },
      { gwId: 14, points: 4.9, fdr: 2, isDouble: false, opponents: [{ shortName: 'NOT', isHome: false }] },
      { gwId: 15, points: 4.1, fdr: 2, isDouble: false, opponents: [{ shortName: 'WOL', isHome: true }] },
    ],
  },
  valueScore: 2.47,
}

export const DEMO_OPTION_BOLD: TransferCardPayloadTransfer = {
  ...DEMO_OPTION_TOP,
  topPick: SEMENYO,
  topPickReason: 'Semenyo has the best 3-GW FDR of any forward (all FDR 2) and is owned by just 3% — differential upside before ownership rises.',
  topPickWhy: {
    form: 'Three consecutive FDR-2 fixtures and form of 7.1. Bournemouth are scoring at 2.3 goals per game at home.',
    fixtures: 'SOU H (FDR 2) · NOT A (FDR 2) · WOL H (FDR 2). The only forward with three FDR-2 fixtures in a row.',
    price: '£5.9m. Net cost −£1.6m — boosts bank for a future premium buy.',
    risks: 'Low ownership means a blank hurts more. Bournemouth can rotate forward positions in cup weeks.',
  },
  topPickRiskTag: 'bold',
  alternatives: [],
}

// ── Demo options array (index = tab index) ───────────────────────────────────

export const DEMO_OPTIONS: TransferCardPayloadTransfer[] = [
  DEMO_OPTION_TOP,
  DEMO_OPTION_SAFE,
  DEMO_OPTION_BOLD,
]

// ── Trace steps ───────────────────────────────────────────────────────────────

export const DEMO_TRACE_STEPS: TraceStep[] = [
  {
    n: 1,
    title: 'get_squad',
    text: 'Loaded 15 players. Weakest sell candidate: Saka (ARS MID £8.5m · form 6.1 · flagged 75%).',
  },
  {
    n: 2,
    title: 'get_news',
    text: 'Saka: "Rotational risk — 75% chance of playing flagged by FPL." Two MCI fixtures upcoming.',
  },
  {
    n: 3,
    title: 'get_fixtures',
    text: 'ARS (Saka): MCI A (4) · MCI H (4) · TOT A (5). Shortlist leaders: Palmer CHE H (2) · NWC H (2) · AVL A (3).',
  },
  {
    n: 4,
    title: 'search_candidates',
    text: 'Scanned 48 midfielders under £11m. Filtered to 12 passing form + fixture constraints.',
  },
  {
    n: 5,
    title: 'compare',
    text: 'Palmer top at xP 17.8 / 3 GWs. Mbeumo safe (£7.5m · consistent). Semenyo bold (all FDR-2 · 3% owned).',
  },
  {
    n: 6,
    title: 'check_constraints',
    text: 'Palmer costs £2.0m net — bank of £2.3m covers it. No duplicate-club breach. Plan valid.',
  },
]

// ── Counter outcomes (canned, no API calls) ────────────────────────────────────

export type DemoCounterOutcome = Extract<CounterPhase, { phase: 'done' }>

export const DEMO_QUICK_REPLIES = ['Why not Salah?', 'He trained today', 'Keep him']

export const DEMO_COUNTER_OUTCOMES: Array<{ trigger: string | null } & Omit<DemoCounterOutcome, 'phase'>> = [
  {
    trigger: 'Why not Salah?',
    outcome: 'held',
    response: 'Salah is the stronger player, but at £13.0m he would require selling two assets to fit him in. Palmer delivers comparable returns over the next 3 GWs at a fraction of the cost — the fixtures make the differential worth taking.',
    newPick: null,
    counterId: 'demo',
    counterType: undefined,
  },
  {
    trigger: 'He trained today',
    outcome: 'changed_fact',
    response: "Good shout — if Saka is confirmed training fully, the injury risk drops substantially. Palmer still wins on pure fixture difficulty (MCI twice), but Saka's form ceiling means saving the transfer is a reasonable alternative if he gets full fitness clearance before the deadline.",
    newPick: { playerName: 'Saka' },
    counterId: 'demo',
    counterType: undefined,
  },
  {
    trigger: 'Keep him',
    outcome: 'accepted_preference',
    response: "Noted — keeping Saka. His ceiling on good weeks is high, and the 75% rating may be precautionary. Watch for his pre-deadline training report and make the final call closer to the deadline.",
    newPick: null,
    counterId: 'demo',
    counterType: undefined,
  },
  {
    trigger: null,
    outcome: 'held',
    response: 'The recommendation stands. Palmer has the clearest fixture advantage over the next three gameweeks among midfielders in your budget range.',
    newPick: null,
    counterId: 'demo',
    counterType: undefined,
  },
]
