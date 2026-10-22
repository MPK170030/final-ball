/** Extract a team ID from a bare integer string or any URL containing /entry/<id>/ */
export function extractTeamId(input: string): number | null {
  const trimmed = input.trim()

  const urlMatch = trimmed.match(/\/entry\/(\d+)\/?/)
  if (urlMatch) {
    const id = parseInt(urlMatch[1], 10)
    return Number.isFinite(id) && id > 0 ? id : null
  }

  if (/^\d+$/.test(trimmed)) {
    const id = parseInt(trimmed, 10)
    return Number.isFinite(id) && id > 0 ? id : null
  }

  return null
}
