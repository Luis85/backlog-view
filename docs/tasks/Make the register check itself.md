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

It also caught a bug in its own first draft: the module count read the markdown walker
instead of the TypeScript one and reported 3 modules where there are 59. A validator with
a bug is precisely what it exists to prevent, so the count is printed on every run rather
than only the failures — a number that is obviously wrong is a check that says so.

## Outcome

`npm run check` is five steps now, and `docs/` is gated like `src/`. The register's
integrity is a command rather than a claim, and the one stale reference is reported every
run instead of being exempted by name.
