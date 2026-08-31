---
type: Issue
order: 40
parent: "[[Adding work from a release's scope]]"
status: Open
priority: P2
area: design
created: 2026-08-30
source: PR review of the global-rank branch, Task 7
files:
  - src/view/release/scopeCreate.ts
  - src/i18n/en.ts
  - src/commands/rank.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A rank refusal on the release screen names a remedy that screen cannot reach

## The limitation

Creating a member from a release's scope tree ranks the new note exactly as any other
creation does, through `dropPlacement`, and reports a refusal with the same sentence the
backlog view uses (`refusalKey`, `src/domain/writePlan.ts`). Every one of those sentences
names a remedy that lives somewhere else:

- `rank.unranked` — *"Use the toolbar's set-up button to fill in the missing ones."* The
  release view HAS a ✨ in its own toolbar, which makes this worse rather than better: it
  binds the release view's own options and **touches no note**, so a user who follows the
  advice presses a button that cannot fill a rank. The button that does is the backlog
  view's, in another pane the user may not have open. On the scope screen the release ✨
  is not even drawn — `renderReleaseInit` appears there only in the `noMembership` empty
  state.
- `rank.gapSpent` and `rank.tied` — *"Run 'Respace ranks' / 'Seed ranks from the
  hierarchy' from the command palette."* Both commands are `checkCallback`-gated on a
  BACKLOG view being the active leaf (`activeBacklogView`), because the rank space is that
  view's population. From the release view they are not in the palette at all.

So a user on that screen is told to do something, and the thing is not there. The
actionable path exists — open a backlog Bases view and act from it — and nothing on this
screen says so.

## Why it is deliberate

Only the reuse is deliberate. Routing this creation through the shared placement was the
correct fix — a second idea of how a new note is ranked is what produced a `New <child>`
that refused where a drag beside it worked — and the refusal sentences came with it. What
was not decided is what a refusal should SAY on a screen with no backlog view under it.

Narrowing the sentences per view is the obvious move and it is the wrong one: a message
that names the caller's own screen puts view knowledge in a catalog string that
`domain/` picks, and `RankRefusal` carries a reason and never a place.

## What would lift it

Either the release screen catches the refusal itself and says something true of the
release screen — the sentences are picked by `refusalKey` at the call site, so this costs
a branch in `scopeCreate.ts` and new keys, not a change to the shared ones — or the two
rank commands stop being gated on the backlog view and take their population from whatever
Bases view is active. The second is much wider than this note: it is a question about what
the rank space IS when the active view is not the backlog, and ADR 0033 says the space is
the Base's population, which the release view also has.

## Impact

One creation refused with unusable advice, on a screen where creating members is the whole
point. It needs a legacy or a dense vault to reach at all — the refusal is the same one
the backlog view raises, and there it is actionable — so the exposure is the population of
vaults that hit a rank refusal AND meet it from the release screen first.

## Acceptance criteria

None; recorded so the next reader knows the sentence was reused knowingly and the gap is
where the remedy lives, not in the refusal. Raise the priority if a user reports being
stuck on that screen.
