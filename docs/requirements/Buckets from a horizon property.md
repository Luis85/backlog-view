---
type: PBI
parent: "[[The horizon board]]"
order: 10
status: Open
priority: P1
created: 2026-08-01
files:
  - src/domain/roadmap.ts
  - src/domain/noteFields.ts
  - src/view/render/roadmap.ts
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
driven in `test/domain/roadmap.test.ts` and `test/view/roadmapFrame.test.ts`. What
remains of this note is the write half — creating from a bucket with its value in the
creation write — beside the moves [[Moving between horizons]] specifies, which is why
it stays open.
