---
type: Issue
order: 160
parent: "[[Invariants as checks, not conventions]]"
status: Done
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

**2026-08-08, second run.** [[Parent links Obsidian parsed, and ones it did not]] asked the
metadata cache directly: a note whose parent link resolves to nothing has **no `frontmatterLinks`
entry at all**.

That is ONE half of a biconditional, and this note first said "so Obsidian indexes a link
exactly when it resolves" — which that run did not establish. The resolvable and alias
cases had been watched in the TREE, and a correctly parented note is an outcome the raw
fallback produces just as well; nothing looked at their cache. Caught in review, one commit
after the same claim had been written into `test/CLAUDE.md` as a fixture rule.

**Third run, same day.** The console was run again on a note whose parent link resolves,
and `frontmatterLinks` **has an entry**. Both directions are now measured, and the
biconditional that was asserted early is true for the plain `[[Name]]` form: Obsidian
indexes it exactly when it resolves. Only that form was read from the cache — see below for
what that leaves standing on assumption.

Keeping the sequence rather than the conclusion alone, because the conclusion was right and
the reasoning that produced it was not — the repository's own sentence is *write the
guarantee to the check, never ahead of it*, and a record showing only the final measurement
would read as though that had been done.

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

## What the third run settled

Every consequence that was hanging on it:

- `resolveParent`'s path 1 is real. `parentLink` is the faithful fixture for a resolvable
  link, and the guidance in [`test/CLAUDE.md`](../../test/CLAUDE.md) stands as written
  rather than inverting.
- The fixtures pairing `[[Epic]]` with a real `Epic.md` **do** model a cache Obsidian does
  not hand out. Measured, not deduced.
- The bracket stripping cannot change an outcome for that form: a bracketed value either
  has an entry and takes path 1, or resolves to nothing and gets the same answer with or
  without its brackets.

What was NOT read: the cache for the alias `[[Epic|The Epic]]` and heading-ref
`[[Epic#Section]]` spellings. They were watched parenting correctly, which is the weaker
observation this note exists to distrust. They are the same mechanism rather than a second
question, and the only thing resting on them is whether two lines of `linkpathFromRawValue`
could be deleted — which is not worth a third vault session.

## A second way the fake differs from a vault, found 2026-08-14

Not a cache this time but a REFERENCE: `FakeViewConfig` held the values object a test
handed it, rather than a copy. Tests share a module-level literal —
`const configured = { assigneeProperty: 'note.assignee' }` is the shape — so a `config.set`
in one test mutated that literal and every later test in the file inherited the value.

Invisible for as long as nothing wrote a key the tests also read, which is most of this
suite's history. It surfaced the day assigning somebody started appending them to the
resource roster: one test picked `Sam`, and the next test's Set assignee menu opened with
`Sam` in it and the note's own `sam` gone, in a fixture that names neither in its options.
Passing alone, failing in file order — the signature of shared state, and the reason it is
worth writing down beside the cache cases above: **a fake that stores what it is given is a
fake two tests can reach through.**

Fixed by copying (`{ ...values }`). What it cost before that was one confusing hour, not a
shipped defect — the leak is the harness's, and no vault has one config object per view.

## What is left

The fixtures still model a cache no vault hands out, and the cost of that is now known
exactly: they exercise a code path with no production behaviour behind it, so a change that
broke the stripper would fail them and nothing else. Moving them onto `parentLink` would be
honest and would leave the stripper untested — which, given the above, is the accurate
state rather than a regression.

Left as it is on purpose. This is a two-line branch in a pure function; the work of
rewriting ten fixtures to prove a point already written down is worth less than the note
that records it. See `docs/issues/A rule chased past the mistakes it prevents.md`.
