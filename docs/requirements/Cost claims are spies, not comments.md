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

1. A test renders a several-hundred-row fixture through the existing view harness.
2. It spies `querySelector` and `querySelectorAll` on the tree element, drives selection, a
   subtree refresh **and a drag cleanup**, and asserts neither was called.
3. It spies `getOrder` and `getDisplayName` on the harness's fake config, renders, and
   asserts the call count is bounded by the column count rather than growing with the rows.
4. `npm run check` passes, and the coverage thresholds move up if the numbers did.

**Extensions**

- **2a — only selection and the subtree refresh are driven.** The test passes while
  `dragDrop.ts` is still scanning, which is a test agreeing with the comment instead of
  checking it. The drag path is the one that was actually broken, so it is the one that
  must be in the test.
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

- A test fails if any interaction reaches for `querySelector`/`querySelectorAll` on the
  tree during selection, subtree refresh or drag cleanup.
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
