---
type: PBI
parent: "[[Multilang]]"
order: 90
status: Open
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Locale-aware sorting and formatting

The places where the *locale* changes an ordering or a rendering even though no string is
being translated. Small, easy to miss, and nothing else in this feature will surface them.


**As** someone whose language sorts and folds letters differently, **I want** ordering,
matching and number formatting to follow my locale, **so that** a list reads in my
alphabet and the filter finds what is plainly on screen.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone whose locale is not the host's default |
| **Trigger** | Sorting a suggest list, filtering by title, or rendering a count |
| **Preconditions** | The locale layer exposes both the catalog locale and the requested one |
| **Guarantee** | Collation and folding are presentation only. No write path depends on a locale-sorted list, and no identity comparison changes with the locale. |

**Main flow**

1. The plugin resolves the requested locale and validates it once.
2. A comparison or a format asks for that locale explicitly.
3. Lists sort, titles match and numbers render the way the language expects.

**Extensions**

- **1a — the code is malformed.** `Intl` throws on `''` or `en_US`, so the requested locale
  is normalized to English when `getCanonicalLocales` rejects it — never merely because it
  is untranslated.
- **2a — the operation is grammar rather than data.** Plural categories and list joining
  follow the **catalog** locale; collation and number formatting follow the **requested**
  one.
- **2b — the comparison decides identity.** It keeps `toLowerCase()`. Thirty-eight calls
  canonicalize a type, a tag key or a persisted option key, and folding those with a locale
  would corrupt vaults.
- **3a — the match feeds a highlight.** Folding is not length-preserving, so an index from
  the folded string does not address the original. That is a live bug today and needs an
  index-preserving matcher rather than the boolean filter's recipe.

## Where they are

Four `localeCompare` calls, all currently locale-less:

| Site | Sorts |
| --- | --- |
| `ui/prompts.ts:58` | Folder paths in the folder suggest |
| `domain/model.ts:495` | `observedStates` — the state vocabulary offered in the menu |
| `domain/model.ts:512` | The tag vocabulary |
| `domain/shelf.ts:30` (`compareCards`) | Shelf cards within a type group, by title |

Called with no locale argument, `localeCompare` uses the *host's* default, which is the
operating system's language rather than Obsidian's. So a user running Obsidian in one
language on a system set to another already gets a collation neither of them chose — a
bug that exists today and that this PBI is the natural place to fix.

Formatting is the other half: `columns.ts:276` renders `${done}/${total}` and
`columns.ts:280` a bare descendant count. Both are numbers shown to a person.

## Case folding is the same split again

`toLowerCase()` appears **47 times** in `src/` — call expressions, not lines; an earlier
draft of this paragraph said 41, which was the line count and undercounted the eight lines
that fold twice. The locale question divides those 47 the way `text is not data` divides
everything else in this feature, except that here the *dangerous* direction is the sweep
rather than the omission.

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

### Two of those eight cannot take the same fix, and are already wrong

`rows.ts:212-213` is not a boolean match. It folds the title, finds an **index**, and then
slices the **original**:

```ts
const idx = needle.length > 0 ? text.toLowerCase().indexOf(needle) : -1;
titleEl.appendText(text.substring(0, idx));
titleEl.createSpan({ cls: 'pbl-match', text: text.substring(idx, idx + needle.length) });
```

Case folding is not length-preserving, so that index does not address the same character
in both strings. `İx` folds to `i̇x` — 2 UTF-16 units becoming 3, because the dot becomes a
combining mark — and a search for `x` reports index 2 while `x` sits at index 1 in the
title. The highlight lands on the wrong characters, or on none.

**This is a defect in shipped code, not one this PBI would introduce.** It reproduces
today with plain `toLowerCase()`; locale folding only widens the set of titles that hit
it. Turkish adds more, and so does any language whose case mapping expands.

So these two sites need an **index-preserving matcher**, not the recipe the boolean filter
uses: fold both sides while recording the offset mapping back to the original, or match on
the original with a case-insensitive comparison that never re-indexes. Applying
`toLocaleLowerCase` here and calling it done would leave the bug in place and add locales
to it.

**Thirty-eight canonicalize identity and must not be touched — three would corrupt
vaults.** They are not matching user text; they are deciding what something *is*:

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

One is neither: `keyboard.ts:32` folds `evt.key` to compare against `'z'`, and a
`KeyboardEvent.key` is a protocol value rather than text. **8 + 38 + 1 = 47**, which is the
arithmetic the check has to reproduce.

Separately there is a single `toUpperCase()` — `create.ts:92`, upper-casing the first
character of a sentence for display, which stops being right the moment that sentence comes
from a catalog. The capitalized form belongs *in* the message, and not every script has
case at all. That one belongs to `Every surface translated`.

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

## The requested locale has to be validated before `Intl` sees it

"Pass the requested locale" is right and incomplete: `Intl` throws on a **malformed** tag,
and the resolution rules deliberately tolerate one. `Locale resolution and fallback`
requires handling "an empty or unrecognized code", and empty is exactly what `Intl` will
not take:

| Code | `Intl.Collator` / `toLocaleLowerCase` | `Intl.getCanonicalLocales` |
| --- | --- | --- |
| `en`, `fr`, `pt-BR` | ok | valid |
| `xx` — structurally valid, no such language | **ok** | valid |
| `''`, `en_US`, `@@` | **RangeError** | invalid |

The distinction that matters is not *supported* but *well-formed*. `xx` is a language
`Intl` has no data for and it still works, falling back internally — which is the whole
reason this PBI keeps the requested locale rather than the catalog one. But an empty
string or an underscore instead of a hyphen throws, and it throws at render time, in the
tree, on every row.

So the requested locale is **validated once**, next to where it is resolved:
`Intl.getCanonicalLocales(code)` in a `try`, falling back to `'en'` on `RangeError`. That
preserves every valid-but-untranslated locale — which is the point — while making the
formatting path total. Validation belongs with resolution rather than at each call site,
or the guard has to be remembered eleven times.

## Acceptance criteria

- The requested locale is **validated once** with `Intl.getCanonicalLocales`, falling back
  to `'en'` only when the code is malformed — never when it is merely untranslated. A
  `RangeError` from `Intl.Collator`, `Intl.NumberFormat` or `toLocaleLowerCase` at render
  time means this criterion was not met.
- Every `localeCompare` in `src/` passes a locale explicitly — the **requested** one, per
  the section above. A bare `localeCompare(b)` is a lint-visible mistake, the way
  `processFrontMatter` outside `storage/` already is.
- Counts and ratios shown to the user go through `Intl.NumberFormat` for the **requested**
  locale.
- `renderTitleText` highlights the **right characters** for a title whose case mapping
  changes length — `İx` is the worked example, and it is wrong today. Fold-then-index into
  the original is the bug; an offset mapping or an index-free matcher is the fix, and
  reusing the boolean filter's recipe is not.
- The **eight** matching calls fold with `toLocaleLowerCase(requested)`; the other
  **thirty-nine** keep `toLowerCase()` — thirty-eight identity comparisons plus the
  protocol one. A check distinguishes them, because the two look identical and one of them
  is a vault-corruption bug: `typeFolderKey` alone would reset every Turkish user's
  type-folder configuration.
- The classification covers **all 47 calls**, counted as call expressions rather than
  lines. Eight lines fold twice, so a line-based count reports 41 and leaves six
  identity-folding calls outside the protected set — which is how this note first stated
  it.
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

## Where it lives

**Nothing yet — this note is design.** `src/domain/model.ts` and `src/domain/shelf.ts`
sort the state and tag vocabularies and the shelf's cards · `src/ui/prompts.ts` sorts and
filters the folder and tag suggests · `src/view/backlogView.ts` holds the quick filter's
match ·
`src/view/render/columns.ts` renders the counts · `src/domain/settings.ts`,
`src/domain/itemTypes.ts`, `src/domain/noteFields.ts` and `src/domain/writePlan.ts` hold
the identity folds that must not change.
Tests: `test/domain/model.test.ts`, `test/domain/shelf.test.ts`,
`test/domain/noteFields.test.ts`. The quick filter's own case fold was a fifth reader of this
rule and went with the filter on 2026-08-17
([[Remove the quick filter, now that Bases has its own search]]); the shelf's search is the
title-matching fold that remains.
