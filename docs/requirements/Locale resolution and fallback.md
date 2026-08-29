---
type: PBI
parent: "[[Multilang]]"
order: 10
status: Done
started: 2026-08-15
finished: 2026-08-15
horizon: ""
start: 2026-08-15
due: 2026-08-15
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Locale resolution and fallback

One function answers "what language is this", one function answers "what does this key
say", and a key with no translation renders in English rather than blank.

`getLanguage()` returns an ISO code and *defaults to `'en'`*, so the unset case is
already handled upstream — the resolution left to do is matching that code to a shipped
catalog. Obsidian's translation list includes regional codes, so `pt-BR` must find the
`pt` catalog rather than fall all the way to English.

In this round the answer is always English: `English ships alone` is the only catalog
that ships, so every code resolves to `en` and no lookup can miss. That makes the
resolution logic correct-by-vacuum, which is exactly the state a fixture locale exists to
break — the chain has to be exercised now, or its first real exercise is a user's.

Resolution happens **once**, at load. Obsidian requires a restart to change its language,
so re-reading per render would be cost with no observable benefit; `main.ts` registers
the view name and the command name at `onload` and could not react anyway.


**As** someone running Obsidian in a language this plugin has not been translated into,
**I want** the view to fall back cleanly rather than blank out, **so that** an untranslated
string is merely English instead of missing.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone opening a backlog view |
| **Trigger** | The view loads and asks what language to render in |
| **Preconditions** | None — `getLanguage()` is available unconditionally at `minAppVersion` |
| **Guarantee** | Lookup is total. Every key renders something in every locale, and no locale code can make the view throw or render blank. |

**Main flow**

1. The plugin reads Obsidian's language code once, at load.
2. It narrows that code to a shipped catalog, keeping the raw code for `Intl`.
3. A message lookup reads the resolved catalog.
4. The view renders the message.

**Extensions**

- **1a — the code is empty or malformed.** `getLanguage()` documents a default of `en`, but
  the resolver does not rely on that: an unusable code resolves to English rather than
  propagating. **Malformed is judged of the WHOLE tag, before any base is taken** — see
  `One judgement about a tag, asked twice` below. See `Locale-aware sorting and formatting`
  for why the *raw* code still needs validating before `Intl` sees it.
- **2a — the code is regional.** `pt-BR` finds the `pt` catalog before falling to English,
  matched case-insensitively.
- **2b — no catalog matches.** English, which always exists.
- **3a — the key is missing from the active catalog.** The English text renders, **with
  English grammar**. Never the key, never an empty string: a gap in a translation must not
  read as a broken view. The grammar half is the part that is easy to miss, and it was
  missed here first — see `Grammar follows the message, not the reader` below.
- **3b — the key is missing from English.** A build failure, not a runtime fallback.
  English is the source, so a gap there is a bug rather than an untranslated string.

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

## Grammar follows the message, not the reader

The rule everywhere else in this feature is written as *"grammar follows the catalog"*,
and that sentence has a hole in it exactly where this note's fallback lives: **which**
catalog. Implemented as "the ACTIVE catalog" it is right on every path except the one the
fallback exists for, and there it is wrong in a way that reads as a bug in the
translation:

| Active catalog | Message from | Renders |
| --- | --- | --- |
| `ru`, missing the key | English `{one, other}` | `Intl.PluralRules('ru').select(21)` is `one`, so `21 item` |
| `fr`, missing the key | English `{one, other}` | `select(0)` is `one`, so `0 item` |
| `de`, missing the key | English, with a list | `state, parent und order` inside an English sentence |

So the rule is **grammar follows the catalog that supplied THIS message**, which is the
active one until the key is missing and English's from then on. A translation gap must
degrade to English, not to broken English.

The list half of it has a second consequence worth stating, because it decides an
interface rather than a line: a list joined at the CALL SITE cannot obey this rule at all,
since the caller does not know which catalog the message will come from. So a list is
passed to `t()` as an array parameter and joined during rendering — the same "format
inside the module that owns it" move `A bare string cannot reach the UI` arrived at
independently for `Intl` output, which is a good sign it is the right shape.

Found by review (Codex, PR #151), against an implementation whose own comment stated the
narrower rule correctly and then used the wrong noun.

## One judgement about a tag, asked twice

The two answers this note asks for — which catalog, and which locale for `Intl` — are
deliberately different questions, and that made it easy to give them **different ideas of
what a valid tag is**. Both defects below are that one mistake, seen from each end:

| Code | Catalog said | `Intl` said | Why |
| --- | --- | --- | --- |
| `pt_BR` | `pt` — the resolver split on `_` | `en` — `getCanonicalLocales` throws on `_` | Portuguese text, English numbers |
| `pt-!!!` | `pt` — the base subtag is real | `en` — refused | A corrupted host locale renders an unasked-for translation |

Neither is reachable from Obsidian, whose language list holds well-formed codes; both are
reachable from a caller, and the second is the one that would matter once a second catalog
ships.

So there is **one validator, and both callers go through it**:
`Intl.getCanonicalLocales` is the judge — the same judgement every `Intl` constructor
makes, rather than a pattern of our own that could disagree with them — with underscores
normalized to hyphens before it, so an underscore tag is the same tag to both callers.
It returns null rather than a fallback, because the two callers fall back to different
things.

The property to assert is the PAIR, not either answer: a code yields a catalog and a
number locale together, or neither. A tag one accepts and the other refuses renders
translated text with the source language's numbers, which reads as a broken translation
rather than as a rejected tag. Found by review (Codex, PR #151).

## Where it lives

`src/i18n/locale.ts` is the resolution itself, and it is **pure**: `resolveCatalog` narrows
a language code to a shipped catalog, `intlLocale` makes the raw code safe for `Intl`, and
neither knows which catalogs exist — the registry sits with the catalogs, so a test can ask
this module any question without a reload. `src/i18n/t.ts` holds the resolved locale and
the formatters built from it, reads `getLanguage()` from `obsidian` in `initLocale`, and
exposes `setLocale` — whose catalogs argument is the seam fixture locales come through.
`src/main.ts` calls `initLocale()` first in `onload`, before it registers the view name and
the command name.

`i18n/` is the new leaf `Multilang` describes: `eslint.config.mjs` gives it a `forbidden`
entry listing every other directory, so it cannot grow an edge back up.

The fallback chain is exercised by `test/i18n/locale.test.ts` against the fixture catalogs
in `test/i18n/fixtures.ts`, because against the shipped registry every code resolves to
English and none of it could fail. `test/helpers/obsidian-mock.ts` supplies `getLanguage`.
