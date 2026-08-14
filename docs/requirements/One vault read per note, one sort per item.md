---
type: PBI
parent: "[[The model build states its cost as a check]]"
order: 10
status: Done
area: testing
created: 2026-08-03
closed: 2026-08-03
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# One vault read per note, one sort per item

**As** someone adding a phase to `buildModel`, **I want** the two costs a caller can
observe to be counted rather than described, **so that** a rebuild that starts re-reading
the vault or re-sorting the tree fails a command instead of arriving as "the backlog got
slow somewhere after four hundred notes".

## Use case

| | |
| --- | --- |
| **Actor** | Whoever adds or reorders a build phase in `domain/model.ts` |
| **Trigger** | `npm run check` |
| **Preconditions** | None — both properties hold today, so the check lands on a clean file |
| **Guarantee** | The vault is read once per note loaded and every item is sorted exactly once, at any fixture size. What the check cannot reach is stated as prose in `src/domain/CLAUDE.md` rather than left reading as a guarantee. |

**Main flow**

1. A node test builds a model twice, from a small fixture and one an order of magnitude
   larger, and asserts the two fixtures actually differ in size — equalities between two
   identical runs prove nothing.
2. It spies `metadataCache.getFileCache` and asserts the call count equals the item count
   at both sizes. `addItem` holds the only call site in this layer, so a later phase
   reading the cache per item reports n² against n.
3. It spies `Array.prototype.sort`, keeps the calls whose receiver holds items rather than
   strings, and asserts the summed group lengths equal the item count: `sortSiblingsDeep`
   sorts the roots and then each item's children, so every item belongs to exactly one
   sorted group.
4. `src/domain/CLAUDE.md` gains the bound, naming the sort as the one deliberately
   superlinear step and saying which half of the paragraph the test reaches.

**Extensions**

- **1a — the check is a benchmark.** It is not, for the reason
  [[Cost claims are spies, not comments]] gives one layer up: both properties here are
  about calls that must not happen more than once per item, and a timing assertion is the
  kind of check that fails on a loaded CI runner and gets deleted. `domain/` runs in node
  rather than jsdom, so the temptation is stronger here and the answer is the same.
- **2a — the counts are read after the spies are restored.** `mockRestore` resets the
  recorded calls along with the implementation, so both numbers come back as zero — which
  is indistinguishable from the property holding, and is how the first draft of this check
  passed against a build it was not measuring. Capture before restoring.
- **3a — the vocabulary sorts are counted with the sibling groups.**
  `collectObservedStates` and `collectObservedTags` sort too, on strings. They are a
  different quantity — bounded by the vocabulary, not by the items — and folding them in
  makes the sum drift with values nobody is measuring. The receiver is what separates
  them; an empty sibling group has no first element to ask and contributes nothing to the
  sum either way.
- **3b — the sum is asserted against a constant instead of the item count.** A constant is
  a second statement of the fixture size, and the two disagree the moment the fixture
  changes. Both counts are asserted against `model.items.length`, which is the quantity
  the property is actually about.
- **4a — the guide claims the whole bound.** It cannot: a traversal phase that turned
  quadratic without touching the vault again or sorting again is invisible to both spies,
  and nothing observes a walk from outside `buildModel`. The sentence says so, and says
  why building a counter into the phases to close it would be a seam built for the test.
  Writing the wider sentence and leaving it standing is the defect this round is named
  after.

## Acceptance criteria

- A test fails if `getFileCache` is called more than once per note loaded, and fails if
  any item passes through more than one sort — both watched failing against a planted
  break before either is trusted, and the failure is the one expected rather than a
  fixture error that would pass for one.
- Both assertions hold at two fixture sizes an order of magnitude apart, so a per-item
  regression is separable from a constant one.
- `src/domain/CLAUDE.md` states the O(n log n) bound, names `sortSiblingsDeep` as the
  superlinear step, and marks the traversal-linearity claim as unchecked rather than
  presenting it as backed.
- No assertion in this work measures elapsed time.
- `npm run check` passes, and the coverage thresholds move up if the numbers did.

## Where it lives

`src/domain/model.ts` · `test/domain/modelCost.test.ts` · `src/domain/CLAUDE.md`
