---
type: PBI
parent: "[[Theming and styling]]"
order: 40
status: Open
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
  by documenting it. Seven of the eight `--pbl-*` properties are written by TypeScript on
  every render and are transport, not interface.
- **2a — the override is fought by a per-render write.** Then it was never contract
  material: a property that must be both is split into a TS-owned value and a
  user-overridable one the stylesheet composes.
- **3a — the author's snippet does not work.** A worked example ships with the
  documentation and is checked in a live vault, because a snippet that does not work is
  worse than no snippet.

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

## Where it lives

**Nothing yet — this note is design.** `src/view/render/rows.ts` sets six of the eight
`--pbl-*` properties per render, and
`src/view/render/columns.ts` sets the seventh · `styles.css` sets `--pbl-badge-rgb` per
level class, which is the one that looks like a knob and is the obvious contract candidate ·
`README.md` is where a theme author will look, so the contract goes there rather than only
in `docs/` · `RELEASING.md` carries the versioning terms a breaking rename would need.
