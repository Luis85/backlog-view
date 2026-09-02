# Plan — Locale-aware sorting and formatting (PBI 90, Multilang)

Implements `docs/requirements/Locale-aware sorting and formatting.md`. One PR, five tasks,
no child-PBI decomposition.

## Context

`src/i18n/` is a leaf below every layer: `locale.ts` answers "which catalog" and "which
`Intl` locale" (`intlLocale`, already validated once through `Intl.getCanonicalLocales`);
`t.ts` holds `active` — the resolved catalog plus the `Intl.PluralRules`, `Intl.ListFormat`
and `Intl.NumberFormat` built once per `setLocale`. Grammar follows the CATALOG locale;
data presentation follows the USER's REQUESTED locale (`intlLocale(code)`).

This PBI is the presentation half: collation, case folding for matching, and bare counts.

## Measured on 74f849c — these numbers, not the PBI note's

Instrument: an AST walk over `src/**/*.ts` (TypeScript compiler API), counting
`CallExpression` whose callee is a `PropertyAccessExpression` named `toLowerCase` /
`toUpperCase` / `localeCompare` — call EXPRESSIONS, not lines.

Calibrated two ways before it was trusted: a `grep -o` over the same tree reports 120 / 3 /
7, and every one of the 9 extra hits was located and shown to be a mention inside a comment
(`projection.ts:315`, `viewState.ts:86`, `badges.ts:15` and `:70`, `typesSection.ts:58`,
`create.ts:125`, `en.ts:1373`, `noteFields.ts:141`, `scoringModel.ts:90`). The two
instruments therefore agree exactly on code.

| | Count | Note |
| --- | --- | --- |
| `toLowerCase()` | **113** | the PBI note says 118; the tree has changed |
| `toLocaleLowerCase()` | **0** | |
| `toUpperCase()` | **1** | `domain/estimationSettings.ts:40`, not `create.ts:92` |
| `localeCompare()` | **7** | all with NO locale argument |

The seven `localeCompare` sites: `ui/prompts.ts:173`, `view/estimation/renderTable.ts:290`,
`domain/vocabulary.ts:74` and `:90`, `domain/model.ts:266` (**two on one line** — title
then path tie-break), `domain/shelf.ts:44`. A line-based count reports six.

Bare counts drawn to screen without `t()` (so without `Intl.NumberFormat`), seven:
`view/render/shelf.ts:431`, `view/render/roadmap.ts:419`,
`view/render/shelfControls.ts:71`, `view/render/board.ts:434`,
`view/estimation/renderTable.ts:438`, `view/estimation/panel.ts:185` and `:263`.
(`String(bool)` in an `aria-*` attribute is not a count and is out of scope.)

## Global constraints

1. **A fold is MATCHING or IDENTITY, and the wrong call corrupts vaults.** Matching = a
   needle the user typed compared against a haystack they can read → locale-aware. Identity
   = a persisted key, a type name, a state value, a tag key, a protocol value, a dedupe key,
   a CSS class fragment → stays `toLowerCase()`, with a stated reason. **Anything you cannot
   classify with certainty is IDENTITY, and you say so.** `settings.ts`'s `wipLimit.${state}`
   / `columnPolicy.${state}` keys are the worked example: locale folding there silently
   resets every Turkish user's configuration.
2. **No new `src/` module.** The helpers go in `src/i18n/t.ts`, so `docs-check.mjs` rule 7
   needs no new specification. If a new module feels necessary, stop and say why.
3. **No behaviour change to `order`, `entryIndex`, or anything a write path reads.**
4. **Do not widen into PBI 80 (`Persisted keys stay as written`) or PBI 70 (`Type names are
   data`).** If a fold's classification depends on either, leave it identity and say so.
5. **`npm run check` must pass** (build, typecheck:test, lint, lint:md, coverage-thresholded
   tests, fallow, docs register). Coverage thresholds only ever go up — never down.
6. `src/i18n/t.ts` is 277 lines against the 400-line lint cap. If additions push it over,
   split by concern; never trim a comment to fit.
7. **An invariant asserted in a comment gets a test that fails without it, and the test is
   WATCHED failing** — revert the fix, run it, see red, restore. Report which checks were
   watched failing and what each covers.
8. Commit on branch `claude/locale-aware-sorting-90`. Never `git push` — the controller does.

---

## Task 1 — Classify all 113 folds, as data the suite reads

No behaviour change. This lands first and alone, because a wrong call here corrupts vaults.

**Write `test/i18n/foldSites.ts`**: the classification, as data. One entry per
`toLowerCase()` / `toLocaleLowerCase()` call expression in `src/**/*.ts`:

```ts
export interface FoldSite {
	file: string;          // repo-relative, POSIX separators
	text: string;          // the call expression's source text, whitespace-collapsed
	kind: 'identity' | 'matching';
	why: string;           // required for identity; what it decides
}
```

Keep the array sorted by `file` then `text`. Do NOT record line numbers: they are correct
until the next insertion above them (root `CLAUDE.md`, "address code by name, not by
position"), and Task 3 will move lines.

**Write `test/i18n/foldSites.test.ts`**, which AST-walks `src/**/*.ts` itself (the
TypeScript compiler API, matching the instrument above — `typescript` is already a
devDependency) and asserts:

- Every fold call found in `src/` has an entry in the table. **A new, unclassified fold
  fails.** The failure message names the file and the call text.
- Every table entry is still present in `src/`. A stale entry fails.
- Every `identity` entry is spelled `toLowerCase`, and every `matching` entry is spelled
  `toLocaleLowerCase`. **This is the check Task 5 asks for**: an identity fold moved to the
  locale-aware form fails without the table being edited too, and the table edit is the
  reviewable act. State that in the file's own comment.
- Every `identity` entry has a non-empty `why`.

Also assert the counts the table itself states, so the count in the register has a check
under it.

**Classification for this round: all 113 are `identity`.** Task 3 flips the matching ones.
Landing every site as identity first is deliberate — it makes Task 3's diff exactly the set
of sites that changed category, which is what gets reviewed.

Classifying 113 calls is the work. For each, read enough of the surrounding function to say
what the fold DECIDES, and write that in `why` in a few words (e.g. "dedupe key for the
state vocabulary", "CSS class fragment", "matches a type name against ALL_TYPES",
"KeyboardEvent.key is a protocol value"). Group identical reasons by wording, not by
inventing a category enum.

**Files:** `test/i18n/foldSites.ts`, `test/i18n/foldSites.test.ts`.

---

## Task 2 — `compareText`, `foldForMatch`, `formatNumber` in `t.ts`; lint bans `localeCompare`

**In `src/i18n/t.ts`**, beside `active`:

- `activate()` gains a `collator: new Intl.Collator(intlLocale(code))`, built ONCE per
  `setLocale` exactly as `number`, `plural` and `list` already are. This is the reason the
  helper exists rather than a locale-passing `localeCompare`: `localeCompare(b, locale)`
  constructs a fresh collator per comparison, which is n·log n `Intl` constructions inside
  a sort in a render path.
- `export function compareText(a: string, b: string): number` → `active.collator.compare(a, b)`.
- `export function foldForMatch(value: string): string` → `value.toLocaleLowerCase(active.numbers)`
  — the REQUESTED locale, from the same `intlLocale` answer everything else takes, never a
  second idea of what the locale is. (Store the requested tag on `active` if it is not
  already reachable; `active.number.resolvedOptions().locale` is a resolved tag and may
  differ from the requested one, so prefer keeping `intlLocale(code)` explicitly.)
- `export function formatNumber(value: number): string` → `active.number.format(value)` —
  the SAME formatter `t()` builds for a `{count}` parameter, not a second one.

Each gets a comment saying which locale it takes and why (presentation follows the USER;
grammar follows the catalog).

**In `eslint.config.mjs`**, a `no-restricted-syntax` entry in the same shape as
`WRITE_BOUNDARY`'s three arms, applying to all of `src/` except `src/i18n/t.ts`:

```js
{ selector: "MemberExpression[property.name='localeCompare']",
  message: 'Collate with compareText (src/i18n/t.ts), which uses one Intl.Collator built per setLocale in the requested locale.' }
```

Message names the fix, not the violation. This is stronger and simpler than "must have two
arguments": it cannot be satisfied by passing the wrong locale.

**Then take all seven call sites** to `compareText`: `ui/prompts.ts:173`,
`view/estimation/renderTable.ts:290`, `domain/vocabulary.ts:74` and `:90`,
`domain/model.ts:266` (both — title and the path tie-break), `domain/shelf.ts:44`.
`src/i18n/` is below every layer, so all four layers may import it.

`src/domain/CLAUDE.md` states the resource-roster sort's cost and that it follows the
USER's locale via `localeCompare`; update that sentence to name `compareText` and the
one-collator-per-`setLocale` reason.

**Check to watch failing:** a test that `compareText` collates by the requested locale and
not the host default — e.g. under a locale whose collation differs from English for a pair
you assert (Swedish `sv` sorts `ä` after `z`; German `de` does not). Assert the ORDER
changes with `setLocale`, and assert `activeLocale()`/the collator is not rebuilt per
comparison if you can do so cheaply; if you cannot check the once-per-`setLocale` claim from
a test, say so plainly rather than writing a comment that promises it.

**Files:** `src/i18n/t.ts`, `eslint.config.mjs`, the six source files above,
`src/domain/CLAUDE.md`, tests under `test/i18n/`.

---

## Task 3 — The matching folds go locale-aware

Re-read every entry Task 1 classified and flip to `matching` (and to `foldForMatch`) exactly
those that fold a needle the user TYPED against a haystack they can READ. Nothing else.

Candidates, to be confirmed by reading each function — this list is a starting point, not
the answer:

- `src/ui/prompts.ts` — `FolderSuggest.getSuggestions` (the query and `file.path`) and
  `KnownValueSuggest.getSuggestions` (the needle and each known value). Both filter a
  suggest list by what the user is typing.
- `src/domain/shelf.ts` — `searchShelf` (`search.trim()` and `card.item.title`). The shelf's
  own title search; the PBI note names it as the title-matching fold that remains.

Explicitly NOT matching, among others: `shelf.ts`'s `groupKey` (matches a type name against
`ALL_TYPES` — identity, PBI 70's territory), `prompts.ts`'s duplicate-warning comparison
(decides "is this the same known value" — identity), every `vocabulary.ts` dedupe key,
every `settings.ts` option key, `noteFields.ts`'s `tagKey`, `keyboard.ts`'s `evt.key`.

Update `test/i18n/foldSites.ts` in the same commit — its `kind` and the spelling in `src/`
must agree or Task 1's test fails, which is the point.

**Watch for fold-then-index.** `İ` changes LENGTH under case mapping (2 UTF-16 units → 3),
so an index into the folded string does not address the original. Every site above is a
boolean `includes`, which is safe. If you find any surviving matcher that folds and then
indexes back into the original, do NOT apply the boolean recipe to it — report it instead;
the PBI note has a whole section on why.

**Check to watch failing:** under `tr-TR`, a Turkish-folding match that plain `toLowerCase`
gets wrong — e.g. a folder or title containing `I`/`ı`/`İ` found by a query typed the way a
Turkish keyboard produces it. And the mirror: an identity fold asserted UNCHANGED under
`tr-TR` (a `wipLimit.${state}` key, a type-name match against `ALL_TYPES`), so the sweep
this PBI warns against fails a test.

**Files:** `src/ui/prompts.ts`, `src/domain/shelf.ts` (plus any other site the reading
confirms), `test/i18n/foldSites.ts`, tests.

---

## Task 4 — Bare counts go through `Intl.NumberFormat`

The seven sites listed under **Measured** take `formatNumber` from Task 2. They are numbers
shown to a person, drawn without `t()` at all, so `Intl.NumberFormat` never sees them —
which is why `.pbl-shelf-count` renders `1000` beside an accessible name that says `1,000`.

Before editing, re-derive the set rather than trusting the list: sweep `src/view/` for a
number reaching the DOM without `t()`. `String(bool)` in an `aria-*` attribute is not a
count. Report anything you find beyond the seven, and either fix it or say why not.

Do not introduce a second formatter and do not format a number that is then PARSED or
compared — `formatNumber` is for text on screen only.

**Check to watch failing:** a rendered count at a thousand-separator boundary, asserted in
two locales (the suite's `test/helpers/locale.ts` `num()` helper is how an expectation
avoids hard-coding English formatting — read it first). The shelf disclosure's span and its
accessible name must now agree.

**Files:** the seven view files, tests under `test/view/` and/or `test/i18n/`.

---

## Task 5 — Presentation-only invariant, tr-TR run, and the register

**a. Assert sorting is presentation only.** A test, not a comment: a locale-sorted list
(`collectObservedStates`, `collectObservedTags`, the shelf's sort, the resource roster)
changes ORDER under a different locale while `order`, `entryIndex` and every planned write
are byte-identical. State the rule in the test's own name. The state and tag vocabularies
are sorted for the menu — what gets WRITTEN is the value the user picked.

**b. `PBL_TEST_LOCALE=tr-TR npx vitest run`** at least once. Report what it found, whether
or not it was green. This is a local check, not a new CI leg — adding one is a separate
decision.

**c. `docs/requirements/Locale-aware sorting and formatting.md`** — narrow and correct it,
nothing more:

- The corrected counts (113 / 0 / 1 / 7), with the instrument and its calibration named.
- **Delete the `renderTitleText` criterion.** That function no longer exists — the quick
  filter went with `[[Remove the quick filter, now that Bases has its own search]]` on
  2026-08-17, and the note's own "Where it lives" already says the shelf's search is the
  title-matching fold that remains. Say in the note that it was deleted and why. Keep the
  "The two that could not take the same fix were deleted rather than fixed" section — its
  trap is in the shape, not the file.
- **Narrow the collation criterion** to: *no comparison collates in an unspecified locale,
  and none constructs a collator per comparison* — with the perf reason (a locale-passing
  `localeCompare` builds a fresh collator per comparison, n·log n of them inside a sort in a
  render path) and the lint ban as the check. Write the guarantee to the check.
- Tick the two already-met bullets: `Intl.getCanonicalLocales` validation (`locale.ts`,
  `canonical()`) and the dates bullet (vacuous — nothing renders a date through a date
  library, and `domain/timeline.ts`'s month names already go through `Intl` on the USER's
  locale; do NOT add a date stack).
- Replace the `8 + 38 + 1 = 47` arithmetic with what the fold classification now says, and
  point at `test/i18n/foldSites.ts` as where the next contributor finds it.
- Fix `create.ts:92` → `domain/estimationSettings.ts:40` for the single `toUpperCase`.
- Update **Where it lives** to what exists.
- **Status:** `Done` only if every remaining criterion is met. If one is not, leave it
  `Active`, say which, and why — the way `Tests do not read English` was left in PR #240.

**d. One Task note** under `docs/tasks/`, in the folder's existing shape: `type: Task`, a
`parent` link to the PBI, `order`, `status`, `priority`, `area`, `created: 2026-09-02`,
`closed`, a `source` line naming how the counts were measured, and a `files:` list. An
`## Evidence` section stating what was measured and what the checks cover.

**e. `CHANGELOG.md`** `[Unreleased]`, one sentence per change.

Run `npm run check` and report each of the seven steps.

**Files:** tests, `docs/requirements/Locale-aware sorting and formatting.md`,
`docs/tasks/<new note>.md`, `CHANGELOG.md`.
