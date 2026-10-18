---
type: PBI
parent: "[[The horizon board for stakeholders]]"
order: 30
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

# Present or plan

**As** a product owner presenting the roadmap, **I want** to take the editing chrome off the
horizon board, **so that** the meeting sees the plan and not the tools to change it.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever drives the screen in a stakeholder meeting, or plans the roadmap |
| **Trigger** | Pressing `Present` or `Plan` in the horizons header |
| **Preconditions** | The horizon board with its header ([[The horizons header]]) |
| **Guarantee** | UI state: never touches the `.base`, never writes a note. It HIDES; it does not make the view read-only. |

**Main flow**

1. The header ends in a group named `Roadmap mode` holding two real `<button>`s, `Present`
   and `Plan`; the current one is `aria-pressed="true"`.
2. Pressing `Present` renders the board without the shelf, without any bucket's New button,
   and without the dashed invitation chips on cards. `Plan` renders it as before.
3. The pick is stored in the view-state store, per saved view and per device, as
   `horizonPresent`.

**Extensions**

- **1a — nobody has picked.** Plan: the stored value is absent, so a reader who updates sees
  no change.
- **1b — the buttons are chrome**, ordinary tab stops, with the iteration header's inset
  focus ring.
- **2a — a press re-renders the board**, which replaces the button pressed; focus moves to
  the new pressed button in this pane.
- **2b — the chips.** Every unset chip on a card leaves the layout and the accessibility
  tree (`display: none` under the frame's `pbl-roadmap-present` class) — state, horizon,
  risk, priority, assignee and date alike, since each is the same invitation.
- **2c — it hides, it does not lock.** Alt+arrow and the card menu still move a card; a move
  to the shelf takes the card off the screen, and the header's count of what is not yet
  placed goes up by one. Accepted: the shelf's count is never secret.
- **3a — `Plan` picked again.** The store holds nothing; anything but a stored `true` reads
  as Plan.

## Acceptance criteria

- `Present` hides the shelf and the New buttons and still counts what is unplaced; `Plan`
  brings them back.
- The pick reopens after a restart on the same device, and never writes the `.base`.
- Alt+arrow still moves a card in Present.

**Checked by** `test/view/horizonHeader.test.ts` — "hides the shelf and the New buttons in Present, and still counts what is unplaced"

**Checked by** `test/view/horizonHeader.test.ts` — "reopens Present when the last session chose it, without writing the .base"

**Checked by** `test/view/horizonHeader.test.ts` — "hides but never locks: Alt+arrow still moves a card"

**Checked by** `test/storage/iterationDailyPref.test.ts` — "stores only true, and false needs no entry at all"

## Where it lives

The switch is `renderModeSwitch` in `src/view/render/iterationHeader.ts`, called from
`renderHorizonHeader` in `src/view/render/horizonHeader.ts`. `renderRoadmap` in
`src/view/render/roadmap.ts` skips the shelf and sets `pbl-roadmap-present`, and
`renderBucket` skips `renderBucketNew`, when `host.horizonPresent` is true; the chips are
hidden in `styles/horizonHeader.css`. The pick is `horizonPresent` in `ViewPrefs` in
`src/storage/viewStateStore.ts`, read by `onlyTrue`, and is read and set through
`src/view/viewState.ts`, `src/view/viewStateController.ts`, `src/view/viewStateSurface.ts`
and `src/view/host.ts`. The harness opens Present with `?present` (`test/harness/knobs.ts`).
