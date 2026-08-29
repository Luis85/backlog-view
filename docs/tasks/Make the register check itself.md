---
type: Task
order: 30
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: verification
closed: 2026-08-01
created: 2026-08-01
source: 2026-08-01 Codex review of PR
files:
  - scripts/docs-check.mjs
  - package.json
  - .github/workflows/ci.yml
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
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

A tenth round found the check being weakened by its own documentation, and the whitespace
fix landing in one of two places again:

| Planted | Reported |
| --- | --- |
| `create-backlog` renamed to `archive-backlog` | `no requirement names the command "archive-backlog"` |
| `key:` and `typeFolderKey(type)` on separate lines | the derivation still ran — a removed key was still caught |

The surface names were searched across **all** of `docs/`, and this note's tables quote
`showBurndown` and `archive-backlog` as planted examples — so a real surface renamed to
either would have passed. The record of the test cases was weakening the test. They are
searched in `requirements/` alone now: a record naming a surface in passing, or quoting one
as an example, does not *specify* it. Four options turned out to be named only in records
and are now named in the requirement each belongs to.

And the generated-key derivation was gated by a **second** regex over the same file, still
requiring exactly one space after the colon — so with the valid expression wrapped across
lines, the general scan accepted it and the derivation never ran, leaving all six persisted
keys unchecked. It is driven by what the scan resolved now, not by a pattern that has to
agree with another pattern.

## Where it stopped being a script's job

Ten rounds in, the maintainer named the pattern: **regex is not the way to read
TypeScript.** Five of those rounds were the same class — a missing space after a colon, a
quoted property name, a changed argument to the generator, a value on the next line, a
name that was a prefix of another. Each fix was correct and each one only closed the
instance in front of it, because a pattern over source can always be fooled once more.

So that half is gone. `test/docs/surfaces.test.ts` **imports** `getViewOptions()` and reads
the keys the code actually produces — the six generated per type included, as ordinary array
entries rather than something to derive — and imports `CREATE_BACKLOG_COMMAND_ID`, which is
now a named export beside the flow it runs rather than a literal at the registration site.
About 95 lines of scanner, derivation, unresolvable-expression handling and count backstop
deleted, along with every bug class they existed to bound.

What is left in `docs-check.mjs` is markdown checked against the filesystem, which is what
a script over text is good at. The split is the rule: **a script over markdown checks
markdown; a test that can load the module asks the module.**

The last regex-era finding is worth keeping as the epitaph — `specText.includes(name)`
accepted a rename to any prefix of a documented name, so `showCounts` vouched for
`showCount`. The test matches whole names, and pins it:

```js
expect(named('showCounts')).toBe(true);
expect(named('showCount')).toBe(false);
```

The first round after the rewrite found the half-measure in it: view-option keys were
**discovered** by calling the schema, while commands were still one hand-picked constant —
so a second `addCommand` would be specified by nobody and caught by nothing. The mock gained
a minimal `Plugin`, and the test now runs `onload()` and asks what it registered. Adding an
undocumented `purge-backlog` fails it. Discovering both surfaces the same way is the point;
one discovered and one enumerated is the same asymmetry in a new place.

The same round found the ADR check testing that each heading is *present* while
`docs/adrs/README.md` requires them *in order*. Heading positions are compared now —
swapping Decision and Consequences fails.

The round after that found the two halves of the split each carrying one last version of
the shape they were built to remove — a **filter standing in for a check**, and a
**boundary missing one of its characters**:

| Planted | Reported |
| --- | --- |
| `docs/adrs/not-numbered.md` | `ADR filename is not NNNN-slug.md`, `ADR has no frontmatter`, `README.md does not list not-numbered.md` |
| `adr: eight`; the `adr` line deleted | `adr: "eight" is not a number` / `ADR has no adr`, each with the gap it leaves |
| `create-backlog` renamed to `backlog` | `["backlog"]` — the command id no requirement names |
| `showCounts` renamed to `tree` | `["tree"]` |

ADRs were collected by matching `adrs/NNNN-`, so a record whose filename came out wrong was
excluded from **every ADR check** — frontmatter, numbering, sections, index membership — and
the run stayed green. A malformed name is the moment those checks are most wanted, and it
was the one moment they did not run. An ADR is anything under `adrs/` that is not the index
now, found by where it lives; the filename is a rule to *report*. The numbering pass had to
learn to hold its tongue in turn: a record with no `adr` field is one problem, not also a
duplicate ADR 0. Discovery over enumeration, in the last place still enumerating.

And `named()` matched on `(?<![\w.])…(?![\w.])`, which leaves out the third character an id
here is built from. `create-backlog` therefore vouched for `backlog`. Membership in a token
set replaces the boundary, because a set has no ends to get wrong.

That fix alone did not catch the rename, which is the more useful half of the finding: the
requirements say "backlog" in prose on nearly every page, so an id renamed to an English
word was *named* by the letter of the check and specified by nobody. An identifier in this
register is always written as code, so the corpus is now the **code spans** of
`requirements/` rather than their prose — the same narrowing as reading `requirements/`
instead of all of `docs/`, one level in. Every key in `viewOptions.ts` happens to be a
compound name today, which is luck rather than a rule: `showCounts` renamed to `tree` was
accepted before this change and is reported after it.

The round after **that** found the ordering fix landing in one of two places — the shape
this list has now recorded five times — and one silent skip left in the first loop of all:

| Planted | Reported |
| --- | --- |
| A Task copied to `docs/tasks/Quick filter.md` | `basename is already used by docs/requirements/Quick filter.md — a wikilink to either is ambiguous` |
| A `\| **Guarantee** \|` row deleted from the table and re-appended at the end | `use case has **Main flow** before \| **Guarantee** \|` |
| `**Extensions**` moved above `**Main flow**` | `use case has **Extensions** before **Main flow**` |
| `## Consequences` moved above `## Decision` | `ADR has ## Consequences before ## Decision` |

Notes were collected into a `Map` keyed by basename, so two sharing one — which a vault
permits and Obsidian resolves arbitrarily — meant `set` **replaced** the first. The replaced
note was then checked for no parent, no order and no use-case shape, while the counts
printed at the end still looked plausible. It is the same ambiguity the register runs on:
`[[wikilink]]` and `parent:` address a note by name, so a collision has no right answer.
Index pages and ADRs are addressed by *path*, which is why their names are not in question —
a rule, not an exemption.

And the ADR headings had been taught to check their order one round earlier while the
use-case sections were still a bag of `includes` — so a `| **Guarantee** |` cut from the
table and pasted at the foot of the note passed as a use case that had one. Both go through
`checkSections` now, which is the only version of this that stays fixed: **the round that
finds one of two symmetric things wrong has found both.**

It names both ends of an inversion, too. A monotonic walk blames whichever section follows
the displaced one, so the first draft reported `**Main flow**` for a misplaced `Guarantee`
row — the innocent party, and a reader would have gone looking in the wrong place.

The round after that took the ordering rule one level further down, and found the last
place the checker was inventing data rather than reading it:

| Planted | Reported |
| --- | --- |
| The `\| **Guarantee** \|` row deleted and the marker put back as a standalone line before the main flow | `use-case table has no \| **Guarantee** \| row` |
| `order:` deleted from a note | `backlog note has no \`order\`` |
| `order: high` | `order "high" is not a number` |

Ordering constrains *where* a marker sits and not *what* it is: a table row on a line of
its own, between the table and the main flow, satisfies every position rule and is a row
of nothing. The four fields are parsed as rows of the block the table occupies now, and the
section list is the six headings. The README requires the table, so the table is what gets
parsed.

And `Number(fm.field("order") ?? 0)` manufactured a rank for a note that has none: a
missing `order` became `0`, a legal-looking value no sibling had claimed, so an unranked
note passed the uniqueness check *because* it was unranked. A default invented by the
checker is the checker deciding what the note meant.

## When the gate met a branch that predated it

`main` merged a 20-note Kanban epic while this branch was in review, and CI went red on the
merge rather than on either side: 15 new PBIs, written in the shape this branch replaced.

That is the gate working. The alternative — an exemption for notes that arrived from
elsewhere, or a rule that only new files must conform — is the by-name carve-out this whole
list is a record of removing. So the 15 were written as use cases, and the conversion paid
for itself immediately: the shape asks questions prose does not have to answer. What a
quick filter does to a WIP signal, what happens to a card created into a state the base
excludes, why dragging stays enabled on a board and must not in a tree — all were
one-line consequences buried in acceptance criteria, and all are extensions now, beside the
step they complicate.

Their `Where it lives` sections say **nothing yet** and name the module the work will
extend. That is worth keeping as a form: it makes the seam a claim a reviewer can argue
with before any code exists, and it stays honest with the check that every source path a
requirement names must exist.

## Three checks that were asking half the question

| Planted | Reported |
| --- | --- |
| `parent:` added to ADR 0014 | `ADR carries a \`parent\` — an ADR is not a work item` |
| `**so that**` removed from a use case's opening | `use case has no \`**As** … **I want** … **so that** …\` opening` |
| `\`src/main.ts\`` mistyped as `\`src/main.tsx\`` | `no note names src/main.ts` |

Each is the same shape: a check that verified what *should* be there and never what must
not, or verified the first token of a thing and called it the thing.

The ADR check confirmed the five fields an ADR carries, which cannot notice a sixth. The
runtime enrols a note holding **either** a `parent` or a supported `type`, so one stray
field would have put a decision record in the plugin's own backlog — against the invariant
both index pages state, and invisible to a checker looking only for what it expected.

`**As**` stood in for the whole opening sentence, so a note could omit what the actor wants
and why — the two halves that make it a use case rather than a title.

And `allText.includes(file)` credited a **mistyped** path with naming the real one:
`src/main.tsx` contains `src/main.ts`. The typo passed twice over, once as a reference the
path scan resolved by parsing its `.ts` prefix, and once as the module name it misspells.
Whole-token membership now, the same rule `test/docs/surfaces.test.ts` reached from the
same failure — and it exposed a platform bug on the way, since `collectTs` returns the
platform separator while notes are written with `/`.

Two of the three turned up formatting facts a naive fix would have broken. `**I want**` is
routinely split by the 100-column wrap — `**I\nwant**` is the real text of two notes here —
so the markers are matched with `\s+` rather than as literals, and a check written the
obvious way would have failed the corpus for a line break.

The next round found the same *half a question* three more times, twice in code written
minutes earlier:

| Planted | Reported |
| --- | --- |
| `status:` deleted from a note; then `status: In progress` | `backlog note has no \`status\``; `status "In progress" is not one of Open,Active,Done` |
| `## Context` deleted and the words kept in a sentence | `ADR has no ## Context` |
| A bare `parent:` on an ADR, no value | `ADR carries a \`parent\` — an ADR is not a work item` |

`status` sits in the same conventions table as `type` and `order`, and was the one of the
three nothing checked — so the register could have violated its own documented schema in
the field a reader scans first. Adding `order` and not `status` in the same edit is the
one-of-two miss again, this time inside the fix for one of them.

`checkSections` was `indexOf`, so a heading deleted and quoted in prose still counted, and
an example in a fenced block counted as the document's own structure. Code is stripped
first and markers match at the **start of a line** now. Three rounds have hit this one
function, each adding a property the last had assumed: *present* → *present and ordered* →
*present, ordered, and actually the structure it names.*

And the ADR prohibition was written against `fm.field`, which wants a **value** — while
`resolveParent` enrols a note on the **key**. A bare `parent:` with nothing after it is an
explicit root to the runtime and an absent field to the checker, so the one form of the
mistake that needs no typo at all was the form that passed. Prohibitions are about keys.

## Making the generalisation instead of waiting for it

Three rounds had now taught the same lesson — *`indexOf` answers a question about
characters, and every rule here is a question about the document* — and each time the fix
closed only the instance in front of it. So the remaining call sites were swept for that
class rather than left for a fourth round to find:

| Swept | Was |
| --- | --- |
| `between` bounds | raw `indexOf`, so a quoted `\`## Use case\`` bounded the block at the wrong place |
| The ADR index | `includes`, so a filename quoted in backticks counted as a row linking to it |
| `superseded-by` presence | left **as a value test**, deliberately — see below |

The first is worth naming because it fails in the *other* direction: a quoted bound made
the checker slice the wrong region and then answer confidently about it, so the note that
mentions the marker gets a **false failure**. Planted and confirmed both ways — the same
note fails on the previous commit and passes on this one.

The third is the interesting one, because sweeping it would have been wrong. "A `Superseded`
record must **name** its successor" is a rule about a value: a bare `superseded-by:` names
nobody and must still fail. The prohibition beside it is a rule about a key. Key-or-value
is not a style to apply uniformly — it is whichever the rule is actually about, and
`frontmatter` now offers `field` and `has` side by side with that written down between
them. Both directions are planted: a bare `parent:` is caught, and a bare `superseded-by:`
is still caught.

## A parser that gave up quietly, and two rules that stopped short

| Planted | Reported |
| --- | --- |
| `**Extensions**` with one newline, holding a `- **3 — ` label | `extension is not labelled \`**Na — \`` — the label, not the skip |
| ADR 0013 set to `Proposed` while 0012 stays `Superseded` | `supersedes 12 while still Proposed — nothing would be in force` |
| A nested `requirements/board/` note naming a missing module | `names src/view/render/board.ts, which does not exist` |

The extensions block was matched with a literal `\n\n`, so a section with one blank line
parsed as nothing and `continue` skipped **the entire extension contract** — every rule
three rounds were spent building — on a note that still had the heading three lines above
it. Tolerant of the blank line and loud when it cannot read the block now, plus an error
for a block with no bullets, since that is where the next silent skip would have gone.

Supersession had been checked from both directions and in both records, and still stopped
one step short: nothing said the **successor** had to be a decision anybody had made. A
`Proposed` record superseding an `Accepted` one retires the predecessor and puts nothing in
its place. `Superseded` remains fine there — a record that replaced one and was later
replaced itself is an ordinary link in a longer chain.

And "living folders" was `path.basename(path.dirname(file))`, which is the *immediate*
parent — so `requirements/board/Foo.md` read as folder `board` and its stale source paths
would have been listed rather than failed. `walk` deliberately recurses; the rule that
consumes it did not. Nothing is nested today, which is exactly why it would have been
found the hard way.

## Three more, one of them created by the fix before it

| Planted | Reported |
| --- | --- |
| `* **NOT LABELLED — ` beside a valid `-` bullet | `extension is not labelled \`**Na — \`: * **NOT LABELLED…` |
| 0012 and 0013 reversed, reciprocity intact | `supersedes: 13 … must point backwards`, `superseded-by: 12 … must point forwards` |
| A command documented only in `requirements/board/` | the surfaces test finds it — a flat read would not have |

Bullets were matched with `-` alone, so `*` and `+` — both ordinary Markdown — were not
extensions the check could see, and a stray one dropped out exactly as a mistyped label
used to. The same hole one level down, inside the fix for it.

Supersession had been checked for existence, for self-reference, for reciprocity from both
sides, for the predecessor's status and for the successor's, and still nothing read the
**numbers**. `docs/adrs/README.md` defines Superseded as "replaced by a *later* ADR", so
the direction is in the vocabulary; a reversed pair satisfies every other rule, and a
reciprocal pair with the arrow flipped is a cycle that reads as ordinary history.

The third was made by the previous commit. Teaching `docs-check.mjs` to treat nested
requirement notes as specifications left `test/docs/surfaces.test.ts` reading the folder
flat, so an id specified only in a nested note would have failed a test while the register
was perfectly correct. **A split has two halves, and changing what one of them means is a
change to both** — the same lesson as the checker and `resolveParent` disagreeing about
what a `parent:` key is, one file further out.

## A prefix, a third time — and the first check that blocked a valid note

| Planted | Reported |
| --- | --- |
| `## Context` renamed `## Contextual` | `ADR has no ## Context` |
| `[x](<The quick filter on the board.md>)` — valid, file exists | passes; the same form pointing at a missing note still fails |

The heading matcher was anchored at the line start and nowhere else, so `## Contextual`
satisfied `## Context`. That is the **prefix** hole for the third time in this file, after
`showCounts` vouching for `showCount` and `src/main.tsx` for `src/main.ts` — three
different subjects, one assumption, closed three times separately. A `##` heading is a whole
line and is anchored as one now; a `**Bold**` marker opens a sentence and is already bounded
by its own closing `**`.

The link fix is the one that stands out in this whole list, because it is the **only false
failure** among more than twenty findings. `<...>` is Markdown's way of putting a space in a
destination, and every note in this register has spaces in its filename — so the one
sanctioned way to link them was rejected, resolving `<The quick filter on the board.md>` to
a file called `The`. Every other hole here let something wrong through; this one would have
blocked something right, which is the more expensive direction and the harder one to
discover, because nobody writes the link that fails and then argues with the gate.

The checker also caught its author omitting ADR 0017 from the ADR index, minutes after
being taught to check that — and caught `test/docs/surfaces.test.ts` being unnamed by any
note within a minute of its being written.

It also caught a bug in its own first draft: the module count read the markdown walker
instead of the TypeScript one and reported 3 modules where there are 59. A validator with
a bug is precisely what it exists to prevent, so the count is printed on every run rather
than only the failures — a number that is obviously wrong is a check that says so.

## A deleted note is not a broken link (2026-08-29)

The wikilink rule failed everywhere, records included, and the reject case for it said why:
a spec written here points at this register, so a generated plan must not accumulate broken
links. Deleting `docs/milestones/Ship the roadmap epic.md` — ordinary backlog work, its
dates taken over by releases — then turned CI red in two dated specs and one test case, and
the only ways to green were to rewrite a dated record or to keep every note the register
ever held.

So the wikilink rule now makes the same split the source-path rule has always made, for the
same stated reason. `tasks/`, `issues/`, `bugs/` and `superpowers/` report a dead link in
the summary beside the 140 historical paths already printed there; every other folder
describes the register as it is now and still resolves every link it makes. What that trades
away, said plainly: **a typo in a generated plan is now listed rather than failed.** It is
not unchecked, and the direction that blocks a contributor is untouched.

The first version of that change was spelled the other way round, as a `LIVING` list of
`requirements/`, `adrs/` and `tests/` with everything outside it historical — and a review
of it found the reason that is the wrong sentence: **it made the leniency the default.**
`docs/README.md`, `releases/` and `resources/` are current documentation and were on
neither list, so a dead link in the register's own index would have reported as allowed
history, and a folder added tomorrow had the same hole waiting. The rule names the records
instead, so the strict side is what a new folder gets until somebody argues it is a record.
Both directions are planted in `test/docs/checkerRejects.test.ts` — a dead link and a dead
path, each in `docs/README.md` — and both were watched failing against the earlier spelling.

The test case that broke was the third one, and it was living for a reason — it named the
milestone as the fixture to look at. It was rewritten rather than exempted: no `Milestone`
note is left in the register, so the run adds its own.

## Outcome

`npm run check` is five steps now, and `docs/` is gated like `src/`. The register's
integrity is a command rather than a claim, and the one stale reference is reported every
run instead of being exempted by name.
