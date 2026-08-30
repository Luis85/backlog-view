# One global rank: ranking at the focused level

Covers ranking a backlog at a chosen level — the PBI backlog on its own, the Feature
backlog on its own — the way Azure DevOps Boards does it, with one number rather than two.
Relaxes [[Focus level]] extension 3a, which today refuses ranking across the synthetic top row,
and re-decides the reasoning recorded in
`docs/issues/Board order is derived not stored.md`.

## The problem

`order` is a sibling-scoped fractional rank: a number that only means anything among the
notes sharing a parent. That is enough for the tree and for nothing else. Set the focus
level to `PBI` and the view re-roots to every PBI in the backlog, from every parent — and
that list cannot be ranked at all. [[Focus level]] 3a refuses the move, correctly, because
those rows are not a sibling group and a rank written across them would mean nothing once
the focus cleared.

The result is that the one screen built for prioritizing at a single altitude is the one
screen where priority cannot be expressed.

## What Azure DevOps does

One field — `Microsoft.VSTS.Common.StackRank` on Agile and CMMI,
`Microsoft.VSTS.Common.BacklogPriority` on Scrum — a Double, **global across the project**
and not scoped to a parent. The large values people notice (`1999999497`) are a seed
constant, not spacing: values sit about one apart, and a drag writes the midpoint
(`1999999497.5`), so one work item changes per move.

Each per-level backlog — Epics, Features, Stories — is a filter over that one order. So
ranking at a level and ranking in the hierarchy are the same number, and sibling order is
simply the restriction of the global order to a sibling set.

That is the pattern every dual-surface tool uses, and the board-order issue already names
it: Jira's LexoRank, Azure DevOps' stack rank, Linear's manual order. One rank shared
between backlog and board.

## The change

**`order` becomes one fractional rank over the whole backlog.** No projection owns a rank;
each reads a slice of the single order:

| Projection | The slice it reads |
| --- | --- |
| Tree | the items sharing a parent |
| Focus level | the items at that rung, plus the extra types ranking beside it |
| Board column, roadmap shelf | unchanged — the Base's own sort |

Sibling ranking stops being a rule and becomes a consequence. A sibling group is a subset
of a total order, so `compareSiblings` is untouched.

### Scope

Tree and focus level only. Board columns and the roadmap shelf keep today's behaviour.
A global rank makes in-column ranking *possible*, and this work deliberately does not take
it — see **Register** below.

### What this deletes

`renumberWrites` goes. Under a global rank its `10, 20, 30` slot arithmetic collides with
every other item in the vault, and it cannot be repaired: a global respace in a filtered
base would silently move visible notes across notes the Base never loaded, which is the one
thing the context-row rule forbids.

Two guards existed only to serve it, and go with it:

- **`reorderableGroup`'s refusal** of a group holding an excluded row. A *renumber* would
  assign ranks in a group the view cannot see the whole of. A *midpoint* never had that
  problem — it needs two visible neighbours and nothing else. `siblingPosition`,
  `canReorder` and `outdentTarget` stop gating on it.
- **[[Sibling ranking]] extension 1a**, which is that refusal stated as behaviour.
  Extension **2a** is replaced: a spent gap now refuses the drop instead of renumbering.

This is a net deletion in `domain/writePlan.ts` and `domain/dropTargets.ts`.

### Constants

| | Today | After |
| --- | --- | --- |
| `ORDER_SPACING` | 10 | 1000 |
| `roundOrder` | 4 decimals | 6 decimals |
| `MIN_GAP` | 0.002 | 0.000002 |

About 30 halvings of one interval before a drop refuses. Full double precision would give
about 50; the six-decimal cap is the price of frontmatter a human reads, and it is paid
knowingly.

### What does not change

Parent links. Indent and outdent across the synthetic focus row stay **refused** — that is
a question about parentage, and nothing here answers it. Excluded rows are still read for
placement and never written. `applySafely` is untouched.

### The consequence, stated plainly

Ranking a PBI at the focused level above a PBI with a different parent does **not**
reparent it. It writes one global number, so the item also moves among its own siblings in
the tree. That is the trade Azure DevOps makes, and it is the price of one rank instead of
two. A vault that wants the two readings independent needs two properties, which is the
`kanban_order` failure the board-order issue records.

## The write path

### One planner, one new fact

`DropTarget.siblings` is renamed **`peers`** — the rows the item is ranked *among*. In the
tree those are the parent's children; under focus they are the rendered focus rows.

No flag is added. A focus-level rank sets `target.parent` to the dragged item's **own**
parent, so `parentUpdate` already returns `undefined` and only `order` is written.
`computeInsertOrder(peers, insertIndex)` is otherwise untouched, so a focus-level drop is
one number on one note, exactly as a sibling drop is.

Alt+arrow and the move menu reach the focus row list through the same `siblingPosition`,
so the three inputs stay one move — the rule the card projections already keep.

### Refusal

`orderBetween` returns `null` when the gap is spent. Today that falls through to the
renumber; now it plans no writes and the host announces it. One new catalog key, naming
the command below. That is the only new user-facing text.

### Appends and creation

`afterHighestKnown` does **not** survive the redefinition, and the first draft of this
spec was wrong to say it did. `floor(max of peers) + spacing` is a sibling-scoped answer:
appending a child to Epic 1 lands it a whole spacing past Epic 1's last child, which under
a global rank can be past Epic 2's entire subtree. The tree hides that, because the tree
renders by parent — the focused list does not.

So an append is not a special case any more. It is the same two-neighbour midpoint every
other drop takes, with **`next` read from the rendered forest rather than from the peer
group**: the row that follows the last peer in global order, which for a sibling append is
the parent's next sibling or whatever the subtree walk reaches next. Only a true
end-of-backlog append — no next row at all — falls back to `floor(max) + spacing`, where
that value is free by construction.

`endOfSiblingsOrder` and the creation paths take the same neighbours. This is a deletion:
one arithmetic for every placement, instead of one for drops and another for appends.

### Collisions with ranks the Base hides

A midpoint needs two visible neighbours and nothing else — that is what lets the renumber
gate go. It does **not** make the value globally unique. With visible neighbours at 1000
and 3000 and a note the Base excluded sitting at 2000, the drop writes 2000 and the two
tie; `entryIndex` then decides, so the item can sort *next to* rather than *at* the
position it was dropped, once the filter is cleared.

This is `docs/issues/Duplicate orders in a partially filtered group.md`, and the change
makes it worse in two ways that the issue note has to record:

- **It is no longer self-correcting.** That note's impact section rests on "the group
  renumbers itself on the next renumbering drop". There is no renumbering drop any more.
  The **rank command** is the replacement, and it has to be named there: running it
  respaces every result and clears every tie.
- **The collision is likelier than chance.** Seeded ranks are round multiples of the
  spacing, and the midpoint of two of them is another round multiple — exactly where a
  seeded rank lives. Widening the spacing does not help; it moves the whole lattice.

Not fixed here, for the reason the issue already gives: a correct fix needs the complete
peer set — backlinks plus a folder scan — which `computeDropWrites` cannot reach without
giving up the purity that makes the ranking rules testable without a vault. Refusing to
rank on a filtered base is not the alternative it looks like: every Bases view is a
filter, so that refuses the feature.

### `computeInitWrites`

The per-group `maxOrder = 0` reset becomes one running counter carried down the DFS. It
still fills blanks only and never overwrites.

## Migration

An existing vault renders identically in tree mode after the redefinition — siblings within
a group already hold distinct orders. Only the flat list needs seeding: every PBI across
every parent carries `10` or `20`, so a focus-level list sorted by a global `order` is ties
all the way down.

**A new one-shot command**, `src/commands/rank.ts`, beside `readme.ts` and `scaffold.ts`:

1. Walk `model.realRoots` in DFS preorder.
2. Skip `outsideFilter` items; assign `counter += ORDER_SPACING` to every result.
3. Confirm through the existing `ui/confirmDialog.ts`, stating the count.
4. Apply through `applySafely` — one batch, one undo slot, the `configProblems` gate
   already in front of it.

It writes the order the user is already looking at, so nothing visible moves.

The toolbar's ✨ init is **not** extended to do this. Its contract is "fill in what is
missing without touching values that already exist", and it is also the board's and
roadmap's unconfigured empty-state action, so it would rewrite ranks in cases where nobody
asked for it.

The caveat belongs in the confirm dialog: on a filtered base the command can only rank the
results the Base returned, so it may reorder them relative to notes the base excluded. Run
it once, on an unfiltered base.

## Cost

`collectFocusRoots` collects DFS from the tree. Once a flat move breaks the coincidence
between tree order and global order, DFS preorder is no longer global order — so the focus
roots must be sorted by `(order, entryIndex)`.

That is a second comparison pass, and it is legitimate under the rule the resource roster
already established: focus roots are a subset of the items, so `f ≤ n`, they are sorted
once per build rather than per row, and the build's bound stays `O(n log n)`.
`test/domain/modelCost.test.ts` asserts every item is sorted exactly once, so both that
check and the Cost section of `src/domain/CLAUDE.md` have to state this sort rather than
have it appear underneath them.

## Checks

- `test/domain/writePlan.test.ts` — one write per move; the midpoint is global; a spent gap
  plans **no writes**.
- `test/domain/writePlanContextRows.test.ts` — an excluded row *between* two visible
  neighbours: the drop still writes one note, and never the excluded one. The
  "renumber refused, append instead" cases are deleted with the branch, watched failing
  first.
- New: an append reads `next` from the rendered forest, not from the peer group — a child
  appended to the first of two sibling subtrees ranks **before** the second subtree's
  first item, not a spacing past it. This is the check the first draft of the spec had no
  claim for.
- `test/view/contextRowWrites.test.ts` — the load-bearing suite. Dropping `reorderableGroup`
  from three gates *widens* the write surface, so this one must not weaken. The rule stays
  checked at the forbidden thing (`applySafely` plus the spy on the call), not by listing
  the paths, and the new command joins the entry points it drives.
- New: ranking across the focus row list writes `order` and never `parent`; indent and
  outdent across it stay refused.
- `test/domain/modelCost.test.ts` — the focus-root sort runs exactly once per build.
- `CHANGELOG.md` gains an `[Unreleased]` entry in this pull request, as
  `test/release/changelogVersion.test.ts` requires.

## Register

`docs-check.mjs` gates each of these.

- **New ADR** — `order` is a global rank. It relaxes [[Focus level]] 3a and re-decides the
  reasoning in the board-order issue, so it needs a note of its own rather than an edit.
- **New PBI** — *Ranking at the focused level*, under [[Reordering and reparenting]],
  naming `src/commands/rank.ts` in its `## Where it lives`. Rule 7 fails without it.
- **Edit** [[Sibling ranking]]: 1a deleted, 2a becomes a refusal, the guarantee restated
  over peers rather than siblings.
- **Edit** [[Focus level]]: 3a now refuses indent and outdent only.
- **Edit** `src/domain/CLAUDE.md`: the sibling-scope sentence, the three-lists paragraph,
  the `MIN_GAP` bullet, and the Cost section.
- **Edit** `docs/issues/Duplicate orders in a partially filtered group.md`: the impact
  section's self-correction is gone with the renumber, and the rank command replaces it.
- **Edit** `docs/issues/Board order is derived not stored.md`: a shared rank now exists, so
  in-column ranking became possible and is deliberately not taken here. The issue stays
  open with its premise corrected.

## What cannot be checked here

Obsidian does not run in this repository. The migration command writes every note in a
vault, and jsdom cannot report whether that feels safe to use. It needs `npm run test-build`
and a live vault before it is called done.
