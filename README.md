# Product Backlog — an Obsidian Bases view

An [Obsidian](https://obsidian.md) plugin that adds **three view types** to
[Bases](https://help.obsidian.md/bases). The first turns a flat list of notes into a
sortable work-item tree — **Epics → Features → PBIs → Tasks** — inspired by the backlog in
Azure DevOps Boards; the other two read the same notes and answer different questions.

| View type | What it draws |
| --- | --- |
| **Product Backlog** | The tree, and three more projections of it: a [kanban board](#the-board), a [Deliverables board](#the-deliverables-board) and a [roadmap](#the-roadmap) |
| **Estimation** | A [weighted value model](#the-estimation-view) over the same items, with RICE, ICE, WSJF or value-over-effort as the ranking indicator |
| **Release** | The [releases](#the-release-view) in the vault, what each one holds, and how far it landed from its plan |

Pick one in the Bases view picker. Everything below describes the Product Backlog view
unless a section says otherwise.

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
  - **`type`** — the ladder `Epic → Feature → PBI → Task`, the **extra types** `Issue`,
    `Bug`, `Idea`, `Deliverable` and `Improvement` that sit beside it rather than on it, or a **marker**
    on neither — `Milestone`, `Iteration` and `Release` — which states a date, a time box
    or a set of things going out together rather than work. A `Resource` is outside all of
    that: a person the plan points at, never part of it (see
    [Resources and assignees](#resources-and-assignees)).
- **You never have to maintain these properties by hand.** The view assigns them:
  - Creating an item via the view writes `type`, `parent` and `order`.
  - Dragging an item writes its new `parent` and `order`, and leaves `type` alone —
    always. A move is a move, never a re-classification: the type a note carries is the
    one it keeps until you change it with **Set type**.
  - Items without a `type` show a level implied from their parent's type (a child of a
    Feature reads as a PBI, wherever that Feature sits).
  - The toolbar's ✨ **Assign missing properties** button sets the whole view up in one
    press: it picks this view's suggested property for every optional feature you have
    not configured yet — the workflow state, the date stamps, and the roadmap's horizon
    and dates — and then backfills `type`, `order` and an **empty** value for each of
    those properties on the notes that don't carry them, except a planned date a type
    cannot use: a `Milestone` is a point, so it is given the target and not the start.
    Nothing already set is
    overwritten, no option you have set (or deliberately cleared) is changed, no type is
    guessed for items whose parent is outside the view, and nothing moves: an empty
    property is the "no state, not planned yet" the item was already in — it just becomes
    visible and editable in Obsidian's own property editor, and pickable in the view
    options.
> [!WARNING]
> **Quote any frontmatter value that contains ` #` before you run this.** In YAML, a hash
> after a space starts a comment inside an unquoted value, so `source: review of PR #56, and
> more` has always *meant* `source: review of PR` — Obsidian's own Properties panel already
> shows it truncated. The bytes survive only until something re-serializes the block, and
> **any** write this plugin makes to that note is such a re-serialization; ✨ is simply the
> one that rewrites every result at once. Writing `source: "review of PR #56, and more"`
> makes the hash part of the value for every reader. This is Obsidian's serialization, not
> something the plugin can detect or put back.

- **Every note the plugin creates also gets a `pbl-id`** — one integer, taken from the
  highest the vault already holds, written in the same single write that makes the note. It
  is a handle for naming an item outside Obsidian, where a title is going to change and a
  path is going to move. Notes that already exist are left exactly as they are: there is no
  backfill.
- **Every write that EDITS a note can be taken back** — <kbd>Ctrl/Cmd</kbd>+<kbd>Z</kbd> or
  the ↩ toolbar button, however many notes the change touched (see [Undo](#undo)). That is
  every move, retype, state change, schedule, label and backfill, because each is a batch
  whose inverse is captured as it lands. The undo slot is plugin-wide: one ↩, whichever of
  the three views made the change.
- **Creating a note is not undone**, and that is a rule rather than a gap: a creation
  captures no inverse, so there is nothing to take back. The new note stays where it was
  filed and you delete it yourself. This covers every creator — an item, a resource, an
  absence, an iteration and a release.

## Requirements

- Obsidian **1.12.0 or newer** (the Bases custom-view API, with the view options a base
  configures).
- The **Bases** core plugin enabled.

## Setup

The fast way: run the **Product Backlog: Create backlog** command. It asks for a folder
(default `docs`), creates it together with a fully configured `Product Backlog.base`
inside, and opens the view — from empty vault to working backlog in one step.

Manually, the equivalent is:

1. Create a folder for your backlog, e.g. `docs/`.
2. Create a Base (e.g. `Product Backlog.base`) and add a filter such as
   `file.inFolder("docs")`.
3. In the view switcher of the Base, add a new view and pick **Product Backlog**.
4. Drop existing notes into the folder, or use **+ New Epic** in the view to create items.
5. Click the ✨ toolbar button once: it fills in the `type`/`order` your notes don't
   have yet, and sets up the properties the board, the roadmap and the Deliverables
   board need — each one's own empty state offers the same button when you get there
   first. Notes with neither a supported `type` nor a `parent` aren't treated as backlog
   items — to organize a folder of plain notes by dragging, turn **Ignore notes outside
   the hierarchy** off in the view options first.

Example `.base` file:

```yaml
filters:
  and:
    - file.inFolder("docs")
views:
  - type: product-backlog
    name: Backlog
    homeFolder: "docs"
    order:
      - note.status
      - note.points
```

**Keep the home folder and the filter pointing at the same place.** New items are filed
under it, and the view can only show what the Base returns — a base filtering `Backlog/`
with the home folder left at `docs` creates items you will not see afterwards.
Backlogging into `Roadmap/` means `file.inFolder("Roadmap")` and `homeFolder: "Roadmap"`;
the type folders follow on their own. The **Create backlog** command writes it from the
one folder it asks you for, which is the whole reason it asks.

Any properties you enable under **Properties** in the Bases toolbar (the `order` list
above) get a column of their own on each row, in the order you put them — handy for
`status`, story points, assignee, etc. That menu is the only switch: a property it does
not show is not on the rows, and that includes the state, horizon, risk and tag chips.

## Using the view

| Action | How |
| --- | --- |
| Switch projection | Toolbar toggle — **backlog tree**, **kanban board**, **roadmap**, **Deliverables board**. See [The board](#the-board), [The roadmap](#the-roadmap) and [The Deliverables board](#the-deliverables-board) |
| Expand / collapse | Click the chevron, or use the toolbar buttons |
| Open an item | Click the row (Ctrl/Cmd-click for a new tab) |
| Re-order among siblings | Drag a row and drop it **between** two rows |
| Re-parent | Drag a row and drop it **onto** the middle of the new parent |
| Make an item top-level | Right-click → **Outdent** (Alt+Left), or drag it just above or below a row that is already top-level |
| Create a child item | Hover a row and click **+**, or use the context menu — where the row can hold more than one kind of item, the modal asks which |
| Create any type at the top | Toolbar **New** button, or the **▾** menu next to it for every other type |
| Focus one type | Toolbar focus button next to **New** → pick a level or an extra type (**All types** returns) |
| Move without dragging | Right-click → Move up / down / to top / to bottom / Indent / Outdent |
| Change an item's type | Right-click → Set type (every level, plus the extra types) |
| Change an item's state | Click the state chip on the row (there when the state property is a visible column), or right-click → Set state |
| Add a tag | Click the **+** in the row's tag column, or right-click → Edit tags |
| Remove a tag | Hover the row and click the **✕** on the tag |
| Undo the last change | Click the **↩** toolbar button, or press <kbd>Ctrl/Cmd</kbd>+<kbd>Z</kbd> in the tree |
| Hide finished work | Click the eye button in the toolbar (or toggle **Show completed items** in the view options) |
| Open in a new tab or split | Middle-click, Ctrl/Cmd-click, or right-click → Open in new tab / Open to the right |
| Find items | Use the Base's own search — the view is given the narrowed results and loads the ancestors they need, so the tree keeps its shape |
| See counts per type | Hover the item count in the toolbar |

A Base search narrows what the view is given rather than what it draws, so the rows that
remain keep their place in the hierarchy — an ancestor the search excluded still loads as
context (shown dimmed, and never written to) so a match is never stranded at the top level.
The roadmap's unplaced shelf has a search of its own, scoped to the untriaged work beside it.

### Focus on one type

Like the separate Epics / Features / Stories backlogs in Azure DevOps, focus re-roots the
tree at any type: pick *Feature* from the button next to **New** in the toolbar and every
feature becomes a top-level row with its PBIs and tasks below it. Extra types are on that
menu too — focusing *Bug* gives you a list of every bug, which is the same kind of view.
Focusing the level an extra type ranks with (*PBI*, by default) shows both together. While
focused, that button shows the type, accented, with a `✕` beside it that returns to
everything in one click (so does picking *All types*). Items keep their real parents —
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

**The Bases properties menu decides the whole strip, chips included.** The state,
horizon, risk and tag properties are columns like any other: each draws its clickable
chip where you put that property in the menu, and draws nothing at all while the menu is
hiding it — configuring a property in the view options is what makes it *editable*, not
what puts it on a row. Configure one and see no chip, and the properties menu is the
place to look.

Columns never shrink — that is what keeps them aligned — so a long title truncates
first, and a pane too narrow for the columns it is asked to show drops them instead of
clipping them. They drop **from the end of that same order**, one at a time: the order
is your statement of what matters, so nothing re-ranks it on your behalf, and the
progress rollup outlasts every column because it is pinned past their end rather than
being one of them. A dropped column is not rendered at all — there is nothing left of it
for Tab or a screen reader to find — and widening the pane brings the columns back in
the order they left. The view measures this against the width you configured and the
depth on screen, so wide columns give way earlier than narrow ones, and expanding a
deep branch can be what makes a column give way.

Rows carry no `Property:` labels of their own — that is what the header is for. To turn
a column off, hide its property in the Bases **Properties** menu; there is no second
switch in the view options.

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

The progress rollup sits in a **fixed column at the end of each row**, after every
property column, so it lines up vertically no matter how long an item's title is or how
deep it sits in the tree.

Make the state property visible in the Bases **Properties** menu and it gets a column of
its own there too — wherever you put it among the others (see
[Properties on a row](#properties-on-a-row)) — and each row then carries a clickable
**state chip** in it: pick a new state from its menu (also available via right-click →
**Set state**, which stays offered whether or not the column is showing) and the note's
frontmatter updates without opening it. The menu offers the **Workflow states** configured in the view options — or,
when none are configured, the states already used in the backlog, with a done state
appended so marking an item done is always one click away. An item whose state isn't in
the list keeps it selectable in its own menu.

The toolbar's eye button (or the **Show completed items** view option) hides finished
work: an item disappears once it *and its entire subtree* are done — a done parent with
open children stays visible, so unfinished work can never hide. Progress bars keep
counting hidden items, and moving or dropping rows around hidden siblings stays safe
because ranking always runs over the real sibling lists.

While dragging, hovering the middle of a collapsed row expands it after a moment (the
chevron lights up while the timer runs) so you can drop deeper into the tree. Dropping an
item onto its own descendant is prevented. Which rows you left open is remembered per
view, on this device — see [Where the view remembers things](#where-the-view-remembers-things).
Indent guides connect each child group to its parent, and on touch devices the per-row
**+** button and the tag add/remove controls are always visible, with larger touch targets.
The tree is a real ARIA tree — screen readers announce level, position and expansion
state — and the view honors reduced-motion and right-to-left settings.

### Keyboard

<kbd>Tab</kbd> walks the view's toolbar — new item, the type picker, the focus level,
backfill, undo, expand and collapse all and the completed-items toggle — and
then reaches the tree as a single stop. Inside the tree the selected row moves with the
arrow keys rather than with <kbd>Tab</kbd>, so a long backlog never becomes a long tab
sequence; the row's own controls are reachable through the context menu.

Once in the tree (mirroring Azure DevOps backlog shortcuts where sensible):

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
| <kbd>Ctrl/Cmd</kbd>+<kbd>Z</kbd> | Undo the last backlog change (again to redo) |
| <kbd>Escape</kbd> | Clear the selection |
| <kbd>Menu</kbd> / <kbd>Shift</kbd>+<kbd>F10</kbd> | Open the context menu for the selected item |

### Undo

Every property change the view writes — a drop, a move, a state or tag change, the ✨
backfill — can be taken back right afterwards: click the **↩** toolbar button or press
<kbd>Ctrl/Cmd</kbd>+<kbd>Z</kbd> in the tree. Undoing the undo redoes. Quick no-ops don't
spend it — re-picking an item's current state won't cost you the undo of the drop before
it. A batch that failed partway can still take back the part that landed.

**One level is kept for the whole vault, per session — not one per view.** Undo takes back
the last batch anything wrote, whichever of the three views wrote it: a score saved in the
estimation view is what the backlog view's ↩ takes back, if that was the last write.

**The ↩ itself is not on every view.** The backlog view has one and the estimation view has
its own; the release view draws none, so a status or description edited on a release's own
screen is taken back from the **backlog view's** ↩. That is what one slot for the vault
means in practice — the button you reach for is not always in the view you were working in.

Creating a note is the exception: undo never deletes one, so a new note stays — and the
undo button still points at the last property change from before it. Delete the note
yourself to take a creation back. That covers every creator: an item, a resource, an
absence, an iteration and a release.

Undo puts back exactly what was there before, and only where the note still holds what
the view wrote: a property you edited by hand in the meantime is kept rather than
overwritten, and a note deleted since is skipped — a notice says when either happened.
It also works when the change itself moved an item out of the base's filter (marking a
parent done in a base that hides done items): taking that change back is exactly what
undo is for. Tags are undone as an add/remove of the same tags rather than as a
snapshot, so tags you added yourself in between stay.

### Extra types sit beside the ladder

`Epic → Feature → PBI → Task` is a ladder: each level's children are the level below.
Some work does not fit a rung. A **Bug** breaks down into Tasks whether it was raised
against an Epic, a Feature or a PBI — its position says nothing about what it contains.

The same is true of an **Idea**: a thought about the portal and a thought about one
screen of it are the same kind of thing, and neither is a Feature. A **Deliverable**
is the other way round — a thing the project must produce rather than work to do —
and it fits no rung for the same reason.

An **Improvement** is a fifth: a further round of work on something already delivered,
which hangs under what shipped rather than reopening it — so the delivered item keeps the
release it went out in and the improvement takes the next one.

So `Issue`, `Bug`, `Idea`, `Deliverable` and `Improvement` are **extra types** rather than
a fifth level, and two things follow:

- **They hang from any level above the lowest.** Add one under an Epic, a Feature or
  a PBI. Their own children are always Tasks, so nothing is offered under one but a
  Task. They can also hang from *nothing*: the toolbar's type picker creates one at
  the top level, which is where an idea usually starts.
- **A move never re-types them.** Dropping a Bug under an Epic leaves a Bug — where
  dropping a *PBI* there would make it a Feature. Their Tasks stay Tasks too, because the
  subtree follows the extra type rather than the rung it landed on.

Every one of them is also creatable with **no parent at all**, from the toolbar's own
"pick another type" menu — like every declared type.

Where a row can hold more than one kind of thing, **the + button asks**: the new-item
modal offers a type, defaulting to the ladder's own child. The context menu lists the
choices directly (`New PBI`, `New Issue`, `New Bug`, `New Idea`, `New Deliverable`, `New Improvement`),
and `Set type` offers every declared type. A row with only one option — a Task, or an
extra type, which holds only Tasks — asks nothing and creates it straight away.

`Issue`, `Bug`, `Idea`, `Deliverable` and `Improvement` each get their own badge icon
and colour — an alert in pink, a bug in red, a lightbulb in yellow, a package in green and
a rising line in green. Every declared type has its own icon, but there are more of them
than the theme has colours, so hues are shared: an Idea and a Task both read yellow, and a
Deliverable and an Improvement both read green. The icon and the name on the badge are
what tell a sharing pair apart. They rank with `PBI`, so focusing that level shows them
beside it rather than hiding them. `Deliverable` also has its own board with its own
workflow — see [The Deliverables board](#the-deliverables-board) below.

**The type vocabulary is fixed.** That is deliberate: a configurable vocabulary means every
rule about levels has to hold for any list someone can type, and the reward is a rename.
A note typed anything else keeps its own name on the badge and is carried through the
ladder as before — nothing is rejected, it simply is not one of the shipped names.

None of this is enforced. The ladder has always guided what the view *offers* and what it
*writes* without refusing a move you make deliberately, and extra types follow the same
rule: drag a Bug wherever the work actually belongs.

### Where new items are filed

Everything the view creates lives under one **home folder** (`docs` by default), and each
type gets **its own folder picker** — `Folder for Epic items`, `Folder for Bug items`, one
per type you have configured. A Bug is filed with the bugs wherever in the tree it hangs.

Each picker defaults to a subfolder of the home folder, so **relocating a backlog is still
one setting**: point the home folder at `Roadmap` and the defaults become
`Roadmap/requirements`, `Roadmap/bugs`, and so on. A folder you pick by hand stays picked;
only the untouched ones follow.

Types you rename or invent get no default: this plugin has no opinion about where a
`Theme` belongs, so it falls back to the home folder itself.

The new-item modal names the folder before you commit, and the line follows the type
picker — switch from PBI to Bug and it re-reads `docs/bugs`.

**Keep these folders inside what your Base returns.** The view creates a note and then
shows it only if the Base's filter matches, so a base filtered to `Backlog/` with the
folders left at their `docs/…` defaults creates items you will not see afterwards. They
are not lost — they are notes with their `parent` links intact — but they are not where
you were looking. The **Create backlog** command writes every one of these folders under
the folder it scaffolds, so a backlog made that way is consistent from the start.

Full resolution order, first match wins:

1. In **folder mode**, beside the parent's folder note — that mode makes folders the
   hierarchy, and a filing default should not quietly overrule it.
2. The folder configured for the type being created.
3. The **home folder**.
4. The folder most existing items live in — only reachable by clearing the two above,
   since both are configured out of the box.
5. Otherwise the modal asks, and remembers the answer as the home folder.

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
  one. Dropping *into* a parent, dropping on the tree background and **Indent** keep
  working, because those append;
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

A **batch** — "Assign missing type and order properties" over a whole backlog, or a drop
that renumbers a large sibling group — writes one note at a time, and each of those writes
would otherwise come back as its own refresh. The view rebuilds once when the batch
finishes instead, so the tree doesn't churn through hundreds of half-applied states on the
way. Nothing is frozen while that happens: you can scroll, filter, expand and select
throughout. The toolbar shows how far along the batch is (`Updating 12 of 340…`), and the
commands that would be refused mid-batch grey out until it's done.

Undoing one is a batch in its own right, with the same progress indicator: a backfill over
three hundred notes comes back in a single press.

### Where the view remembers things

Three different kinds of state, kept in three different places on purpose:

- **Everything in the view options** — the properties, the levels, the focus level, the
  folder for new items — lives in the **`.base` file**. It describes the view itself, so
  it is shared with anyone you share the base with, and it travels with the vault.
- **Which rows you left open** lives in this device's **local storage**, keyed per base
  and per view name. It is your working position rather than a property of the backlog:
  it would be noise in a shared file, and a path per collapsed row is growth that file
  should not take. So it survives restarts and stays out of everyone else's way.
- **What undo would put back** lives only in **memory**, for as long as the view is
  open. It describes a change you just made, not the backlog, and the notes it refers to
  may be edited by anything in the vault meanwhile — so an undo offered after a restart
  would be a promise the plugin can't keep. Close the tab and the slot goes with it.

A row nobody has ruled on yet opens collapsed, so a large backlog starts as a readable
list of top-level items rather than a wall of every task. Once you open or close a row,
that choice is what comes back. Notes you delete are forgotten on the next save.

If the view can't tell which base it belongs to, it quietly falls back to remembering
your rows for the session only — sharing one bucket between bases would be worse than
forgetting, because two backlogs would keep opening each other's rows.

### Ranking details

Sibling order is a number (`10, 20, 30…`). Dropping between two items assigns the halfway
value; when the gap gets too small the view transparently renumbers that sibling group.
Items without an `order` sort after ranked siblings, alphabetically.

## The board

The same backlog read as a kanban board: one column per workflow state, and one card per
item the view is showing. Switch with the toolbar's **Show as kanban boards** button.

**Focus decides what a card is.** With no focus set, every result gets a card. Focus a
level — *Feature*, say — and the cards are the features, with their PBIs and tasks
represented beneath them rather than scattered across the columns as cards of their own.
That is the same re-rooting the tree does, and it is usually what you want from a board:
one card per thing you are tracking, at the altitude you are tracking it.

**The projection is working position, not configuration.** Which of the four a view is
showing is remembered per saved view, per device, in the view-state store — it is never
written to the `.base`, so opening the same backlog on another machine does not move
anyone else's view.

The board needs a **state property**. Without one it shows guidance and a button that sets
it up. The **Workflow states (in order)** list is optional: with it, those are the columns,
in that order. Without it, the board draws the states your notes actually carry — plus a
done column even if nothing is in it yet, when none of the states you carry already
counts as done, so marking an item done is always one click away.

Only your results mint columns. A card the Base's filter excluded, shown as context, never
adds a column for its own state — that state is not your board's vocabulary. If its value
matches no column, it sits in the no-state column.

| Action | How |
| --- | --- |
| Move a card | Drag it to another column, press <kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd>, or right-click → **Set state** |
| Clear an item's state | Drop it on the column for items with no state — this **removes** the property rather than blanking it |
| Read a column's agreement | Hover the column header, or open the column menu |
| Create in a column | Toolbar **New**, then drag — creation from a column is not built yet |

- **Columns** are the no-state column first, then **Workflow states (in order)** if you
  set it — or, left unconfigured, the states your notes actually carry plus a done
  column even if nothing is in it yet, when none of those already counts as done — and
  finally one more column per observed result value neither names, so a stray status
  still gets a column of its own rather than losing its card.
- **WIP limits** are set per state in the view options — for every state **except the done
  ones**, since a finished column is a record rather than a queue and capping it would mean
  nothing. A limit **reads the column's full population, not the filtered count**, so
  narrowing the view cannot make an overcommitted stage look calm. It signals in colour, in
  shape and in words — and it **refuses nothing**. Going over a limit is information, not a
  locked door.
- **Policies** are a sentence per **configured** workflow column, done ones included — the
  working agreement for that stage. Set one in the view options and it is readable from the
  column header and the column menu. A column minted from an observed value the workflow
  list doesn't name has no policy option and no menu entry for one.
- **Date stamps.** Both `started` and `finished` ride the state write, so neither fires
  without a state property. Each also needs its own list to name at least one value —
  `started` in **States that count as started** (empty by default), `finished` in
  **States that count as done** (populated by default) — or the property is only ever
  created empty for you to fill by hand, never stamped. Once both are configured, the two
  behave differently once work is reworked:
  - **`started`** is written only while the property is empty, so the **earliest** start
    survives. Entering a started state again does not move it.
  - **`finished`** follows the done boundary. Completing an item stamps it; **reopening
    clears it**, because an item back in progress must not claim a finish it no longer has;
    completing again stamps the new date. Moving between two done states — `Done` becoming
    `Dropped` — is a re-labelling and writes nothing.
- **Cards outside the base's filter** appear only on a **focused** board: a focus-level item
  the filter excluded still gets an inert card, so its results have somewhere to sit.
  Unfocused, the board is results only — an excluded item never gets a card without a focus
  level pointing at it. Either way, a context card carries no control that would write to it.
- **`Deliverable` items never appear here.** They get a board of their own — see
  [The Deliverables board](#the-deliverables-board) — though one acting purely as an
  excluded ancestor can still render as an inert context card for a visible descendant,
  the same as any other excluded parent.

Every move — drag, keyboard or menu — is the same gated write, announced in the same words,
and taken back by the same <kbd>Ctrl/Cmd</kbd>+<kbd>Z</kbd>.

## The Deliverables board

A fourth projection, alongside tree/board/roadmap, reserved for items typed
`Deliverable` — concepts, designs and anything else the team must produce rather than
plan. It draws from a **workflow**: its own state property, ordered states and done
values when you configure one — in which case it is entirely independent of the board
above, and a Deliverable finished in one workflow does not read as finished in the
other — or, left unconfigured, the same workflow the board above already uses, so a
vault that never bothered to name a separate property still gets a working
Deliverables board rather than an inert one; in that case the two boards deliberately
share the one property and the one write.

A Deliverable never appears as a card on the board above — that board is scoped to
everything else, whatever either workflow's state says — though it still counts on the
tree and on both roadmap axes, and one acting purely as an excluded ancestor still
shows there as a context card for a matching visible descendant, the same as any other
excluded parent.

Columns and a workflow only — no WIP limits, no column policies, no started/finished
date stamps, and "Show completed items" has no effect here: a Deliverable's
completion state on either workflow never hides its card, so only the Base's own
search narrows what is shown. **The focus level set elsewhere in the toolbar has no effect on
this board at all** — a focus left on, say, Feature would otherwise make a Deliverable
outside that subtree confusingly disappear, so the toolbar's **Focus** control always
reads a plain, disabled "Deliverables" button here, whatever the inherited focus is:
never a menu to pick a *different* focus (every card is already a Deliverable, so there
is nothing to narrow by that way), and never a "Focused: …" label with a clear button,
since no focus level narrows this board's own cards for one to clear. Moving a card
(drag, <kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd>, or the card menu's Set state) writes
the resolved Deliverable state property — its own key when you configured one, or the
shared one when you did not.

The toolbar's **New** button on this board always creates a Deliverable; the picker for
every other type, offered everywhere else, is absent here since nothing else could ever
appear as a card.

Everything else about a Deliverable — its parent, its rank, its tags, its place on the
roadmap — is the same property every other type already uses; nothing about this board
changes how those work.

## The roadmap

The same backlog on a time axis. Switch with the toolbar's **Show as roadmap** button. The
mode persists exactly as the board's does.

**The axis is declared, never guessed.** The roadmap draws whichever axis the view options
configure — it does not infer one from property names and never derives horizons from dates.
There are two:

| Axis | Configured by | Writable |
| --- | --- | --- |
| **Horizons** | **Horizons (in order)** plus a horizon property | Yes |
| **Timeline** | A start date property, a target date property, or **either one alone** | From the row menu, for any end the item can actually use — no drag gestures on the bars yet |

With both configured, an axis picker appears in the toolbar — **Show horizons** and
**Show timeline**. With only one, there is no choice to make and the picker stays away.

| Action | How |
| --- | --- |
| Move between horizons | Drag the card, press <kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd>, or right-click → **Set horizon** |
| Un-place an item (horizons axis only) | Drag it to the shelf — this removes the horizon property |
| Create in a horizon | The **+** on the bucket, which files the new item with that horizon already set |
| Set dates | Right-click → **Schedule** / **Unschedule** |

- **Buckets** are the values in **Horizons (in order)** — a Now / Next / Later axis, or
  whatever you name — plus one more for any result whose horizon value the list omits, the
  same carve-out the board's columns make. Every move is one gated write, undoable as one
  batch.
- **The shelf** — labelled **Unplaced** on screen — holds the **results** the axis could not
  place, with a count. **On the horizons axis** it is also the drop target that *un-places*:
  dropping there removes the key rather than blanking it, and it stays reachable while
  empty, because a target that only exists when occupied is one nothing can reach. **On the
  timeline it is display-only** — nothing on the dated axis is draggable, so there is no
  un-place gesture there; an item lands on the shelf by having its dates cleared from the
  row menu instead.

  Items your Base's filter excluded are **not** on the shelf and not in its count. On a
  **focused** roadmap, a focus-level item the filter excluded is shown as context so its
  children have somewhere to hang, not because it is work you have left unplanned. **On
  the timeline** every excluded item goes straight to a **Context** strip beside the
  shelf. **On the horizons axis**, one whose horizon value matches an existing bucket
  sits in that bucket instead — only one with no value, or a value no bucket names,
  reaches the Context strip. Unfocused, the roadmap draws results only and no context
  strip appears at all.
- **The timeline** draws a bar from each item's dates. **One date property is enough** —
  a target-only roadmap of milestones and deadlines, or a start-only plan, are both
  supported. **A parent with no dates of its own spans its dated descendants**, endpoint to
  endpoint, drawn as the inference it is and written to no note — for an ordinary work
  item. A milestone is its target date alone: with none of its own, it goes to the shelf,
  **Unplaced**, whatever dates its children carry.
- **Dates are set from the row**, not from the bar: right-click → **Schedule** or
  **Unschedule**, on any projection — the tree, the board, the roadmap and the
  Deliverables board all reach the same row menu, deliberately: a write reachable only
  from roadmap mode would be a projection disagreeing about what the backlog can do.
  What this release does *not* have is a gesture on the bar itself — dragging one to
  move it, dragging its edge to resize, or dragging an item off the shelf onto a date.
  Those are specified and not yet built.

  **Schedule appears only when the item has an end it can use.** A milestone is its target
  date alone, so on a roadmap configured with a start property and no target, milestones
  offer no Schedule at all — there is nothing they could legally write. The entry is
  withheld rather than opened onto nothing.
- **Milestones** are a type of their own: on no rung of the ladder, offered no child types,
  and **counted in no rollup** — a milestone states a date rather than work, so a progress
  bar must not count it. One is drawn at its target date, from the target property alone;
  a `start` on a milestone is ignored, never rewritten and never removed.

  Like every other type rule here, this **guides rather than refuses**: drag a milestone
  under an Epic, or write a `parent` on one by hand, and the link is kept — the same
  advisory-not-enforced rule the types section above states. What the type withholds is the
  offer, not the possibility.
- **Planned dates are different properties from the board's transition stamps**, so a plan
  can never overwrite a record of what actually happened.

## Resources and assignees

**A resource is a note, not a string.** A `Resource` is a person work is assigned to. It is
a declared type like any other, and notes carrying it stay **out of the backlog**: a
resource is pointed at by the plan, never part of it, so one draws no row on the tree, no
card on the board and no bar on the timeline.

An item names its assignee by **link** to that note, the way it names its parent. Right-click
a row or card → **Set assignee** lists the `Resource` notes the base returns, and offers
**New resource...**, which creates the note and assigns it in one step — so the first
assignment does not send you off to make a note first.

The roadmap's **resources axis** draws one row per `Resource` note the base returns, with
each person's assigned work on their own row, and an **absence** band for time they are away.
The roster is the notes the base returns — there is no list to keep in step with it.

> **Upgrading from 0.9.x:** an assignee used to be a plain name. It is a link now, and
> **resolution decides, not spelling** — `assignee: Sarah` keeps its association wherever
> the base already returns a `Sarah.md` typed `Resource`. What goes stale is narrower: an
> assignment naming somebody with **no** `Resource` note behind it draws no row on the
> resources axis. Give that person a note, or set the assignee again. Nothing is rewritten
> on disk either way.

## The estimation view

A second Bases view type — **Estimation** (`product-estimation`, its own icon in the view
picker). It reads the same notes and answers a different question: **what is this worth, and
what should we do first?**

The view is a table, one row per item, beside a panel for the row you have selected.

| Column | What it says |
| --- | --- |
| **Item** | The note. Its name in the panel header opens it |
| **Value** | The business value the model computed, from the dimensions you scored |
| **Coverage** | How many of the model's dimensions this item has answers for — `3/5` |
| **Confidence** / **Effort** | The scales beside the value model |
| **Indicator** | The ranking score — RICE, WSJF, or whatever you configured |
| **Currency** | Whether the stored number still describes the note on disk |

**The value model is yours to shape.** Each dimension has a weight, a range and a rubric
per point, all in the view options. The panel says **Why this scored what it scored** for
the selected row: every dimension, the answer it holds, and the arithmetic that reached the
total.

**Presets are for the indicator, not the value.** The toolbar's calculator offers **RICE**,
**ICE**, **WSJF** and **Value over effort** under *Start from a known framework*. Each one
configures the indicator that sits beside the business value; the value model is unchanged
whichever you pick, so trying WSJF costs you nothing you already scored.

**A stored score says which model produced it.** Every write stamps the coverage and a
fingerprint of the model, so the Currency column can tell you:

| Chip | Meaning |
| --- | --- |
| **Needs re-estimation** | The inputs changed after the total was stored |
| **Another model** | The total was produced by a different model than this view's |
| **Hand-written** | A total with no stamp — someone typed it, and it is left alone |
| **Inputs gone** | A stamp whose dimensions no longer exist; offered for removal |

A stale total can be recalculated where it is reported, and a hand-written one is never
offered for deletion.

| Action | How |
| --- | --- |
| Set the view up | The toolbar's ✨ **Bind and backfill the estimation properties**, or name your own in the view options |
| Score an item | Select its row, answer the dimensions in the panel |
| Rank by a framework | The toolbar's calculator → **Start from a known framework** |
| Recalculate a stale total | The panel, where it is reported |
| Take back the last batch | The toolbar's ↩ **Undo last change** |

Writes here go through the same gate as everything else — serialized, refused while the
configuration has a problem, and undoable as one batch. The undo slot is **plugin-wide**:
one ↩, whichever view made the change.

## The release view

A third Bases view type — **Release** (`product-release`, its own icon in the view picker).
A release is a set of things going out together, and it is a note of its own: `type: Release`,
carrying a version and a target date.

**Releases do not appear in the backlog.** They are not rows on the tree, not cards on the
board and not items in a rollup — a release names work, it does not contain it. Work joins
one from the **item's** own menu in the backlog view, and the item carries the membership
property that names its release.

The view has two screens.

**The release index** — one row per release, grouped **in flight** and **shipped**. Each row
carries the version, the status, the target date, the released date and the member count,
plus how far along it is and how far it landed from its plan: *3 days left*, *2 days overdue*,
*shipped 4 days early*. **New release** sits at the head of the list.

**A release's own screen** — activate a row. Its header holds the release's status, its
description, the day it shipped, its version and its target date. The **first three are
editable in place**; the version and the target date are read here and edited in the
release note, which one control in the header opens.

Below it is the release's **scope**: the work it names, as a foldable tree with its own
toolbar (collapse all, expand all, hide done) and its own keyboard walk. A row's
context menu offers **New \<type\>** for every type that row may hold, and the note it creates
hangs from that row and joins the open release in the same write.

Two closing actions sit in the header:

- **Mark as released** writes the configured released status and today's date to the release
  note and to nothing else, as one undoable batch. It asks first, listing the members that
  are not finished — each openable from the dialog without answering it.
- **Generate release notes** writes one Markdown file per release, grouped by type in the
  order the scope tree draws them. Regenerating it is byte-identical, and it refuses a file
  at that path that this view did not write or that belongs to another release.

Both are **withheld until the properties they write are bound**, and both say which option to
bind rather than failing quietly.

| Option | Purpose |
| --- | --- |
| Membership property | The property **on an item** that names its release |
| Version property | The release's version |
| Target date property | The day it is planned for — what the roadmap draws it at |
| Status property | The release's own status, and **Statuses that mean released** / the status **Mark as released** writes |
| Released date property | The day it shipped. **Binding it to the target date is refused** — a record that overwrites the plan destroys the only evidence a release slipped |
| Release folder / Release notes folder | Where new releases and generated notes are filed |
| Workflow state property / States that count as done | How the view decides a member is finished |

The toolbar's ✨ **Add missing properties** binds every one of these that you have not named,
in one press. **It binds the view options and writes to no note** — unlike the backlog view's
✨, this one never edits a note that already exists, so nothing is backfilled onto your
releases or your work items. Obsidian's property picker can only offer a property some note
already carries, so a key nothing carries stays bindable by suggestion here rather than
pickable from that list until a note gains it.

**A release with a target date also draws on the roadmap**, as a line across the plan, beside
the milestones.

## View options

Open the view options in the Bases toolbar to configure **the backlog view** — its
board, its Deliverables board and its roadmap. The estimation view and the release view
carry their own options, listed in their sections above.

| Option | Default | Purpose |
| --- | --- | --- |
| Parent property | `parent` | Note property that links to the parent item |
| Order property | `order` | Numeric sibling rank |
| Item type property | `type` | Hierarchy level of the item |
| Ignore notes outside the hierarchy | on | Only treat notes with a supported `type` or a parent as backlog items |
| Show parents outside the filter | on | Load the ancestors the Base's filter excluded, so matches keep their place in the tree |
| Infer hierarchy from folder notes | off | Folder mode: a folder's own note is the parent of the notes beside it, so a child needs no explicit `parent` link |
| State property | *(off)* | Note property with the workflow state; enables progress bars and done styling |
| Workflow states (in order) | *(off)* | The board's columns, in that order. Left unset, the board draws the states your notes actually carry, plus a done column even if nothing is in it yet, so marking an item done is always one click away |
| States that count as done | `Done, Closed, Completed, Removed` | Which state values complete an item |
| States that count as started | *(off)* | Which state values start the clock — entering one stamps the started date |
| WIP limit for *&lt;state&gt;* | *(off)* | **One per configured state that is not a done state** — a finished column is a record, not a queue, so it is never offered a limit. The most items that stage should hold. Reads the full column, not the filtered count, and refuses nothing |
| Policy for *&lt;state&gt;* | *(off)* | **One per configured state**, done ones included. The working agreement for that column, readable from its header and menu |
| Home folder | `docs` | The folder the backlog lives under; every type folder below defaults to a subfolder of it |
| Horizon property | *(off)* | Note property holding the roadmap's horizon; with **Horizons (in order)** it makes the bucket axis |
| Horizons (in order) | `Now, Next, Later` | The buckets the horizon axis draws, in order. Naming a **Horizon property** is enough to turn the axis on — the values ship populated, so you only need to edit this list to rename or add buckets |
| Start date property / Target date property | *(off)* | The dates the timeline draws bars from. **Either one alone is enough** — a target-only roadmap or a start-only plan both work |
| Started date / Finished date property | *(off)* | Where the board stamps transition dates as a card moves. Never the same properties as the planned dates above — a plan must not overwrite a record |
| Show completed items | on | Off hides fully-done subtrees from the tree, the board and the roadmap (only while a state property is set); the Deliverables board ignores it — see [The Deliverables board](#the-deliverables-board) — and nothing about ranking or rollups changes anywhere |
| Folder for *&lt;type&gt;* items | `<home>/requirements`, `<home>/tasks`, `<home>/issues`, `<home>/bugs`, `<home>/ideas`, `<home>/deliverables`, `<home>/milestones` | **One folder picker per configured type.** Untouched, each follows the home folder |
| Deliverable state property | *(off)* | Note property with the Deliverable workflow's own state. Left off, the Deliverables board falls back to the board above's own state property rather than going inert — and to its states and done values only where you have left the two rows below **empty**, since a list you fill in is this workflow's own either way |
| Deliverable workflow states (in order) | *(off)* | The Deliverables board's columns, in that order. **Whatever you set here wins**, whether the workflow has a property of its own or shares the one above. Left empty it falls back to **Workflow states (in order)** while **Deliverable state property** is also unset; with your own property set it draws the states your Deliverables actually carry |
| Deliverable states that count as done | `Done, Closed, Completed, Removed` | Which Deliverable state values complete a Deliverable. **Whatever you set here wins**, whether the workflow has a property of its own or shares the one above. Left empty it falls back to **States that count as done** while **Deliverable state property** is also unset; with your own property set it stays the default shown here rather than borrowing that customization |
| Property column width | `132` px | Width of one property column. **Which** properties are columns is the Bases **Properties** menu's, not a view option — see [Properties on a row](#properties-on-a-row) |
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
npm run test-build     # build into .obsidian/plugins/ here, so the repo is a test vault
npm test               # unit + DOM interaction tests (vitest, jsdom)
npm run test:coverage  # tests with enforced coverage thresholds
npm run lint           # eslint with the official eslint-plugin-obsidianmd rules
npm run analyze        # fallow: dead code, duplication, complexity, dependencies
npm run check          # everything in one shot — the pre-commit gate
```

### Trying a build

`npm run test-build` bundles the plugin into `.obsidian/plugins/product-backlog-view/`
**inside this repository**, so the repository root can be opened as an Obsidian vault
with the plugin already installed and listed as enabled — no second checkout, no
symlink, no copying three files by hand after every edit. The bundle is unminified with
an inline sourcemap, so a stack trace in the developer console points back at the
TypeScript. The vault folder is gitignored.

A vault opened for the first time is in **Restricted Mode**, which loads no community
plugin whatever the enabled list says: turn it off once under *Settings → Community
plugins*. The script deliberately doesn't do that for you — it's a security decision that
belongs to whoever opens the vault.

There is a backlog waiting in it. `docs/` is this plugin's own register, written in the
plugin's own schema and laid out the way the view files things by default —
`requirements/` (Epic → Feature → PBI), `tasks/`, `issues/`, `bugs/`. Open
`docs/Product Backlog.base` and the plugin is displaying the backlog that produced it.
Bases is a core plugin and must be enabled for the view to appear at all.

This matters more than a convenience script usually would: **no test in this repository
can check what the plugin looks like**, and several Bases behaviours are assumed rather
than exercised, because Obsidian cannot run in the jsdom harness. This is the shortest
path to checking those by hand.

`src/` is organised in four layers, each of which may reach anything below it and
nothing above:

| | |
| --- | --- |
| `domain/` | What a backlog *is*: tree building, ranking, drop-target math, the view-options schema. Reads the vault, never writes it, never touches the DOM. |
| `storage/` | The only place anything is persisted: frontmatter and its inverses, new notes, the `.base` file, view state. |
| `view/` | The Bases view itself — rendering, drag & drop, keyboard, menus, undo. |
| `commands/`, `ui/` | The "Create backlog" command, and the shared prompts. |

The direction is enforced, not just documented: `eslint.config.mjs` fails the build if
`domain/` imports from `view/`, and bans `processFrontMatter`, `vault.create` and
`load/saveLocalStorage` anywhere outside `storage/` — so a new write path can't appear
by accident. Several of the subtler invariants are checks rather than prose for the same
reason: ranking may not run over the rendered (focus-mode) roots, a menu opened from a
button must anchor to that button, and a hierarchy level may never be derived from the
depth a row happens to be drawn at.

The pure logic — tree building, drop planning, ranking, property backfill, note
creation, undo capture and restore — is covered by node unit tests, and the interaction
layer (rendering, drag & drop, keyboard, menus, creation prompts) by jsdom tests that dispatch real DOM events
against the actual view, all running against a small mock of the `obsidian` module
(`test/helpers/obsidian-mock.ts`). Coverage (v8) is threshold-enforced. Linting uses Obsidian's
official [`eslint-plugin-obsidianmd`](https://github.com/obsidianmd/eslint-plugin)
ruleset plus size/complexity budgets, and [fallow](https://github.com/fallow-rs/fallow)
gates dead code, duplication, complexity hotspots (CRAP, fed by the coverage report) and
dependency hygiene. CI runs the full gate on every push and pull request. `CLAUDE.md`
documents the architecture, invariants and test harness for AI-assisted development.

## License

MIT
