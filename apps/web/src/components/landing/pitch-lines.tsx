export function PitchLines() {
  return (
    <svg
      viewBox="0 0 1200 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Halfway line */}
      <line x1="600" y1="0" x2="600" y2="600" stroke="#262626" strokeWidth="2" />
      {/* Centre circle */}
      <circle cx="600" cy="300" r="90" stroke="#262626" strokeWidth="2" />
      {/* Centre spot */}
      <circle cx="600" cy="300" r="4" fill="#262626" />
      {/* Left penalty box */}
      <rect x="0" y="165" width="195" height="270" stroke="#262626" strokeWidth="2" />
      {/* Left 6-yard box */}
      <rect x="0" y="240" width="65" height="120" stroke="#262626" strokeWidth="2" />
      {/* Left penalty spot */}
      <circle cx="110" cy="300" r="4" fill="#262626" />
      {/* Right penalty box */}
      <rect x="1005" y="165" width="195" height="270" stroke="#262626" strokeWidth="2" />
      {/* Right 6-yard box */}
      <rect x="1135" y="240" width="65" height="120" stroke="#262626" strokeWidth="2" />
      {/* Right penalty spot */}
      <circle cx="1090" cy="300" r="4" fill="#262626" />
      {/* Outer pitch border */}
      <rect x="1" y="1" width="1198" height="598" stroke="#262626" strokeWidth="2" />
    </svg>
  )
}
