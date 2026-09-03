---
type: PBI
parent: "[[Capacity against commitment]]"
order: 10
status: Done
created: 2026-08-21
source: user request — release management concept refinement, 2026-08-21
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

# Commitment against declared capacity

**As** someone deciding what ships, **I want** the committed effort set against whatever
capacity the release declared, in the unit my team uses, **so that** an over-commitment is
legible as a sentence rather than as two bare numbers.

Built 2026-09-03: `ReleaseReadiness.capacity` and `.doubleCounted`
(`src/domain/releaseReadiness.ts`), the two options that name the capacity property and the
unit (`src/domain/releaseOptions.ts`), and the strip's own figure
(`src/view/release/renderReadiness.ts`), which now draws the effort figures in that same unit
too. The commitment is the estimate summed over the members
[[The scope of a release as a tree]] resolves; the capacity is one number on the release note.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading a release |
| **Trigger** | A release being open |
| **Preconditions** | The membership key, the estimate key, the capacity key and the unit string are all configured |
| **Guarantee** | Capacity, commitment, difference and utilization are all in one unit, which is stated on screen, and nothing is converted between units. No figure is written to any note. |

**Main flow**

1. The view reads the capacity from the release note's own capacity key.
2. It sums each member's own estimate, counting every member once.
3. It shows capacity, commitment, the difference and the utilization, with the unit named.
4. It names beside the figure any member carrying an estimate while a descendant in the same
   release carries one, as possible double counting.

**Extensions**

- **1a — the capacity key is unconfigured, or the release carries no number there.** There is
  no comparison for that release: the commitment is still shown, and the missing half is
  named.
- **1b — the capacity is negative.** Nothing in this plugin writes a capacity, so there is no
  entry surface that could refuse one: the number is typed into the note by hand. It is
  therefore handled **on read** — reported as unreadable, exactly as a non-numeric capacity is,
  with no comparison, no difference and no utilization drawn from it. No unit this feature
  names can be less than none, so a negative value is a typo rather than a quantity, and
  showing a difference computed from it would dress the typo as a plan.
- **1c — the capacity is zero.** Capacity, commitment and difference are shown; utilization is
  not, and it says a percentage needs a capacity. Zero is a real statement, not an error, and
  dividing by it would print an infinity.
- **2a — a member's estimate is not a finite number.** It is not summed and it is counted as
  unestimated, which is the figure [[Summing up a release]] states rather than a second one
  here.
- **2b — the estimate key is unconfigured.** There is no commitment and therefore no
  comparison; both halves are named as unconfigured.
- **3a — the unit string is not set.** No comparison is shown at all, and the unit is listed as
  missing exactly like an unbound key — but only once the capacity key is bound. With no
  capacity property there is nothing to label, so a vault that has never configured this
  feature is told about the unbound key and not about the unit as well. Unlabelled arithmetic
  is two numbers whose meaning the reader supplies, which is the thing this feature exists to
  prevent.
- **3b — the initializer binds the key and the unit both.** ✨ (`src/view/release/init.ts`)
  used to bind the key alone, on the argument that there is no honest default for a unit a
  team has not stated. The product owner weighed that against a press that could never fully
  enable this feature and chose the press that finishes: it now binds `points`, the option's
  own placeholder, same as it does for the released-status vocabulary and the notes folder.
  A guessed unit is a real cost — it labels somebody else's numbers until they notice and
  retype it — spent on purpose so one press is enough.
- **4a — nothing in the release double counts.** The note is absent rather than present and
  empty.

## Acceptance criteria

- With capacity 40, commitment 52 and the unit "points", the screen names all four figures and
  the unit, and the difference is +12 in the same unit.
- With capacity 0, utilization is absent and named as needing a capacity; the other three
  figures still show.
- A release whose capacity is negative shows no comparison, and the value is reported as
  unreadable rather than summed, subtracted or divided by.
- With the unit unset, no comparison is rendered and the unit is reported missing.
- An epic and its feature both in the release contribute both estimates, and the possible
  double count is named beside the figure rather than resolved.
- Nothing computed here is written to the release note or to any member.

## Where it lives

The same `src/domain/` derivation as the summary, from the model in `src/domain/model.ts`.
The capacity key, the estimate key and the unit string are declared in
`src/domain/releaseOptions.ts`, and the capacity is read — and judged readable — in
`src/domain/releaseReadiness.ts`, not where every other note value is
(`src/domain/readItems.ts`): `releaseReadiness.ts` already imports types from `releases.ts`,
so a value import back the other way would be a runtime cycle, and that module already owns
the other half of this comparison (the commitment), which is its stated reason for existing.
The panel is the release summary's own render module, `src/view/release/renderReadiness.ts`.

Both halves of the comparison are arithmetic on decimals somebody TYPED, so both go through
`src/domain/decimal.ts` — `exactSum` for the commitment and `exactDifference` for the
difference. It parses each double's shortest round-trip decimal representation (what `String`
gives, which is what the user typed whenever they typed seventeen significant digits or fewer,
and otherwise the shortest decimal that comes back to the double they got) into digits and a
scale, adds and subtracts them in `BigInt`, and converts back to a double once at the end. A
new file rather than a helper beside either caller: it is the whole of one concern, it is the
layer's own kind of pure function, and the two callers sit in different layers. What it
replaced was a tolerance scaled by the number of additions performed and a rounding of the
difference to twelve significant digits, each of which reported a real difference as none — a
`1e-16` shortfall as exactly filled, and `1000000000001` over as `1000000000000`. Exact
arithmetic needs neither, which is why there is no threshold left to tune.

**The exact sum crosses the layer boundary, not the number it rounds to.**
`ReleaseReadiness.estimatedEffortExact` carries the commitment's decimal beside
`estimatedEffort`'s figure, and `renderReadiness.ts` subtracts the capacity from THAT. Rounding
in `src/domain/` first is a real defect rather than a tidiness question: no double lies between
`1e21` and `1e21 + 1`, so estimates of `1e21` and `1` against a capacity of `1e21` reported
exactly filled when the total was rounded before the subtraction. The number is for display and
the decimal is for arithmetic, and the guarantee is exact through the arithmetic and rounded
once at the end — never "nothing rounds", which is what the module's own header claimed until a
review found what the sentence cost.
