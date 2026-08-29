---
type: PBI
parent: "[[Theming and styling]]"
order: 40
status: Open
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# A documented restyling surface

The plugin publishes a small set of custom properties a theme or snippet author can
override, and says which ones they are.


**As** a theme or snippet author, **I want** a named set of custom properties I can
override, **so that** I can recolour the backlog without guessing which of the plugin's
internals will survive the next release.

## Use case

| | |
| --- | --- |
| **Actor** | A theme or snippet author |
| **Trigger** | Wanting the view to match a theme |
| **Preconditions** | None |
| **Guarantee** | Every property in the contract is a promise. Renaming one is a breaking change and is called one. |

**Main flow**

1. The author reads the documented set of overridable properties.
2. They override one in a snippet — recolouring the level badges is the obvious case.
3. The view renders with their value.

**Extensions**

- **1a — the property is internal.** Marked as such where it is set, so nobody promotes one
  by documenting it. The test is **which side declares it**, not which table it appears
  in: a property TypeScript writes on every render is transport, and the ones CSS declares
  on a class are the candidates.
- **2a — the override is fought by a per-render write.** Then it was never contract
  material: a property that must be both is split into a TS-owned value and a
  user-overridable one the stylesheet composes.
- **3a — the author's snippet does not work.** A worked example ships with the
  documentation and is checked in a live vault, because a snippet that does not work is
  worse than no snippet.

## Why there isn't one today

### How to count them, and what the count was

**Do not read a census off a table.** This section carried one and it could only see
itself: it said every `--pbl-*` property but `--pbl-badge-rgb` was TS-written, which was
true of the six rows below it and false of the repository.

The rule instead, which stays right as the set grows: **a property is TS-written iff its
name appears as a `setCssProps` key under `src/`, and CSS-declared iff it appears as a
`--pbl-…:` declaration under `styles/`.** Measure it by taking every `--pbl-` occurrence
in `src/` and `styles/` as the population and then splitting it those two ways — the
population first, so nothing is measured only where it was expected to be. Two traps the
method has already caught: a name that appears **only in a comment** is in the population
and in neither half (`--pbl-busy-w`, a mechanism that was deleted, which is why the raw
occurrence count is one higher than the live set), and the split has to be checked against
the `var(--pbl-…)` READS as well, or a property nothing sets goes unnoticed.

Run that way on 2026-08-09: **26 live properties, 22 TS-written and 4 declared in CSS**,
with the reads matching the sets exactly. The four are `--pbl-badge-rgb`,
`--pbl-state-color`, `--pbl-bar-color` and `--pbl-row-tint`. The numbers will drift; the
rule above is what to re-run.

### The layout half

Every `--pbl-*` property the row and column layout leans on is **internal plumbing**
rather than a knob. Named rather than cited by line, because a line number is wrong at
the next insertion above it and a symbol is not:

| Property | Set by | What it is |
| --- | --- | --- |
| `--pbl-prop-col`, `--pbl-prop-count` | `renderTree` in `rows.ts` | Column width and count, per render |
| `--pbl-meta-col` | `renderTree` in `rows.ts` | The rollup column's fixed width |
| `--pbl-indent` | `renderTree` in `rows.ts` | Indent step |
| `--pbl-depth` | `renderItem` / `childGroupEl` in `rows.ts` | This row's depth |
| `--pbl-progress` | `renderRollup` in `columns.ts` | This bar's fill percentage |
| `--pbl-badge-rgb` | `styles/badges.css` per level class | The badge colour |

Every one of those but `--pbl-badge-rgb` is written by TypeScript on every render, so a
snippet that overrides one is overwritten immediately — or worse, wins for the rules it
reaches and loses for the ones TS sets, giving a half-applied layout. They are a transport
between the two halves of the plugin, not an interface.

### The colour half

The four CSS-declared properties are all colour, and all have the shape a contract wants:
declared on a class in a partial, read by the rules around it, never touched by TS.

- `--pbl-badge-rgb` (`styles/badges.css`, per level class) — the level ladder's colour,
  and the one people will actually want. It is the obvious first entry.
- `--pbl-state-color` (`styles/timeline.css`, per `pbl-state-N` slot class) — the workflow
  palette. `styles/legend.css` reads the same token for the swatch that names the slot, so
  overriding it recolours the bar and its legend entry together, which is a point in its
  favour rather than a complication.
- `--pbl-bar-color` (`styles/timeline.css`) — what a bar actually paints, composed from
  `--pbl-state-color` with an accent fallback and overridden outright for done bars and
  milestone marks. It is a **derived** token, so it is the one to think hardest about: it
  is exactly the "must be both" case criterion 2 asks to split, one layer down.
- `--pbl-row-tint` (`styles/timelineFurniture.css`) — the timeline's row striping and
  hover tint, declared twice at different strengths.

Deciding these three is part of the work, not a separate note: **in** makes the roadmap
themeable the same way the badges are, **out** has to be said out loud and marked at the
declaration, because "CSS-declared" is the only signal a snippet author has and all four
send it.

Nothing today says which of the four is promised, and nothing guarantees any of them
keeps its shape.

## What "documented" has to mean here

Not a list of every property that happens to exist. A **contract**: these names, this
meaning, overridable, and not renamed without treating it as a break. Everything else is
explicitly internal and may change in any release. That distinction is the deliverable —
a theme author who cannot tell the two apart has to guess, and a guess that works today
is a bug report after the next refactor.

## Acceptance criteria

- The overridable set is chosen, named and documented, with the badge colours in it. Keep
  it small: every property in the contract is a promise, and `Codebase health` already
  paid for the lesson that a configurable surface costs more than the rename it buys.
- **Each CSS-declared property gets an explicit in-or-out verdict**, not just the badge
  one — `--pbl-state-color`, `--pbl-bar-color` and `--pbl-row-tint` are declared exactly
  the way the badge token is, so leaving them unmentioned publishes them by accident.
  The set is found by re-running the method in **How to count them**, not by reading a
  list off this note.
- Contract properties are **not** overwritten per render. Anything TS writes each pass is
  internal by definition, so a property that needs to be both has to be split into a
  TS-owned value and a user-overridable one that the stylesheet composes.
- The internal ones are marked as such where they are set, so the next contributor does
  not promote one by documenting it.
- A worked snippet ships with the documentation — recolouring the level badges is the
  obvious one — and it is checked in a live vault, because a snippet that does not work
  is worse than no snippet.
- The contract lives where a theme author will find it (the README, not only `docs/`).
- Renaming a contract property is a breaking change and is called one in `RELEASING.md`
  terms. `--pbl-*` names are as much a published surface as the view-option keys are, and
  the register already knows what happens when a persisted name moves.

## Where it lives

**Nothing yet — this note is design.** `src/view/render/rows.ts` sets every layout
`--pbl-*` property but one per render (`renderTree` for the widths, the indent step and the
column count; `renderItem` and `childGroupEl` for the depth), and
`src/view/render/columns.ts` sets that one, `--pbl-progress` · `styles/badges.css` sets `--pbl-badge-rgb` per
level class, the obvious first contract entry, and it is not the only candidate:
`styles/timeline.css` declares `--pbl-state-color` and `--pbl-bar-color` and
`styles/timelineFurniture.css` declares `--pbl-row-tint`, the same shape one layer out ·
`README.md` is where a theme author will look, so the contract goes there rather than only
in `docs/` · `RELEASING.md` carries the versioning terms a breaking rename would need.
