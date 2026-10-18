---
type: PBI
parent: "[[The iteration board for the daily]]"
order: 20
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

# Walking the board one person at a time

**As** a team at its daily stand-up, **I want** to pick one person and see their cards stand
out on the board, **so that** each of us talks through our own work without the board
hiding anybody else's.

This is the stand-up's "walk the board" without swimlanes. The 2026-08-15 iterations design
refused swimlanes and that refusal is kept: the columns stay the three buckets, and the
spotlight only DIMS the cards that are not the pressed person's. Nothing is hidden, so no
count, column or keyboard stop changes.

## Use case

| | |
| --- | --- |
| **Actor** | The team at a stand-up, or whoever is driving the screen |
| **Trigger** | Pressing a person's chip in the iteration header |
| **Preconditions** | An iteration board with a header ([[The iteration header]]), an assignee property configured, and at least one result card |
| **Guarantee** | The spotlight is visual only and writes nothing — not to a note, not to the `.base`, not to the view-state store. Every card stays on screen, in its column, in the count and on the keyboard walk. |

**Main flow**

1. Under the progress line the header draws `Walk the board`, then one chip per person who
   holds a result card in this sprint: an initial, the name, and the number of cards.
2. The chips are in name order, by the same collation every sort in the plugin uses, and
   `Unassigned` comes last, drawn only when some card has no assignee.
3. Pressing a chip spotlights that person: every column card that is not theirs takes
   `pbl-spot-dim` and fades; theirs stay as they are. The chip is `aria-pressed="true"`.
4. Pressing the same chip again, or `Escape` while it has focus, clears the spotlight.

**Extensions**

- **1a — no assignee property is configured.** No people row and no spotlight. Every card
  would be `Unassigned`: one chip that dims nothing is noise, not a control.
- **1b — the sprint holds no result cards.** No people row: nobody holds anything.
- **1c — an assignee is a link to a `Resource` note.** The person is keyed by the note's
  PATH, so two spellings of one link are one chip; an assignee that resolves to no note is
  keyed by the text written. The chip shows the note's name, or that text.
- **1d — a card is a context row.** It is not counted on any chip and is never dimmed: it
  holds nobody's work on this board, by the context-row rule.
- **3a — the dimmed card holds the keyboard selection, or focus.** It draws at full
  opacity while it does: opacity would fade the selection ring with the card, and a
  reader walking the cards with the keyboard would lose their place.
- **3b — the chips are chrome.** Each is a real `<button>` and a normal tab stop, like the
  shelf disclosure. A press updates the board IN PLACE rather than rendering it again, so
  focus stays on the chip.
- **3c — the chip's accessible name.** Obsidian's tooltip also sets `aria-label`, which
  REPLACES the chip's text as its name, so both tooltips name the person: `Show Dana's
  cards; dim the rest`, and `Showing Dana; press to show everyone` while pressed.
- **3d — the data updates while a spotlight is on.** The board renders again and the
  spotlight is applied again; the redrawn chip is pressed.
- **3e — the spotlighted person's last card leaves the sprint.** The spotlight clears
  itself, so no chip is left pressed for a person the row no longer draws.
- **3f — the reader switches to another sprint.** The spotlight carries across, and it
  clears there by 3e when that person holds nothing in the new sprint.
- **3g — the view is closed and opened again.** The spotlight is gone. It is SESSION state,
  never stored: a saved view must not reopen onto a dimmed board nobody remembers asking
  for. That is why it is not a pref beside the Daily pick ([[Daily or planning]]).

## Acceptance criteria

- One chip per person with a result card, with their count, in name order, `Unassigned`
  last and only when somebody is unassigned; a context row is counted on none.
- No people row with no assignee property, and none for an empty sprint.
- A press dims every other result card and sets `aria-pressed`; a second press or `Escape`
  on the pressed chip clears it. A context card is never dimmed.
- The spotlight survives a data update and a switch of sprint, clears when its person has
  no card left, and is not restored by a new view.
- The selected card stays at full opacity while it is dimmed.

**Checked by** `test/view/iterationSpotlight.test.ts` — "draws no people row, and dims nothing, with no assignee property"

**Checked by** `test/view/iterationSpotlight.test.ts` — "is not restored by a new view"

**Checked by** `test/view/iterationSpotlight.test.ts` — "carries across a switch of sprint, and clears where its person holds nothing"

## Where it lives

`boardPeople` and `personKey` in `src/domain/iterationDaily.ts` build the people from a
population — keyed by path or raw text, sorted with `compareText` from `src/i18n/t.ts`,
context rows skipped. `renderPeopleRow` and `applySpotlight` in
`src/view/render/iterationHeader.ts` draw the chips and toggle `pbl-spot-dim` on the cards
already drawn (`ctx.rows`); `src/view/render/iterationBoard.ts` applies the spotlight again
after every render. The spotlight is a plain field on `src/view/viewStateController.ts`,
reached through `src/view/viewStateSurface.ts` and declared on the host in
`src/view/host.ts`, and it is not in `src/storage/viewStateStore.ts`. The dim and the chips
are styled in `styles/iterationHeader.css`. People rules in
`test/domain/iterationDaily.test.ts`; the drawn row and the spotlight in
`test/view/iterationSpotlight.test.ts`, and the session-only rule in
`test/view/iterationDaily.test.ts`. The harness presses a chip with `?spot=<name>`
(`test/harness/knobs.ts`).
