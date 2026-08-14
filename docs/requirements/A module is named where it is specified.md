---
type: PBI
parent: "[[Guides that describe rather than enumerate]]"
order: 10
status: Done
area: docs
created: 2026-08-03
closed: 2026-08-03
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A module is named where it is specified

**As** someone changing this plugin, **I want** the register's module rule to ask that a
module be named where its behaviour is *specified*, **so that** satisfying it means saying
what the code is for rather than mentioning a path in passing.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever adds, splits or renames a module in `src/` |
| **Trigger** | `npm run check`, on every build |
| **Preconditions** | None. The rule already holds for every module but the ADR-named one, so it lands on a clean file without a note written to satisfy it |
| **Guarantee** | A module that no use case and no ADR claims fails the build. What satisfies the rule is a claim of ownership by a use case or an ADR, in the section where that claim is made — never a path token anywhere under `docs/`. The check sees the *section*, not whether the sentence around the path describes anything: it is a proxy for description, and a good one because those two sections are where a note says what it owns. |

**Main flow**

1. A module is added to `src/`, or an existing one is split in two.
2. Its path is added to the `## Where it lives` section of the use case whose behaviour it
   serves.
3. `docs-check.mjs` finds it there and passes.
4. A reader who meets the module later can go from the file to the use case that asked
   for it.

**Extensions**

- **1a — the module is architecture rather than behaviour.** An ADR names it instead —
  **in its `## Decision` section, not anywhere in the record.** `src/view/host.ts` is the
  case that exists: it is the interface the layer rule is built on, no use case owns it,
  and ADR 0003 names it under `## Decision`, where the choice is made. So the rule lands
  clean on the one module that needs this form.

  The section matters for the same reason `## Where it lives` does. An ADR's `## Context`
  and `## Alternatives` sections exist to describe things that were **considered and
  rejected** — a path mentioned there is evidence that a module was *discussed*, which is
  precisely the mention-only satisfaction this note exists to stop. Accepting a path
  anywhere in an ADR would keep the loophole open for exactly the notes least likely to be
  read as specifications.
- **2a — the path is mentioned somewhere else under `docs/` instead.** No longer enough,
  and closing that is the point. The old rule asked only that a path token appear anywhere
  under `docs/` — the register itself called this *"satisfiable by mentioning the file and
  describing nothing"* when it **retired the same rule for `test/`**. That criticism was
  always true of `src/` too; what saved it in practice was a convention the rule did not
  check.
- **2b — the module is named only by a record note.** A `Task`, `Issue` or `Bug` naming a
  path is a record of a moment, not a specification, and those notes are already allowed to
  name paths that have since moved. So they do not satisfy this rule. Measured before
  writing it: **no module in `src/` is currently named only by a record note**, so nothing
  has to be written to adopt this.
- **3a — the rule fails on a module that ought to be exempt.** Then it is named in an ADR
  or the exemption is wrong. There is deliberately no suppression list: the same reasoning
  `.fallowrc.json`'s `usedClassMembers` uses — declare the answer in one place rather than
  suppress the question at the site.
- **4a — the reason cited for the rule is the architecture table.** It was, and that table
  was deleted by [[A guide is prose, not an inventory]]. The reason changes with the
  anchor: not *"the architecture table names one per concern"* but **"a module nothing
  specifies is a capability nobody asked for."** A rule kept with a justification its own
  register has falsified is the defect this epic exists to remove.

## Acceptance criteria

- `docs-check.mjs` accepts a module named in a use case's `## Where it lives` section, or
  in an ADR's `## Decision` section, and rejects one named only elsewhere under `docs/` —
  including one named only by a `Task`, `Issue` or `Bug`.
- A path in an ADR's `## Context`, `## Consequences`, `## Alternatives` or
  `## Revisit when` does **not** satisfy the rule, and a planted case proves it. Those
  sections describe what was weighed and rejected; treating a mention there as a
  specification reopens the hole from the one direction nobody would check.
- Sections are matched the way this checker already matches them — as lines, with code
  stripped first — so a heading quoted in a sentence or an example inside a fence is not
  the document's own structure. That rule exists in `docs-check.mjs` already and is reused
  rather than restated.
- Both directions are planted and re-run: the rejections in
  `test/docs/checkerRejects.test.ts`, and — because a false failure is the one a
  contributor works around rather than reports — the ADR-`Decision` and use-case forms in
  `test/docs/checkerAccepts.test.ts`.
- The rule passes on `src/` as it stands, with no note written to satisfy it.
- `docs/README.md` states the rule's reason in its new terms, and no longer cites the
  deleted table.
- `test/` stays outside the rule, for the reason its retirement gave.

## Where it lives

`docs-check.mjs` · `docs/README.md` · `test/docs/checkerAccepts.test.ts` ·
`test/docs/checkerRejects.test.ts`

**The ADR-named module is deliberately not listed here.** Naming it in a `Where it lives`
section would satisfy the rule through the use-case arm, leaving the ADR arm unexercised
by anything but a planted fixture — and would break this note's own criterion that no note
is written to satisfy the rule. It stays in ADR 0003, which is the case being tested.
