---
type: Test case
order: 50
parent: "[[Smoke test the board]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-30
source: Decomposition of [[New cards in place]]
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
dependsOn:
  - "[[Creating a card in a column's state]]"
  - "[[Creation from the column's three inputs]]"
---

# Creating a card in a column

A verification to run.

## Why this exists

[[New cards in place]] main flow step 4 — *"the next render places its card in that
column"* — is the one step of that use case jsdom cannot answer. The harness has no
Bases, so nothing there can say whether a real query returns the new note, whether it
returns it in time to be the next render, or where folder mode actually put it. jsdom
asserts the write; only a vault asserts the placement.

The touch half is the same shape as the verdict [[Keyboard, menu and touch]] left to a
device: whether the column header's `+` is reachable by thumb is not a claim the
stylesheet can settle here.

**Extensions 4a and 4b are deliberately not checked here.** The prescribed base carries
no filter on the state property and sets `showCompleted: true`, so neither condition can
arise in it — but adding that configuration would only prove the *absence* the register
already records: the mechanism that reports a created-but-hidden note is unbuilt, owned
by [[Which pass answers a write]], and blocked on a rule nobody has decided. A step
asserting a report that cannot appear would fail by design rather than find anything.
This case gains those steps in the same change that builds the mechanism. Scope stated
after review (Codex, PR #225) asked for the steps.

This case cannot run until both Tasks under [[New cards in place]] have shipped, so it
declares them in `dependsOn` rather than only in the preconditions below: a check whose
subject does not exist yet is not ready, and readiness is what that property answers.

**Preconditions** — `npm run test-build` has installed the plugin into this repository,
this repository is open as a vault, `docs/Product Backlog.base` is open in board mode,
and **no focus level is active** — clear it from the toolbar before starting. The focus
level is per-device UI state in localStorage rather than a `.base` setting, so a vault
can arrive carrying one, and the two this decomposition discusses are exactly the ones
that break the setup below: under a retained `Iteration` or `Deliverable` focus the
seeded item is outside `model.results`, `requirementsWorkflow` never observes its state,
and the stray column step 6 needs is not drawn at all. Found by review (Codex, PR #225).

**Setup, and why it is needed.** That base configures `stateValues: Open, Active, Done`
and every one of the three holds notes, so **the vault has no empty column to test with,
and no stray column either**. Two things to add before starting:

- Two throwaway states — `Blocked, Waiting` — on `stateValues`, so steps 2 and 5 each get
  their own genuinely empty column rather than the second finding the first already
  filled.
- One throwaway **work item** carrying an undeclared state — a `Task` under any `PBI`
  with `status: Parked` — which is what draws the stray column step 6 needs. The vault's
  own `Accepted`, `Superseded` and `Proposed` notes do **not** draw one: all 31 of them
  are ADRs in `docs/adrs/`, and an ADR carries no `type` and no `parent` on purpose, so
  `pruneOutsideHierarchy` removes it before `requirementsWorkflow` collects the observed
  states. Counting the statuses in `docs/` and concluding otherwise is the mistake this
  sentence exists to stop — the question is which notes are *work items*, never which
  files hold the value. Found by review (Codex, PR #225).

**Restore afterwards**: remove `Blocked, Waiting` from `stateValues`, set
`inferFolderHierarchy` back to where you found it, and delete the `Parked` note and
everything created below.

## How to check

1. Press the `+` on a column whose state holds cards already. Give the note a title.
   Watch the next render.
2. Repeat on `Blocked`, which holds none.
3. Repeat on the leading no-state column, then open the created note and read its
   frontmatter.
4. Repeat step 1 from the column's context menu.
5. With the keyboard: select the still-empty `Waiting` column and press Enter. (Its own
   column, because step 2 filled `Blocked` — a toggle cannot un-fill it.)
6. Look at the `Parked` column the seeded item drew: it should offer no creation by any
   of the three paths, while still accepting a dropped card. **Drop one of the throwaway
   cards created above, never a real one** — removing `Parked` from `stateValues` at the
   end would otherwise leave a genuine item carrying an undeclared state, and the stray
   column it draws would outlive the test.
7. **Folder placement, one fresh note per mode.** Folder mode is read *when the note is
   created* and relocates nothing afterwards, so this cannot be checked by toggling and
   re-reading the notes above. The option is **`inferFolderHierarchy`** in the `.base`,
   shown in the options UI as *"Infer hierarchy from folder notes"* — not
   `folderHierarchy`, which is only what `resolveSettings` calls it internally, and
   editing that name changes nothing.

   **Each mode needs a control, not the other mode.** With it off, create one note from a
   column *and* one from the toolbar's **New** — the existing flow the criterion names —
   and check they landed in the same folder. Turn it on and do both again. Comparing the
   two column-created notes to each other proves only that the column path is consistent
   with itself: both could land in the wrong folder, in both modes, and the comparison
   would still look right. Found by review (Codex, PR #225).
8. On a phone or tablet, try the `+` and the menu entry.

## Acceptance criteria

- Each created note appears as a card in the column it was created from, on the next
  render rather than after a manual refresh.
- The note created from the no-state column carries no state key at all — not an empty
  value.
- In each folder mode, the note created from a column lands in the same folder as one
  created from the toolbar in that same mode — the column changes its state and nothing
  else about its placement. Checked against that control in each mode, never against the
  other mode's column note.
- The menu and keyboard paths create the same note the `+` does, in the same column.
- A stray column — one whose value `stateValues` does not name — offers creation by none
  of the three paths, and still takes a drop ([[New cards in place]] extension 1b).
- The `+` and the menu entry are usable on touch, or the failure is recorded here.

## Outcome
