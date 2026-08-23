# Putting work in a release — the second increment

*Design, 2026-08-23. The register specifies this as [[Setting an item's release]], under
[[Putting work in a release]]. This document decides what of it ships now and what does not;
it invents no requirement.*

## Why this one

The first increment shipped `product-release`: a view that lists every release and draws one
release's scope. It writes nothing, deliberately.

**Nothing else writes release membership either.** A user opens that view and sees empty
scopes, because the only way to put work in a release is to hand-edit frontmatter. The
capability that makes the merged view mean anything is the one that was not built.

This increment builds it, and nothing else.

## What it delivers

**`Set release` on a work item, from the backlog view's row and card menus and from the
keyboard.** Pick a release, or pick "no release" to take the item out. One host method plans
one write; the gate applies it; undo takes it back as one batch.

It is offered wherever `Set iteration` is — `buildItemMenu`'s editable section, which serves
the tree, both boards and the roadmap.

The sentence the increment has to make true, in a real vault: **right-click a PBI, Set
release, 2.4 — then open the release view and see it under 2.4's scope.**

## What it does not deliver, and why

Named here so the plan cannot drift into them.

**Dragging an item onto a release.** The PBI specifies three inputs; this ships two. There is
no surface where a release is a drop target: the release view is read-only by design, with
`test/view/releaseWritesNothing.test.ts` enforcing it, and adding drop targets there would
retire that invariant rather than extend it. A drag arrives with a surface that can hold one —
most likely [[A release on the dated axis]].

**This narrows an acceptance criterion.** The PBI requires "the menu, the keyboard and the drag
produce byte-identical batches". Two of the three ship, and the criterion is met for those two.
That is a deliberate edit, recorded here rather than left as a criterion quietly unmet.

**Several items at once.** Extension 2b is not a scope choice — it depends on
[[Bulk edits on a selection]], and `src/view/selection.ts` holds a single selection by design.

**A shared plugin setting for the membership property.** See below.

**The deferred index columns.** Progress, commitment and slip are unchanged from the first
increment; they need [[The release summary]] and [[Capacity against commitment]].

## Decisions, and what they cost

**The backlog view declares its own membership option.** For the backlog view to write
membership it must know which property holds it, and today only `releaseOptions.ts` declares
that key. The backlog view gains its own option in `viewOptions.ts`, defaulting to the same
suggested name — [[Settings scoped to their view]]'s rule exactly, that sharing a suggestion is
not sharing a setting.

The first increment moved these keys OUT of `viewOptions.ts` on the grounds that nothing there
read them. That premise is now false, and this is the correction rather than a reversal: the
backlog view reads and writes this one key because it is the view doing the writing. The other
six stay where they are.

**The cost is a silence nothing can break.** If the two keys disagree, *neither view can tell*.
The backlog view may not read the release view's configuration and vice versa, so no code can
compare them. Worse, the symptom is invisible: work is written to a key the release view does
not read, so every scope is empty with no unresolved rows — which is exactly what a vault
nobody has assigned yet looks like. The mitigation is the shared default; the honest statement
is that a user who changes one and not the other gets no signal at all. **Do not write a
sentence promising a warning here.**

**The shared plugin setting is the real answer, and is not this increment.** A property both
views read would end the mismatch by construction. The plugin has no plugin-level settings at
all today — no `loadData`, no `saveData`, no `PluginSettingTab` — so it is a third persistence
category to build, beside the `.base` and vault-scoped localStorage that ADR 0011 rules on:
a settings surface, its persistence, an ADR, the write-boundary discipline, and a migration for
anyone who already bound membership in the release view. Ruled to be decided deliberately, on
its own, rather than bolted onto the increment that delivers the capability.

**The value is a LINK, not a label.** `frontmatter.ts` spells it with `wikilinkTo` from the
editing note's own path — the same call it already makes for `parent`, whose comment states
why. A plain string would let Obsidian resolve two same-named release notes to the wrong file.

That makes the PBI's duplicate-basename criterion pass on the WRITE side by construction, and
leaves only the picker: two releases whose notes share a basename must be distinguishable on
screen. The rule applied is **qualify with the containing folder only where a basename
collides**, stated where the picker is built. This is the question
[[Two releases with the same basename read alike]] records as open for the index; the picker
forces an answer, and that note should be updated to say the picker settled it and the index
did not.

## Architecture

It mirrors `Set iteration` at every layer, which is what keeps it small.

```
domain/viewOptions.ts    the membership option, same suggested default
domain/itemTypes.ts      eligibility — plan work only, beside canSetIteration's four refusals
domain/writePlan.ts      computeReleaseWrites(item, target, settings)
view/host.ts             performReleaseMove — the one method both inputs call
view/cardMoves.ts        where that method plans and announces
view/interactions/labels.ts   addReleaseItems, canSetRelease
view/interactions/menu.ts     one call in the editable section
storage/frontmatter.ts   the link write, through wikilinkTo
```

`computeReleaseWrites` carries `if (!settings.releaseKey) return []` — the rule every optional
property keeps: an unconfigured key is never written to.

## Behaviour

Most of the PBI's extensions are already guaranteed by machinery this increment does not touch:

- **1e — the item is outside the filter.** Free: `applySafely` refuses whole any batch naming an
  `outsideFilter` item.
- **1f — the row is not plan work.** Half free: the first increment's `membershipTarget` already
  refuses a `Milestone`, an `Iteration`, another `Release` or a test-catalog note carrying the
  property by hand. Only the writer-side refusal is new, and it is the same eligibility question
  `Set iteration` asks.
- **3a — the write takes the item out of the base.** Not reopened. The open question stands as
  [[The outcome report was built from one sentence]] records it.

New behaviour:

- **1a — already in the picked release.** No write is planned and the undo slot is untouched.
  **The checkmark is asked of the PLAN** — an entry is checked exactly when picking it would
  write nothing, never by a comparison written beside the plan. The register records those two
  drifting the moment a second property joined.
- **1b — "no release".** The key is REMOVED, never written empty: absence is a value, and an
  item in no release has none.
- **1d — the release note is outside the filter.** Not offered, and a batch naming it refused.
  `model.releases` already excludes `outsideFilter`, so the picker gets this by construction.
- **2a — the property is unconfigured.** The action is ABSENT from every menu rather than
  present and inert.

## Testing

Checked at the forbidden thing rather than by listing the paths somebody thought of:

- The menu and the keyboard produce **byte-identical batches** — the two planned batches
  compared directly, not each driven and eyeballed.
- The checkmark follows the plan: flip what the plan would write, and the checkmark follows.
- `computeReleaseWrites` names the membership property ALONE — asserted as a category over the
  written keys, so a property added later is covered without editing the test.
- With no key bound, no release entry appears in ANY menu, driven over every projection rather
  than the one that was remembered.
- Every new string through `t()`. `test/i18n/projections.test.ts` already drives the backlog
  view's menus, so unmarked text fails it.

`npm run check` — build, lint, coverage floors upward only, fallow, docs register — on Ubuntu
and Windows.

## What a live vault still owes

Obsidian cannot run in the development container, so two things can only be judged there:

- **The picker itself** — its length against a vault with many releases, and whether the
  folder-qualified entries read well where a basename collides.
- **The row menu's length.** This adds a fifth label-ish entry beside state, risk, priority,
  assignee, horizon and iteration. It may argue for grouping, which would be its own question.

[[Smoke test the release view]] already exists and is unrun; this increment adds to it rather
than starting a second suite.
