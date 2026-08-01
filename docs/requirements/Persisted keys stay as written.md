---
type: PBI
parent: "[[Multilang]]"
order: 80
status: Open
---

# Persisted keys stay as written

Everything the plugin puts in a `.base` file, in localStorage or on disk is byte-identical
in every locale.

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

**Collapse-store keys.** `storage/collapseStore.ts` keys collapse state on the base's
path and prunes entries that name a path no longer present. Any locale-dependent
component in that identity would drop every user's collapse state on a language switch,
and `docs/issues/Verify base identity in a live vault.md` records that base identity is
one of the two things this repository cannot test.

**Wikilink targets.** `parent: "[[Some Note]]"` names a file. Files are vault content.

## Acceptance criteria

- A test runs the scaffold under a non-English locale and asserts the generated `.base`
  content and the created file path are identical to the English run, byte for byte.
- A test asserts the full view-option key set is identical across every shipped locale.
- The collapse-store key for a given base is identical across locales.
- No frontmatter value written by `applyWrites` or `createBacklogItem` differs by locale.
  These are the only two write functions, which is what makes this checkable at all.
- A `docs/issues/` note records the one thing tests cannot cover: whether a vault created
  in one language opens correctly in another. That needs two live vaults.
