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
5. If your notes don't have `type`/`order` yet, click the ✨ toolbar button once.

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
| Move without dragging | Right-click → Move up / down / to top / to bottom / Indent / Outdent |
| Change an item's type | Right-click → Set type |
| Find items | Type in the toolbar filter — matches keep their ancestors and subtrees, Escape clears |
| See counts per level | Hover the item count in the toolbar |

While the filter is active the tree ignores collapsed state and drag and drop is
disabled (visual neighbors aren't necessarily real siblings); keyboard navigation and
the context menu keep working on the filtered rows.

### Focus on one backlog level

Like the separate Epics / Features / Stories backlogs in Azure DevOps, the **Focus level**
option re-roots the tree at any level: pick *Feature* and every feature becomes a top-level
row with its PBIs and tasks below it. While focused, the toolbar shows a
`Focus: Feature ✕` chip — one click returns to all levels. Items keep their real parents —
re-parenting by dropping *into* a row still works — but the top row of a focused view has
no shared ranking, so reordering, indent/outdent and the top-level drop strip are disabled
there.

### Progress rollup

Set the **State property** (e.g. `status`) in the view options and parents show a
progress bar with a done count (e.g. `3/7`), while done items dim out. Which values count
as done is configurable (`Done, Closed, Completed, Removed` by default, case-insensitive).

While dragging, hovering the middle of a collapsed row briefly expands it so you can drop
deeper into the tree. Dropping an item onto its own descendant is prevented. Which items
are collapsed is remembered per view in the `.base` file. Indent guides connect each
child group to its parent, and on touch devices the per-row **+** button is always
visible with larger touch targets.

### Keyboard

Click or <kbd>Tab</kbd> into the tree first, then (mirroring Azure DevOps backlog
shortcuts where sensible):

| Keys | Action |
| --- | --- |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Select the previous / next visible item |
| <kbd>←</kbd> | Collapse the item, or jump to its parent |
| <kbd>→</kbd> | Expand the item, or jump to its first child |
| <kbd>Enter</kbd> | Open the selected item (Ctrl/Cmd for a new tab) |
| <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>Alt</kbd>+<kbd>↓</kbd> | Move the item up / down among its siblings |
| <kbd>Alt</kbd>+<kbd>←</kbd> | Outdent — make it a sibling of its parent |
| <kbd>Alt</kbd>+<kbd>→</kbd> | Indent — nest it under the previous sibling |

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
| Focus level | All levels | Re-root the tree at one level, like ADO's per-level backlogs |
| Assign item type when moving | on | Rewrite `type` (through the whole moved subtree) to match the level an item is dropped into |
| State property | *(off)* | Note property with the workflow state; enables progress bars and done styling |
| States that count as done | `Done, Closed, Completed, Removed` | Which state values complete an item |
| Folder for new items | *(inferred)* | Where the view creates new notes; defaults to the folder most items live in |
| Show visible properties on rows | on | Render the Base's visible properties as chips |
| Show descendant counts | on | Show the number of items below each parent (replaced by the progress rollup when a state property is set) |

Notes:

- Leave the Base's **sort** unconfigured — the view orders items by the tree structure
  and the `order` property.
- **Group by** is ignored; the hierarchy is the grouping.
- Items whose `parent` links to a note outside the current filter results are shown at the
  top level with an unlink icon. Dropping such an item at the top level clears the stale
  link.
- When the view is empty and no folder is configured, creating the first item asks for
  the target folder (with autocomplete) and saves the choice to the view options.

## Installation

Until the plugin is listed in the community directory (see `RELEASING.md` for the
submission checklist):

1. Download `main.js`, `manifest.json` and `styles.css` from the latest release
   (or build them yourself, see below).
2. Copy them to `<your vault>/.obsidian/plugins/product-backlog-view/`.
3. Reload Obsidian and enable **Product Backlog** under *Community plugins*.

Alternatively, install via [BRAT](https://github.com/TfTHacker/obsidian42-brat) with the
repository URL once a release exists.

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
