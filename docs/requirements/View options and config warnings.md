---
type: PBI
parent: "[[Multilang]]"
order: 50
status: Done
started: 2026-08-21
finished: 2026-08-21
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# View options and config warnings

The 30 sites in `domain/viewOptions.ts` — four group names, every `displayName`, every
`placeholder` — plus the problem sentences `configProblems` produces. The highest-risk
file in the sweep, because half of what it contains must **not** change.


**As** someone configuring the view in another language, **I want** the options menu and
its warnings in my language, **so that** I can set the plugin up without the settings
being the one English surface left.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever configures a base |
| **Trigger** | Opening the Bases view-options menu, or a config problem gating a write |
| **Preconditions** | The catalog exists |
| **Guarantee** | Every persisted `key` is byte-identical before and after. A user's configuration survives the translation, and survives switching language afterwards. |

**Main flow**

1. A developer moves each group name, `displayName` and hint `placeholder` to the catalog.
2. Every `key` is left exactly as it is, including the generated `typeFolder.<type>` set.
3. `configProblems` stops returning prose and returns structured problems.
4. The view formats those problems for the toolbar chip and the write-gate notice.

**Extensions**

- **1a — the placeholder mirrors the option's real default.** It stays as written: clearing
  the field falls back to the string on screen.
- **1b — the placeholder is a mixed expression.** `homeFolder || 'Home folder'` renders the
  user's path as their own and the fallback label from the catalog.
- **2a — a key is derived from a type name.** `typeFolderKey` keeps deriving from the
  canonical name, so no locale can change a persisted key. See `Type names are data`.
- **3a — three or four labels collide.** `Intl.ListFormat` renders them, which changes the
  English past two labels — an improvement to accept deliberately rather than a regression
  to avoid.
- **4a — a problem is quoted into a notice.** The write gate quotes the formatted problem;
  the structured form never reaches the user.

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

There are two readers to update, not one: `renderConfigWarning` in `toolbar.ts` renders
the joined problems as an `aria-label` on the warning chip, and `problems[0]` is quoted
into a Notice from three call sites — `writeGate.ts` (the gate), `structure.ts` (the setup
action, which runs the gate itself before touching the `.base`) and `create.ts`. Named
rather than cited by line: the three were last written as two line numbers and one
omission, and both numbers had moved by the time anyone looked.

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

## What it decided (2026-08-21)

Three questions this note left open were answered by building it, and each is here because
the answer is not what the paragraphs above assumed.

**The problems are FRAGMENTS, not structured problems.** `configProblems` still returns
strings, and they still come out of `domain/` — but each is a fragment
(`settings.sharedKey`, no capital and no full stop) that a reader puts inside a sentence of
its own: `config.fixFirst` for the one problem five call sites and the write gate report,
`config.fixAll` for the whole list. That is what the deferred half of this PBI was actually
about. A whole sentence nested in another rendered `Fix the view configuration first: The
… properties share the key "x"..`, and the readme command's own key for that outer sentence
is gone — the toolbar's warning chip and the readme refusal share `config.fixAll` rather
than keeping two sentences that have to agree.

The structured-problem design in **The domain-layer question this PBI answers** was not
built, and the reason is that its premise expired: `domain/` reaches the catalog directly
(`i18n/` is the leaf below every layer), so a whole key IS the sentence and nothing is
assembled in the pure layer. A descriptor type plus a formatter in `view/` would have added
a type and two call sites to reach the same rendered string. What the design was right
about is kept in a smaller shape — the labels no longer read as internal words, because
they are catalog text.

**A collision names each property by ROLE, not by the option's `displayName`.**
`ownedProperties` returns a role id (`parent`, `startedDate`, `tags`, every `OptionalField`)
and the word comes from `property.<role>`. Not the menu's full label, which this note
suggested: the sentence already ends in "properties", so the fuller label reads as "the
Parent property and Order property properties". The id is also what `WORKFLOW_STATE_LABELS`
matches on — now `WORKFLOW_STATE_ROLES` — so no locale can move a property in or out of the
pair allowed to share a key. `OptionalProperty.label` is gone with it: the word had one
home, and it is the catalog. Because the role ids and their English words are the same
string for `parent`, `order`, `type` and `tags`, English hides a revert here — the check
uses the started date and the tags key, whose word and id differ.

**Ten of the catalog's own keys quote an option label as English text**, and that is NOT
fixed here: it is extension 1a of [[Every surface translated]], which owns it. Ten keys,
ten distinct labels, counted 2026-08-21 by matching each `option.*` value against the rest
of the catalog — an instrument that reads the labels from the catalog rather than from a
list, so it cannot go stale by wording. What changed is that it is now possible: the labels
are keys, so those sentences can take one as a parameter instead of spelling it twice.

## What is not checked here

`getViewOptions` returns a schema; Bases draws the menu. So what CI confirms is that every
group name, `displayName` and prose placeholder arrives from the catalog and that every
persisted `key` is unchanged — not that the menu still reads well in a real Obsidian, and
not that a long German label survives the panel's width. Both are live-vault checks and
join [[Smoke test the visual changes]]. `npm run test-build` is the handover.

## Where it lives

`src/domain/viewOptions.ts` is the schema whose `displayName`s and prose `placeholder`s
come from the catalog and whose `key`s, `default`s and read-back placeholders do not — the
rule is stated in the module, where the mistake would be made ·
`src/domain/optionalProperties.ts` names each owned property by role (`OwnedRole`) ·
`src/domain/settingsConsistency.ts` holds `configProblems`, which renders one fragment per
collision · `src/domain/typeVocabulary.ts` holds `typeFolderKey`, so no locale can change a
persisted folder key · `src/i18n/en.ts` carries the `option.*`, `property.*` and `config.*`
keys · `src/view/render/toolbar.ts` renders the warning chip through `config.fixAll` and
`src/commands/readme.ts` refuses through the same key · `src/view/writeGate.ts`,
`src/view/interactions/structure.ts` and `src/view/interactions/create.ts` quote the first
problem through `config.fixFirst`.
`eslint.config.mjs` carries the file into `SWEPT`, so the three text bans hold it — with
`displayName` added to `UI_TEXT_PROPERTY`, the option-bag property no other module in
`src/` spells.
Tests: `test/domain/viewOptions.test.ts` (the frozen key set, and the marked-catalog
remainder), `test/domain/settings.test.ts` (the fragment and its property words),
`test/i18n/toolbar.test.ts` (the warning's one sentence), `test/commands/readme.test.ts`.
