/** Normalize a team name for comparison: strip emoji/punctuation, lowercase, collapse spaces. */
function normalize(s: string): string {
  return s
    .normalize('NFC')
    .replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const prev = Array.from({ length: n + 1 }, (_, i) => i)
  const curr = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]
  }
  return prev[n]
}

/**
 * Returns true if query and candidate are likely the same FPL team name,
 * tolerating emoji, punctuation differences, and minor typos.
 */
export function fuzzyMatchTeamName(query: string, candidate: string): boolean {
  const nq = normalize(query)
  const nc = normalize(candidate)
  if (nq === nc) return true
  const shorter = Math.min(nq.length, nc.length)
  if (shorter === 0) return false
  const maxDist = Math.max(2, Math.floor(shorter * 0.1))
  return levenshtein(nq, nc) <= maxDist
}
