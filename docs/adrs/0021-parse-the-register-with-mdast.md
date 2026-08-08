---
adr: 21
title: Parse the register with a Markdown library, not a pile of patterns
status: Accepted
date: 2026-08-08
area: tooling
---

# ADR 0021 — Parse the register with a Markdown library, not a pile of patterns

## Context

`docs-check.mjs` read Markdown with hand-written patterns: fences stripped by one regex,
code spans by another, sections found by a line anchor, link destinations by an
alternation, frontmatter by an anchored slice. Every rule in the file was built on that
layer, and it was never tested on its own — only *through* the gate, on documents planted
to exercise rules.

**Every defect the checker has had came from that layer, and none from a rule.** Four,
across its life:

| Defect | Direction | Cost |
| --- | --- | --- |
| `](<A slice.md>)` rejected — a bracketed destination is how CommonMark writes a space, and this register is full of names with spaces | false **failure** | a legal link blocked; the contributor's likely response is to rewrite the link and learn a rule that does not exist |
| A CRLF checkout read as 136 broken documents | false failure | the whole register, on an ordinary Windows clone |
| A `[[wikilink]]` the 100-column wrap breaks across two lines | false failure | documented as a limitation *with no detection*, so it stayed |
| A `**Checked by**` citation wrapped the same way, matching nothing | false **pass** | the rule silently checked nothing while the run stayed green |

Two of those blocked correct documents, which this project holds to be the more expensive
direction. The fourth is worse than its severity suggests: a rule that quietly does
nothing on input it cannot parse reads exactly like a rule that works.

The pattern is not carelessness in any one regex. It is that a Markdown document has a
grammar, the patterns approximate it, and the approximation is wrong at exactly the
constructs a register full of long prose and long filenames actually uses.

## Decision

**`docs-check.mjs` reads documents through `docs-markdown.mjs`, which is `mdast`.**
Development dependencies: `mdast-util-from-markdown`, plus `micromark-extension-gfm-table`
and `mdast-util-gfm-table`. Nothing ships — the gate is a CI script, so unlike
[ADR 0018](0018-admit-runtime-dependencies-by-exception.md) there is no bundle cost to
measure and no license notice owed in `main.js`.

That module is the seam, and it is **tested directly** (`test/docs/markdown.test.ts`) —
which is the other half of the decision. The corpus files prove the RULES behave; nothing
proved the layer beneath them did, and that is why four parser bugs reached CI.

GFM tables are enabled because the register is written in them. Plain CommonMark makes a
table one paragraph, so backticks pair across ROWS — which put a `[link](x.md)` written as
an example in one cell outside every code span, and reported two deliberately-broken
examples as broken links.

## Consequences

Three of the four defects above are now impossible rather than fixed: destination forms,
CRLF and code-span boundaries are the parser's. The wrapped wikilink is fixed — that link
resolves now, where before it was a documented limitation nobody could detect.

`docs-markdown.mjs` exposes `prose` (code blanked, **offsets preserved**) beside
`collapsed` (code removed, gap closed). That is not a redundant pair: a caller matching
words that must be adjacent needs the sentence, and a caller holding an index needs the
index. The hand-rolled stripper only ever did the second, so the distinction had to be
discovered — by four use cases being reported as tables with no Actor row.

Thirty-two packages arrive where there were none. That is the real cost, and it is
mitigated only by what ADR 0019 already put in place: Dependabot notices, `npm run check`
verifies.

## Alternatives

**`marked`** — one package, no dependencies of its own, and correct on every destination
form. It was implemented and rejected: it reports **no source positions**, so the module
derived them by accumulating token text, and that derivation was wrong within the hour.
Inside an indented list item a paragraph's `raw` carries per-line indentation its `text`
does not, so inline offsets drift, and blanking a code span wiped twenty characters of a
`[[wikilink]]` instead. A table's cells drift the same way for a different reason. The
lesson is the ADR's own thesis one level down: **deriving positions a parser declines to
publish is writing the parser again, in the place it is hardest to check.**

**`markdown-it`** — 39 packages, more than `mdast`, with no advantage here.

**Keep hand-rolling, and add tests for the layer.** Tests would have caught the four
defects above only if someone had thought of those four constructs; the parser is correct
on constructs nobody here will think of. The tests were written anyway, because they are
what makes an upgrade safe.

## Revisit when

A defect appears that the parser causes rather than prevents, or the dependency count
becomes the thing that hurts — at which point `marked` is the fallback, and the price of
returning to it is stated above: someone must own the offset derivation and prove it over
the whole register.
