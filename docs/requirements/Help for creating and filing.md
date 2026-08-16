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
started: ""
finished: ""
horizon: Later
start: 2026-08-01
due: ""
risk: ""
assignee: ""
---

# Help for creating and filing

**As** someone adding work to a backlog, **I want** to know where a new note will land
before I confirm it, **so that** I do not create items into a folder the Base does not
return and then go looking for them.

The manual section on where items come from and where they go: the four ways to make one,
the folder each type is filed in, and the one setting that decides whether a new note
appears in the view at all.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Opening the manual on the creating section, from the **?** button or from the new-item modal, where the folder question is being asked |
| **Preconditions** | A `product-backlog` view is open |
| **Guarantee** | The section names the folder resolution in the order the code applies it, first match wins, and never promises that a created note will be visible — only what decides where it lands. |

**Main flow**

1. The section lists the four entry points: the row's **+**, the row's **context menu**
   (which names `New <type>` directly), the toolbar **New**, and the **▾** beside it for
   any type at the top level.
2. It marks the context menu as the keyboard path: the row's **+** carries
   `tabindex="-1"` because the tree is a single tab stop, so the menu — reachable with
   <kbd>Menu</kbd> or <kbd>Shift</kbd>+<kbd>F10</kbd> — is how a child is created without
   a mouse.
3. It explains filing per type: one folder picker per type, each holding a complete path
   and defaulting to a subfolder of the home folder, so an untouched picker follows the
   home folder and relocating a backlog stays one setting.
4. It gives the resolution order as the ordered list it is — folder mode, then the type
   folder, then the home folder, then the folder most existing items live in, and only
   then the prompt.
5. It states the warning worth reading before the first item: the view creates a note and
   then shows it only if the Base's filter matches, so folders left pointing outside the
   filter create items you will not see.
6. It separates backfill from creation: the ✨ button assigns `type` and `order` to notes
   that lack them, never overwrites a value, and never guesses a type for an item whose
   parent is outside the view.

**Extensions**

- **1a — the row can hold more than one kind of item.** The **+** modal asks which type;
  the context menu names them directly instead, which is one click shorter.
- **3a — a picker was set by hand.** It keeps its own path, wherever that points —
  including outside the home folder. Only untouched pickers follow it.
- **4a — folder mode is on.** A child is filed beside its parent's folder note, ahead of
  every configured folder, because that mode makes folders the hierarchy.
- **4b — the parent is a context row.** The beside-the-folder-note rule is deliberately
  skipped, and filing falls back to the ordinary resolution — type folder, home folder,
  then the inferred results folder. This avoids one known-outside destination; it is not a
  promise that the child stays visible, since those folders can sit outside the filter too
  and the Base may filter on properties a new note does not carry. The explicit `parent`
  link keeps the hierarchy right wherever it lands.
- **5a — the backlog was made by the command.** **Create backlog** writes every type
  folder under the folder it scaffolds, so a backlog made that way is consistent from the
  first Bug.
- **6a — an item's parent sits outside the view.** Backfill refuses to guess its type
  rather than writing one from a position it cannot see.

## Acceptance criteria

- The filter-versus-folder warning is in the section, not only in the README — it is the
  one filing mistake that silently produces invisible notes.
- The resolution order is given as the ordered list it is, first match wins, including the
  context-parent exception and what it falls back to.
- No promise that a created note is visible: the section says what decides the folder, and
  says that the Base's filter decides the rest.
- Backfill is described by what it will not do, since that is what makes it safe to press.
- Every path is listed with a keyboard equivalent where one exists; the row **+** is not
  presented as the only way to create a child, because it is the one path a keyboard user
  cannot take.
- The section reaches the reader from the modal too: creating an item is the moment the
  folder question is asked, so the manual opens on this section from there.

## Where it lives

`src/view/manual/sections.ts` — the creating section's own entries. The flow it describes
is `src/view/interactions/create.ts` (`promptCreateItem`, `inferFolder`) with
`src/ui/prompts.ts` (the modal and its folder line), `src/domain/itemTypes.ts`
(`childTypeChoices`, what the + offers), `src/domain/folderNotes.ts` (folder mode's own
rule), and `src/commands/scaffold.ts` (the command that makes filter and folders agree).

## Review note (2026-08-10) — not moved to Done

The `Backfill is described by what it will not do` criterion is unmet: the CREATING
entries in `src/view/manual/sections.ts` (`'The + on a row'` through `'Whether the new
note then appears'`) never mention backfill or the ✨ button at all — not `never
overwrites`, not `never guesses a type for an item whose parent is outside the view`,
nothing. That explanation exists, but only in the **setup** section's `'The toolbar's ✨
Assign missing properties'` entry, which this PBI's own main flow step 6 does not point
to — the use case says `The section` (this one) `separates backfill from creation`, and a
section that never names backfill cannot be read as separating anything from it. Left
`Open` rather than moved, since the section reads as if backfill is out of scope for it
entirely, and a reader with the modal open has no path from here to that explanation.
