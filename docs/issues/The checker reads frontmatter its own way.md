---
type: Issue
order: 60
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: verification
created: 2026-08-01
closed: 2026-09-02
source: 2026-08-01 review of PR
files:
  - scripts/docs-check.mjs
  - test/docs/checkerRejectsFrontmatter.test.ts
  - test/docs/checkerAccepts.test.ts
  - src/domain/noteFields.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The checker reads frontmatter its own way

## Closed, 2026-09-02 — measured first, then closed by deleting one of the two readers

The acceptance criteria below asked for a **comparison**. It was run, and what it measured
argued for something shorter than keeping it: there is now **one reader**, so there is no
pair left to compare.

### The differential, and the instrument

`scripts/docs-check.mjs`'s regex reader, copied verbatim, against `yaml` 2.9.0, over every
`.md` in the repository. Not a list of the five keys the gate happens to ask about — the
union of every `^key:` line the reader's own model admits and every top-level key YAML
produces, per note, because a check restricted to the keys somebody thought of is the shape
this register keeps being burned by.

**766 files scanned, 654 with frontmatter, 9,840 key questions. 15 disagreeing shapes.**

| shape | notes | reader says | YAML says |
| --- | --- | --- | --- |
| a quoted value (`parent`, `release`) | 725 | `"[[X]]"` — quotes kept | `[[X]]` |
| an empty string (`risk`, `iteration`, `horizon`, `assignee`, `started`, `finished`, `start`, `due`, `priority`) | 4,506 | `""` — two literal quote characters | `""` |
| a block sequence (`files`, `dependsOn`) | 257 | the **first item only** | the whole list |
| a value wrapped onto a second line (`source`) | 14 | the first line only | the folded scalar |
| a block no parser accepts | 1 | answers every question | refuses the block |

**The instrument was tested on ten hand-computed inputs before its numbers were believed,
and the first run corrected three of them** — which is the part worth recording:

- `parent:` bare, on the last line, was expected to diverge and **does not**. `has` and
  `field` already split key-presence from value-presence, so the reader is capable of the
  distinction. This note's founding instance was therefore a **call-site** bug (a rule
  asking `field` where it meant `has`), not a reader bug — which nothing here had said.
- `parent: "[[X]]"` and `started: ""` were expected to agree and **do not**. The reader
  never unquotes. Compensated at the parent call site by a `"?` in its pattern, and
  uncompensated everywhere else.

Testing it also produced a finding no enumeration of mine had: `^name:\s*(.+)$` has `\s*`
matching a **newline**, so a bare key takes the NEXT line's text as its value —
`parent:\nstatus: Open` answers `field("parent") === "status: Open"`. Nothing in `docs/`
is written that way, so the corpus sweep could never have shown it; it came out of the
hand-computed case that the corpus said nothing about.

### The fix is a deletion

`frontmatter()` parses with `yaml`, `field`/`has` answer from the parsed map, and `raw` is
no longer returned at all — the two rules that read it (the parent wikilink, the ADR date)
were the two that had drifted. One reader, so no divergence to check and no comparator to
maintain. The whole register stays green through the change: 654 notes, no rule reversed.

Two undocumented restrictions came off with it, both the burn list's *"a pattern imposing
a naming rule nothing states"* shape, and both watched failing on the old reader before the
new accept case was believed: `date: "2026-08-24"` was "date is not YYYY-MM-DD" and
`order: "30"` was "not a number", where YAML and Obsidian read both exactly as the unquoted
form. Neither spelling is in `docs/` today, which is why nothing noticed.
`checkerAccepts.test.ts` now holds them.

One restriction was added, deliberately: the parent link is anchored at both ends, which
the raw-text pattern could not be. `parent: "[[A]] and [[B]]"` used to name `A` — ranking a
note under one of two parents, which is worse than reporting none.

**Each of the five new assertions was watched failing**, by restoring a saved copy of the
pre-change `docs-check.mjs` and running the case against it — never `git checkout`, which
took an unrelated edit with it on an earlier pass. The mechanisms, because "it went red" is
not one: the three unparseable cases and the two-parent case failed on `runRejections`'s own
first assertion, *"expected the gate to reject this document, but it passed"* — the old
reader answered every question about all four documents and exited 0. The accept case failed
the other way, naming both refusals it exists to prevent: `order ""10"" is not a number` and
`date is not YYYY-MM-DD`.

**And the instrument that measured all this was itself tested first**, on ten inputs whose
answers were computed by hand — including three that must AGREE, which is the half that
catches a comparator reporting everything as a finding. That run is what corrected the three
expectations above.

### A correction from CI, and it is the instrument again

The first push of this change **failed `npm run check`**, and the pull request body said it
passed. `fallow` refused the new `frontmatter()` at **CRAP 42** — cyclomatic 6 in a script
no test covers, which is above its threshold and was the honest answer: one function was
doing the parse, the normalization and both accessors. Split into `parseBlock` (3) and
`frontmatter` (4), same code, under the threshold.

The claim was wrong because the way it was read was wrong: the run had been piped,
`npm run check 2>&1 | tail -40`, and a pipeline exits with the status of `tail`. So `npm`
exiting 1 was read as 0. Recorded here as well as in
[[A gate that did not run looks like one that passed]], whose subject this turns out to be —
that note is about a gate that never started, and this is one that ran, said no, and had its
answer discarded on the way to being read. Both look like silence.

The connection to this note's own subject is not decorative: **a second reader of a result
is exactly what this change deleted, and I introduced one in the verification while deleting
one from the gate.** `tail` was reading the gate's output where the exit code was the answer.

### What is still not reached, and it is the same remainder as before

**This is agreement with `yaml`, not with Obsidian.** A conforming parser is a proxy for
the reader that actually decides whether a note is a work item, and only a live vault
answers that — the criterion below asked for exactly this honesty and it is unchanged by
the fix. [[Run the checks CI cannot]] is where that half lives.

And the runtime half of the original seam is untouched by construction:
`src/domain/noteFields.ts` takes an already-parsed `CachedMetadata` and never sees YAML
text, so nothing here says anything about step 2 of the table below. What changed is that
step 1 and step 3 are now the same parse.

## The limitation

`docs-check.mjs` parses frontmatter with its own regexes. The plugin parses it through
`src/domain/noteFields.ts` and Obsidian's metadata cache. **Nothing connects the two**, so
the validator can be confident about a note the runtime would read differently, and neither
side can see the disagreement.

## Evidence

A bare `parent:` — the key with nothing after it — is:

- **an absent field** to the checker, whose `field()` requires a value; and
- **an explicit root** to the runtime, where `resolveParent` returns
  `explicitRoot: keyPresent` (`src/domain/noteFields.ts:35`).

So the ADR prohibition *"an ADR carries no `parent` and no `type`"* passed for the one form
of the mistake that needs no typo at all — the form an editor, a template or an abandoned
edit leaves behind. Found by a reviewer reading both files and comparing them; invisible
from inside either.

That instance is fixed (`fm.has` tests the key, `fm.field` tests the value, and the
distinction is documented between them), and it is now **held by a test** rather than by a
comment: `test/docs/checkerRejects.test.ts` plants a bare `parent:` on an ADR and asserts
it is the *only* problem the document produces, so the prohibition cannot silently go back
to reading values. That closes the regression risk on the one known instance and moves
nothing else — the **class** is untouched, because a test that plants what we already know
to look for is the same instrument as the fix it guards. Any other place the two parsers
disagree has the same shape and the same invisibility.

## Why it is deliberate

Sharing one parser would mean importing plugin code into the docs gate. That trades this
problem for worse ones:

- `docs-check.mjs` is plain Node with **no build step** — it runs before and independently
  of `npm run build`, which is why it can report on a repository that does not compile.
- The runtime's reader is built around Obsidian's metadata cache, which does not exist
  outside the app; the fake in `test/helpers/vault.ts` is a test double, not a parser.
- It would invert the split this repository settled on: *a script over markdown checks
  markdown; a test that can load the module asks the module*. Frontmatter is markdown.

## The obvious remedy does not reach it

This note first proposed "a test that imports `noteFields.ts` and asserts the register's
notes parse the way the plugin would read them". **That would not detect this class**, and
saying so is more useful than the proposal was.

`resolveParent` takes an already-parsed `CachedMetadata` — it never sees YAML text. The
harness hands it one built by hand: `FakeVault.addFile` assembles `cache.frontmatter` from
a JavaScript object literal. So the test would assert *interpretation of synthetic cache
data* and pass while the divergence stood, because the divergence lives one step earlier:

| Step | Who does it | Covered by that test? |
| --- | --- | --- |
| `parent:` (bare) → `{ parent: null }` | Obsidian's frontmatter parser | **no** — the fake starts here |
| `parent` key present → `explicitRoot: true` | `resolveParent` | yes |
| `parent:` → "field absent" | `docs-check.mjs` | no |

The bug was in step 1 meeting step 3. A test over step 2 proves the half nobody doubted.

## What would actually lift it

Something has to read the **raw YAML** the register is written in and compare it with what
the checker concludes. Two honest options, neither free:

- **A YAML parser as a devDependency.** `yaml` and `js-yaml` are both already in
  `node_modules` transitively, so it costs a declaration, not a download — and it must be
  declared, since fallow gates dependency hygiene and reaching into an undeclared
  transitive is its own defect. Runtime dependencies stay empty either way
  ([ADR 0005](../adrs/0005-ship-with-no-runtime-dependencies.md) is about what ships).
- **A live-vault pass**, which is the only thing that can answer the question as asked.

The distinction matters and is the reason this is not simply "add the parser": a
third-party YAML parser is a **proxy for Obsidian's, not Obsidian's**. What a devDependency
could verify is *"the checker's reading agrees with a conforming YAML parser"*. What it
cannot verify is *"…agrees with Obsidian"*, and Obsidian is the reader that decides whether
a note is a work item. That second question needs a vault, like every other appearance and
identity check in this register.

## Acceptance criteria

- The register's own notes are parsed by a real YAML parser and the result compared against
  what `docs-check.mjs` concludes about the same keys — at minimum `type`, `parent`,
  `order`, `status`, and the ADR fields.
- The note is explicit that this proves agreement with *a* parser, not with Obsidian's, and
  names the live-vault check as the only thing that closes the remainder.

Raise the priority if a second divergence is found; two would make it a pattern rather than
an instance. Until then the cost is a devDependency and a corpus reader, against one closed
bug — which is the trade, stated so it can be taken knowingly rather than by default.
