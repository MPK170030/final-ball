# Banner

A one-line status message at the top of a screen: info (grey) or warning (orange-red outline).

## Variants
- **Info** (`fb-banner`): FPL is updating, deadline passed, daily limit reached, sample brief, the fallback reasons (30-second cap, no rank yet, tied group too big). `role="status"`.
- **Warning** (`fb-banner--warning`): only when the manager could lose something by not acting. Always an "!" icon AND the word "Warning" in the text: the `warning` colour can't be told from the accent or `negative` by colour alone. `role="alert"`.

## Rules
- Bold first clause says what happened; the rest says what to do or what still works.
- One banner per screen. Never stack them.
- Not dismissible in v0.1; they reflect state and go away when the state does.

## shadcn
`Alert` with your own `info` and `warning` variants.
