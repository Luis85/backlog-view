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

## What the vault answered

**2026-08-08.** [[Parent links Obsidian parsed, and ones it did not]] asked the metadata
cache directly: a note whose parent link resolves to nothing has **no `frontmatterLinks`
entry at all**.

That is ONE half of a biconditional, and this note said "so Obsidian indexes a link exactly
when it resolves" — which the run did not establish. The resolvable and alias cases were
watched in the TREE, and a correctly parented note is an outcome the raw fallback produces
just as well; nothing looked at their cache. Caught in review, one commit after the same
claim had been written into `test/CLAUDE.md` as a fixture rule. The repository's own
sentence for this is *write the guarantee to the check, never ahead of it*, and this is
the second time in one branch that a rule about instructions was broken while writing the
note about instructions.

That settles the divergence and sharpens it rather than removing it. Brackets with no link
entry IS a cache Obsidian produces — for an unresolved link. What it never produces is
brackets, no link entry, and a target that **exists**, which is what every fixture here
does: they pair `[[Epic]]` with an `Epic.md` a real vault would have indexed.

## Why the branch is kept anyway

The second measurement above — nothing reaches the bracket stripper once the fake is
faithful — is now joined by a third: nothing reaches it *with an effect that can be
observed* even in a real vault. An unresolved bracketed link resolves to nothing whether or
not the brackets come off.

Deleting the two lines therefore rests on a deduction about Obsidian's link parser rather
than on a measurement. A value that parser declines to index while still naming a real note
would make them load-bearing again, silently. Kept, with the comment in `model.test.ts`
saying what the tests around it do and do not cover.

## The half still unmeasured

**Does Obsidian populate `frontmatterLinks` for a bracketed link that RESOLVES?**

It is `resolveParent`'s premise — path 1 exists for it — and it has never been checked
here. No vault session can settle it by looking at the tree, for the same reason the
unresolved case could not be: both paths parent the note correctly.

The check is the same console line as before, on a note whose parent link resolves:

```js
app.metadataCache.getFileCache(app.workspace.getActiveFile()).frontmatterLinks
```

- **An entry** → the premise holds, `parentLink` is the faithful fixture for a resolvable
  link, and the fixture guidance in [`test/CLAUDE.md`](../../test/CLAUDE.md) stands as
  written.
- **Nothing** → Obsidian does not index frontmatter links at all. Path 1 is dead in
  production, every `parentLink` fixture in the suite is the unfaithful one, and the
  guidance inverts. That is a large enough consequence to be worth thirty seconds.

## What is left

The fixtures still model a cache no vault hands out, and the cost of that is now known
exactly: they exercise a code path with no production behaviour behind it, so a change that
broke the stripper would fail them and nothing else. Moving them onto `parentLink` would be
honest and would leave the stripper untested — which, given the above, is the accurate
state rather than a regression.

Left as it is on purpose. This is a two-line branch in a pure function; the work of
rewriting ten fixtures to prove a point already written down is worth less than the note
that records it. See `docs/issues/A rule chased past the mistakes it prevents.md`.
