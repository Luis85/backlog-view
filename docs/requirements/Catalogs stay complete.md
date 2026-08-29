---
type: PBI
parent: "[[Multilang]]"
order: 110
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

## Where it lives

**Nothing yet — this note is design.** The check runs as part of `npm run check`, which
already chains `npm run docs` for the register's own gate — the same shape, applied to the
catalog.

The fixtures live under `test/`, beside the harness in `test/helpers/view.ts` that already
owns per-test setup.
