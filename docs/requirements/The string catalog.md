---
type: PBI
parent: "[[Multilang]]"
order: 20
status: Open
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The string catalog

Every message the plugin can show, once, in one file per locale, typed so that a caller
cannot ask for a key that does not exist.


**As** someone maintaining this plugin, **I want** every message in one typed place per
locale, **so that** a caller cannot ask for a key that does not exist and a translator can
work without reading the code.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever changes the plugin, and whoever translates it |
| **Trigger** | Adding a message, editing one, or starting a translation |
| **Preconditions** | The locale layer exists (`Locale resolution and fallback`) |
| **Guarantee** | The catalog is data, not code. A translator can edit one without reading the plugin, and a typo in a key is a compile error rather than a blank label. |

**Main flow**

1. A developer adds a message to the English catalog under a new key.
2. The key's type makes it, and the parameters it takes, visible to callers.
3. A call site asks for that key and gets the message.
4. A translator copies the English file and replaces the values.

**Extensions**

- **1a — the same English text means two things.** Two keys. They diverge in other
  languages, so deduplicating by value is a bug waiting for the first translation.
- **1b — two keys hold identical English text.** Expected, and left alone, for the same
  reason.
- **2a — the message takes a parameter.** The parameter set is part of the key's type, so
  omitting one does not compile. See `Plurals and interpolation`.
- **3a — the key does not exist.** A compile error. Keys are typed, not strings.
- **4a — the copy is incomplete.** `Catalogs stay complete` catches it; this note only has
  to make the copy the obvious way to start.

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

## Where it lives

**Nothing yet — this note is design.** The catalog is the data half of the leaf module
`Multilang` places below every layer.

Two mechanical constraints come from the existing build rather than from taste: the
400-line cap in `eslint.config.mjs` applies to it like any other file, so the catalog
splits by surface rather than growing an exception; and `.fallowrc.json` gates dead code
and duplication, which is the shape parallel locale files take by construction.
