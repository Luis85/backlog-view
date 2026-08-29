---
type: Epic
order: 3.125
status: Active
area: product
created: 2026-08-20
source: user request
started: 2026-08-21
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: "[[Igmar]]"
priority: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Resource Management

**A person is a string typed on each item, and a string cannot be asked anything.** Today
`assignee` holds prose ([[Assignment]]): it names somebody, and that is the whole of what it
can do. Nothing says how much capacity they have, what they do, or whether they are still on
the team, and nothing distinguishes a typo from a colleague — two spellings are two people,
and the roadmap draws a row for each.

This epic makes a resource a **note**. The item links to it, the properties live on it, and
everything the roadmap already draws per person ([[The resource timeline]]) reads from it.

**Outcome** — Who is on an item is a link to a note somebody can open, and what is true about
that person is written down once, on that note.

## A declared name, and why it is one anyway

[[Ten capabilities want seventeen new types]] is open, at P1, and its default points the
other way: *a type is for something the tree ranks; everything else is a note a property
points at.* A resource is pointed at and never ranked, so by that rule it belongs in the
Issue's first bucket — no plugin type at all.

That rule is right about **rungs and extra types**, which is what its three buckets cover, and
this register already holds the case it does not name — but the case is `Absence`, not a
marker. `Absence` is a declared name the reader recognises **in order to refuse it**: it joins
none of the vocabulary lists, so it costs none of the level, rollup and focus semantics the
Issue is defending, and it earns no badge, no folder and no menu entry. `Resource` is the
second such name. What the declaration buys is the one thing a link alone cannot — the ability
to be **listed**. The resources axis draws a row for somebody with nothing assigned yet, and a
row for an empty person needs a set to enumerate; today that set is a comma-separated view
option, which is a roster stored where the plugin cannot open it.

So `Resource` is a fourth bucket the Issue should gain, not an exception to it: **a recognised
name for something the plan points at and the view must be able to list, which is never an
item.** The cost is one name in a vocabulary whose size is under review — and no more than
that, which is the point: a refused name spends no badge hue, no folder option and no place in
any menu. That is the trade this epic makes, and the Issue is where to argue with it.

**It was specified as a MARKER first and that was reversed.** A marker occupies no rung and
holds nothing, which sounded like the same thing — but every marker before this one is a
DATE, and a person carrying a date property drew a diamond, a milestone line and a row in the
milestones' lane. Six review rounds went into carving the date questions back out, and what
they kept producing was a type still present in the tree, the New menu, Set type, the item
count and the shelf. [[A resource is not a backlog item]] holds the whole of it.

## Definition of done, for anything under this epic

- **A resource is a note, and an item names it by link.** Not by prose. A value that is not a
  link is not a resource — it renders as the text it is, and nothing else.
- **Everything true about a person lives on that person's note**, in properties this view
  names like every other, and is read wherever the person is drawn.
- **A `Resource` is not a backlog item at all.** A person contains no work, so no projection
  of this view draws, counts, ranks or offers one, and no write of this view's lands on one.
  Not a rule each projection keeps — a gate each one is behind.
- **The roster is the notes the base returned** — the same population every other row on
  every other projection comes from. No second read path into the vault, and no declared list
  beside it.

## What this epic will not do

- **Schedule.** No leveling, no allocation arithmetic, no answer to "who should do this".
  Capacity is a number that gets read and shown; comparing it with commitment is
  [[Capacity against commitment]]'s question, at release scope, not this epic's.
- **Move the resources axis.** [[The resource timeline]] stays under [[Product Roadmap]] and
  consumes what this epic declares. Drawing a row per person is that feature's outcome; what a
  person *is* is this one's.
- **Migrate an existing vault.** See the limitation below.

## The cost, stated rather than left to be discovered

There is **no migration**. A note carrying `assignee: Sarah` after this epic ships names
nobody: the text renders, and that is all — no row, no properties, no menu entry. Every vault
using assignees today re-declares its people as notes by hand, or loses them.

That is consistent with this repository's stated position — `minAppVersion` is the only
compatibility boundary it keeps, and nothing carries compatibility with older plugin versions
— and it is still a real cost to a real user. It is recorded here so it is a decision rather
than an omission, and [[No migration off the string assignees]] holds the whole of it — what
is lost, why a migration is refused, and the backfill that would lift it.
