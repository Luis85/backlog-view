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

1. The no-scan claim becomes a **lint rule**, because it is categorical: `querySelector`
   and `querySelectorAll` are banned outright inside `src/view/interactions/**`, the region
   whose whole job is to reach elements through `rowEls` and the host rather than by
   searching for them. A rule over the region holds for every interaction, including the
   ones not written yet.
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
- **1b — a legitimate scan exists inside the banned region.** Then it is narrow and
  scoped, and gets a named exemption with its reason — never a suppression comment, for
  the reason `.fallowrc.json` declares framework-invoked members instead of hiding them.
  Measured before proposing the ban: once the tree scan is fixed, `src/view/interactions/`
  contains **no** `querySelector` call at all, so the rule lands on a clean region. The
  remaining two in `src/` are legitimate and outside it — `render/rows.ts:75` searches
  within a single row, `render/toolbar.ts:129,150` search the toolbar.
- **1c — the ban is added as a new `files` block.** `eslint.config.mjs` warns about exactly
  this: flat config sets a rule wholesale per file, so a narrower block **replaces** the
  wider one's options rather than adding to them. Adding a region means removing its files
  from the region it came out of and restating every selector that still applies. The file
  says so above `syntaxRules`; adding this ban without reading that note silently drops the
  write-boundary and menu-anchor rules from `view/interactions/`.
- **1d — the rule is spelled against the receiver.** A selector matching
  `treeEl.querySelector(...)` catches today's shape and misses
  `const el = this.els.treeEl; el.querySelector(...)`. The region ban does not care how the
  receiver is spelled, which is why it is the form chosen. Stated because the receiver-shaped
  rule is the obvious one and it is weaker.
- **3a — only selection and the subtree refresh are driven by the runtime spy.** It passes
  while `dragDrop.ts` is still scanning, which is a test agreeing with the comment instead
  of checking it. The drag path is the one that was actually broken, so it is the one that
  must be in it.
- **2b — the check asserts on `rowEls` instead of on the calls.** It proves nothing. An
  interaction that swapped `rowEls.get(path)` for `treeEl.querySelector(...)` leaves the
  map the right size and still resolves the right element, so a map-shaped assertion passes
  with the guarantee gone. The check has to watch the call that must not be made.
- **3a — the hoisted lookups are described in the wrong place.** `src/view/CLAUDE.md` says
  `getOrder` and `getDisplayName` live "on `RowContext`". They do not: `chipProps` resolves
  the columns once per data update onto `host.chips`, and `RowContext` carries that
  snapshot. Correct the sentence in the same change, or the test and the guide disagree
  about what is being guaranteed.
- **4a — a claim turns out not to be checkable at all.** Then it comes out of the guide.
  A sentence that reads like a guarantee and is backed by nothing is worse than its
  absence — that is [[A comment that states a rule is not a check]] in one line.

## Acceptance criteria

- `npm run lint` fails on any `querySelector`/`querySelectorAll` inside
  `src/view/interactions/**` — the categorical statement, holding for interactions that do
  not exist yet. Verified the way this repository verifies its lint rules: by planting the
  violation and watching lint reject it.
- Adding that region leaves `src/view/interactions/**` still subject to the write boundary,
  the menu-anchor rule and the `overBy` rule, checked rather than assumed — flat config
  replaces a block's options rather than merging them.
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
