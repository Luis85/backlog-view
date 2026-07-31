# Product Backlog — an Obsidian Bases view

An [Obsidian](https://obsidian.md) plugin that adds a **Product Backlog** view type to
[Bases](https://help.obsidian.md/bases). It turns a flat list of notes into a sortable
work-item tree — **Epics → Features → PBIs → Tasks** — inspired by the backlog in
Azure DevOps Boards.

```text
▾ [Epic]    Customer Portal            (7)
  ▾ [Feature] Self-service login       (3)
    ▸ [PBI]   Password reset flow      (2)
      [Task]  Design reset email
      [Task]  Add token endpoint
    [PBI]     SSO with Entra ID
  ▸ [Feature] Usage dashboard          (2)
▸ [Epic]    Billing revamp             (4)
```

## How it works

- All items live **flat in one folder** — the hierarchy comes from properties, not subfolders.
- A folder holds more than work items, so the view only shows the notes that **belong to
  the hierarchy**: a `type` matching one of the configured levels, or a parent. Meeting
  notes, references and READMEs sitting in the same folder stay out of the tree (and out
  of the backfill). The toolbar says how many notes it skipped.
- Each item is an ordinary markdown note. The view reads three frontmatter properties:
  - **`parent`** — a link to the parent item (`"[[Customer Portal]]"`). Items without a
    parent are top-level.
  - **`order`** — a number that ranks an item among its siblings.
  - **`type`** — the hierarchy level (`Epic`, `Feature`, `PBI`, `Task`, … configurable).
- **You never have to maintain these properties by hand.** The view assigns them:
  - Creating an item via the view writes `type`, `parent` and `order`.
  - Dragging an item writes its new `parent` and `order` (and, optionally, its new `type` —
    including consistent types for the explicitly-typed items of a moved subtree).
  - Items without a `type` show a level implied from their parent's type (a child of a
    Feature reads as a PBI, wherever that Feature sits).
  - The toolbar's ✨ **Assign missing properties** button backfills `type` and `order` for
    notes that don't have them yet, without overwriting existing values — and never
    guesses a type for items whose parent is outside the view.

## Requirements

- Obsidian **1.10.2 or newer** (the Bases custom-view API).
- The **Bases** core plugin enabled.

## Setup

The fast way: run the **Product Backlog: Create backlog** command. It asks for a folder
(default `Backlog`), creates it together with a fully configured `Product Backlog.base`
inside, and opens the view — from empty vault to working backlog in one step.

Manually, the equivalent is:

1. Create a folder for your backlog, e.g. `Backlog/`.
2. Create a Base (e.g. `Product Backlog.base`) and add a filter such as
   `file.inFolder("Backlog")`.
3. In the view switcher of the Base, add a new view and pick **Product Backlog**.
4. Drop existing notes into the folder, or use **+ New Epic** in the view to create items.
5. If your notes don't have `type`/`order` yet, click the ✨ toolbar button once. Notes
   with neither a supported `type` nor a `parent` aren't treated as backlog items — to
   organize a folder of plain notes by dragging, turn **Ignore notes outside the
   hierarchy** off in the view options first.

Example `.base` file:

```yaml
filters:
  and:
    - file.inFolder("Backlog")
views:
  - type: product-backlog
    name: Backlog
    order:
      - note.status
      - note.points
```

Any properties you enable under **Properties** in the Bases toolbar (the `order` list
above) are shown as chips on each row — handy for `status`, story points, assignee, etc.

## Using the view

| Action | How |
| --- | --- |
| Expand / collapse | Click the chevron, or use the toolbar buttons |
| Open an item | Click the row (Ctrl/Cmd-click for a new tab) |
| Re-order among siblings | Drag a row and drop it **between** two rows |
| Re-parent | Drag a row and drop it **onto** the middle of the new parent |
| Make an item top-level | Drag it onto the **Move to top level** strip at the bottom |
| Create a child item | Hover a row and click **+**, or use the context menu |
| Create any level at the top | Toolbar **New** button, or the **▾** menu next to it for other levels |
| Focus one backlog level | Toolbar level button next to **New** → pick a level (**All levels** returns) |
| Move without dragging | Right-click → Move up / down / to top / to bottom / Indent / Outdent |
| Change an item's type | Right-click → Set type |
| Change an item's state | Click the state chip on the row, or right-click → Set state |
| Add a tag | Click the **+** in the row's tag column, or right-click → Edit tags |
| Remove a tag | Hover the row and click the **✕** on the tag |
| Hide finished work | Click the eye button in the toolbar (or toggle **Show completed items** in the view options) |
| Open in a new tab or split | Middle-click, Ctrl/Cmd-click, or right-click → Open in new tab / Open to the right |
| Find items | Type in the toolbar filter (or press <kbd>/</kbd> in the tree) — matches keep their ancestors and subtrees, Escape clears |
| See counts per level | Hover the item count in the toolbar |

While the filter is active the tree ignores collapsed state and drag and drop is
disabled (visual neighbors aren't necessarily real siblings); keyboard navigation and
the context menu keep working on the filtered rows.

### Focus on one backlog level

Like the separate Epics / Features / Stories backlogs in Azure DevOps, the focus level
re-roots the tree at any level: pick *Feature* from the level button next to **New** in the
toolbar and every feature becomes a top-level row with its PBIs and tasks below it. While
focused, that button shows the level, accented, with a `✕` beside it that returns to all
levels in one click (so does picking *All levels*). Items keep their real parents —
re-parenting by dropping *into* a row still works — but the top row of a focused view has
no shared ranking, so reordering, indent/outdent and the top-level drop strip are disabled
there.

### Folder-based backlogs

Backlogs organized as folders work too. Enable **Infer hierarchy from folder notes** in
the view options for structures like:

```text
product-managements/
  payments/                      (a folder per product domain)
    epics/
      Checkout/
        Checkout.md              (folder note → top-level Epic)
        One-click pay/
          One-click pay.md       (folder note → Feature under Checkout)
          use-cases/
            Pay with saved card.md   (→ PBI under One-click pay)
```

Notes without an explicit `parent` link attach to the nearest ancestor **folder note**
(a note named like its folder, e.g. `Checkout/Checkout.md`). Container folders without
a folder note — `epics/`, `use-cases/`, the domain folders — simply pass through, and a
folder note itself looks for parents above its own folder. Untyped notes still imply
their level from the parent chain, so a note under a typed Feature reads as a PBI.

Rules to know:

- An explicit `parent` link always overrides the folder structure, which is exactly what
  drag and drop writes — so re-parenting works as usual, but **files are not moved on
  disk**. The folder tree and the parent links can diverge; the links win. Right-click →
  **Use folder position** removes the override and returns the item to its folder parent
  (retyped for that level, together with its typed subtree, when auto-type is on).
- Moving an item to the top level writes an empty `parent` property as a "pinned to top
  level" marker (deleting it would just re-infer the folder parent). **Clear parent
  link** on an orphaned item removes the property entirely, so in folder mode the item
  returns to its folder position.
- A folder note is a parent, so every note below it counts as a backlog item even without
  a `type` — in folder mode the folder structure *is* the hierarchy. Notes in folders
  without a folder note above them still need a supported `type` to appear.
- New child items are created in their parent note's folder.
- If your domain folders also contain folder notes inside the filter, they become the
  top level — add a level name for them (e.g. `Domain, Epic, Feature, PBI, Task`).

### Properties on a row

Every property you make visible in the Base gets its **own fixed-width column** at the
end of the row, in the order the Base lists them, with the names in a header pinned to
the top of the tree. Values line up down the page instead of trailing each item's title,
so adding a property doesn't turn the rows into ragged text — a long Epic title and a
short Task title put their `points` in the same place. **Property column width** in the
view options sets how wide one column is; a value too long for its column is truncated,
with the full text (and the property name) in its tooltip.

Columns never shrink — that is what keeps them aligned — so a long title truncates
first, and a pane too narrow for the columns it is asked to show drops them instead of
clipping them: the properties go first, then the progress rollup, leaving the title and
the state chip. The view measures this against the width you configured, so wide columns
give way earlier than narrow ones.

Rows carry no `Property:` labels of their own — that is what the header is for. Turn the
columns off entirely with **Show visible properties on rows**.

#### Tags

When the property named by **Tags property** (`tags` by default) is one of the visible
properties, its column becomes editable:

- each tag renders as a pill; hover the row and click the **✕** on a pill to remove it,
- the **+** at the end of the column opens the tags already used in this base, checked
  where the item carries them, plus **New tag...** for a free-text one (with
  autocomplete),
- right-click → **Edit tags** offers exactly the same list, for the keyboard path.

Tags are written to frontmatter as a list, and typed input is normalized to a usable tag
(`#Sprint 12!` becomes `Sprint-12`); input Obsidian would not accept as a tag at all — a
number like `123` — is refused with a notice instead of being written (`2026-07` is
fine: the hyphen is the non-numeric character Obsidian asks for). Removing the last
tag removes the key rather than leaving an empty list behind. Rows loaded as context from
outside the Base's filter show their tags but offer no editing, like every other write in
this view. Point **Tags property** at another key, or clear it, and that property goes
back to rendering as a plain, read-only value.

### States and progress

Set the **State property** (e.g. `status`) in the view options and parents show a
progress bar with a done count (e.g. `3/7`), while done items dim out. Which values count
as done is configurable (`Done, Closed, Completed, Removed` by default, case-insensitive).

The state chip and the progress rollup sit in **fixed columns at the end of each row**,
so they line up vertically no matter how long an item's title is or how deep it sits in
the tree — the eye can scan states down the column instead of hunting for them behind
each title. The Base's visible properties get the same treatment, one column each,
just before them (see [Properties on a row](#properties-on-a-row)).

Each row then carries a clickable **state chip**: pick a new state from its menu (also
available via right-click → **Set state**) and the note's frontmatter updates without
opening it. The menu offers the **Workflow states** configured in the view options — or,
when none are configured, the states already used in the backlog, with a done state
appended so marking an item done is always one click away. An item whose state isn't in
the list keeps it selectable in its own menu.

The toolbar's eye button (or the **Show completed items** view option) hides finished
work: an item disappears once it *and its entire subtree* are done — a done parent with
open children stays visible, so unfinished work can never hide. Progress bars keep
counting hidden items, the quick filter still finds them, and moving or dropping rows
around hidden siblings stays safe because ranking always runs over the real sibling
lists.

While dragging, hovering the middle of a collapsed row expands it after a moment (the
chevron lights up while the timer runs) so you can drop deeper into the tree. Dropping an
item onto its own descendant is prevented. Which items are collapsed is remembered per
view in the `.base` file. Indent guides connect each child group to its parent, and on
touch devices the per-row **+** button and the tag add/remove controls are always
visible, with larger touch targets.
The tree is a real ARIA tree — screen readers announce level, position and expansion
state — and the view honors reduced-motion and right-to-left settings.

### Keyboard

Click or <kbd>Tab</kbd> into the tree first, then (mirroring Azure DevOps backlog
shortcuts where sensible):

| Keys | Action |
| --- | --- |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Select the previous / next visible item |
| <kbd>Home</kbd> / <kbd>End</kbd> | Jump to the first / last visible item |
| <kbd>←</kbd> | Collapse the item, or jump to its parent |
| <kbd>→</kbd> | Expand the item, or jump to its first child |
| <kbd>Enter</kbd> | Open the selected item (Ctrl/Cmd for a new tab) |
| <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>Alt</kbd>+<kbd>↓</kbd> | Move the item up / down among its siblings |
| <kbd>Alt</kbd>+<kbd>←</kbd> | Outdent — make it a sibling of its parent |
| <kbd>Alt</kbd>+<kbd>→</kbd> | Indent — nest it under the previous sibling |
| <kbd>/</kbd> | Jump to the filter box |
| <kbd>Escape</kbd> | Clear the filter, then the selection |
| <kbd>Menu</kbd> / <kbd>Shift</kbd>+<kbd>F10</kbd> | Open the context menu for the selected item |

### Filtered bases keep their tree

A Base filtered to one level, one state or one tag returns matching items but not their
parents — and a backlog with no parents is just a list. So the view loads the missing
**ancestors** from the vault and renders them as context: filter to `type == "PBI"` and
each PBI still appears under its real Feature and Epic.

```text
▾ [Epic]    Customer Portal          ↳   (context — not in the filter)
  ▾ [Feature] Self-service login     ↳
      [PBI]   Password reset flow        (the actual match)
```

Context rows are italic and dimmed, with a `↳` marker. They are **not results**, so:

- they can't be dragged, moved, indented or outdented — the Base never returned their
  real siblings, so there is no sibling order to rank them within;
- **nothing ever writes into them.** Their state chip is display-only, and the context
  menu drops **Set type**, **Set state** and the parent-link commands — a note the filter
  excluded is not yours to edit from a view that doesn't contain it. Re-ranking a sibling
  group also renumbers all of it when the gaps run out, so a group that contains a context
  row offers no reordering at all: no before/after drop, no **Move up/down/to top/to
  bottom**, no **Outdent** — even for an ordinary result row that happens to sit next to
  one. Dropping *into* a parent, the top-level strip and **Indent** keep working, because
  those append;
- they don't influence where new notes go: the folder for new items is inferred from the
  Base's own results, never from ancestors that live somewhere else in the vault — and
  **New \<child\>** on a context row creates the note in that results folder rather than
  beside the excluded parent, so it doesn't vanish on the next refresh (its `parent` link
  still points at the right item);
- they don't contribute workflow states: the state menu offers the values your results
  use, not one an excluded ancestor happens to carry;
- they don't count. The item count, the per-level breakdown and the "N hidden" figure all
  describe what the Base returned; and a context row disappears as soon as nothing below
  it is visible, so hiding completed work never leaves empty scaffolding behind;
- they stop the auto-type cascade. A filter can leave a context row *between* two results
  (the Epic and its PBI returned, the Feature between them not), and moving the item above
  it retypes only down to that row — its branch keeps the types it has, rather than being
  half-rewritten around a note that can't be touched;
- they *are* valid drop targets, so you can drag a match onto its parent as usual, and
  **New \<child\>** works on them;
- the ✨ backfill never writes properties into them;
- they don't count anywhere: descendant counts and progress bars report **the results the
  Base returned**, so a context row in the middle of a chain is passed through rather than
  tallied, and its own state can't skew a rollup or keep a finished subtree on screen.
  (Children the filter excluded are still not counted — a rollup describes the visible
  subtree, not the whole backlog.)

The last point generalizes into the one real caveat of working in a filtered base: **any
parent whose children are partly filtered out has a partial sibling list**, whether it is
a context row or a match. Dropping *into* such a parent appends after the last *visible*
child, so the new `order` is computed without knowing the excluded children's values and
can duplicate one of them. Nothing breaks — items with equal orders fall back to the
Base's own sort, and the group is renumbered by the next drop that needs the room — but
if you care about exact ranking, do the reordering in an unfiltered base.

Turn **Show parents outside the filter** off to go back to a flat list of matches, where
items whose parent is missing show the unlink icon.

### Large backlogs

Expanding or collapsing a row re-renders only that row's children, selection and keyboard
navigation use a path index instead of searching the tree, and the Base's property lookups
happen once per render rather than once per row — so a backlog of several hundred items
stays responsive to interaction. A **write** (dragging, a state change, anything that
touches frontmatter) still re-renders every row, because the Base re-runs its query and
any visible property may have changed; collapsing the levels you're not working on is the
best lever there.

### Ranking details

Sibling order is a number (`10, 20, 30…`). Dropping between two items assigns the halfway
value; when the gap gets too small the view transparently renumbers that sibling group.
Items without an `order` sort after ranked siblings, alphabetically.

## View options

Open the view options in the Bases toolbar to configure:

| Option | Default | Purpose |
| --- | --- | --- |
| Parent property | `parent` | Note property that links to the parent item |
| Order property | `order` | Numeric sibling rank |
| Item type property | `type` | Hierarchy level of the item |
| Levels (top → bottom) | `Epic, Feature, PBI, Task` | Comma-separated level names; also drives badge colors and icons |
| Ignore notes outside the hierarchy | on | Only treat notes with a supported `type` or a parent as backlog items |
| Show parents outside the filter | on | Load the ancestors the Base's filter excluded, so matches keep their place in the tree |
| Assign item type when moving | on | Rewrite `type` (through the whole moved subtree) to match the level an item is dropped into |
| State property | *(off)* | Note property with the workflow state; enables progress bars and done styling |
| States that count as done | `Done, Closed, Completed, Removed` | Which state values complete an item |
| Folder for new items | *(inferred)* | Where the view creates new notes; defaults to the folder most items live in |
| Show visible properties on rows | on | Render the Base's visible properties as aligned columns |
| Property column width | `132` px | Width of one property column |
| Tags property | `tags` | Property whose column supports adding and removing tags inline |
| Show descendant counts | on | Show the number of items below each parent (replaced by the progress rollup when a state property is set) |

Notes:

- The `order` property always wins for ranked siblings. Items **without** an `order`
  sort last — in the order the Base's **sort** setting produces, so sorting by e.g.
  priority or modified date arranges your unranked items until you rank them.
- **Ignore notes outside the hierarchy** decides what counts as a backlog item. A note
  qualifies when its `type` is one of the configured **Levels**, or when it has a parent —
  an explicit link (even a broken one, so stale links stay fixable), the empty "pinned to
  top level" marker, or a folder note in folder mode. The test runs per subtree, so an
  untyped child of a typed item stays, and so does an untyped or custom-typed note that
  holds typed ones. Everything else — the meeting notes, the folder's README, a
  `type: meeting-note` page — is skipped, and the toolbar shows an `N notes ignored`
  advisory. Turn the option off to show every note the base returns (useful for
  organizing a folder of plain notes by dragging them into a hierarchy).
- **Group by** is ignored — the hierarchy is the grouping. The toolbar says so when a
  group-by is configured.
- A Base **limit** truncates the result set, which can drop parents while keeping their
  children. Their ancestors are loaded back in as context rows (see above); the counts
  and rollups on those rows still describe only what the Base returned, so prefer filters
  over limits for backlogs.
- Creating an item from a focused view's toolbar makes it top-level (parentless) at that
  level; assign a parent afterwards by dragging it into place.
- Items whose `parent` links to a note that does not exist at all are shown at the top
  level with an unlink icon. Dropping such an item at the top level clears the stale link.
  A parent that exists but sits outside the filter is loaded as a context row instead.
- When the view is empty and no folder is configured, creating the first item asks for
  the target folder (with autocomplete) and saves the choice to the view options.

## Installation

In Obsidian: **Settings** → **Community plugins** → **Browse**, search for **Product
Backlog**, then install and enable it. The directory listing is at
[community.obsidian.md/plugins/product-backlog-view](https://community.obsidian.md/plugins/product-backlog-view).

Manually, from a release:

1. Download `main.js`, `manifest.json` and `styles.css` from the latest release
   (or build them yourself, see below).
2. Copy them to `<your vault>/.obsidian/plugins/product-backlog-view/`.
3. Reload Obsidian and enable **Product Backlog** under *Community plugins*.

To track unreleased builds, install via
[BRAT](https://github.com/TfTHacker/obsidian42-brat) with the repository URL.

## Development

```bash
npm install
npm run dev            # watch mode
npm run build          # typecheck + production build
npm test               # unit + DOM interaction tests (vitest, jsdom)
npm run test:coverage  # tests with enforced coverage thresholds
npm run lint           # eslint with the official eslint-plugin-obsidianmd rules
npm run analyze        # fallow: dead code, duplication, complexity, dependencies
npm run check          # everything in one shot — the pre-commit gate
```

The entry point is `src/main.ts`; the view lives in `src/view.ts`, tree building in
`src/model.ts`, and all frontmatter writes in `src/ops.ts`.

The pure logic — tree building, drop planning, ranking, property backfill, note
creation — is covered by node unit tests, and the interaction layer (rendering, drag &
drop, keyboard, menus, creation prompts) by jsdom tests that dispatch real DOM events
against the actual view, all running against a small mock of the `obsidian` module
(`test/obsidian-mock.ts`). Coverage (v8) is threshold-enforced. Linting uses Obsidian's
official [`eslint-plugin-obsidianmd`](https://github.com/obsidianmd/eslint-plugin)
ruleset plus size/complexity budgets, and [fallow](https://github.com/fallow-rs/fallow)
gates dead code, duplication, complexity hotspots (CRAP, fed by the coverage report) and
dependency hygiene. CI runs the full gate on every push and pull request. `CLAUDE.md`
documents the architecture, invariants and test harness for AI-assisted development.

## License

MIT
