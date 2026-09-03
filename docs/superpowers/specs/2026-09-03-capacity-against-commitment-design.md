# Capacity against commitment, on the release summary strip

**Date** 2026-09-03 · **Branch** `claude/next-increment-brainstorm-7pr3nj`
**Epic** [[Release Management]] · **Feature** [[Capacity against commitment]]
**PBI** [[Commitment against declared capacity]]

## What this is

The release summary strip states the item count, the progress, the effort, the unestimated
count, the blocked count and the critical risks. It does not state what the release said it
could take. This adds that one figure: **capacity, commitment, the difference and the
utilization, in the unit the vault estimates in, on the strip that already carries the rest.**

It also fixes the harness entry that was found broken while mocking it — see slice C. That
is in scope because the release view is the screen this increment draws on, and it could not
be looked at outside Obsidian at all.

The layout was drawn in `test/harness/mock.ts` against the real assembled stylesheet before
any of it was built, which is the order this repository's release work already keeps. What
that answered is wrapping, spacing and hierarchy on Obsidian's DEFAULT colours: the figure
takes a second line of the strip at full width and a fourth at a 380px pane, and the
refusals read as refusals beside the numbers. A themed vault's colours and accent, and
anything Bases hands the view, are still owed a live-vault check.

## The decisions this rests on

| Decision | Why |
| --- | --- |
| Commitment is `readiness.estimatedEffort`, not a new sum | `releaseReadiness.ts` already sums each member's own estimate over `scope.members`, once, beside the criterion that reads the same key. A second sum here is the second walk that module exists to prevent, and two sums can disagree. |
| Capacity is a `ReleaseFigure<number>` on `ReleaseReadiness` | It is one value on the release note, exactly like `version`, `target` and `status`, but it is read in `releaseReadiness.ts` rather than beside them in `releases.ts`: that module already imports types from `releases.ts`, so a value import back the other way would be a runtime cycle, and it already owns the other half of this comparison (the commitment), which is its stated reason for existing. The three-state figure is what lets the strip tell "no key bound" from "somebody typed something unreadable" from "a number". |
| Negative capacity is judged on READ | Nothing in this plugin writes a capacity, so there is no entry surface to refuse one at — extension 1b. The feature note says "refused where it is entered", which no surface can deliver; **that sentence is what changes**, not the extension. |
| `estimateValue` is the reader, unchanged | It already returns `null` for a non-numeric value and for a negative one, and its own comment cites this feature as the reason it refuses negatives. Reusing it makes "an unreadable capacity and an unreadable estimate are the same judgement" true by construction. |
| The unit is one string on the view, not a property | The feature note's own argument: two properties would let a release disagree with its neighbour about the unit while the comparison added them up, and `40 points` in one field is a string nothing can sum. |
| One figure on the existing strip | The strip already wraps by design (`.pbl-rel-summary` is `flex-wrap`), every class this needs is in the sheet, and a dedicated region or a second bar is a new idiom for one sentence. Confirmed in the harness rather than assumed. |
| The double count is NAMED, never resolved | Only the vault knows whether its parent estimates are aggregates. A view that guessed would be silently wrong in whichever direction it guessed — the feature note's own words. |
| Utilization only where capacity > 0 **and the result is finite** | Dividing by zero prints an infinity as a percentage. Zero capacity is a real statement and keeps the other three figures. A positive capacity is not enough on its own: `estimateValue` accepts any finite non-negative number, so a capacity near `Number.MIN_VALUE` against an ordinary commitment overflows the ratio, and `∞%` is a percentage nobody can act on. The figure is drawn from `Number.isFinite` on the computed percentage, never from the sign of the capacity alone. |

## The strip

```
▓▓▓░░░░░  33%  1 of 3 items done   5 of 8 pts (63%)   1 unestimated
52 of 40 pts committed (130%, 12 over)   2 members may double count
```

| State | What the strip says |
| --- | --- |
| Over-committed | `52 of 40 pts committed (130%, 12 over)` |
| Under-committed | `31 of 40 pts committed (78%, 9 left)` |
| Capacity zero | `52 of 0 pts committed (52 over)` + `A percentage needs a capacity` |
| Utilization overflows | `52 of 0.000…1 pts committed (52 over)` + `The utilization is too large to state` — the same three figures, a different reason for the missing fourth |
| Capacity negative or not a number | `52 pts committed` + `Capacity is not a number` |
| Capacity key unbound | `52 pts committed` + `Capacity is not configured` |
| Key bound, no value on the note | `52 pts committed` + `This release declares no capacity` |
| Unit unset | no comparison at all + `The capacity unit is not set` |
| Estimate key unbound | no commitment and no comparison — the strip's existing `Effort is not configured` covers it |
| A double count exists | `N members may double count`, beside the figure. Absent when there is none. |

Each refusal is `.pbl-rel-unreadable`; each number is `.pbl-rel-figure`. Both classes exist.

## Slice A — the numbers

**`src/domain/releaseReadiness.ts`** gains `capacity: ReleaseFigure<number>` on
`ReleaseReadiness`, not on `ReleaseRow` in `domain/releases.ts` as first drawn:
`releaseReadiness.ts` already imports types from `releases.ts`, so a value import back the
other way is a runtime cycle — and that module already owns the other half of this
comparison (the commitment), which is its stated reason for existing. It is read the same
way `version` is, from the release note's own frontmatter, with the three-state figure's
fourth reading kept apart: no key bound is `unconfigured`, a key holding a value
`estimateValue` refuses is `invalid`, a bound key with nothing at it is neither — value
`null` and both flags false, which is how `version` and `target` already say "absent" — and
anything else is the number. Absent and unconfigured are drawn differently because they send
the reader to different places: one is a property to bind, the other a number to type.

**`src/domain/releaseReadiness.ts`** gains one function returning the double-count figure: a
single pass over `scope.rows` carrying a stack of the open estimated members, counting each
member that carries an estimate **while a DESCENDANT member in the same release carries one**
— the feature note's own direction, and not its reverse. The two differ wherever a subtree is
not a chain: one estimated Epic over two estimated PBIs is **one** possible double count, the
Epic, and counting the descendants instead would report two. It reads `isEstimated`, so it can
never disagree with the sums beside it. Context rows are not members
and are in no count — the context-row rule, asked of this figure like every other.

The comparison itself — difference, utilization, and which of the seven states holds — is
derived at the render from `capacity` and `estimatedEffort`. Nothing is stored, nothing is
written, and no clock is read.

## Slice B — the options and the figure

**`src/domain/releaseOptions.ts`** gains two rows in the release group: `capacityProperty`
(a `property` option, `notePropsOnly`) and `capacityUnit` (a `text` option). Both carry
catalogue keys, and no message re-spells either label — it is taken as a parameter from the
option's own key, which `test/i18n/optionLabels.test.ts` enforces.

**`src/view/release/renderReadiness.ts`** draws the figure after the effort figures, in the
same strip element, by the table above. Its provenance span names the capacity property
beside the estimate property that is already named there.

**`i18n/en.ts`** gains the sentences: the comparison, the over and under phrases, the four
refusals and the double-count note. Plural categories on the two counted ones.

## Slice C — the harness entry, and a gate for it

`npm run harness -- test/harness/release.ts` could not build: `test/helpers/release.ts`
imported `flush` from `test/helpers/view.ts`, which reads `node:fs` and imports vitest, so
esbuild refused the whole graph. **Fixed by inlining the one-line `flush`** (commit
`2b8db56`), which is what made the mock above possible at all.

The gate is the invariant asked at the forbidden thing rather than at today's four entries:
a vitest test that bundles each harness entry with esbuild's `metafile` and fails if any
`node:` builtin, or vitest, appears anywhere in the resulting graph. esbuild is already a
devDependency and each bundle is well under a second. A list of "these imports are banned in
these files" would pass the day somebody adds a fifth entry with the same defect.

A `docs/bugs/` note records the defect, what it cost (the release view was unlookable outside
Obsidian, which is exactly the class of question jsdom cannot answer) and the gate.

## Testing

- `test/domain/` — the capacity figure across its four readings (unbound, absent, unreadable,
  negative, a number) and the sentence each reading draws and the double-count walk (an epic and its feature both estimated; an
  epic estimated with an unestimated child; a context ancestor never counted; nothing double
  counting returning zero rather than a present-and-empty figure).
- `test/view/release/` — the strip across the seven states in the table, asserted by
  **message key** rather than by wording ([[Tests do not read English]]), and one assertion
  that nothing on this path plans a batch, which the view's own read-only test already
  states at the calls.
- `test/harness/` — the bundle-graph gate of slice C, which fails against the pre-fix tree.
- Coverage thresholds only ever go up.

## What this does NOT do

- **No capacity figure on the index band.** [[Every release in one list]] owns that screen,
  and its bands are already two lines. A row's own capacity is a later slice.
- **No writing of a capacity.** The number is typed into the release note by hand, which is
  what makes extension 1b a read-time judgement.
- **No resolution of the double count.** It is named and left to the reader.
- **No unit conversion, ever.** One unit string, and the commitment is in it by construction.

## Register corrections this forces

- [[Capacity against commitment]] says a negative capacity is "refused where it is entered".
  No surface can refuse it — nothing writes a capacity. The sentence changes to the read-time
  judgement its own PBI already specifies.
- [[Commitment against declared capacity]]'s `## Where it lives` names `src/view/render/`,
  which is the BACKLOG view's render directory. The release screen renders in
  `src/view/release/`.
