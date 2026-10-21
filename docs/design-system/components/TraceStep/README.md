# TraceStep

One numbered step of the agent's trace, in plain language; replans are marked so they stand out (D8.4).

## Variants
- **Step** (`fb-step`): number in mono, a short title, one or two sentences of detail.
- **Replan** (`fb-step--replan`): dashed orange border and the prefix "Replan ·" added by CSS. Used when a candidate broke a rule (budget, 3-per-club, position) and the agent re-ranked. This is the portfolio moment: keep the text concrete (who, which rule, what happened next).

## Rules
- Render as an ordered list (`<ol>`), one `<li>` per step.
- Titles are verbs in the past tense: "Loaded your squad", "Found weak spots".
- No model jargon (tokens, prompts, temperatures) in v0.1.
