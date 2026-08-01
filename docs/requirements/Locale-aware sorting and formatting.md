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

## Case folding is the same split again

`toLowerCase()` appears **41 times** in `src/`, and the locale question divides them the
way `text is not data` divides everything else in this feature — except that here the
*dangerous* direction is the sweep, not the omission.

**Eight sites are user-facing matching, and are wrong today.** They fold a needle and a
haystack to compare them, so they should use the **requested** locale:

| Site | Matches |
| --- | --- |
| `backlogView.ts:269,280` | Quick filter against note titles |
| `rows.ts:212-213` | The same match, to highlight it in the title |
| `prompts.ts:51,54` | Folder suggest |
| `prompts.ts:81-82` | Tag suggest |

`toLowerCase()` is locale-independent by specification, so in Turkish or Azerbaijani it
folds `I` to `i` when the language folds it to `ı`. A user types what their keyboard and
their language produce, and the filter silently fails to find a note that is plainly on
screen — the worst kind of bug, because nothing is broken enough to report.

**The other thirty-three must not be touched, and three of them would corrupt vaults.**
They are not matching user text; they are canonicalizing *identity*:

- `settings.ts:114` — `typeFolder.${typeName.toLowerCase()}`, which is a **persisted
  option key**. Under `toLocaleLowerCase('tr')` an `Issue` folder would key on
  `typefolder.ıssue`, so every Turkish user's type-folder configuration would silently
  reset, and a vault configured in one locale would read differently in another. This is
  precisely what `Persisted keys stay as written` exists to prevent.
- `noteFields.ts:75` — `tagKey`, which the file already describes as the one place "same
  tag" is decided.
- `itemTypes.ts:59-60,105-107`, `model.ts:562-563`, `writePlan.ts:135,154` — matching a
  `type:` value against the vocabulary. Locale-aware folding here means an Obsidian set to
  Turkish stops recognizing `Issue`.

So the rule is: **fold with the locale when comparing what the user typed against what
they can see; fold without it when deciding what something *is*.** A blanket sweep to
`toLocaleLowerCase` is not a partial fix, it is a data-corruption bug — which makes this
the one item in this feature where doing nothing is safer than doing it carelessly.

Two sites are neither. `keyboard.ts:32` folds `evt.key` to compare against `'z'`, and a
`KeyboardEvent.key` is a protocol value, not text. `create.ts:92` upper-cases the first
character of a sentence for display — which stops being right the moment that sentence
comes from a catalog, since the capitalized form belongs *in* the message and not every
script has case at all. That one belongs to `Every surface translated`.

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
- The **eight** matching sites fold with `toLocaleLowerCase(requested)`; the other
  thirty-three keep `toLowerCase()`. A check distinguishes them, because the two look
  identical and one of them is a vault-corruption bug — `typeFolderKey` alone would reset
  every Turkish user's type-folder configuration.
- The reverse is explicitly a failure: a PR that "fixes locale handling" by replacing every
  `toLowerCase()` has not met this criterion, it has broken `Persisted keys stay as
  written`. That is the one place in this feature where a careless fix is worse than no
  fix.
- Sorting affects **presentation only**. `order` is a fractional rank and
  `entryIndex` is the Bases result order; neither is touched by collation, and no write
  path may depend on a locale-sorted list. The state and tag vocabularies are sorted for
  the menu — what gets *written* is the value the user picked.
- Dates, if any are ever rendered, use `obsidian.moment`, which Obsidian has already
  configured, rather than a second date stack.
