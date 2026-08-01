---
type: Task
order: 30
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: verification
closed: 2026-08-01
created: 2026-08-01
source: 2026-08-01 Codex review of PR #24
files:
  - docs-check.mjs
  - package.json
  - .github/workflows/ci.yml
---

# Make the register check itself

## Evidence

`docs/README.md` listed six integrity checks the register was said to satisfy — parents
resolve, no duplicate sibling orders, wikilinks resolve, source paths exist, use cases
have their sections, every module is named by some note.

None of them was in the repository. They lived in whatever ad-hoc script last ran, so the
README was **advertising** an invariant a reader could not run, and one of them had
already gone quietly false: `docs/tasks/Split the view test suite.md` names
`test/view/backlogView.test.ts`, which that very task split out of existence. The script
that "verified" the claim had a hardcoded exemption for that one file by name.

Found by review, and it is exactly the failure this PBI exists to prevent — a rule that
lives only in prose is followed until someone is in a hurry. The rule here had made it
into prose *about* enforcement, which is worse: it reads as a guarantee.

## The fix

`docs-check.mjs`, run by `npm run docs`, by `npm run check`, and by CI. It enforces every
claim the README makes, and the README now points at it.

The exemption became a **rule with a reason**. Notes in `requirements/` and `adrs/`
describe the code as it is now, so every path they name must exist. Notes in `tasks/`,
`issues/` and `bugs/` are records of a moment: this note names files that will be edited
after it is written, and the task above legitimately quotes a file it deleted. Rewriting
those to keep a checker quiet would falsify the record. So their stale paths are **listed
on every run rather than failed** — visible, not silently exempt, which is the whole
difference from what was there before.

## Verification

Six violations planted, six caught, matching how this project verifies its lint rules:

| Planted | Reported |
| --- | --- |
| `type: PBI` → `Feature` under a Feature | `Feature under Feature is not a legal pair` |
| A second sibling with `order: 20` | `order 20 is already taken by "Focus level"` |
| `[[Sibling ranking]]` → `[[Sibling rankings]]` | `unresolved wikilink` |
| A renamed `**Extensions**` heading | `use case has no **Extensions**` |
| An extension relabelled `9a` above `3a` | `extensions are not in step order` |
| `status: Accepted` → `Agreed`, section renamed | `status "Agreed" is not one of …`, `ADR has no ## Revisit when` |

A review round on the checker itself then found two more holes, both now closed and both
planted-and-caught in turn:

| Planted | Reported |
| --- | --- |
| A `\| **Guarantee** \|` row unbolded; a `\| **Trigger** \|` row unbolded | `use case has no \| **Guarantee** \|`, `… no \| **Trigger** \|` |
| `superseded-by: 999`; `supersedes: ADR-12` | `superseded-by: 999 — no such ADR`, `supersedes: "ADR-12" is not an ADR number` |

The first: only the `Actor` row was checked, so a use case could ship without the trigger
or the guarantee — the two rows that do the most work. The second: `superseded-by` was
checked for *presence*, not for naming a record that exists, so a broken chain passed. Both
ends must now agree, because a one-sided link is how a chain rots: the superseded record
still looks current from the successor's side.

A third round found the reciprocity check itself half-built: it walked from
`superseded-by` and asked whether the successor pointed back, but never walked from
`supersedes` — so a successor could claim to replace a record that still read as current.
That is the failure the check was added to prevent, in the exact direction the note
describing it called "worse". Both directions now come from one table, because checking
one of two symmetric things is how the asymmetry got there.

| Planted | Reported |
| --- | --- |
| ADR 12 drops `superseded-by` | `0013…: says supersedes: 12, but ADR 12 does not say superseded-by: 13` |
| ADR 12 points back at 14 | both ends reported, each naming the half it expected |
| ADR 12 keeps `superseded-by` but claims `Accepted` | `names superseded-by but its status is "Accepted", not Superseded` |

The third is not something review asked for; the same reasoning reaches it. Declaring a
successor while claiming `Accepted` is a record that reads as current and is not — the
same failure as a one-sided link, stated in one record rather than across two.

A fourth round pushed the module check further. It asked only whether a module *path*
appeared somewhere in the docs — so a new view option or command added to a file the
register already names passed unseen, while the sweep note claimed every such surface maps
to a PBI. The two literal-string surfaces are now checked by name:

| Planted | Reported |
| --- | --- |
| `key: 'showCounts'` → `'showBurndown'` | `no note names the view option "showBurndown"` |
| `id: 'create-backlog'` → `'archive-backlog'` | `no note names the command "archive-backlog"` |

Ten option keys and one command id had to be added to the register to make that pass,
which is the finding: they were *described* everywhere and *named* nowhere, and an option
key is stored in the user's `.base` file, so it is the one string that must never drift.

Menu items and toolbar controls stay a hand sweep — they are display text, and forcing the
notes to quote UI strings that change for cosmetic reasons would trade a real check for a
brittle one. The sweep note now says which is which instead of claiming the script covers
both.

A fifth round closed two silent skips — the most dangerous shape a checker has, because
a skipped file reports nothing at all:

| Planted | Reported |
| --- | --- |
| A task note stripped of its frontmatter | `backlog note has no \`type\` in its frontmatter` |
| A bug note keeping frontmatter but losing `type:` | same |
| `[diagram](assets/layers.svg)`, `[details](missing.md)` in an ADR | both reported |
| A percent-encoded task link pointed at a missing file | `links Split%20the%20view%20suite.md, which does not exist` |

A note without a `type` was skipped **unconditionally**, so a note that lost its
frontmatter fell out of every hierarchy, order and use-case check while the run stayed
green. Only ADRs and the index pages are legitimately typeless, so that is now a rule about
paths rather than a blanket skip. And relative links were checked only where they matched
`NNNN-slug.md`, so any other link — an asset, a note referenced by its real filename, a
percent-encoded path — was invisible. Every relative link in `docs/` is now resolved,
percent-decoding and stripping anchors first, external schemes skipped.

Adding that check immediately failed on **this note's own table**, because the planted
examples above are written as links. Code spans are now skipped for links exactly as they
already were for wikilinks, and for the same reason: inside backticks nothing renders as a
link, so it is an example being quoted rather than a reference being made. The same
example in prose still fails, which is the line worth holding.

A sixth round found two more places the gate looked without seeing, plus one note the
gate could never have caught:

| Planted | Reported |
| --- | --- |
| `**2 — ` and `**2A — ` extension labels | both reported as not labelled |
| `key: countsKey()` in `viewOptions.ts` | `cannot resolve the option key expression` |
| A third extra type, `Risk` | `no note names the generated view option "typeFolder.risk"` |

The extension check matched only bullets **already shaped like a label**, so a mistyped one
dropped out of the list and left the rest looking well ordered. Every bullet in the block
is validated now.

The option scan read literals only, so `key: typeFolderKey(type)` — six persisted keys,
one per type — was invisible, and the register named none of them. They are derived now,
from the vocabulary and the key template in `settings.ts`, and the derivation **fails
loudly if either changes shape** rather than quietly stopping. So does any `key:`
expression the scan cannot resolve: a scan that ignores what it does not understand is the
shape of gate that reports success for the thing it never looked at.

The third finding needed a reader, not a checker: ADR 0009 still said an unrecognised
custom type is "never rewritten" while the use case, in the same commit, documented the
dragged-item exception. Nothing mechanical connects a decision record to a use case — the
ADR now carries the exception and says the intent is not what that branch does.

A seventh round found the same blind spot twice more, in the two places it had not been
generalised:

| Planted | Reported |
| --- | --- |
| `test/helpers/fixtures.ts`, undocumented | `no note names test/helpers/fixtures.ts` |
| `id: "create-backlog"` (double quotes) | `cannot resolve the command \`id: "create-backlog"\`` |

The module check collected `*.test.ts` only, so `test/helpers/` — including the harness
every view test is written against — was outside a README guarantee that named it. All
`.ts` under both trees now.

And the fail-on-unresolvable rule had been applied to option keys and **not** to command
ids, so a double-quoted id, or one lifted to a constant, matched nothing and reported
nothing. Both surfaces go through one loop now, which is the point: exempting one of two
symmetric things is how every one of these got here.

An eighth round closed the last gap in the extension rule, and corrected a note the gate
cannot judge:

| Planted | Reported |
| --- | --- |
| `- **3b — ` relabelled `- **9a — ` | `extension 9a departs from step 9, which the main flow does not have` |
| A main flow stripped of its numbering | `main flow has no numbered steps` |

The label was checked for **shape and order and nothing else**, so `**99a — ` passed: a
well-formed label departing from nowhere. The main flow's numbered steps are parsed now and
every extension must name one of them, which is what makes the label mean what
`docs/README.md` says it means — *numbered against the step it departs from* — rather than
just being well punctuated.

Separately, `docs/adrs/README.md` explained ADRs as carrying "a `type` that is none of the
six". They carry **no** `type` at all, and the checker exempts them by path. The conclusion
was right and the reason was wrong, which is the more misleading of the two: a reader
correcting the file would have gone looking for a type that is not there.

A ninth round found two more ways to slip past the surface scan, and prompted the only
structural change in this list:

| Planted | Reported |
| --- | --- |
| `key:'brandNewNoDocs'` — no space after the colon | `no note names the view option "brandNewNoDocs"` |
| `typeFolderKey(type + 'Archive')` | `cannot resolve the view option …` |
| `'key': 'brandNewNoDocs'` — quoted property name, invisible to the pattern | `found 16 \`key:\` … expected 17` |

The first two are ordinary fixes: match `\s*` rather than exactly one space, and exempt the
generated expression **exactly** rather than by prefix — a prefix accepted a changed
argument while the derivation went on producing the six original keys, green and wrong
about which keys are persisted.

The third is the point. Nine rounds of this file have been regex-scanning TypeScript, and
each round found another way the regex could be fooled. That is a floor, not a series of
bugs: there is no parser here to reach for. So the scan now carries a **count backstop** —
every option object has a `displayName` (as does every group, which has no key), and every
command has an `addCommand(`, so the number of keys found must equal the number the file
should contain. A key the pattern cannot see for **any** reason makes the counts diverge
and fails.

That check earned itself on its first run by catching a wrong assumption in its own author:
it reported 17 keys against 21 `displayName`s, because groups carry one too. The expected
count is one minus the other, and the check said so before a human noticed.

The checker also caught its author omitting ADR 0017 from the ADR index, minutes after
being taught to check that.

It also caught a bug in its own first draft: the module count read the markdown walker
instead of the TypeScript one and reported 3 modules where there are 59. A validator with
a bug is precisely what it exists to prevent, so the count is printed on every run rather
than only the failures — a number that is obviously wrong is a check that says so.

## Outcome

`npm run check` is five steps now, and `docs/` is gated like `src/`. The register's
integrity is a command rather than a claim, and the one stale reference is reported every
run instead of being exempted by name.
