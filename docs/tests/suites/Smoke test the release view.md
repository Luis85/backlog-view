---
type: Test suite
order: 36
status: Open
created: 2026-08-23
source: the release-management increment, whose every visual claim is jsdom-only
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Smoke test the release view

`product-release`, the plugin's third registered Bases view — the one that creates notes and
its own config and never edits a note that already exists: the index of every release, one
release's scope as a tree, and the four empty states between them — plus, from
[[Setting an item's release]], the one thing that puts work into a scope at all, which is a
menu on the BACKLOG view rather than anything on this one, and, from
[[Creating a release from the release view]], the one thing that makes a release at all,
which is a control on this one.

**This suite exists because the increment shipped with nothing having looked at it.** Every
visual and assistive-technology claim on it rests on jsdom, which computes no layout and no
styles, plus two ad-hoc headless-Chromium runs against markup reproduced by hand. That gap
is not theoretical: it is exactly how `display: contents` on a release row — which makes the
row unfocusable, so Tab skips it and `.focus()` does nothing — survived eight tests, two
reviews and a fix round before a browser was finally asked. `npm run test-build` bundles into
`.obsidian/plugins/<id>/` in the repository root, and `docs/Product Backlog.base` is a real
base in this plugin's own schema, so the plugin can display its own register.

## What to look at

**This list is now carried by the cases beneath this suite**, and they are where it is
maintained. It used to live here, under this heading, and that is precisely why the release
view was absent from `RELEASING.md`'s pre-tag sweep for its whole first release: the query
reads notes in `docs/tests/cases/` that carry `## How to check` as a whole heading line and
declare a `cadence:`. A suite note carries none of those. `docs-check.mjs` names that gap in
its own comment — *a verification that declares itself nowhere* — and holds the two halves of
the convention to each other for notes that DO declare themselves, which this one never did.
So nothing was broken and nothing failed; the checks simply could not be found.

Five cases now declare it:

- [[Release view registration and options]] — the view picker, the icon, every declared
  option, and the identity a picked release survives on.
- [[The release index band]] — the two-line band that replaced the column grid, its widths,
  its focus order, its spoken name, and the two tokens a theme can turn against it.
- [[A release's scope and its creation menu]] — the second tree, its toolbar, its keyboard
  walk, and the context menu that creates a note into the open release.
- [[Making a release, and putting work in one]] — `New release` in both its positions, where
  a release lands on disk, and `Set release` on the backlog's own row menu.
- [[Closing a release, and its generated notes]] — `Mark as released` and `Generate release
  notes`, which post-date everything above and are the two riskiest actions the plugin has.

What stays here is the **argument** above: why a suite exists for this view at all, and what
`display: contents` cost before a browser was asked. The cases carry the what; this note
carries the why.

## Outcome

**2026-08-30 — exercised during development, not walked as a sweep.** The maintainer
reports testing this behaviour in a vault while 0.10.0 was built. That is evidence of use
and it is recorded as such; it is **not** a run of the steps below, which were not walked
one by one. Everything here that needs a community theme, a themed accent, a real pane
width or a screen reader is therefore still unanswered — those are the questions this note
exists for, and the ones development use is least likely to have asked. The note stays open
for the next sweep.

Not walked as a sweep. The creation gesture added on 2026-08-25 is unrun with the rest of it, and so is
the band that replaced the index's column grid the same day. **This paragraph said "nothing
in either increment has been seen in Obsidian" until the stamp above corrected it** — the
maintainer has since used both while building. What that changes is narrow and is the whole
reason the distinction is kept: use answers whether a thing works, and a sweep answers the
questions listed above it, which are mostly about a theme, an accent and a width. Neither the
browser harness nor a headless-Chromium measurement is a substitute for the second: both answer layout against Obsidian's DEFAULT colours and neither
answers a theme, an accent, or anything Bases hands the view. The pull request's test-plan box
for this is deliberately unticked, and stays unticked until a maintainer has opened a vault
and worked through the five cases beneath this suite. `Mark as released` and `Generate release
notes` joined the view after this note was written and are unrun with everything else — the
first thing here that writes a FILE rather than a property, which is why its case is the one
`P1` among the five.
