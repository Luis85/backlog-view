---
type: Test case
order: 30
parent: "[[Smoke test the estimation indicator]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-22
source: the indicator presets and open-note increment, 2026-08-22
files:
  - src/view/openTarget.ts
  - src/view/estimation/panel.ts
  - src/view/estimation/renderTable.ts
  - src/view/estimation/estimationView.ts
  - styles/estimationPanel.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Smoke test opening the note being scored

**Covers** [[Opening the note being scored]].

## Why this exists

Everything about *where* a note opens is Obsidian's workspace, and none of it is
reachable from jsdom: splitting a leaf, pinning it, reusing the pane on the next open,
and letting a platform modifier outrank a configured target. The estimation view now
drives all of that through the backlog's own `OpenController`, on a **different default**
— `split` rather than `active` — so the shared code is being exercised in a combination
the backlog never used.

The pin is the item to watch. `split` means `pinOwnLeaf` runs, so the estimation view's
own leaf is pinned the first time a note is opened and **nothing unpins it**. That is
deliberate and recorded as extension 4a of the use case; this walk is where somebody
decides whether it is acceptable in practice.

**Preconditions** — as [[Smoke test the indicator column in a live vault]], with a row
selected so the panel is on screen.

## How to check

- **The default target.** With no `Open in` set, activate `Open note` from the panel
  header and confirm the note opens **beside** the table rather than over it. The
  estimation view should still be visible and the panel should still be where it was.
- **The pin, and whether it is acceptable.** After that first open, confirm the estimation
  view's own leaf is pinned. Then work normally for a few minutes — click other notes,
  use the file explorer — and record whether the pin helps or gets in the way. Nothing
  unpins it, so this is a judgement to record, not a pass/fail.
- **Pane reuse.** Open four different notes in a row from the panel. The side pane should
  be **reused**, not re-split each time — four opens must not leave four panes.
- **The modifier outranks the setting.** With `Open in` on its default, `Ctrl`-click
  (`Cmd` on macOS) the control and confirm a new tab opens regardless. Obsidian's own
  gesture wins over a view preference.
- **Every configured target.** Set `Open in` to each value the dropdown offers and confirm
  each behaves as named, including that the non-`split` targets do **not** pin.
- **`Enter` goes the same way.** Select a row in the table, press `Enter`, and confirm it
  opens exactly as the panel control does — same target, same pane, same pin behaviour.
  These were two different code paths before this increment and are now one; if they
  differ at all, the routing regressed.
- **Opening writes nothing.** Before and after opening, confirm no note gained or lost
  frontmatter and that undo is exactly as available as it was. Check the file on disk.
- **The control's placement while scrolled.** The panel header is `position: sticky`.
  Scroll deep into a long list of dimensions and confirm the `Open note` control is still
  on screen and still level with the title.
- **A long title.** Give a note a title long enough to wrap and confirm the control stays
  pinned to the row's end rather than being pushed out of the header. This exact layout
  shipped broken once — a same-specificity CSS collision cancelled the title's `flex`, and
  a short fixture title hid it — so it is worth doing with a genuinely long name.
- **The `file-text` icon.** Confirm it renders in the shipped Obsidian's Lucide set at
  `.pbl-icon-btn` size, and that its tooltip and accessible name both read `Open note`.
- **A row that left the base.** Harder to stage, and worth trying: select a row, then
  cause a Bases pass to drop it (edit the note so a filter excludes it), then activate
  `Open note`. Nothing should open — not the note, and not whatever now occupies that
  position. The control resolves against the current model at activation for exactly this.

## What the harness answered ahead of the walk

The control is drawn in the sticky header beside the title and stays pinned to the row's
end with a ~220-character title — observed 2026-08-22 in headless Chromium, before and
after the cascade fix, which is how that defect was found. Nothing about *where a note
opens* is answerable there: the harness has no workspace, no leaves and no panes.

## Runs

| Date | Against | Outcome |
| --- | --- | --- |
| — | the indicator presets and open-note increment (2026-08-22) | **Not run.** |

## Acceptance criteria

- Every item above checked in a live vault, on desktop; the modifier item checked on the
  platform whose modifier it names.
- The pin recorded as a judgement — if it is unacceptable in practice, that is a change to
  extension 4a of [[Opening the note being scored]], not a silent fix here.
- `Enter` and the panel control confirmed identical, since the point of the shared
  controller is that this view has one idea of opening rather than two.

---

## Outcome

Not yet run. **This is a checklist to re-run, not a record.** It reopens with the next
change to `src/view/openTarget.ts` or to either activation path.
