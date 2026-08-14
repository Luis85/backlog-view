---
type: PBI
parent: "[[Multilang]]"
order: 70
status: Open
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Type names are data

`Epic`, `Feature`, `PBI`, `Task`, `Issue` and `Bug` keep their spelling in frontmatter in
every locale. What changes is the **label** shown beside them.


**As** someone whose vault was typed in one language and opened in another, **I want** the
type written in frontmatter to stay the same everywhere, **so that** my notes keep reading
as work items instead of quietly losing their type.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone creating or moving an item, in any locale |
| **Trigger** | Rendering a badge, offering a type, or writing `type:` to a note |
| **Preconditions** | The catalog exists |
| **Guarantee** | Every `type:` value written in any locale is one of the shipped spellings, or a name the user typed. A vault is readable by every other locale. |

**Main flow**

1. The view needs to show an item's type.
2. It resolves a display **label** for the canonical name.
3. The label renders — on the badge, in the picker, in the menu, in the modal.
4. When the user chooses a type, the **canonical name** is what gets written.

**Extensions**

- **2a — the type is not one this plugin ships.** It renders verbatim. A user's own
  `Bugfix` has no translation and must not acquire one.
- **3a — the label is used to match.** It is not: `EXTRA_TYPES` and the level ladder match
  canonical names only, case-insensitively, or an English vault would start recognizing
  German type names.
- **4a — the type feeds a persisted key.** `typeFolderKey` derives from the canonical name,
  so the per-type folder configuration cannot reset on a language switch.
- **4b — the type is offered in a dropdown.** The value stored and the label shown are
  separate arguments; today they are the same one.

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
Only the names this plugin ships get a label — the whole fixed vocabulary, whatever its
length. The count is deliberately not written down here: it is `ALL_TYPES`, and a
requirement that pins a number goes stale the moment one is added
([[Milestones as their own type]] is the case that proved it).

## Acceptance criteria

- No write path can emit a localized type name. Every `type:` value written in any locale
  is one of the shipped spellings, or a name the user typed.
- Every name in the shipped vocabulary has a label in every catalog, and the test asserting
  that reads the vocabulary rather than a count — so a name added to it fails the catalogs
  until they cover it, instead of rendering as a type nobody translated.
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

## Where it lives

**Nothing yet — this note is design.** `src/domain/itemTypes.ts` holds `displayType`, the
existing seam between what an item *is*
and what its badge says, plus `isExtraType` and `focusTarget` which must keep matching
canonical names · `src/domain/typeVocabulary.ts` defines the fixed vocabulary and
`typeFolderKey` · `src/view/render/rows.ts` renders the badge ·
`src/view/render/toolbar.ts` and `src/view/interactions/menu.ts` offer types ·
`src/ui/prompts.ts` is the dropdown whose value and label are one argument today ·
`src/storage/frontmatter.ts` is the only module that writes the name.
Tests: `test/domain/itemTypes.test.ts`, `test/view/creation.test.ts`.
