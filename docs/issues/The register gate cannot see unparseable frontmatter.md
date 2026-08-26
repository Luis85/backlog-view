---
type: Issue
order: 210
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P2
area: verification
created: 2026-08-26
source: Whole-branch review of the release-index-design branch, 2026-08-26 — the reviewer planted a note and ran the gate
files:
  - scripts/docs-check.mjs
  - scripts/docs-markdown.mjs
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The register gate cannot see unparseable frontmatter

## The limitation

`docs-check.mjs` never parses YAML. It reads a note's frontmatter by matching each field it
cares about with a line pattern — `^name:\s*(.+)$` against the block between the two `---`
fences — so a block that no YAML parser will accept still answers every question the gate
asks, and the gate exits **0**.

## Evidence

Established by execution during the whole-branch review on 2026-08-26. A note was planted
carrying an early-closing quoted scalar in its frontmatter — the shape a hand-typed
`parent: "[[Some note]"` or a stray quote inside a `source:` line produces. `js-yaml`
refuses the block outright; `npm run docs` reported no finding and exited 0.

What that costs is not cosmetic, because the register is a **vault**. Obsidian parses the
same block as YAML, so a note whose frontmatter it refuses has no `type`, no `status` and no
`parent` at all: it drops out of the tree the plugin draws, out of every rollup, and out of
the group its siblings are ranked in — while the gate that exists to keep the register
readable says the register is fine. That is also why an earlier finding on this branch
needed a fix round: the gate could not see the shape that caused it.

## Why it is recorded rather than fixed

This is the repository's own **"a category invariant is checked at the forbidden thing"**
rule unmet in the gate that enforces that rule for everything else. The forbidden thing here
is *frontmatter Obsidian cannot read*, and the only instrument that can see it is a YAML
parser — so the fix is one `js-yaml` (or equivalent) parse per note, before any field is
matched, failing the run with the parser's own message.

That is a **dependency decision, not a review edit**. `js-yaml` is not currently a
dependency of this repository, and ADR 0019 and ADR 0022 both say what adding one costs
here: it joins `npm run check` on two platforms, it joins the audit surface, and it joins
Dependabot's. Whether the gate takes a parser, ships a minimal one, or narrows its claim
instead is the decision, and it belongs with whoever is willing to take that cost.

## Its relation to the note beside it

[[The checker reads frontmatter its own way]] is the same seam read one step earlier: it is
about the gate and the runtime disagreeing over frontmatter both can read — a bare `parent:`
being an absent field to one and an explicit root to the other. This note is about
frontmatter the runtime cannot read **at all**, which that one's regexes answer for happily.
A single parse at the top of the gate would close both, which is the argument for taking the
dependency question seriously rather than patching either.
