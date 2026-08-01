---
type: PBI
parent: "[[Multilang]]"
order: 50
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
- Every placeholder is sorted by **whether anything reads it back**, not by whether it
  looks like a value. Three kinds, and all three are present:

  | Kind | Example | Treatment |
  | --- | --- | --- |
  | Mirrors the option's real `default` | `DEFAULT_DONE_VALUES.join(', ')` on `doneValues` | Stays as written — clearing the field falls back to the string on screen |
  | An **example** of what to type | `stateValues` is `default: ''` with `placeholder: 'New, Active, Done'` (`viewOptions.ts:112-117`); `Item title`, `Sprint-12` in `ui/prompts.ts` | Translated — never parsed, so leaving it English protects nothing |
  | **Mixed**: user data with a literal fallback | `placeholder: homeFolder || 'Home folder'` on every type folder (`viewOptions.ts:156`) | The path renders as the user's own; the fallback label is translated |

- The type-folder placeholder is the one to get right, because it looks like the first
  kind and is not. `resolveFolders` falls back to `defaultTypeFolder(type, homeFolder)`
  (`settings.ts:241`) — `docs/requirements`, say — **not** to the placeholder. So nothing
  reads that string back, `Home folder` is plain English UI, and the earlier reading of
  this note (that it mirrored the default and should stay) was simply wrong.
  See `Persisted keys stay as written`.
- `configProblems` returns structured problems; no user-facing sentence is built in
  `src/domain/`.
- The English rendering of every problem is unchanged **in meaning and in structure**,
  which is narrower than byte-identical and deliberately so. `Intl.ListFormat` and the
  current `join(' and ')` agree on two labels and diverge past that:

  | Colliding | Today | `Intl.ListFormat('en')` |
  | --- | --- | --- |
  | 2 | `parent and order` | `parent and order` |
  | 3 | `parent and order and type` | `parent, order, and type` |
  | 4 | `parent and order and type and state` | `parent, order, type, and state` |

  Four labels can collide (`parent`, `order`, `type`, `state`), so this is reachable rather
  than theoretical. The formatted output is **correct English and the current output is
  not**, so the change is an improvement to accept, not a regression to avoid — but any
  existing assertion spelling the three-label form has to be updated deliberately rather
  than discovered. Stating the expected strings here is what makes that a decision.
- Marketplace review requires sentence-case UI text. That is an **English** rule and the
  lint that enforces it must apply to the English catalog only — German capitalizes
  nouns, and a rule that fights the language it is translating into is a bug in the rule.
