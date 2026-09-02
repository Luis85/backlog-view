---
type: Task
order: 400
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: testing
created: 2026-09-02
closed: 2026-09-02
source: "[[Read the vocabulary instead of reciting it]], the two remaining recited copies"
files:
  - src/domain/typeVocabulary.ts
  - src/domain/viewOptions.ts
  - src/domain/settingsResolve.ts
  - test/helpers/view.ts
  - test/helpers/viewOptionFixtures.test.ts
  - test/view/creation.test.ts
  - test/view/contextRowWrites.test.ts
  - docs/adrs/0013-fix-the-type-vocabulary-at-six-names.md
started: 2026-09-02
finished: 2026-09-02
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Derive the type folders the fixtures clear

## Evidence

[[Read the vocabulary instead of reciting it]] named three recited copies of the type
vocabulary. Its steps 1 and 2 had already landed in `test/docs/surfaces.test.ts`, which
loops `ALL_TYPES` and asserts the count. The two it named in `test/view/` had not:

```ts
const NO_TYPE_FOLDERS: Record<string, string> = {
	homeFolder: '',
	...Object.fromEntries(['epic', 'feature', 'pbi', 'task', 'issue', 'bug'].map((t) => [`typeFolder.${t}`, ''])),
};
```

Identical in `test/view/creation.test.ts` and `test/view/contextRowWrites.test.ts`,
comment included: *"Clear every configured folder, so folder INFERENCE is what runs. Both
layers have to go."* Six names. `ALL_TYPES` holds fourteen, and `FILED_TYPES` — the list
the option schema actually generates a `typeFolder.*` box from — holds thirteen. **Seven
types kept their shipped folder inside a fixture whose comment promised none of them had
one**, which is [[A comment that states a rule is not a check]] wearing the shape this
note's parent is filed about.

Not hypothetical. A throwaway jsdom probe, creating an `Idea` under an `Epic` with that
fixture applied, read the creation prompt's own detail line:

```text
Under "Epic A" · in folder "ideas"
```

`ideas` is the SHIPPED folder for the type, resolved from a `typeFolder.idea` the fixture
never cleared — not the inferred `Backlog` the parent sits in. Any creation test written
for one of the seven would have measured the type folder while reading as a test of
inference, and stayed green.

## The instrument

A TypeScript AST walk over all 511 `.ts` files in `src/`, `test/` and `scripts/`, flagging
every array literal of three or more elements whose members are ALL vocabulary names, and
every object literal keyed the same way. Not a grep: the vocabulary's two multi-word names
(`Test suite`, `Test case`) and the lowercase/capitalised split make a pattern over source
exactly the instrument this register keeps catching itself trusting.

**25 hits — that is the denominator.** Classified by hand, because the AST can see the
shape and not the intent:

| Class | Count | Verdict |
| --- | --- | --- |
| Fixtures that recite where they mean ALL | 2 | **Fixed** — the two above |
| Assertions ON the vocabulary (`ALL_TYPES`, `LEVELS`, `MARKER_TYPES` compared to a literal) | 3 | Deliberately literal. A derived expectation here would compare the code to itself |
| Assertions on an offering surface's exact list (Set type, the catalog, `childTypeChoices`) | 6 | Deliberately literal, and LOUD: a name joining the vocabulary appears in these menus and fails them |
| Fixture data — three or four notes that happen to be typed | 8 | Not about the vocabulary at all |
| The vocabulary's own source, the badge table, the manual's per-type prose | 4 | `src/`. The two tables are already gated by an `ALL_TYPES` loop (`rendering.test.ts`, `manualTypes.test.ts`) |
| Loops over a hand-typed marker list (`liveTypeKeys.test.ts`) | 2 | Left. `settings.test.ts` asserts `MARKER_TYPES` against that same literal, so a fourth marker fails there rather than passing silently here — a weaker guarantee than deriving, and stated rather than fixed |

So: 2 defects out of 25 candidates, 21 correct by design, 2 left with the reason above.

## What changed

`noTypeFolders()` in `test/helpers/view.ts`, beside the `noOptionalProperties()` it copies
the shape of — one loop over `FOLDER_OPTION_TYPES` through `typeFolderKey`, the same helper
the schema spells its keys with. Not `ALL_TYPES`: `Release` carries no `typeFolder` box at
all, so naming one would set an option the schema never declares. It read `FILED_TYPES`
until review found that one short too — see below.

The check is in `test/helpers/viewOptionFixtures.test.ts`, and it is **on the forbidden
thing** — a type whose folder still resolves to something after the fixture ran. It asks
`folderForType`, the function every creation path asks, rather than comparing the options
record to itself.

**Watched failing**: reverting `noTypeFolders` to the six recited names, the check goes red
naming the type rather than a boolean — `expected [ 'Idea', 'ideas' ] to deeply equal
[ 'Idea', null ]`. That pairing is deliberate; `toBe(null)` would have failed just as
truly and said nothing about which of thirteen.

`docs/adrs/0013` gained one amendment. It had absorbed each new name by restating a total
— "seven", then "eighth", then "twelfth" — and by 2026-09-02 the vocabulary was fourteen,
so the amendments had themselves become the staleness. The new one states the SOURCE
(`ALL_TYPES`) and says plainly that it is the last count that record will state.

## And review found the fix reciting one type down (PR #254)

`noTypeFolders()` was derived from `FILED_TYPES`, and the check beside it asked the same
list. **Both are one short of the folder-option set.** The schema and the resolver each
spell `[...FILED_TYPES, ABSENCE_TYPE]`: an absence is filed like any other note the plugin
writes, so it carries a `typeFolder.absence` box while being a type in no other sense.

It passed anyway, and the reason is the finding: `defaultTypeFolder` answers `''` for the
absence, so the folder resolved to nothing whether or not the fixture cleared it. **The
guard was hostage to a shipped default** — give the absence a folder later and every
inference test would silently hold it with this check still green. A subset asserted as
the whole, inside the change that was fixing exactly that.

Fixed at the root rather than by adding a third copy of the list. `FOLDER_OPTION_TYPES` is
now named once in `typeVocabulary.ts` and used by the schema, the resolver and the fixture,
which deletes two inline spellings — and it retires a comment in `settingsResolve.ts` that
asserted *"It is the SAME list the options are declared from"* with nothing checking it.
The list is now the same BINDING, so the claim holds by construction.

A second assertion carries what the first could not: the keys `noTypeFolders()` writes
must equal the `typeFolder.*` keys the real schema generates. That one is not hostage to
any default, and it fails in both directions — a key missed leaves a folder configured, a
key invented sets an option no box declares. **Watched failing** on the `FILED_TYPES`
spelling, naming `typeFolder.absence`.

`test/docs/surfaces.test.ts` had the identical blind spot one level up: it derives its
per-type loop from `ALL_TYPES` minus `Release`, which cannot reach a name in no vocabulary
list, so the absence box was unasserted there too. One line covers it, watched failing by
dropping the absence from the schema.

## What was refused

- **The note's step 4** — a `docs-check.mjs` rule refusing a requirement that spells a
  count of the vocabulary. Not attempted, and the note's own Risks section is why: "six"
  is a common English word and a gate that fires on prose is one contributors route
  around. It also needs no urgency now — a sweep of `docs/requirements/` found all five
  documents the note named already rewritten to name the set rather than its length.
- **`liveTypeKeys.test.ts`'s two marker loops.** Deriving them from `MARKER_TYPES` would
  be right and would say less: the file is about which types may hold a `release` key, and
  a literal there is the answer somebody chose. `settings.test.ts` holds `MARKER_TYPES` to
  that same literal, so the pair fails on a fourth marker. Stated rather than fixed.
- **A lint rule against the shape.** The AST walk above cannot tell a recitation from an
  expectation — 21 of its 25 hits are correct — so as a gate it would be 84% false
  positives. It is a paste that measures, like the `.pbl-*` coverage instrument
  `test/CLAUDE.md` describes, and for the same reason it is not committed.

## What is left

[[Read the vocabulary instead of reciting it]] stays open on step 4 alone.
