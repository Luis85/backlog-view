---
type: PBI
parent: "[[Multilang]]"
order: 130
status: Open
---

# A second language proves it

One non-English catalog ships, complete, and adding a third takes a contributor a pull
request with one file in it.

## Why this is a requirement and not a nice-to-have

A translation layer with exactly one locale has never been exercised. Everything the
feature builds — the fallback chain, the plural categories, the completeness check, the
column widths, the collation, the "type names are data" boundary — is untested against
the case it exists for. The bugs in a system like this are not in the abstraction; they
are in the first thing that does not fit it.

So the second locale is the acceptance test for the other twelve PBIs, and it is worth
choosing one that *stresses* rather than one that is convenient. A language with more
than two plural categories exercises `Intl.PluralRules`; a language with long compounds
exercises the fixed-width columns; an RTL language exercises `Layout survives translated
text`. Which language actually ships depends on who will maintain it — a catalog nobody
can review is worse than none — so the choice is a decision to record, not one to
predict here.

## Acceptance criteria

- One complete non-English catalog ships, passing every check in `Catalogs stay complete`
  with no exemptions.
- It is a real translation, reviewed by someone who reads the language. Machine output
  shipped as a translation is worse than English, because English is at least
  consistently wrong.
- Every bug the second locale exposes is fixed in the **layer**, not in the catalog. A
  string that fits only because the German was shortened is a layout bug with a workaround
  in it.
- `CONTRIBUTING`-level instructions exist for adding a language: which file to copy, what
  the checks require, how to run them, and what must not be translated. That last part is
  the one a contributor cannot infer — a translator looking at `Epic` has no way to know
  it is frontmatter.
- The `docs/` tree records which locales ship and who maintains each. A language whose
  maintainer is gone is a stale catalog, and knowing that early is the difference between
  removing it and shipping it broken.
- The live-vault checklist from `Layout survives translated text` is re-run for the new
  locale. Appearance cannot be tested in this repository, so every locale needs the same
  look — which is exactly why that note is written as a checklist to re-run rather than
  a task to close.
