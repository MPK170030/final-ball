# TransferCard

One suggested transfer: the weak spot, why that player should go, the top pick to bring in, and 3 ranked alternatives (D2.1, D8.6).

## Order inside the card
1. Head: label "Transfer" (or "Transfer 1 of 2") and the weak-spot tag.
2. **Why sell [player]?** One line on why this is the biggest weakness in the squad.
3. **Out:** name, flag (in `warning`, text not colour alone), meta line, next 3 FixtureChips.
4. **Top pick · In:** the card's single emphasis, an orange (`primary`) border. Name in `heading` size, meta, chips, bank after the move in mono.
5. Reason: one line about the replacement only.
6. **Why?** opens the DetailSheet on the Why tab.
7. "3 alternatives": ranked 2–4 with price, meta, one-line reason and small chips.

## Variants
- **Save your transfer:** the emphasis block reads "Agent's pick · Save your transfer" with "You'll have 2 free transfers in GW 10"; the best transfer option sits below the divider instead of alternatives (D2.2).
- **Two free transfers:** two cards, "Transfer 1 of 2" and "2 of 2" (D2.3).
- **Selected** (`fb-card--selected`): desktop only, while its details are open in the side panel.

## Motion
Cards enter in sequence with `fb-enter` (8px rise, 60ms stagger). Off with reduced motion.

## Consumer provides
All data from the brief: names, clubs, prices, form, flags, fixtures with difficulty, bank figure, reasons, alternatives (exactly 3).
