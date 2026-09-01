# Release readiness and the figures beside it

The next increment of **Release Management**: the three predicates a release decision rests
on, the checklist that states them, and the summary figures that are those same predicates
counted.

## What ships

Two PBIs, one of them whole:

- **`Answering the readiness checklist`** (under *Release readiness*) — closes, less the
  testing criterion.
- **`Summing up a release`** (under *The release summary*) — the whole remainder except the
  double-count qualifier. Its item count and items-denominator progress shipped 2026-08-28.

Three criteria, three figures, **one predicate each**:

| Criterion | Clears when | Figure beside it |
| --- | --- | --- |
| Estimated | the member's estimate is a finite number | how many members carry no estimate |
| Dependencies resolved | no prerequisite is outstanding | how many members are blocked |
| Critical risks addressed | the member is not critical, or is addressed | how many carry an unaddressed critical risk |

The effort figures ride the same estimate key: estimated effort, completed effort, and the
estimate-denominator progress.

## Out of scope, and why

- **The testing criterion.** A fourth vocabulary the vault must write, mapping to no figure.
  A new PBI stub under *Release readiness* carries it.
- **The double-count qualifier** — a member with an estimate whose descendant in the same
  release also has one. It belongs to *Capacity against commitment*, which is the next
  increment. **This is a known ceiling**: until then the effort total is wrong in a vault
  whose parent estimates are aggregates. It gets a `ponytail:` comment naming the ceiling
  and pointing at that feature, so the gap is marked rather than silent.
- **Capacity, the unit, and utilization** — the whole of *Capacity against commitment*.
- **The index bands.** Readiness is a single-release question.
- **`Trying a scope change`**, which sits on all of it.

## Settings

Five options on the release view's own bag (`domain/releaseOptions.ts`), never the backlog
view's — *Release readiness*'s "never one borrowed from the view that writes it".

| Option | Reads | ✨ suggests |
| --- | --- | --- |
| `estimateProperty` | a number on a member | `effort` — the estimation view's own key, so a vault pressing ✨ in both views lands on one property |
| `dependsOnProperty` | the prerequisite edges | `dependsOn` — `PROPERTY_TABLE`'s own row |
| `riskProperty` | the risk value | `risk` — same |
| `criticalRiskValues` | which values are critical | not a candidate |
| `addressedRiskValues` | which values count as addressed | not a candidate |

The two value lists follow `releaseStatusValues`: a vocabulary is the vault's to write, so ✨
cannot hand one out. The three keys join `RELEASE_SUGGESTED_KEYS`, whose own rule is that a
press leaving a feature unconfigured "did half the job".

**What clears a prerequisite is this view's already-bound `stateProperty` and its done
values.** No sixth and seventh option. The readiness note asks each criterion to declare its
own key and values; this view's state key already is its own, which is what that rule
protects against. A separate "cleared at" list is a later slice, for the day a vault clears a
dependency short of done.

**Unconfigured is a third answer everywhere, never zero and never a pass.** A missing key —
and a risk criterion whose key is bound with an empty value list — both read *not configured*
and name what is missing. `Summing up a release` extensions 2a, 3a and 3b; the readiness
note's "a key bound with no value list is unconfigured, not empty".

## Where it lives

**`src/domain/releaseReadiness.ts`** (new). One exported function, one walk over
`scope.rows` filtered to members, returning the three verdicts and the six figures together —
they are the same three predicates read twice, and the summary note forbids a second count.
`releases.ts` is at 805 lines and answers a different question.

It reuses rather than restates:

- `ReleaseFigure<T>` from `releases.ts` — the three-answer shape every figure here has.
- `noteFields.ts` for every read (`ownValue`, `readString`, `linkpathFromRawValue`).
- `ownWorkflowReading` from `board.ts` for a prerequisite's doneness, so a Deliverable
  prerequisite answers by its own workflow — the reader the progress bar already uses.
- `scope.rows`, never a second walk of the model. Context rows are skipped: an excluded
  ancestor is not a member, so it is in no denominator and no count.

A prerequisite the model does not hold — outside the base, or a broken link — is
**unreadable**, not cleared. It costs the member its criterion and is reported separately
(extension 5a).

**`src/view/release/renderReadiness.ts`** (new) draws the chip row and the new figures;
`renderScope.ts` is at 584 lines and calls it from `drawHeader` after `drawSummary`. Chips
reuse `.pbl-state-chip`; `styles/releaseReadiness.css` carries the three verdict colours.

`src/i18n/en.ts` gains the criterion names and the unconfigured wording;
`domain/releaseReadiness.ts` joins the swept list. Property keys and the vault's own risk
values stay data.

**Nothing writes.** No `applySafely`, no plan, no undo slot.

## What the harness settled

Mocked before implementation (`npm run harness -- test/harness/mock.ts`, uncommitted), at
900px and 560px, dark and light, against the real stylesheet.

- **The estimate progress is one figure, not a second percentage.** `9 of 15 pts (60%)`
  beside the existing bar, rather than `9 of 15 pts done` and `60% by estimate` as two
  figures — which put two percentages in competition and wrapped the strip to a second line
  at 900px. Progress still names its denominator, without minting a rival number.
- **The narrow case needs no new CSS.** At 560px `.pbl-rel-footline .pbl-rel-summary`'s
  existing `flex: 1 1 22em` drops the actions to their own line and keeps the bar with its
  figures; the chip row below is unaffected.
- **The unestimated figure is unconfigured when the estimate key is.** The mock drew
  `2 unestimated` beside `effort: estimate property not configured` — a contradiction, since
  both read the same key. Extension 2a names only the effort figures and the estimate
  denominator; the unestimated figure belongs in that list.
- **All three unconfigured collapses to one chip** — `Readiness: 3 criteria not configured`,
  naming all three in its tooltip. Three chips saying nothing three times is noise on exactly
  the vault that most needs signal, and one chip still *lists* them, which is what the
  readiness note requires. **Any mix keeps individual chips.**
- **An unconfigured chip is recessive** (muted, italic) beside a coloured verdict. Deliberate:
  an unbound key is a setup task, not a release blocker. Owed a live-vault look.

Still owed regardless: the chip colours in a themed vault, and whether Bases offers the five
new options where the picker expects them (`npm run test-build`).

## Checks

`test/domain/releaseReadiness.test.ts`, stated from the rule rather than the implementation:

- A member with three unmet prerequisites adds **one** to blocked, not three; a member
  carrying three risk values adds at most one.
- **Unconfigured is never zero** — once per predicate, and twice for risk (key absent; key
  bound with an empty list).
- **A context ancestor changes no number.** Context rows above, beside and between members;
  every figure and verdict asserted unchanged.
- **The estimate predicate**: `TBD`, `""`, `null`, `NaN`, `Infinity` are each unestimated; a
  number is not. Exported, so `A definition of ready` reuses it rather than writing a second.
- **Absence is an answer for risk**: a `Low` and a missing value both clear it. Only a
  critical value that is not addressed costs the criterion an item.
- **No edges is resolved** — the other exception.

`test/view/releaseReadiness.test.ts`: the chip row draws three chips; the all-unconfigured
case draws one; a mix draws three; and **a spy on the write gate never fires** while the
screen renders — the category check on the call rather than a list of paths.

`test/i18n/projections.test.ts` already marks the whole catalog and drives every projection,
so the new text is caught there rather than by a per-key list.

`npm run check` — all seven steps, Ubuntu and Windows.
