---
type: PBI
parent: "[[The iteration board for the daily]]"
order: 40
status: Done
priority: ""
created: 2026-10-18
source: user request
started: ""
finished: 2026-10-18
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
release: ""
---

# Daily or planning

**As** a team at its daily stand-up, **I want** to take the backlog shelf off the iteration
board, **so that** the meeting talks about the work the sprint committed to, not the work
it could still pull in.

The shelf is what makes the iteration board a planning tool: the backlog to pull from sits
above the columns. At the daily it is in the way. A two-button switch picks which of the
two jobs the board is doing, and the pick is remembered on the device.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever drives the screen at the stand-up, or plans the sprint |
| **Trigger** | Pressing `Daily` or `Planning` in the iteration header |
| **Preconditions** | An iteration board with a header ([[The iteration header]]) |
| **Guarantee** | The pick is UI state: it never touches the `.base` and never writes a note. Columns, cards, counts, moves and the header are the same in both modes; only the shelf differs. |

**Main flow**

1. The header's title row ends in a group named `Board mode` holding two real `<button>`s,
   `Daily` and `Planning`; the current one is `aria-pressed="true"`.
2. Pressing `Daily` renders the board without the backlog shelf. Pressing `Planning`
   renders it with the shelf, as before this feature.
3. The pick is stored in the view-state store, per saved view and per device, and the next
   time the view opens it opens in the same mode.

**Extensions**

- **1a — nobody has picked.** Planning: the stored value is absent, so a reader who
  updates sees the board exactly as before until they press `Daily`.
- **1b — the buttons are chrome.** Each is a normal tab stop, like the shelf disclosure,
  and shows a focus ring of its own: Obsidian's `button:focus-visible` ring is a
  box-shadow the segment's own styling removes, so the ring is an inset outline.
- **2a — a press re-renders the board**, which replaces the button that was pressed. Focus
  moves to the new pressed button in THIS pane rather than falling to the document —
  another pane may hold an iteration board too.
- **2b — Daily, and the shelf's tab-stop rule.** The shelf controls come back into the tab
  order when no column card can open a menu to reach them. In Daily there is no shelf, so
  the rule has nothing to act on.
- **3a — `Planning` is picked again.** The store holds nothing: the pref is stored only as
  `true`, and the default stores no entry.
- **3b — the stored value is anything but `true`.** It reads as the default, Planning.
- **3c — why the pick is stored and the spotlight is not.** A mode is a choice a reader
  expects to find again — the team that uses the board for the daily opens it for the
  daily every day. A spotlight is one moment of one meeting
  ([[Walking the board one person at a time]] 3g). It is UI state, never a `.base`
  setting, by ADR 0011.

## Acceptance criteria

- `Daily` hides the shelf and `Planning` shows it again, on the same board.
- The pick reopens after a restart on the same device, and never writes the `.base`.
- Back at Planning, the store holds no entry; anything but a stored `true` reads as
  Planning.
- A press renders the board, and focus lands on the pressed button.

**Checked by** `test/view/iterationHeader.test.ts` — "hides the shelf for the daily and shows it again for planning"

**Checked by** `test/view/iterationDaily.test.ts` — "reopens Daily when the last session chose it, without writing the .base"

## Where it lives

`renderModeSwitch` in `src/view/render/iterationHeader.ts` draws the switch;
`src/view/render/iterationBoard.ts` skips the shelf when `host.iterationDaily` is true. The
pick is `iterationDaily` in `ViewPrefs` in `src/storage/viewStateStore.ts`, read by
`onlyTrue`, and is read and set through `src/view/viewState.ts`,
`src/view/viewStateController.ts` (which renders on a change), `src/view/viewStateSurface.ts`
and `src/view/host.ts`. The look and the focus rings are in `styles/iterationHeader.css`.
The stored shape in `test/storage/iterationDailyPref.test.ts`; the round trip in
`test/view/iterationDaily.test.ts`; the drawn switch in `test/view/iterationHeader.test.ts`.
The harness opens Daily with `?daily` (`test/harness/knobs.ts`).
