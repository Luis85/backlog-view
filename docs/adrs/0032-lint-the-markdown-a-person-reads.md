---
adr: 32
title: Lint the Markdown a person reads, and only for what renders wrong
status: Accepted
date: 2026-08-30
area: tooling
---

# ADR 0032 — Lint the Markdown a person reads, and only for what renders wrong

## Context

`docs/` is a backlog written in Markdown, and nothing checked the Markdown. `docs-check.mjs`
gates what the register *means* — hierarchy, sibling orders, wikilinks, source paths, the
use-case shape, the ADR frontmatter — and reads every document through `mdast`
([ADR 0021](0021-parse-the-register-with-mdast.md)), so a malformed table parses into
whatever it parses into and no rule has an opinion about it.

That gap is not theoretical. `docs/requirements/View options and config warnings.md` held a
three-column table whose row contained `` `placeholder: homeFolder || 'Home folder'` ``. GFM
splits a row on `|` before it parses anything inline, so the code span did not protect the
two pipes: the row was five cells wide in a three-column table, and every renderer dropped
the last two. The note had been wrong on screen since it was written, and the checker that
reads it could not say so because it was never asked to.

`CHANGELOG.md` held the same class of defect at a larger scale: `## [Unreleased]` carried
three separate `### Added` sections, three `### Changed` and three `### Fixed`. Keep a
Changelog ([ADR 0024](0024-keep-a-changelog-checked-against-the-version-bump.md)) has one of
each per version, and `test/release/changelogVersion.test.ts` checks that the version has a
section — not that it has one.

`eslint.config.mjs` had already refused the obvious answer, and for a reason that still
holds: a Markdown plugin added to the code linter "would otherwise arrive owning three
hundred notes". The refusal is of a *code* linter growing an opinion about prose, not of
checking Markdown at all.

## Decision

**`markdownlint-cli2`, configured in `.markdownlint-cli2.jsonc`, as `npm run lint:md` and
the sixth step of `npm run check`.**

Sixth rather than separate, because [ADR 0007](0007-npm-run-check-is-the-whole-gate.md) is
that the gate is one command and its stated revisit condition is the command getting slow.
This step is about a second on 635 files, so it is inside. That is the opposite of
[ADR 0022](0022-audit-what-ships-beside-the-gate.md)'s call on `npm audit`, and for the
opposite reason: this run is deterministic and local, where an audit's verdict changes
without the tree changing.

Two decisions sit in that config, and both are scope rather than taste.

**What it reads is what a person maintains.** The register, the root files, the workflow
READMEs, and the three skills this repository wrote. It does not read `docs/superpowers/` —
generic `brainstorming` and `writing-plans` output, already exempt from `docs-check.mjs` for
the same reason: those are records of what a session was going to do, and reformatting one
rewrites history to no end. It does not read the vendored skills under `.claude/`, which are
third-party files installed into the tree and read the way `node_modules` is.

**What it gates is Markdown that renders wrong**, never house style. A list glued to the
paragraph above it, a fence with no blank line around it, a table whose cell count disagrees
with its header, a section heading written twice under one parent. The line-length rule, the
table-alignment rule and the emphasis-as-heading rule are off: this register wraps near 90
columns and opens paragraphs with a bold lead-in, on purpose, in prose somebody wrote.

**The three line-oriented rules are off, and that was measured rather than assumed.** MD018,
MD037 and MD038 read a line instead of the parsed document, and this register wraps its prose
— so a code span, a `[[wikilink]]` and a bold run routinely break across two lines, which is
exactly what those rules misread. With them on, `--fix` rewrote
`docs/bugs/A hash in a value is a comment the first rewrite erases.md` from "in a plain
scalar, `` ` #` `` begins a comment" to "`` `#` `` begins a comment" — which is false, since
YAML starts a comment at SPACE-hash and the space is the entire bug — and read a `#56` inside
a wrapped code span as a heading, editing a quoted frontmatter value inside the record of
what that value had been. A gate that corrupts the evidence it is checking is worse than no
gate. It is the same finding ADR 0021 made one layer down, which is why `docs-check.mjs` is
a parser and not a pile of patterns.

## Consequences

- The one-time repair was 466 findings across 35 files. All but four classes were
  whitespace: trailing spaces, blank-line runs, list-marker spacing, missing blank lines
  around headings and fences. The four that were not: the broken table above, the changelog's
  duplicate sections merged with every content line preserved, 26 bare URLs made autolinks,
  and 66 fences given a language — 56 of them `text`, because they hold ASCII diagrams and
  mock screens rather than code.
- **A rule is only on if its violations were fixed rather than silenced.** Every rule left
  enabled reports zero today, so the next report is a change somebody just made.
- The gate was verified the way [ADR 0007](0007-npm-run-check-is-the-whole-gate.md) requires:
  a broken table planted in `docs/README.md` and watched failing, and the same table planted
  under `docs/superpowers/` and under a vendored skill and watched being ignored, so the
  exclusions are known to exclude rather than assumed to.
- A new note now has to be well-formed Markdown to commit, which is a cost paid at write
  time instead of by a reader looking at a row that lost two cells.

## Alternatives

- **A Markdown plugin inside `eslint`.** Refused already, in the config's own words, and the
  refusal is right: the code linter's ignore list is where a prose opinion goes to be argued
  about at the wrong altitude.
- **`remark-lint`.** The same rules through the `unified` ecosystem this repository already
  parses with. Rejected on dependency count for no gain — `mdast-util-from-markdown` is a
  library `docs-check.mjs` calls, and a lint *runner* is a different job from a parser.
- **New rules inside `docs-check.mjs`.** It would mean writing table-cell counting and fence
  balancing against a parser that already knows both. The register's own rules are what that
  script is for.
- **Lint everything, `docs/superpowers/` included.** Thousands of edits to generated records,
  to make history conform to a style it was never written in.
- **Leave `docs/` out and lint only the root files.** Twenty findings, and the three hundred
  notes a reader actually reads stay unchecked — which is where the broken table was.

## Revisit when

A rule that is off starts hiding a defect that reaches a reader. The three line-oriented ones
are the candidates: if `markdownlint` learns to read them off the parsed document, the reason
they are off has expired.
