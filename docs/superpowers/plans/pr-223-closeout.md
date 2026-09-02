# PR 223 closeout

## Global Constraints

- `CLAUDE.md`, `src/domain/CLAUDE.md` and `docs/adrs/0033-order-is-a-global-rank.md` bind.
- `npm run check` must pass whole, exit 0.
- An invariant asserted in a comment gets a test that fails without it, and the test is
  WATCHED failing, for the RIGHT reason.
- 400-line file cap (lint), 450-line cap in `test/`.

## Task 1: a refusal poisons its SIBLING GROUP as well as its focus key

See the brief.
