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
| **Preconditions** | None — if `templatesFolder` isn't set yet, running either trigger asks for it first (1c) |
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
  keys (`type`, `parent`, `order`), the roadmap's axis keys (`horizon`, `start`,
  `target`) and the workflow's transition stamps (`started`, `finished`). All five are
  facts about that item's own place and history, not defaults for a future one, and both
  sets go — copying one class while leaving the other would still leak an old date into
  every item made from it. It is then opened, same as step 4.
- **1b — the source item's own `type` is empty, or outside the configured vocabulary.**
  [[What counts as a work item]] lets a note belong by parent alone, with no `type` at
  all, so this is reachable on an ordinary row. **Save as template** is not offered on
  that row or card's menu: fixing the template's marker to a type that does not exist
  would break the "always a valid `templateForKey`" guarantee above. **New template**
  still creates a template for any type, chosen explicitly, from nothing.
- **2a — the name matches a template that already exists in `templatesFolder`.** A number
  is appended, the same collision handling [[New item flow]] already uses.
- **1c — `templatesFolder` is not yet configured**, whichever trigger started the flow.
  The action asks for the folder first — the same prompt shape [[Scaffolding a backlog]]
  uses, except an empty submission is refused here rather than accepted: there, an empty
  answer is a legitimate "vault root"; here `''` is the exact value
  [[Configuring the templates folder]] defines as the whole feature being off, and
  accepting it would set the folder to "off" in the same breath as creating a template
  inside it — leaving that template immediately undiscoverable. The prompt stays open
  until a non-empty folder is given, then sets `templatesFolder` and proceeds. This is
  what makes **New template** and **Save as template** the way someone with no templates
  yet gets their first one, and why neither is gated behind
  [[Configuring the templates folder]] being done already.
- **3a — the folder does not exist.** It is created, the same as any other creation path.
- **3b — the write fails.** A notice says so and points at the console, the same as
  every other creation path.

## Acceptance criteria

- **New template** creates a note in `templatesFolder` carrying only `templateForKey`,
  never `type`/`parent`/`order`.
- **Save as template** carries over the source item's body and remaining frontmatter, and
  strips all three sets — the hierarchy keys, the roadmap's axis keys and the workflow's
  transition stamps — never leaving one class behind while the other goes.
- **Save as template** is not offered on an item with no usable `type` (missing, or
  outside the configured vocabulary); **New template** is the path for a template of any
  type there.
- Both paths open the created note; neither is a silent batch action.
- Both go through the same config gate as every other write.
- A name collision in `templatesFolder` is handled the same way a title collision is
  handled elsewhere — a number appended, nothing overwritten.
- The first-use folder prompt refuses an empty submission, so this flow can never end
  with `templatesFolder` still `''` — the value that means the feature is off — while a
  template note it just created sits undiscoverable.

## Where it lives

Nothing yet — this note is design. `src/commands/` (a new `New template` command, beside
`scaffold.ts`) · `src/view/interactions/menu.ts` (**Save as template** on the row/card
menu) · `src/ui/prompts.ts` (the type-and-name modal) · `src/storage/frontmatter.ts`
(the template-note write, sharing `createBacklogItem`'s atomicity and collision handling
rather than a second copy of it).
