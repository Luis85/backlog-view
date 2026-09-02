---
type: Task
order: 10
parent: "[[Locale-aware sorting and formatting]]"
status: Done
priority: P2
area: i18n
closed: 2026-09-02
created: 2026-09-02
source: an AST walk over src/**/*.ts with the TypeScript compiler API, calibrated against grep -o on the same tree; and a PBL_TEST_LOCALE=tr-TR run of the whole suite
files:
  - src/i18n/t.ts
  - src/i18n/locale.ts
  - eslint.config.mjs
  - test/i18n/foldSites.ts
  - test/i18n/foldSites.test.ts
  - test/i18n/localeFolds.test.ts
  - test/i18n/localeSorting.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Collate, fold and format in the reader's own locale

## Evidence

**What was measured, and with what.** A walk over `src/**/*.ts` with the TypeScript
compiler API, on 2026-09-02, counting CALL EXPRESSIONS rather than lines or matches:

| Instrument | `toLowerCase` | `localeCompare` | `toUpperCase` | `compareText` |
| --- | --- | --- | --- | --- |
| `grep -o` | 113 | 3 | 3 | — |
| AST walk | **105** in 25 files | **0** | **1** | **7** in 5 files |

Every difference between the two rows is a comment, and that is the whole reason both rows
are here: three of the figures this PBI's note has carried over its life — 41, 47, 118 —
were an instrument reading something other than what its sentence claimed. 41 counted
LINES and lost every line that folds twice. 118 was a call count taken before a year of
features. The three `localeCompare` grep hits are prose in `src/i18n/t.ts` explaining why
the method is banned, which is a comment vouching for its own absence.

**What the Turkish run found.** `PBL_TEST_LOCALE=tr-TR npx vitest run` was run against the
whole suite. It found one real defect in existing code, in the round that wired the
matching folds: `test/domain/shelf.test.ts` asserted that `searchShelf('LOGIN')` finds
`Login screen`, which had quietly become an assertion about ENGLISH case folding the
moment the search started following the reader's locale. That is the `num()` trap wearing a
letter instead of a digit — an expectation that names the source language while claiming to
be about behaviour.

## Why it matters

A fold and a collation look identical in the source and mean opposite things. One decides
what the reader can find; the other decides what something IS — a type name, a state, a
persisted `.base` option key. Sweeping the second to a locale-aware fold is the one careless
change in this feature that is worse than doing nothing: under `toLocaleLowerCase('tr')` a
state called `In progress` keys on `wiplimit.ın progress`, so every Turkish user's WIP
limits silently reset and a vault configured in one locale reads differently in another.

## Approach

Ordered, because each step is what makes the next one reviewable:

1. **Classify before changing anything.** `test/i18n/foldSites.ts` is one row per fold call,
   all of them `identity` in its first commit, with a sentence on each saying what it
   decides. The table was checked against the tree before a single fold moved.
2. **One requested-locale answer**, taken once per `setLocale` and shared:
   `compareText`, `foldForMatch` and `formatNumber` in `src/i18n/t.ts`, all off the single
   `intlLocale(code)` that `src/i18n/locale.ts` validates.
3. **Ban the method rather than check its arguments.** `no-restricted-properties` over
   `src/**/*.ts` refuses `localeCompare`, and the seven calls moved to `compareText`.
4. **Flip the matching folds**, so the eight rows that changed category changed both `kind`
   and `text` in one diff the table refuses to let drift.
5. **Route the counts**, then assert the invariant the whole note rests on.

## Acceptance criteria

- Every fold in `src/` is classified, and the classification is checked against the tree in
  both directions — a new fold with no row fails, a row `src/` no longer holds fails.
- No comparison in `src/` collates in an unspecified locale, and none constructs a collator
  per comparison.
- A locale-sorted list changes ORDER between two locales while `order`, `entryIndex` and
  every planned write stay byte-identical.

## Risks

The instrument is the risk, and it has already cost this note three wrong numbers. The
fold walk trusts the NAME `foldForMatch`: a rename, a second matching helper, or
`known.map(foldForMatch)` passed as a value is invisible to it. **No lint rule was added
for that, and the judgement is recorded rather than deferred silently.** A guard would have
to be a `no-restricted-syntax` selector, and `src/` is carved into seventeen overlapping
regions where a second block matching a file OVERRIDES the rule rather than merging with
it — so the guard costs an edit per region and would still not see a helper with a
different name, which is the shape that actually worries. The honest sentence in
`foldSites.test.ts`'s header, naming each spelling the walk cannot see, is the answer here.

## Outcome

`compareText`, `foldForMatch` and `formatNumber` ship; 7 collations, 8 matching folds and
14 counts follow the requested locale; 105 identity folds do not, and are enumerated with
what each one decides. Three things this round found and deliberately did not fix, recorded
here so they are visible rather than absent:

- **`src/view/render/toolbarBusy.ts` draws an untranslated `" of "`.** Both numbers around
  it go through `formatNumber`; the word between them is a template whose first quasi is
  lowercase, which is the `UI_TEXT_LITERAL` blind spot the root guide names. It belongs to
  `Every surface translated`, and is recorded in that note's PBI sibling — the
  `toUpperCase` paragraph of [[Locale-aware sorting and formatting]] — and in
  [[Every surface translated]]'s own classification, which is where that note's owner
  reads.
- **A catalog-locale fold does not exist, and two sites want one.**
  `src/domain/scoringModel.ts` and `src/view/childrenList.ts` lower a user-supplied label
  or a type name for the MIDDLE of a translated sentence, which is grammar and so follows
  the CATALOG locale — not the requested one `foldForMatch` takes. Both sit as `identity`
  with that reason on the row. Decided out of the split rather than answered; building it
  needs its own note first.
- **Three count classes have no thousand-boundary check.** `.pbl-shelf-count` and
  `.pbl-card-kids-count` have one each; `.pbl-board-col-limit`, `.pbl-bucket-count` and
  `.pbl-shelf-group-count` are the same class of bug and have none. One check per class is
  the rule, so this is a gap rather than a policy.

What the round did NOT anticipate: closing the note out found an unmet criterion nobody had
written down. `src/domain/timeline.ts` draws the roadmap's dated-axis header from a
hard-coded `MONTH_LABELS` array, so every reader sees `Jan`, `Feb` whatever their locale.
The root `CLAUDE.md` already assigns month names to this PBI and describes them as going
"through `Intl`" on the USER's locale — a sentence that was a classification of where the
work belongs, read for four days as a statement that it was done. [[Locale-aware sorting and formatting]]
stays `Active` because of it.
