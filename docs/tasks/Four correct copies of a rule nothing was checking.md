---
type: Task
order: 350
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P3
area: verification
created: 2026-09-02
closed: 2026-09-02
source: a clone group in npm run analyze, which turned out to be the smaller half
files:
  - src/storage/viewStateStore.ts
  - test/storage/viewStateSafety.test.ts
started: 2026-09-02
finished: 2026-09-02
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Four correct copies of a rule nothing was checking

## Evidence

`npm run analyze` reported a six-line clone between `mywork/myWorkView.ts` and
`release/releaseView.ts` — each view persisting its pick. Six lines is not a finding worth
a change on its own, and [[The second scope tree was a copy, and stayed one]] declined
larger ones for less reason.

**What made it one is what the six lines are.** Reading every `saveViewState` caller found
FOUR spelling out the same read-modify-write:

```ts
const state = loadViewState(app, id);
saveViewState(app, id, { ...state, prefs: { ...state.prefs, someKey: value } });
```

`saveViewState` writes the WHOLE snapshot. The two spreads are the only thing stopping a
pick from erasing every other preference this view has stored and the folds beside them —
and dropping either is a loss the caller cannot see, because the value it set is there and
only what it did not name is gone. A release pick would forget the reader's zoom, density,
column widths and every collapsed row.

## Nothing was checking it, and that is the actual finding

Measured rather than assumed, the way the root guide's own rule asks: **the `...state.prefs`
spread was deleted and the whole suite stayed green** — 295 files, 4628 tests, no failure.
The outer spread is the same story one line up.

So this was not four copies of a rule with a check under it. It was four copies of a rule
with nothing under it at all, correct only because four people in a row happened to write
it correctly, and a fifth caller — the next view with a pick to remember — had nothing to
fail against.

## Approach

`updateViewPrefs(app, id, patch)` in `storage/viewStateStore.ts`, beside `loadViewState`
and `saveViewState` where the snapshot rule already lives. Three parameters and four
callers, each now one line.

`folds` is deliberately NOT given the same helper: a fold write is a whole map by nature
(`scopeFolds.ts`'s collapse-all writes every path at once), so a patch function there would
carry no rule anybody could otherwise miss. This one carries one.

**What it does not do is make a fifth caller use it.** There is no lint rule banning a
hand-built `saveViewState` snapshot, and one would have to allow the two legitimate whole-
snapshot writers. So the guarantee is narrower than "every pref change is safe": the four
that exist go through one function, and breaking the rule inside that function now fails.
Written that way in `src/storage/CLAUDE.md` too, rather than as the wider sentence.

## Acceptance criteria

- Three cases in `test/storage/viewStateSafety.test.ts`, and each spread **watched
  failing separately**: deleting `...state.prefs` fails "leaves the other preferences
  alone" and "removes a preference set to undefined"; replacing `...state` with empty folds
  fails "leaves the folds alone". Restored, green.
- `npm run check` passes whole: 295 files, 4631 tests, no coverage floor moved.
- Duplication reported by `npm run analyze`: **544 → 532 lines**.

## Outcome

The clone is gone, which was the smaller half. The larger half is that a data-loss rule
carried in four places now exists in one and has a check under it.

## What is left

The `myWorkView.ts`/`releaseView.ts` clone family still reports its other group (the write
gate's construction, 34 lines), and the estimation view is a third instance of that same
constructor shape. Not taken here: what varies between the three is the gate's own
predicates and its writer, so sharing them means a function whose body is its arguments —
the reason the scope trees' disclosure was left copied. Re-measure before deciding
otherwise; there is no data-loss rule hiding in that one.
