# PR 223 review fixes — ranking findings

Three findings from the code review of PR 223 (`feat: one global rank, ranking at the
focused level`). Two write a wrong rank; one refuses in silence. Each is fixed where every
caller routes through it, not at the reported symptom.

## Context

The branch `claude/backlog-ranking-levels-152ntx` replaced sibling-scoped ordering with one
global rank. A rank comes from `anchoredOrder` (`src/domain/writePlan.ts`): a placement
names an anchor row and a side, and the number is a midpoint between that anchor's
neighbours in the globally rank-sorted population. Three inputs reach it — a drag
(`src/domain/dropTargets.ts`), Alt+arrow and the move menu (both via
`src/view/interactions/structure.ts`).

`isUnrankedContext(row)` (`src/domain/dropTargets.ts`) is `row.outsideFilter && row.order
=== null`: a row the Base excluded that carries no rank. No writer may ever give it one, so
it constrains nothing. `focusPeers(model)` is `model.roots` with those rows dropped.

## Global constraints

- `npm run check` passes: build, lint, markdown, coverage-thresholded tests, fallow, docs
  register. All six. Coverage thresholds in `vitest.config.mts` only ever go up.
- Every invariant a comment states gets a test that fails without it, and the test is
  **watched failing**: revert the fix, run it, see red, restore. Say in the report that you
  did this and what the failure output was.
- No new i18n keys unless no existing key says the fact. Text rules in `CLAUDE.md` apply.
- No new module and no new abstraction. Each fix is inside an existing function or is one
  existing predicate applied at a population site that forgot it.
- Add the `[Unreleased]` entry your change earns to `CHANGELOG.md`.
- Comment in the register's voice: state the rule and the defect it prevents, not the
  mechanics of the diff.

## Task 1 — the tree branch drops unranked context rows from the population

**Defect.** `siblingContext` (`src/view/interactions/structure.ts`) and `siblingPosition`
(`src/domain/dropTargets.ts`) both filter unranked context rows out of the population in
their FOCUS branch (via `focusPeers`) and both leave them in the TREE branch, where the
population is `item.parent ? item.parent.children : model.realRoots`.

An unranked context row always sorts last, so it becomes the anchor for any append.
`anchoredOrder` then skips it as an anchor and appends past the END of the whole global
population.

Reproduced: root group `Epic A(1000)`, `Epic B(2000)`, `Epic C(outsideFilter, order null)`,
with a nested `Feature C1(3000)`. `Move to bottom` / `Move down` on Epic A writes `4000` —
past Feature C1 — instead of a slot beside Epic B. `compareSiblings` keeps the unranked
context row last, so the rendered tree does not change: an offered command that writes,
spends the undo slot and moves nothing.

`edgeTarget`'s "already at that edge" test (`ctx.idx === ctx.fullList.length - 1`) reads the
same unfiltered list, which is why `Move to bottom` is offered at all.

**Required behaviour.** The tree branch ranks among the same rows the focus branch does: an
unranked context row is neither a peer to swap past nor an anchor to land beside, in either
branch. A RANKED context row stays in both — its order is a real placement constraint.

Both `siblingContext` and `siblingPosition` must read one shared function, not two spellings
of one rule: the keyboard and the drag disagreeing about the same row is the defect this
whole area keeps producing. `focusPeers` is today's shared function over `model.roots`;
generalise it to the population it is handed rather than adding a second filter beside it.

**Tests.** `test/domain/dropTargets.test.ts` for the drag, `test/view/` for the keyboard and
menu paths. Assert the rule at BOTH kinds of population — a nested group
(`parent.children`) and `model.realRoots` — and assert that a RANKED context row is still a
peer. `test/view/contextRowWrites.test.ts` is the invariant suite for this area; read it
before writing new fixtures.

## Task 2 — `anchoredOrder` ignores its anchor when the population is empty

**Defect.** `anchoredOrder` (`src/domain/writePlan.ts`) answers a hard-coded `ORDER_SPACING`
when `usable.length === 0`, discarding the anchor. `dropPlacement`'s peer-scoped fallback
reaches it whenever the target has no peers, because that fallback's population IS the peer
list.

Reproduced on a legacy vault: dropping inside a childless `Feature A1(10)` — tied with
`Feature B1(10)`, which is what puts the drop on the fallback path — returns `{order: 1000}`,
a rank unrelated to the drop site. And because it is a constant, `rankTaken` finds 1000
occupied on the next such gesture anywhere in the vault, so the legacy-vault fallback works
exactly once per vault and refuses `tied` from then on.

**Required behaviour.** An empty population with an anchor is not an empty population. Only
the anchorless case is the first rank in an empty backlog.

- No anchor: `ORDER_SPACING`, unchanged — nothing to be between.
- Anchor carrying an order: a rank one spacing clear of it on the given side. `edgeRank` is
  the one arithmetic for that and already refuses a value it cannot get clear of; do not
  spell the expression a second time.
- Anchor carrying no order: the `unranked` refusal, which is what the global path already
  answers for a null-order neighbour (see the neighbour check below the early return). An
  unranked CONTEXT anchor is handled above this line already and must stay handled there.

**Tests.** `test/domain/rankedPlacement.test.ts` and the `writePlan` suites. Drive it through
`dropPlacement` with an empty peer group on a tied legacy fixture — `orderForTarget` is
deliberately not exported (ADR 0033) and the test must not re-open that door. Assert the
second gesture too: the bug's signature is that the first drop worked and the second refused.

## Task 3 — `indent` refuses a vanished named destination in silence

**Defect.** `indent` (`src/view/interactions/structure.ts`) returns with no notice when
`namedParentPath` no longer resolves in the model:

```ts
if (namedParentPath !== undefined && !named) return;
```

Its own docblock says such a command "must re-resolve THAT note by path and refuse if it is
no longer a valid destination". It does refuse — silently. `liveItem`, `performDrop` and
`newItemOrder` all report the same fact.

**Required behaviour.** Report it, the way `liveItem` does. `rank.itemGone` already says it
("That item is no longer in this base, so nothing was moved.") and names the note the
command was about, which is exactly what the vanished destination is — reuse it rather than
adding a key. The keyboard path passes no path and is unaffected.

**Tests.** A view test that opens `Indent under "X"` against a model that no longer holds X
and asserts the notice, beside the existing silent-refusal coverage.

## Task 4 — the remaining append sites forgot the same predicate

**Defect.** Task 1 applied `rankablePeers` at the two population sites the review named.
Task 1's own review then found a third, and a grep found two more. Every one of them builds
`peers` from a children list and appends at `insertIndex === peers.length`, so
`orderForTarget` takes the LAST peer as the anchor. When that trailing row is an unranked
context row — `outsideFilter` with no order, which always sorts last — `anchoredOrder` skips
it and the write lands past the end of the whole global population, nowhere near the parent
the user aimed at. Silent, and it spends the undo slot. This is Task 1's defect at four more
sites:

- `insidePosition` (`src/domain/dropTargets.ts:157`) — the drag's `inside` zone.
- `indentTarget` (`src/view/interactions/structure.ts:270`) — the menu's `Indent under "X"`
  and Alt+Right.
- `newItemOrder` (`src/view/interactions/create.ts:260`) — `New <child>`.
- the release scope creation (`src/view/release/scopeCreate.ts:257`).

A context row CAN sit among a real parent's children: an ancestor is pulled in for one
grandchild (`src/domain/readItems.ts`), so its other children are the filtered-in ones and it
is a middle sibling. The existing fixture that covers that shape
(`test/domain/dropTargets.test.ts`, `mixedGroup`) uses a RANKED context sibling and asserts
only `.parent`, which is why nothing saw this.

**Required behaviour.** The rule is the one the context-row section of `CLAUDE.md` already
states: an unranked context row is never a ranking peer. Apply `rankablePeers` — the function
Task 1 generalised — at each of the four sites. A RANKED context row stays a peer everywhere,
unchanged.

`anchoredOrder`'s existing "a context PARENT is a legal destination for `New <child>`, so the
child goes to the end" branch is about an empty peer group and stays exactly as it is. This
task is about a trailing context CHILD beside real ranked ones, which is a different fact.

**Also check, and report rather than assume:** `outdentTarget`
(`src/view/interactions/structure.ts`) builds an unfiltered list too, but takes its anchor as
`peers.indexOf(parent) + 1`. If the parent is always in that list the anchor is right by
identity and there is nothing to fix; if `indexOf` can miss, `insertIndex` is 0 and the anchor
becomes `peers[0]`, which can be an unranked context row on a `before` placement. Establish
which, and say so in your report. Do not change it without evidence.

**Tests.** One per site, at the level that site belongs to: `test/domain/dropTargets.test.ts`
for the drag, `test/view/` for the menu, the keyboard and the two creation paths. Assert the
written NUMBER, not just the parent — the existing fixture's blind spot is exactly that it
asserted `.parent` alone. Assert a ranked context sibling still counts as a peer at one site,
so the fix cannot be over-applied.

## Task 5 — the README overstates what a context row refuses

**Defect.** `README.md` (the context-rows list, the bullet beginning "**nothing ever writes
into them.**") says of a context row: "what is refused is a move of the context row itself
(no before/after drop onto it, no **Move up/down/to top/to bottom**, no **Outdent** from
it)".

The "no before/after drop onto it" clause stopped being true on this branch.
`siblingPosition`'s focus branch (`src/domain/dropTargets.ts`) runs BEFORE the
`item.outsideFilter` refusal and admits a RANKED context row, and `siblingContext`
(`src/view/interactions/structure.ts`) keeps one among the focus peers for the keyboard and
the menu. So at a focus level, a before/after drop onto a ranked context row is offered and
lands — the README tells the reader it never is, hiding behaviour this branch introduces.

The clauses beside it are still correct and must stay: **Move up/down/to top/to bottom** and
**Outdent** move the context row ITSELF, which `siblingContext` still refuses for every
`outsideFilter` row.

**Required behaviour.** Qualify the drop clause rather than deleting it: a before/after drop
onto a context row is refused when it is unranked, or when the placement is not a focus-level
rank. Say what a reader can act on — at a focus level, a context row that carries a rank is a
position other rows can be ranked around, because its rank is a real constraint the view can
see. Keep the surrounding prose's voice and length; this is a qualification, not a new
section.

Check the same claim wherever else the register states it — `docs/requirements/` and the
in-app manual (`src/view/manual/`) may carry the same sentence. Fix every copy you find, or
report that there is only one.

**Tests.** None beyond `npm run check`'s markdown and docs-register gates: this is
documentation. If the in-app manual carries the claim, its own text test may need updating.
