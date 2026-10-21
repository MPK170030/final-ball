# Final Ball

**"We create the chance, you finish it."** Final Ball is an AI agent for Fantasy Premier League managers. Each gameweek it suggests a transfer and a captain, explains why, and later shows whether the advice worked.

Source of truth: `decisions.md` section 14 (D14.1–D14.11) and D13.6–D13.8. Every value here is decided; the proposed values were signed off on 19 October 2026 (D14.11).

## Status

| Area | Status |
|---|---|
| Dark palette (background, surfaces, border, text, muted, accent, positive, negative, pending) | Decided (D14.6) |
| Light accent `#C25E00` | Decided (D14.6). Fills, borders and 24px+ text only; small accent-coloured text uses `primary-hover` `#A85100` (D14.11) |
| Light theme, warning colour, fixture difficulty scale | Signed off (D14.11) |
| Typography: IBM Plex Sans + IBM Plex Mono | Signed off (D14.11) |
| Spacing (4px base) and radius (6, 10, 14px) | Signed off (D14.11) |
| Components | First set of 10 for the core MVP (below) |

## Components (core MVP)

Primitives: **Button**, **Field** (with the (i) button), **Banner**, **FixtureChip**. Brief: **TransferCard**, **CaptainCard**, **DetailSheet**, **TraceStep**. Onboarding: **SearchProgress**, **GuidePanel**.

They are plain CSS on the tokens (`components/bundle.css`, class prefix `fb-`), meant as the reference to port into shadcn/Tailwind components. Each component's guidelines say which shadcn primitive to start from.

## Making it not look like every other shadcn app

The default shadcn look (Inter or Geist, zinc greys, 8px radius, Lucide icons, centered hero, gradient blobs) is what reads as "vibe-coded." This system already moves away from it with its own type, one orange accent, mono numbers and football-specific components. To keep that in code:

- **Restyle every shadcn component you add** to these tokens before using it. Never ship the default `zinc` theme or default radius.
- **Numbers do the talking:** tabular mono figures everywhere, and animated number changes (see libraries below).
- **Motion with meaning only** (D14.4): count-ups, staggered card entry, receipts settling, a shimmer while the agent works. No parallax, glow or floating blobs.
- **Avoid** pre-built "magic" effect libraries (spotlight cards, beams, sparkles, bento grids): they are the most recognisable vibe-coded tells.
- **Icons:** choose one set and restyle it, rather than Lucide at its defaults.

## Content fundamentals

- **Plain and specific.** "Saka is flagged 75% with three hard fixtures," never "Saka looks risky."
- **Numbers carry the argument.** Form, price, expected points and fixtures in every reason. Set numbers in `mono`.
- **Accountable, not hyped.** No "guaranteed," "must-have," or exclamation marks. The agent says what it thinks and later shows the receipt.
- **The manager decides.** Recommend, don't instruct: "Top pick," "Save your transfer," never "Do this now."
- **No FPL or Premier League branding in copy, logos or crests** (D9.12). "FPL" may name the game in sentences, never in the product name.

## Visual foundations

- **Dark first** (D14.3). Light mode is supported and shares every token name.
- **Clean and calm** (D14.4, D14.5): data is always visible but quiet, medium density, **one emphasis per card**.
- **One accent** (D14.7). `primary` (orange) is the only "look here" colour: the primary button, the top-pick border, the captain badge, the focus ring. Never a second accent.
- **Semantic colours mean one thing.** `positive` = gain or easy, `negative` = loss or hard, `pending` = not settled yet, `warning` = needs attention. `primary` never sits next to `positive` in one component (D14.8).
- **Fixture difficulty** (D14.8): green = easy, red = hard, using `fdr-2` to `fdr-5`. Always print the difficulty number inside the chip; colour alone fails colour-blind users.
- **Surfaces stack** `background` → `card` (surface-1) → `secondary` (surface-2). Borders, not shadows.
- **Avoided** (D14.10): green, blue or red accents; Premier League purple and pink; FPL's mint green; Material defaults.

## Motion (D14.4)

Subtle and continuous, never loud: numbers count up, cards enter in sequence, receipts "settle," and a shimmer runs while the agent works. Every animation has a `prefers-reduced-motion` fallback with no movement. No motion tokens yet; timings will be set with the components.

## Iconography

Simple outline icons with a 1.5–2px stroke in `foreground` or `muted-foreground`. The info button is a circled "i". No emoji, no club crests, no player photos in v0.1.

## Accessibility: pairs to watch

Checked against WCAG 4.5:1 for normal text (3:1 at 24px and up):

| Pair | Ratio | Rule |
|---|---|---|
| `primary` (light, `#C25E00`) on white | 4.29:1 | Fails for small text. Use it for fills, borders and 24px+ text, or use `primary-hover` (`#A85100`, 5.47:1) for small text. **Decision needed.** |
| White on `primary` (dark, `#FF8A1F`) | 2.36:1 | Fails. Text on the orange is `primary-foreground` (`#181818`, 7.5:1). |
| `negative` (dark) on `card` | 3.77:1 | Fails for small text. Put small negative text on `background` (4.79:1), or use 24px+ numbers with a minus sign. |
| `positive` (dark) on `secondary` | 4.31:1 | Fails for small text on surface-2. |
| `pending` (dark) on `secondary` | 3.80:1 | Fails for small text on surface-2. |
| `warning` vs `primary` / `negative` | about 1.3:1 lightness | Can't be told apart by colour. Every warning carries an icon and a text label. |

## Tailwind and shadcn mapping (D11.2, D13.6)

Colour token names match shadcn's CSS variables, so `tokens.css` maps straight onto `--background`, `--primary` and the rest. Three things to know:

- **shadcn's `accent` is a hover background**, not the brand colour. The brand orange is `primary`.
- `--radius` = `radius-md` (10px); cards use `radius-lg`, chips `radius-sm`.
- Extra tokens beyond shadcn (`primary-hover`, `positive`, `negative`, `pending`, `warning`, `fdr-*`, `scrim`) go into `tailwind.config` `theme.extend.colors`.

## Rebuilding in Figma (D13.7, D13.8)

One page, separated by labeled sections. The free plan has no variable modes, so create two variable collections, **Light** and **Dark**, with the same token names in each.
