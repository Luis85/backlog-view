---
type: PBI
parent: "[[Enforced invariants]]"
order: 10
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-09
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Invariants as checks, not conventions

**As** someone changing this plugin in a hurry, **I want** the rules that matter to fail
the build, **so that** I find out from a command I already run rather than from a review
that might not happen or a bug that ships.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever is changing the plugin |
| **Trigger** | `npm run check`, which CI runs identically |
| **Preconditions** | None |
| **Guarantee** | A rule is either mechanical or it sits beside the code it governs. It is never only in a document far away. |

**Main flow**

1. A rule is written down. The first question asked of it: **can this be a check?**
2. If it can, it becomes a lint rule. Today that covers layer direction, the write boundary
   (`processFrontMatter`, `vault.create` and local-storage access are banned outside
   `storage/`), ranking over real roots, menu anchoring (`showAtMouseEvent` outside the one
   module that decides anchoring), and level maths that must chain down parents rather than
   depth.
3. The rule is **verified by planting the violation** and watching lint reject it — a check
   nobody has seen fail is a check nobody knows works.
4. If it cannot be mechanised, it goes in the layer's own `CLAUDE.md`, beside the code, so
   it is loaded when someone is working there.

**Extensions**

- **1a — the rule is about behaviour rather than structure.** It becomes a test instead —
  the context-row stress suite drives every write entry point rather than naming them.
- **2a — the rule is about a framework-invoked member** that looks dead to static analysis
  (`BasesView.type`, suggest callbacks). It is **declared** in `.fallowrc.json`'s
  `usedClassMembers`, not suppressed inline. A suppression comment hides the question; a
  declaration answers it in one place.
- **4a — the rules pile up in one document.** They are split per layer. One wall of text
  far from the code is read once and never again.

## Acceptance criteria

- Layer direction, the write boundary, ranking over real roots, menu anchoring and level
  maths all fail the build rather than review.
- Each rule is verified by planting the violation and watching lint reject it.
- Rules that cannot be mechanised sit in the layer's own `CLAUDE.md`, not in one wall of
  text far from the code.
- `npm run check` is the whole gate — every step `package.json`'s `check` script chains,
  whatever that list grows to — and CI runs the same command.

## Where it lives

`eslint.config.mjs` · `.fallowrc.json` · `vitest.config.mts` (coverage thresholds, which
only ever go up) · `CLAUDE.md` and `src/*/CLAUDE.md`.
Done by: [[Enforce and colocate invariants]], [[Stop deriving levels from depth]].
