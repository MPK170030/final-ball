# FixtureChip

One upcoming fixture: opponent code, home or away, and the difficulty number on a green-to-red fill.

## Rules
- Shows exactly three chips per player: the next 3 fixtures (D3.1).
- Text: three-letter club code (no crests, D9.12), H or A, then the difficulty number in bold. The number is required: green/red alone fails colour-blind users.
- Fill: `fdr-2` easy (1 and 2 share it), `fdr-3`, `fdr-4`, `fdr-5` hardest (D14.8).
- `fb-chip--sm` for alternatives rows.
- Chips may sit inside the orange top-pick block, but the orange border stays the block's only emphasis: never colour the player's name or label orange or green as well (D14.8).

## shadcn
A small `Badge` variant per difficulty.
