---
type: PBI
parent: "[[Multilang]]"
order: 80
status: Open
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Persisted keys stay as written

Everything the plugin puts in a `.base` file, in localStorage or on disk is byte-identical
in every locale.


**As** someone whose vault is configured in one language and opened in another, **I want**
everything the plugin persists to be byte-identical across locales, **so that** switching
language never silently resets my configuration.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone whose vault outlives one language setting |
| **Trigger** | Any write: frontmatter, a `.base` file, a created note, view state |
| **Preconditions** | The translation layer exists |
| **Guarantee** | Nothing the plugin writes changes with the locale. A vault created in one language is fully readable in every other. |

**Main flow**

1. The user does something that writes — a move, a creation, a scaffold, a collapse.
2. The write path resolves keys and values from the canonical vocabulary.
3. The bytes that land are the same ones any other locale would have written.

**Extensions**

- **2a — the value is an option key.** Byte-identical, including every generated
  `typeFolder.<type>` key, which is derived from a type name.
- **2b — the value is a placeholder that mirrors a real default.** It stays as written,
  because clearing the field falls back to exactly that string.
- **2c — the write is a restore.** `applyRestores` replays values captured from the note,
  so it is locale-independent by construction — a dependency on `applyWrites` being
  correct, not an exemption from checking.
- **3a — the write is the scaffold.** The generated `.base` content and the created file
  path are identical to the English run, byte for byte.
- **3b — the write is view state.** The base's identity key does not vary by locale,
  or a language switch drops everyone's view state.

## What is covered

**View-option keys** — all of them, including the generated `typeFolder.<type>` set.
Covered by an assertion against a frozen key list in `View options and config warnings`;
restated here because this is the note the invariant lives in.

**Option values that are defaults, not hints.** `DEFAULT_DONE_VALUES` looks like UI text
and is not. It is the `doneValues` option's real `default`, shown as its placeholder too,
so clearing the field falls back to exactly the string on screen. Translating it would
make the placeholder describe behaviour the option does not have.

The neighbouring option is the opposite case and the two are easy to confuse — this note
originally got it wrong. `stateValues` is declared `default: ''` with
`placeholder: 'New, Active, Done'` (`viewOptions.ts:112-117`): that placeholder is an
**example**, never parsed, never a fallback. It is text, and it belongs in the catalog.

So the test is not "does it look like a value" but **does anything read it back**:

| Placeholder | Kind |
| --- | --- |
| Mirrors the option's real `default` (`doneValues`) | Data — leave as written |
| An example of what to type (`stateValues`, `Item title`, `Sprint-12`) | Text — translate |

Sorting every placeholder in `viewOptions.ts` by that test is part of
`View options and config warnings`.

**The scaffold's output** (`storage/baseFile.ts`) — `name: Backlog` inside the generated
`.base`, `BASE_FILE_NAME = 'Product Backlog'`, `DEFAULT_BACKLOG_FOLDER = 'docs'`. The
**Create backlog** command's *prompt* is UI and gets translated; what it writes does not.
A vault whose folder is called `Dokumente` because of who ran the command once is a vault
that stops matching every `file.inFolder("docs")` filter written since.

**View-state keys.** `storage/viewStateStore.ts` keys view state on the base's
path and prunes entries that name a path no longer present. Any locale-dependent
component in that identity would drop every user's view state on a language switch,
and `docs/tests/cases/Verify base identity in a live vault.md` records that base identity is
one of the two things this repository cannot test.

**Wikilink targets.** `parent: "[[Some Note]]"` names a file. Files are vault content.

## Acceptance criteria

- A test runs the scaffold under a non-English **fixture** locale and asserts the
  generated `.base` content and the created file path are identical to the English run,
  byte for byte. English ships alone, so a fixture is what makes this assertion capable
  of failing at all.
- A test asserts the full view-option key set is identical across every locale, fixtures
  included. Restricting it to *shipped* locales makes it a one-element comparison in this
  round, which proves nothing.
- The view-state store key for a given base is identical across locales.
- No frontmatter value written by `applyWrites`, `applyRestores` or `createBacklogItem`
  differs by locale. Those are the **three** functions that put frontmatter on disk —
  `processFrontMatter` at `frontmatter.ts:70` and `:155`, and `vault.create` at `:262` —
  and a small closed set is what makes this checkable at all.
- `applyRestores` is the one worth stating rather than testing blind. It replays values
  **captured from the note** when the forward batch landed, so it is locale-independent by
  construction rather than by care: it emits what was already there. That makes it a
  *dependency*, not an exemption — a forward write that ever emitted a localized value
  would be faithfully replayed by undo and by redo, so its correctness is inherited
  entirely from `applyWrites`. The criterion is to verify that reasoning holds, not to
  skip the function because it looked derivative.
- A `docs/tests/cases/` note records the one thing tests cannot cover: whether a vault created
  in one language opens correctly in another. That needs two live vaults **and two
  languages**, so with English shipping alone it cannot arise yet — the note is opened
  against the first real translation, not this round.

## Where it lives

**Nothing yet — this note is design.** `src/storage/frontmatter.ts` holds the two writers
that EDIT a note — `applyWrites` and `applyRestores` — and `src/storage/createNote.ts` the
one that makes one, `createBacklogItem` · `src/storage/baseFile.ts` writes the scaffolded `.base` and owns the
`docs` and `Product Backlog` defaults · `src/storage/viewStateStore.ts` keys the view state
on the base's path · `src/domain/typeVocabulary.ts` derives `typeFolderKey` from a type name.
Tests: `test/storage/frontmatter.test.ts`, `test/storage/restore.test.ts`,
`test/storage/baseFile.test.ts`, `test/storage/viewStateStore.test.ts`.
