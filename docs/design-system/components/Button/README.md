# Button

Buttons and text links for every action; one primary button per screen.

## Variants
- **Primary** (`fb-btn fb-btn--primary`): the one main action on a screen: Find my team, Continue, Get started. Orange fill with ink text (`primary-foreground`); white on orange fails contrast.
- **Secondary** (`fb-btn--secondary`): everything else that is a button: Use my FPL link instead, Open FPL, New brief.
- **Small** (`fb-btn--sm`): 44px tall, for inline header actions. Never smaller; 44px is the touch minimum.
- **Disabled** (`disabled`): New brief at the daily cap or after the deadline. Always pair it with a line saying why (e.g. "Limit reached · resets tomorrow").
- **Link** (`fb-link`): Why?, Cancel / do this later, Edit. Underlined, 44px touch height.

## Rules
- One primary per screen. In the brief there is none: the brief recommends; the manager acts in the FPL app.
- Labels say what happens: "Find my team", not "Submit".
- Hover darkens to `primary-hover`; focus shows a 2px `ring` with 2px offset; press moves down 1px (off with reduced motion).

## shadcn
`Button` with `variant="default"` (primary), `"outline"` (secondary), `"link"`. Set `--radius` to `radius-md`.
