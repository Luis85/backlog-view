---
type: Issue
parent: "[[Verifications a device has to answer]]"
order: 20
status: Open
area: verification
priority: P1
created: 2026-08-03
source: Review of 0.4.0; the touch decision in Keyboard, menu and touch has never been run
files:
  - manifest.json
  - src/view/render/board.ts
  - src/view/interactions/menu.ts
  - styles.css
---

# Smoke test the touch paths on a phone

## Why this exists

`manifest.json` sets `isDesktopOnly: false`, and that is a considered position rather than
a default. [[Keyboard, menu and touch]] decides it in prose — *"The menu is the answer on
every platform either way"* — and in its acceptance criteria, where Set state in the
context menu is *"the equivalent non-drag path on every platform, and the required one on
touch."* `src/view/render/board.ts` wires it and says so: *"The menu is the non-drag path,
and on touch the only one."*

Every direct manipulation the plugin offers is native drag: `src/view/render/rows.ts` sets
`row.draggable`, and the card projections use Pragmatic's element adapter, which is the
same drag events underneath. So on a phone the menu is not a convenience — it is the whole
interface. **None of it has been run on a device**, and jsdom cannot answer any of it.

Priority is P1 among the verifications for one reason: if the first question below fails,
the fallback the entire touch design rests on is absent, and that is not something a user
would report as a bug so much as conclude the plugin does not work.

## How to check

Run `npm run test-build`, open this repository as a vault on a phone, open
`docs/Product Backlog.base`, and answer three questions.

1. **Does a long press open the context menu** — on a tree row, and on a board card? Every
   non-drag path on touch hangs off that one event.
2. **Does a drag fire at all?** [[Keyboard, menu and touch]] names the uncertainty exactly:
   *"on Obsidian mobile native drag from touch has historically not fired — the chosen
   engine claims otherwise, a verdict the smoke test owns."* That verdict belongs on
   [[Pragmatic drag and drop for the board]]; record it there and reference it here.
3. **Are the hover-revealed controls reachable?** `styles.css` carries a `(hover: none)`
   block revealing `.pbl-add` and `.pbl-bucket-add`, and `test/view/rendering.test.ts` pins
   its cascade order because it shipped broken once. That the order is right is checked;
   that the buttons can be pressed on a device is not.

Alt+arrow is deliberately not on this list. It needs a keyboard and was never a touch path.

## Acceptance criteria

- All three questions answered, with the device and Obsidian version recorded.
- Question 2's verdict written on [[Pragmatic drag and drop for the board]], which owns it.
- If question 1 fails, a `Bug` note is filed: the plugin's documented touch fallback does
  not exist, and `isDesktopOnly` becomes a real question rather than a settled one. It is
  **not** a question to answer in advance — flipping the manifest on a guess would remove a
  path this project deliberately built.
- If all three pass, the README says what a touch user can do, in its own words rather than
  by omission.

## Outcome

Not yet run.
