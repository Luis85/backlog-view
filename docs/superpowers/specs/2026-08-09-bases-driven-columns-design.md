# Columns come from the Bases properties menu

Design, 2026-08-09. Scope: the tree's trailing column strip, and the two card
projections that share its resolved list.

## The problem

Two things decide what a row shows today, and they disagree about what "shown" means.

`chipProps` (`src/view/render/columns.ts`) reads `config.getOrder()` — the Bases
properties menu — and **subtracts** the four properties this plugin renders specially:
the requirements state key, the resolved Deliverable state key, the horizon key and the
risk key. Those four come back as fixed columns pinned after the properties in a fixed
order (`.pbl-props` → risk → horizon → state → meta), each gated on its own settings
predicate rather than on Bases visibility. So the properties menu drives the plain
columns' visibility and order, and nothing else: a state chip renders because
`stateKey` is configured, in a position no user chose, whether or not the property is
visible in the base.

The consequence is that "which properties does this view show" has two answers, and the
one the user is looking at — the properties menu — is not authoritative.

## The decision

**The Bases properties menu is the single source of what renders and in what order,
for plain properties and special ones alike.** A configured state, horizon, risk or
tags property draws its chip when it is visible in the menu, in the position the menu
gives it, and draws nothing at all when it is not.

Four choices were made explicitly, with the rejected alternatives:

1. **Visibility is fully Bases-driven.** Rejected: keeping the four specials
   settings-gated and taking only their POSITION from the menu (two rules where the
   point of the change is to have one), and seeding the visible order from the plugin
   (the API cannot — see *The first-run gap*).
2. **Narrowing drops the last column in the order first, with the rollup exempt.** The
   user's order is their own statement of what matters, so a hardcoded usefulness
   ranking is a second opinion about it. The rollup is not in that order — it is pinned
   past its end — so "rightmost" would otherwise always pick it first; it drops after
   every property column instead. Rejected: keeping today's fixed ladder (properties →
   risk → rollup → horizon → state), which would leave the header order and the drop
   order disagreeing about what is important.
3. **One width for every column**, the existing `propertyColumnWidth` slider (132px
   default, 80–280). Rejected: chips keeping their own 116px (three constants and a
   per-column sum kept for nothing), and a per-kind floor. At the 80px end a chip is an
   icon and a truncated value; it already truncates, and the tooltip already carries the
   full text.
4. **Cards keep plain properties only.** A board or roadmap card renders `value` and
   `tags` columns and skips the rest, as it effectively does today. Rejected: cards
   drawing chips minus whatever the projection already expresses (a per-projection skip
   to maintain), and cards drawing all of them (a state chip repeating the column the
   card sits in).

## The column model

`chipProps` becomes `resolveColumns`, still resolved once per data update onto the host
— `host.chips` renames to `host.columns`, since chips are no longer what it holds — and
still the one list every reader takes. Deriving it twice is how the tag menu came to
offer editing for a column the renderer had skipped; that stays true.

```ts
export type ColumnKind = 'value' | 'tags' | 'state' | 'horizon' | 'risk';

export interface Column {
	prop: BasesPropertyId;
	label: string;
	kind: ColumnKind;
}
```

It walks `config.getOrder()` in order, drops the ids below, and tags each survivor with
a kind. No entry is subtracted for being special any more — that subtraction was the
bug.

**Still skipped, and why:** `file.name` (the title is the row), `note.<parentKey>` (the
tree is the parent column), `note.<typeKey>` (the badge is the type), `note.<orderKey>`
(an implementation number, not a fact about the item). These are the view's own
machinery rather than properties it declines to show.

**Kind is decided by the predicates that gate the chips today**, unchanged:

| kind | when |
| --- | --- |
| `state` | the id is `note.<stateKey>` or the resolved Deliverable state key |
| `horizon` | the id is `note.<horizonKey>` **and** `hasHorizonAxis(settings)` |
| `risk` | the id is `note.<riskKey>` **and** `hasRiskLevels(settings)` |
| `tags` | the id is `note.<tagsKey>` |
| `value` | anything else |

The `and` in two of those rows preserves an existing rule for free: a risk property
whose levels list has been cleared has no chip to draw, so it falls through to `value`
and renders as an ordinary column. Same for a horizon property with no declared values.
The pairing is what makes a chip whose menu could set nothing impossible.

**Two state columns become legal.** With the requirements and Deliverable state
properties both visible, the menu yields two columns. Each renders a chip only on rows
whose own workflow it is — `stateKeyFor(settings, item) === <this column's key>` — and
an empty cell otherwise, which is the rule the single column already applied per row.
Each takes its own property's display name, so `stateColumnLabel` and its "call it
*State* when the two keys differ" fudge are deleted: the fudge existed because one
column held two properties, and it no longer does.

## Rendering

The DOM shape is unchanged and has fewer elements in it:

```
.pbl-row-spacer → .pbl-props (every column, in order) → .pbl-meta-col → add button
```

A chip cell is a `.pbl-prop` carrying a kind modifier, not a column element of its own,
so `.pbl-state-col` / `.pbl-horizon-col` / `.pbl-risk-col` and the three width constants
and three CSS custom properties behind them all go. The chips' own markup and behaviour
— `renderStateChip`, `renderHorizonChip`, `renderRiskChip`, their static
`.pbl-state-static` form for a context row, the menus they open through `chipMenu` — are
untouched, except that `renderStateChip` takes the column's key so it can ask whether
this row's workflow is the one this column names.

`renderColumnHeader` loses its four appended `if` blocks and becomes the loop over
`ctx.columns` it already contains, plus the rollup header and the add spacer.

`renderCardBody` filters the same list to `value` and `tags` before calling
`renderPropCells`. One filter over the one resolved list — not a second resolution.

## Narrowing

`columnFit` returns an integer — how many leading columns fit — instead of five
booleans. The budget:

```
lead = ROW_LEAD_WIDTH + TREE_PADDING + depth * INDENT_PER_DEPTH
meta = settings.stateKey || settings.showCounts ? META_COL_WIDTH : 0
k    = the largest 0..columns.length with  width >= lead + col * k + meta
       (and if no k satisfies it, k = 0 and the rollup drops too)
```

`syncColumnFit` publishes `k` as `--pbl-cols-shown` on the tree element and keeps one
boolean for the rollup. `.pbl-props` narrows to `calc(var(--pbl-prop-col) *
var(--pbl-cols-shown))` and its existing `overflow: hidden` clips the rest; because `k`
is a whole number of fixed-width columns, cell `k+1` begins exactly at the box edge and
is clipped entirely rather than shrunk. The header reads the same variable, so the two
cannot fall out of alignment — the property the old four-class ladder had to maintain by
having every column in the sum is now structural.

`syncColumnFit` still returns whether the verdict CHANGED, and the caller still owes the
rows exactly one more pass when it did; the re-measure policy in `src/view/resize.ts` is
unchanged. The render initializes `--pbl-cols-shown` to the full count, so the variable
means one thing (how many are shown) at both times.

`ROW_LEAD_WIDTH` is unchanged: it never carried chip terms.

## What is deleted

- The `showProperties` view option, the `showChips` setting, its resolver line and its
  default. The properties menu is the off switch now, and a second one that would also
  kill the chips is exactly the split this change removes. Pre-1.0 breakage is
  sanctioned (ADR 0016); a saved base that had it off shows its visible properties
  again, recoverable in one click from the menu the feature now points at.
- `STATE_COL_WIDTH`, `HORIZON_COL_WIDTH`, `RISK_COL_WIDTH`; `--pbl-state-col`,
  `--pbl-horizon-col`, `--pbl-risk-col`; the `.pbl-state-col` / `.pbl-horizon-col` /
  `.pbl-risk-col` rules in `styles/columns.css`.
- The five `pbl-hide-*` rules in `styles/propertyColumns.css`, the block in
  `styles/cards.css` that exists to counter them on cards, and the `removeClass` call in
  `src/view/backlogView.ts` that clears stale verdicts on entering a card projection.
  With the width driven by a variable the card CSS already overrides, there is no stale
  verdict to clear.
- `hasStateColumn` (`src/domain/board.ts`). `render/columns.ts` is its only caller, and
  the question it answers — does either workflow name a key — stops being asked once a
  column exists because the property is visible. `stateKeyFor` and `ownWorkflowReading`
  stay: they answer the per-row question, which is the one that survives.
- `stateColumnLabel`.

The change is net subtraction.

## The first-run gap

`BasesViewConfig` (checked against the 1.13.1 typings) exposes `getOrder()` and no
setter; `set()` is documented for the view's own options. So ✨ (`runInit`) can bind a
state property and stub it onto every note, and the user still sees no chip until they
add the property in the Bases properties menu. That is the accepted cost of one
authoritative source.

One sentence covers it: the success Notice in `runInit` gains a clause naming the next
step — add them in the properties menu to show them as columns. The Notice already
enumerates what was bound, so it is the place where the missing half of the loop is
noticed.

Not built, and recorded here so it is not re-derived: `baseFileContent`
(`src/storage/baseFile.ts`) could write an `order:` list into the scaffolded `.base` so a
scaffolded backlog draws its chips immediately. Whether Bases keeps an order entry
naming a property no note carries yet cannot be answered in this repository, so it is a
live-vault experiment rather than part of this change.

## Checks

The logic concentrates in `resolveColumns`, so that is where the tests concentrate
(`test/view/columns.test.ts`, extending the existing suite):

- The order of `getOrder()` is the order of the columns, specials interleaved.
- A visible state / horizon / risk / tags property draws its chip in its declared
  position.
- **A configured but invisible one draws nothing anywhere** — the invariant the whole
  change rests on, asserted per kind rather than once, since four predicates decide it.
- A visible risk property with the levels list cleared renders as a plain value column,
  and the same for a horizon property with no declared values.
- Both state properties visible yields two columns; each draws a chip only on rows whose
  own workflow it names, and an empty cell on the others.
- The skip list still holds: parent, order, type and `file.name` draw no column even
  when visible.

Fit (`test/view/columns.test.ts`'s existing narrowing block, rewritten): `k` falls as the
pane narrows, the rollup survives until `k` is 0, and widening returns the columns in the
order they left.

Cards: a chip-kind column draws nothing on a board or roadmap card, and the plain
columns still do.

`test/view/contextRowWrites.test.ts` and `test/view/contextCardWrites.test.ts` already
drive every write path against context rows and need no new cases; they are what catches
a chip that forgot its static form while being moved.

`test/view/renderCost.test.ts` pins `getOrder` / `getDisplayName` to once per data
update; the rename must keep that true.

Fixtures: `demoOptions()` in `test/helpers/fixtures.ts` drops `showProperties` and the
harness's config gains a visible order carrying `note.status`, `note.horizon`,
`note.risk` and a plain property, so `npm run harness` draws the interleaved strip.

## Docs

- `docs/requirements/Property columns.md` is the owning PBI and states the old rule
  throughout — main flow, extension 3a's four-step drop, acceptance criteria, and the
  `## Where it lives` paragraph that `docs-check.mjs` rule 7 reads. Rewritten.
- `docs/issues/Tree columns and narrowing.md` is a live-vault checklist whose four-step
  drop order no longer exists. Rewritten against the new rule.
- A new ADR records the decision and the four rejected alternatives above, because the
  refusals are what a later reader would otherwise re-derive.
- `src/view/CLAUDE.md`'s **Controls** section describes the fixed strip, the four hide
  classes and the usefulness ladder, and follows the code.
- Any other note naming a deleted symbol or class is found by `npm run docs`, which
  gates every source path a current note claims.

## Out of scope

- The board's own column strip and the roadmap's axes. This is the tree's trailing
  columns and the two card projections that share the resolved list.
- Making parent, order or type renderable as columns when visible.
- Writing the Bases property order from the plugin, in either the init action or the
  scaffold.
