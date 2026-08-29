---
type: Task
order: 10
parent: "[[A cadence for the checks CI cannot run]]"
status: Open
priority: P2
area: verification
created: 2026-08-10
source: docs/superpowers/specs/2026-08-09-user-manual-and-round-close-design.md ("The verification handover"); .superpowers/sdd/2026-08-09-user-manual/progress.md
files:
  - src/ui/manualDialog.ts
  - styles/manual.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Run the checks CI cannot

## Evidence

Searching `docs/` for a note whose title begins "Smoke test" finds **ten** — not the eight
the design spec assumed while proposing this note (`2026-08-09-user-manual-and-round-close-design.md`,
"The verification handover": *"The eight that exist say what to check"*) — plus the `P1`
touch note handled separately below. All eleven are `status: Open`. Three
([[Smoke test the tree]], [[Smoke test the board]], [[Smoke test the roadmap]]) carry a
maintainer-run date on their own outcome line already; the rest have never been run at
all. The undercount is itself evidence for why this note exists: "go verify things in a
vault" is easy to lose track of even by the people asking for it, and a list that is
wrong by two is a list nobody had actually walked.

Beyond the existing notes, this plan (`2026-08-09-user-manual`) leaves two checks nothing
has ever run and no existing note owns: the manual dialog's own appearance, and whether
focus actually returns through all five doors into it. Both are named in the Approach
below rather than restated from a note that does not exist yet.

## Why it matters

Eight open "Smoke test …" notes, a `P1` about touch, and now two more unowned checks are
each individually a thing to check, never a thing to *do*: "go verify this in a vault" is
not a task anyone can pick up in a spare hour, so in practice nobody does, and the notes
sit open indefinitely without that being anyone's failure in particular. This note is the
sitting — install, open, work a stated sequence, record answers — the only shape that
turns a pile of "someone should check this" into something a person actually starts.

## Approach

The ordered sitting. Steps 2 through 13 are one continuous pass through a single
`npm run test-build` vault; steps 14 and 15 cannot be done here at all.

1. `npm run test-build`, open this repository as a vault, open `docs/Product Backlog.base`.
2. [[Smoke test the tree]] — the default projection, checked first because it is the one
   everyone opens first. Answer recorded on its own **Outcome** line and in each linked
   use case's own acceptance criteria.
3. [[Smoke test the board]] — the board projection. Same recording shape as above.
4. [[Smoke test the board in a live vault]] — the Kanban-specific pass (WIP, dates,
   column policy) filed against `[[Product Kanban]]` directly, ahead of the Feature above.
   Answer recorded in its own **Runs** table.
5. [[Smoke test the column agreements]] — WIP limits and the per-column policy pointer.
   Answer recorded in its own **Outcome** section.
6. [[Smoke test the card children in a live vault]] — the card-children disclosure.
   Answer recorded in its own **Runs** table.
7. [[Smoke test the four button-specificity fixes in a live vault]] — the button-chrome
   fixes from the same card-children increment. Answer recorded in its own **Runs** table.
8. [[Smoke test the roadmap]] — the roadmap projection. Answer recorded on its own
   **Outcome** line and in each linked use case's own acceptance criteria.
9. [[Smoke test the writable timeline]] — the roadmap's dated-axis writes. Answer
   recorded in its own **Outcome** section.
10. [[Smoke test the folder note layout in a live vault]] — creation as folder notes.
    This one has neither a **Runs** table nor an **Outcome** section yet: closing the
    note, or adding one, is the record until then.
11. [[Smoke test the visual changes]] — appearance across every projection, including the
    2026-08-09 toolbar overhaul, checked last because everything above is already on
    screen by the time it is reached. Answer recorded in its own **Runs** table and
    **Outcome** section.
12. **The manual dialog's own appearance and its phone layout — no existing note, first
    recorded here.** `test/CLAUDE.md` and ADR 0020 already say the jsdom harness renders
    nothing and the browser harness settles layout and not colour; the manual dialog is
    further out than either reaches, because its phone handling gates on Obsidian's own
    `.is-phone` class (`mod-sidebar-layout`) — jsdom applies no such class, evaluates no
    media query, and lays nothing out, so every phone fix this plan made
    (`styles/manual.css`'s sidebar-to-stacked-nav switch, the prose grid collapsing to one
    column) is a stylesheet-text assertion plus reasoning about `.is-phone`, never a
    measurement. Open the manual from the toolbar `?` on a phone-width Obsidian window (or
    Obsidian Mobile if available) and confirm the sidebar stacks above the prose, the prose
    itself reads as one column rather than two, and the 190px sidebar width does not leave
    the prose column pinched on a genuine phone viewport. Check both light and dark.
13. **Focus returning through all five doors into the manual — no existing note, first
    recorded here.** The manual opens from the toolbar `?` and four contextual links
    (`src/ui/manualDialog.ts`), and closing it is supposed to return focus to whichever
    control opened it. jsdom reports every element's `offsetParent` as `null`
    unconditionally, so `manualLink`'s default refocus path — the one exercised by three
    of the four contextual doors — has only ever been unit-tested with a stubbed
    `offsetParent`; end-to-end, only the toolbar `?` door has actually been driven and
    watched return focus. Open the manual from each of the five doors in turn, close it,
    and confirm focus visibly lands back on the control that opened it rather than on the
    document body.
14. The phone — [[Smoke test the touch paths on a phone]]. `manifest.json` sets
    `isDesktopOnly: false`, which is a shipped claim, and every direct manipulation in this
    plugin is a native drag, so on a phone the context menu is the entire interface and it
    has never been touched by a finger. **This step cannot be done by an agent — it needs a
    physical phone or tablet, and is the maintainer's to run.**
15. Enable branch protection requiring branches to be up to date with `main` before
    merging — the only open item on
    [[Two spec branches predate the use-case gate]], the `P1` recording the class firing
    four times in one afternoon. **This step cannot be done by an agent — it is a GitHub
    repository setting only the maintainer can change.**

## Acceptance criteria

- Steps 2 through 13 have each been walked in one `npm run test-build` sitting, with a
  dated answer landing where the Approach above says it lands — an existing note's own
  **Runs** table or **Outcome** section, or, for steps 10, 12 and 13, a first one added
  where none exists yet.
- Step 14 is either run by the maintainer on a real phone, with
  [[Smoke test the touch paths on a phone]] updated accordingly, or explicitly deferred by
  the maintainer with a reason — not silently skipped.
- Step 15 is either enabled, or explicitly declined by the maintainer with a reason
  recorded on [[Two spec branches predate the use-case gate]] — not left to keep reading as
  merely unstarted.
- This note's own count (ten "Smoke test" notes, not eight) is corrected wherever the
  stale figure was written down, rather than left to disagree with a reader who counts
  again.

## Risks

Steps 2, 8 and 11 alone cover three projections' worth of appearance and are already
described elsewhere as "about ninety seconds" or "a ten-minute pass" each; stacked with
five more Issue-shaped checks and the two new items, the honest length of one sitting is
closer to an hour than to the "under an hour" figure this family of notes has used before
— worth saying so rather than letting the ordered list read as quicker than it is. Steps
14 and 15 are also the two most likely to be silently skipped precisely because nothing
here can force them: naming them as steps 14 and 15 rather than leaving them as separate
notes nobody links together is the whole point of this task, but a list is not a
scheduler, and this note stays `Open` for as long as either does.
