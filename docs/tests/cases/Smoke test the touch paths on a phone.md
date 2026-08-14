---
type: Test case
parent: "[[Smoke test the platform and vault identity]]"
order: 10
status: Open
area: verification
cadence: release
priority: P1
created: 2026-08-03
source: Review of 0.4.0; the touch decision in Keyboard, menu and touch has never been run
files:
  - manifest.json
  - src/view/render/board.ts
  - src/view/interactions/menu.ts
  - styles/touch.css
  - styles/columns.css
  - styles/roadmap.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Smoke test the touch paths on a phone

**Covers** [[Verifications a device has to answer]].

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

**Preconditions** — a physical phone or tablet, with the plugin transferred onto it
(cloning the repository alone does not put the build there — see "Getting the build onto
the device" below), Restricted Mode off, and `docs/Product Backlog.base` open with
`note.tags` visible in the columns.

## How to check

**The drag verdict is not asked here.** [[Smoke test the board in a live vault]] already
owns it — its "what remains" section lists touch as the one open item carrying *"a real
decision rather than a check: whether drag ships on touch or stays menu-only"*, and
[[Keyboard, menu and touch]] names that note as the owner in as many words. Asking it
again here would put one question in two checklists and leave the release sweep requesting
the same device twice. If the phone is already in hand, answer it **there**.

What this note owns is the part no existing verification covers: the paths that are
supposed to work when drag does not.

**Getting the build onto the device is the first problem, and cloning does not solve it.**
`npm run test-build` writes into `.obsidian/plugins/<id>/` in the repository root, and
`.gitignore` excludes `.obsidian/` — so a phone that pulls this repository gets the vault
and the notes but **not the plugin**, and the Base would open with nothing to test. Some
transfer step is required, and which one is the maintainer's call: Obsidian Sync over the
same vault, a manual copy of the generated plugin folder onto the device, or any
shared-vault route that carries `.obsidian/plugins/<id>/` with it. Whichever is used,
record it in the outcome — the next person running this needs the route more than the
result. On first open the vault also needs Restricted Mode turned off, which
`test-build.mjs` prints as a reminder.

With the plugin actually installed on the device, open `docs/Product Backlog.base` and
answer two questions.

1. **Does a long press open the context menu** — on a tree row, and on a board card? Every
   non-drag path on touch hangs off that one event, and no note asks it. The board smoke
   test asks whether *drag* works; this asks whether the documented fallback exists.
2. **Are the hover-revealed controls reachable — all four of them?** Press each one:
   - `.pbl-add` and `.pbl-bucket-add`, the per-row and per-bucket create buttons. Each
     carries its **own** `(hover: none)` reveal written after the `opacity: 0` it
     overrides, and `test/view/rendering.test.ts` pins that cascade order because the
     bucket button shipped unreachable on touch once.
   - `.pbl-tag-add` and `.pbl-tag-remove`, by **adding a tag and removing one**. These
     render only while the tags property is one of the view's visible columns — since
     [ADR 0023](../../adrs/0023-columns-are-the-bases-property-order.md) that means visible
     in the Bases properties menu, and nothing else — so `docs/Product Backlog.base` carries
     `note.tags` in its `order` for this check — if the column is not on screen, the
     controls are absent rather than unreachable and the question has not been asked.
     They are `display: none` until row hover, so the shared `(hover: none)` block is their only
     touch path — the stylesheet says so beside them: *"without this the inline tag editing
     has no reachable control at all."* `README.md` promises they are always visible on
     touch, which makes this a documented claim rather than a nicety.

   Cascade order is checked here; that a finger can press the result is not.

Alt+arrow is deliberately not on this list. It needs a keyboard and was never a touch path.

## Acceptance criteria

- The transfer route is named in the outcome, and the run confirms the plugin was loaded
  on the device rather than assumed — a Base opening with no view registered looks like a
  configuration problem and is really a missing build.
- Both questions answered, with the device and Obsidian version recorded — and question 2
  answered by **pressing all four controls**, including a tag added and a tag removed.
  Naming only the create buttons would let a broken tag reveal ship with this note marked
  answered, which is how the bucket button shipped unreachable the first time.
- The drag verdict is **not** recorded here. It stays with
  [[Smoke test the board in a live vault]] and [[Pragmatic drag and drop for the board]],
  which own it; this note references them rather than answering for them.
- If question 1 fails, a `Bug` note is filed: the plugin's documented touch fallback does
  not exist, and `isDesktopOnly` becomes a real question rather than a settled one. It is
  **not** a question to answer in advance — flipping the manifest on a guess would remove a
  path this project deliberately built.
- If both pass, the README says what a touch user can do, in its own words rather than
  by omission.

## Outcome

Not yet run.
