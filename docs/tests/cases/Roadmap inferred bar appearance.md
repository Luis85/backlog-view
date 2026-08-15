---
type: Test case
order: 30
parent: "[[Smoke test the roadmap]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-02
source: Feature Test epic; still owed from the previous roadmap increment
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Roadmap inferred bar appearance

A verification to run.

## Why this exists

**Looked at once**, in the maintainer's 2026-08-02 pre-release run, which reported no
problems. That is not the per-point record this note asks for, so it stays open — and its
sharpest point is a judgement rather than a check: whether an unclosed dashed edge reads as
"this continues, unknown" or as a rendering glitch. The acceptance criteria below ask for
that written down either way, and it has not been. [[Spans roll up the tree]] shipped the
`pbl-bar-inferred` class (outlined rather than filled) on jsdom structure tests alone —
the class reaching the DOM is checked, the pixel it produces is not — and it has stayed
unrun through every roadmap increment since. `docs/Product Backlog.base` now gives
`Scheduling work` (a Feature with dated descendants but no dates of its own) a real
inferred bar to look at, next to ordinary stated bars on the same grid, which is the
first chance to run this check at all.

The `due`/`start` dates on `[[Drag from the shelf to schedule]]` and
`[[Move and resize a bar]]` — both still `status: Open` — are FIXTURES planted so this
check has something to look at, not commitments about when those PBIs will be built. The
register's own rule is that every note states the evidence it rests on, and two invented
dates on unbuilt work would otherwise read as promises nobody made.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with `docs/Product Backlog.base` showing the tree.

## How to check

Switch to the roadmap's dated axis.

- Find `Scheduling work`'s bar (inferred, spanning its dated descendants) beside an
  ordinary stated bar. Confirm the inferred one reads as a **dashed outline**, not
  filled, in both light and dark themes — and that the two are told apart at a glance,
  not only on close inspection.
- Compare the same outline against `.pbl-timeline-row.pbl-done .pbl-bar`'s green
  override, on a done item's bar if one is dated. Confirm the outline still reads as
  outline-not-filled against the green, in both themes.
- Look specifically at a dashed bar whose end is open (no date on that side, filled from
  a child): does the unclosed dashed edge read as **"this continues, unknown"**, or does
  it read as a rendering glitch — a line that just stops? This is a judgement call, not a
  class assertion, and it is the reason this note exists.
- On that same comparison, find a bar with descendants (dated or inferred) and confirm
  its progress band carries a visible hairline separating the band from the bar — not
  just on the green-on-green done case the hairline exists for, but on an ordinary
  state-coloured bar too, where the fix must not have made anything worse. Measured in
  Chromium's DEFAULT colours (`npm run harness`, `.superpowers/harness-band-fix.md`,
  2026-08-15): a done row's band, an inferred bar's dashed border, and an open end's
  gradient all still read correctly against it. **What a vault still owes**: a themed
  vault's own colours — a community theme can replace `--background-primary` (the
  hairline's own colour) with something closer to a bar colour than Obsidian's default
  is, which is exactly the kind of collision this fix exists to survive, and no harness
  pass can say whether it does.

## Acceptance criteria

- All three points checked in both themes, with the open-edge judgement written down
  either way — "reads as open" or "reads as broken" — not left implicit.
