---
type: PBI
parent: "[[Multilang]]"
order: 110
status: Open
---

# Catalogs stay complete

Every shipped locale is checked against English: nothing missing that would silently fall
back, nothing left over that no longer exists.

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
