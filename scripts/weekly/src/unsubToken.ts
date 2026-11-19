import { createHmac } from 'crypto'

/** Generate a signed unsubscribe token: base64url(uid) + '.' + hmac-sha256(secret, uid) */
export function makeUnsubToken(userId: string, secret: string): string {
  const uidB64 = Buffer.from(userId).toString('base64url')
  const mac = createHmac('sha256', secret).update(userId).digest('base64url')
  return `${uidB64}.${mac}`
}
