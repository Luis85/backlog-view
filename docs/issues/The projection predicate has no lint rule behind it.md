---
type: Issue
order: 190
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P3
area: verification
created: 2026-08-10
source: Task 17 of the test-workflow-and-badge plan — a guide asserted a check that does not exist
files:
  - src/view/projection.ts
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

## Acceptance criteria

None as a gate — this is a recorded gap, not work in flight. It closes when someone
either classifies the call sites the grep finds and adds the lint rule the surviving ones
permit, or decides deliberately that the predicate module's guarantee stays comment-only.
