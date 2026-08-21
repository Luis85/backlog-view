---
type: PBI
parent: "[[Trying a scope change]]"
order: 10
status: Open
created: 2026-08-21
source: user request — release management concept refinement, 2026-08-21
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Proposing a scope change

**As** someone deciding what ships, **I want** to add and remove items from a release on
screen and see what it would do, **so that** "what if we cut this" is answered before anything
in the vault changes.

Nothing yet. The proposed membership is view state beside the real one; committing it is one
batch of the same writes [[Setting an item's release]] plans.

## Use case

| | |
| --- | --- |
| **Actor** | Someone deciding what ships |
| **Trigger** | Adding or removing an item while a release is open |
| **Preconditions** | The membership property is configured and a release is open |
| **Guarantee** | While a scenario is on screen the vault is untouched, and the screen says so. Committing writes every difference in one gated, undoable batch; discarding writes nothing at all. |

**Main flow**

1. The user adds an item to, or removes one from, the open release.
2. The view holds that as a proposed membership beside the real one, and marks the screen as
   showing a scenario.
3. It shows capacity, value, risk and dependency impact as the pair *now → if applied*.
4. The user commits, and one batch writes every difference to the items' own membership
   properties.
5. Undo takes the whole batch back.

**Extensions**

- **1a — an item is added and then removed again.** It is not a difference and contributes no
  write; a scenario that ends where it started commits nothing and does not spend the undo
  slot.
- **1b — an item outside the Base's filter is named.** It cannot be added or removed, and a
  batch naming it is refused whole.
- **2a — the view is closed, or the release is changed, with a scenario open.** The scenario is
  discarded and nothing is written. It is a proposal, not a draft the plugin keeps.
- **3a — the value stamp key is unconfigured.** The value impact is not shown at all;
  capacity, risk and dependency still answer, and the missing one is named.
- **3b — the members' values carry different model fingerprints.** Values are averaged per
  fingerprint and never across, because a 4 from a 1–5 model and an 8 from a 0–10 model have
  no average between them. Unstamped values are reported as unattributed.
- **3c — a risk or dependency predicate is unconfigured.** That impact is absent and named, the
  same answer [[Summing up a release]] gives, and computed by the same predicate rather than a
  second one here.
- **4a — the batch is refused by the gate** — a configuration problem, or an excluded item. The
  scenario stays on screen exactly as it was, so the work of composing it is not lost to a
  refusal.
- **5a — a later write lands before the undo.** Undo only ever takes back the last effective
  batch; the scenario's batch is one, so it is taken back whole or not at all.

## Acceptance criteria

- With a scenario on screen, no write is planned and the screen states that a scenario is on
  it.
- Every impact figure is the release summary's own figure recomputed over the proposed scope —
  a fixture where the scenario changes nothing shows *now* and *if applied* equal.
- Committing produces one batch containing exactly the differences, and undo takes it back
  whole.
- A scenario that returns to the original membership commits nothing.
- Discarding a scenario, and closing the view with one open, both write nothing.
- Value impact is averaged per model fingerprint, never summed, and is absent when the stamp
  key is unconfigured.

## Where it lives

The proposed membership is view state in `src/view/viewState.ts` through
`src/view/viewStateController.ts`, never persisted as a `.base` setting. The impacts are the
summary's own derivations in the new `src/domain/` module, called a second time over the
proposed set. The commit is planned in `src/domain/writePlan.ts` and applied through
`src/view/writeGate.ts` by the **same file-backed release-link write**
[[Setting an item's release]] specifies — the plan carries each target `TFile` and
`src/storage/frontmatter.ts` spells it with `wikilinkTo`, never as a plain label. A scenario
that serialized membership a second way could commit a different release from the one it
showed, which is the one thing a scenario may not do.
