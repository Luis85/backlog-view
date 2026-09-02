---
type: PBI
parent: "[[Multilang]]"
order: 90
status: Active
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
- **2b — the comparison decides identity.** It keeps `toLowerCase()`. Most calls
  canonicalize a type, a tag key or a persisted option key, and folding those with a locale
  would corrupt vaults.
- **3a — the match feeds a highlight.** Folding is not length-preserving, so an index from
  the folded string does not address the original. No highlighter is in the code today, and
  the one that was is why this extension exists: it needs an index-preserving matcher rather
  than a boolean match's recipe.

## Where they are

**Nothing in `src/` collates any more, and the fix is the shape rather than the zero.**
This note found four `localeCompare` calls; by the time the work ran there were seven, the
three extra having arrived with the estimation table, the resource roster and the shelf's
own sort. All seven are `compareText` now — five files, one `Intl.Collator` built per
`setLocale` in the REQUESTED locale — and `eslint.config.mjs` bans the method in `src/`,
so the zero holds for code nobody has written yet rather than for the code that was
measured.

Called with no locale argument, `localeCompare` used the *host's* default, which is the
operating system's language rather than Obsidian's. So a user running Obsidian in one
language on a system set to another got a collation neither of them chose — the bug this
note was written about, and the reason the ban is on the METHOD rather than on its
argument count.

Formatting was the other half and landed in the same round: 14 counts and ratios — the
toolbar's advisories and busy count, the tree's rollups and descendant counts, the board's
column counts and WIP limits, the roadmap's bucket, shelf and group counts, and the
estimation table's own cells — go through `formatNumber`, which is the SAME
`Intl.NumberFormat` `t()` gives a `{count}` parameter. A count outside a sentence and one
inside it can no longer disagree.

**One of those bare counts disagreed with a formatted one beside it, and that was this
PBI's boundary made visible rather than a new defect.** The shelf's disclosure renders its
count twice: `.pbl-shelf-count` put `String(shelf.length)` on screen, while the same
number went through `t('fold.expandShelf')` for the accessible name and was formatted by
`Intl.NumberFormat` in the USER's locale. Below a thousand they agreed; at 1000 the span
said `1000` and a screen reader heard `1,000`. Fixed with the other 13.

`Plurals and interpolation` drew that line on purpose — a number inside a sentence is
grammar and was in scope, a bare count outside one is data presentation and is this
note's — so the fix belonged here with the other counts and not beside the fold label that
exposed it. Found by review on PR #167.

**Checked by** `test/view/shelfCount.test.ts` — "and in German, where the same count groups with a dot instead"

## Case folding is the same split again

**The counts, and the instrument that produced them.** On 2026-09-02, over `src/**/*.ts`:
**113 / 0 / 1 / 7** — `grep -o 'toLowerCase('` returns 113, no `localeCompare` call
expression survives, one `toUpperCase()` call does, and seven `compareText` calls in five
files are where the collation went.

Each of those needs its calibration said out loud, because three of this note's earlier
figures were an instrument reading something other than what its sentence claimed:

- **113 is the grep, not the code.** A TypeScript-compiler walk over the same tree finds
  **105** `toLowerCase` CALL EXPRESSIONS in 25 files; the eight extras are all inside
  comments, and a comment is not a call. Every number this note has carried — 41 (lines,
  undercounting every line that folds twice), 47 (calls, a year of features ago), 118, 119
  (which swept `src/domain/CLAUDE.md` in with the code) — came from an instrument someone
  trusted without calibrating it first. **Recount before planning against any of them.**
- **0 is a walk too, and a lint rule behind it.** `grep localeCompare` returns three hits
  in `src/`, all of them prose in `src/i18n/t.ts` explaining why the method is banned.
- **1 is `domain/estimationSettings.ts:40`** — see the `toUpperCase` paragraph below. Grep
  returns three there as well, the other two being comments.

The whole classification — every fold in `src/`, with what each one decides — is
`test/i18n/foldSites.ts`, and that is where the next contributor should read it rather than
here: **114 calls in 27 files, 105 identity and 9 matching**, checked against the tree in
both directions, so a new fold with no row fails and a row `src/` no longer holds fails
too. The nine matching calls are eight `foldForMatch(x)` at four sites — the shelf's title
search, the folder suggest, the known-value suggest and the new-note duplicate warning,
each folding a needle and a haystack — plus the one `toLocaleLowerCase` that is
`foldForMatch`'s own body.

**Checked by** `test/i18n/foldSites.test.ts` — "spells identity folds toLowerCase and matching folds toLocaleLowerCase or foldForMatch"

**Four sites are user-facing matching, and were wrong when this note was written.** Two of
them are the ones it could name at the time:

| Site | Matches |
| --- | --- |
| `prompts.ts` (`folderQuery`) | Folder suggest |
| `prompts.ts` (`tagQuery`) | Tag suggest |

**It was eight until 2026-08-17**, and the other four went with the quick filter
([[Remove the quick filter, now that Bases has its own search]]) rather than being fixed:
two in `backlogView.ts` matching note titles, two in `rows.ts` highlighting the match. The
search those served is Bases' own now, so whether it folds for a Turkish reader is Bases'
question and not this plugin's — a removal is a legitimate way for a site on this list to
leave it, but it is not a fix, and nothing here can speak for the search that replaced it.

`toLowerCase()` is locale-independent by specification, so in Turkish or Azerbaijani it
folds `I` to `i` when the language folds it to `ı`. A user types what their keyboard and
their language produce, and the filter silently fails to find a note that is plainly on
screen — the worst kind of bug, because nothing is broken enough to report.

### The two that could not take the same fix were deleted rather than fixed

**This section describes code that is gone**, and it is kept because the trap is in the
shape rather than in the file: the moment anything here matches user text and then
HIGHLIGHTS it, this is the bug it will have. The highlight went with the quick filter on
2026-08-17, so a defect this register had tracked since the note was written left the
codebase without anyone fixing it — which is a real outcome and not a fix, and is the
reason to read the rest of this section before adding a highlighter back.

`rows.ts` was not a boolean match. It folded the title, found an **index**, and then
sliced the **original**:

```ts
const idx = needle.length > 0 ? text.toLowerCase().indexOf(needle) : -1;
titleEl.appendText(text.substring(0, idx));
titleEl.createSpan({ cls: 'pbl-match', text: text.substring(idx, idx + needle.length) });
```

Case folding is not length-preserving, so that index does not address the same character
in both strings. `İx` folds to `i̇x` — 2 UTF-16 units becoming 3, because the dot becomes a
combining mark — and a search for `x` reports index 2 while `x` sits at index 1 in the
title. The highlight lands on the wrong characters, or on none.

**It was a defect in shipped code, not one this PBI would have introduced.** It
reproduced with plain `toLowerCase()`; locale folding only widened the set of titles that
hit it. Turkish added more, and so did any language whose case mapping expands.

So a highlighter needs an **index-preserving matcher**, not the recipe a boolean match
uses: fold both sides while recording the offset mapping back to the original, or match on
the original with a case-insensitive comparison that never re-indexes. Applying
`toLocaleLowerCase` there and calling it done would have left the bug in place and added
locales to it.

**The rest canonicalize identity and must not be touched — three would corrupt vaults.**
They are not matching user text; they are deciding what something *is*. That set was
counted at thirty-eight when this note was written and has NOT been recounted: only the
user-facing four above were re-measured on 2026-08-17, so treat the list below as the shape
to check for rather than as a census.

**The hazard outlived the sites that first showed it**, which is the reason to check the
shape and not the names. Every site this note originally named as a persisted key is gone —
`typeFolderKey` no longer exists in any form — and the category is as dangerous as ever,
because two NEW keys arrived in it that nobody wrote this warning for:

- `settings.ts` — `wipLimitKey` and `columnPolicyKey`, which build `wipLimit.${state}` and
  `columnPolicy.${state}` from a folded **state name**, so both are **persisted option keys
  keyed on user data**. Under `toLocaleLowerCase('tr')` a state called `In progress` keys
  on `wiplimit.ın progress`, so every Turkish user's WIP limits and column policy would
  silently reset, and a vault configured in one locale would read differently in another.
  This is precisely what `Persisted keys stay as written` exists to prevent.
- `noteFields.ts` — `tagKey`, which the file already describes as the one place "same tag"
  is decided. Unchanged and still folding.
- `itemTypes.ts`, `model.ts`, `vocabulary.ts` — matching a `type:` value against the
  vocabulary. Locale-aware folding here means an Obsidian set to Turkish stops recognizing
  `Issue`. `writePlan.ts` was on this list and folds nowhere now.

So the rule is: **fold with the locale when comparing what the user typed against what
they can see; fold without it when deciding what something *is*.** A blanket sweep to
`toLocaleLowerCase` is not a partial fix, it is a data-corruption bug — which makes this
the one item in this feature where doing nothing is safer than doing it carelessly.

One is neither: `keyboard.ts:32` folds `evt.key` to compare against `'z'`, and a
`KeyboardEvent.key` is a protocol value rather than text.

**`8 + 38 + 1 = 47` was the arithmetic this note asked the check to reproduce, and the
check reproduces something better than an equation.** `test/i18n/foldSites.ts` is a row per
call — file, call text, kind, and for every identity fold a sentence saying what it
decides — so the split is enumerated rather than counted, and a category flip shows up as a
diff of exactly the rows that changed. The protocol fold is one of those rows and needs no
term of its own. What the arithmetic is today, for anyone who wants a number: 114 rows, 105
identity, 9 matching.

**Two folds were decided OUT of the split rather than answered**, and they are recorded
here so nobody reads the table as covering them: `domain/scoringModel.ts` and
`view/childrenList.ts` lower a user-supplied label or a type name for the MIDDLE of a
translated sentence. That is grammar, so it would follow the **catalog** locale — and no
catalog-locale fold exists; `foldForMatch` takes the requested one. Both sit as `identity`
with that reason written on the row, which is the honest place for a call nobody has made.
Building the catalog-locale fold needs its own note before it needs any code.

Separately there is a single `toUpperCase()` — `domain/estimationSettings.ts:40`,
upper-casing the first character of a field name for display, which stops being right the
moment that name comes from a catalog. The capitalized form belongs *in* the message, and
not every script has case at all. That one belongs to `Every surface translated`, which
also owns the one untranslated sentence fragment this round found and left alone:
`view/render/toolbarBusy.ts` draws `` ` of ${total}` `` beside the busy count — both
numbers go through `formatNumber`, the word between them does not go through the catalog,
and a template whose first quasi is lowercase is the `UI_TEXT_LITERAL` blind spot the root
guide names.

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

- **Met.** The requested locale is **validated once** with `Intl.getCanonicalLocales`,
  falling back to `'en'` only when the code is malformed — never when it is merely
  untranslated. `canonical()` in `src/i18n/locale.ts` is the one validator, and both
  answers a code produces — which catalog it reads and which locale `Intl` gets — come
  through it, so the two cannot disagree about a tag. A `RangeError` from `Intl.Collator`,
  `Intl.NumberFormat` or `toLocaleLowerCase` at render time means this criterion was not
  met.

  **Checked by** `test/i18n/locale.test.ts` — "answers English for a tag Intl would throw on, rather than propagating it"
- **Met, and narrowed to what the check reaches.** **No comparison in `src/` collates in an
  unspecified locale, and none constructs a collator per comparison.** Two failures, not
  one: a bare `localeCompare(b)` takes the HOST's default — the operating system's language
  rather than Obsidian's — and `localeCompare(b, locale)` is wrong in the other direction,
  since it builds a fresh `Intl.Collator` for every comparison, n·log n of them inside a
  sort in a render path. So the ban is on the METHOD, which is why it is stated this way
  rather than as "passes a locale explicitly": a rule about argument count is satisfied by
  passing the wrong locale, and a rule about the argument's VALUE is not a rule lint can
  read. Everything collates through `compareText`, one `Intl.Collator` built per
  `setLocale`.

  What the check sees, said exactly: `no-restricted-properties` refuses the literal
  property spelling anywhere under `src/**/*.ts`, member access and destructuring included.
  A computed non-literal key — `const m = 'localeCompare'; s[m](b)` — is silent to it, and
  nothing in the tree spells one.

  **Checked by** `eslint.config.mjs` — "Collate with compareText (src/i18n/t.ts), which uses one Intl.Collator built per setLocale in the requested locale."
- **Met.** Counts and ratios shown to the user go through `Intl.NumberFormat` for the
  **requested** locale — 14 of them, through the `formatNumber` that shares `t()`'s own
  formatter, so a bare count and the same number inside a sentence cannot disagree at a
  grouping boundary. Two of the classes that render one carry a thousand-boundary check;
  three do not, and that gap is recorded in this round's Task note rather than papered over
  here.

  **Checked by** `test/view/cardChildren.test.ts` — "agrees with its own accessible name at a thousand children"
- **Deleted 2026-09-02, not met and not dropped quietly.** This bullet asked
  `renderTitleText` to highlight the right characters for a title whose case mapping changes
  length. **That function no longer exists**: the quick filter went with
  [[Remove the quick filter, now that Bases has its own search]] on 2026-08-17 and took the
  only highlighter in the codebase with it, so the criterion had nothing left to be true or
  false about. The trap it existed for is kept in **The two that could not take the same fix
  were deleted rather than fixed** above, where it is stated as a shape rather than as a
  file — the moment anything here matches user text and then highlights it, this is the bug
  it will have, and extension 3a is what it departs from.
- **Met, in a stronger form than this bullet asked for.** It asked for eight matching calls
  and thirty-nine identity ones and named the split as arithmetic. What exists is the
  enumeration: `test/i18n/foldSites.ts` carries one row per call — 114 rows, 105 identity
  and 9 matching — with a sentence on every identity row saying what it decides, and the
  suite holds the table against the tree in both directions. A new fold with no row fails,
  a row `src/` no longer holds fails, and an `identity` row spelled locale-aware fails. The
  numbers moved (47 was a year of features ago) and the guarantee did not, which is the
  reason the check is a table rather than an equation.
- **Met.** The reverse is explicitly a failure: a PR that "fixes locale handling" by
  replacing every `toLowerCase()` has not met this criterion, it has broken
  `Persisted keys stay as written`. Two checks stand under that, and they cover different
  things. `test/i18n/localeFolds.test.ts` drives four vault-facing identity keys — both
  workflow option keys, the state colour and the per-type folder — under `setLocale('tr')`
  and asserts they do not move, so a sweep to `toLocaleLowerCase(requested)` or to
  `foldForMatch` fails on behaviour. It stays GREEN against a sweep to a **bare**
  `.toLocaleLowerCase()`, which takes the host's default locale — `en` under vitest — and
  only the table's spelling check sees that shape, by its letters. `view/viewState.ts`'s
  column fold key is left to the spelling check alone on purpose: it is device-local view
  state rather than a vault value, so a locale-dependent fold there re-opens a folded column
  instead of resetting a configuration.

  **Checked by** `test/i18n/localeFolds.test.ts` — "keeps a persisted option key spelled the way every other locale spells it"
- **Met.** Sorting affects **presentation only**. `order` is a fractional rank and
  `entryIndex` is the Bases result order; neither is touched by collation, and no write path
  depends on a locale-sorted list. The state and tag vocabularies are sorted for the menu —
  what gets *written* is the value the user picked. Asserted rather than asserted-about:
  four lists are asked for in Swedish and in English, which disagree about where `Ö` sorts
  and about nothing else, and the two answers must DIFFER — while the ranks, the result
  positions and the planned writes beside them must be the same bytes.

  **Checked by** `test/i18n/localeSorting.test.ts` — "leaves every rank and every Bases result position byte-identical"
- **Met, vacuously, and deliberately left that way.** Dates, if any are ever rendered, use
  `obsidian.moment`, which Obsidian has already configured, rather than a second date stack.
  Nothing in `src/` renders a date through any date library: `domain/timeline.ts` does its
  own civil-date arithmetic on year/month/day triples and `formatCivil` writes `2026-08-01`,
  which is the register's own stable format rather than a localized one. No date stack was
  added to meet this, and none should be.
- **NOT met — the one criterion left open, and why this note is still `Active`.** The
  roadmap's dated axis draws its header from `MONTH_LABELS` in `src/domain/timeline.ts`, a
  hard-coded `['Jan', 'Feb', …]` array. Every reader sees English month names whatever their
  locale, which is exactly the class of defect this note exists for — a rendering the locale
  changes even though no string is being translated. The root `CLAUDE.md` already assigns it
  here, calling it "a formatting question that follows the USER's locale through `Intl`", and
  the fix is `Intl.DateTimeFormat` on the requested locale beside `compareText` and
  `formatNumber` rather than a catalog key per month: a month name is data presentation, and
  a twelve-key catalog list would make it grammar and freeze it at the shipped catalogs.
  Found while closing this note out, by reading the guide's own classification against the
  code rather than trusting it.

## Where it lives

`src/i18n/t.ts` holds all three presentation answers — `compareText` (one `Intl.Collator`
per `setLocale`), `foldForMatch` (the one fold in `src/` whose job is matching) and
`formatNumber` (the same formatter `t()` gives a `{count}`) — each built from the ONE
requested-locale answer `src/i18n/locale.ts` validates with `canonical()`. `eslint.config.mjs`
is the other half of the collation guarantee.

The collation sites: `src/domain/vocabulary.ts` sorts the state and tag vocabularies,
`src/domain/model.ts` the resource roster, `src/domain/shelf.ts` the shelf's cards,
`src/ui/prompts.ts` the folder suggest, `src/view/estimation/renderTable.ts` its own
columns. The matching sites are `src/domain/shelf.ts`'s title search and `src/ui/prompts.ts`'s
two suggests and duplicate warning. `src/view/render/columns.ts` is one of the count
renderers. The identity folds that must not change are everywhere — `src/domain/settings.ts`,
`src/domain/itemTypes.ts`, `src/domain/typeVocabulary.ts`, `src/domain/stateColors.ts`,
`src/domain/noteFields.ts`, `src/domain/writePlan.ts` and `src/view/viewState.ts` among
them — and `test/i18n/foldSites.ts` is the list rather than this paragraph.
`src/domain/timeline.ts` holds the month names this note still owes.

Tests: `test/i18n/foldSites.test.ts` (the classification against the tree),
`test/i18n/localeFolds.test.ts` (what each half DOES in Turkish),
`test/i18n/localeSorting.test.ts` (collation is presentation only),
`test/i18n/locale.test.ts` (validation and the two-locale split), plus
`test/domain/model.test.ts`, `test/domain/shelf.test.ts` and
`test/domain/noteFields.test.ts`.

`src/view/backlogView.ts` held the quick filter's own case fold, a fifth reader of this rule,
and it went with the filter on 2026-08-17
([[Remove the quick filter, now that Bases has its own search]]); the shelf's search is the
title-matching fold that remains.
