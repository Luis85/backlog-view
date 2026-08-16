---
type: PBI
parent: "[[Guides that describe rather than enumerate]]"
order: 20
status: Done
area: docs
created: 2026-08-03
closed: 2026-08-03
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-03
risk: ""
assignee: ""
---

# A guide is prose, not an inventory

**As** someone meeting this codebase for the first time — a contributor or an agent —
**I want** the guide I read first to describe the layers rather than list the files,
**so that** what I read is still true after the tree beneath it has moved.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever is reading or changing the plugin |
| **Trigger** | Opening `CLAUDE.md`, or adding, splitting or renaming a module |
| **Preconditions** | None |
| **Guarantee** | Nothing a guide claims about the code can go stale without a check noticing — because guides stop making the kind of claim that goes stale silently. |

**Main flow**

1. The root `CLAUDE.md`'s module table is deleted.
2. In its place, prose says what each layer is for and which invariants live where,
   naming a module only where the sentence is *about* that module — the shape the four
   layer guides already use.
3. A contributor who needs the module list reads `src/` itself, or the use case that
   specifies the behaviour they are changing.
4. `npm run check` passes, and no new gate was added to make it pass.

**Extensions**

- **1a — the table is the only place a fact is written.** It is not, and that is what makes
  the deletion safe rather than lossy: `docs-check.mjs` rule 7 already asserts every module
  in `src/` is named by a note, which is how the missing `src/domain/vocabulary.ts` was
  findable at all. The table was a second copy of a checked fact. **Do not delete it before
  [[A module is named where it is specified]] has given that rule a reason of its own.**
- **1b — the answer is to gate the table instead.** Rejected. Gating a duplicate is more
  machinery than deleting it, and the duplicate would still have to be edited on every
  split. [[Check that a feature lists its use cases]] retired a hand-written second copy of
  a link for the same reason, after two branches disagreed about it without either saying so.
- **2a — a table states a rule rather than enumerating code.** It stays. `docs/README.md`'s
  conventions, the parent/child pairs and the note-kind table are all of this kind: a code
  change cannot falsify them. **The distinction is the deliverable of this note** — a table
  that enumerates code goes stale, a table that states a rule does not — and it belongs
  written down, or the next person deletes the wrong ones.
- **2b — the layer guides look like they need the same treatment.** They do not. Measured
  before touching anything: `src/domain/`, `src/storage/`, `src/view/` and `test/` carry
  **zero** table rows between them and are already prose stating rules. All 57 rows are in
  the root file. Editing them would be churn, and [[Invariants as checks, not conventions]]
  step 4 already decided their shape.
- **3a — `docs/README.md`'s folder table is wrong too.** It is: six folders listed and
  `docs/milestones/` missing though the prose names it. Short enough to be worth keeping
  accurate rather than deleting — it describes the register's own layout, not the code.

## Acceptance criteria

- The root `CLAUDE.md` contains no table enumerating modules, and no other guide gains one.
- The layer guides under `src/` are untouched by this change.
- `docs/README.md`'s folder table lists every folder under `docs/`, `milestones/` included.
- The rule *a table that enumerates code goes stale; a table that states a rule does not*
  is written down where someone deleting a table will read it.
- `npm run check` passes with no gate added.

## Where it lives

`CLAUDE.md` · `docs/README.md`

**The four layer guides are deliberately not listed**, though extension 2b measured them.
Since [[A module is named where it is specified]], a path in this section is a claim that
this use case specifies that file — and this note's own criterion is that the layer guides
are *untouched* by it. A note cannot disclaim ownership in its criteria and claim it here.
They are named in the extension instead, where the sentence is about them; that they are
`.md` and so outside rule 7 is why nothing failed, not why it was right.
