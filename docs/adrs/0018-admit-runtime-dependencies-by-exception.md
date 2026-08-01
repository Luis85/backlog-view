---
adr: 18
title: Admit runtime dependencies by exception, starting with Pragmatic drag and drop
status: Accepted
date: 2026-08-01
area: tooling
supersedes: 5
---

# ADR 0018 — Admit runtime dependencies by exception, starting with Pragmatic drag and drop

## Context

[ADR 0005](0005-ship-with-no-runtime-dependencies.md) shipped the plugin with no runtime
dependencies and named its own reopening condition: "a need appears whose correct
implementation is genuinely hard and well-solved elsewhere." The kanban board is that
need. Its drag layer has to get column-targeted drops, edge-only auto-scroll and
screen-reader announcements right at once, the interaction spec in
`docs/requirements/` was written against Atlassian's design and accessibility
guidelines for exactly this problem, and the maintainer chose the library those
guidelines describe (`docs/issues/Pragmatic drag and drop for the board.md`). A
hand-rolled equivalent would re-implement a well-tested engine to keep a rule whose
own text said when to stop keeping it.

The facts that made the admission cheap to verify: Apache-2.0 (compatible with this
plugin's MIT, at the cost of an attribution notice in the bundle), framework-agnostic
plain-DOM adapters, and a jsdom spike proving the element adapter is driven by the
same synthetic events the tree's tests already dispatch — so the testing posture of
[ADR 0006](0006-jsdom-is-the-substitute-for-obsidian.md) survives the dependency.

## Decision

Runtime dependencies are admitted **one at a time, by exception**, and only when
ADR 0005's revisit trigger genuinely fires: the need is hard to implement correctly,
well-solved elsewhere, and the solving library fits the bundle a reviewer reads.
Each admission records its license obligation and its **measured** bundle cost —
minified and gzipped, before and after — never an advertised size.

The first admission is Atlassian's Pragmatic drag and drop, as the board's drag
engine only: `@atlaskit/pragmatic-drag-and-drop` (element adapter),
`-auto-scroll` and `-live-region` — not the hitbox package, because within-column
order is derived and there are no between-cards edges to detect. The bundle carries
the Apache-2.0 attribution in its banner. The tree keeps its own drag code;
migrating it is a separate decision with its own evidence.

Everything else 0005 decided stays in force: no YAML or frontmatter parser (Obsidian
is the one opinion about the user's notes), no tree or ranking library (the rules
here are too particular), no UI framework (the host owns the DOM), and the toolchain
stays as it was.

## Consequences

- The bundle is no longer only this project's code, and `main.js` is no longer fully
  reviewable as such. Measured on 2026-08-01, the increment that admitted it:
  66,645 → 108,444 bytes minified, 20,877 → 33,062 gzipped. By esbuild's metafile,
  ~32.1 kB of the minified growth is the dependency (28.5 kB across the three
  packages, 3.6 kB their transitive dependencies) and ~9.7 kB is the board feature's
  own code — roughly **seven times the "~4.7 kB core" the project page advertises**,
  because the core is not what a board ships: the element adapter, auto-scroll and
  the live region are. Measuring rather than assuming was the point of requiring
  this line.
- There is now a supply-chain surface at runtime and a license obligation to carry.
  Both are bounded by the one-at-a-time rule: every dependency present is one a
  recorded decision admitted, so the answer to "why is this in the bundle" is always
  a document, not archaeology.
- The interaction spec and the engine agree by construction — the drop signals,
  auto-scroll and announcement behaviour the requirements describe are the library's
  own guidelines implemented by its authors.
- `fallow`'s dependency hygiene now watches `dependencies` too: an admitted library
  that stops being imported must be removed, not left as bundle weight.

## Alternatives

- **Keep the rule absolute and hand-roll the drag layer.** Rejected: accessible
  drag-and-drop with correct cancel, auto-scroll and announcement behaviour is the
  kind of code that looks done long before it is; the tree's own `dragDrop.ts` covers
  a far narrower gesture. This is the first need in the project's life that met
  0005's own reopening test, and refusing it would make the rule an identity rather
  than a judgement.
- **Vendor the library into `src/`.** Rejected: same bytes without version tracking,
  licence clarity or upstream fixes — every 0005 cost with none of its benefits.
- **Adopt a general dependency policy with a size budget.** Rejected: one number
  cannot price unknown future needs. The one-at-a-time rule keeps each admission a
  recorded argument instead of a quota draw.

## Revisit when

A second admission arrives — if exceptions become routine, the rule is not an
exception rule and needs rewriting. Or Obsidian ships a first-party drag layer for
Bases views, which would make the engine a second opinion about the host's own
gesture.
