---
type: PBI
parent: "[[The prioritized list]]"
order: 40
status: Done
created: 2026-08-22
source: interview, 2026-08-22
started: ""
finished: 2026-08-22
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Opening the note being scored

**As** someone scoring an item against its rubric, **I want** to open that item's own note
from the panel, **so that** the confidence I record is checked against the evidence rather
than asserted.

Confidence is the dimension that says how much the value estimate is worth — assumption
through validated evidence — and the evidence it grades is prose in the note: the
rationale, the research, the links. The panel says what the model asks; only the note says
what the team knows. Today reaching that note costs a trip through the file explorer and a
return journey that loses the selection, so the point gets picked from the rubric sentence
alone and the confidence beside it is asserted rather than checked. That makes the one
number describing how much the estimate is worth the least trustworthy number in the view.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever is scoring an item in the estimation view |
| **Trigger** | The Open note control in the panel's sticky header, or `Enter` on the selected row |
| **Preconditions** | A row is selected, so the panel is on screen |
| **Guarantee** | Exactly the note the panel is showing opens — resolved at activation against the current model — or none does. Opening writes nothing: no frontmatter, no view configuration, and the undo slot is left as it was found. |

**Main flow**

1. The reader selects a row. The panel draws with the item's name and, beside it in the
   sticky header, the Open note control.
2. The reader scrolls down the dimensions and reaches one the rubric sentence alone cannot
   answer.
3. The reader activates Open note.
4. The note opens where this view's `Open in` says — by default beside the table, not over
   it.
5. The reader reads the evidence, picks the point, and the panel is where they left it.

**Extensions**

- **3a — the activation carries the platform's modifier.** `Ctrl`/`Cmd` opens a new tab
  whatever `Open in` says. Obsidian's own gesture outranks a view's preference, and a
  reader who asked for a tab has asked for one everywhere else in the app.
- **3b — the item has left the base since the panel drew.** A Bases pass can remove the
  selected row between the draw and the click. Nothing opens — never the note that now
  occupies that position — because the control resolves the item by path against the
  current model at activation, not from a value captured when the panel was built. A
  control that opened *something* would be worse than one that opened nothing: the reader
  is about to score whatever they read.
- **4a — `Open in` is `split`.** The view's own leaf is pinned, so a later open cannot
  replace the surface being scored on, and every subsequent open reuses that one side pane
  rather than splitting again. Best effort where the base is embedded in a note, and
  nothing ever unpins: a pin is the reader's own workspace state and this cannot tell its
  own from theirs.
- **4b — the reader used `Enter` on the row instead.** The same controller, the same
  target, the same pane. [[Ranking the items by value]] owns *that* `Enter` opens the
  selected note and that nothing selected opens nothing; this use case owns *where* it
  lands. One idea of opening, reachable two ways — not two ideas, one of which replaces the
  view.

## Acceptance criteria

- The panel's sticky header carries an Open note control, reachable by keyboard and
  carrying an accessible name.
- Both the control and the row's `Enter` open through the shared open controller, and no
  direct workspace-leaf call remains anywhere under `view/estimation/`.
- The estimation view offers `Open in` with the same three targets the backlog view offers,
  and it defaults to the one that opens beside the view rather than over it.
- With that default, the view's leaf is pinned and a second open reuses the same side pane
  instead of splitting again.
- An activation carrying the platform modifier opens a new tab whatever the setting says.
- An activation on an item that has left the base opens nothing, and opens no other note.
- Opening writes nothing: no property write, no configuration set, and `canUndo` reports
  what it reported before.

## Where it lives

`src/view/estimation/panel.ts` draws the control in the header it already builds, and
`src/view/estimation/renderTable.ts` gives up its own idea of opening — the `Enter` branch
calls the same controller. `src/view/estimation/estimationView.ts` owns the controller
instance and is what satisfies its context, the same way `backlogView.ts` does.

`src/view/openTarget.ts` is reused rather than copied, and reuse has one cost worth stating
before it is discovered: it takes a `BacklogItem` today and only ever reads that item's
file, so the parameter narrows to what it uses. That is a change to a module the backlog
view depends on, not a new one beside it.

`src/domain/itemHandling.ts` owns the target vocabulary and reads the option; the two views
want different defaults, since a tree is something you leave and a scoring panel is
something you come back to between every point. `src/domain/estimationOptions.ts` gains the
box.

Tests: `test/view/estimation/` for the control, the keyboard path, the modifier, the
vanished item and the write-nothing guarantee; `test/domain/` for the option's default and
its resolution.
