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

## The pick itself, and where it lives

Task 4 of [[Assigned work in the sidebar]] registers the view this options bag describes
(`product-my-work`, `registerMyWorkView`) and gives it the one thing a saved view owes a
returning reader: which person's tree was on screen last stays on screen, across a close
and reopen of the same `.base`.

**The pick is device UI state, never a `.base` setting — ADR 0011's rule, stated here
because this is where it is spent a third time.** A `.base` file is shared: every teammate
who opens it sees the same saved view, the same options, the same filter. Which PERSON a
reader was looking at is not a fact about the base, it is a fact about that reader's own
working session — so it is written to the vault-scoped view-state store
(`storage/viewStateStore.ts`), keyed to this saved view's own identity, exactly the way
the release view's open release and the board's scoped iteration already are. `prefs.person`
is the third path-valued preference in that store (`PATH_PREFS`), which is what makes
renaming the picked `Resource` note keep the panel on the same person rather than
silently emptying it — `renamePathPrefs` walks all three the same way.

**An embedded base has no such identity, and the pick is session-only there rather than
absent.** `resolveViewIdentity` returns null for a base embedded in a note, and
`MyWorkView` reads that as "nothing to restore from" without ever writing `null` back —
assigning `null` in that branch would reset the pick on every ordinary Bases data update,
which arrives far more often than a reader would expect their choice to be forgotten.

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
- `registerMyWorkView` registers `product-my-work` with `getMyWorkViewOptions` as its
  options and a factory that builds a `MyWorkView` over the shared `WriteLock`.
- `MyWorkView.pick` persists the chosen person's path to `prefs.person`, keyed to this
  view's own identity, and clears the roving row (a row selected in one person's tree is
  not where the next person's should start).
- Reopening the same `.base` (a fresh `MyWorkView` instance, same identity) restores
  `pickedPerson` from `prefs.person` before the first render.
- An embedded base — no view identity — keeps the pick in memory for the session and
  never resets it on an ordinary data update; it is gone once the base closes.
- Renaming the picked `Resource` note (or a folder above it) updates the stored
  `prefs.person` rather than leaving it naming a path that no longer resolves.
- With no assignee property bound, the stale model and settings from the last configured
  render are cleared rather than retained, so a write attempted against them is refused.

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

`src/view/mywork/myWorkView.ts` — `MY_WORK_VIEW_TYPE`, `MyWorkView`: the `BasesView`
that builds the model from this options bag, resolves and persists the picked person,
and draws the states that come before a tree (unbound assignee, an empty roster, nobody
picked yet). `src/view/mywork/register.ts` — `registerMyWorkView`, this view's own
registration, composed behind the plugin's one shared `WriteLock` in `src/main.ts`
(ADR 0030). `src/storage/viewStateStore.ts` — `prefs.person` in `ViewPrefs`, its
`PREF_READERS` row and its `PATH_PREFS` entry, which is what gives it the rename walk
every other note-path preference here already has.
