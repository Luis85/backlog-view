---
type: PBI
parent: "[[What is in a release]]"
order: 10
status: Open
created: 2026-08-21
source: user request — release management concept refinement, 2026-08-21
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# The scope of a release as a tree

**As** someone deciding what ships, **I want** the release's scope drawn as the tree it
already is, **so that** I can see the shape of the work rather than a flat list of rows that
lost it.

The tree has shipped. It draws its own read-only rows over a population selected by one
property instead of by the whole result set — **not** the backlog's row rendering, which this
note assumed and `## Where it lives` explains it cannot be.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading a release |
| **Trigger** | Opening a release from the index |
| **Preconditions** | The membership property is configured and a release is open |
| **Guarantee** | Every row whose own membership property names this release is a member; every other row on screen is context. **Membership is one release** — the property holds a single value. It never cascades to a parent or a child, and drawing the scope writes nothing. |

**Main flow**

1. The view collects the notes whose own membership property names the open release.
2. It draws each in its place in the hierarchy, at whatever level it sits.
3. Where a member's ancestor is not itself a member, the ancestor is drawn above it, marked as
   context and carrying no numbers.
4. The count of members is stated, and it is the denominator every other figure in this view
   uses.
5. The header names the release, states its own figures, and offers the way to the release
   note itself.

**Extensions**

- **1a — the membership property is not configured.** No scope can be read; the empty state
  says which option to bind, and no tree is drawn.
- **1b — the property holds a link to a note that is not a release.** The item is not a member
  of anything and is reported among the items whose membership could not be resolved, rather
  than silently dropped.
- **1c — the property holds several values.** The item is reported among the items whose
  membership could not be resolved, exactly as 1b, and is a member of none of them. Reading it
  as membership of each would make every writer in this epic destructive: both
  [[Setting an item's release]] and [[Moving a card between slices]] write one value and
  remove the key to clear it, so a second release assigned would silently discard the first,
  and one removal would discard them all. A list-preserving membership is a different feature
  with a different write shape; it is not this one wearing a tolerant reader.
- **1d — the property holds a value that is not text**, a YAML number (`release: 2.4`) or a
  boolean. It is reported as unresolved, exactly as 1b: a link is text, and `resolveParent` and
  `readLinkList` — the reader that fills the row's own entry, and so the `Set release`
  checkmark — both refuse a non-string outright. Coerced to its string form here instead, one
  end counted a membership the menu could not see, which is the disagreement
  [[Setting an item's release]] 1f forbids. Reported rather than tolerated at both ends: a bare
  `2.4` is a spelling Obsidian resolves and a YAML number is not one, and a reported value can
  be repaired from the menu, where a silent membership cannot be seen at all. (Codex, PR #201.)
- **2a — a member's ancestor is missing from the results entirely.** The member is drawn at the
  top level rather than hidden, the same answer the backlog gives an orphan.
- **3a — an ancestor drawn as context is itself in another release.** It is still context here:
  membership is per release, and a row's context status is about the release on screen.
- **3b — a context ancestor's own state would hide it.** It is drawn regardless: it is
  scaffolding for a member, and hiding it would break the member's place.
- **4a — the release has no members.** The tree is empty and says so, naming the release. An
  empty release is a legitimate state, not a misconfiguration. The header above it still draws
  the way to the release NOTE (5a below), which on this screen of all screens is what the
  reader came for.
- **5a — the reader wants the release note itself.** The header carries one control that opens
  it, through this view's own configured target. It is on every scope screen, the two empty
  states included, because this view reads a release's version, date and status and writes none
  of them: the note is where all three are edited, and without this control the only route to
  it was the index behind the reader — and from the index, none at all.
- **2c — a member is finished.** Its state chip is drawn in the done colour and carries the
  check, the same pair the backlog tree's own chip draws for the same reading
  (`ownWorkflowReading`), so one state means one thing on both screens. Colour is not the only
  channel: this chip is static — no hover, no menu, no accessible name of its own — so the icon
  is beside it rather than instead of it. Until 2026-08-29 `Done` and `Doing` were one word in
  one ink, while the summary strip above counted one of the two as finished.
- **2b — a release nobody has folded anything in opens WHOLE.** Every parent is drawn
  unfolded, which is the opposite of the backlog tree's own default
  ([[Collapse persistence]] 1a, where a row nobody has ruled on opens collapsed once). Two
  different populations, so two different defaults: 1a's stated reason is "so a large backlog
  starts readable", and a release scope is ALREADY the filtered population that reason asks
  for — one release's members, which is what the reader opened the screen to see. Collapse all
  is one press away in the toolbar for the release that is big anyway.
  Recorded here because it was emergent rather than decided: with an empty fold set every row
  reads as open, and nothing said whether that was the intent. (Codex, PR #206.)
  **The cheap fix is a trap and that is why it is not taken.** Seeding the fold set on first
  open cannot work, because "nothing stored" is indistinguishable from "the reader expanded
  everything", so it would re-collapse a scope somebody deliberately opened — which is exactly
  the failure the backlog's THIRD state (`settled`) exists to prevent. Matching 1a properly
  therefore means a settled set per release: a second key per parent per release against the
  one `MAX_FOLDS` budget, in the view that holds no `ViewStateController` — the shared cause
  every fold defect on this branch traced back to. Worth doing only if a real release scope
  proves unreadable on opening, which is a live-vault question.

## Acceptance criteria

- A Feature in the release whose Epic is not appears under that Epic, and the Epic is marked
  as context, carries no count, and is not written to by any action on this screen.
- The member count equals the number of notes whose own property names the release — no
  ancestor and no descendant is added to it.
- An item whose membership names a note that is not a release is reported, not dropped.
- An item whose membership property holds two values is reported as unresolved and counts
  towards no release's member total.
- An item whose membership property holds a YAML number is reported as unresolved, and the
  menu offers it no checkmark — the two ends agree that it is not a membership.
- With the membership property unconfigured, no tree is drawn and the empty state names the
  option.
- Drawing the scope plans no write.
- A folded parent keeps its own rollup: folding is a render decision over what is drawn, and it
  must never change a figure computed over the subtree.
- Hiding never removes a context ancestor that still holds a visible member: a context row
  carries no state of its own (3b), so it is never itself the reason a subtree hides, and the
  member below it is what keeps it drawn.
- A click on the disclosure folds or unfolds its row and does not open the note; a click
  anywhere else on the row opens it, and a middle click anywhere but the disclosure opens it in
  a new tab.
- The tree is one tab stop, and Right on a leaf does nothing: a leaf has nothing to step into,
  and moving would make one key mean two things depending on where it landed.
- **The header's controls survive a redraw with focus intact** — the open control included,
  which it was not when it landed (Codex, PR #211): it is a real tab stop the redraw
  detaches, so it belongs in `FOCUS_HANDLE_CLASSES` with the back control and the toolbar's.
- **The header's open control opens the release note through `OpenController.open`** — the
  CONFIGURED target, the same call a row's own click makes, never `openIn(…, 'tab')`, which is
  the target a reader NAMES for themselves. It is drawn on the empty scope too, which is where
  it matters most.
- **A done member's chip carries `.pbl-state-done` and `circle-check`, an unfinished one
  `circle` and no colour class**, and both stay `.pbl-state-static`: this view writes nothing,
  so neither may grow an affordance that says otherwise.

## Where it lives

The membership read (`membershipTarget`) is `src/domain/releases.ts`, beside
`src/domain/board.ts` and `src/domain/roadmap.ts` and shaped like them — it derives from the
model in `src/domain/model.ts` and touches no DOM. **The walk itself — the keep set, the
pre/post-order rollup, `memberTotal`/`memberDone`, `subtreeDone` — moved to
`src/domain/scopeRows.ts` (see [[One person's tree]]), over any membership predicate rather
than this one alone.** `releaseScope` now calls `scopeRows` with the membership question
above as its predicate, which is what keeps the rollup from ever counting a note this screen
is not showing: one walk, so the release scope and the assigned-work tree cannot drift about
what a context row is. The membership key, and this view's own open-note target (`openIn`),
are declared in
`src/domain/releaseOptions.ts`, this view's own option set. `src/view/release/releaseView.ts`
CHOOSES between this scope and the index; `src/view/release/renderScope.ts` draws the header
and the two empty states above the tree — including the header's own open-note control
(`drawOpenNote`), which is beside the title rather than in the toolbar below it because the
toolbar's three controls are about the TREE and this one is about the release the title names; `src/view/release/scopeTree.ts` draws the tree
itself — the rows, the disclosure and a row's click (and middle click), which open the
note through `src/view/openTarget.ts`'s `OpenController`, the estimation view's own
mechanism. **The fold set — scoped to the open release, never a bare path — and the
hide-done flag beside it moved to `src/view/scopeFolds.ts`** (Task 5 of [[Assigned work in
the sidebar]]): the assigned-work tree asks the identical two questions per person rather
than per release, and the whole of what varied was the key prefix, so `scopeTree.ts` now
calls the shared functions with `RELEASE_FOLD` and the open release's path rather than
keeping a second copy. **The keyboard moved the same way, one task later**:
`src/view/scopeKeys.ts` is the tree's keyboard — one tab stop on the container and a
roving `aria-activedescendant`, moved by the four arrows plus Enter and Space, over the
same fold set and the same `OpenController` — never `src/view/selection.ts`, which is
built around a `BacklogViewHost` and the two card projections' own selection, so reusing
it would mean satisfying a host interface in order to withhold most of it, the same call
this note's own next paragraph already made about `render/rows.ts`. It used to live one
directory down, release-only — moved out to this shared home (Task 7 of [[Assigned work
in the sidebar]]) once the assigned-work tree needed the identical mechanism over a
different fold prefix:
`ScopeKeyHost` is the structural type either view satisfies and `TreeDraw` is the shape
either tree's own draw hands it, both defined in the shared module rather than in either
tree's own. `renderScope.ts` is what WIRES the keyboard, not `scopeTree.ts`:
`drawScopeTree` returns what it drew rather than calling `scopeKeys.ts` itself, because
that module reads the fold set `scopeTree.ts` owns, and a call the other way as well
would be the import cycle `npm run analyze` refuses — `renderScope.ts` already imports
both leaves, so it is the one place that can call each in turn without either importing
the other.

This note said the rows reuse `src/view/render/rows.ts` and the context marking already there.
They do not, and cannot: that module takes a `BacklogViewHost` and wires menus, create prompts,
tag removal and drag into every row — every one of them a write this screen does not offer — so
reusing it would make a read-only view satisfy a host interface in order to withhold what the
interface is for. The rows are drawn by `src/view/release/scopeTree.ts` instead, reusing the
stylesheet (`styles/release.css`, `styles/releaseScope.css`), `badgeStyleFor` from
`src/view/render/badges.ts` and — for the rollup — the backlog tree's own `.pbl-meta-col` /
`.pbl-progress` vocabulary from `styles/columns.css`, which is the same reuse the estimation
view settled on for its own read-only rows.

**What declining `rows.ts` COSTS is the semantics, not only the wiring.** It already carries
`role="treeitem"`, `aria-level`, `aria-posinset` and `aria-setsize` — and the `role="tree"`
above them is not its own either: the backlog's pane is created with it in
`src/view/backlogView.ts` and swapped per projection through `src/view/render/projections.ts`. So
`scopeTree.ts` carries the whole set itself, the container role included: `--pbl-depth` moves a
row sideways and announces nothing, and a scope drawn with indent alone is a flat list of divs
on the one screen whose whole promise is the shape of the work. **`aria-expanded` is now carried
on every row that has children, and deliberately absent on a leaf** — this note claimed the
opposite, that it "describes a collapse this screen does not offer", until this rewrite, once
the tree could fold at all. `aria-selected` is carried too, now that the keyboard has landed
(`scopeKeys.ts`): never at draw time, since a row's own draw does not know which row is
active, but set and moved by the roving selection itself, on whichever row `aria-activedescendant`
names. The context marker reuses
`.pbl-outside-marker`'s STYLING and none of its sentence: that one says a row is outside the
base's filter, which is false of every row here, since `releaseScope` skips an `outsideFilter`
ancestor outright rather than keeping it as context.
