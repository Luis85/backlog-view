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
| **Guarantee** | Every row whose own membership property names this release is a member; every other row on screen is context. **Membership is one release** — the property holds a single value. It never cascades to a parent or a child, and drawing the scope writes nothing. |

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
- **1c — the property holds several values.** The item is reported among the items whose
  membership could not be resolved, exactly as 1b, and is a member of none of them. Reading it
  as membership of each would make every writer in this epic destructive: both
  [[Setting an item's release]] and [[Moving a card between slices]] write one value and
  remove the key to clear it, so a second release assigned would silently discard the first,
  and one removal would discard them all. A list-preserving membership is a different feature
  with a different write shape; it is not this one wearing a tolerant reader.
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
- An item whose membership property holds two values is reported as unresolved and counts
  towards no release's member total.
- With the membership property unconfigured, no tree is drawn and the empty state names the
  option.
- Drawing the scope plans no write.

## Where it lives

The membership read is `src/domain/releases.ts`, beside `src/domain/board.ts` and
`src/domain/roadmap.ts` and shaped like them — it derives from the model in
`src/domain/model.ts` and touches no DOM. The membership key is declared in
`src/domain/releaseOptions.ts`, this view's own option set, and the screen that draws the tree
is `src/view/release/releaseView.ts`, which chooses between this scope and the index.

This note said the rows reuse `src/view/render/rows.ts` and the context marking already there.
They do not, and cannot: that module takes a `BacklogViewHost` and wires menus, create prompts,
tag removal and drag into every row — every one of them a write this screen does not offer — so
reusing it would make a read-only view satisfy a host interface in order to withhold what the
interface is for. The rows are drawn by `src/view/release/renderScope.ts` instead — the header,
the read-only tree and both empty states — reusing the stylesheet (`styles/release.css`),
`badgeStyleFor` from `src/view/render/badges.ts` and `guidanceShell` from
`src/view/render/emptyStates.ts`, which is the same reuse the estimation view settled on.

**What declining that module COSTS is the semantics, not only the wiring.** `rows.ts` already
carries `role="tree"`, `role="treeitem"`, `aria-level`, `aria-posinset` and `aria-setsize`, so
`renderScope.ts` carries them itself: `--pbl-depth` moves a row sideways and announces nothing,
and a scope drawn with indent alone is a flat list of divs on the one screen whose whole promise
is the shape of the work. Two attributes `rows.ts` sets are deliberately absent — `aria-selected`
describes a selection this screen does not have and `aria-expanded` a collapse it does not offer.
The context marker reuses `.pbl-outside-marker`'s STYLING and none of its sentence: that one says
a row is outside the base's filter, which is false of every row here, since `releaseScope` skips
an `outsideFilter` ancestor outright rather than keeping it as context.
