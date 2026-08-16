---
adr: 29
title: Reconcile rows by signature, rather than rebuilding them
status: Accepted
date: 2026-08-15
area: architecture
---

# 0029 — Reconcile rows by signature, rather than rebuilding them

## Context

`docs/bugs/The render is the whole cost of a data update.md` measured a data update in
Chromium, timing each phase from inside the call. The render is the whole of it: 88.6 ms
at 132 rows, 500.2 ms at 832, 1088.8 ms at 1632, against a model build that never reaches
20 ms and seven other phases that never reach 1.5 ms between them. Nothing is
superlinear — 12.4× the rows costs the render 12.3× — so what is wrong is the CONSTANT,
about **0.3 ms per row** once `content-visibility: auto` removed most of the layout half.
A write batch ends in a data update, so that half-second is paid on every move.

Two constant-factor cuts are already spent. `content-visibility: auto` took 718 ms to
283 ms at 832 rows by letting the browser skip off-screen rows; cloning icons from
per-name templates and delegating every row listener to the pane took another 9–14%,
measured A/B because this environment's run-to-run drift is larger than the effect. Both
were constants. The render is still linear in the rows, still rebuilt whole per update.

That note deliberately proposes nothing, and its `## Lesson` is why this record cites
figures rather than a conclusion: two instruments printed confident numbers they could not
resolve — a subtraction of two medians that swung by hundreds of milliseconds, and a CPU
profile that measured jsdom's `SymbolTree` — before a third answered the question.

What the second cut DID buy is structural rather than numeric: no per-row handler captures
its item at render time any more. That is the correctness prerequisite for keeping a row
element across an update, and it is what makes this decision available at all.

## Decision

**A data update DIFFS the tree instead of rebuilding it.** A row whose inputs have not
changed keeps its element; only a row that would draw differently is rebuilt.

Two modules carry it, at deliberately different scales.

`src/view/rowSignature.ts` is the decision procedure: three pure, DOM-free functions over
a `BacklogViewHost`, in the shape `src/view/childrenList.ts` established for a view-layer
module that renders nothing. `renderInputs` is everything a pass draws from that belongs
to no single item — the resolved settings, the columns, the projection, the filter text,
the column-fit verdict, the stored column widths (the HEADER's rather than the rows'; see
Consequences) and a per-column probe of the RENDERED type of each column's value — as one
string compared once per pass. `reusableColumns` is whether reuse is legal
at all this pass: every column must be `note.`-backed, because a `file.mtime` or a
`formula.*` cell can change with the frontmatter untouched. `rowSignature` is everything
ONE row draws from: its whole frontmatter as a single term, plus the derived values a row
shows that its own note cannot give.

`src/view/renderPass.ts` is where that verdict is spent. It already owns the content
render — the seam Task 1 took out of `backlogView.ts` — so the row walk it drives is the
one place a kept element can be compared against a rebuilt one, and the one place the
per-pass string is computed once for every row to be measured against.

`src/view/render/reconcile.ts` is that walk. It places one sibling group after another,
claims an element whose signature is unchanged instead of building one, carries the
claimed row's child group with it, and forgets what it detaches. It arrived inside
`src/view/render/rows.ts` and was moved out on 2026-08-16, when that file met its
400-line cap — the seam is the one the dependency already ran along, since the walk calls
`buildRow` and nothing in the row's own content calls the walk. `rows.ts` keeps what a
row IS and the pane's delegated listeners; this file keeps which rows survive and where
each one goes, with the invariants no type can hold — a claimed row also needs its
`ctx.rows` entry, the empty states fire after the reuse decision and before anything
prunes, a row's group is read off the previous element before anything moves — as
comments beside the lines they govern.

The two halves are different SHAPES on purpose. `renderInputs` puts `host.settings` in
whole, so it is safe by construction: a settings-derived rendering decision written next
year is covered without anyone remembering to add a term. `rowSignature` is an
enumeration, and nothing fails when a term is missing.

## Consequences

**A render is no longer a clean slate.** Every pass used to empty the tree and rebuild it,
so anything a row wore lasted exactly one pass and nothing had a lifetime to reason about.
A kept row now carries whatever the last pass put on it — a class, an attribute, a
`dataset` key, a drag's leftover marker — and any of those that a later pass sets
conditionally must now also be UNSET on the other branch. That failure is invisible: it
needs the two passes in the right order to show at all.

**The per-item half is an enumeration and nothing enforces it.** A settings-derived
rendering decision is covered by `renderInputs` for free; a new per-ITEM one has to be
added to `rowSignature`, and if it is forgotten the build says nothing, the suite says
nothing, and the symptom is a stale cell on screen. This is the honest cost of the
decision, and the record of it is four separate review rounds finding the list short —
two of them inside the fix for the previous one:

1. `item.orphan` was missing. It draws the `.pbl-orphan` unlink marker and flips when a
   referenced parent starts being returned by the Base, with the frontmatter, the depth
   and the position all unchanged.
2. A `note.*` value can render a LINK or an EMBED whose content belongs to ANOTHER note,
   so `reusableColumns`' source rule was not the whole question — a rename leaves this
   row's own frontmatter untouched and its cell wrong. Rows whose cells drew external
   content are therefore never signed.
3. A property's TYPE is Obsidian's, not the note's, so the same YAML scalar renders
   differently with no frontmatter change and no change to the column list. Hence the
   per-column type probe in `renderInputs` — introduced by the fix for 2.
4. A missing property returns a `NullValue` INSTANCE, not `null`, so the probe's first
   draft stopped at the first empty row and recorded `NullValue` as that column's type
   for good. Introduced by the fix for 3, and fixed by giving the emptiness test one
   owner (`drawsSomething`, exported from `render/columns.ts`) rather than a second copy.

The `#num:` / `#date:` sentinel escaping in the signature's JSON replacer has the same
history: the first tagging collided with strings a user can actually author, so every
authored string beginning `#` is now escaped out of that namespace.

**A row can refuse to be SIGNED, for two different reasons.** The list above is about
missing terms; these two are about a term's SOURCE being unavailable, and both end the same
way — nothing recorded, so nothing to match, so the row is rebuilt next pass. One is
finding 2: a cell that drew a link, an embed or an image drew another note's content, asked
of the rendered row rather than predicted from the value. The other was found in review of
the shipped signature, while the walk that spends it was being built: the frontmatter term
is read from the METADATA CACHE, while a `note.*` cell is drawn from the Bases ENTRY. The
cache fills asynchronously, so between an update Bases has answered and one the cache has
not, every unindexed row signs the same string — and a value that moved in that window
would have been kept behind it. `rowSignature` returns null there.

**`host.colWidths` is a pass-level input, though no row draws one.** A cell points at its
column's published custom property rather than holding a number, which is what lets a
resize drag move every row without a render at all. But the HEADER's grip is built from the
number, announces it as `aria-valuenow` and measures its next step from it — and a pass
that reuses leaves that header alone. So the width is a term of `renderInputs`, and a
keyboard resize rebuilds every row: exactly what it did before this decision, at one wasted
build per keypress.

**What the external-content rule costs.** A vault whose value columns are all link-valued
gets no reuse at all, and every row this pass BUILDS pays one `querySelector` for the
question. A vault whose value columns are text, numbers and dates keeps the whole win. If
the reconcile turns out never to activate on a realistic column set, that rule is too blunt,
and the per-cell refresh named in `reusableColumns` is the upgrade.

**The safe failure direction is stated and paid for.** A signature that differs when the
row would have drawn the same costs one wasted row build; one that matches when the row
would have drawn differently ships a stale row. Every judgement here takes the first — the
frontmatter goes in whole rather than key by key, four terms are kept that no test can
fail without, and a single non-`note.` column refuses reuse for the whole pass.

**Eleven of the sixteen per-row terms have a test that fails without them.** Measured by
deleting each term in turn and running `test/view/rowSignature.test.ts` **and**
`test/view/rowReuse.test.ts` — the walk's suite as well as the signature's own; the two
agree on which eleven. The other five are named in `rowSignature.ts`, in FOUR bullets
because the first names two held only as a pair, with the reason each cannot be isolated
rather than left reading as checked.

**What it bought, measured.** Interleaved A/B against `86b1170` — the last commit before
the reconcile, same fixture, same seven columns — four alternated runs, medians of the
panel's medians, folder fixture, tree expanded. `update` fell **0.324 → 0.104 ms/row at
832 rows (−68%)**, `render only` 0.275 → 0.083, and the same cut holds at 232 and 1632
rows with spreads that never overlap. The per-row cost does not climb with size — 0.116 →
0.104 → 0.099 — so the per-row signature walk is not eating its own saving, and the
reference-comparison upgrade the design named as a fallback is not owed on this evidence.
The carried child group is worth what it was meant to be worth: a reorder that moves all
832 rows costs 98.9 ms against 241.1 on the build that rebuilds everything. Every figure
is a **lower bound with a known direction and an unknown size** — the harness's fake entry
has no `renderTo`, so a real vault pays more per row than any of them, and skips more per
kept row too. The numbers, the instrument and its caveats are in
`docs/bugs/The render is the whole cost of a data update.md`.

**A pass that BUILDS got dearer, and that is the price of this decision.** `switch to
tree` — a full rebuild with reuse illegal because the projection changed — is **+17% at
232 rows and +17% at 1632, spreads not overlapping**, about **+0.11 ms per row built**:
signing a row that cannot be kept. Every build pass pays it, the mount included. It is
small against the ~0.22 ms/row the reuse passes save, and a data update happens far more
often than a projection switch, so the trade is the right way round — but it is a real
cost and it is stated rather than left out.

**Mount cost is untouched ONLY because the mount draws a COLLAPSED tree.** A first render
has nothing to reuse, so the ~0.3 ms per row is still paid in full when the view opens or
the projection changes — and the paragraph above is now also paid there. It does not show
in the measurement (mount reads −1% to +4% at every size, spreads overlapping throughout)
because a collapsed mount at `?notes=800` draws 39 rows, where +0.11 ms/row is a few
milliseconds inside the noise. **A vault that opens on an expanded tree pays it in full.**
The earlier flat claim that mount cost was untouched was narrowed here once the numbers
came in.

## Alternatives

**Virtualise the tree — render only the rows in the viewport.** Refused *for now*, not on
principle: it is strictly the bigger win, since it also fixes the mount, and it is the
obvious answer to a linear cost. What rules it out here is that this tree is not a list.
Rows nest, `content-visibility: auto` already recovers the layout half of the cost that
virtualisation's windowing would recover, and the pane's `role="tree"` with
`aria-activedescendant` requires the selected row to exist in the DOM — so a windowed tree
owes a correct `aria-setsize`/`aria-posinset` for rows it has not built, plus a scroll
anchor that survives a subtree collapse. That is a projection-shaped change against five
projections, where this one is confined to the tree's row walk.

**A cheaper per-row path.** Spent. The two cuts named in `## Context` are exactly this
alternative taken twice, and the bug note's own table says what is left: after both, the
render is still linear at ~0.3 ms per row and the remainder is `renderProjectionContent`
building rows nobody can see. A third constant-factor cut would have to find another
9–14%, which is inside this environment's measured drift.

**Re-render only what the update touched.** Refused because the information does not
exist: `onDataUpdated()` takes no arguments. Bases hands the view a whole result set and
says nothing about which note changed, and `applyWrites` cannot supply it either — a batch
defers its updates and flushes ONE refresh, by which point the set of touched files is not
correlated with anything the pass can see. `docs/issues/The outcome report was built from
one sentence.md` is the record of trying to build that correlation for a different
feature: eleven review findings across seven rounds without reaching a correct rule.

## Revisit when

- **MOUNT cost rather than update cost becomes the complaint** — opening the view, or
  switching projection, on a large vault. Nothing here helps either, and that is the point
  at which virtualisation stops being the bigger change and starts being the only one.
- **`projectionMember` stops being `inCatalog`** — a projection that draws both ladders, or
  a Deliverable row on a tree-shaped surface. `item.ladder` is the one thing a row draws
  from that `rowSignature` carries no term for, and what makes that safe is only that a
  ladder flip currently moves the row to a different projection, so it is never reused
  because it is never rendered. `stateKeyFor` and `ownWorkflowReading` both branch on
  `inCatalog`, so with that guard gone a state chip would draw the wrong workflow's value
  behind a byte-identical signature — **with no edit to `rowSignature.ts` and no test
  failing**. The fix is a `ladder` term, and this trigger exists because nothing else
  would announce the need for one.
- **A vault that shows a `file.*` or `formula.*` column asks for the same win.**
  `reusableColumns` refuses the whole pass for those today. The upgrade path is
  re-rendering those cells alone on a kept row, which costs a second reuse rule; it is
  worth taking when someone with such a column complains about the pause.
- **The per-item list is found short a fifth time.** Four rounds is evidence about the
  enumeration itself, not about the four fields. A fifth would say the safe direction has
  to be taken further — signing the rendered DOM rather than the inputs to it, at the cost
  of building the row to find out it was not needed.
