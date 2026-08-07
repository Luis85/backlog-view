# Expanding a card to see its direct children

**Date** 2026-08-07
**Delivers** one PBI, to be registered with this increment: `[[Children on the card]]`
under `[[Backlog and board]]`, beside `[[What a card shows]]`.

## Why this increment

A card says what an item *is* and, through its rollup, how much is done beneath it. It
does not say **what** is beneath it. On a focused board — the case the focus level
exists for — that gap is the whole hierarchy: a board of Epics shows eight cards and
eight progress bars, and the only way to learn which Features an Epic holds is to leave
the board.

The register already holds two partial answers, and this is neither of them:

- `[[What a card shows]]` extension 4b — children the board is not showing "surface as
  progress rather than disappearing". True, and a rollup is a *number*: it says three of
  eight, never which three.
- `[[Swimlanes by parent]]` (design only, not built) — group cards *by* their parent.
  That answers "how is that feature going" across a column, works on the board alone,
  and can only ever show a child that is itself a card. It is a different question, and
  both can exist.

A per-card disclosure is the third answer: one level of structure, on the card, in every
card projection. Azure DevOps cards carry child checklists and GitHub Projects a
sub-issue list for the same reason `[[What a card shows]]` already cites — on a board,
the hierarchy has to travel on the card.

## Scope

**In:**

- A disclosure on the shared card body listing an item's **direct** children — one
  level, never a nested tree.
- Board cards, roadmap horizon-bucket cards and roadmap shelf cards, because all three
  are built by `renderCardBody`.
- Expansion backed by the existing per-path collapse state, so it persists per saved
  view per device.
- Removing the projection gate on the toolbar's Expand all / Collapse all, so those
  controls reach cards. Its stated reason — the card projections have nothing
  collapsible — is what this feature retires.
- A card-menu path to the same children, because each card projection is one tab stop.

**Out:**

- Grandchildren, at any depth. One level is the feature.
- Timeline rows. They reuse the card *shell* (`createCard`, `wireCardActivation`) with a
  bar-grid row layout and deliberately never call `renderCardBody`; a disclosure inside
  that geometry is a separate piece of work with its own appearance question.
- Any write. Nothing here reparents, reorders, retypes or restates. Dragging a child out
  of the list, dropping onto the list, and creating a child from it are all out — the
  disclosure is a read affordance, and that is what makes the context-row rule hold by
  construction rather than by a check (see Architecture §6).
- Swimlanes. Untouched, still `[[Swimlanes by parent]]`'s.

## Behaviour

### The disclosure

A card whose **visible** direct children number one or more renders a disclosure line as
the last element of the shared card body: a chevron, and a count naming the children's
type when they share one (`3 features`) or the neutral `3 items` when they do not.

The plural is a naive `+ s`, the same shape `columnLabel` already uses for `1 card` /
`2 cards`. Type names are user data, so a declared type that does not pluralize that way
reads slightly wrong; the ceiling is a word, never an action, and it is
[[English ships alone]] that makes it acceptable for now. The `1 child` / `n children`
fallback needs no such caveat.

A card with no visible direct children renders nothing at all — no chevron, no empty
line. That is the tree's own rule for a row whose children have all hidden: the chevron
follows *visible* children, never `children.length`.

Expanded, the line is followed by the list. Each entry carries the child's type badge
(`renderBadge`, so a Task and a Bug are distinguishable) and its title through
`renderTitleText`, so a quick-filter match highlights in the list exactly as it does in
a row or a card title. A child that is itself done is styled done, by the same `pbl-done`
class rows and cards already use — on `item.done`, the card's own test, not on
`subtreeDone`, which is the *hiding* rule and answers a different question.

### Which children

`!host.isRowHidden(child)` — the single predicate the tree and both card projections
already share. So:

- With "Show completed items" off, a fully-done child is absent from the list, and the
  card's rollup still counts it. The two numbers differ on purpose; the disclosure's
  tooltip says it lists what is shown and the rollup counts everything beneath.
- While the quick filter runs, only children on a match path are listed.
- A child that is itself a context row (`outsideFilter`) is listed when visible, and the
  rule that governs it is unchanged: it renders, it parents, it is never written.

A child that has a **card of its own** elsewhere in the projection is still listed. The
disclosure answers "what is under this item", and that answer does not change with where
else the item happens to be drawn.

### Opening a child

Clicking an entry opens the child. Middle-clicking opens it in a new tab. Both stop
propagation, and **both** must: a middle click never fires `click`, so stopping the
primary event alone still let the card's `auxclick` open the *parent* in a new tab. That
is a bug this codebase already shipped and fixed once, in the card's search-match links;
the same two handlers are the fix here.

**The toggle stops propagation too.** `wireCardActivation` listens on the whole
`.pbl-card`, so a click on the disclosure button bubbles to it and opens the parent note
— the same defect as above, on the one control whose entire purpose is to *not* leave the
board. It is the more dangerous instance, because the card still expands underneath the
note that just opened, so the toggle looks like it worked. Every listener this feature
adds inside a card stops propagation; the rule is stated once, at the card boundary,
rather than remembered per control.

### Expansion state

`host.isCollapsed(path)` and `host.setCollapsed(path, …)` — the tree's own state, not a
second one. Consequences, all of them intended:

- A card opens collapsed the first time it is seen, and stays where the user left it
  across data updates, sessions and projection switches.
- Expanding an Epic's card also expands that Epic's row in the tree, and vice versa. One
  bit, one meaning: *this node is open*.
- Collapse all and Expand all in the toolbar drive cards, **once their gate is
  removed** — see Architecture §5. They render today only under
  `host.projection === 'tree'`, on the stated grounds that "the board and the roadmap
  have nothing collapsible yet", which is precisely what this feature retires. Sharing
  the store is not on its own enough to make them reachable, and a promise that the
  toolbar does not keep is the defect this repository files under *write the guarantee
  to the check, never ahead of it*.
- `collapseNewParents` settles each path once, so a write does not snap open cards shut.

**While the quick filter runs, the toggle is `disabled`.** The filter *overrides* collapse
state rather than replacing it — `BacklogView.isCollapsed` returns
`!filter.active && collapse.isCollapsed(path)`, so everything on a match path renders
expanded — while `setCollapsed` still writes through. A live toggle would therefore
mutate persisted state, report expanded on the very next read, appear to do nothing, and
then collapse the item minutes later when the filter cleared. The tree already refuses
that: its collapse controls take a real `disabled` flag in `syncFilterUi`, on the stated
grounds that disabling a focusable control in CSS is a lie — `pointer-events: none` stops
a mouse and nothing else. The card's toggle takes the same flag, from the same place, for
the same reason. Filtering thus lists every visible card's children, which is what makes
the deduplication rule below unconditional rather than a special case.

Toggling rebuilds **that card's list in place** and nothing else — no board rebuild, no
model rebuild, and no element search: the handler closes over the card's own container.
Expansion is read live inside the handler (`host.isCollapsed`), never captured at wire
time, because a surrounding refresh can change it under a listener that is still
attached.

### Not saying the same thing twice

While the quick filter runs, a board card already names the matches hiding beneath it
(`renderCardMatches` / `hiddenMatches`), and a matched direct child is by definition on
a match path, therefore visible, therefore in the disclosure's list. Without a rule the
two lists would name it twice on one card.

The rule: **the match list drops any item the disclosure lists.** The walk itself is
untouched, so a match three levels down still surfaces where nothing else can reach it —
only the depth-one duplicate goes. It is unconditional, not conditional on the card being
expanded: a collapsed disclosure still says `3 tasks` and is one click from the child, so
the match stays reachable, and making the match list depend on expansion state would mean
a toggle had to rebuild it too.

`addMatchSection` in the card menu applies the same exclusion, from the same helper, for
the same reason.

### Keyboard and assistive technology

The board and the roadmap are each **one tab stop**; arrows move the selection between
cards. So, exactly as `.pbl-add`, the state chip and the match links already are:

- The disclosure toggle is a real `<button>` with `tabindex="-1"` and `aria-expanded`,
  reachable by assistive technology and invisible to Tab.
- Each child entry is a `<button>` with `tabindex="-1"`.
- The **card menu is the keyboard path**: a children section offering an
  `Open child "…"` entry per listed child. Without it the feature is pointer-only, which
  is the failure the match links' own comment names — a list of children nobody without a
  mouse can reach is not a list of children.

The menu offers **no expand/collapse entry**, deliberately. The purpose of the keyboard
path is to *reach* a child, and `Open child "…"` reaches it whether the card is expanded
or not — expansion is a visual affordance, and the toggle itself is already activatable
by assistive technology, which is exactly what `tabindex="-1"` buys. Adding the entry
would buy nothing and cost a new host API: `buildItemMenu` holds only `host` and `item`,
the in-place rebuild lives in a closure the render owns, and `refreshSubtree` is the
tree's. So the entry could set collapse state but not redraw the card without a full
`host.render()` — a board rebuild, contradicting the paragraph above it. A menu entry
whose only honest implementation is the thing the spec forbids is an entry not worth
having.

The list is a `<ul>` of `<li>`s labelled by the disclosure, so a reader is told how many
children there are before it reads them.

## Architecture

### 1. `src/view/render/cardChildren.ts` — new module

Exports two functions:

- `listedChildren(host, item)` — the visible direct children, in model order. One
  `filter` over `item.children`; deliberately **not** a domain function, because it
  states no rule the domain does not already own. `isRowHidden` is the rule, and it
  lives in the view because it is a render decision.
- `renderCardChildren(ctx, card, item)` — the disclosure and, when expanded, the list.

It is its own module rather than more of `render/board.ts` (338 lines, and rising each
time a card grows something) for the reason the architecture already states: one file per
concern. Nothing about a child list is a board concern — it is a *card* concern, which is
why the roadmap gets it from the same call.

### 2. `renderCardBody` calls it

One line, at the end of the body, after `renderRollup`. Board cards, bucket cards and
shelf cards all get it; timeline rows do not, because they never call the body. No
per-projection branching, and therefore no way for a card to look different depending on
what drew it — the property `[[What a card shows]]` exists to keep.

### 3. `renderCardMatches` filters through `listedChildren`

One `.filter` at the call site in `render/board.ts`. `hiddenMatches` in
`domain/board.ts` is unchanged: its walk is what makes deep matches reachable, and
narrowing the walk would take grandchildren with it.

### 4. `addChildrenSection` in `src/view/interactions/menu.ts`

Beside `addMatchSection`, reading the same `listedChildren`. `Open child "…"` entries
only — see Behaviour, Keyboard and assistive technology, for why there is no
expand/collapse entry.

**The gate is not the projection.** `showItemMenu` has exactly two call sites:
`render/rows.ts` for tree rows, and `wireCardActivation` in `render/board.ts` — which
board cards, roadmap bucket cards, shelf cards **and timeline rows** all share. So
`host.projection !== 'tree'` would put `Open child` on a dated-axis timeline row, which
draws no body and therefore no disclosure, and which this spec's Scope excludes. Nor
would gating on the axis work: the dated axis draws timeline rows *and* an ordinary
shelf of real cards, so the axis does not separate the two either.

The question the gate actually needs to ask is **did this surface draw a card body**,
because that is what draws the disclosure. So `wireCardActivation` takes it as a
parameter and `render/timeline.ts` — the one card-shell caller that never calls
`renderCardBody` — passes false. The section then renders on that flag and a non-empty
`listedChildren`. This replaces the projection check rather than joining it: tree rows
reach the menu through `rows.ts` and never set the flag, so the tree is excluded by the
same rule instead of by a second one. Naming the real condition also means a future
surface that reuses the card shell without the body is right by default.

### 5. `renderToolbar` — remove the collapse controls' projection gate

Expand all and Collapse all are wrapped in `if (host.projection === 'tree')`, whose
comment gives the reason: "the board and the roadmap have nothing collapsible yet, and a
control that visibly does nothing is worse than none." Both halves stop being true here,
so the gate goes and the comment with it. `Collapse all` already iterates `model.items`
and skips childless ones, so it needs no other change: in a card projection it shuts
every disclosure, which is the same sentence it means in the tree.

They stay `disabled` while the quick filter runs, from the same `syncFilterUi` call that
disables them today — the rule the card's own toggle now follows for the same reason.

### 6. Context cards

A context card (`outsideFilter`) gets the disclosure like any other card. Nothing has to
be withheld and nothing has to be checked, because **no path in this feature plans a
write**: there is no drag source, no drop target, no menu action that writes, and no
creation entry. The context-row rule — never a write target, never a ranking peer, never
a source of anything derived from the Base's results — is satisfied by the feature having
no write at all, and the third clause by the disclosure deriving nothing: it counts what
it lists, and the rollup that *is* derived from results is untouched.

The rule still gets a check rather than a paragraph. `test/view/contextCardWrites.test.ts`
already asks its three questions of each card projection; this adds the disclosure to
what it drives, so a future edit that gives the list a write is caught by the suite that
exists for exactly that.

### 7. `styles/card-children.css` — new partial

Imported after `cards.css`, since it styles a part of a card and the import **order**
decides which of two equal-specificity rules wins. One partial per concern, under the
400-line assembly gate like every other.

## Cost

The disclosure adds one `filter` over `item.children` per card per render pass — direct
children only, no walk. When collapsed, nothing else. When expanded, one `<li>` and one
badge per listed child, which is the same per-item cost the tree pays for the same
children. The render-cost invariant that matters is the one about *searching* for
elements, and this adds no query: the toggle holds its container in a closure, exactly as
the tree's per-row controls hold theirs.

## Testing

`test/view/cardChildren.test.ts` — new file, driving the real view through the jsdom
harness:

- A card with visible direct children renders the disclosure; the count and its type
  wording are right for a shared type and for a mixed set.
- A childless card renders no disclosure, and neither does one whose children are all
  hidden — the leaf rule, asserted at the hidden case, not just the empty one.
- Expanded, the list holds exactly the direct children — a grandchild is absent, which is
  the one-level rule stated where it can fail.
- "Show completed items" off removes a done child from the list while the rollup keeps
  counting it, so the deliberate disagreement is pinned rather than assumed.
- A filtered card lists only children on a match path, and the match list no longer names
  a child the disclosure lists — the duplicate rule, from the rule and not from the
  implementation.
- Clicking a child opens **the child**; middle-clicking opens the child in a new tab.
  Both assert the parent was not opened, because that is the failure mode.
- Clicking the **toggle** opens nothing — the same assertion on the control that must
  never leave the board, since an expansion that also opened the note would still look
  like it worked.
- The toggle is `disabled` while the quick filter runs, and every card lists its children
  in that state. Asserted on the flag, not on a class: a control disabled only in CSS
  still answers a keyboard.
- The toggle writes collapse state, and an expanded card survives a data update — the
  regression that ephemeral state would have caused.
- Expanding a card expands the same item's row in the tree, since that shared bit is a
  decision and not an accident.
- The card menu offers the same children the card lists — and a **timeline row's** menu
  does not, because it drew no body. Asserted on the dated axis, where a bar row and a
  shelf card sit in one projection and only one of them has a disclosure; a test that
  drove the projection alone would pass while the rule was wrong.
- Expand all and Collapse all render in board and roadmap mode and drive the cards'
  disclosures, and stay disabled while the quick filter runs. The first half is the
  claim the toolbar's gate would otherwise have silently broken.

`test/view/contextCardWrites.test.ts` — extended: a context card's disclosure renders,
lists, opens, and writes nothing on any of its paths.

Coverage thresholds in `vitest.config.mts` rise to whatever the suite reaches, per the
standing rule that they only ever go up.

## Register work

- New PBI `[[Children on the card]]` under `[[Backlog and board]]`, ordered after
  `[[What a card shows]]`, naming `src/view/render/cardChildren.ts` in its
  `## Where it lives` — which is what satisfies `docs-check.mjs` rule 7 for the new
  module.
- `[[What a card shows]]` extension 4b gains a pointer to it. The rollup answer stays
  true; it is no longer the only one.
- `[[Hierarchy on the board]]` and `[[Hierarchy on the roadmap]]` each gain a link, since
  the new PBI serves both features from one implementation while living under neither.

## Definition of done

`npm run check` — build, lint, coverage-thresholded tests, fallow, docs register — on the
branch, before the commit. Appearance is the part jsdom cannot answer: the disclosure's
look in a real pane, in light and dark, and whether an expanded card inside a column
scrolls sensibly, need `npm run test-build` and a live vault. That check is named here so
it can be registered as a smoke-test issue rather than assumed.
