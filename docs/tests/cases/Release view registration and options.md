---
type: Test case
order: 10
parent: "[[Smoke test the release view]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-30
source: the 0.10.0 release review — the release suite held its checks under `## What to look at`, which the sweep query cannot see
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Release view registration and options

A verification to run.

## Why this exists

[[Smoke test the release view]] states these as prose under `## What to look at`. That
heading is not the one `RELEASING.md`'s sweep query matches, and a suite note carries no
`cadence:`, so **the whole release view was absent from the pre-tag checklist while
reading as covered** — the gap `docs-check.mjs` names in its own comment: a verification
that declares itself nowhere. This note and the four beside it declare it.

Registration and the options menu are the two things no test in this repository reaches:
`main.ts` registers the view with Obsidian, and the options come from Bases.

**Preconditions** — `npm run test-build` has installed the plugin into
`.obsidian/plugins/product-backlog-view/` in this repository, the repository is open as a
vault with Restricted Mode off, Bases is enabled, and `docs/Product Backlog.base` is open.

## How to check

- The view appears in the Bases view picker under its own name, with the `lucide-package`
  icon **resolving** rather than falling back to a placeholder.
- Every option `getReleaseViewOptions` declares appears in the view-options menu. Count the
  menu against that function rather than against a number written here — three notes in
  this repository once stated three different totals.
- **Can Obsidian's property picker offer a released-date property that no note in the vault
  yet carries?** The two closing actions are withheld until it is bound, so this decides
  whether a fresh vault can reach them at all without the ✨.
- Binding the released-date property to the target-date property is **refused where it is
  entered**. Try it and read the refusal.
- `resolveViewIdentity` finds the leaf for a `.base` file: pick a release, switch to another
  view, switch back, and the same release is open. The persistence rests on it and fails
  silently.

## Acceptance criteria

- The view registers with its own icon, every declared option is offerable, and a picked
  release survives a round trip through another view.

## Outcome

**2026-08-30 — exercised during development, not walked as a sweep.** The maintainer
reports testing this behaviour in a vault while 0.10.0 was built. That is evidence of use
and it is recorded as such; it is **not** a run of the steps below, which were not walked
one by one. Everything here that needs a community theme, a themed accent, a real pane
width or a screen reader is therefore still unanswered — those are the questions this note
exists for, and the ones development use is least likely to have asked. The note stays open
for the next sweep.

Not walked as a sweep.
