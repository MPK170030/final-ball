export interface TraceStep {
  n: number
  title: string
  text: string
  replan?: boolean
}

/** Used internally by phase functions before sequential numbers are assigned. */
export type TraceEntry = Omit<TraceStep, 'n'>

export function numberSteps(entries: TraceEntry[]): TraceStep[] {
  return entries.map((e, i) => ({ ...e, n: i + 1 }))
}
