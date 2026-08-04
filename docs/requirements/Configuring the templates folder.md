---
type: PBI
parent: "[[Item Templates]]"
order: 10
status: Open
---

# Configuring the templates folder

**As** a backlog owner, **I want** to point the view at one folder of templates,
**so that** saving or editing a template is just editing a note, and the plugin knows
which of my item types each one is for without me maintaining a second list anywhere.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner, in the view options |
| **Trigger** | Setting `templatesFolder` in the view options |
| **Preconditions** | None — the feature is off until this is set |
| **Guarantee** | A note counts as a template only when it carries `templateForKey` naming a value from the type vocabulary. Nothing else in that folder — a README, an unrelated note — is treated as one. |

**Main flow**

1. A backlog owner sets `templatesFolder` — one shared folder, the same shape as
   `homeFolder` — in the view options.
2. A note in that folder is recognised as a template for a type when it carries the
   configured `templateForKey` (default `templateFor`) naming one of the vocabulary's
   type names.
3. Everything else about the note — its body, any other frontmatter — is the template's
   content: the body becomes what a new item starts with, and the other frontmatter is
   what rides along with it ([[Creating an item from a template]]).
4. A template note carries no `type` and no `parent`, so it never satisfies
   [[What counts as a work item]] — it is invisible to the tree by construction, wherever
   `templatesFolder` sits relative to a base's own filter. No second exclusion rule is
   needed.

**Extensions**

- **1a — `templatesFolder` is left empty.** The feature is off: no template picker
  appears when creating an item, and no "New template" action is offered.
- **2a — a note in the folder carries no `templateForKey`, or a value outside the
  vocabulary.** It is not a template. It renders and edits as an ordinary note; the
  plugin does not touch it.
- **2b — two notes in the folder name the same type.** Both are offered as separate
  templates for that type — a shared folder holds a set, not a slot.

## Acceptance criteria

- `templatesFolder` is a single folder, configured once, independent of `homeFolder` and
  every `typeFolder.<type>`.
- `templateForKey` is a configurable frontmatter key, defaulting to `templateFor`, the
  same way `stateKey` and `tagsKey` are configurable rather than fixed.
- A note is a template if and only if it carries `templateForKey` with a value from the
  configured type vocabulary — presence and a valid value, not merely living in the
  folder.
- A template note is never pulled into the tree as a work item, because it carries
  neither `type` nor `parent` — an existing rule, not a new check.
- Clearing `templatesFolder` turns the whole feature off.

## Where it lives

Nothing yet — this note is design. `src/domain/settings.ts` (`templatesFolder`,
`templateForKey`, alongside `homeFolder`/`typeFolders`) ·
`src/domain/viewOptions.ts` (the two new options) · `src/domain/itemTypes.ts` or a new
`domain/templates.ts` (matching template notes to a type from the vault).
