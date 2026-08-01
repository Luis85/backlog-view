---
type: Issue
order: 60
parent: "[[Product Kanban]]"
status: Open
priority: P2
area: design
created: 2026-08-01
source: user request
---

# Pragmatic drag and drop is the board's interaction engine

## The decision

The board's drag layer is Atlassian's Pragmatic drag and drop
(https://github.com/atlassian/pragmatic-drag-and-drop), not a hand-rolled listener set.
Decided by the maintainer on 2026-08-01, recorded here with the constraints that have
to hold — open until the verification list at the bottom has been run, not because the
choice is in doubt.

## Why it fits

The spec was already standing on this library before it was chosen: the interaction
details in [[Drag a card to a new state]] and [[Keyboard, menu and touch]] came from
Atlassian's Pragmatic drag and drop design and accessibility guidelines — the two
mutually exclusive drop signals, auto-scroll that engages only toward an edge, no
keyboard drag mode (visible controls and menus instead, which is exactly the
menu-parity rule the review rounds hardened), and live-region announcements. Choosing
the engine those guidelines describe means the spec and the stack agree by
construction.

The facts that make it viable here, verified 2026-08-01:

- **Apache-2.0**, compatible with this plugin's MIT license; the bundled `main.js`
  must carry the license notice, which is an attribution obligation, not a conflict.
- **~4.7kB core, framework-agnostic**: the element adapter is plain DOM — no React —
  so it drops into `view/interactions/` beside the tree's existing modules.
- **Native drag and drop underneath**: it wraps the browser's built-in events, the
  same events the tree already dispatches in tests.
- The optional packages map onto already-specced behaviour one to one: auto-scroll →
  the edge rule, live-region → the announcements, and the hitbox package is *not*
  needed — with column order derived ([[Board order is derived not stored]]) there
  are no between-cards edges to detect.

## What it does not decide

- **The tree keeps its own drag code.** `view/interactions/dragDrop.ts` works and is
  covered; migrating it is a separate decision with its own evidence, after the board
  ships.
- **Touch stays a question for a device.** The library claims "full feature support"
  on iOS and Android; the ecosystem evidence in this epic says native drag events
  have historically not fired from touch in Obsidian mobile's WebViews. Both are
  claims about other people's platforms — the smoke test owns the verdict, and the
  menu path remains the answer that needs no verdict.

## Acceptance criteria

- A spike proves the jsdom harness can drive the element adapter the way it drives
  the tree — synthetic `dragstart`/`dragover`/`drop` with a supplied `dataTransfer` —
  or names the seam the board's tests use instead. This decides whether the board's
  write paths get the same real-interaction coverage the tree's have, so it runs
  before [[Drag a card to a new state]] is built, not after.
- This becomes the plugin's first bundled runtime library: the build inlines it, the
  Apache-2.0 notice ships with the bundle, and the bundle-size cost is measured and
  recorded rather than assumed near the advertised core size.
- [[Smoke test the board in a live vault]] gains the device answer: does
  pragmatic-powered drag work on Obsidian mobile, and does the long-press feel match
  the platform convention — or does touch stay menu-only.

## Outcome, so far

Two of the three are answered; the issue stays open for the device verdict alone.

- **The spike passed, 2026-08-01**: jsdom drives the element adapter with the same
  synthetic events the tree's tests dispatch, plus a supplied `dataTransfer` — no
  seam. It is kept as the standing proof in `test/view/pragmaticSpike.test.ts`
  (event helpers in `test/helpers/dnd.ts`), isolated from the board so a library
  upgrade that breaks jsdom compatibility names itself before a board test muddies
  it. One caveat: the library's dev builds warn that the board's scrollers are not
  scrollable under jsdom (they have no layout there) — noise, silenced in the
  release by the `NODE_ENV` define in `esbuild.config.mjs`.
- **Bundled, with the decision recorded**: ADR 0018 supersedes ADR 0005 and carries
  the license obligation and the measured before/after bundle size.
  `@atlaskit/pragmatic-drag-and-drop` 2.0.1 (element adapter), `-auto-scroll` 3.0.0
  and `-live-region` 2.0.0, all verified Apache-2.0 at install; the hitbox package
  stayed out, as decided.
- **Touch**: still a question for a device, owned by
  [[Smoke test the board in a live vault]].
