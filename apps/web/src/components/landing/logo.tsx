interface LogoProps {
  size?: number
}

export function Logo({ size = 30 }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="Final Ball">
      <svg
        width={size}
        height={size}
        viewBox="72 72 380 380"
        fill="none"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* X marks (white) */}
        <path
          d="M276 284 L352 360 M352 284 L276 360"
          stroke="#F7F7F7"
          strokeWidth="34"
          strokeLinecap="round"
        />
        {/* Player circle (white) */}
        <circle cx="140" cy="380" r="46" stroke="#F7F7F7" strokeWidth="34" />
        {/* Through-ball arc (orange) */}
        <path
          d="M176 336 C 200 200, 300 150, 352 170"
          stroke="#FF8A1F"
          strokeWidth="30"
          strokeLinecap="round"
        />
        {/* Ball circle (orange) */}
        <circle cx="384" cy="150" r="52" stroke="#FF8A1F" strokeWidth="34" />
      </svg>

      <span className="flex items-baseline leading-none">
        <span className="text-[18px] font-semibold text-foreground">Final&nbsp;</span>
        <span className="text-[18px] font-semibold text-primary">Ball</span>
      </span>
    </span>
  )
}
