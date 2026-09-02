---
type: Task
order: 390
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: verification
created: 2026-09-02
closed: 2026-09-02
source: the residual of [[The projection predicate has no lint rule behind it]]
files:
  - test/verification/banRegions.test.ts
  - eslint.config.mjs
  - src/storage/CLAUDE.md
  - src/view/CLAUDE.md
started: 2026-09-02
finished: 2026-09-02
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A ban spread by hand is a ban one block can drop

## Evidence

[[The projection predicate has no lint rule behind it]] closed with one thing left, and
it is this register's own named failure mode wearing a new hat: **two flat-config blocks
matching one file OVERRIDE `no-restricted-syntax` rather than merging it.** So every
region in `eslint.config.mjs` spreads `WRITE_BOUNDARY` and `PROJECTION_TREE` in by hand,
and a block added without a spread loses that ban without producing anything — no error,
no warning, no row on a page. `src/storage/` had already lost `PROJECTION_TREE` that way,
and what caught it was a probe file planted by hand during that PR, not anything
committed.

That is the same shape as [[A gate that did not run looks like one that passed]]: an
absent check is indistinguishable from a passing one. A missing ban has no output to
notice.

## The instrument

**ESLint's own config resolution — `calculateConfigForFile`, per file — not a walk over
the config's text.** The walk that found the `storage/` hole pairs each `syntaxRules(`
call with the `files:` above it; it can only see the blocks that exist, and it answers a
question about the SOURCE where the defect is in the RESULT. Resolution answers what the
linter would actually apply to a path, after every block, every `ignores` and the override
semantics above, so it also sees the two shapes the walk cannot:

- a region carved out of a wider block and given no block of its own, which matches
  nothing at all — the hole `MANUAL`'s comment says was verified by hand in 2026-08-21 by
  planting `menu.showAtMouseEvent` and watching lint pass;
- a later block silently replacing an earlier one's whole list.

Measured on the merged tree at `b2907c3`, over 177 `.ts` files under `src/`: exactly
fourteen resolve to a set missing one of the two bans, and every one of them is a
documented exemption — thirteen files in `src/storage/` missing `WRITE_BOUNDARY` (that
directory IS the write boundary), and `src/view/projection.ts` missing `PROJECTION_TREE`
(it owns the predicate the ban points at). Nothing else. The count in the closed note's
walk — "exactly one block without the ban" — was about blocks and is still true; this is
the same fact counted in files, which is the unit the defect is in.

### Enumerated: what this instrument itself could miss

- **A ban that is present everywhere and blind to a spelling.** `host?.projection` walked
  past `PROJECTION_TREE` for a day inside the PR that added it. Resolution sees the
  selector is THERE; nothing about the config can see what it matches. The check is over
  the spread, and the guides now say so at that width.
- **The other selectors in this file.** `MENU_ANCHOR`, `OVERBY`, `TREE_SCAN`,
  `ALL_TYPES_IMPORT`, the three text bans and the rest are per-region by design — some
  regions are meant to drop them. There is no rule to check them against, so they are out
  of scope rather than overlooked.
- **A file `src/` does not contain.** The walk is `src/**/*.ts`; a ban lost for `test/` or
  `scripts/` is invisible here, and neither carries these two bans today.
- **A rule turned off by an inline disable comment.** Resolution reads the config, not the
  source. Two such disables exist for `UI_TEXT_PROPERTY`; none for either ban here.

## What changed

`test/verification/banRegions.test.ts`, three assertions:

1. **Every file in `src/` resolves to a set carrying both bans, except where an exemption
   says otherwise.** The exemptions are PREDICATES, not a file list — `src/storage/`, and
   `src/view/projection.ts` — so a new file in `storage/` inherits the exemption and a new
   file anywhere else does not.
2. **Each exemption still has a file behind it.** An exemption whose reason has gone is a
   hole standing open for whatever lands in that directory next.
3. **The instrument, tested on a known input in the reject direction.** One appended
   config block matching `src/view/render/**`, carrying a `no-restricted-syntax` of its
   own — which is the accident itself, staged rather than described — and the checker is
   asserted to name those files and only those. The override semantics were confirmed
   directly before the test was written: the appended block leaves `board.ts` with one
   selector where it had twenty.

`WRITE_BOUNDARY` and `PROJECTION_TREE` are `export const` now, so the test compares
against the selectors the config actually spreads rather than against a copy of them.
ESLint reads the default export and is unaffected.

### Watched failing

Both directions, on the real config rather than on a fixture:

- Deleted `...PROJECTION_TREE` from the `COLUMNS` block — assertion 1 red, naming
  `src/view/render/columns.ts: PROJECTION_TREE`. Restored, green.
- Added `...WRITE_BOUNDARY` to the `STORAGE` block, retiring that exemption — assertion 2
  red (`['PROJECTION_TREE']` against `['PROJECTION_TREE', 'WRITE_BOUNDARY']`). Restored,
  green.

## What was refused

**A lint rule over `eslint.config.mjs` itself, or a `scripts/` gate.** Both were
considered and neither is better than a test: the config is one file with one shape, the
question is answered by an API call rather than by a parse, and `npm run check` already
runs the suite. A gate of its own would be an eighth step for three assertions.

**Checking that each region names the selectors it SHOULD have, ban by ban.** That needs a
table of region-to-selector, which is the shape this register has already decided goes
stale — [[The projection predicate has no lint rule behind it]] refused an exemption list
for the same reason. Only the two bans that hold across `src/` have a rule to check.

**Widening the walk past `src/`.** `test/` and `scripts/` carry neither ban, so there is
nothing to assert; asserting their absence would pin a fact nobody decided.

## What is left

Nothing here. The residual named in
[[The projection predicate has no lint rule behind it]] is closed: the spread is checked,
and the guides in `src/view/` and `src/storage/`
state the check at the width it reaches rather than at the width of the rule it protects.
