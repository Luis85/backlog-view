---
type: Issue
order: 220
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P1
area: verification
created: 2026-08-29
closed: 2026-08-29
source: main CI red for three consecutive runs
files:
  - scripts/docs-check.mjs
  - test/docs/gateVocabulary.test.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-29
due: 2026-08-29
risk: ""
assignee: ""
iteration: ""
---

# The gate was one marker behind, and 71 failures never said so

`main` went red at `npm run docs` and stayed red for three consecutive runs. The gate
reported **71 problems** across nineteen notes, and not one of them named the cause: a
type the checker does not know fails once per NOTE — `unknown type "Release"`,
`Release with no parent`, `backlog note has no order` — so a single missing entry in
`LEGAL_CHILDREN` reads as nineteen unrelated broken documents.

`docs-check.mjs` already says the rule, in the comment on `EXTRA`: *"Adding a type to
`EXTRA_TYPES` means adding it here too."* Nothing checked it. That is the exact shape the
root guide warns about — a confident paragraph is evidence of intent and of nothing else —
and it had already been paid for once: the same comment records that `Deliverable` was
missing "for the whole of the increment that introduced it".

## What was actually wrong

Two different problems wearing one error message.

**`Release` was a marker the register could not hold.** It joined `MARKER_TYPES` on
2026-08-24 with `Milestone` and `Iteration`, both of which the register already holds as
ordinary notes with a hierarchy-table row, a `LEGAL_CHILDREN` entry and a place in
`ROOT_TYPES`. `Release` got none of the three. Nothing about it justified the difference:
work names its release in a property rather than hanging from one, which makes it a root by
nature exactly as the other two are.

**A `Resource` is not a register note at all.** ADR 0028 puts it in one category with
`Absence` — recognized in order to be REFUSED, never a work item at any rung, which is why
`RESOURCE_TYPE` is deliberately kept out of `ALL_TYPES`. Every rule the gate applies asks a
question about a backlog note and none of them has an answer for a person: no rung to rank
among, no status in the register's vocabulary, no requirement to hang from.

The two notes in `docs/releases/` were also unranked, and one carried `status: New` — the
release view's own free-text status, read through `releaseStatusProperty`, which this
vault binds to `note.status`, the same key the register's conventions use. The other
release already carried `status: Open`, which is legal in both readings, so that is the
spelling both now use.

## The fix

`Resource` joins the `Absence` exemption — by TYPE, never by path, for the reason stated
there: where such a note is filed is a user setting this checker cannot see. `Release`
joins `LEGAL_CHILDREN` (empty children, like the other markers), `ROOT_TYPES` and the
hierarchy table. The two release notes gain an `order`.

## Why the two existing checks could not catch it

They compare two things that drift **together**. `checkerRejectsHierarchy.test.ts` holds
`docs/README.md`'s table to `LEGAL_CHILDREN` and back, in both directions — a genuinely
good check, and blind to this: edit both and they agree while both fall behind `src/`.
That is what happened, twice.

`test/docs/gateVocabulary.test.ts` is the third leg — the register's schema against the
**plugin's** — and it is the only one that fails when a type is added to
`typeVocabulary.ts` and nowhere else. It asks the TABLE rather than the gate's own
constants, because `docs-check.mjs` is a script with top-level await and `process.exit`,
run as a subprocess for that reason; importing its constants would mean building a seam
that then becomes the thing under test. Since the gate already holds the table to
`LEGAL_CHILDREN` both ways, a table naming every declared type is a `LEGAL_CHILDREN` that
does too.

It checks the refusal in the other direction as its own assertion rather than as a set
difference: a `Resource` must NOT appear in the table. A silent `.filter()` is how an
explicit refusal turns into an oversight nobody can find later.

Both directions were watched failing before the fix stood — the omission of `Release`, and
a planted `Resource` row — and the instrument is checked first, since a parse that quietly
found nothing would make every assertion vacuously true.

## What this does not fix

A release created by the plugin against `docs/` as a vault still arrives with no `order`,
so it fails this gate until someone ranks it. That is the register holding itself to a
convention the plugin does not write, which is true of `status` on a `Milestone` too and is
not new here. The alternative — exempting `Release` by type as well — was rejected: it
would make the register unable to hold a declared type that two of its peers already
occupy, to avoid an edit to two notes.
