---
type: Issue
order: 380
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P4
area: verification
created: 2026-09-02
closed: 2026-09-02
source: the 161-line clone group in npm run analyze, read rather than acted on
files:
  - src/domain/myWorkOptions.ts
  - src/domain/releaseOptions.ts
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The widest clone in the repo is thirty-one lines

## Evidence

`npm run analyze` reports the repository's largest clone group as **161 lines** between
`domain/myWorkOptions.ts:88-128` and `domain/releaseOptions.ts:103-263`. It had never been
read.

Reading it first: **the two ranges are not the same length.** 88–128 is 41 lines and
103–263 is 161. A clone group whose two instances differ by 120 lines is not reporting
matched text, and the number it prints is the second span. What is actually identical is
`modelGroup()` — `myWorkOptions.ts:84-114` against `releaseOptions.ts:99-129` — **31
lines, of which 30 match byte for byte** and the one that differs is the group's heading
key (`mywork.option.group.model` against `release.option.group.model`). Measured with
`diff` over the two ranges, not eyeballed.

The rest of fallow's 161 is `releaseGroup()`, which has no counterpart in the my-work bag
at all. So the match is structural: both spans are runs of
`{ type: 'property', key, displayName, placeholder, filter }` literals, and a token-shaped
detector matches the shape. Declarative option bags share their shape by construction —
that is what makes them declarative.

## The register already refused the extraction, and said why

The remaining 31 lines are a real duplicate: the same three keys (`typeProperty`,
`parentProperty`, `orderProperty`) with the same `note.*` defaults, in two views over the
same vault. The argument for sharing them writes itself — one contract, two readers, and
a default that could drift in one and not the other.

`myWorkOptions.ts`'s own module docstring answers it:

> Each of the three model mappings defaults to the same suggestion the backlog view offers
> — **sharing a suggestion is not sharing a setting**, and the two may legitimately be
> pointed at different properties.

That is the decision, and it is the opposite of what the code's shape suggests. The three
options are independently configurable per view on purpose; that they ship identical
suggestions is a property of good defaults, not a contract two files must agree on.
Extracting `modelGroup()` into one function would spell "these are one thing" in the file
where the register says they are deliberately not — and a fourth bag,
`estimationOptions.ts`, already proves the point by declaring `typeProperty` with **no**
default at all, for a documented reason of its own.

## Outcome

No change. The clone stands, and the prior read that "option bags are declarative data and
sharing them would couple two independent configuration surfaces" is correct — now with the
measurement under it and the module docstring behind it, rather than as an intuition.

Two things worth keeping from having read it:

- **161 is not a line count of anything.** Cite the identical block (31 lines,
  `modelGroup()`) rather than the group's headline if this comes up again.
- The next contributor to meet this group will re-derive the same argument. This note is
  what stops that costing a third session.
