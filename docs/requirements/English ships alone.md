---
type: PBI
parent: "[[Multilang]]"
order: 130
status: Open
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# English ships alone

English is the default, the fallback and — in this round — the **only** catalog. No
second language ships with the translation layer.

That is a deliberate scope decision, not an unfinished edge. The deliverable of round one
is a plugin whose strings all come from a catalog, not a plugin available in five
languages, and shipping a translation nobody on the project can review would be a worse
first move than shipping none.


**As** the maintainer, **I want** the first round to ship English only, **so that** the
deliverable is a plugin whose strings all come from a catalog rather than a plugin shipping
a translation nobody on the project can review.

## Use case

| | |
| --- | --- |
| **Actor** | The maintainer, deciding scope |
| **Trigger** | Deciding what the translation round ships |
| **Preconditions** | The catalog and locale layer exist |
| **Guarantee** | Adding a real language later is one catalog file plus one registry entry. Nothing else changes anywhere. |

**Main flow**

1. English ships as the default, the fallback and the only catalog.
2. The locale registry holds one entry, and the second-locale code path exists unused.
3. Fixture catalogs in `test/` exercise everything a second locale would.
4. A development-only pseudo-locale covers what a fixture cannot see.

**Extensions**

- **1a — the user runs Obsidian in another language.** They see an English plugin, because
  none has been written yet — a different and more honest state than a string being missed.
- **2a — the fallback chain has nothing to fall back through.** Every code resolves to `en`
  and no lookup can miss, which makes the resolution logic correct-by-vacuum. That is the
  state the fixtures exist to break.
- **3a — a check would pass vacuously.** The parity check, the regional fallback, plural
  categories beyond `one`/`other` and the catalog-versus-requested split are all
  unexercisable with one catalog, so fixtures are what make them capable of failing.
- **4a — the check is visual.** The pseudo-locale pads by a known factor and brackets every
  string, so expansion and RTL can be checked and an unbracketed string on screen is one
  the sweep missed.

## What it settles

- **The fallback always terminates.** Every locale resolves to English, so no lookup can
  reach a missing key at runtime. `Locale resolution and fallback`'s "render English
  rather than blank" rule is trivially satisfied in this round, and stays correct when it
  stops being trivial.
- **Every English string on screen becomes deliberate.** A German user sees an English
  plugin because none has been written yet, not because the string was missed — a
  different and more honest state than today's.
- **No translator workflow, no maintainer roster, no per-locale review burden.** All of
  it arrives with the first real language and none of it is round-one work.

## The risk this creates, stated rather than skipped

A translation layer with exactly one locale has never been exercised. The fallback chain,
the plural categories, the completeness check, the catalog-versus-requested locale split,
the column widths under longer words — every one of them is machinery built for a case
that never occurs. Bugs in a system like this are not in the abstraction; they are in the
first thing that does not fit it, and with one locale that thing arrives *after* release.

Shipping a second language was the previous answer to this. The decision above rules it
out, so the risk has to be met another way — and it can be, **without shipping
anything**, because the two tools for it are test data rather than translations.

## Fixture locales, which are not languages

A fixture catalog in `test/` is not a shipped locale: nothing loads it, nothing is
distributed with it, and no one has to maintain a translation. It is also the only way
several checks in this feature can fail at all in round one:

| Exercises | Otherwise |
| --- | --- |
| `pt-BR` → `pt` → `en` resolution | Untestable — every real code resolves straight to `en` |
| The completeness check | Vacuous: one catalog has nothing to be compared against |
| Plural categories beyond `one`/`other` | Never selected, since English has two |
| Catalog locale vs requested locale | Indistinguishable while both are always `en` |
| Parameter parity between catalogs | Nothing to diverge |

`Catalogs stay complete` already asks for a deliberately broken fixture to prove its
checks fail. This extends the same idea from the checks to the mechanisms.

## Pseudolocalization, for the half a fixture cannot reach

Text expansion and direction are visual, and no unit test sees them. The standard tool is
a **pseudo-locale** — English, mechanically transformed to be longer and accented, so
`Add tag` renders as something like `[!! Ãdd tág ÿ !!]` — loaded only in a development
build.

It makes two otherwise-blocked checks possible now:

- **Expansion.** German runs ~30% longer, and the fixed-width column model in
  `Property columns` was measured against English. A pseudo-locale pads by a known factor
  and shows what breaks, with no German catalog in sight.
- **Direction.** Paired with a forced `dir="rtl"`, it exercises the RTL work in
  `Layout survives translated text` without an Arabic or Hebrew catalog.

The brackets are the point: an *unbracketed* string on screen is one the sweep missed, so
the pseudo-locale doubles as a visual completeness check that no lint rule can perform.

## Acceptance criteria

- Exactly one catalog ships: English. The locale registry holds one entry, and the code
  path for a second is present and unused rather than absent.
- Adding a real language later is **one new catalog file plus one registry entry** — no
  other change anywhere. That is what makes "English only" a starting point rather than a
  dead end, and the fixture locales are the proof it holds.
- Fixture locales exist in `test/` and exercise every row of the table above. A check that
  cannot fail is not a check, and with one shipped locale most of these cannot fail
  without fixtures.
- A pseudo-locale is available in development builds and reachable from a
  `npm run test-build` vault, since that is where the visual checks in
  `Layout survives translated text` and `Light, dark and reduced motion` are run. It
  ships in no release.
- The rule for what must **not** be translated is written down now, not with the first
  translator. `Type names are data` and `Persisted keys stay as written` hold the content;
  this criterion asks only that a future contributor can find it without reading the whole
  register — a translator looking at `Epic` has no way to infer it is frontmatter.
- `docs/` records that English-only was chosen and why, so the next round starts from a
  decision rather than from an apparent omission.

## What round two would add

Not work, listed only so the boundary is legible: a real translation, reviewed by someone
who reads the language; a maintainer recorded against it; and the live-vault checklists
re-run for it. A machine-translated catalog shipped as a real one is worse than English,
because English is at least consistently wrong.

## Where it lives

**Nothing yet — this note is design.** It records a scope decision rather than adding code,
and the locale registry it constrains is part of the module `Locale resolution and fallback`
describes.

The fixtures and the pseudo-locale live under `test/`, and the pseudo-locale must be
reachable from a `npm run test-build` vault — `test-build.mjs` is the script that builds
one — while shipping in no release.
