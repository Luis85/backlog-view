---
type: Task
order: 40
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: verification
closed: 2026-08-01
created: 2026-08-01
source: drift found while syncing PR #27 against main
files:
  - scripts/docs-check.mjs
  - docs/README.md
---

# Check that a feature lists its use cases

## Evidence

`docs/README.md` states the rule plainly, in the `Feature` section: *"Keep the index
complete. A Feature whose list has drifted from its actual children is worse than one with
no list, because the list is what a reader trusts instead of the tree."*

Nothing checked it, and it had already gone false. `Creating items` named four use cases
and had five children: PR #26 rewrote the register into the use-case shape and built that
index from the four children it branched with, while PR #27 added a fifth under the same
feature. Both merged green — `npm run docs` passed before and after each — because the
gate checks that a parent link resolves and that a wikilink resolves, never that a parent
*names* the children it has. Neither PR could have caught it alone.

A survey of the register at that moment found the same drift in three more places:
`Multilang`, `Theming and styling` and `User manual` carried no `## Use cases` section at
all, between them hiding 25 use cases from the notes that own them. Fifteen of eighteen
features were exact.

This is the failure mode `Make the register check itself` was written for, one rule later:
an advertised invariant nobody can run, in prose *about* what the register guarantees.

## The fix

A block in `docs-check.mjs` over every `Feature`: the wikilinks in its `## Use cases`
section, compared with its actual children, both directions.

- A **PBI child the list omits** is reported, ranked by `order` so the message reads in the
  order the note should list them in.
- A **listed entry that is not a child** is reported whatever its type — that is precisely
  the stale entry a reader would trust.
- Only PBIs are *required*: an `Issue` or a `Bug` may legally hang from a Feature and is
  not a use case.
- A missing section is not a special case. It resolves to an empty index, so the note fails
  as one omitting every child — which is what it is — and the report names them all rather
  than only saying a heading is gone.

The three drifted features got their indexes written, from the `**As** …` opening of each
child. `docs/README.md` was corrected in both places it now misstates: the line claiming
only the PBI and ADR shapes are gated, and the paragraph stating this rule, which now says
it is checked.

## Verification

Planted and caught, the way this project verifies its lint rules:

| Planted | Reported |
| --- | --- |
| A child removed from the index | `## Use cases does not list [[Backlog as folder notes]]` |
| An entry swapped for a non-child | `… does not list [[Scaffolding a backlog]]`, `… lists [[Undo and redo]], which is not a child of this feature` |
| The whole `## Use cases` section deleted | `… does not list [[New item flow]], [[Where new items are filed]], [[Backfill missing properties]], [[Scaffolding a backlog]], [[Backlog as folder notes]]` |

The third is the one worth reading twice: it is the case that would have been easiest to
implement as a skip, and a skip there would have passed all three of the features this
task found.

Review of the checker then found two more holes, both closed and both planted in turn.
Neither was exercised by the register as it stands, which is exactly why review found them
and a green run did not:

| Planted | Reported |
| --- | --- |
| An `Issue` child listed under `## Use cases` | `… lists [[Board order is derived not stored]], which is a child of type Issue, not a use case` |
| A use-case bullet wrapped in `<!-- -->` | `… does not list [[Scaffolding a backlog]]` |

The first: entries were compared against every child rather than the PBI children, so "may
hang from a Feature" quietly meant "may be indexed as a use case". The second is the sharper
one — `withoutCode` strips code spans and fences and leaves HTML comments standing, so
commenting a bullet out hid it from the reader while the check still counted its link. That
is the deletion case this task exists to catch, passing green. Both fixes stay inside the
index: a wikilink in a comment must still resolve, so `withoutCode` was left alone rather
than widened for one caller.

A third round found two more, in the same family — the check was reading the section
rather than the list:

| Planted | Reported |
| --- | --- |
| The same use case bulleted twice | `… lists [[New item flow]] 2 times` |
| A Feature with no children and no index section | `feature has no `## Use cases` section` |

The first collapsed into a `Set` before anything was compared, so an index that renders a
duplicate satisfied a check claiming it names the children *exactly*. Counting entries
before the `Set` fixes it, and the same change stopped reading every link in the section in
favour of the ones in **bullets** — an index is a list, and a PBI named in a passing
sentence must not stand in for the entry that should list it.

The second is the one that says most about writing checks: an empty index matches an empty
child set, so the section was only required from the first PBI onwards — the gate arriving
*after* the shape it exists to establish. The heading is now asked for in its own right.

A fourth round found that the bullets fix had *moved* the masking hole rather than closed
it, and one false-failure case beside it:

| Planted | Reported |
| --- | --- |
| A use case named only inside another bullet's description | `… does not list [[Scaffolding a backlog]]` |
| A top-level bullet indented three spaces | *(nothing — it is a legal bullet and now reads as one)* |

Reading every link in a bullet was the same hole one level in: `- [[A]] — see also [[B]]`
marked B listed while B had no bullet of its own. The entry is now a bullet's **first**
link, which is what the entry shape `- [[Name]] — what it delivers.` means and which leaves
descriptions free to cross-reference. The second is the only finding in four rounds that
was a false *failure* rather than a false pass: CommonMark renders up to three leading
spaces as a top-level list item, and the pattern demanded column zero, so a legal index
entry read as a missing one. This file already holds that a check blocking a legitimate
note is the more expensive direction to get wrong.

A fifth round closed the same hole a third time. The first link in a bullet was found
*anywhere* in it, so `- See also [[Scaffolding a backlog]]` counted as that use case's
entry while its real bullet was gone:

| Planted | Reported |
| --- | --- |
| An entry replaced by a bullet that only mentions it | `… does not list [[Scaffolding a backlog]]` |

The rule, finally stated as a position rather than as a search: **an entry is a link
immediately after a bullet marker.** Only the position distinguishes an entry from a
mention, so only the position can be checked — and all 69 index bullets in the register
already sit that way, so the anchoring narrows the check without moving the corpus.

A sixth round found the marker itself matched one spelling rather than the Markdown rule:
`-  [[Name]]` with two spaces renders as a list item and was reported as a missing child.
Rather than take that variant alone and wait for the next, the marker is now matched as
CommonMark defines a **list item** — up to three leading spaces, a bullet or an ordered
marker, then one to four spaces or a tab. Five spellings planted and all five accepted,
with the mention-only and duplicate cases re-planted to confirm the widening did not
reopen what the previous rounds closed:

| Planted | Accepted |
| --- | --- |
| `-  [[Name]]`, `-⇥[[Name]]`, `* [[Name]]`, `1. [[Name]]`, `   -  [[Name]]` | all five |

A seventh round: `[[Name]` with a lost bracket matched the permissive prefix and read as an
entry, though it renders as literal text and indexes nothing. The entry link must **close**,
with an alias or a heading allowed between the name and the `]]`. The repository-wide
wikilink scan keeps the permissive prefix on purpose — there a bare `[[Name]` must still
resolve, and requiring `]]` would make the typo invisible instead of caught. Opposite
defaults from one question each: *is this a link that works* against *does this bullet index
a child*.

| Planted | Reported |
| --- | --- |
| `- [[Scaffolding a backlog]` | `… does not list [[Scaffolding a backlog]]` |
| `- [[Name\|alias]]` and `- [[Name#Heading]]` | *(nothing — both still index Name)* |

An eighth round closed the two boundaries of the section itself, both shared with the rest
of the file rather than introduced here:

| Planted | Reported |
| --- | --- |
| The real index replaced by a `~~~`-fenced example of one | all five children reported missing |
| `  ## Related material` indented, with entries below it | the two below it reported missing |

`withoutCode` stripped backtick fences only, so everything structural in this file —
headings, sections, entries — was readable inside a tilde fence, where nothing renders.
And `useCaseIndex` ended the section at a column-zero `## `, so an indented heading did not
close it and the bullets beneath counted. Both now follow the same CommonMark rule the
entry matcher does, which is the point: **one module, one idea of what a heading and a
list item are.**

The pattern across all eight rounds: every hole was the check answering a slightly different
question than the rule does. The rule is about the list a reader sees; the code variously
asked about the section, about every child, about text a reader never sees, about every link
in a bullet, about a bullet's first link wherever it sat, and about bullets in one exact
column. Each fix narrowed the question and three times the narrowed version was still not
the rule — the same masking bug surviving two rewrites of the thing meant to kill it. That
is the argument for planting the case rather than reasoning about the regex, and for
stating a rule as the property that makes it true rather than as the search that usually
finds it.

## Risks

The check reads structure, not sense — it cannot tell whether the sentence after the
wikilink describes the use case. That is the same honest limit the README already draws
around the four ungated note kinds, and the reason the Feature shape is only *partly*
gated: the index is a fact about the tree, the outcome sentence is a judgement.

## Outcome

`npm run docs` reports 111 backlog notes, 69 use cases, 17 ADRs, 64 modules, and every
feature index is now complete and exact. One more of the README's claims is a check rather
than a request.

**Later removed**, 2026-08-01, by a broader pass against counted and indexed content in
the register (see the same date's other closes across `docs/`). The check this task built
was correct and never went stale on its own watch — that was the point of building it —
but it verified a second copy of a fact the first copy already carried exactly:
`parent:`. Obsidian's own backlinks pane reads that link directly and cannot disagree with
it, which a hand-written list, however well checked, still could in the gap between an
edit and the next `npm run docs`. The eight rounds of hardening above are not wasted: they
are the record of how expensive one small hand-maintained index turned out to be, which is
the argument for not having a second one anywhere else in this register. The `## Use
cases` section is gone from every Feature note, and the block in `docs-check.mjs` this
task added is gone with it.
