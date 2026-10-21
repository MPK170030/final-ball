# DetailSheet

The one place reasoning lives: a surface with two tabs, **Why** and **How the agent decided** (D8.7).

## Behaviour
- **Mobile:** bottom sheet (`fb-sheet`) over a `scrim`, about 80% of the screen tall, drag handle, close button. "Why?" opens it on the Why tab; "How the agent decided" opens it on the trace tab.
- **Desktop:** side panel (`fb-sheet--panel`) beside the cards, about 400px wide; the card it describes gets `fb-card--selected`. No scrim; the brief stays usable.
- Tabs: the selected tab has an orange underline and `aria-selected="true"`. Arrow keys move between tabs.
- Focus moves into the sheet on open and back to the trigger on close; Esc closes.

## Why tab (D8.6)
1. **Why sell [player]:** the ranking sentence, then the player and the next 2 weakest as rank rows (first row outlined in `foreground`).
2. **Why [top pick]:** Form, Next 3 fixtures, Price, Risks.

## Trace tab
"Whole brief · GW 9 · version 1", then TraceSteps in order.

## Motion
Sheet slides up 240ms ease-out; panel slides in from the right. Reduced motion: appear without movement.

## shadcn
Mobile: `Sheet side="bottom"` (Radix Dialog). Avoid shadcn's `Drawer` for now: it is built on Vaul, which its author has marked unmaintained. Desktop: a plain panel (not a modal) with `Tabs`.
