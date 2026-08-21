---
type: PBI
parent: "[[What is in a release]]"
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

# The scope of a release as a tree

**As** someone deciding what ships, **I want** the release's scope drawn as the tree it
already is, **so that** I can see the shape of the work rather than a flat list of rows that
lost it.

Nothing yet. The work reuses the row rendering the backlog already does, over a population
selected by one property instead of by the whole result set.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading a release |
| **Trigger** | Opening a release from the index |
| **Preconditions** | The membership property is configured and a release is open |
| **Guarantee** | Every row whose own membership property names this release is a member; every other row on screen is context. Membership never cascades to a parent or a child, and drawing the scope writes nothing. |

**Main flow**

1. The view collects the notes whose own membership property names the open release.
2. It draws each in its place in the hierarchy, at whatever level it sits.
3. Where a member's ancestor is not itself a member, the ancestor is drawn above it, marked as
   context and carrying no numbers.
4. The count of members is stated, and it is the denominator every other figure in this view
   uses.

**Extensions**

- **1a — the membership property is not configured.** No scope can be read; the empty state
  says which option to bind, and no tree is drawn.
- **1b — the property holds a link to a note that is not a release.** The item is not a member
  of anything and is reported among the items whose membership could not be resolved, rather
  than silently dropped.
- **1c — the property holds several values.** The item is a member of each release it names.
  A release is a set, not a rung, so nothing here forces one.
- **2a — a member's ancestor is missing from the results entirely.** The member is drawn at the
  top level rather than hidden, the same answer the backlog gives an orphan.
- **3a — an ancestor drawn as context is itself in another release.** It is still context here:
  membership is per release, and a row's context status is about the release on screen.
- **3b — a context ancestor's own state would hide it.** It is drawn regardless: it is
  scaffolding for a member, and hiding it would break the member's place.
- **4a — the release has no members.** The tree is empty and says so, naming the release. An
  empty release is a legitimate state, not a misconfiguration.

## Acceptance criteria

- A Feature in the release whose Epic is not appears under that Epic, and the Epic is marked
  as context, carries no count, and is not written to by any action on this screen.
- The member count equals the number of notes whose own property names the release — no
  ancestor and no descendant is added to it.
- An item whose membership names a note that is not a release is reported, not dropped.
- With the membership property unconfigured, no tree is drawn and the empty state names the
  option.
- Drawing the scope plans no write.

## Where it lives

The membership read is a new derivation in `src/domain/`, beside `src/domain/board.ts` and
`src/domain/roadmap.ts` and shaped like them — it derives from the model in
`src/domain/model.ts` and touches no DOM. The rows reuse `src/view/render/rows.ts` and the
context marking already there; the empty state is in `src/view/render/emptyStates.ts` and the
membership key is declared in `src/domain/viewOptions.ts`.
