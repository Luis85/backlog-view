---
type: PBI
parent: "[[Multilang]]"
order: 10
status: Open
---

# Locale resolution and fallback

One function answers "what language is this", one function answers "what does this key
say", and a key with no translation renders in English rather than blank.

`getLanguage()` returns an ISO code and *defaults to `'en'`*, so the unset case is
already handled upstream — the resolution left to do is matching that code to a shipped
catalog. Obsidian's translation list includes regional codes, so `pt-BR` must find the
`pt` catalog rather than fall all the way to English.

Resolution happens **once**, at load. Obsidian requires a restart to change its language,
so re-reading per render would be cost with no observable benefit; `main.ts` registers
the view name and the command name at `onload` and could not react anyway.

## Acceptance criteria

- A code with no catalog resolves to English. So does an empty or unrecognized code.
- A regional code falls back to its base language before it falls back to English
  (`pt-BR` → `pt` → `en`), and the match is case-insensitive.
- A key missing from the active catalog renders the English text, not the key and not an
  empty string. Nothing in the UI can render as blank because of a gap in a translation.
- A key missing from **English** is a build failure, not a runtime fallback — English is
  the source catalog, so a gap there is a bug rather than an untranslated string.
- Lookup is a pure function of (key, locale, params) with no module-level mutable state
  beyond the resolved locale, so a test can drive any locale without a reload.
- **Both locales are exposed, not just the resolved one.** Resolution narrows the
  Obsidian language code to a shipped catalog, and that narrowing is right for messages
  and wrong for everything else — `Intl` handles far more locales than this plugin will
  ever ship catalogs for. The raw `getLanguage()` code stays available for collation and
  number formatting, so a French user with no French catalog still sorts and counts in
  French. See `Locale-aware sorting and formatting`, which states the dividing line.
