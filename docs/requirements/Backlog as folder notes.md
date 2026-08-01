---
type: PBI
parent: "[[Creating items]]"
order: 40
status: Open
priority: P2
created: 2026-08-01
source: user request
files:
  - src/view/interactions/create.ts
  - src/storage/frontmatter.ts
  - src/domain/itemTypes.ts
  - src/domain/settings.ts
  - src/domain/viewOptions.ts
---

# Backlog as folder notes

The write-side counterpart of [[Folder note hierarchy]]. That PBI taught the view to
*read* `Checkout/Checkout.md`; it deliberately never made one, so the mode only works on a
folder tree somebody built by hand. This one lets the backlog be *stored* that way: one
view option, and a new item is written as `<folder>/<Title>/<Title>.md` instead of
`<folder>/<Title>.md`, so a subtree of work becomes a subtree of folders.

Flat stays the default and stays the shipped layout. This is a choice about how a backlog
is filed, not a claim that folders are better.

## Why it exists

- Reading and writing the layout are two halves of one feature and only one shipped.
  `inferFolderHierarchy` has no way to produce the structure it reads.
- A note that owns a folder owns a place to put things beside it — attachments, notes,
  a spec, a design — which is the whole reason folder notes are a convention.
- The folder tree becomes navigable in the file explorer as the same hierarchy the view
  shows, for the people who work outside the view as well as in it.

## What the user chooses

**One toggle** in the **New items** option group — `Create items in their own folder`,
persisted as `createFolderNotes`, default off. It is a property of the view, not a
question the create modal asks: a backlog is laid out one way, and asking per item is how
a tree ends up half and half by accident.

It is independent of `Infer hierarchy from folder notes`. This option decides where a note
is *written*; that one decides how the tree is *read*. Creation writes the explicit
`parent` link either way, so each does its job alone, and used together they agree by
construction — which is the pairing this exists for.

## Acceptance criteria

### The option

- Default off, and off reproduces today's behaviour exactly. The default is not a real
  value, so it needs no `clearable` treatment (see `resolveSettings`).
- Turning it on or off never touches a note already on disk. Flat and foldered items
  coexist in one tree and nothing downstream distinguishes them — a folder note is an
  ordinary note.
- Board creation ([[New cards in place]]) inherits this by going through the same gated
  flow, with no rule of its own.

### Where a new item lands

- With the option on, the item is written to `<folder>/<Title>/<Title>.md`, where
  `<folder>` is **exactly** the folder that applies today: folder mode's parent folder,
  the type's folder, the home folder, where most items live, then ask. The option adds a
  level inside that folder; it does not change which folder the level is added to.
- The folder and the note carry the **identical** sanitized name, because `folderNotePath`
  derives one from the other — one sanitize, used for both. Sanitizing has to be legal for
  a folder as well as a file: a trailing `.` survives `sanitizeTitle` today and is a legal
  file name, but not a legal folder name on Windows.
- **Children land inside their parent's folder.** Today `promptCreateItem` applies "beside
  the parent's folder note" only when `folderHierarchy` is on; it must apply when this
  option is on too. Without that widening the mode files every new item as a *sibling* of
  the folder it belongs inside, and buys nothing at all.
- A parent that is **not** a folder note takes its children **beside** it, never under it.
  The child's container is the parent note's own folder — one rule, two outcomes, no file
  moves. The plugin does not move the parent to make a folder for it
  ([[Folder note hierarchy]]: files are never moved on disk), and it must not create
  `Checkout/` around a `Checkout.md` that lives outside it: a folder whose folder note sits
  elsewhere is one `nearestFolderNote` cannot read, so inference would silently miss the
  parent it was told to nest under.
- The context-row rule needs no new code and must not be weakened: an `outsideFilter`
  parent still does not lend its folder, and its child is still placed by the explicit link
  alone.
- When the prompt asks for a folder (nothing configured, nothing to infer), the folder it
  asks for and persists to `homeFolder` is the **container** — not the item's own folder.
  A backlog whose home folder is `docs/requirements/Checkout` is the failure this prevents.
- The modal still says where the item lands, and says the item gets its own folder there.
  The line names the container; the per-item level is stated, not interpolated from a
  half-typed title.

### Which items get a folder

- An item gets a folder when something can be created under it. The deepest ladder rung
  (`Task`, and anything typed as the last level) stays flat: `childTypeChoices` offers
  nothing under it, so its folder is one this plugin could never put anything in.
- Extra types (`Issue`, `Bug`) **do** get folders — they hold Tasks. An unknown custom
  type does too, since it continues the ladder and takes a child slot.
- The recorded cost: with Obsidian's attachment folder set to "same folder as the note", a
  Task's folder would not have been empty after all. Someone who wants that makes the
  folder by hand. A per-type choice — six more options in a group that already has seven —
  is not worth buying until somebody asks for it, and this rule can widen later without
  anything on disk changing.

### Collisions and failures

- Disambiguation happens on the **folder**: `Checkout 1/Checkout 1.md`, never
  `Checkout/Checkout 1.md`. A folder has exactly one folder note, and the second spelling
  makes a note whose name its own folder does not predict.
- An existing folder is reused only when it is **empty**. A populated `Checkout/` gets
  `Checkout 1/` instead: writing a folder note into a folder full of notes re-parents every
  one of them under inference, and creation writes the new note only — never a sibling.
  Naming a folder should be a deliberate act, not a side effect of typing a title that
  happens to match.
- A creation that fails leaves no empty folder behind.

### What it does not do

- Moving an item in the tree does not move its folder. Re-parenting writes a link, as it
  always has, so a foldered backlog can end up with a folder tree that disagrees with the
  item tree until someone tidies it. The item tree stays right regardless: explicit links
  beat inference. Making a move move the files is a different feature — a whole subtree on
  disk, link updates, and a write path that is not frontmatter — and is out of scope.
- Converting an existing flat backlog into folders is out of scope for the same reason.
  This option changes what is created next, not what is already there.

## Shape in the codebase

- `domain/itemTypes.ts` answers "does this type get a folder", beside `folderForType`.
  Node-testable, no new module.
- `domain/settings.ts` and `domain/viewOptions.ts`: one boolean, in the New items group,
  under the folder pickers it modifies.
- `view/interactions/create.ts`: widen the parent-folder condition, resolve the flag, pass
  it down. The folder resolution itself is untouched.
- `storage/frontmatter.ts`: `NewItemSpec` gains the flag; path building and the collision
  search move up one level to the folder. Still the only module that creates a note.
- `inferFolder` must count **container** folders. With the option on every item has a
  folder of its own, so every count is 1 and the "where do most items live" fallback would
  aim a new top-level item into some other item's folder. Count a folder note's parent
  folder instead. Reached only when no folder is configured for any offered type, which is
  why it is easy to miss and worth stating.

## Evidence

Read on 2026-08-01, in this repository:

- `create.ts` (`promptCreateItem`) gates the parent-folder rule on `settings.folderHierarchy`
  — that single condition is the line this PBI widens, and the reason the mode is inert
  without it.
- `createBacklogItem` builds `<folder>/<name>.md` and dedupes by scanning the *file* path;
  those are the two places the folder level is added and the two places the collision rule
  changes.
- `folderNotes.ts` (`folderNotePath`, `walkUp`) is the convention both halves must spell
  the same way, including the rule that a folder note starts its own walk above its folder.
- `docs/` is itself the proof that nesting survives a folder filter: `Product Backlog.base`
  filters on `file.inFolder("docs")` and every row it shows lives in `docs/requirements/`
  or deeper, so `inFolder` matches subfolders and a foldered item stays inside the filter it
  was created from. A base filtered by an equality on `file.folder` instead would exclude
  its own new items — the user's to fix, and the same class of trap [[New cards in place]]
  records for state filters.

Obsidian cannot run here, so the layout needs one live-vault pass (`npm run test-build`):
create into a fresh folder, create a child and confirm it nests, and confirm the tree reads
back identically with `Infer hierarchy from folder notes` both on and off. The jsdom harness
covers the paths written and the choices made; it cannot say the result looks like a
backlog in the file explorer.
