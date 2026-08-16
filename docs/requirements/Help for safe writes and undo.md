---
type: PBI
parent: "[[User manual]]"
order: 50
status: Done
priority: P2
created: 2026-08-01
files:
  - src/view/writeGate.ts
  - src/storage/frontmatter.ts
  - src/domain/settings.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-09
due: 2026-08-10
risk: ""
assignee: ""
---

# Help for safe writes and undo

**As** someone whose notes are the data, **I want** to know exactly which properties this
view edits and how to take a change back, **so that** I can drag things around without
wondering what it did to files I care about.

The view edits real files with no save step and no confirmation dialog, so this is the
section that decides whether a new user trusts it.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Opening the manual on the writes section, from the **?** button or from the write-in-flight indicator |
| **Preconditions** | A `product-backlog` view is open |
| **Guarantee** | Every write the section describes is one the view plans and applies through its single write boundary, and every one of them is offered back through undo — with undo's own two limits stated rather than glossed. |

**Main flow**

1. The section names the properties the view maintains: `parent`, `order` and `type`, plus
   the state and tags properties you configure. Nothing else in a note is touched, and the
   note stays an ordinary note.
2. It says how to take a change back: **↩** in the toolbar or <kbd>Ctrl/Cmd</kbd>+<kbd>Z</kbd>
   in the tree, again to redo, however many notes the change touched. One level, per view
   and per session; a no-op does not spend it.
3. It states what undo does with a note that moved on: it restores rather than overwrites,
   so a property edited by hand in the meantime is kept and a deleted note is skipped, with
   a notice when either happened.
4. It states the two boundaries on writing: a forward batch naming a note the Base excluded
   is refused **before any of it is written**, and a misconfigured view writes nothing at
   all until the configuration is valid.
5. The reader leaves knowing which changes are reversible, which are not, and what
   "refused" means when they see it.

**Extensions**

- **1a — no state or tags property is configured.** Those writes are dropped rather than
  written to an empty key, so the section describes the properties actually in play for
  the reader's configuration.
- **2a — the change was a creation.** Undo never deletes a note, so a new item stays, and
  the slot still points at the last property change from before it. Delete the note to
  take a creation back.
- **3a — the batch failed partway.** Files are written one at a time, so a change touching
  many notes can stop halfway. What landed is captured in the undo slot, so taking it back
  is one press — with the same two limits from step 3. The applied prefix is not promised
  *visible*: a write can move an item out of the Base's filter, and the refresh that
  follows the failure will then drop it from the tree.
- **4a — undo has to write outside the filter.** It may, deliberately: the change being
  undone is often what moved the note out (marking a parent done in a base that hides done
  items). Undo's authorization came at capture time — it can only name files its own
  forward batch wrote while they were results. The rule both paths keep is *never write to
  a note you could not have acted on*, which is not the same as *never write outside the
  filter*.
- **4b — the view is misconfigured.** `Check view options` in the toolbar means the write
  gate is closed, so the section explains a view that appears to ignore every gesture.

## Acceptance criteria

- The three properties are named explicitly, because "it edits your notes" without a list
  is exactly the sentence that stops someone from trying a plugin.
- Undo is described with its two limits — one level, and creation — rather than as an
  unbounded history.
- The whole-batch refusal is scoped to what it actually guarantees — a batch **rejected
  before writing** — and is not written as atomicity. `applyWrites` writes sequentially
  and a mid-batch failure keeps the applied prefix, so the section says so and points at
  undo rather than promising all-or-nothing. Nor is the prefix promised to be *visible*:
  a write can move an item out of the Base's filter, and the refresh that follows the
  failure will then drop it from the tree.
- The never-writes-outside-the-filter rule is stated of **forward batches**, with undo's
  capture-time authorization stated beside it, so the section does not contradict
  [[Help for finding work]] on what may touch a context row.
- The section is reachable from the busy indicator, the moment the user is already asking
  what the view is doing to their files while a batch is in flight.
- The `Check view options` warning does NOT open here. It was claimed by two use cases —
  this one and [[Help for setting up the view]] — and the register settled it on the
  configuration section: the reader's question at a warning is what to fix, not what the
  view writes, so the door belongs with the options rather than with this section.

## Where it lives

`src/view/manual/sections.ts` — the writes section's own entries. The behaviour it
describes is `src/storage/frontmatter.ts` (the only module that writes, and where each
write's inverse is captured), `src/view/writeGate.ts` (`applySafely`, `undoLast` and the
gate they share, including undo's deliberate lack of a replay-time filter check),
`src/domain/settingsConsistency.ts` (`configProblems`, which is what "misconfigured" means
concretely), and `src/view/render/toolbarBusy.ts` (the write-in-flight indicator's own door
into this section — the config warning's door is [[Help for setting up the view]]'s to
describe, not this note's).
