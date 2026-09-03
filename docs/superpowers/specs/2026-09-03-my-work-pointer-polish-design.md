# My work: the pointer, and five pieces of polish

**Date** 2026-09-03 · **Branch** `claude/my-work-ux-improvements-b6bd7b`

The my-work view answers the keyboard and reads well. What it does not answer is the
POINTER: a click opens a note and marks the wrong row. That defect is the reason this
spec exists; the other four sections are the polish the same pass pays for while the
files are open.

## 1. The defect: a click marks the wrong row

`wireRowOpen` (`src/view/scopeRow.ts`) opens a note and never moves the roving
selection. Clicking a row focuses `.pbl-tree` — `tabindex="0"`, so the browser focuses
the nearest focusable ancestor — and the tree's own `focus` listener runs `show()`
(`src/view/scopeKeys.ts`), which marks `rows[active]` and scrolls it into view. `active`
is 0 until a key has moved it.

So a click on the fifth row opens the fifth note, paints the accent bar on the first,
and scrolls the pane back to the top. It repeats on every click, because opening the
note takes focus out of the tree each time.

The backlog tree does not have this: `wireRowEvents` (`src/view/render/rows.ts`) calls
`host.selectItem(item, false)` on the click. The two scope trees — my work and the
release scope — share `wireScopeKeys` and neither wires the pointer into it, so the fix
belongs in that shared module and lands on both.

**The fix.** One delegated `mousedown` on `treeEl`: resolve `.pbl-row` from the event's
target, find its index in `rows`, set `active`, `show()`.

`mousedown` and not `click`, and that is the whole of why this is not a two-line
question: focus lands BETWEEN the two events. On `click` the tree's `focus` listener has
already marked row 0 and scrolled to it, so the correction arrives as a visible jump
rather than instead of one.

The event's target is resolved with `.closest('.pbl-row')`, the shape `renderTree.ts`'s
own `contextmenu` listener already uses — not a `treeEl` query, which `TREE_SCAN` bans.

## 2. A pointer path to the row menu

Set state is reachable by right-click and by the Menu key alone. A touch reader has
neither, and a pointer reader has no way to discover that the menu exists.

`.pbl-mw-menu`: an `ellipsis` icon button, `tabindex="-1"` (the tree is one tab stop),
drawn as the last child of every row — context rows included, because the menu
`showMyWorkRowMenu` builds already withholds Set state there and still offers both
Opens. Its click calls `stopPropagation` first, or the row's own listener opens the note
behind the menu.

Revealed the way `.pbl-grip` is in `tree.css`: `opacity: 0` until `.pbl-row:hover`,
`:focus-within` or `.pbl-selected`, and always opaque under `@media (hover: none)` — the
reader who cannot right-click is exactly the reader who cannot hover.

**The chip is not the trigger**, and that is a decision rather than an omission: a
context row and a row whose own workflow is unbound draw no chip at all, so a chip
trigger leaves those rows unreachable, and `drawScopeStateChip` is shared with the
release tree, which writes nothing.

**Width.** The button reserves its space at every pane size. `A tree that fits a
sidebar` measured the row to the pixel at 200-500px, and this adds a term to that
measurement — so it is re-measured in the harness at 200, 240 and 260px before it ships.
If it clips, the BUTTON is what yields at that width, never the chip: the chip is the
only thing that says whether a row is finished, and the right-click still opens the menu
on any pane a mouse can reach.

## 3. Which note is open

Nothing on the tree says which note the reader is looking at. The selection covers it
for one click and then goes stale — a note opened from the graph, a link or another pane
moves nothing here.

`watchApp()`, `backlogView.ts`'s own shape and for its own reason (a Bases view is handed
its `app` after construction, so the subscription is wired on the first data update and
goes through `registerEvent`, which takes it off with the view):
`workspace.on('file-open')`.

`syncOpenRow()` reads `getActiveFile()` and toggles `.pbl-mw-open` through the last
draw's `rowEls` index — no tree scan — and is called from that listener and at the end of
`render()`, since a redraw builds fresh elements that carry no class.

**A class of its own, never `.pbl-selected`.** They are two different facts: the row the
keyboard is on, and the note the workspace has open. Reusing the selection would move the
reader's keyboard cursor because a note opened in another pane changed. The selection
keeps its inset accent bar; the open row gets a faint background and a full-strength
title.

This is what makes the view keep the last draw on itself, which section 5 also needs.

## 4. A roster of one

A vault with one declared person still opens on "nobody picked".

The no-pick guidance gets a press — `Show {name}'s work`, `mod-cta`, appended to the
shell `guidanceShell` returns — drawn only when `model.resources.length === 1`, calling
`view.pick(path)`.

**Not an auto-pick.** `pick(null)` stores nothing, so "never picked" and "deliberately
cleared" are the same stored state: an auto-pick would undo a clear on the next data
update, and telling the two apart costs a second stored value — the shape ADR 0011
already charges for. One press buys the same "one person, no ceremony" with no new state
at all.

## 5. Two reading fixes

**The Next row is scrolled into view when the person changed.** `render()` already
resets a new person's tree to `scrollTop = 0` (the offset belongs to the person it was
scrolled in), so this replaces that restore rather than fighting it: on a person change,
scroll the drawn Next row into view instead of parking at the top. The view keeps that
element from the draw, beside the draw section 3 already keeps.

**`.pbl-mw-context` stops using `opacity`.** `opacity: 0.62` over the whole row dims the
badge and the chip with the title and puts the title's own muted colour under the
contrast floor. Replaced by a muted title colour with the badge at reduced emphasis,
looked at in the harness rather than reasoned about.

**The release tree carries the identical rule and gets the identical change.**
`.pbl-rel-context` is the same declaration for the same purpose; fixing one and leaving
the other is drift, not scope discipline.

## Not in this change

- **The loading shell.** `mywork.loading` shows for one frame before the first data
  update; a guidance shell there costs two catalog keys to dress a flash.
- **A count of open work beside the picker.** Summing a person's load belongs to
  [[Product Operations]] — [[My work]] states that boundary, and both epics wanting the
  same calculation is how the two drift.
- **Any new write path.** The button opens the menu `rowMenu.ts` already builds, through
  the same `WriteGate`, the same `configProblems` refusal and the same context-row
  refusals.

## Verification

**jsdom** (`test/view/mywork/`, and the release tree's own suite for the shared halves):

- A `mousedown` on the third row marks that row — `.pbl-selected` and
  `aria-activedescendant` — and a `focus` after it leaves the mark there.
- The same, driven on the release scope tree: one fix, two trees.
- The `⋯` button opens the same menu the `contextmenu` path builds, and its click does
  not open the note.
- `.pbl-mw-open` follows a `file-open` for a path in the tree, moves off the previous
  row, and survives a redraw.
- The solo-roster press calls `pick` with that person's path; a two-person roster draws
  no press.
- The stylesheet SOURCE carries the reveal rule and the `@media (hover: none)` rule —
  jsdom computes no layout, so this is what a test can honestly say about either.

**Browser** — `npm run harness -- test/harness/mywork.ts`:

- The reserved button width at 200, 240, 260 and 600px, against the fixture whose
  deepest row carries the Next marker.
- The context row's emphasis, and the open marker's colours against the selection's.

**Still owed, and said so rather than implied**: a themed vault's colours, its accent,
and how this feels dragged into a real Obsidian sidebar. Obsidian cannot run here.

## Register work this earns

A PBI under [[Assigned work in the sidebar]] stating the pointer rule — a click marks the
row it opens — with the acceptance criteria above, and the `.pbl-mw-menu`,
`.pbl-mw-open` and context-emphasis claims added where that Feature's stylesheet
criteria already live.
