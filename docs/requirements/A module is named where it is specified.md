---
type: PBI
parent: "[[Guides that describe rather than enumerate]]"
order: 10
status: Open
area: docs
created: 2026-08-03
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
| **Preconditions** | None. The rule is already true of 48 of 49 modules, so it lands on a clean file |
| **Guarantee** | A module that no use case and no ADR claims fails the build. What satisfies the rule is a description, never a mention. |

**Main flow**

1. A module is added to `src/`, or an existing one is split in two.
2. Its path is added to the `## Where it lives` section of the use case whose behaviour it
   serves.
3. `docs-check.mjs` finds it there and passes.
4. A reader who meets the module later can go from the file to the use case that asked
   for it.

**Extensions**

- **1a — the module is architecture rather than behaviour.** An ADR names it instead.
  `src/view/host.ts` is the case that exists: it is the interface the layer rule is built
  on, no use case owns it, and ADR 0003 describes it exactly. The rule accepts either
  section, so this is a legal form rather than an exemption.
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
  is being deleted by [[A guide is prose, not an inventory]]. The reason changes with the
  anchor: not *"the architecture table names one per concern"* but **"a module nothing
  specifies is a capability nobody asked for."** A rule kept with a justification its own
  register has falsified is the defect this epic exists to remove.

## Acceptance criteria

- `docs-check.mjs` accepts a module named in a `## Where it lives` section, or in an ADR,
  and rejects one named only elsewhere under `docs/` — including one named only by a
  `Task`, `Issue` or `Bug`.
- Both directions are planted and re-run: the rejection in
  `test/docs/checkerRejects.test.ts`, and — because a false failure is the one a
  contributor works around rather than reports — the ADR-named and use-case-named forms in
  `test/docs/checkerAccepts.test.ts`.
- The rule passes on `src/` as it stands, with no note written to satisfy it.
- `docs/README.md` states the rule's reason in its new terms, and no longer cites the
  deleted table.
- `test/` stays outside the rule, for the reason its retirement gave.

## Where it lives

`docs-check.mjs` · `docs/README.md` · `test/docs/checkerAccepts.test.ts` ·
`test/docs/checkerRejects.test.ts` · `src/view/host.ts` (the ADR-named case)
