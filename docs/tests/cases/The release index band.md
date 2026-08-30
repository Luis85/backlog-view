---
type: Test case
order: 20
parent: "[[Smoke test the release view]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-30
source: the 0.10.0 release review; the index band redrawn 2026-08-25 and never opened in Obsidian
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The release index band

A verification to run.

## Why this exists

The index was redrawn on 2026-08-25 from a five-column grid into a two-line band per
release, and **nothing has opened it in Obsidian since**. Every layout claim rests on jsdom,
which computes no layout, plus two ad-hoc headless-Chromium runs against markup reproduced
by hand. That is exactly how `display: contents` on a release row — which makes the row
unfocusable, so Tab skips it and `.focus()` does nothing — survived eight tests, two reviews
and a fix round before a browser was asked.

**Preconditions** — as [[Release view registration and options]], and the vault holds at
least one shipped release and one in flight, one of them overdue, and one release whose
name is long enough to overflow the band.

## How to check

- At a **real pane width**, in both colour schemes: which figure yields first? The version
  yields down to a `5ch` floor, the name after it, both with an ellipsis and never a clip.
  A review once found the name clipped and the version at 0px while this claim said
  otherwise, because the only band measured was the one whose name never overflowed.
- The two group headings, `In flight (n)` and `Shipped (n)`, read as **headings** for the
  bands beneath them rather than as rows in the list.
- The band's `<button>` reset holds **under a community theme** that styles `button` harder
  than the harness's stand-in baseline. This has been paid for twice already — once at the
  background and shadow, once at Obsidian's bare `button { height: 30px }`, which squashed a
  two-line band into one line's height and was invisible to every jsdom test.
- **Does `--text-error` read as a warning or as an error under that theme?** An overdue band
  spends four coordinated signals on that token — a rule down its leading edge, the date,
  the bar and the note — and a theme is free to make it shout.
- Tab reaches every band, in order; Enter and Space open a release; **Space does not scroll
  the list**. The focus ring is visible and lands on the band, not on a figure inside it.
- With a screen reader on, a band's spoken name pairs each figure with its heading. Nothing
  has heard one — the name is composed correctly by assertion only.
- **Under a non-default theme, the status chip draws grey** rather than adopting a state
  colour — a release's status is its own vocabulary, not the board's.
- The days figure reads right in all four shapes: days left, days overdue, shipped early,
  shipped late.

## Acceptance criteria

- Every band is reachable, readable and correctly spoken at a real width, in both schemes
  and under at least one non-default theme.

## Outcome

**2026-08-30 — exercised during development, not walked as a sweep.** The maintainer
reports testing this behaviour in a vault while 0.10.0 was built. That is evidence of use
and it is recorded as such; it is **not** a run of the steps below, which were not walked
one by one. Everything here that needs a community theme, a themed accent, a real pane
width or a screen reader is therefore still unanswered — those are the questions this note
exists for, and the ones development use is least likely to have asked. The note stays open
for the next sweep.

Not walked as a sweep.
