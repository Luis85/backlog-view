---
type: PBI
parent: "[[User manual]]"
order: 30
status: Open
priority: P2
created: 2026-08-01
files:
  - src/view/interactions/create.ts
  - src/domain/folderNotes.ts
  - src/ui/prompts.ts
  - src/commands/scaffold.ts
---

# Help for creating and filing

The manual section on where items come from and where they land: the three ways to make
one, the folder each type is filed in, and the one setting that decides whether a new
note appears in the view at all.

## What the section says

- **Four entry points.** The row's **+** for a child, the row's **context menu**, which
  lists `New <type>` directly, the toolbar **New** for the type the view is currently
  about, and the **▾** beside it for any type at the top level. Where a row can hold more
  than one kind of item, the **+** modal asks which; the menu names them instead, which is
  one click shorter. The menu is not a duplicate of the **+**: that button carries
  `tabindex="-1"` because the tree is a single tab stop, so the menu — reachable with
  <kbd>Menu</kbd> or <kbd>Shift</kbd>+<kbd>F10</kbd> — is the keyboard path to creating a
  child, and the section says so where a keyboard user will look.
- **Filing is per type.** One folder picker per type — a Bug is filed with the bugs
  wherever in the tree it hangs. Each picker holds a complete path and defaults to a
  subfolder of the home folder, so an untouched one follows it and relocating a backlog
  stays one setting; a folder you pick by hand keeps its own path, wherever that points.
  Folder mode overrules both, filing a child beside its parent's folder note — except
  under a **context parent**, where that rule is deliberately skipped so the new note does
  not land outside the filter and vanish; the explicit `parent` link keeps the hierarchy
  right wherever it does land.
- **The warning worth reading before the first item**: the view creates a note and then
  shows it only if the Base's filter matches it. Type folders left at their defaults under
  a base filtered elsewhere create items you will not see. They are not lost — the
  `parent` links are intact — but they are not where you were looking. **Create backlog**
  scaffolds a base whose folders agree with its own filter.
- **Backfill is not creation.** The ✨ button assigns `type` and `order` to notes that
  lack them, never overwrites a value, and never guesses a type for an item whose parent
  is outside the view.
- **Folder mode**, in one paragraph: with `Infer hierarchy from folder notes` on, a folder
  note parents the folder's contents and new children are filed beside it — with the
  context-parent exception above, which is the one place the rule does not hold.

## Acceptance criteria

- The filter-versus-folder warning is in the section, not only in the README — it is the
  one filing mistake that silently produces invisible notes.
- The resolution order is given as the ordered list it is, first match wins.
- Backfill is described by what it will not do, since that is what makes it safe to press.
- Every path is listed with a keyboard equivalent where one exists; the row **+** is not
  presented as the only way to create a child, because it is the one path a keyboard user
  cannot take.
- The section reaches the reader from the modal too: creating an item is the moment the
  folder question is asked, so the manual opens on this section from there.

## Evidence

- `src/view/interactions/create.ts` and `src/ui/prompts.ts` — the flow and its prompts.
- `src/commands/scaffold.ts` — the command that makes filter and folders agree.
- [[Where new items are filed]], [[New item flow]], [[Backfill missing properties]],
  [[Folder note hierarchy]] — the built behaviour.
- `README.md`, sections *Where new items are filed* and *Setup*.
