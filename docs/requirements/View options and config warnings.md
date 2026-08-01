---
type: PBI
parent: "[[Every surface translated]]"
order: 30
status: Open
---

# View options and config warnings

The 30 sites in `domain/viewOptions.ts` — four group names, every `displayName`, every
`placeholder` — plus the problem sentences `configProblems` produces. The highest-risk
file in the sweep, because half of what it contains must **not** change.

## The hazard, stated once

`viewOptions.ts` says it about itself: *"Every `key` here is PERSISTED in the user's
`.base` file and read back by `resolveSettings`. Renaming one silently resets that option
for everyone."* A `key` is data; a `displayName` and a `placeholder` are text. They sit
on adjacent lines of the same object literal, which is exactly the arrangement in which a
sweep makes a mistake.

`typeFolderKey(type)` is the sharp edge: the key is derived from the **type name**, so a
translated type name would generate a different persisted key per locale — the whole
"folder for this type" configuration silently resetting when the user switches language.
See `Type names are data`.

## The domain-layer question this PBI answers

`configProblems` (`domain/settings.ts:186-210`) returns finished English sentences from
the pure layer:

```ts
problems.push(`The ${users.join(' and ')} properties share the key "${key}".`);
```

Three things are wrong with translating that in place. It puts UI text in `domain/`,
which the layer rules exist to prevent. It joins a list with a literal `' and '`, which
`Intl.ListFormat` should do. And the labels being joined (`parent`, `order`, `type`,
`state`) are the option *names*, so they should read as the translated option labels the
user sees in the menu, not as internal words.

So `configProblems` should return **structured problems** — a descriptor naming the
colliding option keys — and the view should format them. That keeps the domain layer
pure by the same argument the root `CLAUDE.md` makes about `DropTarget`: the type belongs
with the code that produces it, and prose is not what this function produces.

There are two readers to update, not one: `toolbar.ts:77` renders the joined problems as
an `aria-label` on the warning chip, and the write gate quotes `problems[0]` into a
Notice from three call sites (`backlogView.ts:534`, `create.ts:34`).

## Acceptance criteria

- Every `key` in `viewOptions.ts` is byte-identical before and after, including every
  `typeFolder.<type>` key. A test asserts the full key set against a frozen list, so a
  future edit cannot move one either.
- Group names, `displayName`s and `placeholder`s come from the catalog.
- The placeholders that show a **default value** rather than a hint stay data:
  `DEFAULT_DONE_VALUES.join(', ')` and the type-folder placeholder that shows the
  resolved home folder are values the user would type, not words. `New, Active, Done`
  as the `stateValues` placeholder is the same case — see `Persisted keys stay as
  written`.
- `configProblems` returns structured problems; no user-facing sentence is built in
  `src/domain/`.
- The English rendering of every problem is unchanged, so the existing gate tests read
  the same after the change.
- Marketplace review requires sentence-case UI text. That is an **English** rule and the
  lint that enforces it must apply to the English catalog only — German capitalizes
  nouns, and a rule that fights the language it is translating into is a bug in the rule.
