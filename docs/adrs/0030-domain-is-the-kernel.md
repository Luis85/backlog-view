---
adr: 30
title: domain/ is the kernel
status: Accepted
date: 2026-08-16
area: architecture
---

# 0030 — `domain/` is the kernel

## Context

The SDD of 2026-08-16 proposes plugin/core/application/infrastructure/views.
This repository enforces main → commands → view → storage → domain
([ADR 0003](0003-four-layers-enforced-by-lint.md)), with ui/ and i18n/ as
leaves. [[A view per capability]] needs one implementation of each shared
concept below every view; it is indifferent to directory names. The issue
[[The SDD's layers are not the four this repository enforces]] requires this
question answered in writing before any directory is created under src/.

## Decision

domain/ IS the shared kernel: pure, node-tested, lint-fenced. storage/ stays the
one write boundary. ADR 0003 is confirmed, not superseded.

No application layer. A use case remains a host method plus a pure planner. The
test for ever adding one: two views measurably duplicating the same use case —
counted in code, not predicted.

Each view owns its registration file; `main.ts` composes. The write path's
vault-wide half (one batch at a time, one undo slot) becomes a plugin-wide
`WriteLock`; validation, refusal and busy publication stay per view. The lock
is `src/view/writeLock.ts`; the gate stays `src/view/writeGate.ts`.

Registration files are `src/view/registerBacklogView.ts`.

A second view nests under `view/` (`view/estimation/`). The per-view split of
`view/` (`view/backlog/` + a lint edge between view directories) is deferred to
the extraction feature, where a third directory earns it. Until then, "views
import nothing of each other" is convention here and checked nowhere.

That second view's model configuration and its own registration land as one
piece: `src/domain/scoringModel.ts`, `src/domain/defaultModel.ts`,
`src/domain/estimationSettings.ts` and `src/domain/estimationOptions.ts` are the
estimation view's own half of `domain/`'s configuration split (ADR 0026's
shape, applied a second time — a shape, a resolver reading `BasesViewConfig`,
and the options schema it is read from); `src/view/estimation/estimationView.ts`
is the view itself and `src/view/estimation/register.ts` is
`registerEstimationView`, called from `main.ts` beside the backlog's own.

The table itself is a later piece, under the same split. `src/domain/weightedScore.ts`
is the scoring arithmetic, the model fingerprint and the write-stamp rules — no note, no
vault, exactly the shape `domain/` already keeps for the backlog's own planners.
`src/domain/estimationItems.ts` (`buildEstimationModel`) reads the vault into it, one
`EstimationItem` per result, the same one-`getFileCache`-per-note rule `domain/model.ts`
keeps for the backlog. `src/view/estimation/renderTable.ts` is the free function over
`EstimationView` that draws the table and wires its selection and keyboard —
`renderPass.ts`'s own shape, imported by `estimationView.ts` rather than the other way
round, so the two files cannot cycle.

## Consequences

The SDD's directory tree is not adopted. Modules this refactor adds are named
here as they land, so docs-check rule 7 holds per commit.

## Alternatives

- **Adopt the SDD's tree now** — `plugin/`, `core/`, `application/`,
  `infrastructure/`, `views/`. Rejected: this repository's file-size caps and
  `no-restricted-imports` edges are tuned to a flat four-layer tree, so the rename
  touches every import, every layer rule and every `## Where it lives` path the
  register cites — paid before any of this refactor's own work lands, for a
  diagram rather than a behaviour.
- **Split `storage/` into the SDD's `vault/` / `metadata/` / `bases/` / `events/`
  / `mutations/`.** Rejected: "everything that puts bytes in the vault is in one
  place" is what lets the write boundary be one `no-restricted-syntax` rule; five
  directories turn it into five rules to keep in sync, for a description that is
  more granular without being more true.
- **Build the `application/` layer now, ahead of a second view.** Rejected on the
  Decision's own stated test: nothing yet duplicates a use case across two views,
  so a layer built now would carry no code of its own.
- **Leave the issue's three questions open a while longer.** Rejected: its own
  acceptance criterion blocks every directory this refactor wants under `src/`
  until the first one is answered in writing, and every later task in this
  refactor is waiting on it.

## Revisit when

- **Two views measurably duplicate the same use case** — the Decision's own test
  for an application layer, counted in code once `view/estimation/` exists, not
  predicted now.
- **A third view lands under `view/`.** That is the point the Decision names for
  the per-view split (`view/backlog/` beside `view/estimation/`, plus the lint
  edge between them) to earn its cost; until then the boundary is convention,
  checked nowhere.
- **The `WriteLock` split turns out wrong once built** — if validation, refusal
  or busy publication cannot actually stay per view once `view/estimation/` has
  its own write path, that is evidence against the boundary this record draws,
  not a defect in one view's code.
