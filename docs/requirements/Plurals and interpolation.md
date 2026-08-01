---
type: PBI
parent: "[[Translation layer]]"
order: 30
status: Open
---

# Plurals and interpolation

A message with a count or a name in it is one catalog entry with named parameters, not
an English sentence built out of pieces.

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
  `Intl.PluralRules` for the active locale. A locale supplies only the categories it
  has; English supplies `one` and `other`.
- All nine inline ternaries are gone, and a new one cannot be added — a bare `? '' : 's'`
  in `src/` is the kind of thing `A bare string cannot reach the UI` should catch.
- Parameters are **named**, not positional, so a translation can reorder them. Word order
  is not universal and a message assembled by `+` or by template literal at the call site
  cannot be reordered at all.
- Lists rendered into a sentence go through `Intl.ListFormat`. `configProblems`
  (`domain/settings.ts:206`) joins with a literal `' and '` today.
- Numbers shown to the user are formatted for the locale. `columns.ts:276` renders
  `${done}/${total}` and `columns.ts:280` a bare count; the digits and separators are
  not the same everywhere.
- Interpolating a *type name* (`New ${newLevel}` in `toolbar.ts:20`, `New ${type}` in
  `toolbar.ts:32`, `New <child>` in the context menu) passes it as a parameter to a whole
  message, never concatenates a translated word onto a data value. See
  `Type names are data`.
