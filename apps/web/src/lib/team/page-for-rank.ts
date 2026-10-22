/** D9.3a: page where the rank's tied group starts (rank treated as first sorted position). */
export function pageForRank(rank: number): number {
  return Math.floor((rank - 1) / 50) + 1
}
