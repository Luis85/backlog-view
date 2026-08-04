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
   [[What counts as a work item]] — while "Ignore notes outside the hierarchy" is on (the
   default), it is invisible to the tree wherever `templatesFolder` sits relative to a
   base's own filter, by the same rule that already keeps an ADR out. No second exclusion
   rule is needed.

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
- **4a — "Ignore notes outside the hierarchy" is off**, and `templatesFolder` sits inside
  the base's own filter. A template note becomes a plain top-level item, exactly as any
  other untyped, parentless note does in that mode (an ADR included) — that is the
  existing meaning of the toggle, not a gap specific to templates. Keeping
  `templatesFolder` outside the base's filtered folder avoids it in either mode; leaving
  hierarchy pruning on (the default) avoids it without that.
- **4b — a template note is hand-edited to also carry `type` or `parent`.** It becomes a
  work item, the same as any other note anyone gives those keys to by hand. Nothing
  about template recognition prevents this; it is the general rule in
  [[What counts as a work item]], not a template-specific exclusion to maintain.
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
- A template note is never pulled into the tree as a work item while "Ignore notes
  outside the hierarchy" is on (the default), because it carries neither `type` nor
  `parent` — an existing rule, not a new check. With that option off, it is a plain item
  like any other untyped note, which is that option's documented behaviour.
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
`src/domain/viewOptions.ts` (the two new options) · `src/domain/itemTypes.ts` or a new
`domain/templates.ts` (matching template notes to a type from the vault).
