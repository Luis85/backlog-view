---
type: PBI
parent: "[[An Iterations board]]"
order: 25
status: Done
priority: P3
created: 2026-08-16
source: user request
started: ""
finished: 2026-08-16
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Creating an iteration from the board

**As** someone running sprints, **I want** to make the next iteration and fix an existing
one from the board I am already looking at, **so that** starting a sprint is one dialog
rather than a new note, a type, two dates and a folder decided by hand each time.

The scope picker already names every iteration ([[A board scoped to one iteration]]), so
it is where a new one is made and the current one is edited. Two entries below the
scopes, one dialog behind both.

A new iteration's dates are **derived and then editable**. The previous iteration is the
one ending latest; the new one starts the day after it and runs for the configured
default length. Every field the dialog computes is a prefill: what it writes is what the
user confirmed, never a rule applied at write time that the reader could not see.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | `New iteration…` or `Edit iteration…` in the board's scope picker |
| **Preconditions** | Board mode. The scope picker is drawn, so the iteration property is configured. `Edit iteration…` additionally needs an iteration to be the chosen scope. The two date properties are **not** preconditions — see 3c |
| **Guarantee** | The create is one write, carrying the type, the folder, and every **configured** field together; the edit is one batch through the same gate as every other write. An unconfigured key is never written, and a field whose key is unconfigured is never shown. Nothing computed at write time — the dialog writes the values it showed. |

**Main flow**

1. In board mode the scope picker draws `New iteration…` below the scopes, and
   `Edit iteration…` above it while an iteration is chosen.
2. `New iteration…` opens a dialog with a name, a start date, a target date and a goal.
   The **name** is prefilled `<next index> - Iteration` — one past the highest numeric
   prefix any iteration already carries, so a folder of them sorts in the order they run
   (`Iteration` sorts beside `Iteration 10` and nowhere near `2 - Iteration`). Read off
   the NAMES rather than a count, so a vault that deleted Sprint 3 does not mint a second
   one. The dates are prefilled: **start** is the previous iteration's target **+ 1 day**, and
   **target** is start + `iterationLengthDays` **− 1**.
3. Confirming creates the note through the plugin's own creation path — typed
   `Iteration`, into the `iterations` subfolder the type declares, with both dates and the
   goal in the **same** write. The note is **named for what it is for**: the confirmed
   name, then the confirmed goal (`1 - Iteration - Ship the board`), so a folder of sprints
   says what each one was about without opening one. The goal is the name's **tail** — the
   numeric prefix is what makes the folder sort in the order they run, and a goal in front
   of it would break that. It is **not opened**: making a sprint is a planning act,
   and taking the reader off the board they are planning on is what opening it would cost.
   That reverses this step as written until 2026-08-16, when the argument for opening was
   that an iteration draws nowhere and would otherwise be a note to go and find — true,
   and outweighed. The scope picker names it either way.
4. `Edit iteration…` opens the same dialog on the chosen iteration, prefilled from it,
   with the name field absent (2c).
5. Confirming writes the dates and the goal to that note through `applySafely`, taken back
   by the one undo slot.
6. The board redraws: the goal line above the columns follows the new value
   ([[A board scoped to one iteration]]), and the scope picker keeps naming the iteration
   it named.

**Extensions**

- **1a — the previous iteration.** It is the `Iteration` note **in the model** with the
  greatest **target** date, ties broken by start and then by path, so the answer is total
  rather than merely usually unique. Not the iteration currently chosen in the picker:
  creating from Sprint 8 while Sprint 12 exists would silently make an iteration
  overlapping four others. Decided by the user on 2026-08-16.

  **In the model, not in the vault**, and the narrowing is deliberate rather than a
  shortcut. A base whose filter excludes an `Iteration` note leaves it out of the model
  entirely — a marker parents nothing, so it never even arrives as a context row — and the
  derivation would then follow an older, visible iteration and prefill dates overlapping
  the hidden one. That is a real limit and it is stated here rather than engineered away,
  for two reasons. It is the **same** limit the scope picker and `Set iteration` already
  have, both of which offer the iterations the model holds; a dialog reading the whole
  vault while the picker beside it reads the base would answer two different questions
  about one word. And a base that hides iterations hides the picker with them
  ([[A board scoped to one iteration]] extension 1a), so there is no `New iteration…`
  to reach in the case the wider read exists to serve.

  Reading the vault directly would be a new capability for this plugin, not a wider
  argument to an existing one. If a vault ever needs it, the thing to change is what the
  **base** shows.
- **1b — no `Iteration` note in the vault carries a target date** (there are none at all,
  or none is dated). **Start prefills to today**, and target follows from the length. A
  first sprint has no predecessor, and refusing to prefill would make the empty vault the
  one case where the feature does nothing — which is the vault most in need of it.
- **1c — `iterationLengthDays` is unset, unparseable, or not positive.** It falls back to
  **14**. Bases offers no number option, so this is a `text` option parsed to a whole
  number the way the WIP limits already are, and a text field can hold anything. Falling
  back is not politeness: a zero or a negative length produces a target before its start,
  which shelves the iteration with the reversed-span reason
  ([[An iteration draws as a bar or a line]] extension 4b) for a value the user never
  meant to enter.
- **1d — the previous iteration has a target but no start.** It is still the previous one
  and the derivation is unchanged: the new start is that target + 1 day. The rule reads
  the end an iteration is followed from, never both ends, so a half-dated predecessor
  costs nothing.
- **2a — the user edits the prefilled dates.** The dialog writes what the user confirmed.
  Every prefill is a prefill, and nothing recomputes a date on the way to the write — a
  computed value the reader can see and change is a suggestion, and one they cannot is a
  rule they will eventually have to fight.
- **2b — the confirmed target precedes the confirmed start.** The dialog refuses to
  confirm and says so, rather than writing an iteration nothing can draw. This is the one
  validation, and it is here rather than at the write because the write path already has
  the honest answer for a reversed span — shelve it — and a dialog that produced one on
  purpose would be a control that creates the thing the roadmap has to apologise for.
- **2c — the name.** It is on the **create** path only. `Edit iteration…` shows no name
  field: an iteration's name is its note's name, Obsidian renames notes better than a
  plugin dialog can, and the stored scope already follows a rename
  ([[A board scoped to one iteration]] extension 2e). A rename path here would be a
  second, worse spelling of something that already works. A refusal to re-propose, not an
  omission.
- **2d — the name collides with an existing note.** The creation path's own answer holds,
  unchanged and unrestated: this dialog creates notes the way every other creation
  surface does ([[Creating items]]).
- **2e — the goal names the note.** The goal is appended to the confirmed name, never
  substituted for it, and it is **sanitized like every other title** — it becomes a file
  name through `sanitizeTitle`, the one place a title becomes a path, so a goal holding
  `/` or `#` costs a character rather than a failed create. It is also **capped**: a goal
  is free text and a file name is not, so only the first 60 characters reach the name. The
  frontmatter still carries the goal in full — the name is a label, not the value.
- **3a — the goal is left empty.** The name is exactly what was typed, with no trailing
  separator, by 2e's rule and not a second one. Nothing is written under the goal key, and the board
  draws no goal line — never an empty one and never a placeholder inviting a value.
  Clearing a goal that was set removes the key.
- **3b — the goal property is unconfigured.** The field is absent from the dialog. An
  unconfigured key is never written, so offering a field whose value has nowhere to go
  would be a control that discards what it collects.
- **3c — a date property is unconfigured.** That field is absent too, by **3b's rule and
  not a second one**: a field whose key has nowhere to go is a control that discards what
  it collects, whichever property it belongs to. With neither date property configured the
  dialog is a name and a goal, and the action is **not gated** — an `Iteration` note with
  no timeframe is a coherent thing to make, and it stamps nothing on its members for the
  reason [[An iteration's timeframe schedules its items]] extension 2b already gives.

  This is stated because the three sentences around it pulled apart. The preconditions
  admit the dialog on the iteration property alone; `startKey` and `targetKey` default to
  empty; and the guarantee promised both dates were written. An implementer reading all
  three had to choose between silently dropping a value the user typed and writing an
  unconfigured key — and the second breaks the rule every write path in this plugin keeps.
  Removing the field removes the choice: there is no confirmed value to drop, because
  there was nothing to type it into.

  1c's fallback is unaffected. `iterationLengthDays` is a length, not a date property, so
  it still resolves — it simply has no target field to fill.
- **4a — `Edit iteration…` while the scope is `Product`.** It is not offered. There is
  nothing to edit, and offering it would need a second picker inside the dialog to say
  which iteration — a control inside a control, to replace the one the user already used.
- **4b — an iteration's dates are edited and it already holds items.** **Nothing is
  re-stamped.** The write goes to the iteration note alone, and its members keep the dates
  [[An iteration's timeframe schedules its items]] gave them. Decided by the user on
  2026-08-16 against re-stamping every member in the same batch.

  The consequence is real and is accepted rather than hidden: after an edit an iteration
  can disagree with its own members, and no screen says so. What makes it liveable is that
  re-picking the iteration on an item re-applies the timeframe (that note's extension 3a),
  so the recovery exists and is one action per item. What would make it a defect is a bulk
  write nobody asked for, from a date field, over notes not on screen — forty items
  rewritten by a keystroke, with one undo slot between the user and a batch they cannot
  see. If the drift proves to matter, the thing to build is a way to **see** it, not a
  write to prevent it.
- **4c — the edited iteration is the chosen scope and its dates move it out of the base.**
  The board falls back exactly as [[A board scoped to one iteration]] extension 2a
  requires, and the stored scope is retained rather than rewritten. This write is not
  special; it is a write like any other, and it can take its own subject out of the base
  like any other.
- **5a — the iteration property is configured but no `Iteration` note exists.** The scope
  picker does not render (that note's extension 1a), so neither entry is reachable — and
  the vault with nothing to iterate is exactly the one that wants `New iteration…`. This
  is a **known gap**, stated rather than solved: the first iteration in a vault is created
  the way every other note is, or through the item creation menus the type already appears
  in ([[Creating items]]). Making the picker render for its two actions alone is a
  different control with a different argument behind it, and nothing has asked for one.

## Acceptance criteria

- The board's scope picker offers `New iteration…`, and `Edit iteration…` only while an
  iteration is the chosen scope.
- `New iteration…` prefills start to the greatest-target iteration's target + 1 day, and
  target to start + `iterationLengthDays` − 1 — checked with several iterations, with
  ties, with a predecessor that has no start, and with no dated iteration at all, where
  start is today. The candidates are the model's iterations, the same set the scope picker
  offers, checked by asserting that an `Iteration` the base excludes is not the
  predecessor.
- `iterationLengthDays` is a view option in the `Iterations` group, default 14, parsed
  from text, falling back to 14 when it is unset, unparseable or not positive.
- The prefilled dates are editable and what is confirmed is what is written; a confirmed
  target before its start is refused by the dialog.
- Creating writes the type, the folder, both dates and the goal in **one** create, and
  opens the note — never a create followed by a second write.
- Editing writes the dates and the goal to the iteration note **alone**, through
  `applySafely`, taken back by the one undo slot, and **no item is re-stamped** — checked
  by editing an iteration holding several members and asserting the batch names one file.
- The name field is on the create path only; nothing here renames a note.
- The created note is named `<name> - <goal>`, with the goal sanitized into the file name
  and capped — checked with a goal holding characters a path cannot hold, with a blank
  goal, where the name is unchanged, and over the cap in `iterationNoteName`.
- A field whose property is unconfigured is **absent from the dialog** — checked for the
  goal and for each date separately, and with all three unset, where the dialog is a name
  alone and the action still works. No unconfigured key is ever written on either path.
- With the goal empty nothing is written and the board draws no goal line.

## Where it lives

The dialog is `IterationPromptModal` in `src/ui/prompts.ts` — **not a module of its own**,
which is what this section said until it was built. `src/ui/` is still the leaf that knows
about no layer, and that is the part the argument rested on; what changed is that
`prompts.ts` already holds `PromptModal` and `refusableBody` — the base class, the
description line, the refusal box that keeps the entry in place, and the Enter-to-submit
wiring — and had ninety counted lines of headroom. A new module would have re-exported
those or copied them. `AbsencePromptModal` beside it is the same shape for the same reason:
one form for making and for editing, because the validator and the field list are the same
questions whether the note exists yet or not.

The derivation IS a module of its own, `src/domain/iterations.ts`: the previous-iteration
rule, the two date sums and the note name a confirmed name and goal compose into, reading the model's items and the settings, so they are
answered by a function rather than by a screen. The actions that open the dialog are
`promptNewIteration` and `promptEditIteration` in `src/view/interactions/create.ts` — the
module that already owns every gated creation flow — and both run `configProblems` before
opening rather than at submit.

`iterationLengthDays` option is declared in `src/domain/viewOptions.ts` and resolved in
`src/domain/settings.ts`. The two picker entries are drawn in
`src/view/render/toolbarControls.ts`, where the scope picker itself is. Creating goes
through `createBacklogItem` in `src/storage/createNote.ts` by way of
`src/view/interactions/create.ts`; editing is planned in `src/domain/writePlan.ts` and
applied by `src/storage/frontmatter.ts` through `src/view/writeGate.ts`. Driven in
`test/domain/iterationSchedule.test.ts` for the derivation and
`test/view/iterationDialog.test.ts` for the two picker entries, both write shapes and the
one-file guarantee on the edit.
