---
type: PBI
parent: "[[Item Templates]]"
order: 30
status: Open
---

# Adding templates from the plugin

**As** a backlog owner, **I want** to create a template — from scratch or from an item I
already have — without hand-writing its frontmatter, **so that** every template is
recognised correctly the first time and I never have to remember the property name myself.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The **New template** command/button, or **Save as template** on an existing item's context menu |
| **Preconditions** | `templatesFolder` is configured ([[Configuring the templates folder]]) |
| **Guarantee** | A template note created either way carries a valid `templateForKey` and nothing that would make it a work item — no `type`, no `parent`, no `order`. |

**Main flow**

1. The user runs **New template**.
2. A modal asks which type the template is for (the same vocabulary as item creation)
   and a name.
3. The view creates a note in `templatesFolder` with only `templateForKey` set to the
   chosen type — an otherwise blank note.
4. Unlike [[New item flow]], the note **is** opened: writing the template's body is the
   entire point of the action, and there is no batch-creation case to protect against
   being pulled into.

**Extensions**

- **1a — the trigger is **Save as template** on an existing item's row or card.** The
  type is not asked: it is fixed to that item's own `type`. A modal asks only for the
  new template's name (defaulting from the source item's title). The created note's body
  and frontmatter start as a copy of the source item's own — minus the plugin's hierarchy
  keys (`type`, `parent`, `order`) and any horizon or date-stamp keys, which are facts
  about that item's own history and place, not defaults for a future one. It is then
  opened, same as step 4.
- **2a — the name matches a template that already exists in `templatesFolder`.** A number
  is appended, the same collision handling [[New item flow]] already uses.
- **1c — `templatesFolder` is not yet configured**, whichever trigger started the flow.
  The action asks for the folder first (reusing the folder-prompt shape
  [[Scaffolding a backlog]] already has), then proceeds — it does not simply fail with
  nothing to do.
- **3a — the folder does not exist.** It is created, the same as any other creation path.
- **3b — the write fails.** A notice says so and points at the console, the same as
  every other creation path.

## Acceptance criteria

- **New template** creates a note in `templatesFolder` carrying only `templateForKey`,
  never `type`/`parent`/`order`.
- **Save as template** carries over the source item's body and non-hierarchy frontmatter,
  strips the hierarchy and axis keys, and fixes the type to the source's own.
- Both paths open the created note; neither is a silent batch action.
- Both go through the same config gate as every other write.
- A name collision in `templatesFolder` is handled the same way a title collision is
  handled elsewhere — a number appended, nothing overwritten.

## Where it lives

Nothing yet — this note is design. `src/commands/` (a new `New template` command, beside
`scaffold.ts`) · `src/view/interactions/menu.ts` (**Save as template** on the row/card
menu) · `src/ui/prompts.ts` (the type-and-name modal) · `src/storage/frontmatter.ts`
(the template-note write, sharing `createBacklogItem`'s atomicity and collision handling
rather than a second copy of it).
