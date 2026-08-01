---
type: PBI
parent: "[[Theming]]"
order: 30
status: Open
---

# A documented restyling surface

The plugin publishes a small set of custom properties a theme or snippet author can
override, and says which ones they are.

## Why there isn't one today

Eight `--pbl-*` properties exist, and every one is **internal plumbing** rather than a
knob:

| Property | Set by | What it is |
| --- | --- | --- |
| `--pbl-prop-col`, `--pbl-prop-count` | `rows.ts:43-44` | Column width and count, per render |
| `--pbl-state-col`, `--pbl-meta-col` | `rows.ts:45-46` | Fixed column widths |
| `--pbl-indent` | `rows.ts:47` | Indent step |
| `--pbl-depth` | `rows.ts:130,150` | This row's depth |
| `--pbl-progress` | `columns.ts:271` | This bar's fill percentage |
| `--pbl-badge-rgb` | `styles.css` per level class | The badge colour |

Seven of the eight are written by TypeScript on every render, so a snippet that overrides
one is overwritten immediately — or worse, wins for the rules it reaches and loses for
the ones TS sets, giving a half-applied layout. They are a transport between the two
halves of the plugin, not an interface.

`--pbl-badge-rgb` is the exception, and it is the one people will actually want: it is
set in CSS per level class, so overriding it is the natural way to recolour the ladder.
Nothing says so, and nothing guarantees it keeps that shape.

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
