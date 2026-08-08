---
type: Issue
order: 160
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P3
area: verification
created: 2026-08-08
source: measured while hardening the settings fixtures — PR #94
files:
  - test/helpers/vault.ts
  - src/domain/noteFields.ts
---

# The fake vault can hold a cache Obsidian would not produce

## The limitation

[[A hand-built fixture can model a state the producer cannot produce]] is about
`BacklogSettings`, where the producer is `resolveSettings`. The same shape exists one layer
down, with Obsidian's metadata cache as the producer and `FakeVault` as the fixture — and
it has never been checked.

The concrete instance: a note whose frontmatter says `parent: "[[Epic]]"` gives Obsidian
TWO representations. The raw string in `cache.frontmatter`, and a parsed entry in
`cache.frontmatterLinks` (`{ key: 'parent', link: 'Epic' }`). `resolveParent` reads them in
that order:

1. **Preferred** — walk `frontmatterLinks` and resolve through `getFirstLinkpathDest`.
   Aliases and heading refs come free, because Obsidian already parsed them.
2. **Fallback** — read the raw value and strip brackets, aliases and heading refs BY HAND
   (`linkpathFromRawValue`). Its own comment says this is for "a plain note name without
   brackets".

`FakeVault.addFile` fills `frontmatterLinks` only through its `parentLink` option. Ten
fixtures write a bracketed value straight into `frontmatter` instead — so they build a
cache with brackets and no link entry, which is not a cache Obsidian hands out.

## Evidence

Measured rather than argued, by teaching the fake to index bracketed values the way
Obsidian does and running the suite:

- **The whole suite still passes.** Nothing depends on the divergence, so the ten fixtures
  are latent rather than live, and making the fake faithful costs no test changes.
- **With the fake faithful, nothing reaches the bracket-stripping fallback at all** —
  checked by making `linkpathFromRawValue` throw on a bracketed value: zero hits.

The second result is the interesting one. Path 2's bracket handling may be unreachable in a
real vault, kept alive in the suite only by fixtures modelling a cache that cannot exist.
Three of the ten cover exactly the cases worth having — an alias (`[[Epic|The Epic]]`), a
list value, and a `toString` key — and today each exercises the hand-rolled stripper rather
than the path a vault actually takes.

## Why it is not fixed here

The deciding question cannot be answered from this repository: **does Obsidian always
populate `frontmatterLinks` for a bracketed frontmatter value?**

- If it does, path 2's bracket branch is dead in production and should go, with those
  fixtures moved onto `parentLink`.
- If it does not — an unresolved link, say — the branch is load-bearing and needs fixtures
  that reach it honestly.

Shipping the faithful fake without that answer means either an untested branch or a
deleted one, each on a guess. Coverage would notice: the branch has no other caller.

## What would settle it

One note in a real vault carrying `parent: "[[Something]]"`, and a look at whether the link
resolves through the cache. Five lines of change either way afterwards. It is small enough
to ride along with the colour check [[Smoke test the roadmap]] already owes, which is the
only reason this is Open rather than scheduled.

Until then the divergence is recorded rather than removed, and
[`test/CLAUDE.md`](../../test/CLAUDE.md) names it where someone writing a fixture will meet
it.
