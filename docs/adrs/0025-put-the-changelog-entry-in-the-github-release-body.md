---
adr: 25
title: Put the changelog entry in the GitHub release body
status: Accepted
date: 2026-08-10
area: tooling
---

# ADR 0025 — Put the changelog entry in the GitHub release body

## Context

[ADR 0024](0024-keep-a-changelog-checked-against-the-version-bump.md) put a curated
`CHANGELOG.md` entry beside every version bump, checked against `manifest.json`. The
release workflow's `gh release create --generate-notes` call never reads it: a release
page on GitHub still shows only the auto-generated list of merged pull-request titles,
so someone reading the release directly — rather than the repository — sees exactly the
noisy list ADR 0024 exists to give a reader an alternative to.

## Decision

**The "Create release" step in `.github/workflows/release.yml` extracts the tagged
version's section of `CHANGELOG.md` and passes it as `--notes-file`, alongside the
existing `--generate-notes`.** `gh release create` prepends `--notes`/`--notes-file`
content ahead of the auto-generated notes, so the release body reads: the curated
summary first, the merged-PR list underneath.

The extraction is `scripts/changelog-notes.mjs`, exporting `changelogNotes(text,
version)` — everything between that version's dated heading and the next `## ` heading,
trimmed — covered directly by `test/release/changelogNotes.test.ts` rather than only
through the workflow step that calls it, the same reasoning `docs-markdown.mjs`'s
functions are tested for rather than only through `docs-check.mjs`.

## Consequences

- A release page is self-sufficient: the curated entry answers "what changed", the
  generated list answers "which pull requests", and neither requires opening
  `CHANGELOG.md` in the repository.
- The extraction step fails loudly — `changelogNotes` throws when `manifest.json`'s
  version has no matching heading — which is defence in depth rather than the primary
  gate: `test/release/changelogVersion.test.ts` already keeps that state off `main`. A
  release cut by manual dispatch on an unusual ref is the one path that check does not
  cover, and this is what catches it there instead, before a release publishes with a
  blank curated section.
- One more file `RELEASING.md`'s release step depends on, alongside the version files
  and `CHANGELOG.md` itself.

## Alternatives

- **Leave `--generate-notes` alone and rely on `CHANGELOG.md` in the repository.**
  Rejected: it asks a reader on the releases page — where GitHub sends watchers, and
  where most people land first — to go find a different file for the summary ADR 0024
  exists to provide.
- **Replace `--generate-notes` entirely with the changelog entry.** Rejected: the
  generated pull-request list is still useful to someone auditing exactly what merged,
  and combining costs nothing — `--notes-file` and `--generate-notes` are not mutually
  exclusive.
- **Extract the section inline in the workflow with `awk`/`sed`.** Rejected on the same
  grounds [ADR 0021](0021-parse-the-register-with-mdast.md) rejected hand-rolled
  Markdown patterns for the docs register: heading-boundary extraction has edge cases —
  the newest entry, the oldest entry with no next heading, a malformed one — worth a
  tested function rather than a pattern reviewed once and trusted at release time, the
  one moment redoing a failed attempt is expensive.

## Revisit when

`gh release create` ever stops combining `--notes-file` with `--generate-notes` the way
its documentation describes, or a release cut by manual dispatch on a ref whose
`CHANGELOG.md` disagrees with `manifest.json` reaches this step often enough that the
thrown error needs to be friendlier than a failed Actions step.
