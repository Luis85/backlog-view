---
type: Task
order: 290
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P3
area: tooling
created: 2026-09-02
closed: 2026-09-02
source: a fallow run over the merged tree, read for what is worth acting on rather than for its total
files:
  - test/helpers/roadmap.ts
  - test/helpers/resources.ts
  - test/harness/perf.ts
started: 2026-09-02
finished: 2026-09-02
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A second fallow pass, and the three findings it was worth acting on

## Evidence

[[One copy of the i18n sweep, not three]] used a fallow run to pick its work. This is the
same instrument re-read on the merged tree, and most of what it reports is not work.

Measured (default config, so `test/**` skipped): **dead files 0.0% (0 of 230), dead exports
0.0% (0 of 962), MI 89.2, 0 above the CRAP threshold, 716 lines (1.0%) duplicated, 21
private type leaks.** With `duplicates.ignoreDefaults` false: **441 clone groups**, against
423 when [[The mount injection was a cast nothing needed]] measured it.

Three findings were worth acting on and the rest were not, which is the point of this note.

## What was done

**The marker fixture was two copies.** `MARKER_OPTIONS`, `markerVault` and `datedAxis` were
byte-identical in `test/view/iterationBars.test.ts` and `test/view/markerLabels.test.ts` —
41 lines, and `iterationBars.test.ts`'s own comment recorded the copy as deliberate: *no
`test/view/*.test.ts` file imports another's fixtures*. **That rule is right and this keeps
it.** A test file still reaches into no other test file; the fixture moved to
`test/helpers/roadmap.ts`, which both files already imported, because a helper is what more
than one suite shares. `MARKER_OPTIONS` stayed file-private there — `datedAxis` is its only
consumer, and fallow failed the gate on it as an unused export, correctly.

Three other files define a `markerVault`, and none of them is a copy: they are different
functions that share a name. Checked before moving, because a rename by grep would have
merged four unrelated fixtures.

**`countingVault` and `absenceVault`** opened with the same four lines — two `Resource`
notes and the epic Alice owns. `rosterVault()` names it once. The reason is the one
`countingVault`'s own comment already gives for itself, turned on its own file: two copies
of one vault are two vaults free to drift.

**`reportPerf` returned a file-private `Row`** — an exported signature naming a type its
caller cannot name. `Row` is exported. That is 1 of the 21 private type leaks; the other 20
are in `src/` and are left, since each is a deliberate options-bag or reader shape and
exporting twenty types to satisfy a report is not a reason.

## What was measured and deliberately NOT done

**The widest cross-file clone groups in `test/` are three-line fixture openings.** One is 7
instances across 7 files, another 6 across 6 — all of them
`new FakeVault()` followed by an Epic and a Feature. Extracting them would couple seven
unrelated suites to one fixture to save two lines each, which is the trade
[[Close the holes the test typecheck cannot see through]] already refused, and
`test/helpers/view.ts` already offers `fixture()` for the suites that want a shared one.
Left, and named here so the next pass does not re-derive it.

**`src/view/mywork/renderTree.ts` and `src/view/release/scopeTree.ts` share 133 lines
across 4 clone groups**, and fallow's own advice is to extract them into a shared
directory. Not done here, for two reasons that needed the register rather than the code.
The plan that built the fifth view
(`docs/superpowers/plans/2026-08-31-assigned-work-in-the-sidebar.md`) *already* extracted
the shareable half — `scopeFolds.ts`, `scopeKeys.ts`, `selection.ts`, `domain/scopeRows.ts`
and `render/badges.ts` are imported by both — so what remains is the row drawing, where the
differences are deliberate and documented at the site: `renderTree.ts` states why it needs
no `!badgeText` guard where `scopeTree.ts` has one, and the two disclosures differ by fold
key and label key. A helper general enough to cover both would thread the fold key, the
label keys, the class names and a guard flag — the *35 casts for 35 helpers* trade this
register has refused twice. **It is `src/` besides**, so it belongs to its own change with
its own live-vault question, not to a test-machinery pass.

The one piece that is genuinely identical is the `click`/`auxclick` activation pair, whose
drag-select guard `renderTree.ts` already attributes to `scopeTree.ts` in a comment. That
is the extraction to make when this is taken up.

## Acceptance criteria

- `npm run check` passes whole, no coverage floor moved: 285 files, 4418 tests.
- Duplication reported by `npm run analyze` falls 716 → 702 lines; private type leaks 21 → 20.
- No `src/` module is touched.

## What is left

1. The 133-line `renderTree`/`scopeTree` clone, above — its own change.
2. The 20 remaining private type leaks in `src/`, each a same-file options bag; a decision
   rather than a sweep, and nobody has asked for it.
3. **Fallow's totals are not a target.** 441 clone groups is not a number to drive down —
   most of it is fixtures that should stay apart. This note exists so the next pass reads
   the report for the two or three findings in it rather than for its total.
