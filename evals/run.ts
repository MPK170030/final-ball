/**
 * Eval runner for the Final Ball brief agent.
 *
 * Usage:
 *   tsx --env-file=apps/web/.env.local evals/run.ts [--team <teamId>]
 *
 * Runs the 25 questions from evals/questions.json through generateBrief(),
 * plus one un-counted warm-up run. Saves a snapshot of FPL data and all
 * results to evals/snapshots/ and evals/results/.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateBrief, FplClient, MemoryCacheAdapter } from '../packages/agent/src/index.js'
import { getSquadGameweek } from '../packages/agent/src/fpl/helpers.js'
import type { BriefResult } from '../packages/agent/src/generateBrief.js'
import type { Bootstrap, Fixture, EntryPicks } from '../packages/agent/src/fpl/types.js'
import type { TraceStep } from '../packages/agent/src/trace.js'
import { computeCost, MODEL } from './pricing.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Question {
  id: string
  category: 'single-fact' | 'multi-step' | 'open-ended'
  text: string
  condition: string
  extract: string
  expectedRule: string
  grading: 'exact' | 'set' | 'needs_review'
  notes: string
}

export interface ToolCallRecord {
  name: string
  resultTruncated: string
}

export interface QuestionResult {
  questionId: string
  questionText: string
  category: string
  runIndex: number
  startedAt: string
  elapsedMs: number
  brief: BriefResult | null
  toolCalls: ToolCallRecord[]
  toolCallCount: number
  loopStepsEstimate: number
  tokenUsage: { inputTokens: number; outputTokens: number }
  estimatedCostUSD: number
  error: string | null
}

export interface Snapshot {
  snapshotTimestamp: string
  teamId: number
  bootstrap: Bootstrap
  fixtures: Fixture[]
  picks: EntryPicks
}

export interface EvalRun {
  runId: string
  startedAt: string
  teamId: number
  model: string
  snapshotFile: string
  warmup: {
    elapsedMs: number
    tokenUsage: { inputTokens: number; outputTokens: number }
    error: string | null
  }
  questions: QuestionResult[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toolCallsFromTrace(trace: TraceStep[]): ToolCallRecord[] {
  return trace
    .filter(step => step.title.startsWith('Tool: '))
    .map(step => ({
      name: step.title.slice('Tool: '.length),
      resultTruncated: step.text,
    }))
}

function loopStepsEstimate(toolCalls: ToolCallRecord[], trace: TraceStep[]): number {
  // Each unique batch of tool calls = one API call. Approximate by counting
  // "Guard" steps (each = one rejected call that became a re-do) + at least
  // one investigating call + one submit call.
  const guardCount = trace.filter(s => s.title === 'Guard').length
  // Minimum: 1 for the investigating call(s) + 1 for submit + 1 per guard rejection
  return Math.max(2, guardCount * 2 + (toolCalls.length > 0 ? 1 : 0) + 1)
}

function isoNow(): string {
  return new Date().toISOString()
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function runId(): string {
  const d = new Date()
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const teamFlag = args.indexOf('--team')
const teamId = teamFlag !== -1
  ? Number(args[teamFlag + 1])
  : Number(process.env['FPL_TEAM_ID'] ?? '')

if (!teamId || isNaN(teamId)) {
  console.error('Error: provide a team ID via --team <id> or FPL_TEAM_ID env var')
  process.exit(1)
}

const __dir = dirname(fileURLToPath(import.meta.url))

const questionsPath = join(__dir, 'questions.json')
const questions: Question[] = JSON.parse(readFileSync(questionsPath, 'utf8'))

if (questions.length !== 25) {
  console.error(`Expected 25 questions, got ${questions.length}`)
  process.exit(1)
}

const id = runId()
const snapshotsDir = join(__dir, 'snapshots')
const resultsDir = join(__dir, 'results')
mkdirSync(snapshotsDir, { recursive: true })
mkdirSync(resultsDir, { recursive: true })

const snapshotFile = join(snapshotsDir, `${id}.json`)
const resultsFile = join(resultsDir, `${id}.json`)

// Shared client — all runs use the same cached FPL data.
const client = new FplClient({ cache: new MemoryCacheAdapter() })

// ── Snapshot ──────────────────────────────────────────────────────────────────

console.log('Fetching FPL snapshot...')
const bootstrap = await client.getBootstrap()
const fixtures = await client.getFixtures()
const squadGwId = getSquadGameweek(bootstrap)
const picks = await client.getEntryPicks(teamId, squadGwId)

const snapshot: Snapshot = {
  snapshotTimestamp: isoNow(),
  teamId,
  bootstrap,
  fixtures,
  picks,
}
writeFileSync(snapshotFile, JSON.stringify(snapshot))
console.log(`Snapshot saved → ${snapshotFile}`)

// ── Run helper ────────────────────────────────────────────────────────────────

async function runOne(label: string): Promise<{
  brief: BriefResult | null
  elapsedMs: number
  toolCalls: ToolCallRecord[]
  toolCallCount: number
  loopStepsEstimate: number
  tokenUsage: { inputTokens: number; outputTokens: number }
  error: string | null
}> {
  const t0 = Date.now()
  let brief: BriefResult | null = null
  let error: string | null = null

  try {
    brief = await generateBrief(teamId, { client })
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }

  const elapsedMs = Date.now() - t0
  const toolCalls = brief ? toolCallsFromTrace(brief.trace) : []
  const steps = brief ? loopStepsEstimate(toolCalls, brief.trace) : 0
  const tokenUsage = brief
    ? { inputTokens: brief.meta.usage.inputTokens, outputTokens: brief.meta.usage.outputTokens }
    : { inputTokens: 0, outputTokens: 0 }

  const statusStr = brief
    ? (brief.save ? 'save' : `transfer(${brief.transfers.length})`) + ` | C:${brief.captain.captain.player.web_name}`
    : `ERROR: ${error}`

  console.log(`  [${label}] ${elapsedMs}ms | ${tokenUsage.inputTokens}in/${tokenUsage.outputTokens}out tok | ${statusStr}`)

  return { brief, elapsedMs, toolCalls, toolCallCount: toolCalls.length, loopStepsEstimate: steps, tokenUsage, error }
}

// ── Warm-up ───────────────────────────────────────────────────────────────────

console.log('\nWarm-up run (not counted)...')
const warmupResult = await runOne('warmup')
const warmup = {
  elapsedMs: warmupResult.elapsedMs,
  tokenUsage: warmupResult.tokenUsage,
  error: warmupResult.error,
}

// ── 25 question runs ──────────────────────────────────────────────────────────

const questionResults: QuestionResult[] = []

console.log(`\nRunning ${questions.length} questions...`)
for (let i = 0; i < questions.length; i++) {
  const q = questions[i]!
  const startedAt = isoNow()
  const { brief, elapsedMs, toolCalls, toolCallCount, loopStepsEstimate: steps, tokenUsage, error } =
    await runOne(`${String(i + 1).padStart(2, ' ')}/${questions.length} ${q.id}`)

  questionResults.push({
    questionId: q.id,
    questionText: q.text,
    category: q.category,
    runIndex: i,
    startedAt,
    elapsedMs,
    brief,
    toolCalls,
    toolCallCount,
    loopStepsEstimate: steps,
    tokenUsage,
    estimatedCostUSD: computeCost(tokenUsage.inputTokens, tokenUsage.outputTokens),
    error,
  })
}

// ── Save results ──────────────────────────────────────────────────────────────

const evalRun: EvalRun = {
  runId: id,
  startedAt: questionResults[0]?.startedAt ?? isoNow(),
  teamId,
  model: MODEL,
  snapshotFile,
  warmup,
  questions: questionResults,
}

writeFileSync(resultsFile, JSON.stringify(evalRun))

const totalTokens = questionResults.reduce(
  (acc, r) => ({ i: acc.i + r.tokenUsage.inputTokens, o: acc.o + r.tokenUsage.outputTokens }),
  { i: 0, o: 0 },
)
const totalCost = computeCost(totalTokens.i, totalTokens.o)
const errors = questionResults.filter(r => r.error !== null).length

console.log(`\nDone.`)
console.log(`  Results  → ${resultsFile}`)
console.log(`  Tokens   : ${totalTokens.i.toLocaleString()} input / ${totalTokens.o.toLocaleString()} output`)
console.log(`  Est. cost: $${totalCost.toFixed(4)}`)
console.log(`  Errors   : ${errors}/${questions.length}`)
console.log(`\nRun scorer: pnpm eval:score -- --results ${resultsFile}`)
