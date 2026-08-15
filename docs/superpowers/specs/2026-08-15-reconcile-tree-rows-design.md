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
| `renderRowLead` | `src/view/render/rows.ts` | the disclosure's **redraw** callback |

The last one is the worst of them and the easiest to miss, so it is worth being exact
about which half is the hazard. `renderRowLead` builds two callbacks on adjacent lines:

- `fold` closes over `item.file.path` — a **string**, and the row's identity. Safe.
- the redraw, `() => host.refreshSubtree(item)`, closes over the item **object**, and
  `refreshSubtree` renders that item's `children`. On a kept row this is the previous
  model's child list, so a collapse and expand after an update would restore a subtree
  that no longer exists. The signature cannot save it either: a change to a child that
  moves neither the parent's rollup nor any other term leaves the parent's signature
  identical, which is correct for what the parent DRAWS and wrong for what its stale
  closure would draw next.

So the redraw resolves its item from the current model per click, like the rest.
`renderChevron` is shared with the timeline's rows, which re-render whole and pass their
own redraw — the callback is the caller's, and only the tree's caller changes.

Harmless while every update rebuilds every row, and the exact reason a kept row is unsafe:
a reused element would hold a chip pointing at the previous update's item, whose `parent`
and `children` reach into a model that is gone.

So the controls resolve their item **per event**, by `data-path` against the current model,
the way the row's own activation already does.

The resolver for them is **not** `rowItem` in `render/rows.ts`, and the difference matters:
`rowItem` searches for `.pbl-row`, which is the tree's alone, and its comment says so —
*"on a card projection every one of these handlers resolves nothing and stands aside"*.
`renderPropCells` is shared with the cards, whose path sits on `.pbl-card`, so reusing
`rowItem` for the chips would make every chip on the board, the roadmap and the shelf
inert. The delegated resolver matches `[data-path]` instead, which both mounts carry, and
`rowItem` keeps its narrowing untouched. This is worth having on its own: it makes
the guide's sentence true as written, and it takes a closure and an `addEventListener` call
per control out of the render before the class changes at all — up to seven per row where
every chip column is configured, plus one more for every tag a row carries.

The cards share `renderPropCells`, so their chips are delegated by the same change. Card
projections rebuild whole today and are out of scope for step 2; the delegation is not
scoped away from them, because a control that captures its item is the hazard wherever it
renders.

## Step 2 — the reconcile

**The tree holds three things that are not rows**, and each one has to be answered before
a row can be kept. Naming them is most of this step:

- **`this.treeEl.empty()` in `src/view/backlogView.ts`**, which runs before the content
  render. Nothing can be reused while it does, so the reconcile path does not call it. It
  stays on every other path — a projection switch, an empty state, a changed
  render-inputs fingerprint — and those paths are exactly the ones that also clear
  `rowEls`.
- **The column header.** `renderColumnHeader` appends a fresh `.pbl-cols` on every pass.
  With the clear gone it would append a second one per update, and a cleanup that removes
  only what the row index knows about cannot see it. So the header is **claimed**: the
  reconcile finds the existing `.pbl-cols`, updates it in place, and builds one only when
  there is none.
- **The child groups.** `.pbl-children` is the row's **next sibling**, not its descendant
  — `childGroupEl` builds it in the *container*, which is why `refreshRowChildren` reaches
  it through `row.nextElementSibling`. A row and its group are therefore one structural
  unit: they move together, they are replaced together, and they are detached together.
  A kept row moved on its own would leave its group at the old position and break the
  adjacency `refreshRowChildren` depends on.

The forest walk then becomes, per item, in sibling order:

1. Compute the signature.
2. If `rowEls` holds the path and the stored signature matches, keep the element — moving
   the row **and the `.pbl-children` group following it** when its position changed.
3. Otherwise build the row as today, replacing the indexed element and its group together
   when there was one.
4. Recurse into that group by the same rule, whether it was kept or built.
5. After the walk, detach every element still in the index that this pass did not claim —
   each with its group — and drop it from the index.

`refreshRowChildren` is unchanged in behaviour and keeps working: it re-renders one child
group and prunes the subtree it removes.

## The signature

A pure, DOM-free `rowSignature()` in a new `src/view/rowSignature.ts`. The precedent for a
pure module in the view layer is `src/view/childrenList.ts`, which exists for the same
reason — an answer two render modules must agree on, with no cycle between them.

It folds two groups of terms, and **only per-item ones** — everything shared by the whole
pass is handled by the gate below instead:

- **The note's frontmatter, stringified.** One term covering the badge, the title, every
  `note.*` property cell, the state, horizon, risk and assignee chips, and the tags.
- **What a row draws that its frontmatter cannot give**: rollup done and total, `depth`,
  `levelIndex` and `effectiveLevelIndex`, `impliedType`, **`orphan`**, `outsideFilter`,
  `aria-posinset` and `aria-setsize`, whether any child is visible, collapsed, selected,
  draggable, and the add button's type list.

**That second list was built with an instrument, not from memory**, and the first draft of
it proves why: it was written by recalling the render and it missed `orphan`, which draws
the `.pbl-orphan` unlink marker and flips when a referenced parent starts being returned by
the Base — no frontmatter touched, same depth, same position. Review caught it. The list
above comes from sweeping every `item.*` read in `renderItem`, `renderRowLead`,
`renderRowTrailing`, `renderBadge` and every cell renderer, and checking each against a
term.

The honest limit stays: this is an **enumeration**, and nothing fails when a term is
missing. A new per-item rendering decision has to join it, and neither the compiler nor
the suite will say so — which is why the pass-level fingerprint above covers the settings
axis by construction rather than by listing, and why this list is the part of the design
to re-derive by sweep rather than by reading, every time the row gains something.

The failure directions are not symmetric and the design leans on that. A signature that
differs when the row would have drawn the same costs one wasted row build — today's
behaviour, for that row. A signature that matches when the row would have drawn
differently ships a **stale row**, which is a correctness bug. Every judgement call below
is taken in the first direction.

## The gate: one fingerprint for everything that is not per-item

A row draws from more than its own note, and the rest of it changes for the whole pass at
once. `refreshFromData` re-resolves the settings on the same argument-less update path, so
a view-option change arrives looking exactly like a data change:

- `showCounts` toggled turns `renderRollup` from no cell into a count cell, while
  `descendantCount` and the frontmatter are both unchanged.
- A changed done value flips `.pbl-done` on a leaf whose frontmatter nobody touched.
- `host.filterText` decides which substring `renderTitleText` lights up, and whether the
  row is draggable at all.
- The `columnFit` verdict sizes every cell on every row.

**Enumerating those inside the per-row signature is the wrong shape** — it is a list of the
places someone thought of, and the next settings-derived rendering decision is the one that
breaks it. So they are answered once per pass instead, as a single **render-inputs
fingerprint**: the resolved settings, the resolved column list, the projection, the filter
text and the column-fit verdict. Unchanged from the previous pass, the reconcile runs.
Changed, the pass empties the tree, clears the index and renders exactly as today.

This is what lets the per-row signature stay per-item: while the fingerprint holds, every
row on screen was drawn under the settings this pass is drawing under.

**The non-frontmatter column rule lives in the same gate**, because it is a property of the
resolved columns. A column may be any Bases property id; `note.*` is covered by the
frontmatter term, and `file.mtime`, `file.size` and a `formula.*` are not — a body edit
changes `file.mtime` with the frontmatter untouched, so that cell would go stale while its
signature matched. With one present the fingerprint refuses the reconcile outright.

That last part is a stated ceiling rather than an oversight, and it carries a `ponytail:`
comment naming its upgrade path: re-render the non-frontmatter cells alone on a kept row,
which buys those vaults the same win at the price of a second reuse rule. The shipped
default qualifies — `tagsKey` defaults to `tags`, a frontmatter key, and `file.name`, the
parent, order and type keys are all skipped as columns before the list is built.

## Risks, stated rather than discovered

1. **Transient classes on a kept row.** Drag state (`.pbl-drop-*`) is not in the signature,
   so a reused element keeps whatever it was wearing. A render during a card gesture is
   already deferred and the tree's `dragend` clears state, but a kept row is a new way for
   one to survive — so reuse clears the transient classes explicitly.
2. **`rowEls` accuracy.** `forgetSubtree` and `refreshRowChildren` were written against a
   full render that clears the index. Reconcile removes that boundary, so the index is
   maintained by the walk and pruned at the end of it. A child group has **no index entry
   at all** and never gets one: it is reached by adjacency from its row, which is what
   makes "the row and its group move together" a rule rather than a convenience.
3. **The early returns.** `renderTree` bails to an empty state — no results, everything
   filtered, everything done — before it renders a row. Those paths empty the tree and
   clear the index outright, or a later reconcile finds elements that are no longer in the
   document.
4. **The frontmatter term's cost.** Stringifying frontmatter for 832 rows must not
   approach what it saves. If it does, the upgrade is a reference comparison against
   Obsidian's cached metadata object — cheaper, and correct only while a changed file
   always yields a *new* object, which is an assumption this repository cannot verify.
   Measure before reaching for it.

## How it is measured

`npm run perf -- --against <baseline>`, folder fixture, 832 rows, tree expanded,
alternating builds, medians of the panel's medians — the protocol the bug note settled on
after two instruments lied about this same quantity.

The claim to prove is a **constant-factor cut, not a change of class**, and saying
otherwise would set a criterion nothing here can meet. `renderForest` visits every visible
item and `rowSignature` serializes each one's frontmatter whether the row is kept or not,
so `update` stays linear in the rows — and that walk is inherent, since skipping it needs
to know what changed, which is exactly what `onDataUpdated()` cannot say. Only
virtualisation changes the class, which is why it is refused *for now* above rather than
outright.

So the number to report is the **per-row** cost: `update` divided by the row count, at
several sizes, before and after. It should fall and then stay roughly flat across sizes. A
per-row figure that falls at 200 rows and climbs again at 1600 is the signature walk eating
its own saving — that is risk 4 below arriving, and the reference comparison named there is
the answer.

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
- **A disclosure acts on the current children.** A child is added, the parent's own
  signature is unchanged, and collapsing then expanding the parent shows the child. This
  is the one the signature cannot catch by construction, so it is asserted directly.
- **One header per pass.** Repeated data updates leave exactly one `.pbl-cols` in the
  tree.
- **A kept row's group travels with it.** Two expanded siblings are reordered by a write;
  each subtree ends up under its own parent, and `refreshRowChildren` still finds its
  group by adjacency afterwards.
- **`rowSignature` in both directions.** Every field a row draws changes the signature, and
  two items that would draw the same row agree on it.
- **The category invariant, at the forbidden thing.** A `no-restricted-syntax` rule bans
  `addEventListener` in `render/rows.ts` and `render/columns.ts`, so a control written
  tomorrow cannot reopen the capture. The rule sees that spelling and not an aliased
  reference; the guide sentence is written to what the rule reaches, not wider.
- **Reconcile is off for a non-frontmatter column.** A configured `file.mtime` column
  renders every row afresh on every update.
- **A settings change is not reused across.** Toggling `showCounts` between two updates
  gives every row its count cell, and changing the configured done values repaints
  `.pbl-done` — both with no frontmatter touched. Driven through the fingerprint rather
  than through a signature term, so a settings-derived rendering decision written later is
  covered without editing the test.
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
