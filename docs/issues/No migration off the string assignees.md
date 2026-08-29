---
type: Issue
order: 40
parent: "[[Resource Management]]"
status: Open
priority: P2
area: domain
created: 2026-08-20
source: user request, while writing the Resource Management epic
files:
  - src/domain/writePlan.ts
  - src/storage/frontmatter.ts
  - src/view/interactions/labels.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# No migration off the string assignees

## The limitation

[[Linking an item to a resource]] changes what the assignee property holds — from a name to
a wikilink — but **not every assignment written before this shipped goes stale**. Resolution
is what decides, not spelling: `assignee: Sarah` still resolves and still keeps its
association wherever the vault already has a `Sarah.md` that is a `Resource` this base
returns — a bare name is not a syntax this view refuses, it is a value that resolves like any
other. Nothing here converts a name into a link on disk, but nothing has to, for that case.

**What is actually lost is narrower**: every assignment naming somebody with **no** `Resource`
note behind them in this base — a person never given a note, a typo, a name that never
matched a file. For those, and only those:

- no row on the resources axis, because a row is a `Resource` note the base returned
  ([[Rows from the Resource notes]]);
- no chip styling, no menu entry, no properties — there is no note to read them off;
- the item shelves, counted, alongside everything else with no resource.

The text is still on the note and still renders, so nothing is destroyed. What is lost, for
that narrower set, is the **association**: who had what. Rebuilding it means making a
`Resource` note per such person and re-picking the resource on each of their items by hand —
which is also all a vault that already has a note per person has to do, namely nothing.

The same applies to the roster. `resourceNames` is removed rather than deprecated, and the
names in it are not turned into notes — a vault that declared eight people in that option
loses the declaration with the option.

## Why it is deliberate

**A migration is a write over notes nobody asked to have written.** It would have to run over
the whole vault rather than the base's results — the association it is repairing is exactly
the one the view can no longer see — and that is the read path
[[Rows from the Resource notes]] refuses on the context-row rule's reasoning. A one-shot
action that creates a note per observed name and rewrites every item that carries it is the
largest write this plugin would ever make, against the weakest evidence it has: a string, and
a guess that two spellings are one person.

It is also consistent with the only compatibility boundary this plugin keeps. `minAppVersion`
is a floor, not a range, and nothing here carries compatibility with older *plugin* versions —
a shim for an earlier one is dead code by definition. A migration is that shim, with a write
path attached.

And there is a cheaper answer that needs no new mechanism: the toolbar's ✨ already binds
suggested keys and backfills them ([[Backfill missing properties]]). Extending it is a
smaller change than a bespoke migration, and it is deferred rather than refused — see below.

The honest tension is that the reasoning above is about **cost and evidence**, not about the
user being wrong to want it. Somebody with two hundred assigned items and eleven people has a
real problem and this note is not solving it.

## What would lift it

A backfill pass in the shape the ✨ button already has, not a migration in a shape of its own:

1. collect the distinct assignee strings **in the base's results**, which is the population
   every other action here uses;
2. create one `Resource` note per distinct string, in the `Resource` folder, skipping any
   name a `Resource` note already carries;
3. rewrite each result's assignee to the link, in one gated, undoable batch.

Two questions have to be answered before that is designed, and neither is answered here.
**Case and spelling** — `Sarah` and `sarah` are one person or two, and the roster's old
case-insensitive comparison is gone precisely because a link has no such middle answer.
**Reach** — a pass over the results repairs only the items the base returned, so a vault
whose base excludes done work re-runs it under a different filter and gets a second set of
notes if step 2's skip is not exact.

## Impact

Every vault using assignees today, once, at the version [[Linking an item to a resource]]
ships in — but only the fraction of assignments naming somebody with no `Resource` note. It
is not on a path anybody chooses and cannot be avoided by not touching the feature — the
value shape changes underneath a note that is never edited — but a vault that already has a
`Resource` note for everybody it names loses nothing on this upgrade at all.

Severity scales with how much of a vault's roster has no note behind it: nobody, nothing
happens; a name assigned to work that nobody ever made a `Resource` note for, that name's
whole association goes blank in one upgrade. Nothing is deleted and nothing is silently
rewritten, which is the one thing this limitation has going for it — the names are still on
the notes, so the repair is possible by hand and, later, possible by the backfill above.

The release this lands in owes the cost a line in `CHANGELOG.md` under a breaking heading.
An upgrade that empties a roadmap axis is not a note somebody should find by opening the
view.

## Acceptance criteria

None; recorded so the trade-off is re-decided knowingly rather than rediscovered. If the
backfill above is taken up, the two questions under it come with it and are the design, not
a detail of it.
