---
type: PBI
parent: "[[Shipping a release]]"
order: 10
status: Active
created: 2026-08-21
source: user request — release management concept refinement, 2026-08-21
started: 2026-08-29
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Marking a release as released

**As** someone who has just shipped, **I want** to mark the release as released and have the
day recorded, **so that** the plan closes and the date it actually happened survives the plan
it happened against.

Built on 2026-08-29 — one batch against the release note alone, through the same gate as
every write. **Active rather than Done**: what a live vault has to confirm is the undo, which
is the only place the single-entry claim can be seen rather than asserted, and the actions
area's appearance beside the header.

## Use case

| | |
| --- | --- |
| **Actor** | Someone who has just shipped |
| **Trigger** | Choosing to release the open release |
| **Preconditions** | The release status key, the **one** value this action writes, the values that count as released, and the actual-date key are all configured |
| **Guarantee** | One batch writes the released status and the actual date to the release note and to nothing else. The planned target date is never written. Undo takes both back together. |

**Main flow**

1. The user chooses to release the open release.
2. The view states what is outstanding — unfinished members, and any readiness criterion not
   satisfied — and asks for confirmation.
3. One batch writes **the configured transition value** and today's date, into the two keys
   this view names.
4. The unfinished members are listed by name, with the action that moves them.
5. Undo takes the batch back as one.

**Extensions**

- **1a — the release is already at a released value.** The action is not offered; there is
  nothing to write and nothing to record twice.
- **1b — the release note is outside the Base's filter.** The action is not offered, and a
  batch naming it is refused whole.
- **2a — a readiness criterion is not satisfied.** It is stated, and it refuses nothing. The
  checklist informs the judgement and does not make it.
- **2b — nothing is outstanding.** The confirmation says so rather than showing an empty list.
- **2c — the user cancels.** Nothing is written and no undo slot is spent.
- **3a — the status key, the transition value or the released-value list is unconfigured.**
  The action is not offered at all, and the release screen says which option to bind. A key
  with no value list is unconfigured, not empty.
- **3b — the actual-date key is unconfigured.** The action is not offered either: a release
  marked shipped with no record of when is the half of this that cannot be reconstructed
  later.
- **3c — the actual-date key is the same key as the target date.** The configuration is
  refused where it is entered, because a record that overwrites the plan destroys the only
  evidence a release slipped.
- **3d — several values count as released** — `Released` and `Archived`, say. That list answers
  only "is this release already out"; **which value to write is its own option, holding one
  value**, because a list is not a choice and a view that picked from one would write a
  different status depending on how somebody ordered it. A transition value that is not among
  the released values is refused where it is entered.
- **4a — a note the Base excluded names this release.** It is **not** in the outstanding list
  and not counted in it. The list is derived from the results, and a row outside the filter is
  never a source of anything so derived — the same answer [[Generating the release notes]]
  gives, and it has to be the same, because both are reports over one population. An excluded
  ancestor that surfaces as context stays context here.

## Acceptance criteria

- The batch names the release note alone: no member is written to by releasing.
- The actual date is written to its own key and the target date is unchanged by the batch.
- Binding the actual-date key to the target-date key is refused at configuration.
- With the status key, the transition value, the released-value list, or the actual-date key
  unconfigured, the action is absent and the missing option is named.
- With two released values configured, the batch writes the configured transition value and no
  other, and a transition value outside the released list is refused at configuration.
- Releasing with an unsatisfied readiness criterion succeeds, and the criterion is stated
  before the confirmation.
- Cancelling writes nothing and leaves the undo slot untouched.
- Undo restores the status and the actual date to **the values they held before the batch** —
  which is the absence of an actual date only where there was none. A release note that
  already carried an actual date gets that date back, not an empty key.
- An excluded note naming this release appears nowhere in the outstanding list or its count.

## Where it lives

The action is `src/view/release/releaseClose.ts`, drawn from `drawHeader` in
`src/view/release/renderScope.ts` into the header's own footline — so it is on the screen
before any empty-state return is reached, and the ordering is structural rather than a
comment somebody must not break. That is what extension 1a needs: a release with no members
at all is the one screen it can be exercised on, and an action drawn below that return could
never be pressed there.
The batch is planned by `releaseClosureWrites` in `src/domain/releaseWritePlan.ts` as ONE
write with two sets, and applied by `src/storage/propertyWrite.ts` over
`src/view/writeGate.ts`.

The status key, its released values, the transition value and the actual-date key are
declared in `src/domain/releaseOptions.ts`, with the same-key refusal and the
transition-value check in `src/domain/settingsConsistency.ts`. Whether the action is offered
at all, and which option is still unbound, is `closeOffer` in `src/domain/releases.ts`;
whether the row on screen still matches the live note is `closingFieldsMoved` beside it. The
confirmation is `src/ui/confirmDialog.ts` — the one dialog shape `src/ui/prompts.ts` does not
cover, because every modal there collects a VALUE and this one collects a decision, with the
outstanding members as rows it can open.

**All four of those options are bound by ✨ since 2026-08-30, and three of them are not
properties** — so the press has a second sweep of its own. `RELEASE_SUGGESTED_VALUES` and
that sweep are in `src/view/release/init.ts`; the vocabulary it writes is
`DEFAULT_RELEASED_VALUES` in `src/domain/settings.ts`, which is DOMAIN DATA and never the
catalog — a bound status value is matched against what release notes carry, so a
catalog-sourced one would have a reader on a German Obsidian hand over a vault whose
releases an English reader's view reports as not released. The transition row reads
`releasedValuesOf` (`src/domain/releaseOptions.ts`, exported for that second reader rather
than re-split beside it), so the value it binds is one of the values the row above it has
just bound — `configProblems`' own rule made structural instead of restated.

Two readers of the press had to widen with it, and each was a way the offer and the action
could come apart. `boundKeys` in `src/view/release/newRelease.ts` decides whether a press
changed anything and read property keys alone, so a press whose only work was one of these
three compared equal, reported that it bound nothing and skipped the redraw. `anythingToBind`
in `src/view/release/initControl.ts` decides whether the empty state's ✨ is drawn at all, and
on the same filter: an upgraded vault with every property bound and one closing option still
unset would have been shown no button for work a press would really do.

**Two narrowings, recorded rather than quietly taken.** Flow 2 asks the confirmation to
state unsatisfied readiness criteria; readiness is [[Answering the readiness checklist]] and
is not built, so the confirmation states outstanding members only. Flow 4 asks for "the
action that moves them"; what shipped is an OPEN, so the per-member transition it names is
not built here — a `Set state` control per row needs a second batch and a second undo slot
beside the release's own.

**And two corrections.** This section named `configProblems` as the gate; this view's own
collision report is `releaseNoteProblems`, which did not exist when this note was written.
And extension 3a's "the release screen says which option to bind" is answered by
`closeOffer.missing`, a UNION rather than a list of strings, so an option this action
refuses to run without and has no name for is a build error rather than a blank in a
sentence.
