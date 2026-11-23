import { getKit } from '@/content/kits'

const NEUTRAL_ENV = process.env.NEXT_PUBLIC_NEUTRAL_SHIRTS === 'true'

interface ShirtProps {
  club: string
  isGk: boolean
  size: 44 | 32 | 36
  neutral?: boolean
}

export function Shirt({ club, isGk, size, neutral = NEUTRAL_ENV }: ShirtProps) {
  let body: string, sleeve: string, stripe: string

  if (neutral) {
    const c = isGk ? '#8A8A8A' : '#4A4A4A'
    body = sleeve = stripe = c
  } else {
    const kit = getKit(club, isGk)
    body = kit[0]
    // striped=true:  sleeves=body,   stripes=second
    // striped=false: sleeves=second, stripes=body (invisible on body)
    sleeve = kit[2] ? kit[0] : kit[1]
    stripe = kit[2] ? kit[1] : kit[0]
  }

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        d="M13 5 L17 3.5 Q20 7 23 3.5 L27 5 L36 11 L32 17 L29 15 L29 36 L11 36 L11 15 L8 17 L4 11 Z"
        fill={body}
        stroke="#6B6B6B"
        strokeWidth="1"
      />
      <rect x="15" y="9" width="3" height="27" fill={stripe} />
      <rect x="22" y="9" width="3" height="27" fill={stripe} />
      <path d="M13 5 L4 11 L8 17 L11 15 Z" fill={sleeve} stroke="#6B6B6B" strokeWidth="1" />
      <path d="M27 5 L36 11 L32 17 L29 15 Z" fill={sleeve} stroke="#6B6B6B" strokeWidth="1" />
    </svg>
  )
}
