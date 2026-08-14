---
type: Issue
parent: "[[Codebase health]]"
order: 280
status: Open
priority: P2
area: architecture
created: 2026-08-10
source: maintainer request, 2026-08-10 — a follow-up pass after the user manual shipped
files:
  - src/view/interactions/dragDrop.ts
  - src/view/interactions/cardDrag.ts
  - src/view/interactions/timelineDrag.ts
  - src/view/interactions/linkDrag.ts
  - src/view/interactions/timelineLeadResize.ts
  - src/domain/dropTargets.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Three drag mechanisms, and a library that ships for one

## What is here now

Direct manipulation is 1749 lines across six modules, and they do not share a mechanism.
Counted by which API each one actually calls:

| Module | Lines | Mechanism |
| --- | --- | --- |
| `view/interactions/cardDrag.ts` | 556 | Pragmatic drag and drop |
| `view/interactions/timelineDrag.ts` | 421 | via `CardDragController` — no listeners of its own |
| `view/interactions/timelineLeadResize.ts` | 262 | pointer events |
| `view/interactions/dragDrop.ts` | 204 | native HTML5 drag events |
| `view/interactions/linkDrag.ts` | 192 | Pragmatic drag and drop |
| `domain/dropTargets.ts` | 114 | the pure zone/refusal rules both consume |

So: the tree drags with native `dragstart`/`dragover`/`dragend`, the cards and the link
drag with Atlassian's library, and the lead-column grip is raw pointer events. Three
answers to one question, in one directory.

`@atlaskit/pragmatic-drag-and-drop` and its two companions are **runtime dependencies**
— they ship in `main.js` to every user — and they serve the card projections while the
tree, the oldest and most-used drag surface in the plugin, does not touch them.

## This is not a new idea; it is a deferred decision coming due

[[Pragmatic drag and drop for the board]] chose the library on 2026-08-01 and said
plainly what it was **not** deciding:

> **The tree keeps its own drag code.** `view/interactions/dragDrop.ts` works and is
> covered; migrating it is a separate decision with its own evidence, after the board
> ships.

The board has shipped. So has the roadmap's writable timeline, and the card drag is now
shared across projections by `CardDragController`. The precondition that note named is
met, which makes this the moment it pointed at rather than a fresh proposal.

## Why it is worth a pass

- **A dependency that ships for part of the surface is the weakest version of the
  trade.** The bundle carries the library either way; today only some gestures get the
  accessibility and touch behaviour it was chosen for.
- **Touch is the open `P1`.** `isDesktopOnly: false` is a shipped claim and
  [[Smoke test the touch paths on a phone]] has never been run. Native HTML5 drag events
  are the mechanism the ecosystem evidence in that epic says have historically not fired
  from touch in Obsidian mobile's WebViews — and the tree is the surface still using
  them. Whatever the device says, it will say it about a tree and a board that differ.
- **The pure layer is already shared and already the right shape.** `dropTargets.ts` is
  114 lines of zone and refusal rules that both mechanisms consume. The split is in the
  wiring, not the rules, which is what makes this tractable rather than a rewrite.
- **Fallow has flagged the seam independently**: `domain/dropTargets.ts` is one of three
  refactoring targets, on 7 dependents, and `dragDrop.ts` carries a hotspot score of 26.2.

## What this issue does NOT claim

It does not claim the tree should migrate. That is the decision to make, with evidence,
and the honest arguments against are already on record: the tree's drag works, it is
covered, and [[Tree drag between siblings and into a parent]] is a
smoke test written against its current behaviour. Migrating a working, tested surface to
change no user-visible outcome is exactly the kind of pass this repository is usually
right to refuse.

What it claims is narrower: **three mechanisms for one interaction is a fact nobody
chose**, it arrived one increment at a time, and it should be either justified or
reduced deliberately rather than by accretion.

## Where to start

Not with code. With the question the earlier note deferred:

1. **Answer whether the tree's native drag fires from touch — and note that nothing in
   this register currently asks.** This step said "run [[Smoke test the touch paths on a
   phone]]" when the note was filed, which was wrong, and the way it was wrong is worth
   keeping: that note says in bold **"The drag verdict is not asked here"** and checks the
   context-menu fallback and the hover controls instead. [[Smoke test the board in a live
   vault]] does ask about drag on touch, but about the BOARD's — Pragmatic's element
   adapter — and records "whether drag ships on touch or stays menu-only" for that
   surface.

   So the tree's own drag on touch is **owned by no check**, on a plugin whose
   `manifest.json` says `isDesktopOnly: false`. That gap is a finding in its own right and
   is the reason this step comes first: it needs a verification that owns it before this
   decision can rest on an answer. If native drag does not fire from touch in Obsidian's
   mobile WebView, the tree's mechanism is a correctness problem rather than an
   inconsistency, and this whole note becomes a different and more urgent one.
2. Only then decide migration, with the cost stated: what the diff touches, which tests
   have to be rewritten against a new mechanism, and what a user would notice. If the
   answer is "nothing a user would notice", say so and weigh it honestly.
3. If migration is refused, record why here and close this note. An inconsistency that
   has been examined and kept is not debt.

## Acceptance criteria

- A verification that actually asks whether the TREE's native drag fires from touch
  exists, has been run, and its verdict is recorded. Satisfying this against
  [[Smoke test the touch paths on a phone]] does not count — that note excludes the drag
  verdict by design.
- A decision is written down — migrate, or keep three mechanisms with the reason — and
  this note closes either way.
- If migration happens, `domain/dropTargets.ts` stays the shared pure layer; the point of
  the pass is fewer wirings over one set of rules, not a new abstraction over both.
