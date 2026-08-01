---
type: PBI
parent: "[[Translation layer]]"
order: 20
status: Open
---

# The string catalog

Every message the plugin can show, once, in one file per locale, typed so that a caller
cannot ask for a key that does not exist.

## Acceptance criteria

- One file per locale. English is the source: its shape defines the key set, and every
  other catalog is checked against it (`Catalogs stay complete`).
- Keys are **typed**, not `string`. A typo in a key is a compile error, and the
  parameters a message takes are part of its type — `t('row.addChild')` must not
  type-check if that message needs a type name.
- Keys are named for the surface and the meaning, never for the English words. `Rename a
  key when the meaning changes, not when the wording does` is the rule; a catalog keyed
  on English text has to be re-keyed by every locale on every copy edit.
- Identical English strings that mean different things get different keys. The reverse —
  two keys with the same English text — is expected and must not be deduplicated, because
  they diverge in other languages.
- The catalog is data, not code: no logic, no imports beyond types, so a translator can
  edit one without reading the plugin.
- It stays within the 400-line lint cap per file, or splits by surface rather than
  growing a per-file exception.

## Two mechanical hazards worth planning for

`npm run check` runs fallow, which gates dead code and duplication. A catalog is exactly
the shape both rules dislike: keys reached only through a lookup helper can read as
unreferenced, and parallel locale files are near-duplicates of each other by
construction. Whether that means a fallow override, a lookup shape fallow can follow, or
a generated key union is an open design question — but it is a question this PBI answers
rather than discovers, because `npm run check` passing is the definition of done and the
coverage thresholds only ever go up.
