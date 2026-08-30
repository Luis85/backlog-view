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

**Who writes a file decides which rules it is held to.** The full set below is the
contributor's, and it stops at `docs/`. The backlog is a vault: its owner writes notes in
Obsidian and commits them to `main`, `.github/workflows/ci.yml` runs on a push to `main`,
and `release.yml` will not publish until that run's `verify` check is green — so a rule that
fires on ordinary typing does not tidy the register, it turns main red for somebody who was
writing a note and holds the next release until they learn a rule nobody told them about.
`docs/.markdownlint.jsonc` therefore narrows the set there to `MD056`, where a table row
loses cells; `MD011`, a link written backwards that renders as dead text; and `MD042`, a
link with no destination. `MD055` was a fourth until 2026-08-30, on the reasoning that a
missing outer pipe loses a cell from the other direction. It does not: GFM strips the outer
pipes before counting, so such a row parses like its neighbours, and what MD055 fires on is
rows that disagree about outer pipes — style, in the one file that has none. Removed, with
the check in that file's own comment. A blank line before a list, a tab-indented
sub-list, a pasted bare URL, a fence with no language — all of it is how Obsidian writes
Markdown, all of it renders correctly in Obsidian and on GitHub, and none of it fails
anything. The one-time normalisation stands; enforcing it on notes written from here is what
is given up, and the owner's own workflow is worth more than the enforcement. Nothing in
that file touches `docs-check.mjs`, which gates the rules that are actually about this
backlog.

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
- The gate was verified the way [ADR 0007](0007-npm-run-check-is-the-whole-gate.md) requires,
  by planting the violation and watching it fail: a broken table in `docs/README.md`, then
  the same table under `docs/superpowers/` and under a vendored skill and watched being
  ignored, so the exclusions are known to exclude rather than assumed to. The narrowing was
  planted from both directions too — a note written the way Obsidian writes one (a
  tab-indented sub-list, a list against the paragraph above it, a pasted bare URL, no
  trailing newline) passes under `docs/`, and a table that drops a cell in the same folder
  still fails. Nested-config precedence itself was checked on a scratch tree before the real
  one was written, because a config that silently did not apply would read exactly like a
  register with nothing wrong in it.
- **A note the owner writes is not held to Markdown style, and a note that loses content
  still fails.** That is the whole of what the split buys, and what it costs is drift: the
  one-time normalisation is not defended, so `docs/` will slowly stop being uniform. The
  alternative was a red `main` for somebody who was writing a note.

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
  notes a reader actually reads stay unchecked — which is where the broken table was. The
  nested config is this alternative done at rule granularity instead of file granularity:
  the notes are still read, for the rules that matter there.
- **Run the full set on `docs/` but skip `lint:md` on a push to `main`.** It protects the
  owner and keeps one rule set — and it makes the next contributor's pull request fail on
  violations somebody else pushed, which is the worst place to learn about them. Linting
  only the changed files instead is machinery for a problem the nested config answers with
  a file.

## Revisit when

A rule that is off starts hiding a defect that reaches a reader. The three line-oriented ones
are the candidates: if `markdownlint` learns to read them off the parsed document, the reason
they are off has expired.

**One content-loss shape is known and NO rule in this tool sees it.** An ordered list may
interrupt a paragraph only when it starts at `1.`, so a note whose `Steps:` line sits
directly above `2. …` renders the whole list as part of that paragraph, in Obsidian and on
GitHub alike. It is invisible to markdownlint for the same reason it is loss: the linter
parses what the renderer parses, both see one paragraph, and MD032 has no list to find
unsurrounded — a run with `default: true` reports nothing on it. So this is not a rule
refused above; it is a gap under the whole gate, and turning more rules on does not close it.

`docs/` was measured for it rather than assumed clean, by rendering every note with
`markdown-it` and looking for a digit-led line inside a `<p>`. Two hits, both false: prose
wrapping onto `100. So the score…` and `3) says the toggle…`, which are the very case the
CommonMark rule protects. The shape an author would lose a list to is not in the register
today. Revisit if a rule scoped to a list that fails to interrupt appears, or if that scan
ever returns a real one. Found by review, PR #233.
