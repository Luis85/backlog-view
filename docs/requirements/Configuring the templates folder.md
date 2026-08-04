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
| **Guarantee** | A note counts as a template only when it carries `templateForKey` naming a value from the type vocabulary. Nothing else in that folder — a README, an unrelated note — is treated as one. Nothing under `templatesFolder` is ever linked into the tree as a backlog item, independent of "Ignore notes outside the hierarchy", "Infer parents from folder notes", or what frontmatter a note there happens to carry. |

**Main flow**

1. A backlog owner sets `templatesFolder` — one shared folder, the same shape as
   `homeFolder` — in the view options.
2. A note in that folder is recognised as a template for a type when it carries the
   configured `templateForKey` (default `templateFor`) naming one of the vocabulary's
   type names.
3. Everything else about the note — its body, any other frontmatter — is the template's
   content: the body becomes what a new item starts with, and the other frontmatter is
   what rides along with it ([[Creating an item from a template]]).
4. `templatesFolder` is excluded from item linking itself — before hierarchy scope runs,
   before a folder-inferred parent could attach one to the tree ([[Folder note hierarchy]]),
   and regardless of what `type` or `parent` a note there happens to carry. A narrower
   promise — "a template carries neither key, so [[What counts as a work item]] already
   excludes it" — turned out to need an escape hatch for hierarchy pruning being off, and
   another for folder mode inferring it a parent from a folder note above it; excluding
   the folder itself needs neither.

**Extensions**

- **1a — `templatesFolder` is left empty.** Creating an item never offers a template
  picker or body field — there is nothing to offer. The **New template** action and
  **Save as template** stay available regardless: running either asks for the folder
  first, the same first-use path [[Adding templates from the plugin]] describes.
- **2a — a note in the folder carries no `templateForKey`, or a value outside the
  vocabulary.** It is not a template. It renders and edits as an ordinary note; the
  plugin does not touch it.
- **2b — two notes in the folder name the same type.** Both are offered as separate
  templates for that type — a shared folder holds a set, not a slot.
- **4a — a note under `templatesFolder` is hand-edited to carry `type` and `parent`, and
  put to real use as a work item anyway.** It still never appears: the exclusion is on
  the folder, not on the frontmatter, so nothing inside it links into the tree no matter
  what it carries. Anyone who wants a real item there has to move it out first — the same
  way nothing inside `templatesFolder` is a Base result either.
- **1d — `templatesFolder` is configured to sit inside, or equal, `homeFolder` or any
  `typeFolder.<type>`.** Every note under that overlap is excluded from the tree too,
  real items included — the same self-inflicted-misconfiguration category as
  `templateForKey` colliding with another key, though checking folder containment is a
  different shape of validation than the key-equality check `configProblems` already
  does, so nothing here mechanically catches it yet.
- **1b — `templateForKey` is set to the same key as `parentKey`, `typeKey`, or any other
  configured property, while `templatesFolder` is also set.** A template would then
  necessarily carry `type` or `parent` the moment it carries `templateForKey`, breaking
  the invisibility this note promises. `templateForKey`'s entry in `ownedProperties` is
  included only while `templatesFolder` is non-empty — unlike every other optional
  property there, whose own key being empty is what exempts it, `templateForKey` defaults
  to `templateFor` rather than to empty, so its off-switch is `templatesFolder`, not its
  own value. Once both are set, the collision is refused — every write blocked, same
  message shape — exactly like a hand-configured `parentKey`/`orderKey` collision today.
- **1c — `templatesFolder` is unset and `templateForKey` happens to equal an existing
  key** (its default, `templateFor`, or a hand-typed value). Nothing is reported: the
  feature is off, so that key is not read as a template marker by anything, and an
  unrelated existing use of the same name is not a collision to warn about.

## Acceptance criteria

- `templatesFolder` is a single folder, configured once, independent of `homeFolder` and
  every `typeFolder.<type>`.
- `templateForKey` is a configurable frontmatter key, defaulting to `templateFor`, the
  same way `stateKey` and `tagsKey` are configurable rather than fixed.
- A note is a template if and only if it carries `templateForKey` with a value from the
  configured type vocabulary — presence and a valid value, not merely living in the
  folder.
- Nothing under `templatesFolder` is ever linked into the tree as a work item — not
  affected by "Ignore notes outside the hierarchy", "Infer parents from folder notes", or
  a hand-added `type`/`parent` on a note inside it. The exclusion is the folder, checked
  once, before linking runs — not a property of what each note carries.
- Clearing `templatesFolder` turns the template picker and body field off; **New
  template** and **Save as template** stay reachable and prompt for the folder.
- Once `templatesFolder` is set, `templateForKey` is one of `configProblems`' checked
  keys, so configuring it to match `parentKey`, `orderKey`, `typeKey`, or any other owned
  key is refused the same way two hierarchy properties sharing a key already is — never
  silently permitted.
- While `templatesFolder` is unset, `templateForKey` is never checked for collisions —
  an existing view whose `stateKey` or any other property already happens to be named
  `templateFor` upgrades without a new warning it never asked for.

## Where it lives

Nothing yet — this note is design. `src/domain/settings.ts` (`templatesFolder`,
`templateForKey`, alongside `homeFolder`/`typeFolders`; `ownedProperties` gains an entry
for `templateForKey`, included only while `templatesFolder` is non-empty, so
`configProblems` covers the new key exactly while the feature it guards is on) ·
`src/domain/viewOptions.ts` (the two new options) · `src/domain/model.ts`
(`createItems`/`linkAll` — notes under `templatesFolder` excluded from item linking
itself, ahead of `pruneOutsideHierarchy` and folder-inferred parents) ·
`src/domain/itemTypes.ts` or a new `domain/templates.ts` (matching template notes to a
type from the vault).
