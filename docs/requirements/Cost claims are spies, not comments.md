---
type: PBI
parent: "[[The render path states its costs as checks]]"
order: 10
status: Open
area: testing
created: 2026-08-03
---

# Cost claims are spies, not comments

**As** someone changing the render path, **I want** the two remaining cost claims to fail
the build when I break them, **so that** I find out from `npm run check` rather than from
a backlog that got slow between releases.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever changes rendering, selection or the drag |
| **Trigger** | `npm run check` |
| **Preconditions** | [[The drag cleanup scans the whole tree]] is fixed, so the no-scan claim is true before anything asserts it |
| **Guarantee** | Every cost claim in `src/view/CLAUDE.md` is backed by a check that fails without it. A claim that cannot be checked is removed from the guide rather than left reading as one that is. |

**Main flow**

1. The no-scan claim becomes a **lint rule on the receiver**: `querySelector` and
   `querySelectorAll` are banned **on `treeEl`**, anywhere in `src/view/**`. The tree
   element is what makes a query a scan — every legitimate call in `src/` narrows to
   something smaller first (a row, a column, the toolbar), and the one violation took the
   container.
2. A test renders a several-hundred-row fixture through the existing view harness, spies
   `getOrder` and `getDisplayName` on the harness's fake config, and asserts the call count
   is bounded by the column count rather than growing with the rows.
3. A runtime spy on the tree element's `querySelector`/`querySelectorAll` backs the lint
   rule up across selection, subtree refresh and drag cleanup — as a regression guard for
   the paths that exist, never as the statement of the invariant.
4. `npm run check` passes, and the coverage thresholds move up if the numbers did.

**Extensions**

- **1a — the invariant is enforced by driving a list of paths instead.** That is the defect
  [[The drag cleanup scans the whole tree]] records, committed a second time. Its `Lesson`
  is that *"a category invariant is checked by spying the forbidden call, which every path
  must go through, rather than by enumerating the paths, which is the list that goes
  stale"* — and the first draft of this note then wrote an acceptance criterion naming
  three paths. A later `treeEl.querySelector(...)` in the keyboard, the menu or a card
  interaction never runs during those three, so the spy passes with the invariant gone.
  **The list is not the check.** The region-wide ban is.
- **1b — the ban is scoped to a directory instead.** That was the first answer here and it
  is the wrong boundary. `src/view/interactions/**` is not where interaction code lives:
  `selection.ts` and `backlogView.ts` sit a level up and both handle interaction, and
  `selection.ts:97` already queries — `colEl.querySelector('.pbl-board-col-stop')`, bounded
  and fine. A directory ban would let a full-tree scan added there pass, which is the same
  enumerate-the-places failure one level larger. **The receiver is the invariant; the
  directory is a proxy for it.**
- **1c — the exempt calls have to be enumerated.** They do not, and that is the point of
  the receiver form: `render/rows.ts:75` narrows to a row, `render/toolbar.ts` to the
  toolbar bar, `selection.ts:97` to a column, `backlogView.ts:235` to the toolbar. None
  names `treeEl`, so none needs an exemption and none can be broken by the rule.
  **Measured with a corrected sweep**: `src/` holds **11** `querySelector`/
  `querySelectorAll` calls, not the four an earlier draft reported. That draft grepped
  `querySelector(` and silently missed every `querySelector<HTMLElement>(` — a generic type
  argument between the name and the paren. Recorded because the wrong number was used twice
  to argue this rule's shape, and because it is the same defect as everything else here: a
  claim about a category, checked by a method that could only see part of it.
- **1d — the rule can be defeated by an alias.** It can: `const el = this.els.treeEl;
  el.querySelectorAll(...)` passes any selector keyed on the receiver's name, and if it is
  added on a path the spy does not drive, nothing catches it at all. **This is a stated
  limitation, not a closed hole**, and the guide is written to the shape lint can see
  rather than to the property one would like to have. No lint rule available here
  distinguishes a container from a narrow element in general; an alias-aware rule needs
  type information about the receiver, which is a bigger tool than this invariant is worth.
  The honest position — the one this note has now reached on its third attempt — is that
  the check defines the sentence, never the other way round.
- **1e — the ban is added as a new `files` block.** `eslint.config.mjs` warns about exactly
  this: flat config sets a rule wholesale per file, so a narrower block **replaces** the
  wider one's options rather than adding to them. Adding a region means removing its files
  from the region it came out of and restating every selector that still applies. The file
  says so above `syntaxRules`; ignoring it silently drops the write-boundary and
  menu-anchor rules from whatever region is added.
- **3a — only selection and the subtree refresh are driven by the runtime spy.** It passes
  while `dragDrop.ts` is still scanning, which is a test agreeing with the comment instead
  of checking it. The drag path is the one that was actually broken, so it is the one that
  must be in it.
- **3b — the check asserts on `rowEls` instead of on the calls.** It proves nothing. An
  interaction that swapped `rowEls.get(path)` for `treeEl.querySelector(...)` leaves the
  map the right size and still resolves the right element, so a map-shaped assertion passes
  with the guarantee gone. The check has to watch the call that must not be made.
- **2a — the hoisted lookups are described in the wrong place.** `src/view/CLAUDE.md` says
  `getOrder` and `getDisplayName` live "on `RowContext`". They do not: `chipProps` resolves
  the columns once per data update onto `host.chips`, and `RowContext` carries that
  snapshot. Correct the sentence in the same change, or the test and the guide disagree
  about what is being guaranteed.
- **4a — a claim turns out not to be checkable at all.** Then it comes out of the guide.
  A sentence that reads like a guarantee and is backed by nothing is worse than its
  absence — that is [[A comment that states a rule is not a check]] in one line.

## Acceptance criteria

- `npm run lint` fails on `querySelector`/`querySelectorAll` called on `treeEl` anywhere in
  `src/view/**`, and passes on **every** call that survives the prerequisite fix — none of
   which names `treeEl`, which is the property being relied on rather than a tally. (A
   draft said "all eleven", counted *before* [[The drag cleanup scans the whole tree]]
   removes one of them: a criterion its own precondition made unmeetable.) Verified
  the way this repository verifies its lint rules: by planting the violation and watching
  lint reject it.
- Whatever region the rule is added to keeps the write boundary, the menu-anchor rule and
  the `overBy` rule, checked rather than assumed — flat config replaces a block's options
  rather than merging them.
- **`src/view/CLAUDE.md`'s sentence is narrowed to the shape actually banned**, which is
  narrower again than the previous draft of this criterion. Lint forbids
  **`treeEl.querySelector` / `treeEl.querySelectorAll` written directly**; it does not
  forbid querying the tree element, because `const el = this.els.treeEl;
  el.querySelectorAll(...)` passes, and in an unexercised interaction it escapes the spy
  too. So the guide says: *rows are reached through `rowEls`; a direct
  `treeEl.querySelector*` fails lint; an aliased one is caught only if it is on a path the
  spy drives.* Ugly, and true.

  This is the **third** narrowing of the same sentence in this note's history — first "no
  interaction scans the DOM", then "the tree element is never queried", now the shape lint
  can see. Each earlier version was a guarantee written slightly ahead of its check, which
  is the exact defect this feature exists to remove, committed inside the feature that
  removes it. Recorded so the next person writing this sentence writes the enforced version
  first.
- A runtime spy additionally fails if the tree is scanned during selection, subtree refresh
  or drag cleanup. It is a regression guard for the paths that exist, and the note says so
  rather than presenting it as the invariant.
- A test fails if `getOrder` or `getDisplayName` is called per row rather than per pass.
- Each new test is **watched failing** before the fix or the guard is in place, and the
  failure is the one expected — not a fixture error that would pass for one.
- The two claims already covered by `test/view/rendering.test.ts` gain no duplicate
  assertions.
- `src/view/CLAUDE.md` names `host.chips`/`chipProps` rather than `RowContext` for the
  hoisted lookups.
- No assertion in this work measures elapsed time.

## Where it lives

`test/view/rendering.test.ts` · `test/helpers/view.ts` · `src/view/CLAUDE.md` ·
`src/view/render/columns.ts` · `src/view/selection.ts`
