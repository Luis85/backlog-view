---
type: Issue
order: 10
parent: "[[Ranking at the focused level]]"
status: Open
priority: P3
area: limitation
created: 2026-08-30
source: PR review of the global-rank branch, Tasks 2 and 4
files:
  - src/domain/rankOrder.ts
  - src/domain/writePlan.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The unseeded fallback is silent, and distinctness is only a proxy

## The limitation

Two accepted limitations of the same shape: a vault can be in the legacy, sibling-scoped
state or in the seeded, globally ranked one, and the code has to guess which without
being able to ask.

**On the write side**, `dropPlacement` answers a placement from the whole ranked
population; when the two neighbours it landed between hold the SAME number it re-asks the
question of the destination's peers alone — ADR 0008's arithmetic, kept so an unmigrated
vault does not lose ordinary reordering. Nothing tells the user which of the two regimes
answered. The rank a move writes therefore means one thing on a seeded vault and another
on a legacy one, and the screen looks identical either way.

**On the read side**, `inRankOrder` sorts a focused list by rank only while the focused
rows' ranks are all distinct (`distinctlyRanked`), and reverts to tree order otherwise.
That is right for the legacy state it was built for, and it cannot tell that state apart
from a tie arising LATER — a defect in Seed, a half-applied batch, a hand-edited
frontmatter. In those cases the focused order silently stops being the rank order and
nothing says so, which could hide a real regression indefinitely.

**Distinctness does not prove seeding either**, in the other direction. A legacy vault
whose sibling ranks happen not to collide across parents — `Epic A`'s children at 30 and
40, `Epic B`'s at 10 and 20 — passes the test and is reordered by rank, which is not the
order anyone gave it. Measured on that exact fixture, not supposed.

## Why it is deliberate

The alternative on the table for the read side was sorting on ties: a scrambled priority
list with no explanation, which is worse than a list in tree order. For the write side,
every whole-population predicate that was tried as a gate had a hole in it — one freshly
created note with no `order` yet, or one legacy tie in another corner of the vault,
re-opens the fallback for a subtree that is perfectly seeded, and the wider gate before
that answered over a `gapSpent` that was correct. Gating on the tie AT THE DROP SITE has
no such hole and is what shipped; ADR 0033 records both wrong gates in full, because both
were built here.

**A third instance, and the sharpest, found by PR review on 2026-08-30: with NO peers the
fallback is not sibling arithmetic at all.** `orderForTarget` sends an empty peer list to
`anchoredOrder(ranked, parent, 'after')`, and that opens with "an empty population's first
rank is `ORDER_SPACING`" — so a FIRST child asked of the peer-scoped fallback answers a flat
1000, which `rankTaken` then accepts because nobody holds it. On a hand-made legacy vault
(`Epic A` 10, `Epic B` 10, `B1` 10) the new `A1` therefore ranks 1000 and draws LAST in the
focused Feature list, below `B1`, where the hierarchy puts it first. Nothing already on
screen moves — the list gains a member in a surprising place — and the tree still draws it
correctly under `A`.

It stands, and the reason is that there is no third answer. Under the legacy scheme a first
child's natural rank is its parent's own number — the sentence `midpoint` states as "every
first child carries its parent's value" — and writing `A1` = 10 collides with both `A` and
`B`, which `rankTaken` refuses and which this feature refuses to write on principle. So the
only alternative to 1000 is refusing, and that blocks creating the first child under any
parent on an unmigrated vault: a harder block on a core gesture than a surprising position,
and the opposite of the direction chosen in [[Ranking at the focused level]] when creation
was given this fallback rather than allowed to refuse where reordering worked. What makes
this instance sharper than the two above is that there the code cannot tell which regime it
is in, while here the plugin's own write is what produces the surprise.

Saying something is not free either: `domain/` cannot raise a notice — it touches no DOM
and reads the vault without writing it — so the report would have to be carried out
through every caller, and a `RankResult` carries a reason and never a row.

## What would lift it

A stored marker of "this vault has been seeded" would answer both halves outright, and it
is exactly the proprietary state ADR 0002 and [[A view per capability]] refuse: the
frontmatter is the whole model, and a hidden per-vault flag two views could disagree about
is the database arriving by the back door.

The affordable version is narrower — report the switch where a user can act on it. The
fallback happens inside a placement the view already reports on refusal, so the notice
path exists; what does not exist is a way to say "this worked, but not the way you think"
without a message on every ordinary drag.

## Impact

Self-limiting on the write side: once the rows around a drop hold distinct ranks there is
no tie to switch on, and the refusal the fallback used to swallow is reported instead. A
vault that has run **Seed ranks from the hierarchy** once leaves both halves behind.

Not self-limiting on the read side. A post-Seed tie is the case that matters, and today it
is indistinguishable from the legacy state the fallback exists for. **Re-open this note if
one is ever reported** — that is the evidence that the read-side proxy has stopped being a
migration aid and become a mask.

## Acceptance criteria

None; recorded so the trade-off is re-decided knowingly rather than rediscovered. The
first post-Seed tie report raises the priority.
