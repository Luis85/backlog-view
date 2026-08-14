---
type: PBI
parent: "[[The horizon board]]"
order: 10
status: Active
priority: P1
created: 2026-08-01
files:
  - src/domain/roadmap.ts
  - src/domain/noteFields.ts
  - src/view/render/roadmap.ts
  - src/view/interactions/create.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Buckets from a horizon property

**As** someone stating a plan I can stand behind, **I want** roadmap columns that come
from a horizon property and its ordered values, **so that** the roadmap says Now, Next
and Later with exactly the confidence my notes declare — and no date pretends to be
more.

The Now-Next-Later format was invented at ProdPad to organize a roadmap by confidence
instead of calendar, and its semantics are explicit: a bucket is a placement the team
made, with entry criteria the team writes, not a range a tool computed. So the
vocabulary is the user's — a horizon property and an ordered values list, shipped
prefilled with the canonical three — and the machinery is the board's: declaring the
vocabulary is configuring the columns ([[A column per state]]), and nothing is ever
lost for holding an unexpected value ([[Every card has a column]]).

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The roadmap renders with the horizon axis |
| **Preconditions** | Roadmap mode is on, and a horizon property with at least one value is configured |
| **Guarantee** | Every declared horizon renders in declared order whether or not it is empty; a result's bucket comes from its own frontmatter alone, never from a date; and no result is lost for holding an unexpected value. |

**Main flow**

1. The user names the horizon property; the values option ships prefilled with Now,
   Next, Later — a default vocabulary, not a fixed one.
2. Each declared value renders as a bucket, in declared order, empty or not.
3. Every result carrying a declared value renders as a card in that bucket, in the
   derived order the board already uses — no bucket-only rank is ever stored.
4. A card carries what a card carries ([[What a card shows]]), and may carry its dates
   as a chip: a genuinely time-sensitive item is annotated inside a bucket, which is
   the format's own answer to deadlines that exist without becoming the axis.

**Extensions**

- **2a — a declared bucket holds no cards.** It renders anyway. A horizon exists whether
  or not anything currently sits in it — the board's empty-column rule, and the most
  repeated complaint against boards that derive columns from observed values.
- **3a — a result's value is not in the declared list.** It renders in a bucket named by
  that value, after the declared ones: the vocabulary guides, it never loses a result.
- **3b — a result has no horizon value.** The shelf ([[The unplaced shelf]]), which on
  this axis is the backlog's honest "not yet triaged".
- **3c — a result has dates but no horizon.** Still the shelf. A date is not a horizon,
  and computing one would turn the confidence format back into the release planner it
  exists not to be.
- **4a — the user creates from a bucket.** The New flow runs with the bucket's value
  written in the same creation write — the board's new-card rule ([[New cards in place]])
  applied to horizons, so a note never exists in a bucket its frontmatter does not claim.

## Acceptance criteria

- Declared values render as buckets in declared order, empty or not; the values option
  ships prefilled with Now, Next, Later and stays editable.
- Bucket membership is the note's own frontmatter; dated-but-unbucketed results shelve;
  no date-to-horizon computation exists anywhere.
- An undeclared value gets a trailing bucket named by itself; nothing is lost.
- Cards rank inside a bucket by the same derived order the board uses, and no
  bucket-only rank is stored.
- A card may carry a date chip; creating from a bucket writes that bucket's value as
  part of the creation write.

## Where it lives

The read half shipped with [[A third projection]]: bucket derivation — declared order,
case-insensitive matching, minted strays, results-only counts — is
`src/domain/roadmap.ts`, the value is read by `readPlacement` in
`src/domain/noteFields.ts`, and the columns render in `src/view/render/roadmap.ts`,
driven in `test/domain/roadmap.test.ts` and `test/view/roadmapFrame.test.ts`.

The write half is the bucket's own New button, added to the header in
`src/view/render/roadmap.ts`. It runs the one gated creation flow —
`promptCreateItem` in `src/view/interactions/create.ts`, which now takes what the
surface a note was created FROM adds to it — and the placement rides the single
`createBacklogItem` call in `src/storage/frontmatter.ts` beside the type, the rank and
the parent link. One write, so there is no moment at which the note exists in a bucket
its frontmatter does not claim; everything that governed creation before still governs
it, type folders and the config-problems gate included. Driven in
`test/view/roadmapMoves.test.ts` and `test/storage/frontmatter.test.ts`.

**The button is the one thing here a keyboard cannot press**, which is why this note
stays Active. It carries `tabindex="-1"` because the pane is one tab stop, and unlike
the tree's add button it has no menu entry standing behind it: a bucket is not a
keyboard stop, so there is nothing to select and act on. What is lost is the gesture,
not the capability — the toolbar's New button is an ordinary tab stop and Alt+arrow
walks the new card into any bucket, reaching the same note in the same bucket two
keystrokes later. Closing it properly means bucket stops, which
[[Keyboard and menu on the roadmap]] already specifies as arrows moving across the
roadmap's regions. Touch is fixed rather than deferred: the stylesheet reveals the
button under `hover: none`, or a device with no hover and no tab stop could not reach
it at all.

Two clauses are worth stating rather than leaving to be inferred. Step 4's date chip
needs no roadmap-specific code: a card renders the Base's own visible properties
through the body it shares with the board ([[What a card shows]]), so a view that shows
a date property shows it on the card, in a bucket, without the axis being dates. And
the half of the board's new-card rule this note does NOT claim is the outcome check —
saying so when the note just created is not on the next render. The hazard is real here
too: a base can filter on the horizon property itself, excluding the very bucket the
note was created into. It is [[New cards in place]]'s criterion rather than this note's,
it is unbuilt there, and one attempt at building it for moves was taken back out —
[[The outcome report was built from one sentence]] is why, and is what to read before
attempting it again.
