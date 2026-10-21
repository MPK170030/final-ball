# SearchProgress

Shows the team lookup working: a progress bar and a line tied to real progress, never faked (D9.3c).

## Parts
- Head: "Searching" and the time estimate from the tie-size probe ("About 15 s left").
- Bar: width = managers checked ÷ tied-group size. `fb-progress--working` adds a slow shimmer while requests are in flight (D14.4); off with reduced motion.
- Progress line (mono): "Checked 1,400 of ~4,000 USA managers on 440 pts".
- Status line (muted): what is happening now, e.g. "Scanning the USA league, page 1,047…".

## Rules
- Update the numbers at least once a second; the shimmer alone is not progress.
- Announce changes politely (`aria-live="polite"`), at most every few seconds.
- The "Use my FPL link instead" button sits below this card from 5 seconds (D9.3b).
