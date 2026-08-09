---
adr: 22
title: Audit what ships, beside the gate rather than inside it
status: Accepted
date: 2026-08-09
area: tooling
---

# ADR 0022 — Audit what ships, beside the gate rather than inside it

## Context

[ADR 0019](0019-notice-dependency-staleness-on-a-clock.md) put `npm audit` out of
`npm run check` and out of CI entirely, leaving Dependabot's clock as the only thing
watching the supply chain. Its two reasons were stated in order of weight:

- `check` is the **offline** definition of done ([ADR 0007](0007-npm-run-check-is-the-whole-gate.md));
  an audit needs the registry to answer.
- An advisory can be published with **no patched version**. A gate in that state cannot
  be passed by fixing the change in hand, and ADR 0007's accepted cost was checks that
  fail for unrelated reasons — never checks that fail with nothing the author can do.

Both hold. What ADR 0019 did not separate is that they are objections to two different
things. The first is an objection to putting audit **in `check`**. The second is an
objection to a gate that can go **permanently red**, and its force depends entirely on
how much of the tree is being audited.

ADR 0019 supplies the number that matters. Every advisory in the audit that prompted it
was a devDependency, and every one was a development **server** — `vitest`, `vite`,
`esbuild`. None of them reaches `main.js`, which carries this project's code and the
three `@atlaskit` packages ([ADR 0018](0018-admit-runtime-dependencies-by-exception.md)).
So the tree that can hurt a vault is three packages, and the tree that produced the
unpassable-gate hazard is the rest.

Nothing here relitigates ADR 0019's diagnosis, and its Dependabot policy, its grouping
and its two recorded pins all stand unchanged. What changes is one clause: that audit
runs nowhere.

## Decision

**`npm audit --omit=dev --audit-level=critical` runs as its own CI job, and as
`npm run audit` locally. `npm run check` is unchanged.**

The scoping is the whole argument:

- **`--omit=dev`** audits what ships. A dev server's advisory is a fact about whoever
  runs `npm run dev` on this repository, which is worth a weekly pull request and is not
  worth blocking a merge. A runtime dependency's advisory is a fact about every vault the
  plugin is installed in.
- **`--audit-level=critical`** because the unpassable-gate hazard is real and this is
  what keeps it rare. Everything below critical still prints; only a 9.0+ stops a merge.
  The residual risk is named rather than argued away: a critical advisory against an
  `@atlaskit` package with no patched version WOULD block merges. Three packages and one
  severity band is the smallest surface on which that can happen, and if it does, the
  answer is a decision about that dependency rather than a broken gate — ADR 0018 admits
  a runtime dependency by exception, so an unfixable critical in one is exactly the
  exception being withdrawn.
- **Its own job, not a sixth step**, so `check` stays offline and stays passable by the
  commit being written. The two failures now read differently because they are different:
  a red `verify` is something the author did, a red `audit` is something the world did.

## Consequences

- The supply chain is watched by two things that fail differently. Dependabot notices
  staleness on a clock and proposes; the audit job refuses a merge over a critical in
  shipped code. Neither is the other's backstop, and the gap between them — a
  non-critical advisory in a runtime dependency — is a weekly pull request rather than a
  block, which is the intended trade.
- Every advisory ADR 0019 was written about would be INVISIBLE to this job. That is
  correct and worth stating plainly, because it is the obvious objection: those were dev
  servers, Dependabot is what raises them, and it did.
- `npm run check` can still be run on a plane. That property was ADR 0007's, is load
  bearing for the definition of done, and is the reason this is not a sixth step.
- A merge can now be blocked by something no commit caused. The severity floor and the
  `--omit=dev` scope are what make that a rare and meaningful event rather than a routine
  red — and a routine red is what ADR 0019 correctly said nobody reads.
- One platform runs it, where `verify` runs two. An advisory is a fact about the
  lockfile, which is the same on both; the matrix exists for path separators and line
  endings, which an audit does not have.

## Alternatives

- **A sixth step in `npm run check`.** What was asked for first, and refused on ADR
  0019's own offline argument, which this decision does not weaken.
- **Auditing the whole tree including devDependencies.** This is the version that
  produces the permanently-red gate ADR 0019 describes, and the version whose findings
  Dependabot already raises. It buys a faster signal on exactly the class that cannot
  reach a vault, at the cost of the gate's credibility.
- **A scheduled job rather than a gate.** Blocks nobody, and earns ADR 0019's own
  objection to jobs with their own schedules: a red that is routine is a red nobody
  reads. Dependabot already occupies the clock role, and better, because it arrives with
  the fix attached.
- **A lower severity floor.** `high` was the recommendation and `critical` was chosen.
  The difference is the width of the band in which a merge can be blocked by something
  unpatched, and moving it is one word in `package.json` if the current floor proves too
  quiet.

## Revisit when

The audit job blocks a merge over something with no fix — that is the hazard ADR 0019
named, arriving, and what to do about it is a decision about that dependency under ADR
0018 rather than a decision about this job. Or a critical advisory reaches a vault
through a runtime dependency and this job did not raise it, which would mean the scope
is wrong rather than the floor.
