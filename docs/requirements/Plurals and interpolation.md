---
type: PBI
parent: "[[Multilang]]"
order: 30
status: Done
started: "2026-08-15"
finished: "2026-08-15"
horizon: ""
start: ""
due: 2026-08-15
risk: ""
assignee: ""
---

# Plurals and interpolation

A message with a count or a name in it is one catalog entry with named parameters, not
an English sentence built out of pieces.


**As** someone reading the plugin in a language with different plural rules or word order,
**I want** counted and parameterised messages to be whole sentences in my language,
**so that** they read as written rather than as English assembled from parts.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading a message that names a number or a value |
| **Trigger** | The view renders a count, a list, or a message naming a type or state |
| **Preconditions** | The catalog exists and the locale is resolved |
| **Guarantee** | The sentence is the unit of translation. No message is built by concatenation at the call site, so any language can reorder it. |

**Main flow**

1. Code asks the catalog for a message, passing named parameters.
2. The catalog selects the plural form for the count, using the **catalog** locale.
3. Parameters are substituted into the chosen form.
4. The finished sentence renders.

**Extensions**

- **1a — the parameter is a type name.** It is passed as a parameter to a whole message,
  never concatenated onto a translated word. See `Type names are data`.
- **2a — the locale has more than two plural categories.** The catalog supplies the forms
  that locale has; English supplies `one` and `other` and must not force a locale to
  invent a third.
- **2b — the resolved catalog is English but the user asked for Russian.** Categories come
  from the **catalog** locale, or the lookup asks English for a `few` form it does not
  have.
- **3a — the message interpolates a list.** `Intl.ListFormat`, in the catalog locale,
  because a joiner is grammar inside a sentence.
- **3b — the message interpolates a number.** Formatted, not pasted. Counts rendered
  *outside* any sentence belong to `Locale-aware sorting and formatting` instead.

## Why this is its own PBI

The plugin currently pluralizes with inline ternaries, in nine places:

```ts
`${count} item${count === 1 ? '' : 's'}`                                   // toolbar.ts:87
`${n} note${n === 1 ? ' in this base is' : 's in this base are'} …`        // toolbar.ts:140
`All ${total} item${total === 1 ? ' is' : 's are'} done and hidden.`       // emptyStates.ts:70
`${outcome.conflicts} value${… ? ' was' : 's were'} edited since and kept` // undo.ts:94
```

`emptyStates.ts:50` is the worst of them: one template with **three** separate
one-or-many switches (`note`/`notes`, `has`/`have`, `it is`/`they are`) inside a single
sentence. A ternary is a two-form rule with the two forms hard-coded, and it is wrong for
most of the languages Obsidian ships in — Polish and Russian have three plural
categories, Arabic six, Japanese and Chinese one. There is no way to translate
`toolbar.ts:140` correctly by substituting words into it, which is the point: the
sentence, not the noun, is the unit of translation.

`Intl.PluralRules` is in the platform, needs no dependency, and gives the category name
a catalog can key on.

## Acceptance criteria

- A counted message is one key with a form per plural category, selected by
  `Intl.PluralRules` for the locale of the catalog **that supplied that message** — not the
  user's requested one, and not the active catalog either when the message fell back to
  English. The distinction only bites on the fallback path, which is where it bit: see
  `Grammar follows the message, not the reader` in `Locale resolution and fallback`. The forms
  that exist are the ones the catalog was written with, so asking `Intl.PluralRules('ru')`
  for categories while reading the English catalog requests a `few` form English does not
  have. A locale supplies only the categories it has; English supplies `one` and `other`.
- **`other` is the one REQUIRED category**, stated in the type rather than guarded at the
  lookup. Every language in CLDR has it, so requiring it costs no locale anything — and it
  is what makes the last resort a real value: with every category optional, a catalog
  written with `few` alone type-checked and rendered a **blank label**, against this
  feature's own "every key renders something" guarantee. The guarantee is exactly as wide
  as the check: the compiler enforces it for every catalog under `src/`, which is every
  catalog that ships, and `tsconfig.json` covers `src/` only — so a `test/` fixture is its
  author's problem. Found by review (Codex, PR #151).
- `Intl.ListFormat` follows the catalog locale for the same reason: it is producing
  grammar inside a sentence, and a French joiner in an English sentence is a worse result
  than an English one. This is the grammar half of the rule in
  `Locale-aware sorting and formatting` — grammar follows the catalog, data presentation
  follows the user.
- All nine inline ternaries are gone, and a new one cannot be added — a bare `? '' : 's'`
  in `src/` is the kind of thing `A bare string cannot reach the UI` should catch.
- Parameters are **named**, not positional, so a translation can reorder them. Word order
  is not universal and a message assembled by `+` or by template literal at the call site
  cannot be reordered at all.
- Lists rendered into a sentence go through `Intl.ListFormat` rather than a literal
  joiner — `configProblems` (`domain/settings.ts:206`) uses `' and '` today. The list is
  passed to `t()` as an **array parameter** and joined during rendering, never joined at
  the call site: only the lookup knows which catalog supplied the surrounding sentence,
  and that is the locale the joiner has to follow.
- Numbers **inside a message** are formatted rather than interpolated raw. The counts
  rendered outside any sentence (`columns.ts:276`, `columns.ts:280`) belong to
  `Locale-aware sorting and formatting`, since they are data presentation rather than
  grammar.
- Interpolating a *type name* (`New ${newLevel}` in `toolbar.ts:20`, `New ${type}` in
  `toolbar.ts:32`, `New <child>` in the context menu) passes it as a parameter to a whole
  message, never concatenates a translated word onto a data value. See
  `Type names are data`.

## The count was nine when this note was written, and it was nineteen

Measured rather than recalled, which is the rule this register keeps about counts. The
nine ternaries above are still there; ten more arrived in the projections built since —
the lanes, the shelf, the roadmap's buckets, the board's columns and its match count, the
card disclosure's note, `childrenList`. Every one of them is gone. Two files the note
named have moved on: the toolbar's count label is `render/toolbarStatus.ts` now, and the
`' and '` joiner left `domain/settings.ts` for `domain/settingsConsistency.ts` when the
config report split out.

The nineteenth arrived **during** this work, which is the number's real lesson: merging
main brought the shelf's new type-group fold, and its `aria-label` was written the old way
because the old way was still the only way when it was written. It reused
`roadmap.groupLabel` unchanged. Until `A bare string cannot reach the UI` lands there is
nothing stopping the twentieth, so a merge that touches a rendering module is worth
grepping — and that PBI is the reason this note does not have to keep saying so.

The `${n} item${s}` shape occurred five times over the same meaning and is **one key**,
`count.items`. That is not the deduplication `The string catalog` forbids: that rule is
about identical English text meaning two different things, and this is one meaning
rendered in five places.

One assembly is deliberately left standing, marked in the code: `runInit`'s notice still
builds `Product Backlog: {…}.{…}` out of fragments. `list()` now joins them — the half
that is grammar, and the half this PBI asked for — and turning the whole sentence into one
key belongs to `Every surface translated`, which is where the fragments' own wording goes
too.

One English wording changed rather than being carried across: `1 note no longer exist`
became `no longer exists`. It was a two-form rule with the wrong second form, and it is
only visible once the forms are written out.

## Where it lives

`src/i18n/t.ts` holds the formatter — `selectForm` (via `Intl.PluralRules` on the catalog
locale), the named substitution, `list()` over `Intl.ListFormat`, and `Intl.NumberFormat`
for a number inside a message. The forms themselves are catalog data in `src/i18n/en.ts`.

What it replaced: `src/view/render/toolbar.ts`, `src/view/render/toolbarStatus.ts`,
`src/view/render/emptyStates.ts`, `src/view/render/lanes.ts`, `src/view/render/shelf.ts`,
`src/view/render/roadmap.ts`, `src/view/render/board.ts`,
`src/view/render/cardChildren.ts`, `src/view/interactions/undo.ts`,
`src/view/interactions/structure.ts`, `src/view/childrenList.ts`, and the joiner in
`src/domain/settingsConsistency.ts`.
