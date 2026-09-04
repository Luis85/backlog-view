---
type: PBI
parent: "[[Release readiness]]"
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

# Answering the readiness checklist

**As** someone deciding whether to ship, **I want** each readiness criterion answered over the
release's own members with a count behind it, **so that** the decision is made against stated
criteria instead of a feeling.

Shipped 2026-09-02, as three chips under the single-release screen's footline. Each criterion
reads keys and value lists this view names for itself, over the membership
[[The scope of a release as a tree]] resolves.

## Use case

| | |
| --- | --- |
| **Actor** | Someone deciding whether to ship |
| **Trigger** | A release being open |
| **Preconditions** | The membership property is configured |
| **Guarantee** | Every criterion is evaluated over one denominator — the members — and reports satisfied, partly or not, with the count behind it. No criterion blocks anything, and evaluating them writes nothing. |

**Main flow**

1. The view takes the members as the denominator for every criterion.
2. For each configured criterion it evaluates every member against that criterion's own key
   and its own value list.
3. It reports satisfied when all members clear it, not when none do, and partly otherwise —
   with how many cleared.
4. It reports separately the members the criterion could not read.
5. The verdict is advisory: nothing on the screen is disabled by it.

**Extensions**

- **1a — the release has no members.** Every criterion reads as having nothing to check. An
  empty release satisfies nothing.
- **2a — a criterion's key is unconfigured.** It is listed as unconfigured — neither passed nor
  failed — and it is not counted in any total of criteria met.
- **2b — a criterion reads a vocabulary and has no value list.** Unconfigured, not empty, and
  the same answer as no key at all: a key says where a value lives and nothing about which of
  its values clears anything.
- **2c — the dependency criterion has an edge key but no prerequisite state key or clearing
  values.** Unconfigured. An edge says what a thing waits for and nothing about whether the
  wait is over.
- **2d — the estimate criterion meets a non-finite value.** It does not clear: `TBD`, an empty
  string and anything non-numeric are the missing estimate wearing a value.
- **2e — a member has no risk value, or a non-critical one.** It clears the risk criterion.
  The criterion asks whether *critical* risks are addressed, so only a critical value that is
  not among the addressed ones costs it an item.
- **2f — a member has no dependency edges.** It clears the dependency criterion: an empty edge
  list is removed rather than stored, so absence there means nothing outstanding.
- **4a — a member cannot be read by a criterion that does not treat absence as an answer.** It
  is counted as not clearing and reported separately, because an unanswered item is not a
  passing one.
- **5a — a criterion is not satisfied and the user ships anyway.** Nothing refuses it. The
  outstanding count is stated at the moment of the decision — see [[Marking a release as
  released]] — and that is all.

## Acceptance criteria

- Each criterion states satisfied, partly with a count, or not, over the member set alone.
- An unconfigured key, and a bound key with no value list, both read as unconfigured, and
  neither appears as a pass or a fail.
- A member with a `Low` risk and a member with no risk value both clear the risk criterion; a
  member with an unaddressed critical value does not.
- A member with no dependency edges clears the dependency criterion.
- A member whose estimate is `TBD` does not clear the estimate criterion.
- An empty release reports every criterion as having nothing to check.
- No control anywhere in the view is disabled by a criterion's verdict.

## Where it lives

The criteria are evaluated in `src/domain/releaseReadiness.ts`, beside the summary's figures
— over the population `releaseScope` (`src/domain/releases.ts`) already resolved out of the
model in `src/domain/model.ts`, rather than a second walk of it — reading
`src/domain/dependencies.ts` for the edges.

**Corrected 2026-09-02 against what shipped**, in two places this note had wrong. The five
options are `src/domain/releaseOptions.ts`'s — the `estimateProperty`, `dependsOnProperty` and
`riskProperty` keys, resolving to `estimateKey`, `dependsOnKey` and `riskKey`, and the
`criticalRiskValues` and `addressedRiskValues` vocabularies — never
`src/domain/viewOptions.ts`, which is the backlog view's own options module and reaches no
property this screen reads; [[Summing up a release]] corrected the identical sentence for the
identical reason. And nothing checks them for consistency: `releaseNoteProblems` and
`membershipCollision` (`src/domain/settingsConsistency.ts`) enumerate the keys a RELEASE note
carries, and these three name properties on the MEMBERS' notes, so they are outside the
question that check asks rather than an omission from it.

The checklist is drawn by `src/view/release/renderReadiness.ts` — the chip row under the
header's footline, and the effort figures that join the summary strip
`src/view/release/renderScope.ts` already draws — and styled by `styles/releaseReadiness.css`,
which adds the three verdict colours and the row's own layout to the `.pbl-state-chip`
(`styles/columns.css`) it reuses. A module of its own rather than more of `renderScope.ts`: it
draws a different thing from a different model, and nothing in it derives a number — every
figure and every verdict is handed to it by the one walk above.

**The risk criterion's own third fix button** (Task 4, beside `estimateProperty`'s and
`capacityProperty`'s from Task 2) is `editRiskValues` in `src/view/release/readinessFix.ts`,
drawn beside the chip row exactly when `riskProperty` IS bound and one of the two
vocabularies is empty — with the key itself unbound there is no vocabulary to write yet.
It opens `src/ui/twoFieldPrompt.ts`'s `TwoFieldPromptModal`, a `ui/` leaf beside
`prompts.ts` and `textPrompt.ts` for that file's own reason (its 400-line budget), so
both risk lists are written from one press — `view.config.set` twice, then one
`view.render()` — rather than two dialogs that could leave a criterion half-configured
on a cancel between them.

**Two decisions the code cannot show.** A prerequisite is cleared by **this view's own
already-bound `stateProperty` and its done values**, not by a sixth and seventh option: the
rule that each criterion declares its own key guards against borrowing the key from the view
that WRITES it, and this view's state key already IS its own. A separate "cleared at" list is
a later slice, for the day a vault clears a dependency short of done. And **every criterion
unconfigured collapses to one chip**, naming all three in its tooltip and in a `.pbl-sr-only`
span beside the count — three chips saying nothing three times is noise on exactly the vault
that most needs signal, a first run where ✨ has bound the keys and nobody has written the
risk vocabularies yet. The names ride the chip itself rather than the tooltip alone because
the chip is a static, unfocusable `div`, which a tooltip reaches by pointer and nobody else.

**Two of the three criteria's own keys stopped being read-only on 2026-09-04 (Task 8 of
[[Release readiness]]), and the guarantee above is unchanged by it.** "Evaluating them
writes nothing" is a claim about the CHECKLIST — the three verdict chips this note
describes, still a pure read over `releaseReadiness`'s own walk. It was never a claim
about the member's own properties, and two of those now have a write path: the scope
tree's per-row Effort and Risk chips (`src/view/release/scopeChips.ts`, drawn read-only in
Task 7) open a dialog and a menu respectively, planned by `memberEffortWrites` and
`memberRiskWrites` (`src/domain/releaseWritePlan.ts`) and applied through
`ReleaseView.applyRelease` — the same gate the release note's own status and description
already went through. A member's effort or risk set this way is what the NEXT evaluation
of this checklist reads; nothing here recomputes a verdict as a side effect of the write,
because the redraw that follows every batch does that already.

**A chip is a drill-down as well as a verdict, since 2026-09-04 (Task 11).** An unsatisfied
criterion's chip is a real `<button>` — `outstandingPaths` (Task 9) is the same field the
count came from, so the toggle can never disagree with the number beside it — carrying
`aria-pressed` and narrowing the scope tree, through `rowsForPaths` (Task 10 of [[The scope
of a release as a tree]]), to exactly the members failing that criterion and the ancestors
holding them in place. A satisfied, empty or unconfigured criterion keeps the plain,
unfocusable `div` it always drew: a control that filtered to the whole tree, or to nothing,
would be a control that lies. The narrowing is `ReleaseView.criterionFilter` — session
state, deliberately, never the view-state store and never the `.base`, for the shelf
search's own reason (`src/view/CLAUDE.md`) — and it clears itself the moment the criterion
it names is satisfied, on the next render: work the list to zero and the screen hands the
release back. Hide-done yields to an active filter (its EFFECT only; the stored preference
is untouched), because a member can be done and still be outstanding on a criterion, and
hiding the row the reader is being shown to fix would be the dead end this whole feature
exists to remove. Drawn in `src/view/release/renderReadiness.ts` (the chip),
`src/view/release/renderScope.ts` (the narrowing, between the readiness walk and the tree)
and `src/view/release/scopeToolbar.ts` (the toolbar's own way to clear it).
