---
type: PBI
parent: "[[Multilang]]"
order: 110
status: Done
started: 2026-09-01
finished: 2026-09-01
horizon: ""
start: 2026-09-01
due: 2026-09-01
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Catalogs stay complete

Every shipped locale is checked against English: nothing missing that would silently fall
back, nothing left over that no longer exists.

**As** someone maintaining a translation, **I want** a missing or stale key to fail the
build, **so that** a half-finished catalog is caught here rather than by a user reading a
half-English view.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever changes the plugin, and whoever translates it |
| **Trigger** | `npm run check`, on every build |
| **Preconditions** | Catalogs exist, including the fixtures |
| **Guarantee** | Every check can fail. With one shipped locale that takes fixtures, and a parity check that has only ever seen one catalog is not a check. |

**Main flow**

1. The check reads every catalog, shipped and fixture.
2. It compares each key set against English.
3. It compares each message's parameter set against English.
4. It validates each locale's plural categories against `Intl.PluralRules`.

**Extensions**

- **2a — a key is missing.** Reported as missing. The runtime falls back to English, which
  is the right runtime behaviour and the wrong build behaviour.
- **2b — a key is left over.** Reported as stale, and distinguished from missing: they have
  different fixes.
- **3a — a translation drops a parameter.** Caught here. A typed catalog only guarantees
  the call site is right, not the translation.
- **4a — the locale has fewer categories than English.** Not an error. English supplying
  `one` and `other` must not force Japanese to invent a second form. `other` is the floor
  and not a category this check has to police: the type already requires it, so a plural
  entry without one does not compile. See `Plurals and interpolation`.
- **4b — the locale supplies a category it does not have.** An error.

## What completeness buys that fallback cannot

A gap does not only cost one English sentence among translated ones. Where a message takes
another message's output as a PARAMETER, a gap splits ONE sentence between two catalogs.

Reproduced on 2026-08-21 (Codex, PR #188). `configProblems`
(`src/domain/settingsConsistency.ts`) renders `settings.sharedKey` with
`t('property.<role>')` results as its `{properties}`. Under a catalog holding
`property.parent` and `property.order` but not `settings.sharedKey`, it renders:

> the ELTERN and REIHENFOLGE properties share the key "note.same"

An English frame around translated nouns, and the inverse where the frame translates and a
role falls back. `t()`'s per-key fallback is right — a gap degrades to English rather than
to nothing — but it is per KEY, and a nested call is two keys inside one sentence.

**This is unreachable in the shipped plugin today**, and that is a fact about the
configuration rather than about the code: `initLocale()` is the only caller in `src/`, it
registers `CATALOGS = { en }`, so every key resolves from the same catalog. It becomes
reachable the moment a second catalog ships with a hole in it, which is what this check
exists to prevent.

So the nesting in `configProblems` is safe GIVEN this check and unsafe without it. Whoever
builds it should know that; whoever ever proposes making completeness advisory should read
this first. The alternative — resolving a message's parameters from whichever catalog
answered for the frame — needs `t()` to report which catalog that was, and is a change to
the i18n contract rather than to a call site. It was not made on the sweep that found this.

## The two failure modes

**Missing keys** degrade quietly. `Locale resolution and fallback` makes a missing key
render English, which is the right runtime behaviour and the wrong build behaviour — a
half-translated view looks like a bug in the translation rather than a gap in it. The
fallback is the safety net; the check is what stops the net being load-bearing.

**Stale keys** are dead code. A key deleted from English but left in five other catalogs
is five files carrying text nothing can ever render, and it is the kind of rot fallow
exists to catch — except a catalog is reached through a lookup helper, so fallow's
reachability analysis may not see individual keys at all. That gap is why this is a test
rather than an assumption that `npm run check` already covers it.

## Acceptance criteria

- A test compares every locale's key set against English and fails on either difference,
  naming the keys. One test, driven off the locale list, so adding a language needs no
  test edit.
- Because **English ships alone**, that test has nothing real to compare in this round and
  would pass vacuously. It runs against **fixture** catalogs instead, so every failure
  mode below is exercised before a real second locale exists rather than after. A parity
  check that has only ever seen one catalog is not a check — see `English ships alone`.
- The report distinguishes *missing* from *stale*: they have different fixes and a
  contributor should not have to work out which they are looking at.
- Every message's **parameter set** matches English too. A translation that drops `{count}`
  renders a sentence with a hole in it, and a type-checked catalog only guarantees the
  call site is right, not the translation.
- Plural categories are validated per locale against `Intl.PluralRules`: a locale
  supplying a category it does not have is an error, and a missing required category is
  an error. English supplying `one` and `other` must not force Japanese to invent a
  second form.
- Whatever fallow needs to read the catalog without flagging it — a lookup shape it can
  follow, or a scoped override — is decided here and written down in `.fallowrc.json`
  with the reason, not left as a silently-passing accident.
- A deliberately broken locale fixture proves each check fails. A completeness check that
  has never failed is a check nobody has tested.

## What landed (2026-09-01)

`test/i18n/parity.ts` is the comparator and `test/i18n/parity.test.ts` drives it. It runs
inside `npm run check` as part of the suite rather than as a step of its own, which is
what the design above meant by "the same shape as the register's gate" — a gate is a gate
wherever it is spelled, and a `.test.ts` file needs no new script, no new CI entry and no
second way to be run.

**It reads the REGISTRY, not a list of its own.** `CATALOGS` is exported from `t.ts` for
exactly that: a language added there is compared against English with no test edit, which
is the claim [[English ships alone]] makes about this round being a starting point. The
sweep over the registry is `it.each` over its entries, so the failure names the locale.

Four divergences, kept apart because they have four different fixes — `missing` (English
has the key, this catalog does not, so it renders in English), `stale` (nothing will ever
read it), `parameters`, and `plurals`. Each is proved by a fixture that breaks it and by
nothing else: a complete clone of English passes, one key deleted reports `missing` and
not `stale`, one key added reports the reverse, a message with `{type}` removed reports
the parameter and a message with `{kind}` invented reports both directions at once.

**The plural rule asks the CATALOG's own locale**, so English carrying `one` and `other`
does not force Japanese to invent a second form — the fixture asserts both halves of that
in one test, since the entry English calls complete is over-supplied for `ja` and the one
`ja` calls complete is incomplete for English. A malformed tag goes through `intlLocale`
and falls back rather than throwing a `RangeError` out of a check.

**The plural rule took two rounds of review to state, and both corrections are the same
mistake: it read English's SHAPE where it should have read the message.** It is three
cases now, kept apart because a shape is wrong for three different reasons and a
translator reading a failure has to know which.

- **Forms where nothing selects them.** `selectForm` reads `values.count`, so a key naming
  no `{count}` is called without one and `select(0)` picks `other` at every use. Every
  other form there is text nothing can reach, and even a lone `other` is a plain string
  wearing an object. Reported whole, as `extra`, because the fix is to spell it as a
  string — the first version of this rule reported a MISSING `one` on that entry, which is
  the opposite advice.
- **Forms that are not this locale's.** Supplying any means supplying exactly the
  categories `Intl.PluralRules` gives the catalog's language.
- **A plain string where English needed forms.** Refused wherever the locale has more than
  one category, accepted where it does not. The first version accepted it everywhere,
  written as "an entry supplying no forms has no categories to have" — which reads as
  tolerance for Japanese and is a hole in German, where the message would render one form
  forever.

**The predicate is the parameter, never English's shape**, and that is what the second
round found: seven English messages name `{count}` and spell one string, because English
needs no second form for them. A rule asking "is the English entry plural" would refuse a
legitimate German translation of those seven AND miss a German catalog spelling them
plainly. Nothing in English is plural without a count, measured on the merged tree, so the
rule fires on no shipped key.

Both rounds found by review (Codex, PR #240), and in both the test that had asserted the
old behaviour is the one that was watched failing.

**The parameter rule is UNIONED across a plural entry's forms, and that ceiling is written
into the check rather than left to be found.** English's own `lane.absenceClash` names
`{count}` in `other` and not in `one` — *an absence* needs no count and *three absences* do
— so a per-form rule would refuse the source catalog. What this cannot see is a translation
that drops a parameter from one form and keeps it in another; the test asserts that
limitation directly, next to the case it does catch.

**Fallow needed nothing, and that is the decision rather than an accident.** The design
asked for whatever it takes to be written into `.fallowrc.json` with a reason; the answer
is that the file is unchanged. `en` is read through `t.ts` from `main.ts`, so the catalog
is reachable from an entry point and its keys are values in an object literal rather than
members fallow resolves — there is no lookup shape for it to follow and nothing to
override. `CATALOGS` was made an export in this change and stays reachable the same way.

## Where it lives

`test/i18n/parity.ts` holds `compareToSource`, the comparator, and
`test/i18n/parity.test.ts` its fixtures and the registry sweep ·
`src/i18n/t.ts` exports `CATALOGS`, which is what the sweep reads ·
`src/i18n/locale.ts`'s `intlLocale` is how a locale code reaches `Intl.PluralRules`
without throwing · `test/i18n/fixtures.ts`'s `markedCatalog()` builds the complete clone
every broken fixture is a single delta against.
