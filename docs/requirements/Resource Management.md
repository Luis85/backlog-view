---
type: Epic
order: 220
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
assignee: ""
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

## A marker type, and why it is one anyway

[[Ten capabilities want seventeen new types]] is open, at P1, and its default points the
other way: *a type is for something the tree ranks; everything else is a note a property
points at.* A resource is pointed at and never ranked, so by that rule it belongs in the
Issue's first bucket — no plugin type at all.

That rule is right about **rungs and extra types**, which is what its three buckets cover, and
this register already holds the case it does not name. `Milestone` and `Iteration`
([[Milestones as their own type]], [[An iteration is a note of its own]]) rank nothing either,
and are types regardless: a marker occupies no rung, holds nothing and hangs from nothing, so
it costs none of the level, rollup and focus semantics the Issue is defending. What it buys is
the one thing a link alone cannot — **a declaration**. The resources axis draws a row for
somebody with nothing assigned yet, and a row for an empty person needs a set to enumerate;
today that set is a comma-separated view option, which is a roster stored where the plugin
cannot open it.

So `Resource` is a fourth bucket the Issue should gain, not an exception to it: **a marker for
something the plan points at and the view must be able to list.** Two costs come with it and
neither is deferred — a badge hue, against a palette [[The type palette has no unclaimed hue
left]] and [[A badge when the palette is full]] already declared full, answered by the second
axis those two bought; and an eighteenth name in a vocabulary whose size is under review. That
is the trade this epic is making knowingly, and the Issue is where to argue with it.

## Definition of done, for anything under this epic

- **A resource is a note, and an item names it by link.** Not by prose. A value that is not a
  link is not a resource — it renders as the text it is, and nothing else.
- **Everything true about a person lives on that person's note**, in properties this view
  names like every other, and is read wherever the person is drawn.
- **A `Resource` holds nothing and enters no rollup.** A person contains no work: no
  progress bar counts one, no focus level descends into one, no drag re-types one.
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
