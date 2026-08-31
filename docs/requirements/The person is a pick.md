---
type: PBI
parent: "[[Assigned work in the sidebar]]"
order: 20
status: Open
created: 2026-08-31
source: user request, 2026-08-31
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: ""
---

# The person is a pick

**As** the contributor who registers this view against a `.base` for the first time,
**I want** it to read its own type, parent, order, assignee and state properties — never
borrow the backlog view's saved choices — **so that** two views open on the same vault
can legitimately point at two different schemes, and everything downstream (the tree,
the picker, the one write this surface offers) is built against settings that already
tell the truth about what is bound and what is not.

## Use case

| | |
| --- | --- |
| **Actor** | The my-work view's own configuration surface — Bases' options panel, and the code that reads the stored config back |
| **Trigger** | Bases asks this view for its options panel, or resolves the view's stored config into settings before every render |
| **Preconditions** | None — this is the view's options bag, resolved before a model can be built or a note opened |
| **Guarantee** | `getMyWorkViewOptions` offers a type, a parent, an order, an assignee, a state, a done-values list, the started-states vocabulary, the started/finished stamp pair and the open-target dropdown — each key exactly once. `resolveMyWorkSettings` reads each back into a `MyWorkSettings`, telling a property the reader cleared from one nobody has touched: the three model mappings and the assignee/state pair keep the backlog view's own suggested keys until cleared, and a cleared one resolves to `''`, never back to the suggestion. |

**Main flow**

1. Bases calls `getMyWorkViewOptions` to draw this view's own options panel — never the
   backlog view's, even though the two happen to offer the same suggested keys for the
   type, parent, order, assignee and state properties — `type`, `parent`, `order`,
   `assignee` and `status` (the state property's own suggestion, sourced from the same
   `PROPERTY_TABLE` the backlog view reads, never re-typed as the field's own name).
2. The reader leaves the three model mappings at their suggested keys, or points them at
   whatever properties this vault actually uses for hierarchy.
3. The reader names an assignee property (so the view knows whose work this is) and,
   optionally, a state property, a done-values list and the started-states vocabulary.
4. `resolveMyWorkSettings` turns the stored config into one `MyWorkSettings`, which is
   the only settings shape every other module in this Feature reads.
5. When this view's own write path (Task 9) marks a note done, it stamps the same
   frontmatter keys a backlog-view write would — because they were resolved here, not
   invented at the point of the write.

**Extensions**

- **2a — the assignee property is cleared.** `assigneeKey` resolves to `''` rather than
  back to `assignee`; the view has no way to know whose work it is showing, which is a
  state a later task's empty screens must answer for, not this one.
- **3a — no state property is named.** `stateKey` is `''`, `doneValues` still resolves
  (to the shipped default when the box is untouched), and nothing here decides what an
  unconfigured state property means for the tree — that reading belongs to this
  Feature's own domain module for the tree itself (Task 2 of [[Assigned work in the
  sidebar]], not yet written).
- **3b — done values, or the started-states list, are left blank.** `doneValues` falls
  back to `DEFAULT_DONE_VALUES`; `startedStates` falls back to an empty list, exactly as
  the backlog view's own `resolveSettings` does for the same two keys.

A design decision, recorded here because this is where the behaviour is specified: the
brief for this task bound only `parentKey`/`orderKey`/`typeKey`/`assigneeKey`/
`stateKey`/`doneValues`/`openIn`. That leaves the started/finished stamp keys and the
started-states vocabulary unresolved, and this Feature's write path (Task 9) cannot
stamp a `finished` date without them. `MyWorkSettings` was widened to include
`startedDateKey`, `finishedDateKey` and `startedStates`, resolved the same way
`resolveSettings` resolves them for the backlog view (`propKey` with an empty default
for the two date keys, `dedupe(list(...))` for the vocabulary), rather than leaving a
note marked done from this sidebar with different frontmatter than one marked done
from the backlog view. The three keys are `notePropsOnly` like every other property
option here, matching the backlog view's own definitions rather than inventing new
ones.

## Acceptance criteria

- `getMyWorkViewOptions` declares `typeProperty`, `parentProperty`, `orderProperty`,
  `assigneeProperty`, `stateProperty`, `doneValues`, `startedStates`,
  `startedDateProperty`, `finishedDateProperty` and `openIn` — ten keys, each exactly
  once.
- `resolveMyWorkSettings` resolves `parentKey`/`orderKey`/`typeKey` to `parent`/`order`/
  `type` and `assigneeKey` to `assignee` when nothing is configured — the same
  suggestions the backlog view offers, read through this view's own option keys.
- A cleared `assigneeProperty` (or any other property option here) resolves to `''`,
  never back to its suggestion.
- `doneValues` falls back to `DEFAULT_DONE_VALUES` when unconfigured.
- `startedDateKey`, `finishedDateKey` and `startedStates` resolve exactly the way the
  backlog view's `resolveSettings` resolves the same three keys, and are empty when
  nothing is configured.
- `openIn`'s dropdown default and `resolveMyWorkSettings`'s own fallback agree —
  `'split'` — so an unset pick opens where the box already says it will.

## Where it lives

`src/domain/myWorkOptions.ts` — `getMyWorkViewOptions`, `resolveMyWorkSettings` and the
`MyWorkSettings` interface (`parentKey`, `orderKey`, `typeKey`, `assigneeKey`,
`stateKey`, `doneValues`, `startedDateKey`, `finishedDateKey`, `startedStates`,
`openIn`). It reads `configReaders` from `src/domain/settingsResolve.ts`,
`notePropsOnly` from `src/domain/optionalProperties.ts`, `DEFAULT_DONE_VALUES` from
`src/domain/settings.ts`, and `openTargetOptions`/`resolveItemHandling`/
`defaultItemHandling` from `src/domain/itemHandling.ts` — the same primitives every
other view's options bag in this codebase is built from. Nothing here renders or
writes; this is the settings surface every other module in this Feature (the tree, the
picker, the write path) is resolved against.
