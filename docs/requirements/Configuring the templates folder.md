---
type: PBI
parent: "[[Item Templates]]"
order: 10
status: Open
started: ""
finished: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
horizon: ""
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
   type names, matched case-insensitively — the same tolerance every other type
   comparison in this plugin already gives a note's own spelling.
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
  vocabulary.** It is not a template — and, like everything else under `templatesFolder`,
  it is not a backlog item either, by step 4's folder-wide exclusion rather than by
  anything of its own. "Renders and edits as an ordinary note" means outside this view:
  in Obsidian's file explorer and editor as always. It never renders as a row in the
  tree, marked or not, the same as a README in that folder never does.
- **2b — two notes in the folder name the same type.** Both are offered as separate
  templates for that type — a shared folder holds a set, not a slot.
- **4a — a note under `templatesFolder` is hand-edited to carry `type` and `parent`, and
  put to real use as a work item anyway.** It still never appears: the exclusion is on
  the folder, not on the frontmatter, so nothing inside it links into the tree no matter
  what it carries. Anyone who wants a real item there has to move it out first. This is
  the model's own exclusion, not the Base's: if `templatesFolder` sits inside the Base's
  own filtered folder, `file.inFolder(...)` matches subfolders
  ([[Backlog as folder notes]]), so the Base's own query still returns the note — the
  raw entries `buildModel` receives still include it. But `model.results` is not that raw
  query: it is `model.items` filtered by `outsideFilter`, built from the same linked tree,
  so a note excluded before linking is absent from **both** — there is no array in the
  model where this note appears. "The Base still queries it, the model never does" is the
  accurate version of the sentence that used to be here.
- **1d — `templatesFolder` is an ancestor of, or equal to, `homeFolder` or any
  `typeFolder.<type>`** (`templatesFolder: docs` with `homeFolder: docs/backlog`, say).
  Every note under that item folder is excluded from the tree too, real items included —
  the whole item folder sits inside the one being excluded. The reverse nesting
  (`templatesFolder` a subfolder *of* an item folder, e.g. `docs/backlog/templates` under
  `docs/backlog`) is not the same risk: only notes inside that narrower templates
  subfolder are ever excluded, and ordinary item creation never lands there. This is the
  same self-inflicted-misconfiguration category as `templateForKey` colliding with
  another key, though checking folder containment is a different shape of validation than
  the key-equality check `configProblems` already does, so nothing here mechanically
  catches it yet.
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
- **2c — the `templateForKey` picker is cleared, with `templatesFolder` still set.**
  It falls back to `templateFor`, the same way clearing `parentKey`/`orderKey`/`typeKey`
  falls back to `parent`/`order`/`type` rather than going blank. Unlike `stateKey` and
  `tagsKey`, whose own emptiness is what turns each of *those* features off,
  `templateForKey` is not independently clearable to `''`: this feature's off-switch is
  `templatesFolder` alone, and a marker key that could go blank while the folder stays
  set would leave recognition (step 2) and **New template**'s own write with no key to
  use, breaking a feature that still reads as configured.

## Acceptance criteria

- `templatesFolder` is a single folder, configured once, independent of `homeFolder` and
  every `typeFolder.<type>`.
- `templateForKey` is a configurable frontmatter key that always resolves to a real
  value, defaulting to `templateFor` — never independently clearable to `''`, the same
  way `parentKey`/`orderKey`/`typeKey` never are. Its own on/off switch is
  `templatesFolder`, not itself.
- A note is a template if and only if it lives under `templatesFolder` **and** carries
  `templateForKey` with a value from the configured type vocabulary, compared
  case-insensitively — both conditions, not either alone: living in the folder without
  the key is an ordinary note (2a), and the key alone without the folder is not a
  template no matter where in the vault it sits.
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
`templateForKey` resolved the same way as `parentKey`/`orderKey`/`typeKey` — always a
real value, never independently cleared — alongside `homeFolder`/`typeFolders`;
`ownedProperties` gains an entry
for `templateForKey`, included only while `templatesFolder` is non-empty, so
`configProblems` covers the new key exactly while the feature it guards is on) ·
`src/domain/viewOptions.ts` (the two new options) · `src/domain/model.ts`
(`createItems`/`linkAll` — notes under `templatesFolder` excluded from item linking
itself, ahead of `pruneOutsideHierarchy` and folder-inferred parents) ·
`src/domain/itemTypes.ts` or a new `domain/templates.ts` (matching template notes to a
type from the vault).
