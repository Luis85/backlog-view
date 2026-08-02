# Per-column agreements — the board's fourth increment

**Date** 2026-08-02
**Delivers** [[WIP limits]] and [[Explicit policies on the column]], both under
`Columns from the workflow`
**Runs beside** the first increment of [[Milestones]], in flight on another branch

## Why this increment, and why now

The milestones increment touches `itemTypes.ts`, `model.ts`, `writePlan.ts`, `settings.ts`,
`viewOptions.ts`, `roadmap.ts`, `timeline.ts`, `render/rows.ts`, `render/toolbar.ts`,
`render/timeline.ts`, `interactions/menu.ts`, `interactions/plan.ts`, `docs-check.mjs`, two
ADRs and several requirement notes — its own `## Landmines` section says so. That rules out
every roadmap-shaped slice, and rules out `Multilang` and `Theming and styling` outright,
since both rewrite every file and every stylesheet the other branch is editing.

The board's columns are the far side of the codebase from all of it. `domain/board.ts` and
`view/render/board.ts` are untouched by milestones, and the two open PBIs under
`Columns from the workflow` describe **the same mechanism** in their own `## Where it lives`
sections: one generated view option per configured state, the way the per-type folder keys
already are. One mechanism, two payloads, one header that reads both.

It also closes a gap rather than only adding a surface: [[Drag a card to a new state]] has
been `Active` on a single criterion — *no drop is ever refused because of a limit* — which
only [[WIP limits]] can exercise.

## Scope

**In:** WIP limits, explicit policies, and the column context menu that policies need.

**Out:** column collapse ([[Done columns stay lean]] — a `localStorage` concern, not a
`.base` one, and it needs a key namespace for columns that the store's path-pruning must
leave alone), creation from a column ([[New cards in place]]), lanes
([[Swimlanes by parent]]), and anything that makes a limit refuse a move.

## Architecture

Four layers, in the order the change moves through them. Nothing here reaches upward, and
no write path learns about limits at all.

### 1. Configuration — `src/domain/viewOptions.ts`

Two new option families in the Progress group, generated from the configured workflow
states. `getViewOptions(config)` already receives the config and already reads user data
out of it — `homeFolder` does exactly this to keep each type-folder default tracking the
home folder — so generating from `resolveSettings(config).states` introduces no new
capability, only a second use of one.

| Key | Option type | Generated for |
| --- | --- | --- |
| `wipLimit.<lowercased state>` | `text`, empty means unlimited | Configured states **minus** `doneValues` |
| `columnPolicy.<lowercased state>` | `text` | **Every** configured state |

The limit is a `text` box rather than a `slider`, which is the only numeric option type
Bases offers here. A slider cannot express *unset* — it always holds a number, and
extension 1a is explicit that **an unset limit is not a limit of zero** — and it needs a
maximum, which a work-in-progress limit does not have. Parsing is defensive in the same
way `propertyColumnWidth` already is, and for the same stated reason: a `.base` file is
hand-editable and can hold anything. A value that is not a finite integer of one or more
means unlimited.

The two lists differ on purpose. [[WIP limits]] extension 1b excludes the no-state column
and done columns — *WIP is what sits between started and finished; capping the backlog or
the archive is a different idea wearing the same word*. [[Explicit policies on the column]]
says nothing of the kind: a done column can carry a working agreement like any other.

Both key builders live in `settings.ts` beside `typeFolderKey`, for the reason that one
already states: a persisted key spelled in the schema and again in the resolver is a key
that can differ, and these are user data in someone's `.base` file.

Two exclusions fall out with no code:

- **No `stateValues` configured.** `settings.states` is empty, so no options are generated
  and no header changes. Limits and policies are for a workflow someone has stated; the
  observed-value fallback is not one.
- **A stray column** (`outsideWorkflow`) is minted from an observed value the workflow does
  not name, so no configured key exists for it, so it has neither.

### 2. Resolution — `src/domain/settings.ts`

```ts
wipLimits: Record<string, number>;      // keyed lowercase; absent means unlimited
columnPolicies: Record<string, string>; // keyed lowercase; absent means none
```

Same shape and same construction as `typeFolders`: null-prototype maps, read through a
guarded lookup. That guard is not decoration — state values are user data, a workflow may
legitimately contain a state called `constructor`, and
[[A user-named type read off Object.prototype]] is the bug that already happened to the
type table for exactly this reason.

`byTypeName`'s body moves to a `byName(table, name)` that all three tables share;
`byTypeName` stays as a one-line delegate rather than being renamed. The rename would be
tidier and would collide with the milestones branch in a file it is already editing; the
delegate costs three lines and collides with nothing.

`overLimit(settings, column)` sits here with the rest of the vocabulary's rules. It reads
`column.fullCount`, never `column.count`, per extension 4a: *a filter that made an
over-limit column look under its limit would turn a search into a lie about the work.*

**No write path imports it.** That is the cheapest possible enforcement of the guarantee —
*a limit never refuses a write* — because a planner that cannot see a limit cannot consult
one.

### 3. Rendering — `src/view/render/board.ts`

The header gains three things, each absent when unconfigured:

- **The limit.** A `.pbl-board-col-limit` span after the existing count span. Over the
  limit, the header takes `.pbl-board-col-over` **and** a `triangle-alert` icon — the
  criterion is a signal *in more than colour alone*, so it survives a colour-blind reader
  and a monochrome screenshot.
- **The policy affordance.** An `info` icon on a header whose state carries policy text,
  with `aria-describedby` pointing at that text, so assistive technology hears the policy
  as the column's description. No affordance at all when no policy is set: extension 1a
  is explicit that headers stay unchanged and nothing suggests a feature nobody asked for.
- **The spoken label.** `columnLabel` grows the limit clause, so the filtered pair count it
  already speaks becomes *"In review, 2 of 7 cards match, limit 5, over by 2"*.

The visual dense case is a filtered over-limit column, which reads `2 of 7 / 5`. It is
accepted rather than solved: the pair count is transient, the spoken label is unambiguous,
and a second layout for the intersection of two transient states is more surface than the
case earns. The smoke-test note below is where a live vault gets to disagree.

`showColumnMenu`, beside the existing `showItemMenu`: a `Menu` with the policy as its one
entry, opened from the header's `contextmenu`.

### 4. Keyboard — `src/view/interactions/keyboard.ts`

`keyboard.ts:248` already handles ContextMenu and Shift+F10 on the board, but its body
reads the selected **card** and does nothing on a column stop. It gains the column branch,
opening `showColumnMenu`.

No new tab stop. The board is one tab stop by design ([[Keyboard, menu and touch]]), and
[[Explicit policies on the column]] extension 3a says a per-column control would multiply
stops by columns. A context menu is not a tab stop; the column header is already the
listbox's active descendant.

## The one thing the specification gets amended

[[Explicit policies on the column]] says the policy is reachable *"from the column's context
menu — the same menu the selected column already offers for creation"*. That menu does not
exist. Cards have one (`render/board.ts:258`); columns have none, and the creation flow the
sentence refers to is [[New cards in place]], which is out of scope here.

This increment introduces the menu with the policy as its only entry, and the use case's
wording changes from *the menu the column already offers* to *the menu this use case
introduces*. [[New cards in place]] later hangs creation off the same shell.

## Testing

Node tests (`test/domain/`):

- The generated keys — that a configured state produces both options, that a done state
  produces only the policy, that no configured states produce neither, and that a state
  named `constructor` resolves to its own limit rather than something off the prototype.
- Limit parsing — empty, blank, zero, negative and non-numeric all mean unlimited, and a
  hand-edited fractional value does not become one.
- `overLimit` — unset is not zero, at the limit is not over, and the predicate reads
  `fullCount` while a filter narrows `count`.

jsdom tests (`test/view/`):

- The header: the limit span, the over-limit icon and class, the absence of every one of
  them unconfigured, and the spoken label in both the filtered and unfiltered cases.
- The affordance and `aria-describedby`, and the menu from both pointer and Shift+F10.

One invariant test, stated from the rule rather than from the implementation, in the shape
`test/view/contextCardWrites.test.ts` uses for the context-row rule: **every board write
path still applies with a column over its limit** — the drag, the Alt+arrow and the menu,
each driven against a board whose target column is already over. A fourth input added later
fails it without anyone predicting the surface.

Each new assertion is watched failing before the code that satisfies it is written, per the
project's own rule that a comment stating an invariant is not a check.

## Register work

| Note | Change |
| --- | --- |
| [[WIP limits]] | `Done`, with a real `## Where it lives` replacing *"Nothing yet — this note is design."* |
| [[Explicit policies on the column]] | `Done`; the menu sentence amended as above |
| [[Drag a card to a new state]] | `Done` — its last open criterion is now exercised |
| `Columns from the workflow` | Stays `Active` on [[Done columns stay lean]] |
| `docs/README.md` | The Product Kanban paragraph gains the fourth increment |

Two new notes:

- **An Issue, limitation accepted** — renaming a configured state orphans its limit and its
  policy silently. Bases options are declarative and there is no migration hook to read the
  old key from, so the alternatives are to accept it or to stop keying by name; keying by
  position would shuffle every limit when the workflow is reordered, which is worse and
  quieter. `What would lift it` names what an option-rename hook would have to offer.
- **An Issue, verification to run** — smoke test in a live vault: whether Bases regenerates
  its options menu when `stateValues` changes (jsdom cannot answer it, and a stale menu
  would mean a new state has no limit box until the view is reopened), and whether
  `2 of 7 / 5` reads as anything in a real header.

## Definition of done

`npm run check` passes — build, lint, coverage-thresholded tests, fallow, docs register —
on the branch `claude/next-increment-brainstorm-ev1n6l`, with the two smoke-test questions
above recorded as an Issue rather than claimed as verified.
