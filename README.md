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
  - Dragging an item writes its new `parent` and `order` (and, optionally, its new `type`).
  - The toolbar's ✨ **Assign missing properties** button backfills `type` and `order` for
    notes that don't have them yet, without overwriting existing values.

## Requirements

- Obsidian **1.10.2 or newer** (the Bases custom-view API).
- The **Bases** core plugin enabled.

## Setup

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
| Move without dragging | Right-click → Move up / down / to top / to bottom / Indent / Outdent |
| Change an item's type | Right-click → Set type |

While dragging, hovering the middle of a collapsed row briefly expands it so you can drop
deeper into the tree. Dropping an item onto its own descendant is prevented. Which items
are collapsed is remembered per view in the `.base` file.

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
| Levels (top → bottom) | `Epic, Feature, PBI, Task` | Comma-separated level names; also drives badge colors |
| Assign item type when moving | on | Rewrite `type` to match the level an item is dropped into |
| Folder for new items | *(inferred)* | Where the view creates new notes; defaults to the folder most items live in |
| Show visible properties on rows | on | Render the Base's visible properties as chips |
| Show descendant counts | on | Show the number of items below each parent |

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

Until the plugin is listed in the community directory:

1. Download `main.js`, `manifest.json` and `styles.css` from the latest release
   (or build them yourself, see below).
2. Copy them to `<your vault>/.obsidian/plugins/product-backlog-view/`.
3. Reload Obsidian and enable **Product Backlog** under *Community plugins*.

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # typecheck + production build
npm test       # unit tests (vitest)
```

The entry point is `src/main.ts`; the view lives in `src/view.ts`, tree building in
`src/model.ts`, and all frontmatter writes in `src/ops.ts`.

The pure logic — tree building, drop planning, ranking, property backfill, note
creation — is covered by unit tests in `test/`, which run against a small mock of the
`obsidian` module (`test/obsidian-mock.ts`). CI builds and tests every push and pull
request.

## License

MIT
