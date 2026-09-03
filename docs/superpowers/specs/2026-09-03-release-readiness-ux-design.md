# Release readiness: no red state without a remedy

Design, 2026-09-03. Source: user request — "the whole estimations and capacity feature is
hard to grasp and not intuitive to use, I just have red errors but no idea on how to get rid
of them in a release. I want to invest in ux/ui here and make it also possible to set values
on the items to tackle all the warnings."

## The problem, stated from the screen

One release's scope screen reports its readiness in three chips and a summary strip. Both
are correct and both are dead ends:

- The strip can emit eight sibling spans of jargon —
  `52.1 of 40 pts committed (130%, 12.1 over)`, `Capacity is not configured`, `No unit`,
  `2 unestimated`, `2 double counted` — with no visual hierarchy between a measurement and
  a configuration refusal.
- Every red state names a fact and offers no action. `Capacity is not configured` does not
  bind the option. `Capacity is unreadable` does not open the note. `Estimated · 3 of 8
  outstanding` does not say *which* three.
- A member's effort and risk — the two values that clear two of the three criteria — are
  editable only on the backlog view, one pane over, on a screen that does not know which
  release you were looking at.

The counts and predicates are not the problem: `domain/releaseReadiness.ts` computes every
figure in one walk and is the single source for each. What is missing is a route from a red
state to the edit that clears it.

## Scope

Four slices, each shippable alone, in this order:

1. Config red states become one-press fixes.
2. The capacity comparison becomes a bar.
3. Effort and risk chips on member rows.
4. Readiness chips drill down to the failing rows.

Out of scope: the estimation view (`product-estimation`) and its scoring model; the blocked
criterion's dependency links (see §3, *What has no chip*).

## 1. No red state without a remedy

Every `.pbl-rel-unreadable` note on the scope screen becomes a `<button>` where a remedy
exists, keeping its text and gaining an action.

| Red state | Press does |
| --- | --- |
| `estimateProperty` / `capacityProperty` / `riskProperty` / `dependsOnProperty` unbound | binds **that one option** to its suggested key |
| Capacity bound and absent | number dialog on the release note |
| Capacity unit unset | text dialog writing the `.base` option |
| Critical / addressed risk values unset | one dialog writing both lists |
| Any figure unreadable | opens the note holding the bad value |

**Where it lives.** A new `src/view/release/readinessFix.ts` owns the mapping from a red
state to its remedy and draws the button; `renderReadiness.ts` calls it in place of each
bare `note()` span. The dialogs themselves are the two mechanisms this view already has:
`releaseEdits.ts` for a write to the release note, and `init.ts`'s value-candidate sweep for
a write to the `.base`.

**Binding one option, not all of them.** `runReleaseInit` binds every adoptable candidate.
The fix button must bind only the option the sentence beside it names, or a press would
report having changed something the reader was not looking at — the exact narrowing
`renderReleaseInit`'s `fixes` parameter already makes for the empty state's ✨. So
`runReleaseInit` takes an optional candidate filter, and both callers pass one.

**The unit is not guessed twice.** `RELEASE_SUGGESTED_VALUES` already defaults
`capacityUnit` to `points` on a ✨ press. The unit dialog is for changing it, so it opens
holding the current value rather than empty.

**The vocabulary dialog writes two options in one press.** `criticalRiskValues` and
`addressedRiskValues` are both required for the risk criterion — either one empty leaves it
unconfigured — so one dialog with two fields, and a press writes both or neither. Its
placeholders are the vault's own observed risk values where the base returned any.

## 2. The capacity comparison becomes a bar

`drawCapacityFigures` keeps every state it has and changes only how the *comparable* one is
drawn: where the commitment and the capacity are both readable numbers and a unit is set, a
second bar under the progress bar, filled to `min(100, pct)`, carrying an over-capacity
class past 100% — and one sentence beside it: `40 of 52 pts committed · 12 left`, or
`· 12 over`.

**No arithmetic moves.** The difference is still `exactDifference` over
`estimatedEffortExact`, rounded once at the end, and the percentage is still divided before
multiplying. This slice is presentation only; `domain/` is untouched. The three states with
no two numbers to compare (zero capacity, an overflowed ratio, a commitment with no
capacity) keep their text and gain §1's button where one applies.

**The bar is `.pbl-rel-bar`'s own vocabulary**, the progress bar the strip already draws,
with one new modifier class for the over-capacity fill. Not a new component.

## 3. Effort and risk chips on member rows

Each member row of the scope tree draws, at its end beside the state chip:

- an **Effort** chip where `estimateKey` is bound — the value, or dashed and reading
  `Effort` when unset;
- a **Risk** chip where `riskKey` is bound *and* there is a value to offer — the value, or
  dashed and reading `Risk`.

Both are `tabindex="-1"` buttons, the tree's own answer for a per-row control (`src/view/
CLAUDE.md`, Controls), so the tree stays one tab stop.

**A context row draws neither.** An `outsideFilter`-shaped row on this screen is a
non-member ancestor: it renders, it parents, and that is all. The gate's whole-batch refusal
is the structural backstop behind that, not a substitute for it.

**Effort takes a number, judged by the reader that counts it.** The prompt accepts a value
`estimateValue` (already exported from `domain/releaseReadiness.ts`) reads as a finite
non-negative number, and an empty box clears the key. `5 pts` and `TBD` are refused at the
dialog with the reason, because the criterion beside them refuses them too — a value the
strip will not sum must not be accepted by the control that fills it.

**Risk offers what this view can name.** This view declares no general risk vocabulary —
only `criticalRiskValues` and `addressedRiskValues`, each of which may be empty — so the menu
is the union of those two, the values the members themselves carry, and the item's own value
so the current one always renders checked. A Clear foot gated on the key's presence. With
that union empty there is nothing to offer and no chip is drawn; §1's vocabulary dialog is
the way out of that state. The checkmark is asked of the
plan — an entry is checked exactly when picking it would write nothing — never a comparison
written beside the plan.

**One move, two inputs.** The chip and a new pair of row-menu entries (`Set effort`,
`Set risk`, joining `New <child>` in `scopeCreate.ts`'s menu) both call one host method per
field. The menu entries are not garnish: the tree is one tab stop and a `tabindex="-1"` chip
has no keyboard path without them.

**What has no chip.** The blocked criterion reads a link list. A dependency is not a value
you type, and a half-editor for links is worse than none, so blocked is served by §4's
drill-down alone: it lists the blocked rows, and opening one is a click.

**The boundary this changes, deliberately.** `test/view/releaseNeverEdits.test.ts` currently
claims: this view creates notes and its own config, edits the release note it is showing,
and writes nothing else. It narrows once more to *…and a member's readiness values*. The
test's docblock, `releaseView.ts`'s own header and
`docs/requirements/Answering the readiness checklist.md` are all rewritten to say so. What
stays banned is everything else: no hierarchy, no state, no placement, no rank — those are
the backlog view's, and `applyWrites`/`applyRestores` stay refused in this directory.

**Where the writes are planned.** `domain/releaseWritePlan.ts` gains `memberEffortWrites`
and `memberRiskWrites` beside the release's own three planners, applied through
`applyPropertyWrites` on the view's existing gate. Both keep the rule the release planners
already keep: a pick that would change nothing plans nothing.

## 4. Readiness chips drill down

Each readiness chip becomes a `<button>`. Pressing an unsatisfied one narrows the scope tree
to the rows failing that criterion, with their ancestors drawn as context; the chip renders
pressed, and the scope toolbar draws a clear control. Pressing it again, or the clear,
restores the whole tree.

**The list and the count are one walk.** `ReleaseCriterion` gains
`outstandingPaths: string[] | null` — null exactly where `outstanding` is null — filled by
the same loop, from the same predicate, that produced the count. A second pass that
recomputed which members fail is the drift `domain/releaseReadiness.ts` exists to prevent.

**The filter is session state**, a plain field on `ReleaseView` that re-renders — never the
view-state store and never the `.base`. Opening a release must not restore a narrowing
nobody remembers asking for, which is the shelf search's own rule.

**Hide-done yields to it.** While a criterion filter is active the hide-done flag is not
applied: a finished row can be outstanding on a criterion, and hiding the row you are being
asked to fix is the dead end this whole design is about. The preference itself is untouched
— only its effect pauses.

**A satisfied filter clears itself.** After the write that fixes the last outstanding row,
the criterion has no failing members. The render drops the filter and draws the whole tree
rather than an empty one. That is also what makes the loop legible: work the list to zero
and the screen hands you back the release.

**Where it lives.** `domain/scopeRows.ts` gains `rowsForPaths(rows, paths)` beside
`rowsAfterHideDone` — one depth-ordered pass keeping each named row and its ancestors, the
walk shape `doubleCountFigure` already uses. `renderScope.ts` applies it before
`drawScopeTree`; `renderReadiness.ts` wires the chips; `scopeToolbar.ts` draws the clear.

## Data flow

```text
releaseReadiness()  ── counts + outstandingPaths ──┬─→ renderReadiness  → chips (press → filter)
   (one walk, one predicate per number)            │                    → capacity bar
                                                   │                    → readinessFix buttons
                                                   └─→ renderScope → rowsForPaths → scopeTree
                                                                                      → row chips
row chip / row menu → one method per field → releaseWritePlan → applyPropertyWrites → gate
readinessFix        → releaseEdits (release note) | runReleaseInit(filter) (.base)
```

## Error handling

- Every write goes through the view's existing gate: serialized, refused whole while a batch
  is in flight, refused whole if it names a note the base did not return.
- A member re-read at write time the way `scopeCreate.ts` re-reads its release: the prompt
  outlives the model that opened it.
- A dialog that would write nothing writes nothing and says so, rather than spending the
  undo slot.
- A `.base` write that binds nothing reports `release.init.nothing`, the existing sentence.
- Every new sentence is a catalog key; no message re-spells a view option's label.

## Testing

- `test/domain/releaseReadiness.test.ts` — `outstandingPaths` agrees with `outstanding` on
  every fixture, is null exactly where the count is, and holds no context row.
- `test/domain/scopeRows.test.ts` — `rowsForPaths` keeps ancestors, drops unrelated
  subtrees, and is stable under a path that is no longer in the rows.
- `test/domain/releaseWritePlan.test.ts` — the two member planners: a no-op pick plans
  nothing, a clear removes the key, an unbound key plans nothing at all.
- `test/view/release/readinessFix.test.ts` — each red state draws its button, each press
  reaches its own action, and an unbound-option press binds that option **and no other**.
- `test/view/release/scopeChips.test.ts` — chips draw on members and not on context rows;
  chip and menu reach one method; the effort dialog refuses `5 pts` and `TBD`; the risk
  checkmark follows the plan.
- `test/view/release/readinessFilter.test.ts` — a press narrows, a second restores,
  hide-done is suspended while active, and a filter whose criterion is satisfied clears
  itself.
- `test/view/releaseNeverEdits.test.ts` — the narrowed claim: the ordinary gestures still
  write nothing, and the two new writers are named as permitted rather than asserted
  uncalled.
- `test/view/contextCardWrites.test.ts`'s question asked of this screen: the two new write
  paths refuse a context row from the chip, from the menu, and structurally at the gate.

## Register

New notes under `docs/requirements/`, one per slice, children of `Release readiness` and
`Commitment against declared capacity`. `docs-check.mjs` rule 7 requires every new `src/`
module to be specified in a use case's **Where it lives** — `readinessFix.ts`,
`scopeChips.ts` and the two new domain functions each need naming there.
`Answering the readiness checklist.md` is amended: its guarantee that evaluating writes
nothing still holds, and the chips are no longer read-only.
