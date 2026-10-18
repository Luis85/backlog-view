---
type: PBI
parent: "[[The horizon board for stakeholders]]"
order: 10
status: Done
priority: ""
created: 2026-10-18
source: user request
started: 2026-10-18
finished: 2026-10-18
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
release: ""
---

# The horizons header

**As** a product owner showing the roadmap to stakeholders, **I want** the horizon board to
open with one line that says how much work sits in each horizon, **so that** the room sees
where the priority is before anyone reads a card.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever presents the roadmap, and the people watching |
| **Trigger** | Opening the roadmap on the horizon axis |
| **Preconditions** | A configured horizon property ([[The horizon board]]) |
| **Guarantee** | Read-only: the header writes nothing. Every number is a RESULT count — the context-row rule. |

**Main flow**

1. The horizons frame draws the header first, above the shelf: a small uppercase `Roadmap`
   kicker, then the `h2` `Horizons`.
2. Under them, one count per bucket in render order — `Now 5`, `Next 4`, `Later 3` — each
   its own sentence in its own span, with an `aria-hidden` separator span between.
3. When the shelf holds any result, the line ends with `20 not yet placed`.
4. The Present / Plan switch sits at the header's end ([[Present or plan]]).

**Extensions**

- **1a — the dated or the resources axis.** No header: it is the horizon board's.
- **2a — a context row in a bucket.** Not counted: a bucket's count is `bucket.count`, which
  holds results only.
- **2b — a bucket the completed toggle has thinned.** The count is the drawn count, the
  number on the bucket's own header; the bucket's progress line says how much is done
  ([[Progress per bucket]]).
- **3a — an empty shelf.** No `not yet placed` part at all, never `0 not yet placed`.
- **3b — Present.** The shelf is not drawn, and the count of what is not yet placed is still
  said: the mode hides the shelf, it does not hide that the work exists.

## Acceptance criteria

- The header names the board under a kicker, on the horizon axis only.
- The summary counts each bucket and what is not yet placed, and never a context row.
- With nothing on the shelf the summary says nothing about it.

**Checked by** `test/view/horizonHeader.test.ts` — "counts each bucket and what is not yet placed, never a context row"

**Checked by** `test/view/horizonHeader.test.ts` — "is drawn on the horizon axis only"

## Where it lives

`renderHorizonHeader` in `src/view/render/horizonHeader.ts` draws the header and the
summary, called from the horizon branch of `renderRoadmap` in
`src/view/render/roadmap.ts`. The box, kicker, title and switch are the iteration header's
classes (`styles/iterationHeader.css`); its alignment in the frame is in
`styles/horizonHeader.css`. The keys are `horizons.*` in `src/i18n/en.ts`.
