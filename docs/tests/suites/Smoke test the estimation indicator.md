---
type: Test suite
order: 35
status: Open
created: 2026-08-22
source: the indicator presets and open-note increment, 2026-08-22
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Smoke test the estimation indicator

The prioritization indicator and the note it is scored against: a seventh table column
that sorts, a panel line beside the confidence-adjusted value, a picker that configures a
framework in one act, and a control that opens the note being scored.

This suite exists beside the four projection suites rather than inside
[[Smoke test appearance and chrome]] because its cases are not only about appearance.
Two of them ask what Obsidian itself does — how a modal sizes and where it returns
focus, and how a leaf is split, pinned and reused — and neither is a stylesheet
question. The one case that IS appearance carries its own measurements rather than
borrowing that suite's.

Everything here was drawn against the real view, the real fixture and the real assembled
stylesheet in `npm run harness -- test/harness/estimation.ts`, and that harness draws
without asserting ([ADR 0020](../../adrs/0020-the-browser-harness-draws-it-does-not-assert.md)).
Where a case records a harness observation it says so and gives the window size, so a
reader can tell a measurement from a walk.
