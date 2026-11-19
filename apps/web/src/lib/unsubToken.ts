import { createHmac, timingSafeEqual } from 'crypto'

/** Verify a signed unsubscribe token. Returns the userId on success, null on failure. */
export function verifyUnsubToken(token: string, secret: string): string | null {
  const dot = token.lastIndexOf('.')
  if (dot === -1) return null
  const uidB64 = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  let userId: string
  try {
    userId = Buffer.from(uidB64, 'base64url').toString()
  } catch {
    return null
  }
  const expected = createHmac('sha256', secret).update(userId).digest('base64url')
  try {
    if (!timingSafeEqual(Buffer.from(mac, 'base64url'), Buffer.from(expected, 'base64url'))) return null
  } catch {
    return null
  }
  return userId
}
