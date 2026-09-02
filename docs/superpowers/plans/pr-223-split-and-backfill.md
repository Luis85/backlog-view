# Split writePlan.ts, then fix the blank-run bisection

## Global Constraints

- `CLAUDE.md`, `src/domain/CLAUDE.md`, `src/storage/CLAUDE.md`, `src/view/CLAUDE.md` and
  `docs/adrs/0034-order-is-a-global-rank.md` bind.
- `npm run check` whole, foreground, exit 0, at every commit.
- 400 CODE-line cap per `src/` file (`skipBlankLines`, `skipComments`), 450 in `test/`.
- `domain/` stays pure: no DOM, no vault writes, no imports from view/storage/commands.
- An invariant asserted in a comment gets a test that fails without it, WATCHED failing,
  and checked that it fails for the right reason.

## Task 1: split `src/domain/writePlan.ts` — no behaviour change

## Task 2: the backfill allocates a whole blank run, instead of bisecting per row
