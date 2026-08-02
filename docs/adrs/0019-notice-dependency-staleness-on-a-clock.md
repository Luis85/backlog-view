---
adr: 19
title: Notice dependency staleness on a clock, verify it with the gate
status: Accepted
date: 2026-08-02
area: tooling
---

# ADR 0019 — Notice dependency staleness on a clock, verify it with the gate

## Context

[ADR 0005](0005-ship-with-no-runtime-dependencies.md) listed "nothing to audit on a
schedule" as a benefit of having no runtime dependencies.
[ADR 0018](0018-admit-runtime-dependencies-by-exception.md) superseded it and said so
plainly: "there is now a supply-chain surface at runtime." It did not say who would
watch it.

Nobody was. On 2026-08-02 a fresh install reported six vulnerable packages — five
advisories propagating through one `vitest` → `vite` → `esbuild` chain. The three that
set the severity:

| Package | Advisory | Severity |
| --- | --- | --- |
| `vitest` `<3.2.6` | [GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp) — the UI server reads and executes arbitrary files | critical, 9.8 |
| `vite` `<=6.4.2` | [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) — `server.fs.deny` bypass on Windows | high, 7.5 |
| `esbuild` `<=0.24.2` | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) — any site can read the dev server's responses | moderate |

**None of it was drift.** This repository's first commit is dated 2026-07-30, three days
before that audit. It pinned `vitest` 2.1.9, published **2025-02-03**, and `esbuild`
0.24.0, published **2024-09-22** — eighteen and twenty-two months old respectively on the
day they were first written down. The releases that fix the table above were already
available:
`esbuild` 0.25.0 on 2025-02-08, `vitest` 3.2.6 on 2026-06-01, and `vitest` 4.0.0 had been
out since 2025-10-22. The scaffold arrived stale and the first `npm install` imported
three published, already-patched advisories on day one.

That is the fact this decision has to answer, and it makes the diagnosis sharper rather
than softer. **`npm run check` was green on every commit**, correctly, because it was
working exactly as [ADR 0007](0007-npm-run-check-is-the-whole-gate.md) designed it: it
gates what a commit *did*. No commit here did this — the initial one did, and by then the
advisories were already history upstream. A commit-triggered check cannot notice what a
dependency arrived carrying, and it cannot notice a fact published on a day nobody
committed.

One thing the numbers overstate. **Every entry is a devDependency, and every one is a
development *server*** — the shipped `main.js` carries this project's code and the three
`@atlaskit` packages, none of which appeared in the audit. The exposure was to whoever
runs `npm run dev` or `vitest --ui` on this repository. No vault was ever reachable
through any of them, and a 9.8 that reads "critical" against a plugin is worth saying
plainly rather than leaving to be assumed.

## Decision

**Dependabot notices; `npm run check` verifies.** `.github/dependabot.yml` runs weekly
over npm and monthly over the workflow actions. Every pull request it opens runs the same
five steps as any other, so an upgrade is proven the way a feature is.

`npm audit` stays **out** of `npm run check`, and out of CI. Two reasons, and only the
second is decisive:

- `check` is the offline definition of done. An audit needs the network to answer.
- An advisory can be published with no patched version to move to. A gate in that state
  cannot be passed by fixing the change in hand — and ADR 0007's accepted cost was checks
  that fail *for unrelated reasons*, never checks that fail with **nothing the author can
  do**. A coverage threshold or a duplication warning can always be satisfied by the
  commit being written. That is the line, and audit is on the far side of it.

Grouping follows the same reasoning about what a reviewer can actually see. Dev
dependencies at patch and minor arrive as one weekly pull request, because eleven
separate ones is how the whole batch gets ignored. Anything reaching `main.js` — today
the three `@atlaskit` packages — is never in that group at any level: ADR 0018 admits a
runtime dependency against its **measured** bundle cost, and a bump is exactly where that
measurement stops being true unnoticed.

Two upgrades are refused on purpose and recorded in the config rather than in someone's
memory:

- **TypeScript goes to 6.0 and stops there.** 7.0.2 is released; `typescript-eslint` 8
  declares `typescript >=4.8.4 <6.1.0`, so npm refuses 7 outright rather than warning.
  What TypeScript 7 would cost is lint — the layer direction and the write boundary of
  [ADR 0003](0003-four-layers-enforced-by-lint.md) and
  [ADR 0004](0004-one-write-boundary-planning-separate-from-applying.md) are ESLint
  rules. Read literally, though, that same range **permits 6.0.x**, and this ADR shipped
  an `ignore` entry of `">=6"` that blocked a version upstream allows. TypeScript 6.0.3
  was published 2026-04-16 — before this repository's first commit — and it installs
  without conflict and passes all five steps with no source change. So the pin is
  `~6.0.3`: a tilde, not a caret, because 6.1 is exactly where the peer range ends. The
  constraint is the peer range, not the major number, so the entry is deleted when
  upstream moves, never widened.
- **`@types/node` tracks `engines`, not npm's newest.** Types for a Node this plugin does
  not claim to support would typecheck here and fail in a vault. It moves when the
  runtime floor moves, in the same commit.

## Consequences

- The failure this ADR exists for is now noticed by a clock rather than by someone
  happening to run `npm audit`. A weekly schedule would have raised all three of the
  advisories above within seven days of the initial commit, since every fix already
  existed when that commit was written.
- It is worth being blunt about what this does *not* fix. A scaffold can arrive stale, and
  the first week of a repository is exactly when nobody has looked yet. The schedule
  shortens that window; it does not close it. Reading `npm outdated` once when starting a
  project remains a manual act nothing here automates.
- A weekly pull request costs a CI run and a review, and most weeks it will be dull.
  Dullness is the intended steady state; the week it is not dull is what it is for.
- Dependabot will propose upgrades that cannot be taken — TypeScript 7 is one today.
  Refusing one now means writing the reason in `.github/dependabot.yml`, where it is a
  claim the next reader can check against the peer range, rather than closing a pull
  request with no comment.
- Those `ignore` entries are a place that can go stale in exactly the way this project
  dislikes: silent, and wrong in the safe-looking direction. Nothing checks them. The
  mitigation is that each names the *upstream fact* that would end it — and the
  TypeScript entry proved the hazard immediately, shipping as `">=6"` against a peer
  range that stops at 6.1. Naming the fact is what made the error findable: the range was
  written down beside the entry, so checking the claim took one reading rather than an
  archaeology dig.
- The version floors in `package.json` now match what CI has actually run, so a fresh
  `npm install` cannot resolve something older than what was verified.
- `obsidian` was specified as `latest` and is now `^1.13.1`. `latest` is not a range: it
  is invisible to Dependabot, and it resolves to whatever shipped this morning, so two
  developers running `npm install` a week apart typecheck against different typings while
  CI — which runs `npm ci` — sees neither. The caret keeps every 1.x typings release
  arriving automatically, which is the point of tracking them closely; it only makes a
  major an event someone agrees to.
- `vitest.config.ts` became `vitest.config.mts` under this upgrade — vite warns that a
  config using ESM syntax will stop loading when `configLoader: 'native'` becomes the
  default, and every other config in the repository is already `.mjs`.
- Measured coverage moved from 98.9/94.3/99.5/98.9 to 97.3/92.5/99.0/99.0 with no test
  lost: vitest 4 remaps v8's byte ranges onto AST nodes by default. The thresholds did
  not move — the rule is that they never drop — but the recorded measurement had to, and
  `vitest.config.mts` says why so the next reader does not go looking for a deleted test.

## Alternatives

- **`npm audit` as a sixth step in `npm run check`.** Rejected for the unpassable-gate
  reason above, and because it would make the gate need the network. ADR 0007's whole
  argument rests on `check` being cheap and always runnable.
- **`npm audit` as its own CI job on every pull request.** Same unpassable-gate problem,
  moved somewhere it blocks other people's work too. It also earns the objection ADR 0007
  raised against separate gates with their own schedules — a job whose red is routine is
  a job nobody reads.
- **Renovate.** More capable, and its extra capability is configuration this repository
  has no use for. Dependabot is native to the host, needs no app install, and the whole
  policy above fits in one file a reviewer reads in a minute.
- **Pin every version exactly and upgrade only when something breaks.** This *is* that
  policy, observed: the lockfile pinned everything, nothing ever broke, and the toolchain
  sat two majors behind on `vitest`, four minors behind on `esbuild` and one major behind
  on `eslint` — carrying a 9.8 the whole time. "Nothing broke" is not evidence, because
  a stale dependency's failure mode is that it keeps working.

## Revisit when

A weekly pull request gets merged without its check being read — that is the point the
clock has replaced attention rather than directed it. Or the `ignore` list grows past the
two entries above, which would mean the upgrade path is routinely blocked and the pinning
policy, not the schedule, is what needs deciding.
