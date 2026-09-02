---
type: Issue
order: 190
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P3
area: verification
created: 2026-08-10
closed: 2026-09-02
source: Task 17 of the test-workflow-and-badge plan — a guide asserted a check that does not exist
files:
  - src/view/projection.ts
  - src/view/CLAUDE.md
  - docs/requirements/A projection for the tests.md
  - src/view/render/emptyStates.ts
  - src/view/render/projections.ts
  - src/view/render/toolbarStatus.ts
  - src/view/render/toolbarControls.ts
  - src/view/render/toolbar.ts
  - src/view/render/legend.ts
  - src/view/interactions/keyboard.ts
  - src/view/interactions/plan.ts
  - src/view/interactions/menu.ts
  - src/view/backlogView.ts
  - eslint.config.mjs
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The projection predicate has no lint rule behind it

## The claim

Two guides stated the same claim, describing `view/projection.ts`'s `treeShaped`,
`hidesCompleted`, `filterScopeFor`, `projectionPopulation`, `projectionMember`,
`rowVocabulary` and `offerableTypes`: **"a lint rule forbids a bare
`projection === 'tree'` outside it."** No such rule exists.

`src/view/CLAUDE.md` stated it. So did
`docs/requirements/A projection for the tests.md`, in its `## Where it lives` section —
the highest-authority copy, since `docs-check.mjs` rule 7 makes that section the
specification `src/view/projection.ts` is checked against for having a note that
describes it at all. A brief naming only the first file missed the second on its first
pass; both are corrected now.

## How it was verified

Three separate checks, run a third time for this note on top of two independent prior
verifications:

1. `grep -rn "no-restricted-syntax" -A 40 eslint.config.mjs | grep -in "projection"` —
   nothing. Every `no-restricted-syntax` entry in `eslint.config.mjs` was read; none
   mentions `projection`.
2. A throwaway file under `src/view/` containing exactly
   `export function probe(projection: string): boolean { return projection === 'tree'; }`
   was linted with `npx eslint` and passed with exit code 0, then deleted.
3. `grep -rn "projection === '" src/ | grep -v "src/view/projection.ts"` found ten
   files already comparing directly: `src/view/render/emptyStates.ts`,
   `src/view/render/projections.ts`, `src/view/render/toolbarStatus.ts`,
   `src/view/render/toolbarControls.ts`, `src/view/render/toolbar.ts`,
   `src/view/render/legend.ts`, `src/view/interactions/keyboard.ts`,
   `src/view/interactions/plan.ts`, `src/view/interactions/menu.ts` and
   `src/view/backlogView.ts`.

## Why it mattered enough to fix rather than delete

The sentence was load-bearing, not decorative. `src/view/CLAUDE.md` used it to argue
that `view/projection.ts` holds "for a gate nobody has written yet rather than merely
existing beside the ones that do" — the whole reason a reader is told to trust
`treeShaped`/`hidesCompleted` over comparing projection names by hand. Deleting the
sentence outright would have deleted that argument along with it. The guide now states
what actually holds: the module exists so "tree-shaped" is one question asked in one
place, nothing enforces that mechanically, and the ten call sites above are the
evidence the gap is real rather than theoretical.

## The count is a record of 2026-08-10, and it has moved

Kept as measured rather than rewritten, with one thing to know before quoting it: the same
grep finds more files now, and the set is not a superset. `src/view/childrenList.ts` was
created after this note and carried a comparison this list never counted; that one went
again on 2026-08-17 when `horizonBoardShowing` became `menusListChildren` in
`src/view/projection.ts` — the only one of these ever paid off, and by a move rather than
by a rule. `filterScopeFor` in `## The claim` above went with the quick filter the same
day, and three predicates have joined the module since. Re-run the grep before acting on
the number; what does not change is the open question below.

## The open question

Which of those comparisons are legitimate dispatch and which are the drift the
predicate module was built to stop. At least one is clearly the former —
`renderProjectionContent`'s if-chain in `render/projections.ts` is a dispatch on the
projection by design, not a stand-in for one of the named predicates. Sorting the rest,
and deciding whether a `no-restricted-syntax` rule (with call sites it must not break) is worth
adding once they're sorted, is real work with a real product question in it and is not
answered here.

## Answered, 2026-09-02 — the rule fits, at one literal

### The instrument, and why the grep above is not it

Every count on this page was a `grep -rn "projection === '"`, and that grep is wrong in
both directions. It reads comments (`src/view/CLAUDE.md`'s own sentence, and
`toolbarControls.ts`'s "`treeShaped`, never `=== 'tree'`" — a comment counted as the
defect it warns against), and it reads any identifier at all, so
`viewState.ts`'s `sort === 'tree'` and `viewStateController.ts`'s `mode === 'board'` — a
shelf sort and a saved mode, neither of them a projection — came back as hits.

The instrument used here PARSES. ESLint itself, with the selector under measurement passed
on the command line, over `src/`:

```text
npx eslint src --rule '{"no-restricted-syntax":["error",
  {"selector":"BinaryExpression[operator=/^[!=]==$/][left.name='projection'][right.type='Literal']","message":"HIT-bare"},
  {"selector":"BinaryExpression[operator=/^[!=]==$/][left.property.name='projection'][right.type='Literal']","message":"HIT-member"}]}' -f json
```

**Tested on a known input first**, per this register's own rule about instruments. A
planted `src/view/__probe.ts` whose one line read
`return projection === 'tree' || sort === 'tree' || host.projection === 'tree';` reported
exactly two hits, at the two columns of the projection comparisons, and nothing at the
`sort` one — so the selector distinguishes the two shapes the grep could not.

### The classification

54 comparisons of a projection against a string literal in `src/`, 20 of them inside
`src/view/projection.ts` and 34 outside it, sorted by the literal on the right:

- **`'tree'`, outside the module: zero.** The condition the guides' sentence described
  already held; only the rule was missing. There was nothing to grandfather and no
  exemption list to write.
- **`'catalog'`, outside the module: two** — `render/emptyStates.ts` routing to
  `renderCatalogEmptyState`, and `render/projections.ts` routing to the catalog's own
  content. Both dispatch.
- **Everything else — `'board'`, `'roadmap'`, `'deliverables'`, `'iteration'`: 32**, in
  `backlogView.ts` (4), `render/projections.ts` (8 of its 9), `interactions/keyboard.ts`
  (4), `render/toolbarControls.ts` and `render/toolbarStatus.ts` (3 each),
  `interactions/plan.ts` and `viewStateController.ts` (2 each), and one apiece in
  `renderPass.ts`, `resize.ts`,
  `interactions/labels.ts`, `interactions/menu.ts`, `render/legend.ts` and
  `render/toolbar.ts`. Every one asks
  what ONE projection does — which population does the Deliverables board count, does the
  roadmap draw a grid, which content function draws this. That is not a question any
  predicate in the module answers, and banning it would need an exemption list per call
  site, which is the table this register says goes stale.

### What was added

`PROJECTION_TREE` in `eslint.config.mjs`: two `no-restricted-syntax` selectors, one per
operand order, matching an `===`/`!==` whose other side is `projection`, `<x>.projection`
or `<x>?.projection` and whose literal is `'tree'`. It is spread into every
`no-restricted-syntax` block in the file except `src/view/projection.ts`'s own.

**The optional-chain term is a correction, not a completeness flourish.** The rule shipped
in review with two terms per selector and `host?.projection === 'tree'` linted CLEAN —
typescript-eslint wraps an optional member access in a `ChainExpression`, so
`left.property.name` reads nothing through it, and an ordinary property-access spelling
bypassed the whole invariant. Found by Codex on PR #252, verified by planting that exact
line and watching lint pass, then watching it fail once `[left.expression.property.name]`
was added. This is the register's own lesson in its narrowest form: a selector is an
instrument, and an instrument that was only ever pointed at the spelling its author had in
mind reports clean about the one they did not. The probe file now carries five spellings
(bare, `.`, `?.`, a deeper `a?.b.projection`, the reversed literal) and two negatives
(`sort === 'tree'`, `host?.projection === 'board'`); the run reports 5 and 0.

### What it does not reach, stated at the width of the check

- **A `switch (projection)` with a `case 'tree'`**, and **a projection copied into a
  differently named local first.** Neither exists today; neither would be caught. Both are
  named here rather than fixed, and after the `ChainExpression` miss above that is a
  deliberate line rather than an oversight: a `switch` is a different node type worth a
  term the day one appears, and a renamed local is not reachable by a syntactic selector at
  all. The
  sentence in `src/view/CLAUDE.md` and in `docs/requirements/A projection for the tests.md`
  is now "no bare `projection === 'tree'`", not "nothing compares to `'tree'`".
- **A new config block.** Two flat-config blocks matching one file OVERRIDE
  `no-restricted-syntax` rather than merging — the file says so itself — so a block added
  under `src/` without `...PROJECTION_TREE` silently loses the ban. That is the same cost
  `WRITE_BOUNDARY` has always carried, not a new one, and it is why `src/storage/` had to
  be added by hand: that directory carries no `WRITE_BOUNDARY` (it IS the write boundary),
  so the mechanical pass that followed the spread skipped it and the probe below caught it.

### The evidence it is live

- Probes planted at `src/{domain,ui,storage}/__probe.ts` and
  `src/view{,/render,/interactions,/estimation,/manual}/__probe.ts`, one line each, all
  eight reported by `npx eslint src`, all deleted. The `storage` one was silent on the
  first run and red on the second — that is the hole above, found and closed.
- A walk over `eslint.config.mjs` pairing each `syntaxRules(` block with the `files:` above
  it reports exactly one block without the ban: `files: ['src/view/projection.ts']`.
- `npx eslint src` is clean with the rule on, and `src/view/projection.ts`'s own 20
  comparisons — one of them the `=== 'tree'` in `treeShaped` itself — prove the exemption
  on real code rather than on a plant.

## What was refused

**Banning `'catalog'` too, and banning the other four literals.** Both would need an
exemption list naming the dispatch sites — which is the shape this register has already
decided goes stale — and neither has the failure mode `'tree'` has: `treeShaped` is
`'tree' || 'catalog'`, so only the `'tree'` half can silently exclude the other. Recorded
as a measured refusal rather than as work left.

## Acceptance criteria

- ~~Classify the call sites and add the lint rule the survivors permit, or decide the
  guarantee stays comment-only.~~ Classified above; the rule is added at one literal and
  the two guides are narrowed to what it reaches.
