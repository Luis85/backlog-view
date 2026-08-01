---
type: PBI
parent: "[[Multilang]]"
order: 70
status: Open
---

# Type names are data

`Epic`, `Feature`, `PBI`, `Task`, `Issue` and `Bug` keep their spelling in frontmatter in
every locale. What changes is the **label** shown beside them.

## Why they cannot simply be translated

`LEVELS` and `EXTRA_TYPES` are constants in `domain/settings.ts`, and the domain guide is
explicit that this is a decision, not an oversight: *"The vocabulary is FIXED … Making
them configurable cost collision rules between the two lists, a 'what folder does a name
nobody chose get' question with no good answer, and a schema that had to be generated per
view; what it bought was a rename."*

Localizing the stored names is that same rename, with the cost paid per language:

- `type: Epic` is written by `storage/frontmatter.ts` and read back case-insensitively by
  `focusTarget` and `isExtraType`. A vault whose notes say `Epos` is a vault an English
  Obsidian shows as untyped.
- `typeFolderKey(type)` derives a **persisted** option key from the type name, so the
  configured folder for each type would reset on a language switch.
- `focusLevel` is persisted as a type name and matched against `ALL_TYPES`.
- `docs/` — this register — is itself a backlog in this schema, and `Product Backlog.base`
  is shipped as the worked example.

## What to build instead

A display label per type, resolved for rendering only, with the stored name untouched.
`displayType` (`domain/itemTypes.ts:111`) is the existing seam: it already answers "what
name goes on this item's badge", already distinguishes a configured level from a
user-named type, and already returns the type name for anything off the ladder.

That last case is the one to get right. A user's own type — the `Bugfix` example in the
domain guide — has **no** translation and must render exactly as the user spelled it.
Only the six names this plugin ships get a label.

## Acceptance criteria

- No write path can emit a localized type name. Every `type:` value written in any locale
  is one of the six shipped spellings, or a name the user typed.
- Badges, the `New <type>` button and its picker, the `New <type>` menu items, the modal's
  type dropdown and the focus-level control all show the label.
- The type *chosen* in the modal is stored by its canonical name, not by the label the
  user clicked. This is the single most likely bug in this feature.
- A user-named type off the ladder renders verbatim, in every locale.
- `typeFolderKey` keeps deriving from the canonical name, and a test asserts the key set
  is identical across locales.
- `EXTRA_TYPES` matching stays case-insensitive against canonical names only — a label
  must never be accepted as a match, or an English vault would start recognizing German
  type names.
