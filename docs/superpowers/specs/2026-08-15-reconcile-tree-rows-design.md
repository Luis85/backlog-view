# Reconcile the tree's rows instead of rebuilding them

**Date** 2026-08-15 · **Kind** polish increment, one open P1 bug · **Register**
[[The render is the whole cost of a data update]]

## The problem, as measured

`docs/bugs/The render is the whole cost of a data update.md` records the numbers. On an
832-row expanded tree the render costs ~280 ms and every data update pays all of it, so a
write batch — which ends in exactly one such update — is followed by a visible pause. The
cost is linear in the rows and the constant is the whole finding: ~0.3 ms per row after
`content-visibility` removed most of the layout half.

Two constant-factor cuts have already landed (`content-visibility: auto`, per-name icon
templates, delegated row listeners) and the bug note is explicit that neither changed the
class. It is equally explicit that it proposes nothing: *"which of virtualisation, diffing,
or a cheaper per-row path is right is a design question."* This spec answers it.

## The decision

**Diffing — reconcile the visible rows by path and signature.** On a data update the
render walks the visible items in order and keeps every row element whose path is already
indexed and whose signature is unchanged, builds only what is new, and detaches what the
walk did not claim.

Refused, with reasons, so the next reader starts from three options rather than one:

- **Virtualisation** — build only the rows in the viewport. It is the only option whose
  cost stops scaling with the backlog, and it is refused *for now* rather than in
  principle. It fights nested `role=group` DOM, `aria-posinset`/`aria-setsize`, the indent
  guides and the drag geometry, and `content-visibility` has already taken the layout half
  — so it pays the highest structural price for the half that is left. If reconcile lands
  and mount cost (not update cost) becomes the complaint, this is the next move.
- **A cheaper per-row path** — keep rebuilding, spend less per row. This is what the last
  two cuts did, for −13%. The row builds roughly two dozen elements and there is no
  remaining item of that size in it; the next −10% costs more than it returns.
- **Provenance instead of a signature** — re-render only the paths the write batch touched.
  Cheaper to compute, and it answers nothing for an update the plugin did not cause:
  `onDataUpdated()` takes **no arguments**, so an edit made in another pane arrives with no
  indication of what changed. It also needs a guard, a fallback render mode and a plumbing
  path for the written set, where the signature needs one loop. Refused as *more* code for
  *less* coverage.

## Step 1 — finish the delegation

`src/view/CLAUDE.md` states that *"nothing about a row is captured at wire time"*. That is
true of the delegated pane-level handlers (`wireRowEvents`, `wireTree`) and **not** true of
the row's own controls. Six capture the `BacklogItem` in a closure while the row is built:

Addressed by name rather than by line, so the list survives the next insertion above it:

| Function | Module | Control |
| --- | --- | --- |
| `renderTagCell` | `src/view/render/columns.ts` | a pill's remove button, one per tag |
| `renderTagCell` | `src/view/render/columns.ts` | the add button → `showTagMenu` |
| `renderStateChip` | `src/view/render/columns.ts` | the state chip |
| `renderHorizonChip` | `src/view/render/columns.ts` | the horizon chip |
| `renderLabelChip` | `src/view/render/columns.ts` | the risk and assignee chips |
| `renderRowTrailing` | `src/view/render/rows.ts` | the `New <child>` button |

Harmless while every update rebuilds every row, and the exact reason a kept row is unsafe:
a reused element would hold a chip pointing at the previous update's item, whose `parent`
and `children` reach into a model that is gone.

So the controls resolve their item **per event**, by `data-path` against the current model,
the way the row's own activation already does — `rowItem(host, evt)` in `render/rows.ts` is
the helper that exists for it and gains an export. This is worth having on its own: it makes
the guide's sentence true as written, and it takes a closure and an `addEventListener` call
per control out of the render before the class changes at all — up to six per row where
every chip column is configured, plus one more for every tag a row carries.

The cards share `renderPropCells`, so their chips are delegated by the same change. Card
projections rebuild whole today and are out of scope for step 2; the delegation is not
scoped away from them, because a control that captures its item is the hazard wherever it
renders.

## Step 2 — the reconcile

`renderTree` stops clearing `rowEls`. The forest walk becomes, per item, in sibling order:

1. Compute the signature.
2. If `rowEls` holds the path and the stored signature matches, keep the element — moving
   it with `insertBefore` when its position in the container changed.
3. Otherwise build the row as today, replacing the indexed element when there was one.
4. Recurse into the row's `.pbl-children` group by the same rule, reusing the group element
   when the row was kept.
5. After the walk, detach every element still in the index that this pass did not claim,
   and drop it from the index.

`refreshRowChildren` is unchanged in behaviour and keeps working: it re-renders one child
group and prunes the subtree it removes.

## The signature

A pure, DOM-free `rowSignature()` in a new `src/view/rowSignature.ts`. The precedent for a
pure module in the view layer is `src/view/childrenList.ts`, which exists for the same
reason — an answer two render modules must agree on, with no cycle between them.

It folds three groups of terms:

- **The note's frontmatter, stringified.** One term covering the badge, the title, every
  `note.*` property cell, the state, horizon, risk and assignee chips, and the tags.
- **What a row draws that the frontmatter cannot give**: rollup done and total, `depth`,
  `aria-level`, `aria-posinset`, `aria-setsize`, whether any child is visible, collapsed,
  selected, `outsideFilter`, `draggable`, implied type, and the add button's label.
- **The resolved column list**, since which columns exist changes every cell on every row.

The failure directions are not symmetric and the design leans on that. A signature that
differs when the row would have drawn the same costs one wasted row build — today's
behaviour, for that row. A signature that matches when the row would have drawn
differently ships a **stale row**, which is a correctness bug. Every judgement call below
is taken in the first direction.

## The guard: reconcile is off for a non-frontmatter column

A column may be any Bases property id. `note.*` is covered by the frontmatter term;
`file.mtime`, `file.size` and a `formula.*` are not — a body edit changes `file.mtime`
with the frontmatter untouched, so that cell would go stale while its signature matched.

**Reconcile therefore runs only while every configured column is a `note.*` property.**
With one present, the render is exactly today's, in full. The predicate is computed once
per update beside `resolveColumns`.

This is a stated ceiling, not an oversight, and it carries a `ponytail:` comment naming its
upgrade path: re-render the non-frontmatter cells alone on a kept row, which buys those
vaults the same win at the price of a second reuse rule. The shipped default qualifies —
`tagsKey` defaults to `tags`, a frontmatter key, and `file.name`, the parent, order and type
keys are all skipped as columns before the list is built.

## Risks, stated rather than discovered

1. **Transient classes on a kept row.** Drag state (`.pbl-drop-*`) is not in the signature,
   so a reused element keeps whatever it was wearing. A render during a card gesture is
   already deferred and the tree's `dragend` clears state, but a kept row is a new way for
   one to survive — so reuse clears the transient classes explicitly.
2. **`rowEls` accuracy.** `forgetSubtree` and `refreshRowChildren` were written against a
   full render that clears the index. Reconcile removes that boundary, so the index is
   maintained by the walk and pruned at the end of it.
3. **The early returns.** `renderTree` bails to an empty state — no results, everything
   filtered, everything done — before it renders a row. Those paths clear the index
   outright, or a later reconcile finds elements that are no longer in the document.
4. **The frontmatter term's cost.** Stringifying frontmatter for 832 rows must not
   approach what it saves. If it does, the upgrade is a reference comparison against
   Obsidian's cached metadata object — cheaper, and correct only while a changed file
   always yields a *new* object, which is an assumption this repository cannot verify.
   Measure before reaching for it.

## How it is measured

`npm run perf -- --against <baseline>`, folder fixture, 832 rows, tree expanded,
alternating builds, medians of the panel's medians — the protocol the bug note settled on
after two instruments lied about this same quantity. The claim to prove is a change in the
**class**: `update` after a one-note write should fall toward the cost of one row build
plus the walk, rather than 832 row builds.

Two honesty notes travel with the numbers into the register:

- The harness's fake entry has no `renderTo`, so every plain property cell falls into the
  cheap `setText` path. A real vault runs Obsidian's value renderer per cell and pays more
  per row — so the measured win is a **lower bound**, with a known direction and an unknown
  size.
- A delta between overlapping spreads is this environment's drift, which has twice been
  read here as a finding.

## The checks

- **Element identity across an update.** A data update with unchanged data keeps the same
  `HTMLElement` for every path. This is the test that fails without step 2, and it is
  watched failing before the fix lands.
- **A chip acts on the current item.** A chip clicked after a data update writes to the
  item the model holds now, not the one captured at the previous render. Fails without
  step 1; watched failing.
- **`rowSignature` in both directions.** Every field a row draws changes the signature, and
  two items that would draw the same row agree on it.
- **The category invariant, at the forbidden thing.** A `no-restricted-syntax` rule bans
  `addEventListener` in `render/rows.ts` and `render/columns.ts`, so a control written
  tomorrow cannot reopen the capture. The rule sees that spelling and not an aliased
  reference; the guide sentence is written to what the rule reaches, not wider.
- **Reconcile is off for a non-frontmatter column.** A configured `file.mtime` column
  renders every row afresh on every update.
- `npm run check` — build, lint, coverage-thresholded tests, fallow, docs register.

## What lands in the register

- **An ADR.** `docs-check.mjs` rule 7 requires every `src/` module to be specified by a use
  case's `## Where it lives` or an ADR's `## Decision`; a Bug note counts for nothing. So
  `src/view/rowSignature.ts` is specified by a new ADR — which this decision earns on its
  own terms, since virtualisation and provenance were genuinely available and are argued
  above. Its `## Consequences` states what got harder: a render is no longer a clean slate,
  so anything a row wears outside the signature now has a lifetime to reason about.
- **The bug note's `## Fix` and outcome**, with the A/B table and both honesty notes.
- **A `[Unreleased]` changelog entry**, in the same pull request.
- **One live-vault check owed**, filed under `docs/tests/cases/`: a real Bases `renderTo`
  cell, which this repository cannot render. Reconcile must not leave a cell stale in a
  vault where the value renderer draws links, embeds or dates.

## Out of scope

The card projections — board, roadmap, shelf — keep rebuilding whole. Step 1 delegates
their shared chips because a captured item is a hazard wherever it renders, and nothing
else about them changes. Whether the same reconcile is worth having for cards is a question
to ask with the tree's numbers in hand.
