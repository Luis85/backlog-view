# Migrating the live-vault verifications into the test catalog

**Date** 2026-08-11 · **Ships in** 0.7.0, inside the release pull request (#120)

0.7.0 publishes the test catalog — `Test suite` and `Test case` as a ladder of their own,
with a Tests projection that draws it. The register has carried its own live-vault
verifications as `Issue` notes since there was nowhere else to put them. This moves them
into the schema the release ships, so the plugin's own backlog demonstrates the feature it
is publishing.

## What the register had already decided

Read before proposing anything, and it constrains most of the design:

- `docs/README.md` already documents `tests/suites/` and `tests/cases/` with both types.
  The folders do not exist; the layout was written down when the types were designed.
- `docs-check.mjs` already knows the ladder — `Test suite` → `Test case` → `Task` — and
  lists `Test suite` in `ROOT_TYPES`. Suites therefore take **no parent**, which is
  [[Tests stay out of the plan]] holding by construction rather than by a rule anyone
  applies.
- [[A cadence for the checks CI cannot run]] (Done) requires the sweep set be **derived,
  not listed** — `RELEASING.md` names a query, never an enumeration — and its extension 2f
  records *why* that query is folder-scoped: the plans under `docs/superpowers/` quote
  draft notes verbatim, frontmatter and `## How to check` heading included, so a query
  matching on heading or type alone returns a verification twice, once at a path nobody
  can date an `Outcome` on.
- `docs-check.mjs` gates the pairing already: a note carrying `## How to check` with no
  `cadence:` fails, and a `cadence:` with no such heading fails.
- The Preconditions / Steps / Expected-result skeleton in [[A template for a test case]] is
  for cases **created in a vault** from a template. It is not a format to retrofit.

## The migration

### What moves

Every note carrying `## How to check` as a whole heading line — **25 of the 83 issues**,
24 at `cadence: release` and one at `cadence: conditional`
([[Verify base identity in a live vault]]). Both cadences move: the conditional one keeps
its own trigger as a property of the case, which is what extension 2a asks for, rather
than by living in a different folder under a different type.

`docs/issues/<name>.md` → `docs/tests/cases/<name>.md`, `type: Issue` → `type: Test case`.

The other 58 issues stay where they are. `area: verification` was considered and refused as
the boundary for the same reason the cadence note refused it: it labels records like
[[A comment that states a rule is not a check]] that no device can run.

### The five suites

Organised **by subject**, applying the rule [[A test suite that can be navigated]] states
for the automated suite — *the file you want is the file you would have named*. Each is a
`Test suite` note in `docs/tests/suites/`, no parent, ordered among the catalog's roots.

| Suite | Cases |
| --- | --- |
| The tree in a live vault | 8 — context menu, quick filter and Show completed items, drag between siblings and into a parent, columns and narrowing, keyboard moves, undo, badges and icons, parent links Obsidian parsed |
| The board in a live vault | 4 — the board smoke test, card moves, card carrying hidden matches, columns and the filtered header |
| The roadmap in a live vault | 6 — writable timeline, legend with two workflows, axis picker and bucket drag, inferred bar appearance, milestone appearance, dated axis month header |
| Appearance and chrome | 4 — visual changes, the four button-specificity fixes, card children, column agreements |
| Platform and vault identity | 3 — touch paths on a phone, folder-note layout, base identity |

**Amended after the plan's own discovery.** This table originally put "parent links
Obsidian parsed" under platform and vault identity (7 and 4), on the assumption every case
not already under one of the three retyped Features would land fresh there. Task 3 of the
plan found it already hanging under `Smoke test the tree` — via the Feature's own
`parent:` link, before this design's suites existed — and left it there rather than moving
it, which the plan's Task 4 table records with an explicit placeholder row. The counts
above are the landed shape, 8 and 3; the plan is the later and better-informed document.

The alternative considered was grouping by **what a run needs** — desktop pointer, touch
device, themed vault, restart — which batches the expensive context switch and would make
a sweep four sittings rather than five. Refused because it inverts the rule above: "where
is the test for bar dragging" stops having a guessable answer, and guessability is what
makes a suite documentation rather than a list.

### Two things found while planning, which the design above did not know

**1. Three of the five suites already exist, as Features.** `Plugin Features Smoke Test`
(Epic) holds [[Smoke test the tree]], [[Smoke test the board]] and
[[Smoke test the roadmap]], and **16 of the 25 cases already hang under those three**. So
the tree, board and roadmap suites are a *retype* of notes that exist, not new notes —
`type: Feature` → `type: Test suite`, `parent:` removed because a suite is a root type.

That leaves the Epic holding nothing. It is not deleted: this register keeps closed notes,
and an Epic whose only purpose was to group smoke tests is itself the finding — the plan
holding tests, which [[Tests stay out of the plan]] now forbids. It is closed with a line
saying the catalog superseded it and where its children went.

**2. Nine cases hang off plan items, and reparenting them severs the only link there is.**
[[Smoke test the column agreements]] sits under [[WIP limits]], [[Smoke test the card
children in a live vault]] under [[Children on the card]], and so on through
[[Creating items]], [[Collapse persistence]], [[Product Kanban]] and [[Product Backlog]].
Today that parent link is the *entire* connection between a feature and the check that
proves it.

[[Linking a test to what it covers]] is the feature that replaces it, and it is design, not
built — so a straight reparent destroys the information with nothing to hold it. Each of
those nine cases therefore gains a **`Covers [[<the plan item>]]`** line in its body,
naming what it used to hang under. Prose, not a property: the coverage property is not
bound, and inventing frontmatter ahead of the feature that owns it is the drift this
register keeps writing notes about. When the property ships, these lines are the
migration's own input.

### Case frontmatter

`type: Test case`, `parent: "[[<suite>]]"`, `order`, and **`cadence` kept verbatim** —
it is what the sweep reads and what `docs-check.mjs` gates. `status`, `priority`, `area`,
`created`, `source` and `closed` carry over unchanged.

### Case bodies

Untouched, with one addition: an explicit **Preconditions** line per case. Several bury it
in prose today — "run it once the epic's features land", "unanswerable without a device" —
and a precondition a walker has to infer from a paragraph is the one they skip.

The `## Runs` tables stay, and so does the "what remains, and why this stays open" analysis
several notes carry. Rewriting 25 dense notes into the template skeleton was considered and
refused: [[Smoke test the board in a live vault]] exists partly to record that a multi-part
line had two cases pass and three never run, and its own closing paragraph says an
acceptance criterion "must not be closable on a summary that quietly counted a partly-run
line as done". A bulk rewrite is exactly that summary.

### The sweep

`RELEASING.md`'s query changes one token — `docs/issues/` → `docs/tests/cases/` — and
nothing else. Extension 2f's reason survives untouched, because the query is still scoped
by folder.

The **walk** is then named as the vault's Tests projection: `npm run test-build`, open the
repository as a vault, switch to Tests, walk each suite top to bottom. The grep stays
authoritative for "did we miss one", because the cadence note chose a runnable query
precisely so the answer could be checked rather than trusted — and a projection cannot be
run from a terminal.

### The gate that would switch itself off

The cadence rule in `scripts/docs-check.mjs` opens `if (note.type !== "Issue") continue;`.
**Retyping the 25 notes to `Test case` disables it on every one of them, silently** — the
notes keep their `cadence:` and their heading, the gate simply stops looking, and
`npm run docs` goes on passing. That is the exact shape
[[A gate that did not run looks like one that passed]] is named after, and it is the single
highest-risk step in this migration: the retype and the guard have to land in the same
commit.

The guard becomes **both types** rather than a swap to `Test case`. A swap is one token
smaller and leaves a hole: `## How to check` in an `Issue` is a habit contributors have,
and after this migration it means a verification filed in the wrong folder under the wrong
type — which is worth failing rather than ignoring.

`test/docs/checkerAccepts.test.ts` and `test/docs/checkerRejects.test.ts` run the real
gate over planted trees in both directions, so this gets a planted `Test case` on each
side: one carrying heading and cadence together (accepted), one carrying the heading with
no cadence (rejected). Without the rejecting case the guard change is unchecked, and an
unchecked guard is what this section is about.

## Collateral, all of it caught by the gate

`npm run docs` validates every wikilink and every source path a current note names, so the
migration is checkable rather than careful:

- **Relative links inside the moved notes re-base.** `../requirements/X` resolves from
  `docs/issues/` and not from `docs/tests/cases/`; it becomes `../../requirements/X`.
- **Inbound path citations update.** `styles/toolbarFit.css`,
  [[Layout survives translated text]], ADR 0020, [[Cross-cutting concerns]] and others name
  these notes by path.
- **`[[Wikilinks]]` are unaffected** — they resolve by basename, and no note is renamed.
- **`docs/README.md`** needs only its `issues/` row narrowed; the `tests/` rows already
  describe the destination.

## Out of scope

- **No coverage property and no `Covers…` links.** [[Linking a test to what it covers]] is
  design, not built.
- **No test-state migration.** The `Runs` tables remain the history. Moving run outcomes
  into the test workflow's state property is a separate question, and a state per case
  cannot express "this line passed and those three never ran", which is the thing several
  of these notes exist to say.
- **No change to the cadence itself.** [[A cadence for the checks CI cannot run]] stays
  `status: Done`. This changes where its set lives, not when it is walked.

## Ordering inside the release pull request

The migration lands **before** anyone dates an `Outcome` for 0.7.0, because the sweep is
then walked from `docs/tests/cases/`. That ordering is the whole of the interaction between
this work and the release; nothing else in #120 touches these notes.

Recommending this as a follow-up PR was put and declined — recorded here because a reader
finding a large register move inside a release PR should see that it was a decision.
