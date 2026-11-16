// Prices for claude-sonnet-4-6 (as of 2026-11-13, from Anthropic model page).
// All values: USD per million tokens.
export const MODEL = process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-6'

export const PRICES = {
  inputPerMTok: 3.00,
  outputPerMTok: 15.00,
  cacheWritePer5mMTok: 3.75,
  cacheWrite1hPerMTok: 6.00,
  cacheReadPerMTok: 0.30,
} as const

/**
 * Estimates cost from input + output tokens only.
 * Does NOT include cache read/write costs — generateBrief does not expose
 * those counters. Actual cost may be slightly lower if prompt caching activates
 * within a run (system prompt + tools ≈ 3,500 tokens re-used each turn).
 */
export function computeCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * PRICES.inputPerMTok
       + (outputTokens / 1_000_000) * PRICES.outputPerMTok
}
