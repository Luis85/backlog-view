---
type: PBI
parent: "[[Columns from the workflow]]"
order: 50
status: Done
priority: P3
created: 2026-08-01
closed: 2026-08-02
files:
  - src/domain/viewOptions.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-01
due: 2026-08-02
risk: ""
assignee: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Explicit policies on the column

**As** a team that agreed what "in review" means, **I want** that agreement written on
the column, **so that** the working agreement is where the work is instead of in a
document nobody opens.

The Kanban Guide's "explicit policies", made cheap: a line of exit criteria per column,
one hover away. Azure DevOps puts a per-column definition of done behind an info icon
on the column header; none of the other surveyed tools has it natively, and it is the
difference between a board that shows states and one that shows the working agreement.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner, on behalf of whoever agreed the policy |
| **Trigger** | Reaching for a column's policy — by pointer on its header, or from the column's menu |
| **Preconditions** | The column's state carries a policy text in the view options |
| **Guarantee** | A policy is text the board shows. Nothing about it changes what a move is allowed to do. |

**Main flow**

1. The user writes a short policy for a configured state in the view options.
2. That state's column header gains an affordance.
3. Pointing at the affordance shows the text; the column's context menu — introduced
   by this use case, and the shell [[New cards in place]] later hangs creation off —
   carries it too, so it is reachable without a pointer.
4. Assistive technology hears the policy as the column's description.

**Extensions**

- **1a — no policies are configured.** Headers are unchanged: no empty affordances, and
  nothing suggesting a feature the user has not asked for.
- **3a — the user reaches it by keyboard.** Through the column's existing menu, not a new
  tab stop. The board is one tab stop by design ([[Keyboard, menu and touch]]), and a
  per-column control would multiply stops by columns.
- **3b — the column has nothing agreed.** There is no menu, so the key is **left alone**
  rather than consumed: the stop still exists (it is a place to stand), and `ContextMenu`
  there reaches whatever would have had it. Withholding an offer is not the same as
  swallowing the gesture that asked for it — the first is 1a applied to the menu, the
  second is a dead end that looks like a broken feature.
- **4a — a card moves into a column whose policy is not met.** It moves. Nothing enforces
  a policy, exactly as the type ladder guides and never refuses — the rules here decide
  what is *offered*, never what is *permitted*.

## Acceptance criteria

- Each configured state can carry a short policy text in the view options, generated
  one option per state the way the per-type folder options already are.
- A column whose state has a policy shows an affordance on its header, and the text
  is reachable without new tab stops: by pointer on the affordance, and from the
  column's context menu — introduced by this use case, and the shell
  [[New cards in place]] later hangs creation off — with assistive technology
  hearing it as the column's description.
- Policies render. Nothing enforces them — a card moves into a column whether or not
  its policy is met, exactly as the ladder guides and never refuses.
- With no policies configured, headers are unchanged: no empty affordances — and the
  keyboard path consumes `ContextMenu` only when it actually opened something, the rule
  the pointer path already kept.

## Where it lives

One generated option per configured state — `columnPolicy.<state>`, lowercased,
declared in `src/domain/viewOptions.ts` and resolved in `src/domain/settings.ts`. The
column carries its own policy (`src/domain/board.ts`); the header's affordance and its
`aria-describedby` are in `src/view/render/board.ts`, and the column menu is
`buildColumnMenu` in `src/view/interactions/menu.ts` — null when there is no policy —
opened by the header and by `handleColumnStopKey` in
`src/view/interactions/keyboard.ts` on the selected column stop. That keyboard path
consumes the key only on what `showColumnMenuFor` reports it opened, which is why that
host method returns a boolean rather than void.

Driven by `test/domain/viewOptions.test.ts` and `test/domain/board.test.ts`.

The affordance, its description, the column menu and the keyboard path onto it are
driven by `test/view/columnAgreements.test.ts`.
