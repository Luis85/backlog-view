---
adr: 24
title: Keep a CHANGELOG.md, checked against the version bump
status: Accepted
date: 2026-08-10
area: tooling
---

# ADR 0024 — Keep a CHANGELOG.md, checked against the version bump

## Context

The release workflow already produces release notes — `gh release create
--generate-notes` in `.github/workflows/release.yml` — generated from the titles of
merged pull requests. That is a record of what merged, not a summary written for someone
deciding whether to upgrade: several of this repository's own merges are Dependabot
bumps and doc-only or test-only changes, so a title list is noisy exactly where a reader
wants signal. [ADR 0016](0016-break-compatibility-freely-before-1-0.md) already assumed
one existed — "the version number carries the warning... and the changelog says what
broke" — without one having been built.

## Decision

**`CHANGELOG.md` at the repository root, in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
format, and `test/release/changelogVersion.test.ts` fails whenever `manifest.json`'s
version has no matching `## [x.y.z]` heading as the first one below `[Unreleased]`.**

A pull request that changes what the plugin does adds its own bullet under
`## [Unreleased]` as it merges. `RELEASING.md`'s version-bump step (step 1) renames that
heading to the version and date, in the same commit as the bump — see the rule stated
there. The test is what turns "in the same commit" into something other than memory:
a bump that forgot the entry fails `npm run check` on the pull request.

## Consequences

- A user deciding whether to upgrade reads prose written for them, not a list of PR
  titles or a diff.
- One more thing a version-bump PR must remember, same as `versionFiles.test.ts` already
  made of `manifest.json`/`package.json`/`versions.json` — backed by a failing test
  rather than a step someone has to recall.
- The check can be satisfied by an empty heading with nothing under it; it verifies the
  version and the heading agree, not that the entry says anything true. Stated narrowly
  on purpose, the same limit `versionFiles.test.ts` accepts for its own assertions.
- `--generate-notes` keeps running unchanged. This file does not replace the release's
  own notes; it is the curated companion the auto-generated list was never trying to be.

## Alternatives

- **Rely on `--generate-notes` alone.** Already running, and rejected for the reason
  above: a title list is not written for a reader, and this repository's own merge
  history is heavy with entries — dependency bumps, doc- and test-only changes — that a
  changelog reader has no use for.
- **A changelog with no check.** Refused on the same argument `../CLAUDE.md`'s Claims
  section makes generally: a rule stated only in `RELEASING.md`'s prose is unchecked, and
  an unchecked "always do X with every release" is the exact shape of defect that section
  warns reads as settled right up until it is not.
- **Gate every merged pull request on touching `CHANGELOG.md`.** Rejected as the wrong
  granularity: not every merge is user-facing — this repository's own commit history
  is full of ones that are not — and a gate would have to guess which are, which is a
  judgment call no automated check here can make. Gating the version bump instead asks
  only "does the released version have an entry," which is the one thing that must always
  be true.

## Revisit when

The version-heading check passes on an entry added only to satisfy it — empty, or
copy-pasted from the previous release — often enough that the heading-only guarantee
stops being worth the false confidence. Or the format needs categorized sections
(`### Added` / `### Changed` / `### Fixed` / `### Removed`) enforced too, rather than left
to Keep a Changelog's own convention.
