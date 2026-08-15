---
type: PBI
parent: "[[A third projection]]"
order: 60
status: Done
priority: P2
created: 2026-08-15
files:
  - src/view/host.ts
  - src/view/render/shelf.ts
started: "2026-08-15"
finished: "2026-08-15"
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Folding a shelf type group

**As** someone triaging a shelf that holds four types at once, **I want** to fold the
types I am not triaging down to their header, **so that** the type I am working through
is on screen without the others scrolled past — and without losing sight of how much I
am leaving behind.

[[The shelf, organized]] gave the shelf its type groups and a filter that HIDES one; this
is the other half of that pair, and the difference is the count. Hiding a type takes the
group away entirely, which is right when a type is not this session's business at all;
folding keeps the header and its number, which is what someone triaging wants — the work
is out of the way and still being counted at them. [[Folding a horizon bucket]] is the
same answer one region over, and this reuses its mechanism rather than inventing a second.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The user folds a type group in the expanded shelf, or opens a folded one |
| **Preconditions** | Roadmap mode is on, the shelf is expanded and holds at least one item |
| **Guarantee** | A folded group draws no card and contributes none to the keyboard walk or the pane's role, while its header, its type and its true count stay on screen. Nothing is written to a note, and the fold is remembered per saved view and per device. |

**Main flow**

1. Each type group in the expanded shelf draws a disclosure beside its name, open —
   a type nobody has ruled on is open, since the shelf exists to show what is untriaged.
2. The user folds one. Its cards go; its header, its name and its count stay.
3. The group's accessible name says it is collapsed, because the count deliberately
   survives the fold.
4. The pick goes to the view-state store with every other fold. Reopening the view draws
   the same groups folded.

**Extensions**

- **2a — every group is folded, and the shelf is all the roadmap has.** The pane draws no
  card, so it is a labelled `region` rather than a `listbox` and the shelf's own header
  controls return to the tab order — exactly the state hiding the last visible type
  already produces ([[The shelf, organized]]).
- **2b — a fold and the type filter disagree.** They cannot: a hidden type has no group to
  fold, and `organizeShelf` is what decides which groups exist before this is asked.
- **3a — a keyboard user wants to fold.** The disclosure is a `tabindex="-1"` button, so
  it is reachable by pointer and by assistive tech and not by Tab, exactly as a horizon
  bucket's fold is. There is no menu path, and that is the same recorded gap
  [[Folding a horizon bucket]] ends on rather than a second one — closing it properly
  means a shelf-group stop, which is [[Keyboard and menu on the roadmap]]'s work.

## Acceptance criteria

- A folded group renders its header and count and no cards, and contributes no card to
  `RoadmapSnapshot.cards` — so it cannot be selected, and it counts toward neither the
  pane's `listbox` role nor the roadmap's emptiness advisory.
- The group's `aria-label` names the type, says `collapsed`, and states the true count.
- Folding one type leaves every other group as it was.
- The fold survives closing and reopening the view, and nothing reaches the `.base`.
- No change to the type filter, the sort pick, the shelf's own disclosure or its total.

## Where it lives

`ColumnScope` (`src/view/host.ts`) gains `shelf`, which is the whole of the storage
question: `columnCollapsed`/`setColumnCollapsed` already key a fold by scope and value in
`folds.collapsedColumns`, so a type name goes there the way a state value does and the
prune leaves it alone for the same reason (it is a word, not a path).

`renderShelfGroup` (`src/view/render/shelf.ts`) asks that question with `autoCollapse`
false, draws `renderColumnFold` — the same disclosure the board's columns and the horizon
buckets use, so the filter override, the real `disabled` flag and the focus hand-off come
with it — and RETURNS no cards when folded, which is `renderBucket`'s rule and what keeps
the keyboard walk and the pane's role honest without either asking about a fold.

jsdom has no layout, so the suite asserts the cards, the count, the accessible name, the
walk and the stored pick (`test/view/shelfFold.test.ts`); how the folded header reads
beside its neighbours is `npm run harness`'s to show and a live vault's to confirm.
