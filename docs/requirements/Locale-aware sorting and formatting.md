---
type: PBI
parent: "[[Multilang]]"
order: 90
status: Open
---

# Locale-aware sorting and formatting

The places where the *locale* changes an ordering or a rendering even though no string is
being translated. Small, easy to miss, and nothing else in this feature will surface them.

## Where they are

Three `localeCompare` calls, all currently locale-less:

| Site | Sorts |
| --- | --- |
| `ui/prompts.ts:58` | Folder paths in the folder suggest |
| `domain/model.ts:495` | `observedStates` — the state vocabulary offered in the menu |
| `domain/model.ts:512` | The tag vocabulary |

Called with no locale argument, `localeCompare` uses the *host's* default, which is the
operating system's language rather than Obsidian's. So a user running Obsidian in one
language on a system set to another already gets a collation neither of them chose — a
bug that exists today and that this PBI is the natural place to fix.

Formatting is the other half: `columns.ts:276` renders `${done}/${total}` and
`columns.ts:280` a bare descendant count. Both are numbers shown to a person.

## Two locales, not one

The obvious reading — "pass the resolved locale" — is wrong, and it would preserve the
very mismatch this PBI exists to remove.

`Locale resolution and fallback` resolves the Obsidian language code down to a **shipped
catalog**, so with only English and German catalogs a French user resolves to `en`. Using
that for collation sorts their tags in English, even though `Intl` supports `fr` perfectly
well and has no idea this plugin ships no French messages. Every untranslated Obsidian
locale would keep exactly the bug described above, just sourced from the catalog instead
of from the OS.

So `getLanguage()` feeds two different things, and they must be kept separate:

| Locale | Value | Used by |
| --- | --- | --- |
| **Catalog** | Resolved to a shipped catalog, English as the floor | Message lookup |
| **Requested** | The raw `getLanguage()` code, whatever it is | `Intl.Collator`, `Intl.NumberFormat` |

`Intl` knows hundreds of locales; this plugin will ship a handful of catalogs. Passing
the catalog locale to `Intl` throws away everything the platform knows for free.

The dividing line generalizes, and it is worth stating because the next `Intl` use will
have to answer it: **`Intl` used for grammar follows the catalog; `Intl` used to present
data follows the user.** A message's plural category and the list-joining in a translated
sentence are grammar — they must match the language the sentence is written in, or the
catalog is asked for a plural form it does not have. Collation and number formatting are
presentation of the user's own data, and follow the user. See
`Plurals and interpolation`, which owns the grammar half.

## Acceptance criteria

- Every `localeCompare` in `src/` passes a locale explicitly — the **requested** one, per
  the section above. A bare `localeCompare(b)` is a lint-visible mistake, the way
  `processFrontMatter` outside `storage/` already is.
- Counts and ratios shown to the user go through `Intl.NumberFormat` for the **requested**
  locale.
- Sorting affects **presentation only**. `order` is a fractional rank and
  `entryIndex` is the Bases result order; neither is touched by collation, and no write
  path may depend on a locale-sorted list. The state and tag vocabularies are sorted for
  the menu — what gets *written* is the value the user picked.
- Dates, if any are ever rendered, use `obsidian.moment`, which Obsidian has already
  configured, rather than a second date stack.
